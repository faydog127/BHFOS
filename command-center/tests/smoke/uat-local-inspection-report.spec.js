import { test, expect } from '@playwright/test';
import {
  createAdminClient,
  createRunId,
  insertWithRetry,
  buildLeadPayload,
} from './helpers/supabaseAdmin.js';

const TENANT_ID = 'tvg';

const assertLocalSupabaseEnv = (supabaseUrl) => {
  if (!/127\.0\.0\.1|localhost/i.test(supabaseUrl)) {
    test.skip(true, `Refusing to run local inspection UAT against non-local Supabase URL: ${supabaseUrl || '[missing]'}`);
  }
};

const tinyPngBuffer = () => {
  // 1x1 transparent PNG
  const base64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/ax4l0kAAAAASUVORK5CYII=';
  return Buffer.from(base64, 'base64');
};

test.describe.serial('UAT LOCAL inspection/report engine', () => {
  test('create inspection, add finding, upload photo, generate report PDF', async ({ page }) => {
    const runId = createRunId().replace(/-/g, '').slice(0, 10).toLowerCase();
    const { client: admin, env } = createAdminClient();
    assertLocalSupabaseEnv(env.supabaseUrl);

    const email = `inspect.admin.${runId}@example.com`;
    const password = `Inspect!${runId.slice(0, 4).toUpperCase()}Aa1`;

    let authUserId = null;
    let techUserId = null;
    let technicianId = null;
    let leadId = null;
    let inspectionId = null;
    let uploadedObjectPaths = [];

    const short = runId.slice(0, 6).toUpperCase();
    const leadFirst = 'Inspect';
    const leadLast = `Run${short}`;
    const leadEmail = `inspect.lead.${runId}@example.com`;
    const leadLabel = `${leadFirst} ${leadLast}`;
    const technicianName = `Inspect Tech ${short}`;

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

      const { data: createdTechUser, error: createTechUserError } = await admin.auth.admin.createUser({
        email: `inspect.tech.${runId}@example.com`,
        password: `Tech!${runId.slice(0, 4).toUpperCase()}Aa1`,
        email_confirm: true,
        app_metadata: {
          tenant_id: TENANT_ID,
          role: 'technician',
        },
        user_metadata: {
          role: 'technician',
        },
      });
      if (createTechUserError) throw createTechUserError;
      techUserId = createdTechUser?.user?.id || null;

      const techResult = await insertWithRetry(admin, 'technicians', {
        user_id: techUserId,
        full_name: technicianName,
        email: `inspect.tech.${runId}@example.com`,
        is_active: true,
      });
      if (techResult.error) throw techResult.error;
      technicianId = techResult.data.id;

      const leadResult = await insertWithRetry(
        admin,
        'leads',
        buildLeadPayload(runId, {
          first_name: leadFirst,
          last_name: leadLast,
          email: leadEmail,
          address: `123 Inspect Lane ${short}, Titusville, FL 32780`,
        }),
      );
      if (leadResult.error) throw leadResult.error;
      leadId = leadResult.data.id;

      await page.goto('/tvg/login', { waitUntil: 'networkidle' });
      await page.getByLabel('Email').fill(email);
      await page.getByLabel('Password').fill(password);
      await page.getByRole('button', { name: /^sign in$/i }).click();
      await page.waitForURL(/\/tvg\/crm(\/.*)?$/);

      await page.goto('/tvg/crm/inspections', { waitUntil: 'networkidle' });
      await expect(page.getByRole('heading', { name: 'Inspections', exact: true })).toBeVisible();

      await page.getByRole('button', { name: /new inspection/i }).click();
      await page.waitForURL(/\/tvg\/crm\/inspections\/new$/);
      await expect(page.getByRole('heading', { name: /new inspection/i })).toBeVisible({ timeout: 15000 });

      const selects = page.getByRole('combobox');
      await selects.nth(0).click();
      await page.getByRole('option', { name: leadLabel }).first().click();

      await selects.nth(2).click();
      await page.getByRole('option', { name: technicianName }).first().click();

      await page.getByRole('button', { name: /^create$/i }).click();
      await page.waitForURL(/\/tvg\/crm\/inspections\/[0-9a-f-]+$/);

      inspectionId = new URL(page.url()).pathname.split('/').pop();
      expect(inspectionId).toBeTruthy();

      await expect(page.getByRole('heading', { name: /inspection/i })).toBeVisible();

      // Findings
      const findingTitle = `Lint buildup ${short}`;
      await page.getByPlaceholder('e.g. Excess lint buildup in vent line').fill(findingTitle);
      await page.getByRole('button', { name: /add finding/i }).click();
      await expect(page.getByText(findingTitle).first()).toBeVisible({ timeout: 15000 });

      // Photos
      await page.getByRole('tab', { name: 'Photos', exact: true }).click();
      await expect(page.getByText('Upload Photos', { exact: true })).toBeVisible();

      const uploadInput = page.locator('input[type="file"]').first();
      await uploadInput.setInputFiles({
        name: `evidence-${short}.png`,
        mimeType: 'image/png',
        buffer: tinyPngBuffer(),
      });

      // Wait for at least one photo row to render.
      await expect(page.getByText(/photo evidence/i)).toBeVisible();
      await expect(page.getByText(/Preview unavailable/i).or(page.locator('img')).first()).toBeVisible({ timeout: 20000 });

      // Link photo to finding (first photo card).
      const photoEvidencePanel = page.getByRole('heading', { name: 'Photo Evidence', exact: true }).locator('..').locator('..');
      const findingSelect = photoEvidencePanel.locator('[role="combobox"]').first();
      await findingSelect.click();
      await page.getByRole('option', { name: findingTitle }).first().click();

      // Report
      await page.getByRole('tab', { name: 'Report', exact: true }).click();
      const pdfResponsePromise = page.waitForResponse((res) =>
        res.url().includes('/functions/v1/inspection-report-pdf') && res.request().method() === 'POST',
      );
      await page.getByRole('button', { name: /download pdf/i }).click();
      const pdfResponse = await pdfResponsePromise;
      expect(pdfResponse.status()).toBe(200);
      const pdfJson = await pdfResponse.json();
      expect(Boolean(pdfJson?.ok)).toBeTruthy();
      expect(String(pdfJson?.meta?.inspection_id || '')).toBe(inspectionId);

      // Capture uploaded object paths for cleanup.
      const { data: photoRows } = await admin
        .from('inspection_photos')
        .select('object_path')
        .eq('tenant_id', TENANT_ID)
        .eq('inspection_id', inspectionId);
      uploadedObjectPaths = (photoRows || []).map((row) => row.object_path).filter(Boolean);
    } finally {
      if (inspectionId) {
        await admin.from('inspection_photos').delete().eq('inspection_id', inspectionId);
        await admin.from('inspection_recommendations').delete().eq('inspection_id', inspectionId);
        await admin.from('inspection_findings').delete().eq('inspection_id', inspectionId);
        await admin.from('inspections').delete().eq('id', inspectionId);
      }

      if (uploadedObjectPaths.length) {
        try {
          await admin.storage.from('inspection-photos').remove(uploadedObjectPaths);
        } catch {
          // Non-blocking cleanup.
        }
      }

      if (leadId) {
        await admin.from('leads').delete().eq('id', leadId);
      }

      if (technicianId) {
        await admin.from('technicians').delete().eq('id', technicianId);
      }

      if (techUserId) {
        await admin.auth.admin.deleteUser(techUserId);
      }

      if (authUserId) {
        await admin.auth.admin.deleteUser(authUserId);
      }
    }
  });
});
