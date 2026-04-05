import { test, expect } from '@playwright/test';

import { createAdminClient, createRunId } from './helpers/supabaseAdmin.js';

const TENANT_ID = 'tvg';

const isLocalHost = (value) => {
  if (!value) return false;
  try {
    const url = new URL(value);
    return /127\.0\.0\.1|localhost/i.test(url.hostname);
  } catch {
    return /127\.0\.0\.1|localhost/i.test(String(value));
  }
};

const assertLocalSupabaseEnv = (supabaseUrl) => {
  if (!/127\.0\.0\.1|localhost/i.test(supabaseUrl)) {
    test.skip(true, `Refusing to create a local auth user against non-local Supabase URL: ${supabaseUrl || '[missing]'}`);
  }
};

test.describe.serial('UAT LIVE auth/session smoke', () => {
  test('UAT-001 login, refresh, navigation, logout, re-login', async ({ page }) => {
    const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000';
    const runningLocally = isLocalHost(baseURL);

    const { client: admin, env } = createAdminClient();

    let authUserId = null;
    let email = process.env.UAT_EMAIL || '';
    let password = process.env.UAT_PASSWORD || '';

    if (runningLocally) {
      assertLocalSupabaseEnv(env.supabaseUrl);
      const runId = createRunId().replace(/-/g, '').slice(0, 10).toLowerCase();
      email = `uat.live.${runId}@example.com`;
      password = `Uat!${runId}Aa1`;

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
    } else {
      if (!email || !password) {
        test.skip(true, 'Missing UAT_EMAIL/UAT_PASSWORD for non-local PLAYWRIGHT_BASE_URL.');
      }
    }

    try {
      await page.goto(`/${TENANT_ID}/login`, { waitUntil: 'networkidle' });
      await expect(page.getByRole('heading', { name: new RegExp(`sign in to ${TENANT_ID}`, 'i') })).toBeVisible();

      await page.getByLabel('Email').fill(email);
      await page.getByLabel('Password').fill(password);
      await page.getByRole('button', { name: /^sign in$/i }).click();

      await page.waitForURL(new RegExp(`\\/${TENANT_ID}\\/crm(\\/.*)?$`));
      await expect(page.getByText(`${TENANT_ID.toUpperCase()} CRM`)).toBeVisible({ timeout: 15000 });

      await page.reload({ waitUntil: 'networkidle' });
      await expect(page).toHaveURL(new RegExp(`\\/${TENANT_ID}\\/crm(\\/.*)?$`));
      await expect(page.getByText(`${TENANT_ID.toUpperCase()} CRM`)).toBeVisible({ timeout: 15000 });

      await page.goto(`/${TENANT_ID}/crm/jobs`, { waitUntil: 'networkidle' });
      await expect(page).toHaveURL(new RegExp(`\\/${TENANT_ID}\\/crm\\/jobs$`));
      await expect(page.getByRole('heading', { name: 'Work Orders', exact: true })).toBeVisible();

      await page.getByRole('button', { name: /sign out/i }).click();
      await page.waitForURL(new RegExp(`\\/${TENANT_ID}\\/login`));
      await expect(page.getByRole('heading', { name: new RegExp(`sign in to ${TENANT_ID}`, 'i') })).toBeVisible();

      await page.getByLabel('Email').fill(email);
      await page.getByLabel('Password').fill(password);
      await page.getByRole('button', { name: /^sign in$/i }).click();

      await page.waitForURL(new RegExp(`\\/${TENANT_ID}\\/crm(\\/.*)?$`));
      await expect(page.getByText(`${TENANT_ID.toUpperCase()} CRM`)).toBeVisible({ timeout: 15000 });
    } finally {
      if (authUserId) {
        await admin.auth.admin.deleteUser(authUserId);
      }
    }
  });
});

