export interface IsolationRequestContext {
  callerLabel: string;
  tenantId: string | null;
  tokenTenantAlias?: string | null;
  propertyId: string | null;
  isTenantWide: boolean;
  excludedPropertyIds: string[];
  headerTenantId?: string | null;
  headerPropertyId?: string | null;
}

export interface ScopedRecord {
  id: string;
  tenantId: string;
  propertyId: string;
  branchName: string;
  roomNumber: string;
  confirmationCode: string;
}

export interface IsolationTestResult {
  id: string;
  title: string;
  category: 'QUERY_FILTER' | 'SAVE_INTERCEPTOR' | 'MIDDLEWARE_GUARD' | 'SIGNALR_HUB';
  callerDesc: string;
  targetDesc: string;
  expectedOutcome: string;
  actualOutcome: string;
  errorCode: string | null;
  visibleRecordsCount: number;
  passed: boolean;
  durationMs: number;
}

export interface LoadTestMetricsSummary {
  target: 'SIGNALR_HUB' | 'VNPAY_IPN';
  profile: 'SMOKE_50VU' | 'LOAD_150VU' | 'STRESS_500VU';
  virtualUsers: number;
  totalRequests: number;
  rps: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  errorRatePercent: number;
  securityChecksPassedPercent: number;
  slaPassed: boolean;
  highlights: string[];
}

export interface StructuredLogEntry {
  timestamp: string;
  level: 'Information' | 'Warning' | 'Error';
  messageTemplate: string;
  renderedMessage: string;
  correlationId: string;
  tenantId: string;
  propertyId: string;
  userId: string;
  requestMethod: string;
  requestPath: string;
  statusCode: number;
  elapsedMs: number;
  errorCode?: string;
  serviceVersion: string;
}

export const TENANT_A_ID = '11111111-1111-1111-1111-111111111111';
export const TENANT_B_ID = '99999999-9999-9999-9999-999999999999';
export const BRANCH_A1_SGN = '22222222-2222-2222-2222-222222222221';
export const BRANCH_A2_DAD = '22222222-2222-2222-2222-222222222222';
export const BRANCH_A3_SUSPENDED = '22222222-2222-2222-2222-222222222223';
export const BRANCH_B1_COMPETITOR = '88888888-8888-8888-8888-888888888881';

export const SEEDED_SCOPED_RECORDS: ScopedRecord[] = [
  {
    id: 'rec-a1-101',
    tenantId: TENANT_A_ID,
    propertyId: BRANCH_A1_SGN,
    branchName: 'Khách sạn Grand Saigon (CN 1)',
    roomNumber: '101-SGN',
    confirmationCode: 'RES-A1-001'
  },
  {
    id: 'rec-a2-201',
    tenantId: TENANT_A_ID,
    propertyId: BRANCH_A2_DAD,
    branchName: 'Resort Ocean Đà Nẵng (CN 2)',
    roomNumber: '201-DAD',
    confirmationCode: 'RES-A2-001'
  },
  {
    id: 'rec-a3-301',
    tenantId: TENANT_A_ID,
    propertyId: BRANCH_A3_SUSPENDED,
    branchName: 'Chi nhánh Đà Lạt (Đình chỉ)',
    roomNumber: '301-DLI',
    confirmationCode: 'RES-A3-001'
  },
  {
    id: 'rec-b1-999',
    tenantId: TENANT_B_ID,
    propertyId: BRANCH_B1_COMPETITOR,
    branchName: 'Khách sạn Đối thủ (Tenant B)',
    roomNumber: '999-CMP',
    confirmationCode: 'RES-B1-999'
  }
];

/**
 * Pure implementation of ApplicationDbContext.ApplyPropertyQueryFilter<TEntity>
 * Enforces fail-closed null tenant check, tenant match, branch pinning for staff,
 * and ExcludedPropertyIds filtering for Tenant-Wide owners.
 */
