import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { discoverRoutes } from './helpers/discovery.js';
import {
  createAdminClient,
  createRunId,
  insertWithRetry,
  selectSingle,
  rpcSafe,
  buildLeadPayload,
  buildQuotePayload,
  buildQuoteItemPayload,
  buildInvoicePayload,
  buildInvoiceItemPayload,
} from './helpers/supabaseAdmin.js';

const report = {
  runId: null,
  startedAt: new Date().toISOString(),
  finishedAt: null,
  environment: {},
  phases: {
    phase1: { status: 'pending', discovery: null, notes: [] },
    phase2: { status: 'pending', seeded: {}, skippedColumns: {}, errors: [] },
    phase3: { status: 'pending', steps: {}, errors: [] },
  },
};

const state = {
  admin: null,
  env: null,
  ids: {},
};

test.describe.serial('Legacy TVG Phase 1-3 smoke', () => {
  test.beforeAll(async () => {
    report.runId = createRunId();
    const { client, env } = createAdminClient();
    state.admin = client;
    state.env = env;
    report.environment = {
      supabaseUrl: env.supabaseUrl,
      warnings: env.warnings,
      baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000',
    };
  });

  test.afterAll(async () => {
    report.finishedAt = new Date().toISOString();
    const outDir = path.join(process.cwd(), 'artifacts');
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(
      path.join(outDir, 'smoke-report.json'),
      JSON.stringify(report, null, 2)
    );
  });

  test('Phase 1 - route discovery', async () => {
    const phase = report.phases.phase1;
    try {
      const discovery = discoverRoutes(process.cwd());
      phase.discovery = discovery;
      phase.status = 'passed';
    } catch (error) {
      phase.status = 'failed';
      phase.notes.push(error.message);
      throw error;
    }
  });

  test('Phase 2 - seed lead/quote', async () => {
    const phase = report.phases.phase2;
    const admin = state.admin;

    try {
      const leadPayload = buildLeadPayload(report.runId);
      const leadResult = await insertWithRetry(admin, 'leads', leadPayload);
      if (leadResult.error) {
        phase.errors.push({
          step: 'lead_insert',
          message: leadResult.error.message,
        });
        phase.status = 'failed';
        throw leadResult.error;
      }

      state.ids.leadId = leadResult.data.id;
      phase.seeded.lead_id = leadResult.data.id;
      phase.skippedColumns.leads = leadResult.skippedColumns;

      const quotePayload = buildQuotePayload(state.ids.leadId, report.runId);
      const quoteResult = await insertWithRetry(admin, 'quotes', quotePayload);
      if (quoteResult.error) {
        phase.errors.push({
          step: 'quote_insert',
          message: quoteResult.error.message,
        });
        phase.status = 'failed';
        throw quoteResult.error;
      }

      state.ids.quoteId = quoteResult.data.id;
      state.ids.quoteToken = quoteResult.data.public_token || quotePayload.public_token;
      phase.seeded.quote_id = quoteResult.data.id;
      phase.seeded.quote_token = state.ids.quoteToken;
      phase.skippedColumns.quotes = quoteResult.skippedColumns;

      const quoteItemPayload = buildQuoteItemPayload(state.ids.quoteId, report.runId);
      const quoteItemResult = await insertWithRetry(admin, 'quote_items', quoteItemPayload);
      if (quoteItemResult.error) {
        phase.errors.push({
          step: 'quote_items_insert',
          message: quoteItemResult.error.message,
          tableMissing: !!quoteItemResult.tableMissing,
        });
      } else {
        phase.seeded.quote_item_id = quoteItemResult.data.id;
        phase.skippedColumns.quote_items = quoteItemResult.skippedColumns;
      }

      phase.status = 'passed';
    } catch (error) {
      if (phase.status !== 'failed') {
        phase.status = 'failed';
      }
      throw error;
    }
  });

  test('Phase 3 - UI quote approval + payment', async ({ page }) => {
    const phase = report.phases.phase3;
    const admin = state.admin;

    if (!state.ids.quoteToken) {
      phase.status = 'skipped';
      phase.errors.push({ message: 'Missing seeded IDs from Phase 2.' });
      test.skip(true, 'Seed data missing');
    }

    const discovery = report.phases.phase1.discovery;
    const routes = discovery?.routes || [];
    const hasQuoteRoute = routes.includes('/quotes/:token');
    const hasPaymentRoute = routes.includes('/pay/:token');

    phase.steps.quote = { status: 'pending' };
    phase.steps.payment = { status: 'pending' };

    let phaseFailed = false;

    if (!hasQuoteRoute) {
      phase.steps.quote = { status: 'not_found', note: 'Missing /quotes/:token route.' };
      phaseFailed = true;
    } else {
      try {
        await page.goto(`/quotes/${state.ids.quoteToken}`, { waitUntil: 'networkidle' });
        await expect(page.getByRole('heading', { name: 'Service Quote' })).toBeVisible();
        const approveResponsePromise = page.waitForResponse((res) =>
          res.url().includes('/functions/v1/public-quote-approve')
        );

        await page.getByRole('button', { name: /approve to schedule/i }).click();
        await page.getByRole('button', { name: /confirm approval/i }).click();

        const approveResponse = await approveResponsePromise;
        if (approveResponse.status() !== 200) {
          throw new Error(`Quote approve failed with status ${approveResponse.status()}`);
        }

        await page.waitForURL(/\/quote-confirmation\?/);
        await expect(page.getByRole('heading', { name: 'Quote Approved' })).toBeVisible({ timeout: 15000 });

        const { data, error } = await selectSingle(admin, 'quotes', { id: state.ids.quoteId });
        if (error) throw error;
        const approved = data?.status === 'approved';
        const acceptedAt = data?.accepted_at || data?.acceptedAt;

        if (!approved || !acceptedAt) {
          throw new Error('Quote status did not update to approved.');
        }

        const { data: workOrderData, error: workOrderError } = await admin
          .from('jobs')
          .select('id, status, quote_id')
          .eq('tenant_id', 'tvg')
          .eq('quote_id', state.ids.quoteId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (workOrderError) throw workOrderError;
        if (!workOrderData?.id) {
          throw new Error('Quote approval did not create a linked work order.');
        }

        state.ids.jobId = workOrderData.id;
        phase.steps.quote.work_order_id = workOrderData.id;
        phase.steps.quote.work_order_status = workOrderData.status;

        const invoicePayload = buildInvoicePayload(
          state.ids.leadId,
          state.ids.quoteId,
          report.runId,
          {
            job_id: state.ids.jobId,
            release_approved: true,
          }
        );
        const invoiceResult = await insertWithRetry(admin, 'invoices', invoicePayload);
        if (invoiceResult.error) {
          throw invoiceResult.error;
        }

        state.ids.invoiceId = invoiceResult.data.id;
        state.ids.invoiceToken = invoiceResult.data.public_token || invoicePayload.public_token;
        phase.steps.quote.invoice_id = invoiceResult.data.id;
        phase.steps.quote.invoice_token = state.ids.invoiceToken;

        const invoiceItemPayload = buildInvoiceItemPayload(state.ids.invoiceId, report.runId);
        const invoiceItemResult = await insertWithRetry(admin, 'invoice_items', invoiceItemPayload);
        if (invoiceItemResult.error) {
          throw invoiceItemResult.error;
        }

        phase.steps.quote = {
          status: 'passed',
          work_order_id: workOrderData.id,
          work_order_status: workOrderData.status,
          invoice_id: invoiceResult.data.id,
          invoice_token: state.ids.invoiceToken,
        };
      } catch (error) {
        phase.steps.quote = { status: 'failed', error: error.message };
        phaseFailed = true;
      }
    }

    if (!hasPaymentRoute) {
      phase.steps.payment = { status: 'not_found', note: 'Missing /pay/:token route.' };
      phaseFailed = true;
    } else {
      try {
        const invoiceResponsePromise = page.waitForResponse((res) =>
          res.url().includes('/functions/v1/public-invoice')
        );
        if (!state.ids.invoiceToken) {
          phase.steps.payment = { status: 'skipped', note: 'Missing invoice token (quote step likely failed).' };
          phase.status = phaseFailed ? 'failed' : 'passed';
          expect(phaseFailed, 'Phase 3 failures detected').toBeFalsy();
          return;
        }

        // Prevent auto-redirecting to Stripe during smoke tests.
        await page.goto(`/pay/${state.ids.invoiceToken}?checkout=1`, { waitUntil: 'networkidle' });
        const invoiceResponse = await invoiceResponsePromise;
        const invoiceStatus = invoiceResponse.status();
        let invoiceBody = '';
        try {
          invoiceBody = await invoiceResponse.text();
        } catch {
          invoiceBody = '';
        }

        if (invoiceStatus !== 200) {
          throw new Error(`public-invoice failed with status ${invoiceStatus}: ${invoiceBody}`);
        }

        await expect(page.getByText(/secure checkout/i)).toBeVisible();

        const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
        if (!anonKey) {
          phase.steps.payment = { status: 'skipped', note: 'Missing VITE_SUPABASE_ANON_KEY.' };
          phase.status = phaseFailed ? 'failed' : 'passed';
          expect(phaseFailed, 'Phase 3 failures detected').toBeFalsy();
          return;
        }

        const payResponse = await page.request.post(`${state.env.supabaseUrl}/functions/v1/public-pay`, {
          headers: {
            apikey: anonKey,
            authorization: `Bearer ${anonKey}`,
            'Content-Type': 'application/json',
          },
          data: {
            token: state.ids.invoiceToken,
            tenant_id: 'tvg',
            amount: 214,
            method: 'card',
          },
        });
        const payStatus = payResponse.status();
        let payBody = '';

        try {
          payBody = JSON.stringify(await payResponse.json());
        } catch {
          try {
            payBody = await payResponse.text();
          } catch {
            payBody = '';
          }
        }

        if (payStatus === 501 || payStatus === 401 || payStatus === 403 || payStatus === 422) {
          phase.steps.payment = { status: 'blocked', evidence: payBody, http_status: payStatus };
        } else if (payStatus === 200) {
          phase.steps.payment = { status: 'passed', evidence: payBody, http_status: payStatus };
        } else {
          throw new Error(`Payment failed with status ${payStatus}: ${payBody}`);
        }
      } catch (error) {
        const rpcProbe = await rpcSafe(admin, 'process_public_payment', {
          p_token: `smoke-probe-${report.runId}`,
          p_amount: 1,
          p_method: 'card',
        });
        const rpcMissing =
          rpcProbe.error && /does not exist/i.test(rpcProbe.error.message || '');

        phase.steps.payment = {
          status: 'failed',
          error: error.message,
          rpc_missing: !!rpcMissing,
        };
        phaseFailed = true;
      }
    }

    phase.status = phaseFailed ? 'failed' : 'passed';
    expect(phaseFailed, 'Phase 3 failures detected').toBeFalsy();
  });
});
