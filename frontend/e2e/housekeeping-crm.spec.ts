import { expect, test } from '@playwright/test';
import { allowMutation, expectMutation, fixture, login } from './support';

test('11 housekeeping realtime updates across two browser sessions without reload', async ({ browser }) => {
  allowMutation();
  const reservationCode = fixture('E2E_REALTIME_CHECKOUT_CODE');
  const roomNumber = fixture('E2E_REALTIME_ROOM_NUMBER');

  const receptionistCtx = await browser.newContext();
  const housekeeperCtx = await browser.newContext();
  const receptionistPage = await receptionistCtx.newPage();
  const housekeeperPage = await housekeeperCtx.newPage();

  try {
    await login(housekeeperPage, 'HOUSEKEEPER');
    await housekeeperPage.goto('/housekeeping');
    await expect(housekeeperPage).toHaveURL(/\/housekeeping/);
    await expect(housekeeperPage.getByRole('heading', { name: /Buồng phòng|Housekeeping/i }).first()).toBeVisible();

    // Open notification bell briefly to confirm SignalR live status
    const bellBtn = housekeeperPage.locator('#notification-bell-trigger');
    await expect(bellBtn).toBeVisible();
    await bellBtn.click();
    await expect(housekeeperPage.getByText(/Trực tiếp|Connected/i).first()).toBeVisible();
    await bellBtn.click();

    await login(receptionistPage, 'RECEPTIONIST');
    await receptionistPage.goto('/reservations');
    await receptionistPage.getByPlaceholder('Mã đơn, tên khách, SĐT, số phòng...').fill(reservationCode);
    const resRow = receptionistPage.locator('tr', { hasText: reservationCode }).first();
    await expect(resRow).toBeVisible();

    // Watch for automatic refresh GET triggered by SignalR on housekeeper page (no reload!)
    const hkRefreshPromise = housekeeperPage.waitForResponse(
      r => (r.url().includes('/api/housekeeping') || r.url().includes('/api/rooms')) && r.request().method() === 'GET' && r.ok(),
      { timeout: 15_000 }
    );

    await resRow.getByRole('button', { name: /Trả phòng/i }).first().click();
    await expectMutation(receptionistPage, '/check-out', () =>
      receptionistPage.locator('button:not([disabled])').filter({ hasText: /Thu đủ.*Trả phòng|Hoàn tất trả phòng/i }).first().click()
    );

    await hkRefreshPromise;
    await expect(housekeeperPage.getByText(new RegExp(`Phòng\\s*${roomNumber}|${roomNumber}`)).first()).toBeVisible();
  } finally {
    await receptionistCtx.close();
    await housekeeperCtx.close();
  }
});

test('12 guest CRM UI displays phone-less guest and persists VIP override and Blacklist', async ({ page }) => {
  allowMutation();
  const guestEmail = fixture('E2E_CRM_PHONELESS_EMAIL');
  const noteText = `E2E CRM note ${Date.now()}`;

  await login(page, 'RECEPTIONIST');
  await page.goto('/guests');
  await expect(page).toHaveURL(/\/guests/);
  await expect(page.getByRole('heading', { name: /Khách hàng|CRM/i }).first()).toBeVisible();

  const searchInput = page.locator('input[type="search"], input[placeholder*="Tìm"]').first();
  const desktopTable = page.locator('table');
  await searchInput.fill(guestEmail);
  await page.getByRole('button', { name: 'Tìm kiếm', exact: true }).click();
  await expect(desktopTable.getByText(guestEmail, { exact: false }).first()).toBeVisible();
  await expect(desktopTable.getByText('Chưa có SĐT').first()).toBeVisible();

  // Open detail modal for the phone-less guest
  await desktopTable.getByRole('button', { name: /Xem lịch sử lưu trú và ghi chú/i }).first().click();
  await expect(page.locator('#guest-internal-notes')).toBeVisible();
  await expect(page.locator('#guest-vip')).toHaveCount(1);

  await page.locator('#guest-internal-notes').fill(noteText);
  await page.locator('#guest-vip').selectOption({ label: 'VIP thủ công' });
  const blacklistCheckbox = page.locator('label', { hasText: /Blacklist/i }).locator('input[type="checkbox"]');
  if (!(await blacklistCheckbox.isChecked())) {
    await blacklistCheckbox.check();
  }

  await expectMutation(page, '/api/guests/notes', () =>
    page.getByRole('button', { name: 'Lưu ghi chú', exact: true }).click()
  );

  // Reload to verify real PostgreSQL persistence across page reload
  await page.reload();
  await searchInput.fill(guestEmail);
  await page.getByRole('button', { name: 'Tìm kiếm', exact: true }).click();
  await expect(desktopTable.getByText(guestEmail, { exact: false }).first()).toBeVisible();
  await expect(desktopTable.getByText(noteText, { exact: false }).first()).toBeVisible();
  await expect(desktopTable.getByText('Blacklist', { exact: true }).first()).toBeVisible();
  await expect(desktopTable.getByText('VIP', { exact: true }).first()).toBeVisible();
});