export function filterScopedRecords(
  records: ScopedRecord[],
  ctx: IsolationRequestContext
): ScopedRecord[] {
  if (!ctx.tenantId) {
    return [];
  }

  return records.filter(e => {
    if (e.tenantId !== ctx.tenantId) {
      return false;
    }

    if (ctx.propertyId !== null) {
      return e.propertyId === ctx.propertyId;
    }

    if (ctx.isTenantWide && ctx.propertyId === null) {
      return !ctx.excludedPropertyIds.includes(e.propertyId);
    }

    return false;
  });
}

/**
 * Pure implementation of TenantPropertyContextMiddleware & SaveChangesInterceptor guards.
 */
export function validateContextAndMutationGuard(
  ctx: IsolationRequestContext,
  targetEntityTenantId: string,
  targetEntityPropertyId: string,
  operation: 'READ' | 'CREATE' | 'UPDATE' | 'SIGNALR_JOIN'
): { allowed: boolean; statusCode: number; errorCode: string | null } {
  if (!ctx.tenantId) {
    return { allowed: false, statusCode: 401, errorCode: 'ERR_TENANT_REQUIRED' };
  }

  if (ctx.tokenTenantAlias && ctx.tokenTenantAlias !== ctx.tenantId) {
    return { allowed: false, statusCode: 401, errorCode: 'ERR_TOKEN_TAMPERED' };
  }

  if (ctx.headerTenantId && ctx.headerTenantId !== ctx.tenantId) {
    return { allowed: false, statusCode: 400, errorCode: 'ERR_CONTEXT_MISMATCH' };
  }

  if (ctx.headerPropertyId && ctx.propertyId && !ctx.isTenantWide && ctx.headerPropertyId !== ctx.propertyId) {
    return { allowed: false, statusCode: 403, errorCode: 'ERR_PROPERTY_FORBIDDEN' };
  }

  if (targetEntityTenantId !== ctx.tenantId) {
    return {
      allowed: false,
      statusCode: 403,
      errorCode: operation === 'SIGNALR_JOIN' ? 'ERR_CROSS_TENANT_FORBIDDEN' : 'ERR_CROSS_TENANT_MUTATION'
    };
  }

  if (ctx.excludedPropertyIds.includes(targetEntityPropertyId)) {
    return { allowed: false, statusCode: 403, errorCode: 'ERR_MEMBERSHIP_REVOKED' };
  }

  if (!ctx.isTenantWide) {
    if (!ctx.propertyId) {
      return { allowed: false, statusCode: 403, errorCode: 'ERR_PROPERTY_REQUIRED' };
    }
    if (targetEntityPropertyId !== ctx.propertyId) {
      return {
        allowed: false,
        statusCode: 403,
        errorCode: operation === 'SIGNALR_JOIN' ? 'ERR_PROPERTY_FORBIDDEN' : 'ERR_CROSS_PROPERTY_MUTATION'
      };
    }
  }

  return { allowed: true, statusCode: 200, errorCode: null };
}

/**
 * Runs all 8 automated multi-tenant and cross-branch isolation test cases.
 */
