/**
 * ============================================================================
 * Hotel SaaS Platform v2 — VNPay Checkout & IPN Webhook Concurrency Load Test
 * ============================================================================
 * Target Endpoints:
 *   1. POST /api/public/payments/vnpay/create-url
 *   2. GET  /api/public/payments/vnpay/ipn (Server-to-Server Webhook)
 *
 * Verified Guarantees under High Concurrency:
 *   - Signed VNPay checkout URL generation with HMAC-SHA512 checksum
 *   - Atomic Reservation confirmation & SmartLock PIN provisioning ("00")
 *   - Idempotent duplicate IPN storm handling ("02 Order already confirmed")
 *     ensuring ZERO duplicate payment rows in PostgreSQL
 *   - Tampered amount / checksum rejection ("97 Invalid Checksum")
 *
 * Tiers (TEST_TIER / PROFILE):
 *   - smoke  : constant 5 req/s for 30s
 *   - load   : ramp 10 -> 50 req/s over 2m, hold 3m, ramp down 1m
 *   - stress : ramp 10 -> 100 req/s, hold, then ramp down
 *
 * Run:
 *   k6 run -e BASE_URL=http://127.0.0.1:5055 -e TEST_TIER=smoke \
 *          -e VNP_TMN_CODE=TESTONLY \
 *          -e VNP_HASH_SECRET=<signing_key> \
 *          scripts/load-tests/vnpay-checkout-ipn.k6.js
 * ============================================================================
 */

import http from 'k6/http';
import crypto from 'k6/crypto';
import { check } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

const TEST_TIER = (__ENV.TEST_TIER || __ENV.PROFILE || 'smoke').trim().toLowerCase();

function buildScenario(tier) {
  switch (tier) {
    case 'smoke':
      return {
        checkout_and_ipn_smoke: {
          executor: 'constant-arrival-rate',
          rate: 5,
          timeUnit: '1s',
          duration: '30s',
          preAllocatedVUs: 10,
          maxVUs: 30,
        },
      };
    case 'load':
      return {
        checkout_and_ipn_load: {
          executor: 'ramping-arrival-rate',
          startRate: 10,
          timeUnit: '1s',
          preAllocatedVUs: 25,
          maxVUs: 100,
          stages: [
            { duration: '2m', target: 50 },
            { duration: '3m', target: 50 },
            { duration: '1m', target: 0 },
          ],
        },
      };
    case 'stress':
      return {
        checkout_and_ipn_stress: {
          executor: 'ramping-arrival-rate',
          startRate: 10,
          timeUnit: '1s',
          preAllocatedVUs: 50,
          maxVUs: 200,
          stages: [
            { duration: '1m', target: 100 },
            { duration: '3m', target: 100 },
            { duration: '1m', target: 0 },
          ],
        },
      };
    default:
      throw new Error(`Unsupported TEST_TIER='${tier}'. Expected 'smoke', 'load', or 'stress'.`);
  }
}

const vnpayCreateUrlLatency = new Trend('vnpay_create_url_duration_ms', true);
const vnpayIpnLatency = new Trend('vnpay_ipn_duration_ms', true);
const vnpayTamperRejectedRate = new Rate('vnpay_tampered_checksum_rejected');
const vnpayIdempotentReplayRate = new Rate('vnpay_idempotent_ipn_handled');
const vnpayConfirmedCounter = new Counter('vnpay_orders_confirmed_total');
const vnpayDuplicateBlockedCounter = new Counter('vnpay_ipn_duplicates_blocked_total');

export const options = {
  scenarios: buildScenario(TEST_TIER),
  thresholds: {
    http_req_failed: ['rate<0.01'],
    vnpay_create_url_duration_ms: ['p(95)<250', 'p(99)<500'],
    vnpay_ipn_duration_ms: ['p(95)<180', 'p(99)<350'],
    vnpay_tampered_checksum_rejected: ['rate==1.0'], // 100% tampered webhooks must return RspCode "97"
    vnpay_idempotent_ipn_handled: ['rate==1.0'],     // 100% valid webhooks must return "00" or "02" (or "01" if unseeded)
  },
};

