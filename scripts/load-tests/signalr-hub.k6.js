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
 *   3. Multi-branch isolation under load: JoinProperty(forbiddenPropertyId)
 *      must be rejected with HubException "ERR_PROPERTY_FORBIDDEN"
 *   4. Clean LeaveProperty + WebSocket disconnect (zero connection leaks)
 *
 * Tiers (TEST_TIER / PROFILE):
 *   - smoke  : 5 VUs for 15s (fast live verification)
 *   - load   : ramp 5 -> 50 VUs (20s up, 30s hold, 10s down)
 *   - stress : ramp 10 -> 150 VUs (15s to 50, 30s to 150, 15s down)
 *
 * Run:
 *   k6 run -e BASE_URL=http://127.0.0.1:5055 -e TEST_TIER=smoke \
 *          scripts/load-tests/signalr-hub.k6.js
 * ============================================================================
 */

import http from 'k6/http';
import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

const RECORD_SEPARATOR = '\x1e';
const TEST_TIER = (__ENV.TEST_TIER || __ENV.PROFILE || 'smoke').trim().toLowerCase();

function buildScenario(tier) {
  switch (tier) {
    case 'smoke':
      return {
        receptionist_terminals_smoke: {
          executor: 'constant-vus',
          vus: 5,
          duration: '15s',
          gracefulStop: '5s',
        },
      };
    case 'load':
      return {
        receptionist_terminals_load: {
          executor: 'ramping-vus',
          startVUs: 5,
          stages: [
            { duration: '20s', target: 50 },
            { duration: '30s', target: 50 },
            { duration: '10s', target: 0 },
          ],
          gracefulRampDown: '5s',
        },
      };
    case 'stress':
      return {
        receptionist_terminals_stress: {
          executor: 'ramping-vus',
          startVUs: 10,
          stages: [
            { duration: '15s', target: 50 },
            { duration: '30s', target: 150 },
            { duration: '15s', target: 0 },
          ],
          gracefulRampDown: '5s',
        },
      };
    default:
      throw new Error(`Unsupported TEST_TIER='${tier}'. Expected 'smoke', 'load', or 'stress'.`);
  }
}

// Custom Prometheus/k6 Metrics
const signalrNegotiateDuration = new Trend('signalr_negotiate_duration_ms', true);
const signalrJoinDuration = new Trend('signalr_join_property_duration_ms', true);
const signalrIsolationBlockRate = new Rate('signalr_cross_branch_isolation_blocked');
const signalrNotificationsReceived = new Counter('signalr_notifications_received_total');
const signalrConnectionSuccess = new Rate('signalr_ws_connection_success');

export const options = {
  scenarios: buildScenario(TEST_TIER),
  thresholds: {
    http_req_failed: ['rate<0.01'],
    signalr_negotiate_duration_ms: ['p(95)<200', 'p(99)<400'],
    signalr_join_property_duration_ms: ['p(95)<150', 'p(99)<300'],
    signalr_ws_connection_success: ['rate>0.99'],
    signalr_cross_branch_isolation_blocked: ['rate==1.0'], // 100% cross-branch join attempts MUST fail-closed
  },
};

const BASE_URL = (__ENV.BASE_URL || 'http://localhost:5000').replace(/\/+$/, '');
const WS_BASE_URL = BASE_URL.replace(/^http/, 'ws');

function extractAccessToken(loginRes) {
  if (!loginRes || loginRes.status !== 200) {
    return null;
  }
  const body = loginRes.json();
  return body.accessToken || (body.data && body.data.accessToken) || null;
}

function resolveProvinceCode() {
  const res = http.get(`${BASE_URL}/api/locations/provinces`, {
    headers: { 'X-Correlation-Id': `k6-sig-setup-prov-${Date.now()}` },
  });
  if (res.status === 200) {
    const data = res.json('data');
    if (Array.isArray(data) && data.length > 0 && data[0].code) {
      return String(data[0].code);
    }
  }
  return '1';
}