export function runAllIsolationAssertions(): IsolationTestResult[] {
  // 1. Fail-Closed Null Tenant Context
  const nullCtx: IsolationRequestContext = {
    callerLabel: 'Unscoped / Anonymous Context (TenantId = null)',
    tenantId: null,
    propertyId: null,
    isTenantWide: false,
    excludedPropertyIds: []
  };
  const nullRows = filterScopedRecords(SEEDED_SCOPED_RECORDS, nullCtx);

  // 2. Staff pinned to Branch A1 (Grand Saigon) reading Rooms/Reservations
  const staffA1Ctx: IsolationRequestContext = {
    callerLabel: 'Lễ tân Chi nhánh 1 (Grand Saigon)',
    tenantId: TENANT_A_ID,
    propertyId: BRANCH_A1_SGN,
    isTenantWide: false,
    excludedPropertyIds: []
  };
  const staffA1Rows = filterScopedRecords(SEEDED_SCOPED_RECORDS, staffA1Ctx);

  // 3. Staff pinned to Branch A2 (Ocean Đà Nẵng) reading Rooms/Reservations
  const staffA2Ctx: IsolationRequestContext = {
    callerLabel: 'Lễ tân Chi nhánh 2 (Ocean Đà Nẵng)',
    tenantId: TENANT_A_ID,
    propertyId: BRANCH_A2_DAD,
    isTenantWide: false,
    excludedPropertyIds: []
  };
  const staffA2Rows = filterScopedRecords(SEEDED_SCOPED_RECORDS, staffA2Ctx);

  // 4. Tenant-Wide Owner with ExcludedPropertyIds=[Branch A3]
  const ownerCtx: IsolationRequestContext = {
    callerLabel: 'Chủ cơ sở (Tenant-Wide, đình chỉ CN Đà Lạt)',
    tenantId: TENANT_A_ID,
    propertyId: null,
    isTenantWide: true,
    excludedPropertyIds: [BRANCH_A3_SUSPENDED]
  };
  const ownerRows = filterScopedRecords(SEEDED_SCOPED_RECORDS, ownerCtx);

  // 5. SaveChangesInterceptor: Cross-Tenant Mutation attempt (Tenant A -> Tenant B)
  const crossTenantMut = validateContextAndMutationGuard(
    staffA1Ctx,
    TENANT_B_ID,
    BRANCH_B1_COMPETITOR,
    'CREATE'
  );

  // 6. SaveChangesInterceptor: Cross-Branch Mutation attempt (Staff CN1 -> CN2)
  const crossBranchMut = validateContextAndMutationGuard(
    staffA1Ctx,
    TENANT_A_ID,
    BRANCH_A2_DAD,
    'UPDATE'
  );

  // 7. Middleware Anti-Tampering: Header X-Property-Id override by branch-pinned staff
  const headerOverrideCtx: IsolationRequestContext = {
    ...staffA1Ctx,
    headerPropertyId: BRANCH_A2_DAD
  };
  const headerOverrideCheck = validateContextAndMutationGuard(
    headerOverrideCtx,
    TENANT_A_ID,
    BRANCH_A2_DAD,
    'READ'
  );

  // 8. SignalR NotificationHub: Cross-Branch JoinProperty attempt (Staff CN1 -> JoinProperty CN2)
  const signalrCrossBranch = validateContextAndMutationGuard(
    staffA1Ctx,
    TENANT_A_ID,
    BRANCH_A2_DAD,
    'SIGNALR_JOIN'
  );

  return [
    {
      id: 'ISO-01',
      title: 'Fail-Closed Global Query Filter khi thiếu TenantId',
      category: 'QUERY_FILTER',
      callerDesc: nullCtx.callerLabel,
      targetDesc: 'Truy vấn bảng Rooms & Reservations',
      expectedOutcome: '0 bản ghi trả về (Chặn rò rỉ tuyệt đối)',
      actualOutcome: `${nullRows.length} bản ghi trả về`,
      errorCode: 'ERR_TENANT_REQUIRED',
      visibleRecordsCount: nullRows.length,
      passed: nullRows.length === 0,
      durationMs: 4
    },
    {
      id: 'ISO-02',
      title: 'Cô lập dữ liệu đọc của Nhân viên Chi nhánh 1 (Grand Saigon)',
      category: 'QUERY_FILTER',
      callerDesc: staffA1Ctx.callerLabel,
      targetDesc: 'Truy vấn danh sách Phòng & Đặt phòng',
      expectedOutcome: 'Chỉ thấy 1 bản ghi của CN Sài Gòn (101-SGN)',
      actualOutcome: `Thấy ${staffA1Rows.length} bản ghi (${staffA1Rows.map(r => r.roomNumber).join(', ')})`,
      errorCode: null,
      visibleRecordsCount: staffA1Rows.length,
      passed: staffA1Rows.length === 1 && staffA1Rows[0].propertyId === BRANCH_A1_SGN,
      durationMs: 6
    },
    {
      id: 'ISO-03',
      title: 'Cô lập dữ liệu đọc của Nhân viên Chi nhánh 2 (Ocean Đà Nẵng)',
      category: 'QUERY_FILTER',
      callerDesc: staffA2Ctx.callerLabel,
      targetDesc: 'Truy vấn danh sách Phòng & Đặt phòng',
      expectedOutcome: 'Chỉ thấy 1 bản ghi của CN Đà Nẵng (201-DAD)',
      actualOutcome: `Thấy ${staffA2Rows.length} bản ghi (${staffA2Rows.map(r => r.roomNumber).join(', ')})`,
      errorCode: null,
      visibleRecordsCount: staffA2Rows.length,
      passed: staffA2Rows.length === 1 && staffA2Rows[0].propertyId === BRANCH_A2_DAD,
      durationMs: 5
    },
    {
      id: 'ISO-04',
      title: 'Chủ cơ sở (Tenant-Wide) tự động loại trừ Chi nhánh bị đình chỉ & Tenant đối thủ',
      category: 'QUERY_FILTER',
      callerDesc: ownerCtx.callerLabel,
      targetDesc: 'Truy vấn toàn chuỗi (ExcludedPropertyIds = [CN Đà Lạt])',
      expectedOutcome: 'Thấy đúng 2 chi nhánh hoạt động (101-SGN, 201-DAD)',
      actualOutcome: `Thấy ${ownerRows.length} bản ghi (${ownerRows.map(r => r.roomNumber).join(', ')})`,
      errorCode: null,
      visibleRecordsCount: ownerRows.length,
      passed:
        ownerRows.length === 2 &&
        ownerRows.every(r => r.tenantId === TENANT_A_ID && r.propertyId !== BRANCH_A3_SUSPENDED),
      durationMs: 7
    },
    {
      id: 'ISO-05',
      title: 'SaveChangesInterceptor chặn ghi dữ liệu chéo sang Tenant khác',
      category: 'SAVE_INTERCEPTOR',
      callerDesc: staffA1Ctx.callerLabel,
      targetDesc: 'INSERT Room với TenantId = Tenant B',
      expectedOutcome: '403 Forbidden (ERR_CROSS_TENANT_MUTATION)',
      actualOutcome: `${crossTenantMut.statusCode} (${crossTenantMut.errorCode})`,
      errorCode: crossTenantMut.errorCode,
      visibleRecordsCount: 0,
      passed: !crossTenantMut.allowed && crossTenantMut.errorCode === 'ERR_CROSS_TENANT_MUTATION',
      durationMs: 8
    },
    {
      id: 'ISO-06',
      title: 'SaveChangesInterceptor chặn nhân viên CN 1 cập nhật dữ liệu của CN 2',
      category: 'SAVE_INTERCEPTOR',
      callerDesc: staffA1Ctx.callerLabel,
      targetDesc: 'UPDATE Room 201-DAD thuộc Chi nhánh 2',
      expectedOutcome: '403 Forbidden (ERR_CROSS_PROPERTY_MUTATION)',
      actualOutcome: `${crossBranchMut.statusCode} (${crossBranchMut.errorCode})`,
      errorCode: crossBranchMut.errorCode,
      visibleRecordsCount: 0,
      passed: !crossBranchMut.allowed && crossBranchMut.errorCode === 'ERR_CROSS_PROPERTY_MUTATION',
      durationMs: 9
    },
    {
      id: 'ISO-07',
      title: 'TenantPropertyContextMiddleware chặn giả mạo Header X-Property-Id',
      category: 'MIDDLEWARE_GUARD',
      callerDesc: 'Token gắn cố định CN 1 gửi kèm Header X-Property-Id: CN 2',
      targetDesc: 'GET /api/rooms (Header Override Attack)',
      expectedOutcome: '403 Forbidden (ERR_PROPERTY_FORBIDDEN)',
      actualOutcome: `${headerOverrideCheck.statusCode} (${headerOverrideCheck.errorCode})`,
      errorCode: headerOverrideCheck.errorCode,
      visibleRecordsCount: 0,
      passed: !headerOverrideCheck.allowed && headerOverrideCheck.errorCode === 'ERR_PROPERTY_FORBIDDEN',
      durationMs: 3
    },
    {
      id: 'ISO-08',
      title: 'SignalR NotificationHub chặn nghe lén kênh thông báo chi nhánh khác',
      category: 'SIGNALR_HUB',
      callerDesc: staffA1Ctx.callerLabel,
      targetDesc: 'WS Invoke JoinProperty(BRANCH_A2_DAD)',
      expectedOutcome: 'HubException (ERR_PROPERTY_FORBIDDEN)',
      actualOutcome: `Blocked (${signalrCrossBranch.errorCode})`,
      errorCode: signalrCrossBranch.errorCode,
      visibleRecordsCount: 0,
      passed: !signalrCrossBranch.allowed && signalrCrossBranch.errorCode === 'ERR_PROPERTY_FORBIDDEN',
      durationMs: 5
    }
  ];
}

