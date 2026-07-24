/* eslint-disable testing-library/prefer-screen-queries */
/**
 * ML-P1 S8 remediation — mobile field E2E against deployed UI.
 * Requires PLAYWRIGHT_BASE_URL=https://app.bhfos.com and PLAYWRIGHT_NO_WEBSERVER=1
 */
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';
import { createAdminClient, createRunId, insertWithRetry, buildLeadPayload } from './helpers/supabaseAdmin.js';

const TENANT_ID = 'tvg';

const parseEnv = () => {
  const read = (file) => {
    if (!fs.existsSync(file)) return {};
    return Object.fromEntries(
      fs
        .readFileSync(file, 'utf8')
        .split(/\r?\n/)
        .filter((line) => line && !line.startsWith('#') && line.includes('='))
        .map((line) => {
          const i = line.indexOf('=');
          return [line.slice(0, i).trim(), line.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')];
        }),
    );
  };
  return { ...read('.env'), ...read('.env.local') };
};

test.use({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});

test('S8 remediation mobile tech checklist + photo gates on production UI', async ({ page }) => {
  test.setTimeout(240_000);
  const base = process.env.PLAYWRIGHT_BASE_URL || '';
  test.skip(!/app\.bhfos\.com/i.test(base), 'Set PLAYWRIGHT_BASE_URL=https://app.bhfos.com');

  const { client: admin } = createAdminClient();
  const dotenv = parseEnv();
  const anonKey = dotenv.VITE_SUPABASE_ANON_KEY;
  const url = dotenv.VITE_SUPABASE_URL;
  if (!anonKey || !url) throw new Error('Missing anon/url');

  const runId = createRunId('s8mob').replace(/-/g, '').slice(0, 10);
  const email = `s8mob.${runId}@example.invalid`;
  const password = `S8Mob-${runId}-Aa1!`;
  const created = { userId: null, leadId: null, inspectionId: null };

  try {
    const user = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { tenant_id: TENANT_ID, role: 'technician' },
    });
    if (user.error) throw user.error;
    created.userId = user.data.user.id;
    await admin.from('app_user_roles').insert({
      user_id: created.userId,
      role: 'technician',
    });

    const lead = await insertWithRetry(
      admin,
      'leads',
      buildLeadPayload(runId, {
        first_name: 'S8',
        last_name: 'MOBILE',
        email: `s8mob.lead.${runId}@example.invalid`,
        company: 'SYNTHETIC TEST DATA - DO NOT CONTACT',
        address: '100 Mobile Field Rd, Titusville, FL 32780',
      }),
    );
    if (lead.error) throw lead.error;
    created.leadId = lead.data.id;

    const inspection = await insertWithRetry(admin, 'inspections', {
      tenant_id: TENANT_ID,
      lead_id: lead.data.id,
      status: 'draft',
      title: `SYNTH S8-MOBILE ${runId} DO-NOT-CONTACT`,
      work_type: 'general',
      revision: 1,
      created_by_user_id: created.userId,
      service_address: '100 Mobile Field Rd, Titusville, FL 32780',
    });
    if (inspection.error) throw inspection.error;
    created.inspectionId = inspection.data.id;

    // Seed complete evidence so photo step can advance after mark-wave RPC
    const photoId = crypto.randomUUID();
    await admin.from('inspection_photos').insert({
      id: photoId,
      tenant_id: TENANT_ID,
      inspection_id: created.inspectionId,
      bucket_id: 'inspection-photos',
      object_path: `${TENANT_ID}/s8-mob/${runId}.jpg`,
      upload_state: 'complete',
      is_voided: false,
    });

    await page.goto(`${base.replace(/\/$/, '')}/login`, { waitUntil: 'domcontentloaded' });
    // Prefer password form if present
    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    const passInput = page.locator('input[type="password"]').first();
    if (await emailInput.count()) {
      await emailInput.fill(email);
      await passInput.fill(password);
      await page.locator('button[type="submit"], button:has-text("Sign in"), button:has-text("Log in")').first().click();
      await page.waitForTimeout(2000);
    } else {
      // Fallback: inject session via local storage using supabase sign-in in page context
      const signed = await page.evaluate(
        async ({ url: u, anon, em, pw }) => {
          const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
          const c = createClient(u, anon);
          const { data, error } = await c.auth.signInWithPassword({ email: em, password: pw });
          return { error: error?.message || null, session: !!data?.session };
        },
        { url, anon: anonKey, em: email, pw: password },
      );
      expect(signed.session, signed.error || 'session').toBeTruthy();
    }

    await page.goto(`${base.replace(/\/$/, '')}/tvg/tech/inspections/${created.inspectionId}?step=photos`, {
      waitUntil: 'domcontentloaded',
    });
    await expect(page.getByText(/Photo|Uploaded|Capture/i).first()).toBeVisible({ timeout: 30000 });

    // Advance to checklist when control present
    const continueBtn = page.getByRole('button', { name: /continue|checklist|photo wave/i }).first();
    if (await continueBtn.count()) {
      await continueBtn.click();
    } else {
      await page.goto(`${base.replace(/\/$/, '')}/tvg/tech/inspections/${created.inspectionId}?step=checklist`, {
        waitUntil: 'domcontentloaded',
      });
    }

    await expect(page.getByTestId('inspection-checklist-panel')).toBeVisible({ timeout: 30000 });
    await expect(page.getByText(/Photo required/i).first()).toBeVisible();

    // Answer first item On/Pass
    const passBtn = page.getByRole('button', { name: /On \/ Pass/i }).first();
    await passBtn.click();
    await page.waitForTimeout(500);

    // Build-info identity still production tip
    const bi = await page.request.get(`${base.replace(/\/$/, '')}/build-info.json`);
    expect(bi.ok()).toBeTruthy();
    const info = await bi.json();
    expect(info.commitSha).toBe('98cdee15c09ed5511f16cff9ea116cab052c92f8');
    expect(info.migrationVersion).toBe('20260723200000');
  } finally {
    if (created.inspectionId) {
      await admin.from('inspection_photos').update({ is_voided: true }).eq('inspection_id', created.inspectionId);
      await admin.from('inspections').update({ title: `SYNTH S8-MOBILE ${runId} [DONE]` }).eq('id', created.inspectionId);
    }
    if (created.userId) {
      await admin.from('app_user_roles').delete().eq('user_id', created.userId);
      await admin.auth.admin.deleteUser(created.userId);
    }
  }
});
