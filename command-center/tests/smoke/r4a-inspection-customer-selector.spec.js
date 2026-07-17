/* eslint-disable testing-library/prefer-screen-queries, jest/valid-title */
import { test, expect } from '@playwright/test';
import { createAdminClient, createRunId, insertWithRetry, buildLeadPayload } from './helpers/supabaseAdmin.js';

// R4A — Office Inspection Customer Selector Usability.
// Real-browser behavioral coverage for the Customer (Lead) dropdown on
// /tvg/crm/inspections/new. Verifies the fixed shared Select primitive at the
// four required viewports: the long list is height-bounded, scrolls (wheel +
// keyboard), the last option is reachable and selectable, and selection updates
// the inspection form. Also confirms a short adjacent dropdown still works.
//
// Like the other office-inspection E2E specs, this requires a LOCAL Supabase and
// skips otherwise (portal + real layout can only be exercised against the app).

const TENANT_ID = 'tvg';
const LEAD_COUNT = 40;

const VIEWPORTS = [
  { name: 'desktop-1920x1080', width: 1920, height: 1080 },
  { name: 'laptop-1366x768', width: 1366, height: 768 },
  { name: 'mobile-430x932', width: 430, height: 932 },
  { name: 'mobile-390x844', width: 390, height: 844 },
];

const signIn = async (page, email, password) => {
  await page.goto('/tvg/login', { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: /^sign in$/i }).click();
  await page.waitForURL((url) => url.pathname.startsWith('/tvg/') && !url.pathname.endsWith('/login'));
};

const openCustomerDropdown = async (page) => {
  await expect(page.getByRole('heading', { name: 'Create Inspection' })).toBeVisible();
  await page.getByText('Customer (Lead)', { exact: true }).locator('..').getByRole('combobox').click();
  await expect(page.getByRole('option').first()).toBeVisible();
};

const viewportMetrics = async (page) =>
  page.evaluate(() => {
    const vp = document.querySelector('[data-radix-select-viewport]');
    if (!vp) return null;
    return {
      clientHeight: vp.clientHeight,
      scrollHeight: vp.scrollHeight,
      scrollTop: vp.scrollTop,
      windowHeight: window.innerHeight,
    };
  });

test('long Customer (Lead) list is bounded, scrollable, and the last option is selectable across viewports', async ({ page }) => {
  test.setTimeout(240_000);
  let admin;
  let env;
  try {
    ({ client: admin, env } = createAdminClient());
  } catch (err) {
    test.skip(true, `Supabase admin env not configured; selector E2E needs local Supabase: ${err.message}`);
  }
  if (!/127\.0\.0\.1|localhost/i.test(env.supabaseUrl)) {
    test.skip(true, `Refusing to run selector regression against non-local Supabase: ${env.supabaseUrl}`);
  }

  const runId = createRunId();
  const email = `${runId}@example.com`;
  const password = `Local-${runId}-A1!`;
  const leadIds = [];
  let userId;

  try {
    const user = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { tenant_id: TENANT_ID, role: 'admin' },
    });
    if (user.error) throw user.error;
    userId = user.data.user.id;

    for (let index = 0; index < LEAD_COUNT; index += 1) {
      const marker = String(index).padStart(3, '0');
      const lead = await insertWithRetry(admin, 'leads', buildLeadPayload(runId, {
        first_name: 'SELECTOR',
        last_name: `R4A ${marker}`,
        company: `R4A SELECTOR ${runId} ${marker}`,
        email: `${runId}.${marker}@example.com`,
      }));
      if (lead.error) throw lead.error;
      leadIds.push(lead.data.id);
    }

    await signIn(page, email, password);

    for (const vp of VIEWPORTS) {
      await test.step(vp.name, async () => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto('/tvg/crm/inspections/new', { waitUntil: 'domcontentloaded' });
        await openCustomerDropdown(page);

        const options = page.getByRole('option');
        const optionCount = await options.count();
        expect(optionCount).toBeGreaterThan(12);

        // 1 + 9: bounded height — the panel never exceeds the viewport height and
        // is capped (no clipping / off-screen list).
        const bounded = await viewportMetrics(page);
        expect(bounded, 'radix select viewport not found').not.toBeNull();
        expect(bounded.clientHeight).toBeLessThanOrEqual(bounded.windowHeight);
        expect(bounded.clientHeight).toBeLessThanOrEqual(400);

        // 2: the list actually overflows and is scrollable.
        expect(bounded.scrollHeight).toBeGreaterThan(bounded.clientHeight);

        // 2 (wheel): mouse-wheel moves the list.
        const box = await page.locator('[data-radix-select-viewport]').boundingBox();
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.wheel(0, 600);
        await expect
          .poll(async () => (await viewportMetrics(page)).scrollTop)
          .toBeGreaterThan(0);

        // 4 + 5 + 6: keyboard End reaches the last option; Enter selects it.
        const lastLabel = await options.last().innerText();
        await page.keyboard.press('Home');
        await page.keyboard.press('End');
        await expect(options.last()).toBeVisible();
        await page.keyboard.press('Enter');

        // 7: selection updates the inspection form (trigger reflects the choice)
        // and 8: the dropdown closed without leaving orphaned options.
        const combobox = page.getByText('Customer (Lead)', { exact: true }).locator('..').getByRole('combobox');
        await expect(combobox).toContainText(lastLabel.trim());
        await expect(page.getByRole('option')).toHaveCount(0);
      });
    }

    // 10: short adjacent Select (Inspection Type, 5 fixed items) still opens and selects.
    await test.step('short-list regression (Inspection Type)', async () => {
      await page.setViewportSize({ width: 1366, height: 768 });
      await page.goto('/tvg/crm/inspections/new', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: 'Create Inspection' })).toBeVisible();
      await page.getByText('Inspection Type', { exact: true }).locator('..').getByRole('combobox').click();
      await expect(page.getByRole('option', { name: 'Air Duct' })).toBeVisible();
      await page.getByRole('option', { name: 'Air Duct' }).click();
      await expect(page.getByText('Inspection Type', { exact: true }).locator('..').getByRole('combobox')).toContainText('Air Duct');
    });
  } finally {
    if (leadIds.length) await admin.from('leads').delete().in('id', leadIds);
    if (userId) await admin.auth.admin.deleteUser(userId);
  }
});
