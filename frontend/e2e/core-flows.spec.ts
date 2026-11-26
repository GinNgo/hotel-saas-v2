import { expect, test } from '@playwright/test';
import { allowMutation, expectMutation, fixture, login, token } from './support';

test('01 B2C public discovery exposes 34 provinces and search results @public', async ({ page, request }) => {
  const provinces = await request.get('/api/locations/provinces');
  expect(provinces.ok(), `Province API returned HTTP ${provinces.status()}`).toBeTruthy();
  const body: unknown = await provinces.json();
  const data = Array.isArray(body) ? body : (body as { data: unknown[] }).data;
  expect(data).toHaveLength(34);
  await page.goto('/booking');
  await expect(page.locator('a[href*="/booking/properties/"]').first()).toBeVisible();
  await page.goto('/booking/explore?provinceCode=79');
  await expect(page.locator('a[href*="/booking/properties/"]').first()).toBeVisible();
});

test('02 property detail opens from discovery and displays room selection @public', async ({ page }) => {
  await page.goto('/booking');
  const link = page.locator('a[href*="/booking/properties/"]').first();
  await expect(link).toBeVisible();
  await link.click();
  await expect(page).toHaveURL(/\/booking\/properties\/[^/?]+/);
  await expect(page.getByRole('heading').first()).toBeVisible();
  await expect(page.getByText(/Chọn phòng|Loại phòng|Hạng phòng|Phòng trống/i).first()).toBeVisible();
});

test('03 verified guest applies promotion and creates a 15-minute hold', async ({ page }) => {
  allowMutation();
  const holdUrl = fixture('E2E_HOLD_URL');
  const promo = fixture('E2E_PROMO_CODE');
  const guestName = fixture('E2E_GUEST_NAME');
  await login(page, 'GUEST'); // Pre-verified Firebase test user; never a dev mock token.
  await page.goto(holdUrl);
  await page.locator('input[name="name"]').fill(guestName);
  await page.locator('input[name="phone"]').fill(fixture('E2E_GUEST_PHONE'));
  await page.locator('input[name="email"]').fill(fixture('E2E_GUEST_EMAIL'));
  await page.getByPlaceholder(/Nhập mã ưu đãi/).fill(promo);
  await page.getByRole('button', { name: 'Áp dụng', exact: true }).click();
  await expect(page.getByText(promo, { exact: false }).last()).toBeVisible();
  const response = page.waitForResponse(r => r.url().includes('/api/public/bookings/hold') && r.request().method() === 'POST');
  const started = Date.now();
  await page.getByRole('button', { name: 'Xác Nhận Giữ Phòng Ngay' }).click();
  const hold = await response;
  expect(hold.status()).toBe(201);
  const raw = await hold.json() as { data?: { holdExpiresAtUtc: string }; holdExpiresAtUtc?: string };
  const expires = Date.parse(raw.data?.holdExpiresAtUtc ?? raw.holdExpiresAtUtc ?? '');
  expect(expires - started).toBeGreaterThan(14 * 60_000);
  expect(expires - started).toBeLessThan(16 * 60_000);
  await expect(page.getByText('Giữ phòng thành công!', { exact: false })).toBeVisible();
});

test('04 VNPay return and booking status reflect a real sandbox fixture', async ({ page }) => {
  const returnUrl = fixture('E2E_VNPAY_RETURN_URL');
  const lookup = fixture('E2E_LOOKUP_TOKEN');
  const expectedStatus = fixture('E2E_BOOKING_EXPECTED_STATUS');
  await page.goto(returnUrl);
  await expect(page.getByText(/thanh toán|giao dịch/i).first()).toBeVisible();
  await page.goto(`/booking/status/${encodeURIComponent(lookup)}`);
  await expect(page.getByText(expectedStatus, { exact: false }).first()).toBeVisible();
});

