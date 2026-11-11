import { test, assert } from 'vitest';
import {
  formatCrudBadge,
  countActivePermissions,
  filterRoles,
  normalizeRoleCode,
  getVietnameseFunctionName,
  calculateRowMaskScore,
  applyScoreMaskToRow,
  toggleCrudCellWithCascade,
  localizeRoleDetail
} from './roles-management.utils';
import { RoleDetailDto } from '../../core/models/staff.model';

test('formatCrudBadge computes R, C, U, D flags from booleans and bitmask', () => {
  assert.equal(
    formatCrudBadge({
      actionMask: 15,
      canRead: true,
      canCreate: true,
      canUpdate: true,
      canDelete: true
    }),
    'RCUD'
  );

  assert.equal(
    formatCrudBadge({
      actionMask: 5,
      canRead: true,
      canCreate: false,
      canUpdate: true,
      canDelete: false
    }),
    'RU'
  );
});

test('toggleCrudCellWithCascade auto-enables Read when Create/Update/Delete is checked and clears all when Read is unchecked', () => {
  const emptyRow = {
    functionId: '1',
    code: 'ROOMS',
    name: 'Quản lý Sơ đồ & Phòng lưu trú',
    moduleCode: 'ROOMS',
    canRead: false,
    canCreate: false,
    canUpdate: false,
    canDelete: false
  };

  // Checking Update automatically checks Read
  const afterUpdate = toggleCrudCellWithCascade(emptyRow, 'canUpdate');
  assert.equal(afterUpdate.canUpdate, true);
  assert.equal(afterUpdate.canRead, true);

  // Unchecking Read automatically clears Update, Create, Delete
  const afterUncheckRead = toggleCrudCellWithCascade(afterUpdate, 'canRead');
  assert.equal(afterUncheckRead.canRead, false);
  assert.equal(afterUncheckRead.canUpdate, false);
});

test('calculateRowMaskScore and applyScoreMaskToRow work properly', () => {
  assert.equal(
    calculateRowMaskScore({ canRead: true, canCreate: false, canUpdate: false, canDelete: false }),
    1
  );
  assert.equal(
    calculateRowMaskScore({ canRead: true, canCreate: true, canUpdate: true, canDelete: false }),
    7
  );
  assert.equal(
    calculateRowMaskScore({ canRead: true, canCreate: true, canUpdate: true, canDelete: true }),
    15
  );

  const row = applyScoreMaskToRow(
    { functionId: '1', code: 'ROOMS', name: 'Phòng', moduleCode: 'ROOMS', canRead: false, canCreate: false, canUpdate: false, canDelete: false },
    7
  );
  assert.equal(row.canRead, true);
  assert.equal(row.canCreate, true);
  assert.equal(row.canUpdate, true);
  assert.equal(row.canDelete, false);
});

test('getVietnameseFunctionName and localizeRoleDetail translate English feature and role names to Vietnamese', () => {
  assert.equal(getVietnameseFunctionName('RESERVATIONS', 'Reservation Management'), 'Quản lý Đặt phòng & Lưu trú');
  assert.equal(getVietnameseFunctionName('HOUSEKEEPING', 'Housekeeping'), 'Điều phối Buồng phòng & Vệ sinh');

  const localized = localizeRoleDetail({
    id: 'r1',
    code: 'MANAGER',
    name: 'Hotel Manager',
    description: 'Operational management with limited staff and settings access.',
    isSystemRole: true,
    staffCount: 2,
    permissions: [
      {
        functionId: 'f1',
        functionCode: 'INVOICES',
        functionName: 'Invoice Management',
        moduleCode: 'PAYMENTS',
        actionMask: 15,
        canRead: true,
        canCreate: true,
        canUpdate: true,
        canDelete: true,
        canApprove: false,
        canExport: false
      }
    ]
  });

  assert.equal(localized.name, 'Quản lý Chi nhánh (Hotel Manager)');
  assert.equal(localized.permissions[0]?.functionName, 'Quản lý Hóa đơn & Công nợ Folio');
});

test('countActivePermissions and filterRoles work properly', () => {
  const stats = countActivePermissions([
    { actionMask: 15, canRead: true, canCreate: true, canUpdate: true, canDelete: true },
    { actionMask: 3, canRead: true, canCreate: true, canUpdate: false, canDelete: false },
    { actionMask: 0, canRead: false, canCreate: false, canUpdate: false, canDelete: false }
  ]);

  assert.equal(stats.modulesWithAccess, 2);
  assert.equal(stats.totalCrudGrants, 6);
  assert.equal(stats.fullAccessModules, 1);

  const sampleRoles: RoleDetailDto[] = [
    {
      id: '1',
      code: 'OWNER',
      name: 'Chủ cơ sở (Owner)',
      description: 'Toàn quyền quản trị hệ thống chuỗi khách sạn',
      isSystemRole: true,
      isActive: true,
      staffCount: 2,
      permissions: []
    },
    {
      id: '2',
      code: 'ACCOUNTANT_PRO',
      name: 'Kế toán Trưởng Chuỗi',
      description: 'Quản lý công nợ, hóa đơn và đối soát doanh thu chi nhánh',
      isSystemRole: false,
      isActive: true,
      staffCount: 1,
      permissions: []
    },
    {
      id: '3',
      code: 'NIGHT_AUDITOR',
      name: 'Kiểm toán Ca đêm (Night Auditor)',
      description: 'Đối soát cuối ngày và chốt sổ ca đêm',
      isSystemRole: false,
      isActive: false,
      staffCount: 0,
      permissions: []
    }
  ];

  // Search by keyword
  assert.equal(filterRoles(sampleRoles, 'đối soát', 'ALL').length, 2);
  assert.equal(filterRoles(sampleRoles, 'Kế toán Trưởng', 'ALL')[0]?.code, 'ACCOUNTANT_PRO');

  // Filter by status (ACTIVE / INACTIVE / ASSIGNED / UNASSIGNED)
  assert.equal(filterRoles(sampleRoles, '', 'ALL', 'ACTIVE').length, 2);
  assert.equal(filterRoles(sampleRoles, '', 'ALL', 'INACTIVE').length, 1);
  assert.equal(filterRoles(sampleRoles, '', 'ALL', 'INACTIVE')[0]?.code, 'NIGHT_AUDITOR');
  assert.equal(filterRoles(sampleRoles, '', 'ALL', 'ASSIGNED').length, 2);
  assert.equal(filterRoles(sampleRoles, '', 'ALL', 'UNASSIGNED').length, 1);
  assert.equal(filterRoles(sampleRoles, '', 'ALL', 'UNASSIGNED')[0]?.code, 'NIGHT_AUDITOR');

  // Combined search + scope + status
  assert.equal(filterRoles(sampleRoles, 'đối soát', 'CUSTOM', 'ACTIVE')[0]?.code, 'ACCOUNTANT_PRO');
  assert.equal(normalizeRoleCode('  night auditor #1 '), 'NIGHT_AUDITOR_1');
});
