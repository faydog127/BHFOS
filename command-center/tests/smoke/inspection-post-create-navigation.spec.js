/* eslint-disable testing-library/prefer-screen-queries, jest/valid-title */
import { test, expect } from '@playwright/test';
import { createAdminClient, createRunId, insertWithRetry, buildLeadPayload } from './helpers/supabaseAdmin.js';

const TENANT_ID = 'tvg';

const signIn = async (page, email, password) => {
  await page.goto('/tvg/login', { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: /^sign in$/i }).click();
  await page.waitForURL((url) => url.pathname.startsWith('/tvg/') && !url.pathname.endsWith('/login'));
};

test('opens each newly created inspection on the first navigation without duplicates', async ({ page }) => {
  test.setTimeout(180_000);
  const { client: admin, env } = createAdminClient();
  if (!/127\.0\.0\.1|localhost/i.test(env.supabaseUrl)) {
    test.skip(true, `Refusing to run navigation regression against non-local Supabase: ${env.supabaseUrl}`);
  }
  const runId = createRunId('post-create');
  const email = `${runId}@example.com`;
  const password = `Local-${runId}-A1!`;
  const customerName = `NAVIGATION TEST ${runId}`;
  const inspectionIds = [];
  let userId;
  let leadId;

  try {
    const user = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { tenant_id: TENANT_ID, role: 'admin' },
    });
    if (user.error) throw user.error;
    userId = user.data.user.id;

    const lead = await insertWithRetry(admin, 'leads', buildLeadPayload(runId, {
      first_name: 'NAVIGATION',
      last_name: `TEST ${runId}`,
      company: customerName,
      email: `${runId}.customer@example.com`,
    }));
    if (lead.error) throw lead.error;
    leadId = lead.data.id;

    await signIn(page, email, password);

    for (let index = 1; index <= 5; index += 1) {
      const title = `POST CREATE NAVIGATION ${runId} ${index}`;
      await page.goto('/tvg/crm/inspections/new', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: 'Create Inspection' })).toBeVisible();
      await page.getByRole('combobox').first().click();
      await page.getByText(customerName, { exact: true }).click();
      await page.getByPlaceholder('e.g. Dryer Vent Inspection').fill(title);
      await page.getByRole('button', { name: 'Create', exact: true }).click();
      await page.waitForURL(/\/tvg\/crm\/inspections\/[0-9a-f-]{36}$/);
      const inspectionId = page.url().split('/').pop();
      inspectionIds.push(inspectionId);

      await expect(page.getByText('Unable to load this screen.')).toHaveCount(0);
      await expect(page.getByRole('heading', { name: title })).toBeVisible();
      await expect(page.getByText(customerName, { exact: true })).toBeVisible();

      const rows = await admin
        .from('inspections')
        .select('id, tenant_id, lead_id, client_request_id')
        .eq('id', inspectionId);
      if (rows.error) throw rows.error;
      expect(rows.data).toHaveLength(1);
      expect(rows.data[0]).toMatchObject({ tenant_id: TENANT_ID, lead_id: leadId });

      const events = await admin
        .from('inspection_events')
        .select('id, event_type')
        .eq('inspection_id', inspectionId)
        .eq('event_type', 'created');
      if (events.error) throw events.error;
      expect(events.data).toHaveLength(1);
    }

    const lastId = inspectionIds.at(-1);
    await page.goto('/tvg/crm/inspections', { waitUntil: 'domcontentloaded' });
    await page.goto(`/tvg/crm/inspections/${lastId}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: new RegExp(`${runId} 5$`) })).toBeVisible();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: new RegExp(`${runId} 5$`) })).toBeVisible();

    await page.goto('/tvg/crm/inspections', { waitUntil: 'domcontentloaded' });
    await page.goto(`/tvg/crm/inspections/${lastId}`, { waitUntil: 'domcontentloaded' });
    await page.goBack({ waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/tvg\/crm\/inspections$/);
    await page.goForward({ waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(new RegExp(`/tvg/crm/inspections/${lastId}$`));

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/tvg/crm/inspections/${lastId}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Unable to load this screen.')).toHaveCount(0);
  } finally {
    if (inspectionIds.length) await admin.from('inspections').delete().in('id', inspectionIds);
    if (leadId) await admin.from('leads').delete().eq('id', leadId);
    if (userId) await admin.auth.admin.deleteUser(userId);
  }
});