test('05 PMS owner login preserves HQ context after reload', async ({ page }) => {
  await login(page, 'OWNER');
  await page.goto('/dashboard');
  const currentMode = await page.evaluate(() => localStorage.getItem('hotelsaas_context_mode'));
  if (currentMode !== 'hq') {
    await page.getByRole('button', { name: /Đổi chi nhánh làm việc hoặc chuyển sang HQ/i }).click();
    const hqBtn = page.locator('app-context-selector-dialog').getByRole('button', { name: /Tổng quan Cơ sở tổng|HQ/i }).first();
    await expect(hqBtn).toBeVisible();
    await hqBtn.click();
  }
  await expect.poll(() => page.evaluate(() => localStorage.getItem('hotelsaas_context_mode'))).toBe('hq');
  await page.reload();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('hotelsaas_context_mode'))).toBe('hq');
  expect(await page.evaluate(() => localStorage.getItem('hotel_saas_active_property_id'))).toBeNull();
});

test('06 walk-in reservation UI form creation, check-in and check-out', async ({ page }) => {
  allowMutation();
  const guestName = process.env['E2E_WALKIN_GUEST_NAME'] || `Walk-In E2E ${Date.now()}`;
  const guestEmail = process.env['E2E_WALKIN_GUEST_EMAIL'] || `walkin.e2e.${Date.now()}@example.test`;
  const guestPhone = process.env['E2E_WALKIN_GUEST_PHONE'] || '';
  await login(page, 'RECEPTIONIST');
  await page.goto('/reservations');
  await page.getByRole('button', { name: 'Tạo đặt phòng mới' }).first().click();
  const dialog = page.locator('[role="dialog"][aria-label="Tạo đặt phòng mới"]');
  await expect(dialog).toBeVisible();
  await dialog.locator('input[formControlName="checkInTime"]').fill('14:00');
  await dialog.locator('input[formControlName="checkOutTime"]').fill('12:00');
  const roomTypeSelect = dialog.locator('select[formControlName="roomTypeId"]');
  await expect.poll(() => roomTypeSelect.locator('option').count()).toBeGreaterThan(1);
  const firstRoomTypeValue = await roomTypeSelect.locator('option').nth(1).getAttribute('value');
  expect(firstRoomTypeValue).toBeTruthy();
  await roomTypeSelect.selectOption(firstRoomTypeValue!);
  await dialog.getByRole('button', { name: /Kiểm tra & Tính giá/i }).click();
  const availableRoomBtn = dialog.locator('button:not([disabled])').filter({ hasText: /^Phòng\s+/ }).first();
  await expect(availableRoomBtn).toBeVisible();
  await availableRoomBtn.click();
  await dialog.locator('input[formControlName="guestName"]').fill(guestName);
  await dialog.locator('input[formControlName="guestEmail"]').fill(guestEmail);
  if (guestPhone) {
    await dialog.locator('input[formControlName="guestPhone"]').fill(guestPhone);
  }
  const createRespPromise = page.waitForResponse(
    r => r.url().includes('/api/reservations') && r.request().method() === 'POST'
  );
  await dialog.getByRole('button', { name: /Xác nhận tạo đặt phòng/i }).click();
  const createResp = await createRespPromise;
  expect(createResp.status(), `Walk-in creation returned HTTP ${createResp.status()}`).toBe(201);
  const raw = await createResp.json() as { data?: { confirmationCode: string }; confirmationCode?: string };
  const code = raw.data?.confirmationCode ?? raw.confirmationCode;
  expect(code).toBeTruthy();
  await page.goto('/reservations');
  await page.getByPlaceholder('Mã đơn, tên khách, SĐT, số phòng...').fill(code!);
  const row = page.locator('tr', { hasText: code! }).first();
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: /Nhận phòng/i }).first().click();
  await page.getByRole('checkbox', { name: /đối chiếu trực tiếp giấy tờ tùy thân/i }).check();
  await expectMutation(page, '/check-in', () => page.getByRole('button', { name: /Xác nhận nhận phòng/i }).click());
  await row.getByRole('button', { name: /Trả phòng/i }).first().click();
  await expectMutation(page, '/check-out', () =>
    page.locator('button:not([disabled])').filter({ hasText: /Thu đủ.*Trả phòng|Hoàn tất trả phòng/i }).first().click()
  );
  await expect(row.getByText(/Đã trả phòng/).first()).toBeVisible();
});

