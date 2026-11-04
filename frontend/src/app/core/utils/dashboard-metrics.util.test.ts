import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computePlatformMetrics,
  computeChainHqMetrics,
  computePropertyRoomMetrics
} from './dashboard-metrics.util';
import { RoomStatus } from '../models/enums';

test('computePlatformMetrics aggregates active plans and non-terminated contracts', () => {
  const plans = [
    {
      id: '1',
      code: 'STARTER',
      name: 'Gói Khởi Đầu',
      monthlyPrice: 500000,
      yearlyPrice: 5000000,
      maxRooms: 20,
      maxProperties: 1,
      maxStaff: 5,
      features: [],
      isPopular: false,
      sortOrder: 1,
      hasVnPay: true,
      hasAdvancedReports: false,
      isActive: true
    },
    {
      id: '2',
      code: 'PRO',
      name: 'Gói Chuyên Nghiệp',
      monthlyPrice: 1500000,
      yearlyPrice: 15000000,
      maxRooms: 100,
      maxProperties: 5,
      maxStaff: 25,
      features: [],
      isPopular: true,
      sortOrder: 2,
      hasVnPay: true,
      hasAdvancedReports: true,
      isActive: true
    }
  ];

  const contracts = [
    {
      id: 'c1',
      tenantId: 't1',
      tenantName: 'Grand Hotel Chain',
      contractNumber: 'HD-2026-001',
      planCode: 'PRO',
      planName: 'Gói Chuyên Nghiệp',
      contractType: 'New',
      representativeName: 'Nguyễn Văn A',
      representativeEmail: 'owner@grand.vn',
      representativePhone: '0901234567',
      startDate: '2026-01-01',
      endDate: '2027-01-01',
      billingCycle: 'Yearly',
      contractValue: 15000000,
      status: 'Active' as const,
      createdAtUtc: '2026-01-01T00:00:00Z'
    },
    {
      id: 'c2',
      tenantId: 't2',
      tenantName: 'Boutique Dalat',
      contractNumber: 'HD-2026-002',
      planCode: 'STARTER',
      planName: 'Gói Khởi Đầu',
      contractType: 'New',
      representativeName: 'Trần Thị B',
      representativeEmail: 'owner@dalat.vn',
      representativePhone: '0909998887',
      startDate: '2026-02-01',
      endDate: '2027-02-01',
      billingCycle: 'Yearly',
      contractValue: 5000000,
      status: 'PendingSignature' as const,
      createdAtUtc: '2026-02-01T00:00:00Z'
    }
  ];

  const result = computePlatformMetrics(plans, contracts);
  assert.equal(result.totalPlans, 2);
  assert.equal(result.activePlans, 2);
  assert.equal(result.popularPlanName, 'Gói Chuyên Nghiệp');
  assert.equal(result.totalContracts, 2);
  assert.equal(result.activeContracts, 1);
  assert.equal(result.pendingContracts, 1);
  assert.equal(result.totalCommittedValue, 20000000);
  assert.equal(result.averageContractValue, 10000000);
});

test('computeChainHqMetrics calculates chain-wide room occupancy and revenue accurately', () => {
  const properties = [
    {
      id: 'p1',
      name: 'Grand Sài Gòn Q1',
      code: 'CN-Q1',
      slug: 'grand-sai-gon-q1',
      address: '12 Nguyễn Huệ',
      city: 'TP.HCM',
      propertyType: 1,
      propertyTypeName: 'Hotel',
      totalRooms: 30,
      occupiedRooms: 18,
      todayRevenue: 12500000,
      allowHourlyBooking: true,
      allowOvernightBooking: true,
      allowDailyBooking: true,
      isActive: true
    },
    {
      id: 'p2',
      name: 'Grand Phú Quốc Resort',
      code: 'CN-PQ',
      slug: 'grand-phu-quoc',
      address: 'Bãi Trường',
      city: 'Phú Quốc',
      propertyType: 5,
      propertyTypeName: 'Resort',
      totalRooms: 20,
      occupiedRooms: 7,
      todayRevenue: 8500000,
      allowHourlyBooking: false,
      allowOvernightBooking: true,
      allowDailyBooking: true,
      isActive: true
    }
  ];

  const metrics = computeChainHqMetrics(properties);
  assert.equal(metrics.totalProperties, 2);
  assert.equal(metrics.activeProperties, 2);
  assert.equal(metrics.totalRooms, 50);
  assert.equal(metrics.occupiedRooms, 25);
  assert.equal(metrics.availableRooms, 25);
  assert.equal(metrics.occupancyRate, 50);
  assert.equal(metrics.todayChainRevenue, 21000000);
});

test('computePropertyRoomMetrics computes readiness and occupancy percentages', () => {
  const rooms = [
    { status: RoomStatus.Clean },
    { status: RoomStatus.Clean },
    { status: RoomStatus.Clean },
    { status: RoomStatus.Occupied },
    { status: RoomStatus.Dirty }
  ];

  const metrics = computePropertyRoomMetrics(rooms);
  assert.equal(metrics.totalRooms, 5);
  assert.equal(metrics.cleanRooms, 3);
  assert.equal(metrics.occupiedRooms, 1);
  assert.equal(metrics.dirtyRooms, 1);
  assert.equal(metrics.readyRate, 60);
  assert.equal(metrics.occupancyRate, 20);
});