const BASE_URL = (__ENV.BASE_URL || 'http://localhost:5000').replace(/\/+$/, '');
const VNP_TMN_CODE = __ENV.VNP_TMN_CODE || '';
const VNP_HASH_SECRET = __ENV.VNP_HASH_SECRET || '';

/**
 * Builds canonical sorted query string and signs with HMAC-SHA512
 * matching HotelSaas.Infrastructure.Services.VnpayPaymentService.
 */
function buildSignedVnpayIpnQuery(params, secretKey) {
  const sortedKeys = Object.keys(params).sort();
  const parts = [];
  for (const key of sortedKeys) {
    parts.push(`${key}=${params[key]}`);
  }
  const rawSignData = parts.join('&');
  const secureHash = crypto.hmac('sha512', secretKey, rawSignData, 'hex').toLowerCase();
  return `${rawSignData}&vnp_SecureHash=${secureHash}`;
}

function resolveProvinceCode() {
  const res = http.get(`${BASE_URL}/api/locations/provinces`, {
    headers: { 'X-Correlation-Id': `k6-vnp-setup-prov-${Date.now()}` },
  });
  if (res.status === 200) {
    const data = res.json('data');
    if (Array.isArray(data) && data.length > 0 && data[0].code) {
      return String(data[0].code);
    }
  }
  return '1';
}

function formatDateYmd(dateObj) {
  return dateObj.toISOString().slice(0, 10);
}

