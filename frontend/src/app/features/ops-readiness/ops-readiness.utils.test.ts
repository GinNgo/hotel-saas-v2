import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BRANCH_A1_SGN,
  BRANCH_A2_DAD,
  BRANCH_A3_SUSPENDED,
  BRANCH_B1_COMPETITOR,
  SEEDED_SCOPED_RECORDS,
  TENANT_A_ID,
  TENANT_B_ID,
  filterScopedRecords,
  generateStructuredLogEntries,
  runAllIsolationAssertions,
  simulateLoadTestRun,
  validateContextAndMutationGuard
} from './ops-readiness.utils';

test('filterScopedRecords enforces fail-closed null tenant and strict branch isolation', () => {
  // 1. Null tenant -> 0 records
  const nullResult = filterScopedRecords(SEEDED_SCOPED_RECORDS, {
    callerLabel: 'Null',
    tenantId: null,
    propertyId: null,
    isTenantWide: false,
    excludedPropertyIds: []
  });
  assert.equal(nullResult.length, 0);

  // 2. Branch A1 staff -> only 101-SGN
  const a1Result = filterScopedRecords(SEEDED_SCOPED_RECORDS, {
    callerLabel: 'Staff A1',
    tenantId: TENANT_A_ID,
    propertyId: BRANCH_A1_SGN,
    isTenantWide: false,
    excludedPropertyIds: []
  });
  assert.equal(a1Result.length, 1);
  assert.equal(a1Result[0].roomNumber, '101-SGN');

  // 3. Owner with excluded branch A3 -> sees A1 and A2, never A3 or Tenant B
  const ownerResult = filterScopedRecords(SEEDED_SCOPED_RECORDS, {
    callerLabel: 'Owner A',
    tenantId: TENANT_A_ID,
    propertyId: null,
    isTenantWide: true,
    excludedPropertyIds: [BRANCH_A3_SUSPENDED]
  });
  assert.equal(ownerResult.length, 2);
  assert.deepEqual(
    ownerResult.map(r => r.roomNumber),
    ['101-SGN', '201-DAD']
  );
});

test('validateContextAndMutationGuard blocks cross-tenant, cross-branch, and tampered headers', () => {
  const staffA1 = {
    callerLabel: 'Staff A1',
    tenantId: TENANT_A_ID,
    propertyId: BRANCH_A1_SGN,
    isTenantWide: false,
    excludedPropertyIds: []
  };

  // Cross-tenant create blocked
  const crossTenant = validateContextAndMutationGuard(staffA1, TENANT_B_ID, BRANCH_B1_COMPETITOR, 'CREATE');
  assert.equal(crossTenant.allowed, false);
  assert.equal(crossTenant.errorCode, 'ERR_CROSS_TENANT_MUTATION');

  // Cross-branch update blocked
  const crossBranch = validateContextAndMutationGuard(staffA1, TENANT_A_ID, BRANCH_A2_DAD, 'UPDATE');
  assert.equal(crossBranch.allowed, false);
  assert.equal(crossBranch.errorCode, 'ERR_CROSS_PROPERTY_MUTATION');

  // SignalR cross-branch join blocked
  const signalrJoin = validateContextAndMutationGuard(staffA1, TENANT_A_ID, BRANCH_A2_DAD, 'SIGNALR_JOIN');
  assert.equal(signalrJoin.allowed, false);
  assert.equal(signalrJoin.errorCode, 'ERR_PROPERTY_FORBIDDEN');
});

test('runAllIsolationAssertions passes all 8 multi-tenant and branch isolation proofs', () => {
  const results = runAllIsolationAssertions();
  assert.equal(results.length, 8);
  for (const r of results) {
    assert.equal(r.passed, true, `Expected ${r.id} (${r.title}) to pass`);
  }
});

test('simulateLoadTestRun and generateStructuredLogEntries return valid SLA and JSON context fields', () => {
  const sim = simulateLoadTestRun('LOAD_150VU');
  assert.equal(sim.signalr.slaPassed, true);
  assert.equal(sim.vnpay.slaPassed, true);
  assert.equal(sim.signalr.securityChecksPassedPercent, 100);
  assert.equal(sim.vnpay.securityChecksPassedPercent, 100);

  const logs = generateStructuredLogEntries();
  assert.ok(logs.length >= 5);
  for (const log of logs) {
    assert.ok(log.correlationId.startsWith('req-'));
    assert.ok(log.tenantId.length > 0);
    assert.ok(log.propertyId.length > 0);
  }
});
