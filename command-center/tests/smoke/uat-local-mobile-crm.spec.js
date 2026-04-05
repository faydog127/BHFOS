import { test, expect } from '@playwright/test';

import {
  createAdminClient,
  createRunId,
  insertWithRetry,
  buildLeadPayload,
  buildQuotePayload,
} from './helpers/supabaseAdmin.js';

test.use({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});

const TENANT_ID = 'tvg';

const assertLocalSupabaseEnv = (supabaseUrl) => {
  if (!/127\.0\.0\.1|localhost/i.test(supabaseUrl)) {
    throw new Error(`Refusing to run local mobile UAT against non-local Supabase URL: ${supabaseUrl || '[missing]'}`);
  }
};

test.describe.serial('UAT LOCAL mobile CRM shell', () => {
  test('mobile shell, estimates, and invoices are usable', async ({ page }) => {
    const runId = createRunId().replace(/-/g, '').slice(0, 8).toLowerCase();
    const { client: admin, env } = createAdminClient();
    assertLocalSupabaseEnv(env.supabaseUrl);

    const email = `mobile.admin.${runId}@example.com`;
    const password = `Mobile!${runId}Aa1`;

    let authUserId = null;
    let leadId = null;
    let quoteId = null;
    let quoteNumber = null;

    try {
      const { data: createdUser, error: createUserError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        app_metadata: {
          tenant_id: TENANT_ID,
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
          first_name: 'Mobile',
          last_name: `Shell${runId.slice(0, 4)}`,
          email: `mobile.lead.${runId}@example.com`,
          phone: '3215554400',
          address: '930 Alabama St, Titusville, FL 32796',
        }),
      );
      if (leadResult.error) throw leadResult.error;
      leadId = leadResult.data.id;

      const quoteResult = await insertWithRetry(
        admin,
        'quotes',
        buildQuotePayload(leadId, runId, {
          status: 'draft',
          service_address: '930 Alabama St, Titusville, FL 32796',
        }),
      );
      if (quoteResult.error) throw quoteResult.error;
      quoteId = quoteResult.data.id;
      quoteNumber = String(quoteResult.data.quote_number || '').trim();

      await page.goto('/tvg/login', { waitUntil: 'networkidle' });
      await expect(page.getByRole('heading', { name: /sign in to tvg/i })).toBeVisible();

      await page.getByLabel('Email').fill(email);
      await page.getByLabel('Password').fill(password);
      await page.getByRole('button', { name: /^sign in$/i }).click();

      await page.waitForURL(/\/tvg\/crm(\/.*)?$/);
      const mobileNav = page.locator('nav').last();
      await expect(mobileNav.locator(`a[href='/${TENANT_ID}/crm/estimates']`)).toBeVisible();
      await expect(mobileNav.locator(`a[href='/${TENANT_ID}/crm/invoices']`)).toBeVisible();

      await mobileNav.locator(`a[href='/${TENANT_ID}/crm/estimates']`).click();
      await page.waitForURL(/\/tvg\/crm\/estimates$/);
      await expect(page.getByRole('heading', { name: 'Estimates', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: `#${quoteNumber}` }).first()).toBeVisible({ timeout: 15000 });

      await page.getByRole('button', { name: /new estimate/i }).click();
      await page.waitForURL(/\/tvg\/crm\/estimates\/new$/);
      // Estimates route currently reuses the quote builder UI.
      await expect(page.getByRole('heading', { name: 'New Quote', exact: true })).toBeVisible();
      await page.getByRole('button', { name: /add item/i }).click();
      await expect(page.getByText('Item 1', { exact: true })).toBeVisible();
      await expect(page.getByText('Select from Price Book', { exact: true }).first()).toBeVisible();

      await page.locator('nav').last().locator(`a[href='/${TENANT_ID}/crm/invoices']`).click();
      await page.waitForURL(/\/tvg\/crm\/invoices$/);
      await expect(page.getByRole('heading', { name: 'Invoices', exact: true })).toBeVisible();

      await page.getByRole('button', { name: /create invoice/i }).click();
      await page.waitForURL(/\/tvg\/crm\/invoices\/new$/);
      await expect(page.getByRole('heading', { name: 'New Invoice', exact: true })).toBeVisible();
      await page.getByRole('button', { name: /add item/i }).click();
      await expect(page.getByText('Item 1', { exact: true })).toBeVisible();
      await expect(page.getByText('Line Total', { exact: true })).toBeVisible();
    } finally {
      if (quoteId) {
        await admin.from('quote_items').delete().eq('quote_id', quoteId);
        await admin.from('quotes').delete().eq('id', quoteId);
      }

      if (leadId) {
        await admin.from('leads').delete().eq('id', leadId);
      }

      if (authUserId) {
        await admin.auth.admin.deleteUser(authUserId);
      }
    }
  });
});
