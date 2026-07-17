/* eslint-disable testing-library/prefer-screen-queries, jest/valid-title */
import { test, expect } from '@playwright/test';

// R4A — Office Inspection Customer Selector Usability.
// This loads the real shared Select primitive through a Vite-served test fixture.
// The fixture has deterministic mock data and imports no app services, auth, or
// Supabase client, so it is safe to run without a backend.

const VIEWPORTS = [
  { name: 'desktop-1920x1080', width: 1920, height: 1080 },
  { name: 'laptop-1366x768', width: 1366, height: 768 },
  { name: 'mobile-430x932', width: 430, height: 932 },
  { name: 'mobile-390x844', width: 390, height: 844 },
];

const viewportMetrics = async (page) =>
  page.evaluate(() => {
    const vp = document.querySelector('[data-radix-select-viewport]');
    if (!vp) return null;
    const content = vp.closest('[role="listbox"]');
    const bounds = content?.getBoundingClientRect();
    return {
      clientHeight: vp.clientHeight,
      scrollHeight: vp.scrollHeight,
      scrollTop: vp.scrollTop,
      windowHeight: window.innerHeight,
      contentTop: bounds?.top,
      contentBottom: bounds?.bottom,
      pageScrollY: window.scrollY,
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });

test('long Customer (Lead) list is bounded, scrollable, and the last option is selectable across viewports', async ({ page }) => {
  const supabaseRequests = [];
  page.on('request', (request) => {
    if (/supabase/i.test(request.url())) supabaseRequests.push(request.url());
  });

  for (const vp of VIEWPORTS) {
    await test.step(vp.name, async () => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/tests/fixtures/r4a-select-harness.html', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: 'R4A Select Test Harness' })).toBeVisible();

      const customerSelect = page.getByRole('combobox', { name: 'Customer (Lead)' });
      await customerSelect.click();
      const options = page.getByRole('option');
      const viewport = page.locator('[data-radix-select-viewport]');
      await expect(options).toHaveCount(60);
      await expect(viewport).toBeVisible();

      const bounded = await viewportMetrics(page);
      expect(bounded, 'radix select viewport not found').not.toBeNull();
      expect(bounded.clientHeight).toBeLessThanOrEqual(400);
      expect(bounded.scrollHeight).toBeGreaterThan(bounded.clientHeight);
      expect(bounded.contentTop).toBeGreaterThanOrEqual(0);
      expect(bounded.contentBottom).toBeLessThanOrEqual(bounded.windowHeight);
      expect(bounded.horizontalOverflow).toBe(false);

      const box = await viewport.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.wheel(0, 600);
      await expect.poll(async () => (await viewportMetrics(page)).scrollTop).toBeGreaterThan(0);
      expect((await viewportMetrics(page)).pageScrollY).toBe(bounded.pageScrollY);

      await page.keyboard.press('Home');
      await expect(options.first()).toHaveAttribute('data-highlighted', '');
      await page.keyboard.press('ArrowDown');
      await expect(options.nth(1)).toHaveAttribute('data-highlighted', '');
      const scrollTopBeforePageDown = (await viewportMetrics(page)).scrollTop;
      await page.keyboard.press('PageDown');
      await expect.poll(async () => (await viewportMetrics(page)).scrollTop).toBeGreaterThan(scrollTopBeforePageDown);
      await page.keyboard.press('End');
      await expect(options.last()).toHaveAttribute('data-highlighted', '');

      const finalLabel = await options.last().innerText();
      await page.keyboard.press('Enter');
      await expect(page.getByTestId('selected-customer')).toHaveText(`Selected customer: ${finalLabel}`);
      await expect(customerSelect).toContainText(finalLabel);
      await expect(page.getByRole('option')).toHaveCount(0);
    });
  }

  await test.step('short-list regression (Inspection Type)', async () => {
    const inspectionType = page.getByRole('combobox', { name: 'Inspection Type' });
    await inspectionType.click();
    await expect(page.getByRole('option')).toHaveCount(3);
    const shortListBox = page.getByRole('listbox');
    await expect(shortListBox).toHaveJSProperty('scrollHeight', await shortListBox.evaluate((node) => node.clientHeight));
    await page.getByRole('option', { name: 'Air Duct' }).click();
    await expect(page.getByTestId('selected-inspection-type')).toHaveText('Selected type: air_duct');
  });

  expect(supabaseRequests).toEqual([]);
});
