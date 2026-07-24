/**
 * UXV2 Percy visual baselines (Dispatch + Quotes gold samples, Hub, mobile).
 * Requires PERCY_TOKEN. Without it, tests skip (CI stays green for docs/local).
 *
 * Run:
 *   PERCY_TOKEN=... npx percy exec -- playwright test tests/smoke/uxv2-percy-baselines.spec.js
 */
import { test, expect } from '@playwright/test';

const hasPercy = Boolean(process.env.PERCY_TOKEN);
const baseURL = process.env.PLAYWRIGHT_BASE_URL || process.env.BASE_URL || 'http://127.0.0.1:5173';
const tenant = process.env.E2E_TENANT_ID || 'tvg';

async function maybePercy(page, name, opts) {
  if (!hasPercy) return;
  const { default: percySnapshot } = await import('@percy/playwright');
  await percySnapshot(page, name, opts);
}

test.describe('UXV2 Percy baselines', () => {
  test.skip(!hasPercy, 'PERCY_TOKEN not set — baseline capture skipped');

  test('Hub Today hero (desktop)', async ({ page }) => {
    await page.goto(`${baseURL}/${tenant}/crm`);
    await expect(page.getByTestId('hub-today-hero')).toBeVisible({ timeout: 30000 });
    await maybePercy(page, 'UXV2 Hub Today — desktop', { widths: [1280] });
  });

  test('Quotes list gold sample (desktop + mobile width)', async ({ page }) => {
    await page.goto(`${baseURL}/${tenant}/crm/quotes`);
    await expect(page.getByTestId('crm-page-header')).toBeVisible({ timeout: 30000 });
    await maybePercy(page, 'UXV2 Quotes — desktop', { widths: [1280] });
    await page.setViewportSize({ width: 390, height: 844 });
    await maybePercy(page, 'UXV2 Quotes — mobile 390', { widths: [390] });
  });

  test('Dispatch gold sample (desktop + mobile width)', async ({ page }) => {
    await page.goto(`${baseURL}/${tenant}/crm/dispatch`);
    await expect(page.getByTestId('crm-page-header')).toBeVisible({ timeout: 30000 });
    await maybePercy(page, 'UXV2 Dispatch — desktop', { widths: [1280] });
    await page.setViewportSize({ width: 390, height: 844 });
    await maybePercy(page, 'UXV2 Dispatch — mobile 390', { widths: [390] });
  });
});