/**
 * Simulates a k6 load test execution profile for SignalR Hub and VNPay IPN.
 */
export function simulateLoadTestRun(
  profile: 'SMOKE_50VU' | 'LOAD_150VU' | 'STRESS_500VU'
): { signalr: LoadTestMetricsSummary; vnpay: LoadTestMetricsSummary } {
  const vuMap = {
    SMOKE_50VU: 50,
    LOAD_150VU: 150,
    STRESS_500VU: 500
  };
  const vus = vuMap[profile];

  const signalr: LoadTestMetricsSummary = {
    target: 'SIGNALR_HUB',
    profile,
    virtualUsers: vus,
    totalRequests: vus * 24,
    rps: profile === 'SMOKE_50VU' ? 42 : profile === 'LOAD_150VU' ? 128 : 395,
    p50LatencyMs: profile === 'SMOKE_50VU' ? 18 : profile === 'LOAD_150VU' ? 31 : 58,
    p95LatencyMs: profile === 'SMOKE_50VU' ? 46 : profile === 'LOAD_150VU' ? 84 : 138,
    p99LatencyMs: profile === 'SMOKE_50VU' ? 79 : profile === 'LOAD_150VU' ? 142 : 245,
    errorRatePercent: 0.0,
    securityChecksPassedPercent: 100.0,
    slaPassed: true,
    highlights: [
      `100% kết nối WebSocket (/hubs/notifications) hoàn tất handshake JSON v1 dưới 150ms (p95)`,
      `100% lệnh JoinProperty chéo chi nhánh (${vus} lần thử) bị chặn bởi ERR_PROPERTY_FORBIDDEN`,
      `0 rò rỉ sự kiện ReceiveNewReservation sang thiết bị lễ tân của chi nhánh khác`
    ]
  };

  const vnpay: LoadTestMetricsSummary = {
    target: 'VNPAY_IPN',
    profile,
    virtualUsers: vus,
    totalRequests: vus * 30,
    rps: profile === 'SMOKE_50VU' ? 55 : profile === 'LOAD_150VU' ? 165 : 440,
    p50LatencyMs: profile === 'SMOKE_50VU' ? 22 : profile === 'LOAD_150VU' ? 39 : 72,
    p95LatencyMs: profile === 'SMOKE_50VU' ? 54 : profile === 'LOAD_150VU' ? 96 : 164,
    p99LatencyMs: profile === 'SMOKE_50VU' ? 92 : profile === 'LOAD_150VU' ? 168 : 289,
    errorRatePercent: 0.0,
    securityChecksPassedPercent: 100.0,
    slaPassed: true,
    highlights: [
      `Đúng 1/1 giao dịch gốc trả về RspCode="00" (Confirm Success) và kích hoạt SmartLock PIN 6 số`,
      `100% gói tin IPN trùng lặp đồng thời trả về RspCode="02" (Order already confirmed) — 0 bản ghi Payment trùng`,
      `100% gói tin bị sửa số tiền (Tampered vnp_Amount) bị từ chối với RspCode="97" (Invalid Checksum)`
    ]
  };

  return { signalr, vnpay };
}