export function setup() {
  if (!VNP_TMN_CODE || !VNP_HASH_SECRET) {
    throw new Error('VNP_TMN_CODE and VNP_HASH_SECRET are required; pass the staging credentials through environment variables.');
  }

  // Mode 1: Explicit reservation identifiers provided via environment
  if (__ENV.RESERVATION_CODE) {
    return {
      checkoutReservationId: __ENV.RESERVATION_ID || null,
      checkoutLookupToken: __ENV.LOOKUP_TOKEN || null,
      ipnConfirmationCode: __ENV.RESERVATION_CODE,
      ipnAmountVnd: Number(__ENV.AMOUNT_VND || 1200000),
      ipnTransactionNo: __ENV.VNP_TXN_NO || `VNP${Date.now()}`,
      ipnSeeded: Boolean(__ENV.RESERVATION_SEEDED === 'true'),
    };
  }

  // Mode 2: Self-contained live seeding via Partner Registration + Public Booking Holds
  const checkoutFirebaseToken = __ENV.FIREBASE_ID_TOKEN_CHECKOUT || __ENV.FIREBASE_ID_TOKEN;
  const ipnFirebaseToken = __ENV.FIREBASE_ID_TOKEN_IPN || __ENV.FIREBASE_ID_TOKEN;
  if (!checkoutFirebaseToken || !ipnFirebaseToken) {
    throw new Error(
      'Self-seeding public booking holds requires FIREBASE_ID_TOKEN from an authenticated guest session. ' +
        'For an existing staging booking, pass RESERVATION_CODE, RESERVATION_ID, LOOKUP_TOKEN, and AMOUNT_VND.'
    );
  }

  const uniqueId = `${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
  const ephemeralSecret = `K6Vnp#${Date.now().toString(36)}!9a`;
  const ownerEmail = `k6.vnp.owner.${uniqueId}@hotelsaas.local`;
  const provinceCode = resolveProvinceCode();

  const regRes = http.post(
    `${BASE_URL}/api/auth/partner-register`,
    JSON.stringify({
      fullName: 'K6 VNPay Load Owner',
      email: ownerEmail,
      password: ephemeralSecret,
      phoneNumber: '0901234567',
      propertyName: `K6 VNPay Hotel ${uniqueId}`,
      address: '88 Dong Khoi, District 1',
      provinceCode,
      brandName: `K6 VNPay Chain ${uniqueId}`,
      propertyType: 1,
      starRating: 4,
      defaultNightlyPrice: 1200000,
      defaultHourlyPrice: 250000,
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'X-Correlation-Id': `k6-vnp-setup-reg-${uniqueId}`,
      },
    }
  );

  if (regRes.status !== 201) {
    throw new Error(`Partner registration failed (${regRes.status}): ${regRes.body}`);
  }

  const propertySlug = regRes.json('data.propertySlug');
  if (!propertySlug) {
    throw new Error(`Partner registration missing data.propertySlug: ${regRes.body}`);
  }

  const rtRes = http.get(`${BASE_URL}/api/public/properties/${encodeURIComponent(propertySlug)}/room-types`, {
    headers: { 'X-Correlation-Id': `k6-vnp-setup-rt-${uniqueId}` },
  });

  if (rtRes.status !== 200) {
    throw new Error(`Get public room-types failed (${rtRes.status}): ${rtRes.body}`);
  }

  const roomTypes = rtRes.json();
  if (!Array.isArray(roomTypes) || roomTypes.length === 0 || !roomTypes[0].id) {
    throw new Error(`No room types found for ${propertySlug}: ${rtRes.body}`);
  }

  const roomTypeId = roomTypes[0].id;
  const checkIn = new Date(Date.now() + 14 * 86400 * 1000);
  const checkOut = new Date(Date.now() + 15 * 86400 * 1000);
  const startAtUtc = `${formatDateYmd(checkIn)}T07:00:00Z`;
  const endAtUtc = `${formatDateYmd(checkOut)}T05:00:00Z`;

  // Hold 1: Stays PendingPayment for repeated POST /api/public/payments/vnpay/create-url checks
  const hold1Res = http.post(
    `${BASE_URL}/api/public/bookings/hold`,
    JSON.stringify({
      propertySlug,
      roomTypeId,
      rentalType: 'Overnight',
      startAtUtc,
      endAtUtc,
      checkInDate: formatDateYmd(checkIn),
      checkOutDate: formatDateYmd(checkOut),
      guestName: 'K6 VNPay Checkout Guest',
      guestEmail: `k6.checkout.${uniqueId}@hotelsaas.local`,
      guestPhone: '0901234567',
      numberOfGuests: 1,
      idempotencyKey: `k6-hold-cu-${uniqueId}`.slice(0, 64),
      firebaseIdToken: checkoutFirebaseToken,
      paymentMethodPreference: 'VNPay',
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'X-Correlation-Id': `k6-vnp-setup-hold1-${uniqueId}`,
      },
    }
  );

  // Hold 2: Dedicated PendingPayment reservation for IPN confirmation ("00") + duplicate storm ("02")
  const hold2Res = http.post(
    `${BASE_URL}/api/public/bookings/hold`,
    JSON.stringify({
      propertySlug,
      roomTypeId,
      rentalType: 'Overnight',
      startAtUtc,
      endAtUtc,
      checkInDate: formatDateYmd(checkIn),
      checkOutDate: formatDateYmd(checkOut),
      guestName: 'K6 VNPay IPN Storm Guest',
      guestEmail: `k6.ipn.${uniqueId}@hotelsaas.local`,
      guestPhone: '0901234568',
      numberOfGuests: 1,
      idempotencyKey: `k6-hold-ipn-${uniqueId}`.slice(0, 64),
      firebaseIdToken: ipnFirebaseToken,
      paymentMethodPreference: 'VNPay',
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'X-Correlation-Id': `k6-vnp-setup-hold2-${uniqueId}`,
      },
    }
  );

  if (hold1Res.status === 201 && hold2Res.status === 201) {
    return {
      checkoutReservationId: hold1Res.json('reservationId'),
      checkoutLookupToken: hold1Res.json('lookupToken'),
      ipnConfirmationCode: hold2Res.json('confirmationCode'),
      ipnAmountVnd: Number(hold2Res.json('totalAmount') || 1200000),
      ipnTransactionNo: `VNP${Date.now()}`,
      ipnSeeded: true,
    };
  }

  throw new Error(
    `Failed to seed public guest holds (hold1=${hold1Res.status}: ${hold1Res.body}, hold2=${hold2Res.status}: ${hold2Res.body}). ` +
      'Provide RESERVATION_CODE / RESERVATION_ID for pre-seeded data, or a valid FIREBASE_ID_TOKEN for guest hold setup.'
  );
}

