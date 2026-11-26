import { expect, Page, test } from '@playwright/test';

export function fixture(name: string): string {
  const value = process.env[name];
  test.skip(!value, `BLOCKED: missing ${name}; supply an approved test fixture, never production data.`);
  return value!;
}

export function allowMutation(): void {
  test.skip(process.env['E2E_ALLOW_MUTATIONS'] !== 'true', 'BLOCKED: E2E_ALLOW_MUTATIONS=true requires an approved disposable test dataset.');
}

export async function login(page: Page, role: string, returnUrl?: string): Promise<void> {
  const email = fixture(`E2E_${role}_EMAIL`);
  const password = fixture(`E2E_${role}_PASSWORD`);
  const portal = role === 'GUEST' ? 'guest' : 'admin';
  const query = returnUrl ? `portal=${portal}&returnUrl=${encodeURIComponent(returnUrl)}` : `portal=${portal}`;
  await page.goto(`/auth/login?${query}`);
  await page.locator('[formControlName="email"]').fill(email);
  await page.locator('#password, [formControlName="password"] input').first().fill(password);
  const response = page.waitForResponse(r => r.url().includes('/api/auth/login') && r.request().method() === 'POST');
  await page.locator('button[type="submit"]').click();
  const result = await response;
  expect(result.ok()).toBeTruthy();
  const auth = await result.json() as {
    memberships?: { propertyId?: string }[];
    user?: { globalRole?: string };
  };
  if ((auth.memberships?.filter(m => m.propertyId).length ?? 0) > 1) {
    const dialog = page.locator('app-context-selector-dialog');
    if (role === 'OWNER') {
      await dialog.getByRole('button', { name: /Tổng quan Cơ sở tổng/ }).first().click();
    } else {
      await dialog.getByRole('button').filter({ hasText: fixture(`E2E_${role}_BRANCH_NAME`) }).first().click();
    }
  }
  await expect(page).not.toHaveURL(/\/auth\/login/);
  if (auth.user?.globalRole === 'TenantStaff') {
    await expect.poll(() => page.evaluate(() => {
      const mode = localStorage.getItem('hotelsaas_context_mode');
      const tok = localStorage.getItem('hotel_saas_access_token');
      if (!tok) return false;
      try {
        const payload = JSON.parse(atob(tok.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))) as { permissions?: string | string[] };
        const perms = typeof payload.permissions === 'string' ? JSON.parse(payload.permissions) : payload.permissions;
        return Boolean(mode) && Array.isArray(perms) && perms.length > 0;
      } catch {
        return false;
      }
    }), { timeout: 15_000 }).toBe(true);
  }
}

export async function token(page: Page): Promise<string> {
  const value = await page.evaluate(() => localStorage.getItem('hotel_saas_access_token'));
  expect(value, 'Login must provide a real access token').toBeTruthy();
  return value!;
}

export async function expectMutation(page: Page, endpoint: string, action: () => Promise<void>): Promise<void> {
  const response = page.waitForResponse(r => r.url().includes(endpoint) && ['POST', 'PUT', 'PATCH'].includes(r.request().method()));
  await action();
  expect((await response).ok(), `Mutation ${endpoint} must succeed`).toBeTruthy();
}
