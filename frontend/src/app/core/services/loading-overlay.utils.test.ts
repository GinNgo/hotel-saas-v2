import { test, assert } from 'vitest';
import {
  DEFAULT_LOADING_LABEL,
  SKIP_OVERLAY_HEADER,
  addLoadingTask,
  removeLoadingTask,
  resolveContextualLoadingLabel,
  selectPrimaryLoadingLabel,
  shouldBypassGlobalOverlay
} from './loading-overlay.utils';

test('shouldBypassGlobalOverlay skips SignalR hubs, health checks, and explicit skip header', () => {
  assert.equal(shouldBypassGlobalOverlay('/hubs/notifications/negotiate'), true);
  assert.equal(shouldBypassGlobalOverlay('/health/ready'), true);
  assert.equal(shouldBypassGlobalOverlay('/metrics'), true);
  assert.equal(
    shouldBypassGlobalOverlay('/api/rooms', { [SKIP_OVERLAY_HEADER]: 'true' }),
    true
  );
  assert.equal(shouldBypassGlobalOverlay('/api/reservations'), false);
});

test('resolveContextualLoadingLabel maps HTTP method and domain route to Vietnamese UX copy', () => {
  assert.equal(
    resolveContextualLoadingLabel('POST', '/api/auth/switch-context'),
    'Đang chuyển đổi ngữ cảnh chi nhánh...'
  );
  assert.equal(
    resolveContextualLoadingLabel('PUT', '/api/staff/roles/123'),
    'Đang lưu cấu hình phân quyền...'
  );
  assert.equal(
    resolveContextualLoadingLabel('POST', '/api/payments'),
    'Đang xử lý giao dịch thanh toán...'
  );
  assert.equal(
    resolveContextualLoadingLabel('GET', '/api/audit-logs?page=1'),
    'Đang truy xuất nhật ký kiểm toán...'
  );
});

test('addLoadingTask, removeLoadingTask, and selectPrimaryLoadingLabel manage concurrent async operations', () => {
  let tasks = addLoadingTask([], {
    id: 't1',
    label: 'Đang tải danh sách phòng...',
    startedAt: 1000
  });
  assert.equal(tasks.length, 1);
  assert.equal(selectPrimaryLoadingLabel(tasks), 'Đang tải danh sách phòng...');

  tasks = addLoadingTask(tasks, {
    id: 't2',
    label: 'Đang lưu cấu hình phân quyền...',
    startedAt: 1200
  });
  assert.equal(tasks.length, 2);
  // Most recent task label takes precedence
  assert.equal(selectPrimaryLoadingLabel(tasks), 'Đang lưu cấu hình phân quyền...');

  tasks = removeLoadingTask(tasks, 't2');
  assert.equal(tasks.length, 1);
  assert.equal(selectPrimaryLoadingLabel(tasks), 'Đang tải danh sách phòng...');

  tasks = removeLoadingTask(tasks, 't1');
  assert.equal(tasks.length, 0);
  assert.equal(selectPrimaryLoadingLabel(tasks), DEFAULT_LOADING_LABEL);
});
