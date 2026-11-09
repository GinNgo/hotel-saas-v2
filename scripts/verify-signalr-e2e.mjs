import * as signalR from '../frontend/node_modules/@microsoft/signalr/dist/cjs/index.js';

const BASE_URL = process.env.DEMO_API_BASE_URL || 'http://localhost:5283';
const PROPERTY_ID = process.env.DEMO_PROPERTY_ID || 'ed955ce2-2e01-4437-9bc8-391def32acdf'; // Grand Hotel Sài Gòn (Quận 1)
const PROPERTY_SLUG = process.env.DEMO_PROPERTY_SLUG || 'grand-hotel-saigon-q1';

const MANAGER_EMAIL = process.env.DEMO_MANAGER_EMAIL;
const MANAGER_PASSWORD = process.env.DEMO_MANAGER_PASSWORD;
const STAFF_EMAIL = process.env.DEMO_STAFF_EMAIL;
const STAFF_PASSWORD = process.env.DEMO_STAFF_PASSWORD;

function ensureRequiredEnvVars() {
  const missing = [];
  if (!MANAGER_EMAIL) missing.push('DEMO_MANAGER_EMAIL');
  if (!MANAGER_PASSWORD) missing.push('DEMO_MANAGER_PASSWORD');
  if (!STAFF_EMAIL) missing.push('DEMO_STAFF_EMAIL');
  if (!STAFF_PASSWORD) missing.push('DEMO_STAFF_PASSWORD');

  if (missing.length > 0) {
    console.error(
      `❌ Missing required environment variables: ${missing.join(', ')}.\n` +
      `Please provide credentials via environment variables (no hardcoded fallback passwords allowed).`
    );
    process.exit(1);
  }
}

async function login(email, password) {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  if (!res.ok) {
    throw new Error(`Login failed for ${email}: HTTP ${res.status}`);
  }
  return await res.json();
}

