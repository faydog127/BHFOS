/* eslint-disable testing-library/prefer-screen-queries, jest/valid-title */
import { test, expect } from '@playwright/test';
import { createAdminClient, createRunId, insertWithRetry, buildLeadPayload } from './helpers/supabaseAdmin.js';

const TENANT_ID = 'tvg';

test('phone portrait can open Report tab and see Generate PDF', async ({ page }) => {
  test.setTimeout(90_000);
  const { client: admin, env } = createAdminClient();
  if (!/127\.0\.0\.1|localhost/i.test(env.supabaseUrl)) test.skip(true, 'Local Supabase required.');

  const runId = createRunId('mobtabs').replace(/-/g, '').slice(0, 10);
  const email = `mobtabs.${runId}@example.com`;
  const password = `MobTabs-${runId}-Aa1!`;
  const created = { userId: null, leadId: null, inspectionId: null };

  try {
    const user = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { tenant_id: TENANT_ID, role: 'admin' },
    });
    if (user.error) throw user.error;
    created.userId = user.data.user.id;

    const lead = await insertWithRetry(
      admin,
      'leads',
      buildLeadPayload(runId, { first_name: 'MOB', last_name: 'TABS', email: `tabs.${runId}@example.com` }),
    );
    if (lead.error) throw lead.error;
    created.leadId = lead.data.id;

    const inspection = await insertWithRetry(admin, 'inspections', {
      tenant_id: TENANT_ID,
      lead_id: lead.data.id,
      status: 'draft',
      title: `MOBILE TABS ${runId}`,
      inspection_type: 'dryer_vent',
    });
    if (inspection.error) throw inspection.error;
    created.inspectionId = inspection.data.id;

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/tvg/login', { waitUntil: 'domcontentloaded' });
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await Promise.all([
      page.waitForURL((url) => url.pathname.startsWith('/tvg/') && !url.pathname.endsWith('/login')),
      page.getByRole('button', { name: /^sign in$/i }).click(),
    ]);

    await page.goto(`/tvg/crm/inspections/${created.inspectionId}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('tab', { name: 'Overview', exact: true })).toBeVisible();

    const reportTab = page.getByRole('tab', { name: 'Report', exact: true });
    await reportTab.scrollIntoViewIfNeeded();
    await expect(reportTab).toBeVisible();
    await reportTab.click();

    await expect(page.getByRole('heading', { name: 'Customer Report', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /Generate PDF/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Download PDF/i })).toBeVisible();
  } finally {
    if (created.inspectionId) await admin.from('inspections').delete().eq('id', created.inspectionId);
    if (created.leadId) await admin.from('leads').delete().eq('id', created.leadId);
    if (created.userId) await admin.auth.admin.deleteUser(created.userId);
  }
});
