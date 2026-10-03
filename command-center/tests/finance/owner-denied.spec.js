/**
 * Owner stays denied on the Finance route. Synthetic local user only.
 * The release gate creates the user. This file never sees a service-role key.
 */
import { test, expect } from '@playwright/test';

test('owner cannot open Finance', async ({ page }) => {
  if (!process.env.FINANCE_OWNER_EMAIL || !process.env.FINANCE_OWNER_PASSWORD) {
    throw new Error('FINANCE_OWNER_EMAIL and FINANCE_OWNER_PASSWORD are required. The release gate supplies a synthetic local owner. This spec does not skip.');
  }
  await page.goto('/tvg/login?next=%2Ftvg%2Ffinance');
  await page.locator('#email').fill(process.env.FINANCE_OWNER_EMAIL);
  await page.locator('#password').fill(process.env.FINANCE_OWNER_PASSWORD);
  await page.locator('button[type="submit"]').click();
  await expect(page.getByTestId('finance-access-denied')).toBeVisible();
  await expect(page.getByTestId('finance-shell')).toHaveCount(0);
  await expect(page.getByTestId('finance-save')).toHaveCount(0);
});
