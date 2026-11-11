/**
 * ============================================================================
 * Hotel SaaS Platform v2 — SignalR NotificationHub Load & Isolation Test (k6)
 * ============================================================================
 * Target:
 *   - POST /hubs/notifications/negotiate?negotiateVersion=1
 *   - WS   /hubs/notifications?id=<connectionToken>&access_token=<jwt>
 *
 * Scenarios verified under concurrent load:
 *   1. WebSocket handshake & SignalR JSON protocol v1 (\x1e framing)
 *   2. Authorized branch channel subscription: JoinProperty(authorizedPropertyId)
 *   3. Multi-branch isolation under load: JoinProperty(otherBranchPropertyId)
 *      must be rejected with HubException "ERR_PROPERTY_FORBIDDEN"
 *   4. Real-time broadcast latency & connection stability
 *
 * Run:
 *   k6 run -e BASE_URL=http://localhost:5000 \
 *          -e JWT_TOKEN=<scoped_jwt> \
 *          -e PROPERTY_ID=22222222-2222-2222-2222-222222222221 \
 *          -e FORBIDDEN_PROPERTY_ID=22222222-2222-2222-2222-222222222222 \
 *          scripts/load-tests/signalr-hub.k6.js
 * ============================================================================
 */

import http from 'k6/http';
import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

const RECORD_SEPARATOR = '\x1e';

// Custom Prometheus/k6 Metrics
const signalrNegotiateDuration = new Trend('signalr_negotiate_duration_ms', true);
const signalrJoinDuration = new Trend('signalr_join_property_duration_ms', true);
const signalrIsolationBlockRate = new Rate('signalr_cross_branch_isolation_blocked');
const signalrNotificationsReceived = new Counter('signalr_notifications_received_total');
const signalrConnectionSuccess = new Rate('signalr_ws_connection_success');

export const options = {
  scenarios: {
    receptionist_terminals_ramp: {
      executor: 'ramping-vus',
      startVUs: 5,
      stages: [
        { duration: '15s', target: 50 },   // Ramp up to 50 concurrent receptionists
        { duration: '30s', target: 150 },  // Peak load: 150 concurrent branch terminals
        { duration: '15s', target: 0 },    // Graceful ramp down
      ],
      gracefulRampDown: '5s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    signalr_negotiate_duration_ms: ['p(95)<200', 'p(99)<400'],
    signalr_join_property_duration_ms: ['p(95)<150', 'p(99)<300'],
    signalr_ws_connection_success: ['rate>0.99'],
    signalr_cross_branch_isolation_blocked: ['rate==1.0'], // 100% cross-branch join attempts MUST fail-closed
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';
const WS_BASE_URL = BASE_URL.replace(/^http/, 'ws');
const AUTHORIZED_PROPERTY_ID = __ENV.PROPERTY_ID || '22222222-2222-2222-2222-222222222221';
const FORBIDDEN_PROPERTY_ID = __ENV.FORBIDDEN_PROPERTY_ID || '22222222-2222-2222-2222-222222222222';

export function setup() {
  if (__ENV.JWT_TOKEN) {
    return { token: __ENV.JWT_TOKEN };
  }

  // Optional auto-login if credentials are supplied in env
  const loginRes = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({
      email: __ENV.STAFF_EMAIL || 'receptionist.sgn@grandhotel.vn',
      password: __ENV.STAFF_PASSWORD || 'P@ssword123!',
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  if (loginRes.status === 200) {
    const body = loginRes.json();
    const token = body.accessToken || (body.data && body.data.accessToken);
    if (token) return { token };
  }

  return { token: 'demo-load-test-jwt-token' };
}

export default function (data) {
  const token = data.token;
  const correlationId = `k6-sig-${__VU}-${__ITER}-${Date.now()}`;

  // 1. SignalR Negotiate Step
  const negStart = Date.now();
  const negRes = http.post(
    `${BASE_URL}/hubs/notifications/negotiate?negotiateVersion=1`,
    null,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Correlation-Id': correlationId,
      },
    }
  );
  signalrNegotiateDuration.add(Date.now() - negStart);

  const negOk = check(negRes, {
    'negotiate status is 200': (r) => r.status === 200,
    'negotiate returns connectionToken': (r) => r.status === 200 && !!r.json('connectionToken'),
  });

  if (!negOk) {
    signalrConnectionSuccess.add(false);
    sleep(1);
    return;
  }

  const connectionToken = encodeURIComponent(negRes.json('connectionToken'));
  const wsUrl = `${WS_BASE_URL}/hubs/notifications?id=${connectionToken}&access_token=${encodeURIComponent(token)}`;

  // 2. SignalR WebSocket Session
  const res = ws.connect(
    wsUrl,
    { headers: { 'X-Correlation-Id': correlationId } },
    function (socket) {
      let joinStart = 0;

      socket.on('open', function () {
        // Send SignalR JSON protocol v1 handshake
        socket.send(JSON.stringify({ protocol: 'json', version: 1 }) + RECORD_SEPARATOR);
      });

      socket.on('message', function (rawMsg) {
        const frames = rawMsg.split(RECORD_SEPARATOR).filter((f) => f.trim().length > 0);

        for (const frame of frames) {
          let parsed;
          try {
            parsed = JSON.parse(frame);
          } catch (_) {
            continue;
          }

          // Handshake ACK is an empty JSON object {}
          if (Object.keys(parsed).length === 0) {
            joinStart = Date.now();

            // Invocation 1: Authorized JoinProperty
            socket.send(
              JSON.stringify({
                type: 1,
                invocationId: 'join-auth-1',
                target: 'JoinProperty',
                arguments: [AUTHORIZED_PROPERTY_ID],
              }) + RECORD_SEPARATOR
            );

            // Invocation 2: Unauthorized Cross-Branch JoinProperty (Must be blocked!)
            socket.send(
              JSON.stringify({
                type: 1,
                invocationId: 'join-cross-branch-2',
                target: 'JoinProperty',
                arguments: [FORBIDDEN_PROPERTY_ID],
              }) + RECORD_SEPARATOR
            );
          }

          // Type 3 = Completion message from SignalR Hub
          if (parsed.type === 3) {
            if (parsed.invocationId === 'join-auth-1') {
              signalrJoinDuration.add(Date.now() - joinStart);
              check(parsed, {
                'authorized JoinProperty succeeded without error': (m) => !m.error,
              });
            } else if (parsed.invocationId === 'join-cross-branch-2') {
              const blocked =
                Boolean(parsed.error) &&
                (parsed.error.includes('ERR_PROPERTY_FORBIDDEN') ||
                  parsed.error.includes('ERR_CROSS_TENANT_FORBIDDEN'));
              signalrIsolationBlockRate.add(blocked);
              check(parsed, {
                'cross-branch JoinProperty blocked by fail-closed Hub guard': () => blocked,
              });

              // Gracefully leave authorized group and close socket after verification
              socket.send(
                JSON.stringify({
                  type: 1,
                  invocationId: 'leave-1',
                  target: 'LeaveProperty',
                  arguments: [AUTHORIZED_PROPERTY_ID],
                }) + RECORD_SEPARATOR
              );
              socket.close();
            }
          }

          // Type 1 = Real-time push notification from server (ReceiveNewReservation, etc.)
          if (parsed.type === 1 && parsed.target) {
            signalrNotificationsReceived.add(1);
          }
        }
      });

      socket.setTimeout(function () {
        socket.close();
      }, 4000);
    }
  );

  signalrConnectionSuccess.add(res && res.status === 101);
  sleep(0.5);
}