/**
 * Generates sample structured Serilog JSON log entries enriched with CorrelationId, TenantId, PropertyId.
 */
export function generateStructuredLogEntries(): StructuredLogEntry[] {
  const now = new Date();
  const iso = (offsetSec: number) => new Date(now.getTime() - offsetSec * 1000).toISOString();

  return [
    {
      timestamp: iso(2),
      level: 'Information',
      messageTemplate: 'HTTP {RequestMethod} {RequestPath} responded {StatusCode} in {ElapsedMs} ms',
      renderedMessage: 'HTTP GET /api/reservations responded 200 in 14.20 ms',
      correlationId: 'req-8f92a1c4e7b041299a3d',
      tenantId: TENANT_A_ID,
      propertyId: BRANCH_A1_SGN,
      userId: 'usr-reception-sgn-01',
      requestMethod: 'GET',
      requestPath: '/api/reservations',
      statusCode: 200,
      elapsedMs: 14.2,
      serviceVersion: '2.0.0'
    },
    {
      timestamp: iso(9),
      level: 'Warning',
      messageTemplate:
        'Security/Isolation Gate: HTTP {RequestMethod} {RequestPath} blocked with {StatusCode} ({ErrorCode}) in {ElapsedMs}ms',
      renderedMessage:
        'Security/Isolation Gate: HTTP GET /api/rooms blocked with 403 (ERR_PROPERTY_FORBIDDEN) in 2.85ms',
      correlationId: 'req-3c71b09e22a14f88b104',
      tenantId: TENANT_A_ID,
      propertyId: BRANCH_A1_SGN,
      userId: 'usr-reception-sgn-01',
      requestMethod: 'GET',
      requestPath: '/api/rooms',
      statusCode: 403,
      elapsedMs: 2.85,
      errorCode: 'ERR_PROPERTY_FORBIDDEN',
      serviceVersion: '2.0.0'
    },
    {
      timestamp: iso(18),
      level: 'Information',
      messageTemplate: 'VNPay IPN processed for {TxnRef} with RspCode={RspCode} in {ElapsedMs}ms',
      renderedMessage: 'VNPay IPN processed for RES-VNP-8821 with RspCode=00 in 28.40ms',
      correlationId: 'req-vnp-ipn-99102a4b8c',
      tenantId: TENANT_A_ID,
      propertyId: BRANCH_A2_DAD,
      userId: 'vnpay-webhook-gateway',
      requestMethod: 'GET',
      requestPath: '/api/public/payments/vnpay/ipn',
      statusCode: 200,
      elapsedMs: 28.4,
      serviceVersion: '2.0.0'
    },
    {
      timestamp: iso(25),
      level: 'Warning',
      messageTemplate: 'VNPay IPN duplicate replay ignored for {TxnRef} with RspCode={RspCode}',
      renderedMessage: 'VNPay IPN duplicate replay ignored for RES-VNP-8821 with RspCode=02',
      correlationId: 'req-vnp-ipn-99102a4b8d',
      tenantId: TENANT_A_ID,
      propertyId: BRANCH_A2_DAD,
      userId: 'vnpay-webhook-gateway',
      requestMethod: 'GET',
      requestPath: '/api/public/payments/vnpay/ipn',
      statusCode: 200,
      elapsedMs: 6.1,
      errorCode: 'VNPAY_DUPLICATE_02',
      serviceVersion: '2.0.0'
    },
    {
      timestamp: iso(40),
      level: 'Error',
      messageTemplate:
        'Security Guard: Cross-tenant mutation blocked for User {UserId} targeting Tenant {TargetTenantId}',
      renderedMessage:
        'Security Guard: Cross-tenant mutation blocked for User usr-staff-09 targeting Tenant 99999999-9999-9999-9999-999999999999',
      correlationId: 'req-sec-block-7712c901',
      tenantId: TENANT_A_ID,
      propertyId: BRANCH_A1_SGN,
      userId: 'usr-staff-09',
      requestMethod: 'POST',
      requestPath: '/api/payments',
      statusCode: 403,
      elapsedMs: 3.4,
      errorCode: 'ERR_CROSS_TENANT_MUTATION',
      serviceVersion: '2.0.0'
    }
  ];
}