function warmupSignalRHub(token, authorizedPropertyId) {
  const negRes = http.post(
    `${BASE_URL}/hubs/notifications/negotiate?negotiateVersion=1`,
    null,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Correlation-Id': `k6-sig-warmup-${Date.now()}`,
      },
    }
  );
  if (negRes.status !== 200 || !negRes.json('connectionToken')) {
    return;
  }
  const connectionToken = encodeURIComponent(negRes.json('connectionToken'));
  const wsUrl = `${WS_BASE_URL}/hubs/notifications?id=${connectionToken}&access_token=${encodeURIComponent(token)}`;
  ws.connect(wsUrl, {}, function (socket) {
    let sentJoin = false;
    socket.on('open', function () {
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
        if (Object.keys(parsed).length === 0 && !sentJoin) {
          sentJoin = true;
          socket.send(
            JSON.stringify({
              type: 1,
              invocationId: 'warmup-join',
              target: 'JoinProperty',
              arguments: [authorizedPropertyId],
            }) + RECORD_SEPARATOR
          );
        } else if (parsed.type === 3 && parsed.invocationId === 'warmup-join') {
          socket.send(
            JSON.stringify({
              type: 1,
              invocationId: 'warmup-leave',
              target: 'LeaveProperty',
              arguments: [authorizedPropertyId],
            }) + RECORD_SEPARATOR
          );
          socket.setTimeout(function () {
            socket.close();
          }, 150);
        } else if (parsed.type === 3 && parsed.invocationId === 'warmup-leave') {
          socket.close();
        }
      }
    });
    socket.setTimeout(function () {
      socket.close();
    }, 5000);
  });
}

