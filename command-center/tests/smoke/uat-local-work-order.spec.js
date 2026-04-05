import { test, expect } from '@playwright/test';
import {
  createAdminClient,
  createRunId,
  insertWithRetry,
  selectSingle,
  buildLeadPayload,
  buildQuotePayload,
  buildQuoteItemPayload,
} from './helpers/supabaseAdmin.js';

const assertLocalSupabaseEnv = (supabaseUrl) => {
  if (!/127\.0\.0\.1|localhost/i.test(supabaseUrl)) {
    test.skip(true, `Refusing to run local work-order UAT against non-local Supabase URL: ${supabaseUrl || '[missing]'}`);
  }
};

test.describe.serial('UAT LOCAL work-order flow smoke', () => {
  test('UAT-002 through UAT-005', async ({ page }) => {
    const runId = createRunId();
    const { client: admin, env } = createAdminClient();
    assertLocalSupabaseEnv(env.supabaseUrl);

    const shortId = runId.slice(0, 8).toUpperCase();
    const leadFirstName = 'UAT';
    const leadLastName = shortId;
    const leadEmail = `uat.${runId}@example.com`;
    const serviceAddress = `123 UAT Lane ${shortId}, Titusville, FL 32780`;

    const email = `uat.admin.${runId}@example.com`;
    const password = `Uat!${shortId}Aa1`;
    let authUserId = null;

    try {
      const { data: createdUser, error: createUserError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        app_metadata: {
          tenant_id: 'tvg',
          role: 'admin',
        },
        user_metadata: {
          role: 'admin',
        },
      });
      if (createUserError) throw createUserError;
      authUserId = createdUser?.user?.id || null;

    const leadResult = await insertWithRetry(
      admin,
      'leads',
      buildLeadPayload(runId, {
        first_name: leadFirstName,
        last_name: leadLastName,
        email: leadEmail,
        address: serviceAddress,
      }),
    );
    if (leadResult.error) throw leadResult.error;
    const leadId = leadResult.data.id;

    const quoteResult = await insertWithRetry(
      admin,
      'quotes',
      buildQuotePayload(leadId, runId, {
        service_address: serviceAddress,
      }),
    );
    if (quoteResult.error) throw quoteResult.error;
    const quoteId = quoteResult.data.id;
    const quoteToken = quoteResult.data.public_token;

    const quoteItemResult = await insertWithRetry(
      admin,
      'quote_items',
      buildQuoteItemPayload(quoteId, runId, {
        description: `UAT Service ${shortId}`,
      }),
    );
    if (quoteItemResult.error) throw quoteItemResult.error;

    await page.goto(`/quotes/${quoteToken}`, { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'Service Quote' })).toBeVisible();
    const approveResponsePromise = page.waitForResponse((res) =>
      res.url().includes('/functions/v1/public-quote-approve'),
    );
    await page.getByRole('button', { name: /approve to schedule/i }).click();
    await page.getByRole('button', { name: /confirm approval/i }).click();
    const approveResponse = await approveResponsePromise;
    expect(approveResponse.status()).toBe(200);
    await page.waitForURL(/\/quote-confirmation\?/);
    await expect(page.getByRole('heading', { name: 'Quote Approved' })).toBeVisible({ timeout: 15000 });

    const quoteRow = await selectSingle(admin, 'quotes', { id: quoteId });
    expect(quoteRow.error).toBeNull();
    expect(String(quoteRow.data?.status || '').toLowerCase()).toBe('approved');

    const { data: workOrderData, error: workOrderError } = await admin
      .from('jobs')
      .select('id, status, scheduled_start, scheduled_end, service_address, technician_id')
      .eq('tenant_id', 'tvg')
      .eq('quote_id', quoteId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (workOrderError) throw workOrderError;
    expect(workOrderData?.id).toBeTruthy();
    const jobId = workOrderData.id;
    expect(String(workOrderData.status || '').toLowerCase()).toContain('unscheduled');

    await page.goto('/tvg/login', { waitUntil: 'networkidle' });
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: /^sign in$/i }).click();
    await page.waitForURL(/\/tvg\/crm(\/.*)?$/);

    await page.goto('/tvg/crm/jobs', { waitUntil: 'networkidle' });
    const row = page.getByRole('row').filter({ hasText: `${leadFirstName} ${leadLastName}` }).first();
    await expect(row).toBeVisible({ timeout: 15000 });
    await row.getByRole('button', { name: /^schedule$/i }).click();

    const scheduleDialog = page.getByRole('dialog');
    await expect(scheduleDialog.getByText(/schedule work order/i)).toBeVisible();
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const pad = (n) => String(n).padStart(2, '0');
    const scheduleStart = `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}T09:00`;
    await scheduleDialog.locator('input[type="datetime-local"]').fill(scheduleStart);
    await scheduleDialog.locator('input[type="number"]').fill('120');
    await scheduleDialog.getByPlaceholder('Street, City, State ZIP').fill(serviceAddress);

    const { data: techniciansData, error: techniciansError } = await admin
      .from('technicians')
      .select('id, full_name')
      .eq('is_active', true)
      .order('full_name', { ascending: true })
      .limit(1);
    if (techniciansError) throw techniciansError;

    if ((techniciansData || []).length > 0) {
      const technicianName = techniciansData[0].full_name;
      await scheduleDialog.getByRole('combobox').click();
      await page.getByRole('option', { name: technicianName }).first().click();
    }

    await scheduleDialog.getByRole('button', { name: /confirm schedule/i }).click();

    await expect
      .poll(async () => {
        const { data, error } = await admin
          .from('jobs')
          .select('status')
          .eq('id', jobId)
          .maybeSingle();
        if (error) throw error;
        return String(data?.status || '').toLowerCase();
      }, { timeout: 15000 })
      .toBe('scheduled');

    const { data: scheduledWorkOrderRow, error: scheduledWorkOrderError } = await admin
      .from('jobs')
      .select('id, status, scheduled_start, scheduled_end, service_address, technician_id')
      .eq('id', jobId)
      .maybeSingle();
    if (scheduledWorkOrderError) throw scheduledWorkOrderError;
    expect(String(scheduledWorkOrderRow?.status || '').toLowerCase()).toBe('scheduled');
    expect(scheduledWorkOrderRow?.scheduled_start).toBeTruthy();
    expect(String(scheduledWorkOrderRow?.service_address || '')).toContain(`123 UAT Lane ${shortId}`);

    await page.reload({ waitUntil: 'networkidle' });
    const scheduledRow = page.getByRole('row').filter({ hasText: `${leadFirstName} ${leadLastName}` }).first();
    await expect(scheduledRow).toBeVisible({ timeout: 15000 });
    await scheduledRow.getByRole('button', { name: /^start$/i }).click();
    await expect
      .poll(async () => {
        const { data, error } = await admin
          .from('jobs')
          .select('status')
          .eq('id', jobId)
          .maybeSingle();
        if (error) throw error;
        return String(data?.status || '').toLowerCase();
      }, { timeout: 15000 })
      .toBe('in_progress');

    const activeRow = page.getByRole('row').filter({ hasText: `${leadFirstName} ${leadLastName}` }).first();
    await activeRow.getByRole('button', { name: /complete/i }).click();
    await expect
      .poll(async () => {
        const { data, error } = await admin
          .from('jobs')
          .select('status')
          .eq('id', jobId)
          .maybeSingle();
        if (error) throw error;
        return String(data?.status || '').toLowerCase();
      }, { timeout: 15000 })
      .toBe('completed');

    const { data: completedWorkOrder, error: completedWorkOrderError } = await admin
      .from('jobs')
      .select('id, status, scheduled_start, service_address, technician_id, total_amount')
      .eq('id', jobId)
      .maybeSingle();
    if (completedWorkOrderError) throw completedWorkOrderError;
    expect(String(completedWorkOrder?.status || '').toLowerCase()).toBe('completed');
    expect(completedWorkOrder?.scheduled_start).toBeTruthy();
    expect(String(completedWorkOrder?.service_address || '')).toContain(`123 UAT Lane ${shortId}`);

    await expect
      .poll(async () => {
        const { data, error } = await admin
          .from('invoices')
          .select('status')
          .eq('tenant_id', 'tvg')
          .eq('job_id', jobId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (error) throw error;
        return String(data?.status || '').toLowerCase();
      }, { timeout: 15000 })
      .toBe('draft');

    const { data: draftInvoiceRow, error: draftInvoiceError } = await admin
      .from('invoices')
      .select('id, status, public_token, release_approved, job_id')
      .eq('tenant_id', 'tvg')
      .eq('job_id', jobId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (draftInvoiceError) throw draftInvoiceError;
    expect(String(draftInvoiceRow?.status || '').toLowerCase()).toBe('draft');

    await page.goto(`/tvg/crm/invoices/${draftInvoiceRow.id}`, { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: /invoice/i })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/work order status/i)).toBeVisible();
    await page.getByLabel(/partner approval recorded/i).click();

    await page.getByRole('button', { name: /save & send/i }).click();

    await expect
      .poll(async () => {
        const { data, error } = await admin
          .from('invoices')
          .select('status')
          .eq('tenant_id', 'tvg')
          .eq('job_id', jobId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (error) throw error;
        return String(data?.status || '').toLowerCase();
      }, { timeout: 30000 })
      .toBe('sent');

    const { data: invoiceRows, error: invoiceRowsError } = await admin
      .from('invoices')
      .select('id, status, public_token, release_approved, job_id')
      .eq('tenant_id', 'tvg')
      .eq('job_id', jobId)
      .order('created_at', { ascending: false })
      .limit(1);
    if (invoiceRowsError) throw invoiceRowsError;

    expect((invoiceRows || []).length).toBeGreaterThan(0);
    expect(String(invoiceRows[0].status || '').toLowerCase()).toBe('sent');
    expect(Boolean(invoiceRows[0].release_approved)).toBeTruthy();
    expect(invoiceRows[0].public_token).toBeTruthy();
    } finally {
      if (authUserId) {
        await admin.auth.admin.deleteUser(authUserId);
      }
    }
  });
});