test('07 housekeeper self-claims and completes a disposable room task', async ({ page }) => {
  allowMutation();
  const room = fixture('E2E_HOUSEKEEPING_ROOM');
  await login(page, 'HOUSEKEEPER');
  await page.waitForLoadState('networkidle');
  await page.goto('/housekeeping');
  await expect(page).toHaveURL(/\/housekeeping/);
  await expectMutation(page, '/claim', () => page.getByRole('button', { name: `Tự nhận việc phòng ${room}`, exact: true }).click());
  await expectMutation(page, '/start', () => page.getByRole('button', { name: `Bắt đầu dọn phòng ${room}`, exact: true }).click());
  await expectMutation(page, '/complete', () => page.getByRole('button', { name: `Hoàn tất sạch phòng ${room}`, exact: true }).click());
});

test('08 manager approves D23 and records one refund payout', async ({ page }) => {
  allowMutation();
  const code = fixture('E2E_REFUND_BOOKING_CODE');
  await login(page, 'MANAGER');
  await page.goto('/payments');
  await page.getByRole('button', { name: /Yêu cầu hoàn tiền/i }).click();
  await page.getByPlaceholder('Nhập mã booking hoặc tên khách để tìm kiếm...').fill(code);
  const row = page.locator('tr', { hasText: code }).first();
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: /Xét duyệt|Chi tiết/i }).click();
  await page.getByRole('button', { name: /Phê duyệt yêu cầu/i }).click();
  await expectMutation(page, '/approve', () => page.getByRole('button', { name: /Xác nhận Duyệt/i }).click());
  await page.getByRole('button', { name: /Xác nhận chi trả/i }).click();
  await page.getByPlaceholder(/Ví dụ: PC-|Ví dụ: VCB-/).fill(`E2E-${Date.now()}`);
  await expectMutation(page, '/confirm-payout', () => page.getByRole('button', { name: /Xác nhận Đã Chi Trả/i }).click());
  await expect(page.getByText(/Đã hoàn tiền|Đã chi trả/i).first()).toBeVisible();
});

test('09 SuperAdmin reads platform users and tenants', async ({ page }) => {
  await login(page, 'SUPERADMIN');
  for (const path of ['/platform-users', '/platform-tenants']) {
    await page.goto(path);
    await expect(page).toHaveURL(new RegExp(path));
    await expect(page.getByRole('heading').first()).toBeVisible();
    const content = path === '/platform-users' ? page.locator('table').first() : page.locator('article').first();
    await expect(content).toBeVisible();
  }
});

test('10 branch-scoped receptionist is denied cross-branch HTTP access', async ({ page }) => {
  const forbiddenProperty = fixture('E2E_FORBIDDEN_PROPERTY_ID');
  await login(page, 'RECEPTIONIST');
  const bearer = await token(page);
  const own = fixture('E2E_PROPERTY_ID');
  const control = await page.request.get('/api/rooms', { headers: { Authorization: `Bearer ${bearer}`, 'X-Property-Id': own } });
  expect(control.status()).toBe(200);
  const denied = await page.request.get(`/api/rooms?propertyId=${forbiddenProperty}`, {
    headers: { Authorization: `Bearer ${bearer}`, 'X-Property-Id': forbiddenProperty } });
  expect(denied.status()).toBe(403);
  const body = await denied.json() as { errorCode?: string };
  expect(body.errorCode).toBe('ERR_PROPERTY_FORBIDDEN');
});