export function setup() {
  // Mode 1: Explicit JWT + Branch IDs passed via environment
  if (__ENV.JWT_TOKEN) {
    if (!__ENV.PROPERTY_ID || !__ENV.FORBIDDEN_PROPERTY_ID) {
      throw new Error(
        'When JWT_TOKEN is provided, both PROPERTY_ID and FORBIDDEN_PROPERTY_ID must also be provided.'
      );
    }
    warmupSignalRHub(__ENV.JWT_TOKEN, __ENV.PROPERTY_ID);
    return {
      token: __ENV.JWT_TOKEN,
      authorizedPropertyId: __ENV.PROPERTY_ID,
      forbiddenPropertyId: __ENV.FORBIDDEN_PROPERTY_ID,
    };
  }

  // Mode 2: Existing staff email/password passed via environment
  if (__ENV.STAFF_EMAIL && __ENV.STAFF_PASSWORD) {
    const loginRes = http.post(
      `${BASE_URL}/api/auth/login`,
      JSON.stringify({
        email: __ENV.STAFF_EMAIL,
        password: __ENV.STAFF_PASSWORD,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Correlation-Id': `k6-sig-setup-login-${Date.now()}`,
        },
      }
    );

    const token = extractAccessToken(loginRes);
    if (!token) {
      throw new Error(
        `STAFF_EMAIL login failed with HTTP ${loginRes.status}: ${loginRes.body}`
      );
    }

    const memberships = loginRes.json('memberships') || [];
    const scopedMembership = Array.isArray(memberships)
      ? memberships.find((m) => !m.isTenantWide && m.propertyId)
      : null;

    const authorizedPropertyId = __ENV.PROPERTY_ID || (scopedMembership && scopedMembership.propertyId);
    const forbiddenPropertyId = __ENV.FORBIDDEN_PROPERTY_ID;

    if (!authorizedPropertyId || !forbiddenPropertyId) {
      throw new Error(
        'STAFF_EMAIL mode requires PROPERTY_ID (or a branch-scoped membership) and FORBIDDEN_PROPERTY_ID.'
      );
    }

    warmupSignalRHub(token, authorizedPropertyId);
    return {
      token,
      authorizedPropertyId,
      forbiddenPropertyId,
    };
  }

  // Mode 3: Self-contained ephemeral tenant + 2 branches + branch-scoped receptionist
  const uniqueId = `${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
  const ephemeralSecret = `K6Sig#${Date.now().toString(36)}!9a`;
  const ownerEmail = `k6.sig.owner.${uniqueId}@hotelsaas.local`;
  const receptionistEmail = `k6.sig.rec.${uniqueId}@hotelsaas.local`;
  const provinceCode = resolveProvinceCode();

  // 1. Register partner chain + Branch 1
  const regRes = http.post(
    `${BASE_URL}/api/auth/partner-register`,
    JSON.stringify({
      fullName: 'K6 SignalR Load Owner',
      email: ownerEmail,
      password: ephemeralSecret,
      phoneNumber: '0901234567',
      propertyName: `K6 SignalR Branch 1 ${uniqueId}`,
      address: '123 Le Loi, District 1',
      provinceCode,
      brandName: `K6 SignalR Chain ${uniqueId}`,
      propertyType: 1,
      starRating: 4,
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'X-Correlation-Id': `k6-sig-setup-reg-${uniqueId}`,
      },
    }
  );

  if (regRes.status !== 201) {
    throw new Error(`Partner registration failed (${regRes.status}): ${regRes.body}`);
  }

  const branch1Id = regRes.json('data.propertyId');
  if (!branch1Id) {
    throw new Error(`Partner registration missing data.propertyId: ${regRes.body}`);
  }

  // 2. Login as Owner (Tenant-Wide)
  const ownerLoginRes = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ email: ownerEmail, password: ephemeralSecret }),
    {
      headers: {
        'Content-Type': 'application/json',
        'X-Correlation-Id': `k6-sig-setup-owner-login-${uniqueId}`,
      },
    }
  );

  const ownerToken = extractAccessToken(ownerLoginRes);
  if (!ownerToken) {
    throw new Error(`Owner login failed (${ownerLoginRes.status}): ${ownerLoginRes.body}`);
  }

  // 3. Create Branch 2 under the same tenant
  const codeSuffix = String(Math.floor(100000 + Math.random() * 900000));
  const branch2Res = http.post(
    `${BASE_URL}/api/properties`,
    JSON.stringify({
      name: `K6 SignalR Branch 2 ${uniqueId}`,
      code: `BR2${codeSuffix}`,
      slug: `k6-signalr-b2-${uniqueId}`,
      address: '456 Nguyen Hue, District 1',
      city: 'Ho Chi Minh',
      propertyType: 'Hotel',
      starRating: 4,
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
        'X-Correlation-Id': `k6-sig-setup-b2-${uniqueId}`,
      },
    }
  );

  if (branch2Res.status !== 201) {
    throw new Error(`Create Branch 2 failed (${branch2Res.status}): ${branch2Res.body}`);
  }

  const branch2Id = branch2Res.json('data.id');
  if (!branch2Id) {
    throw new Error(`Create Branch 2 missing data.id: ${branch2Res.body}`);
  }

  // 4. Create Receptionist assigned ONLY to Branch 1
  const staffRes = http.post(
    `${BASE_URL}/api/staff`,
    JSON.stringify({
      fullName: 'K6 Branch1 Receptionist',
      email: receptionistEmail,
      phoneNumber: '0909876543',
      password: ephemeralSecret,
      propertyId: branch1Id,
      staffRole: 'Receptionist',
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
        'X-Correlation-Id': `k6-sig-setup-staff-${uniqueId}`,
      },
    }
  );

  if (staffRes.status !== 201) {
    throw new Error(`Create Branch1 receptionist failed (${staffRes.status}): ${staffRes.body}`);
  }

  // 5. Login as branch-scoped Receptionist
  const recLoginRes = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ email: receptionistEmail, password: ephemeralSecret }),
    {
      headers: {
        'Content-Type': 'application/json',
        'X-Correlation-Id': `k6-sig-setup-rec-login-${uniqueId}`,
      },
    }
  );

  const receptionistToken = extractAccessToken(recLoginRes);
  if (!receptionistToken) {
    throw new Error(`Receptionist login failed (${recLoginRes.status}): ${recLoginRes.body}`);
  }

  warmupSignalRHub(receptionistToken, branch1Id);

  return {
    token: receptionistToken,
    authorizedPropertyId: branch1Id,
    forbiddenPropertyId: branch2Id,
  };
}