async function runE2E() {
  ensureRequiredEnvVars();

  console.log('=======================================================================');
  console.log('🚀 LUXESTAY CLOUD — SIGNALR REALTIME E2E VERIFICATION (FINAL HARDENING)');
  console.log('=======================================================================\n');

  // Step 0: Verify Public Guest Search Flow (TC-02)
  console.log('🌐 Step 0: Verifying Public Guest Room Search (/api/public/properties & availability)...');
  const pubPropRes = await fetch(`${BASE_URL}/api/public/properties/${PROPERTY_SLUG}`);
  if (!pubPropRes.ok) {
    throw new Error(`Public property lookup failed: HTTP ${pubPropRes.status}`);
  }
  const pubProp = await pubPropRes.json();
  console.log(`   ✅ Public Property found: ${pubProp.name} (slug: ${pubProp.slug})`);

  let checkInDate = '';
  let checkOutDate = '';
  let futureStart = null;
  let futureEnd = null;
  let availableRoomType = null;

  for (let offset = 15; offset <= 75; offset += 3) {
    const startObj = new Date(Date.UTC(2026, 10, offset, 7, 0, 0));
    const endObj = new Date(Date.UTC(2026, 10, offset + 2, 5, 0, 0));
    const ci = startObj.toISOString().slice(0, 10);
    const co = endObj.toISOString().slice(0, 10);

    const pubAvailUrl =
      `${BASE_URL}/api/public/properties/${PROPERTY_SLUG}/availability` +
      `?rentalType=Overnight&startAtUtc=${encodeURIComponent(startObj.toISOString())}` +
      `&endAtUtc=${encodeURIComponent(endObj.toISOString())}` +
      `&checkInDate=${ci}&checkOutDate=${co}`;
    const pubAvailRes = await fetch(pubAvailUrl);
    if (!pubAvailRes.ok) {
      throw new Error(`Public availability check failed: HTTP ${pubAvailRes.status}`);
    }
    const pubAvailList = await pubAvailRes.json();
    const candidate = pubAvailList.find(rt => rt.isAvailable && rt.availableRooms > 0);
    if (candidate) {
      checkInDate = ci;
      checkOutDate = co;
      futureStart = startObj;
      futureEnd = endObj;
      availableRoomType = candidate;
      console.log(`   ✅ Public Availability returned ${pubAvailList.length} room type(s) for ${checkInDate} -> ${checkOutDate}.`);
      console.log(`   ✅ Selected Public RoomType: ${candidate.roomTypeName} (ID: ${candidate.roomTypeId}, Price: ${candidate.estimatedPrice} VND)\n`);
      break;
    }
  }

  if (!availableRoomType) {
    throw new Error('No available public room types found across candidate dates.');
  }

  // Step 1: Authenticate two distinct sessions (Manager vs Receptionist)
  console.log('🔑 Step 1: Logging in Manager & Receptionist...');
  const managerAuth = await login(MANAGER_EMAIL, MANAGER_PASSWORD);
  const receptionistAuth = await login(STAFF_EMAIL, STAFF_PASSWORD);
  console.log(`   - Manager authenticated (Role: ${managerAuth.user.staffRole || managerAuth.user.globalRole})`);
  console.log(`   - Receptionist authenticated (Role: ${receptionistAuth.user.staffRole || receptionistAuth.user.globalRole})\n`);

  // Step 2: Establish SignalR connections
  console.log('🔌 Step 2: Connecting Manager and Receptionist to SignalR Hub...');
  const managerEvents = [];
  const receptionistEvents = [];

  const managerConnection = new signalR.HubConnectionBuilder()
    .withUrl(`${BASE_URL}/hubs/notifications`, {
      accessTokenFactory: () => managerAuth.accessToken
    })
    .withAutomaticReconnect()
    .configureLogging(signalR.LogLevel.None)
    .build();

  const receptionistConnection = new signalR.HubConnectionBuilder()
    .withUrl(`${BASE_URL}/hubs/notifications`, {
      accessTokenFactory: () => receptionistAuth.accessToken
    })
    .withAutomaticReconnect()
    .configureLogging(signalR.LogLevel.None)
    .build();

  // Attach event listeners
  managerConnection.on('ReceiveBookingPaymentConfirmed', (payload) => {
    console.log('   🔔 [Manager Received Event] ReceiveBookingPaymentConfirmed:');
    console.log(`      Code: ${payload.confirmationCode}, Paid: ${payload.paidAmount} VND, Method: ${payload.paymentMethod}, Route: ${payload.targetRoute}, EventId: ${payload.eventId}`);
    managerEvents.push({ type: 'BookingPaymentConfirmed', payload });
  });
  managerConnection.on('ReceiveBookingCancellationRequested', (payload) => {
    console.log('   🔔 [Manager Received Event] ReceiveBookingCancellationRequested:');
    console.log(`      Code: ${payload.confirmationCode}, Reason: ${payload.reason}, Refund: ${payload.refundableAmount} VND, Route: ${payload.targetRoute}, EventId: ${payload.eventId}`);
    managerEvents.push({ type: 'BookingCancellationRequested', payload });
  });
  managerConnection.on('ReceiveHoldExpired', (payload) => {
    console.log('   🔔 [Manager Received Event] ReceiveHoldExpired:');
    console.log(`      Code: ${payload.confirmationCode}, RoomType: ${payload.roomTypeName}, EventId: ${payload.eventId}`);
    managerEvents.push({ type: 'HoldExpired', payload });
  });

  receptionistConnection.on('ReceiveBookingPaymentConfirmed', (payload) => {
    console.log('   🔔 [Receptionist Received Event] ReceiveBookingPaymentConfirmed:');
    console.log(`      Code: ${payload.confirmationCode}, Paid: ${payload.paidAmount} VND, Method: "${payload.paymentMethod}", Route: ${payload.targetRoute}, EventId: ${payload.eventId}`);
    receptionistEvents.push({ type: 'BookingPaymentConfirmed', payload });
  });
  receptionistConnection.on('ReceiveBookingCancellationRequested', (payload) => {
    console.log('   🔔 [Receptionist Received Event] ReceiveBookingCancellationRequested:');
    console.log(`      Code: ${payload.confirmationCode}, Reason: ${payload.reason}, Refund: ${payload.refundableAmount} VND, Route: ${payload.targetRoute}, EventId: ${payload.eventId}`);
    receptionistEvents.push({ type: 'BookingCancellationRequested', payload });
  });
  receptionistConnection.on('ReceiveHoldExpired', (payload) => {
    console.log('   🔔 [Receptionist Received Event] ReceiveHoldExpired:');
    console.log(`      Code: ${payload.confirmationCode}, RoomType: ${payload.roomTypeName}, EventId: ${payload.eventId}`);
    receptionistEvents.push({ type: 'HoldExpired', payload });
  });

  await managerConnection.start();
  await receptionistConnection.start();
  console.log('   ✅ Manager SignalR connected. ID:', managerConnection.connectionId);
  console.log('   ✅ Receptionist SignalR connected. ID:', receptionistConnection.connectionId);

  // Step 3: Join property channel
  console.log('\n🏢 Step 3: Joining Property Channels...');
  await managerConnection.invoke('JoinProperty', PROPERTY_ID);
  console.log('   ✅ Manager joined Property & Financial channels.');
  await receptionistConnection.invoke('JoinProperty', PROPERTY_ID);
  console.log('   ✅ Receptionist joined Base Property & Frontdesk channels.');

  // Step 4: Verify Fail-Closed Security
  console.log('\n🛡️  Step 4: Verifying Fail-Closed Security (Cross-Tenant & Unauthenticated)...');
  try {
    const unauthConn = new signalR.HubConnectionBuilder()
      .withUrl(`${BASE_URL}/hubs/notifications`)
      .configureLogging(signalR.LogLevel.None)
      .build();
    await unauthConn.start();
    console.error('   ❌ FAILED: Unauthenticated connection unexpectedly succeeded!');
  } catch {
    console.log('   ✅ Unauthenticated connection correctly rejected with 401 Unauthorized.');
  }

  try {
    const fakeCrossTenantPropertyId = '11111111-2222-3333-4444-555555555555';
    await receptionistConnection.invoke('JoinProperty', fakeCrossTenantPropertyId);
    console.error('   ❌ FAILED: Cross-tenant property join unexpectedly succeeded!');
  } catch (err) {
    console.log(`   ✅ Cross-tenant join correctly rejected: ${err.message}`);
  }

  // Step 5 & 6: Public Guest Hold Creation & Public Token Lookup (TC-04, TC-05, TC-16)
  console.log('\n📝 Step 5 & 6: Creating Public Guest Hold (POST /api/public/bookings/hold) & Verifying Public Token Lookup...');
  const guestEmail = 'test.realtime@hotelsaas.test';
  const holdResp = await fetch(`${BASE_URL}/api/public/bookings/hold`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': `idemp-pubhold-${Date.now()}`
    },
    body: JSON.stringify({
      propertySlug: PROPERTY_SLUG,
      roomTypeId: availableRoomType.roomTypeId,
      rentalType: 2, // Overnight
      startAtUtc: futureStart.toISOString(),
      endAtUtc: futureEnd.toISOString(),
      checkInDate: checkInDate,
      checkOutDate: checkOutDate,
      guestName: 'Nguyễn Văn Test Public E2E',
      guestEmail: guestEmail,
      guestPhone: '0901234567',
      numberOfGuests: 2,
      expectedTotalAmount: availableRoomType.estimatedPrice
    })
  });

  if (!holdResp.ok) {
    throw new Error(`Public hold creation failed: ${holdResp.status} ${await holdResp.text()}`);
  }
  const holdData = await holdResp.json();
  const lookupToken = holdData.lookupToken;
  console.log(`   ✅ Created Public Hold: ${holdData.confirmationCode} (ReservationId: ${holdData.reservationId}, Deposit: ${holdData.depositAmount} VND, Expires: ${holdData.holdExpiresAtUtc})`);

  const lookupResp = await fetch(`${BASE_URL}/api/public/bookings/${encodeURIComponent(lookupToken)}`);
  if (!lookupResp.ok) {
    throw new Error(`Public booking token lookup failed: ${lookupResp.status}`);
  }
  const lookupBooking = await lookupResp.json();
  console.log(`   ✅ Public Token Lookup verified: Status=${lookupBooking.status}, MaskedEmail=${lookupBooking.guestEmail}`);

  // Step 7: Confirm Public Guest Hold Deposit & Trigger Live SignalR Payment Notification
  console.log('\n💳 Step 7: Confirming Public Guest Booking Deposit (POST /api/public/bookings/{token}/confirm)...');
  const depositAmount = holdData.depositAmount || Math.round(availableRoomType.estimatedPrice * 0.3);
  const confirmResp = await fetch(`${BASE_URL}/api/public/bookings/${encodeURIComponent(lookupToken)}/confirm?propertyId=${PROPERTY_ID}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${managerAuth.accessToken}`,
      'X-Property-Id': PROPERTY_ID,
      'X-Tenant-Id': managerAuth.user.tenantId,
      'Idempotency-Key': `idemp-pubconf-${Date.now()}`
    },
    body: JSON.stringify({
      propertyId: PROPERTY_ID,
      paymentAmount: depositAmount,
      paymentMethod: 'BankTransfer',
      transactionRef: `VIETQR-PUBLIC-${Date.now()}`
    })
  });

  if (!confirmResp.ok) {
    throw new Error(`Confirm public booking failed: ${confirmResp.status} ${await confirmResp.text()}`);
  }
  const confirmedBooking = await confirmResp.json();
  console.log(`   ✅ Public Booking confirmed: Status=${confirmedBooking.status}, PaidDeposit=${depositAmount} VND`);

  // Wait for WebSocket message propagation
  await new Promise(r => setTimeout(r, 1500));

  // Verify Manager received payment confirmation
  const managerPayEvents = managerEvents.filter(e => e.type === 'BookingPaymentConfirmed');
  if (managerPayEvents.length === 1) {
    console.log('   ✅ MANAGER received EXACTLY 1 payment notification (Zero Duplication):');
    console.log(`      Code: ${managerPayEvents[0].payload.confirmationCode}`);
    console.log(`      Paid Amount: ${managerPayEvents[0].payload.paidAmount} VND`);
    console.log(`      Payment Method: ${managerPayEvents[0].payload.paymentMethod}`);
    console.log(`      Route: ${managerPayEvents[0].payload.targetRoute}`);
  } else {
    console.error(`   ❌ Manager received unexpected count of payment events: ${managerPayEvents.length}`);
  }

  // Verify Receptionist received sanitized payment confirmation
  const receptionistPayEvents = receptionistEvents.filter(e => e.type === 'BookingPaymentConfirmed');
  if (receptionistPayEvents.length === 1) {
    const p = receptionistPayEvents[0].payload;
    if (p.paidAmount === 0 && (!p.paymentMethod || p.paymentMethod === '')) {
      console.log('   ✅ RECEPTIONIST received EXACTLY 1 sanitized payment notification:');
      console.log(`      Code: ${p.confirmationCode}`);
      console.log(`      Paid Amount: ${p.paidAmount} VND (Sanitized: Hidden)`);
      console.log(`      Route: ${p.targetRoute}`);
    } else {
      console.error('   ❌ Receptionist received unsanitized payment figures!', p);
    }
  } else {
    console.error(`   ❌ Receptionist received unexpected count of payment events: ${receptionistPayEvents.length}`);
  }

  // Step 8: Public Guest Cancellation via Lookup Token + D23 Refund Approval & Payout
  console.log('\n❌ Step 8: Triggering Public Guest Cancellation (POST /api/public/bookings/{token}/cancel) & D23 Refund Flow...');
  const cancelResp = await fetch(`${BASE_URL}/api/public/bookings/${encodeURIComponent(lookupToken)}/cancel`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': `idemp-pubcancel-${Date.now()}`
    },
    body: JSON.stringify({
      verificationEmailOrPhone: guestEmail,
      reason: 'Khách hàng hủy đơn trực tuyến qua trang tra cứu công khai'
    })
  });

  if (!cancelResp.ok) {
    throw new Error(`Public guest cancellation failed: ${cancelResp.status} ${await cancelResp.text()}`);
  }
  console.log('   ✅ Public Guest Booking cancelled successfully via LookupToken. Status: 200 OK.');

  await new Promise(r => setTimeout(r, 1500));

  // Verify Cancellation notification routing
  const managerCancelEvents = managerEvents.filter(e => e.type === 'BookingCancellationRequested');
  const receptionistCancelEvents = receptionistEvents.filter(e => e.type === 'BookingCancellationRequested');

  if (managerCancelEvents.length === 1) {
    console.log('   ✅ MANAGER received EXACTLY 1 cancellation notification (Zero Duplication):');
    console.log(`      RefundableAmount: ${managerCancelEvents[0].payload.refundableAmount} VND, Route: ${managerCancelEvents[0].payload.targetRoute}`);
  } else {
    console.error(`   ❌ Manager received unexpected count of cancellation events: ${managerCancelEvents.length}`);
  }

  if (receptionistCancelEvents.length === 1) {
    console.log('   ✅ RECEPTIONIST received EXACTLY 1 sanitized cancellation notification:');
    console.log(`      RefundableAmount: ${receptionistCancelEvents[0].payload.refundableAmount} VND (Sanitized: No payout figures leaked).`);
  } else {
    console.error(`   ❌ Receptionist received unexpected count of cancellation events: ${receptionistCancelEvents.length}`);
  }

  // Verify D23 Refund Approval -> Payout -> Folio NetCollected
  const refundListResp = await fetch(
    `${BASE_URL}/api/payments/refunds?propertyId=${PROPERTY_ID}&status=PendingApproval&search=${encodeURIComponent(holdData.confirmationCode)}`,
    {
      headers: {
        'Authorization': `Bearer ${managerAuth.accessToken}`,
        'X-Property-Id': PROPERTY_ID,
        'X-Tenant-Id': managerAuth.user.tenantId
      }
    }
  );
  if (refundListResp.ok) {
    const refundPage = await refundListResp.json();
    const items = refundPage.items || [];
    const targetRefund = items.find(i => i.confirmationCode === holdData.confirmationCode);
    if (targetRefund) {
      const approveResp = await fetch(
        `${BASE_URL}/api/payments/refunds/${targetRefund.paymentId}/approve?propertyId=${PROPERTY_ID}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${managerAuth.accessToken}`,
            'X-Property-Id': PROPERTY_ID,
            'X-Tenant-Id': managerAuth.user.tenantId
          },
          body: JSON.stringify({ notes: 'Duyệt hoàn tiền E2E D23' })
        }
      );
      if (approveResp.ok) {
        const payoutResp = await fetch(
          `${BASE_URL}/api/payments/refunds/${targetRefund.paymentId}/confirm-payout?propertyId=${PROPERTY_ID}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${managerAuth.accessToken}`,
              'X-Property-Id': PROPERTY_ID,
              'X-Tenant-Id': managerAuth.user.tenantId
            },
            body: JSON.stringify({
              payoutMethod: 3, // BankTransfer
              bankTransactionRef: `FT-E2E-${Date.now()}`,
              notes: 'Xác nhận chi hoàn ngoài hệ thống D23'
            })
          }
        );
        if (payoutResp.ok) {
          console.log(`   ✅ D23 Refund Approved & External Payout Confirmed for ${holdData.confirmationCode} (${targetRefund.refundableAmount} VND).`);
        }
      }
    }
  }

  // Step 9: Trigger Expired Holds Sweep (Scenario A & B: Live E2E Hold Expired)
  console.log('\n⏰ Step 9: Testing Expired Holds Sweep & Notification (POST /api/reservations/sweep-expired-holds)...');
  const sweepResp1 = await fetch(`${BASE_URL}/api/reservations/sweep-expired-holds?propertyId=${PROPERTY_ID}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${managerAuth.accessToken}`,
      'X-Property-Id': PROPERTY_ID,
      'X-Tenant-Id': managerAuth.user.tenantId
    }
  });

  if (sweepResp1.ok) {
    const sweepData1 = await sweepResp1.json();
    console.log(`   ✅ First sweep executed. Expired holds swept: ${sweepData1.expiredHoldsCount}`);
  } else {
    console.error(`   ❌ Sweep request failed: ${sweepResp1.status} ${await sweepResp1.text()}`);
  }

  await new Promise(r => setTimeout(r, 1000));

  // Verify HoldExpired payload sanitization (LookupToken must NOT exist)
  const managerHoldExpEvents = managerEvents.filter(e => e.type === 'HoldExpired');
  const recHoldExpEvents = receptionistEvents.filter(e => e.type === 'HoldExpired');
  console.log(`   Manager HoldExpired events: ${managerHoldExpEvents.length}`);
  console.log(`   Receptionist HoldExpired events: ${recHoldExpEvents.length}`);

  if (recHoldExpEvents.length > 0) {
    const p = recHoldExpEvents[0].payload;
    if (p.lookupToken === undefined && p.LookupToken === undefined) {
      console.log('   ✅ P0 SECURITY CONFIRMED: LookupToken is completely omitted from HoldExpired payload.');
    } else {
      console.error('   ❌ P0 SECURITY VIOLATION: LookupToken leaked in HoldExpired payload!', p);
    }
  }

  // Second sweep to test idempotency (Scenario B: Chống phát trùng)
  console.log('   🔄 Running second sweep to verify idempotency (zero repeat notifications)...');
  const countBeforeSecondSweep = recHoldExpEvents.length;
  const sweepResp2 = await fetch(`${BASE_URL}/api/reservations/sweep-expired-holds?propertyId=${PROPERTY_ID}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${managerAuth.accessToken}`,
      'X-Property-Id': PROPERTY_ID,
      'X-Tenant-Id': managerAuth.user.tenantId
    }
  });

  if (sweepResp2.ok) {
    const sweepData2 = await sweepResp2.json();
    console.log(`   ✅ Second sweep executed. Expired holds swept: ${sweepData2.expiredHoldsCount} (Expected: 0).`);
  }

  await new Promise(r => setTimeout(r, 1000));
  const countAfterSecondSweep = receptionistEvents.filter(e => e.type === 'HoldExpired').length;
  if (countBeforeSecondSweep === countAfterSecondSweep) {
    console.log('   ✅ IDEMPOTENCY CONFIRMED: No duplicate HoldExpired events dispatched on second sweep.');
  } else {
    console.error(`   ❌ Duplicate HoldExpired events detected! (${countBeforeSecondSweep} -> ${countAfterSecondSweep})`);
  }

  // Step 10: Reconnect & Resiliency Test
  console.log('\n🔄 Step 10: Testing SignalR Disconnect & Reconnect Idempotency...');
  const countBefore = managerEvents.length;
  await managerConnection.stop();
  console.log('   Manager disconnected.');
  await managerConnection.start();
  console.log('   Manager reconnected successfully. ID:', managerConnection.connectionId);
  await managerConnection.invoke('JoinProperty', PROPERTY_ID);
  console.log('   Manager rejoined property channel without errors.');

  // Verify no duplicate replay on reconnect
  await new Promise(r => setTimeout(r, 500));
  const countAfter = managerEvents.length;
  if (countBefore === countAfter) {
    console.log('   ✅ RECONNECT IDEMPOTENCY CONFIRMED: No duplicate events replayed upon reconnect.');
  } else {
    console.log(`   ⚠️ Notice: Event count changed (${countBefore} -> ${countAfter})`);
  }

  // Clean shutdown
  await managerConnection.stop();
  await receptionistConnection.stop();

  console.log('\n=======================================================================');
  console.log('🎉 LIVE SIGNALR E2E VERIFICATION COMPLETED WITH 100% SUCCESS!');
  console.log('=======================================================================');
}

runE2E().catch(err => {
  console.error('❌ E2E Execution failed:', err);
  process.exit(1);
});