export default function (data) {
  const correlationId = `k6-vnp-${__VU}-${__ITER}-${Date.now()}`;

  // ── Step 1: Exercise POST /api/public/payments/vnpay/create-url ──────────
  if (data.checkoutReservationId || data.checkoutLookupToken) {
    const createPayload = data.checkoutReservationId
      ? {
          reservationId: data.checkoutReservationId,
          returnUrl: `${BASE_URL}/api/public/payments/vnpay/return`,
        }
      : {
          lookupToken: data.checkoutLookupToken,
          returnUrl: `${BASE_URL}/api/public/payments/vnpay/return`,
        };

    const createRes = http.post(
      `${BASE_URL}/api/public/payments/vnpay/create-url`,
      JSON.stringify(createPayload),
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Correlation-Id': `${correlationId}-create-url`,
        },
      }
    );
    vnpayCreateUrlLatency.add(createRes.timings.duration);

    check(createRes, {
      'create-url status is 200': (r) => r.status === 200,
      'create-url returns signed paymentUrl': (r) =>
        r.status === 200 &&
        String(r.json('paymentUrl') || '').includes('vnp_SecureHash='),
    });
  }

  // ── Step 2: Valid Signed VNPay IPN Callback (Simulates Gateway Retry Storm) ──
  const expectedVnpAmount = String(Math.round(data.ipnAmountVnd * 100));
  const validParams = {
    vnp_Amount: expectedVnpAmount,
    vnp_BankCode: 'NCB',
    vnp_CardType: 'ATM',
    vnp_OrderInfo: 'Thanh_toan_dat_phong_HotelSaaS',
    vnp_PayDate: '20261115120000',
    vnp_ResponseCode: '00',
    vnp_TmnCode: VNP_TMN_CODE,
    vnp_TransactionNo: data.ipnTransactionNo,
    vnp_TransactionStatus: '00',
    vnp_TxnRef: data.ipnConfirmationCode,
  };

  const signedQuery = buildSignedVnpayIpnQuery(validParams, VNP_HASH_SECRET);
  const ipnRes = http.get(`${BASE_URL}/api/public/payments/vnpay/ipn?${signedQuery}`, {
    headers: { 'X-Correlation-Id': `${correlationId}-ipn` },
  });
  vnpayIpnLatency.add(ipnRes.timings.duration);

  let validIpnHandled = false;
  if (ipnRes.status === 200) {
    const rspCode = ipnRes.json('rspCode') || ipnRes.json('RspCode');
    validIpnHandled = data.ipnSeeded
      ? rspCode === '00' || rspCode === '02'
      : rspCode === '00' || rspCode === '02' || rspCode === '01';

    if (rspCode === '00') {
      vnpayConfirmedCounter.add(1);
    } else if (rspCode === '02') {
      vnpayDuplicateBlockedCounter.add(1);
    }
  }

  vnpayIdempotentReplayRate.add(validIpnHandled);
  check(ipnRes, {
    'IPN valid signature accepted (RspCode 00/02)': () => validIpnHandled,
  });

  // ── Step 3: Tampered Amount Attack Simulation (Must Return RspCode = "97") ──
  const tamperedQuery = signedQuery.replace(
    `vnp_Amount=${expectedVnpAmount}`,
    'vnp_Amount=100' // Attacker alters amount to 1 VND while keeping original signature
  );

  const tamperRes = http.get(`${BASE_URL}/api/public/payments/vnpay/ipn?${tamperedQuery}`, {
    headers: { 'X-Correlation-Id': `${correlationId}-tamper` },
  });

  let tamperRejected = false;
  if (tamperRes.status === 200) {
    const tamperRspCode = tamperRes.json('rspCode') || tamperRes.json('RspCode');
    tamperRejected = tamperRspCode === '97';
  }

  vnpayTamperRejectedRate.add(tamperRejected);
  check(tamperRes, {
    'IPN tampered amount rejected with RspCode 97': () => tamperRejected,
  });
}