export default function (data) {
  const token = data.token;
  const authorizedPropertyId = data.authorizedPropertyId;
  const forbiddenPropertyId = data.forbiddenPropertyId;
  const correlationId = `k6-sig-${__VU}-${__ITER}-${Date.now()}`;

  // 1. SignalR Negotiate Step
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
  signalrNegotiateDuration.add(negRes.timings.duration);

  const negOk = check(negRes, {
    'negotiate status is 200': (r) => r.status === 200,
    'negotiate returns connectionToken': (r) => r.status === 200 && !!r.json('connectionToken'),
  });

  if (!negOk) {
    signalrConnectionSuccess.add(false);
    signalrIsolationBlockRate.add(false);
    sleep(0.5);
    return;
  }

  const connectionToken = encodeURIComponent(negRes.json('connectionToken'));
  const wsUrl = `${WS_BASE_URL}/hubs/notifications?id=${connectionToken}&access_token=${encodeURIComponent(token)}`;

  let authJoinDone = false;
  let authJoinSucceeded = false;
  let crossBranchDone = false;

  // 2. SignalR WebSocket Session
  const res = ws.connect(
    wsUrl,
    { headers: { 'X-Correlation-Id': correlationId } },
    function (socket) {
      let joinStart = 0;
      let leaveSent = false;

      function tryLeaveAndClose() {
        if (authJoinDone && crossBranchDone && !leaveSent) {
          leaveSent = true;
          socket.send(
            JSON.stringify({
              type: 1,
              invocationId: 'leave-1',
              target: 'LeaveProperty',
              arguments: [authorizedPropertyId],
            }) + RECORD_SEPARATOR
          );
          socket.setTimeout(function () {
            socket.close();
          }, 250);
        }
      }

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
          if (Object.keys(parsed).length === 0 && !leaveSent && joinStart === 0) {
            joinStart = Date.now();

            // Invocation 1: Authorized JoinProperty (Branch 1)
            socket.send(
              JSON.stringify({
                type: 1,
                invocationId: 'join-auth-1',
                target: 'JoinProperty',
                arguments: [authorizedPropertyId],
              }) + RECORD_SEPARATOR
            );

            // Invocation 2: Unauthorized Cross-Branch JoinProperty (Branch 2 - Must be blocked!)
            socket.send(
              JSON.stringify({
                type: 1,
                invocationId: 'join-cross-branch-2',
                target: 'JoinProperty',
                arguments: [forbiddenPropertyId],
              }) + RECORD_SEPARATOR
            );
          }

          // Type 3 = Completion message from SignalR Hub
          if (parsed.type === 3) {
            if (parsed.invocationId === 'join-auth-1') {
              signalrJoinDuration.add(Date.now() - joinStart);
              authJoinDone = true;
              authJoinSucceeded = !parsed.error;
              check(parsed, {
                'authorized JoinProperty succeeded without error': (m) => !m.error,
              });
              tryLeaveAndClose();
            } else if (parsed.invocationId === 'join-cross-branch-2') {
              crossBranchDone = true;
              const blocked =
                Boolean(parsed.error) &&
                (parsed.error.includes('ERR_PROPERTY_FORBIDDEN') ||
                  parsed.error.includes('ERR_CROSS_TENANT_FORBIDDEN'));
              signalrIsolationBlockRate.add(blocked);
              check(parsed, {
                'cross-branch JoinProperty blocked by fail-closed Hub guard': () => blocked,
              });
              tryLeaveAndClose();
            } else if (parsed.invocationId === 'leave-1') {
              socket.close();
            }
          }

          // Type 1 = Real-time push notification from server
          if (parsed.type === 1 && parsed.target) {
            signalrNotificationsReceived.add(1);
          }
        }
      });

      socket.on('close', function () {
        if (!crossBranchDone) {
          signalrIsolationBlockRate.add(false);
        }
      });

      socket.setTimeout(function () {
        socket.close();
      }, 10000);
    }
  );

  const wsConnected = Boolean(res && res.status === 101 && authJoinSucceeded);
  signalrConnectionSuccess.add(wsConnected);
  check(res, {
    'websocket upgraded with HTTP 101': (r) => Boolean(r && r.status === 101),
  });

  sleep(0.2);
}
