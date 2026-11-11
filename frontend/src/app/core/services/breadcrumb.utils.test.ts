import { test, assert } from 'vitest';
import {
  buildBreadcrumbItems,
  formatDynamicSegmentLabel,
  ROUTE_SEGMENT_MAP
} from './breadcrumb.utils';

test('buildBreadcrumbItems creates default home breadcrumb on empty or root path', () => {
  const emptyItems = buildBreadcrumbItems('');
  assert.equal(emptyItems.length, 1);
  assert.equal(emptyItems[0].label, 'Trang chủ');
  assert.equal(emptyItems[0].url, '/dashboard');
  assert.equal(emptyItems[0].isLast, true);

  const rootItems = buildBreadcrumbItems('/');
  assert.equal(rootItems.length, 1);
  assert.equal(rootItems[0].url, '/dashboard');
});

test('buildBreadcrumbItems maps admin management sub-routes into hierarchical breadcrumb list', () => {
  const items = buildBreadcrumbItems('/rooms');
  assert.equal(items.length, 2);
  assert.equal(items[0].label, 'Trang chủ');
  assert.equal(items[0].url, '/dashboard');
  assert.equal(items[0].isLast, false);

  assert.equal(items[1].label, 'Quản lý phòng');
  assert.equal(items[1].url, '/rooms');
  assert.equal(items[1].isLast, true);
  assert.equal(items[1].icon, 'pi pi-th-large');
});

test('buildBreadcrumbItems handles nested admin routes like /admin/properties', () => {
  const items = buildBreadcrumbItems('/admin/properties');
  assert.equal(items.length, 3);
  assert.equal(items[0].url, '/dashboard');
  assert.equal(items[1].label, 'Quản trị');
  assert.equal(items[1].url, '/admin');
  assert.equal(items[2].label, 'Cơ sở & Chi nhánh');
  assert.equal(items[2].url, '/admin/properties');
  assert.equal(items[2].isLast, true);
});

test('buildBreadcrumbItems handles public booking portal routes and query strings', () => {
  const items = buildBreadcrumbItems('/booking/destinations/cho-dem-da-lat?checkIn=2026-11-06');
  assert.equal(items.length, 3);
  assert.equal(items[0].label, 'Trang chủ');
  assert.equal(items[0].url, '/booking');

  assert.equal(items[1].label, 'Điểm đến du lịch');
  assert.equal(items[1].url, '/booking/destinations');

  assert.equal(items[2].label, 'Cho Dem Da Lat');
  assert.equal(items[2].url, '/booking/destinations/cho-dem-da-lat');
  assert.equal(items[2].isLast, true);
});

test('formatDynamicSegmentLabel formats UUID and slug segments cleanly', () => {
  assert.equal(formatDynamicSegmentLabel('da-lat-pine-resort'), 'Da Lat Pine Resort');
  assert.equal(
    formatDynamicSegmentLabel('12060768-a67d-41fd-a70b-97f593c82172'),
    'Chi tiết #12060768'
  );
});

test('ROUTE_SEGMENT_MAP includes essential PMS and Booking domain routes', () => {
  assert.ok(ROUTE_SEGMENT_MAP['dashboard']);
  assert.ok(ROUTE_SEGMENT_MAP['rooms']);
  assert.ok(ROUTE_SEGMENT_MAP['reservations']);
  assert.ok(ROUTE_SEGMENT_MAP['payments']);
  assert.ok(ROUTE_SEGMENT_MAP['housekeeping']);
  assert.ok(ROUTE_SEGMENT_MAP['audit-logs']);
});
