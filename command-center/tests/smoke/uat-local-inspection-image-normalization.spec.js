/* eslint-disable testing-library/prefer-screen-queries, jest/valid-title */
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import {
  createAdminClient,
  createRunId,
  insertWithRetry,
  buildLeadPayload,
} from './helpers/supabaseAdmin.js';

const TENANT_ID = 'tvg';
const FIXTURE_DIR = path.join(process.cwd(), 'tests', 'fixtures', 'inspection');
const IPHONE_HEIC = path.join(FIXTURE_DIR, 'iphone-12-portrait.heic');
const LANDSCAPE_HEIC = path.join(FIXTURE_DIR, 'landscape.heic');
const ORIENTED_JPEG = path.join(FIXTURE_DIR, 'exif-landscape-6.jpg');
const SAMPLE_DIR = path.join(process.cwd(), 'artifacts', 'inspection-phase2a');
const SAMPLE_PDF = path.join(SAMPLE_DIR, 'inspection-iphone-heic-sample.pdf');
const FUNCTION_PDF = path.join(SAMPLE_DIR, 'inspection-function-iphone-heic-sample.pdf');

const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAGElEQVR42mP4z8DAwMDAxMDAwMDAwAAAHgABfL4W9QAAAABJRU5ErkJggg==',
  'base64',
);

const assertLocalSupabaseEnv = (supabaseUrl) => {
  if (!/127\.0\.0\.1|localhost/i.test(supabaseUrl)) {
    test.skip(true, `Refusing to run image UAT against non-local Supabase: ${supabaseUrl || '[missing]'}`);
  }
};

const signIn = async (page, email, password) => {
  await page.goto('/tvg/login', { waitUntil: 'networkidle' });
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: /^sign in$/i }).click();
  await page.waitForURL((url) => url.pathname.startsWith('/tvg/') && !url.pathname.endsWith('/login'));
};

const clearBrowserSession = async (page) => {
  await page.goto('/tvg/login');
  await page.evaluate(async () => {
    localStorage.clear();
    sessionStorage.clear();
    await new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase('bhfos-tech');
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      request.onblocked = () => resolve();
    });
  });
};

const browserGeneratedImage = async (page, type) => {
  const base64 = await page.evaluate((mimeType) => {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 48;
    const context = canvas.getContext('2d');
    context.fillStyle = '#123b67';
    context.fillRect(0, 0, 64, 48);
    context.fillStyle = '#ffffff';
    context.fillRect(8, 8, 24, 20);
    return canvas.toDataURL(mimeType, 0.9).split(',')[1];
  }, type);
  return Buffer.from(base64, 'base64');
};

const normalizeInBrowser = async (page, { bytes, name, type }) => page.evaluate(
  async ({ base64, fileName, mimeType }) => {
    const { normalizeInspectionImageFile } = await import('/src/lib/imageCompression.js');
    const binary = atob(base64);
    const data = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) data[index] = binary.charCodeAt(index);
    const result = await Promise.race([
      normalizeInspectionImageFile(
        new File([data], fileName, { type: mimeType }),
        { maxDimension: 1800, targetMaxBytes: 850_000 },
      ),
      new Promise((_, reject) => setTimeout(() => reject(new Error(`Normalization timed out: ${fileName}`)), 30_000)),
    ]);
    const signature = Array.from(new Uint8Array(await result.blob.slice(0, 3).arrayBuffer()));
    return {
      width: result.width,
      height: result.height,
      mimeType: result.mimeType,
      normalizedBytes: result.normalizedBytes,
      wasHeic: result.wasHeic,
      signature,
    };
  },
  { base64: bytes.toString('base64'), fileName: name, mimeType: type },
);

const waitForPhoto = async (admin, inspectionId, fileName, expectedState = 'complete') => {
  let rows = [];
  await expect.poll(async () => {
    const result = await admin
      .from('inspection_photos')
      .select('*')
      .eq('tenant_id', TENANT_ID)
      .eq('inspection_id', inspectionId)
      .eq('file_name', fileName);
    if (result.error) throw result.error;
    rows = result.data || [];
    return `${rows.length}:${rows[0]?.upload_state || ''}`;
  }, { timeout: 45_000 }).toBe(`1:${expectedState}`);
  return rows[0];
};

test.describe.serial('Phase 2A inspection image normalization', () => {
  test('normalizes HEIC, JPEG, PNG, and WebP and rejects invalid inputs', async ({ page }) => {
    // Use a stable same-origin module page; the CRM login route may redirect while
    // large HEIC fixtures are being decoded and destroy the evaluation context.
    await page.goto('/src/lib/imageCompression.js');
    const jpeg = await browserGeneratedImage(page, 'image/jpeg');
    const png = await browserGeneratedImage(page, 'image/png');
    const webp = await browserGeneratedImage(page, 'image/webp');
    const iphoneHeic = fs.readFileSync(IPHONE_HEIC);
    const landscapeHeic = fs.readFileSync(LANDSCAPE_HEIC);
    const orientedJpeg = fs.readFileSync(ORIENTED_JPEG);

    const cases = [
      { bytes: iphoneHeic, name: 'iphone-12.heic', type: 'image/heic', heic: true, orientation: 'portrait' },
      { bytes: iphoneHeic, name: 'iphone-12.heif', type: 'image/heif', heic: true, orientation: 'portrait' },
      { bytes: landscapeHeic, name: 'landscape.heic', type: 'image/heic', heic: true, orientation: 'landscape' },
      { bytes: jpeg, name: 'evidence.jpg', type: 'image/jpeg', heic: false, orientation: 'landscape' },
      { bytes: png, name: 'evidence.png', type: 'image/png', heic: false, orientation: 'landscape' },
      { bytes: webp, name: 'evidence.webp', type: 'image/webp', heic: false, orientation: 'landscape' },
    ];

    for (const fixture of cases) {
      const normalized = await normalizeInBrowser(page, fixture);
      expect(normalized.mimeType).toBe('image/jpeg');
      expect(normalized.signature.slice(0, 2)).toEqual([0xff, 0xd8]);
      expect(Math.max(normalized.width, normalized.height)).toBeLessThanOrEqual(1800);
      expect(normalized.normalizedBytes).toBeGreaterThan(0);
      expect(normalized.normalizedBytes).toBeLessThanOrEqual(1_050_000);
      expect(normalized.wasHeic).toBe(fixture.heic);
      const normalizedOrientation = normalized.width > normalized.height ? 'landscape' : 'portrait';
      expect(normalizedOrientation).toBe(fixture.orientation);
    }

    const oriented = await normalizeInBrowser(page, {
      bytes: orientedJpeg,
      name: 'landscape-orientation-6.jpg',
      type: 'image/jpeg',
    });
    expect(oriented.width).toBeGreaterThan(oriented.height);
    expect(Math.max(oriented.width, oriented.height)).toBeLessThanOrEqual(1800);

    const invalidResults = await page.evaluate(async () => {
      const { normalizeInspectionImageFile } = await import('/src/lib/imageCompression.js');
      const capture = async (file) => {
        try {
          await normalizeInspectionImageFile(file);
          return '';
        } catch (error) {
          return error?.message || String(error);
        }
      };
      return {
        unsupported: await capture(new File(['not an image'], 'evidence.gif', { type: 'image/gif' })),
        mismatched: await capture(new File(['not an image'], 'evidence.jpg', { type: 'image/png' })),
        oversized: await capture(new File([new Uint8Array((30 * 1024 * 1024) + 1)], 'large.jpg', { type: 'image/jpeg' })),
      };
    });
    expect(invalidResults.unsupported).toContain('Unsupported image type');
    expect(invalidResults.mismatched).toContain('does not match its filename');
    expect(invalidResults.oversized).toContain('Image is too large');
  });

  test('desktop and technician flows recover retries and render private normalized JPEGs in a PDF', async ({ page, request }) => {
    page.on('dialog', (dialog) => dialog.accept());
    const { client: admin, env } = createAdminClient();
    assertLocalSupabaseEnv(env.supabaseUrl);
    const runId = createRunId().replace(/-/g, '').slice(0, 10).toLowerCase();
    const adminEmail = `phase2a.admin.${runId}@example.com`;
    const adminPassword = `Phase2A!${runId.slice(0, 4).toUpperCase()}Aa1`;
    const techEmail = `phase2a.tech.${runId}@example.com`;
    const techPassword = `Phase2T!${runId.slice(0, 4).toUpperCase()}Aa1`;
    const created = { userIds: [], technicianId: null, leadId: null, inspectionId: null, paths: [] };

    try {
      const adminUser = await admin.auth.admin.createUser({
        email: adminEmail,
        password: adminPassword,
        email_confirm: true,
        app_metadata: { tenant_id: TENANT_ID, role: 'admin' },
      });
      if (adminUser.error) throw adminUser.error;
      created.userIds.push(adminUser.data.user.id);

      const techUser = await admin.auth.admin.createUser({
        email: techEmail,
        password: techPassword,
        email_confirm: true,
        app_metadata: { tenant_id: TENANT_ID, role: 'technician' },
      });
      if (techUser.error) throw techUser.error;
      created.userIds.push(techUser.data.user.id);

      const tech = await insertWithRetry(admin, 'technicians', {
        user_id: techUser.data.user.id,
        full_name: `Phase 2A Technician ${runId}`,
        email: techEmail,
        is_active: true,
      });
      if (tech.error) throw tech.error;
      created.technicianId = tech.data.id;

      const lead = await insertWithRetry(admin, 'leads', buildLeadPayload(runId, {
        first_name: 'INTERNAL',
        last_name: 'IMAGE TEST',
        email: `phase2a.lead.${runId}@example.com`,
        address: '100 INTERNAL TEST WAY, Titusville, FL 32780',
      }));
      if (lead.error) throw lead.error;
      created.leadId = lead.data.id;

      const inspection = await insertWithRetry(admin, 'inspections', {
        tenant_id: TENANT_ID,
        lead_id: lead.data.id,
        technician_id: tech.data.id,
        created_by_user_id: adminUser.data.user.id,
        status: 'draft',
        title: `INTERNAL PHASE 2A IMAGE TEST ${runId}`,
        service_address: '100 INTERNAL TEST WAY, Titusville, FL 32780',
        summary: 'Local-only normalized image verification.',
      });
      if (inspection.error) throw inspection.error;
      created.inspectionId = inspection.data.id;

      await signIn(page, adminEmail, adminPassword);
      await page.goto(`/tvg/crm/inspections/${created.inspectionId}`, { waitUntil: 'networkidle' });
      await page.getByRole('tab', { name: 'Photos', exact: true }).click();
      const desktopInput = page.locator('input[type="file"][multiple]');

      // An interrupted storage request leaves a recoverable IndexedDB item and one evidence row.
      let interrupted = false;
      await page.route('**/storage/v1/object/inspection-photos/**', async (route) => {
        if (!interrupted && route.request().method() === 'POST') {
          interrupted = true;
          await route.abort('connectionreset');
          return;
        }
        await route.continue();
      });
      await desktopInput.setInputFiles({ name: 'interrupted.png', mimeType: 'image/png', buffer: tinyPng });
      await expect(page.getByText(/failed to fetch|image normalization or upload failed/i).first()).toBeVisible({ timeout: 30_000 });
      await page.unroute('**/storage/v1/object/inspection-photos/**');
      await page.reload({ waitUntil: 'networkidle' });
      await page.getByRole('tab', { name: 'Photos', exact: true }).click();
      await page.getByRole('button', { name: /retry pending uploads/i }).click();
      await waitForPhoto(admin, created.inspectionId, 'interrupted.png');
      await expect(desktopInput).toBeEnabled();

      // Simulate a browser interruption after object upload but before metadata finalization.
      let metadataFailure = false;
      await page.route('**/rest/v1/inspection_photos**', async (route) => {
        const requestBody = route.request().postData() || '';
        if (!metadataFailure && route.request().method() === 'PATCH' && requestBody.includes('"upload_state":"complete"')) {
          metadataFailure = true;
          await route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"simulated metadata interruption"}' });
          return;
        }
        await route.continue();
      });
      await desktopInput.setInputFiles({ name: 'duplicate-retry.png', mimeType: 'image/png', buffer: tinyPng });
      await expect(page.getByText(/simulated metadata interruption/i).first()).toBeVisible({ timeout: 30_000 });
      const failedMetadataRow = await waitForPhoto(admin, created.inspectionId, 'duplicate-retry.png', 'failed');
      const uploadedBeforeRetry = await admin.storage.from('inspection-photos').download(failedMetadataRow.object_path);
      expect(uploadedBeforeRetry.error).toBeNull();
      expect(uploadedBeforeRetry.data?.size || 0).toBeGreaterThan(0);
      await page.unroute('**/rest/v1/inspection_photos**');
      await page.getByRole('button', { name: /retry pending uploads/i }).click();
      const retriedMetadataRow = await waitForPhoto(admin, created.inspectionId, 'duplicate-retry.png');
      expect(retriedMetadataRow.id).toBe(failedMetadataRow.id);
      expect(retriedMetadataRow.object_path).toBe(failedMetadataRow.object_path);

      const jpeg = await browserGeneratedImage(page, 'image/jpeg');
      const png = await browserGeneratedImage(page, 'image/png');
      const webp = await browserGeneratedImage(page, 'image/webp');
      await desktopInput.setInputFiles([
        { name: 'desktop-iphone.heic', mimeType: 'image/heic', buffer: fs.readFileSync(IPHONE_HEIC) },
        { name: 'desktop.jpg', mimeType: 'image/jpeg', buffer: jpeg },
        { name: 'desktop.png', mimeType: 'image/png', buffer: png },
        { name: 'desktop.webp', mimeType: 'image/webp', buffer: webp },
      ]);
      await Promise.all([
        waitForPhoto(admin, created.inspectionId, 'desktop-iphone.heic'),
        waitForPhoto(admin, created.inspectionId, 'desktop.jpg'),
        waitForPhoto(admin, created.inspectionId, 'desktop.png'),
        waitForPhoto(admin, created.inspectionId, 'desktop.webp'),
      ]);

      await clearBrowserSession(page);
      await page.setViewportSize({ width: 390, height: 844 });
      await signIn(page, techEmail, techPassword);
      await page.goto(`/tvg/tech/inspections/${created.inspectionId}`, { waitUntil: 'networkidle' });
      await page.locator('input[type="file"]').setInputFiles({
        name: 'mobile-landscape.heic',
        mimeType: 'image/heic',
        buffer: fs.readFileSync(LANDSCAPE_HEIC),
      });
      await waitForPhoto(admin, created.inspectionId, 'mobile-landscape.heic');

      const rowsResult = await admin
        .from('inspection_photos')
        .select('*')
        .eq('tenant_id', TENANT_ID)
        .eq('inspection_id', created.inspectionId)
        .order('uploaded_at');
      if (rowsResult.error) throw rowsResult.error;
      const rows = rowsResult.data || [];
      expect(rows).toHaveLength(7);
      expect(rows.every((row) => row.upload_state === 'complete')).toBeTruthy();
      expect(rows.every((row) => row.content_type === 'image/jpeg')).toBeTruthy();
      expect(rows.every((row) => row.object_path.endsWith('.jpg'))).toBeTruthy();
      expect(new Set(rows.map((row) => row.object_path)).size).toBe(rows.length);
      created.paths = rows.map((row) => row.object_path);

      const approvedFinding = await insertWithRetry(admin, 'inspection_findings', {
        tenant_id: TENANT_ID,
        inspection_id: created.inspectionId,
        title: 'Approved synthetic photo finding',
        category: 'dryer_vent',
        severity: 'medium',
        description: 'Synthetic evidence used for local image validation.',
        recommended_action: 'Review normalized evidence.',
        is_customer_visible: true,
      });
      if (approvedFinding.error) throw approvedFinding.error;
      const linkPhotos = await admin.from('inspection_photos').update({ finding_id: approvedFinding.data.id })
        .eq('tenant_id', TENANT_ID).eq('inspection_id', created.inspectionId);
      if (linkPhotos.error) throw linkPhotos.error;

      for (const row of rows) {
        const download = await admin.storage.from('inspection-photos').download(row.object_path);
        if (download.error) throw download.error;
        const signature = new Uint8Array(await download.data.slice(0, 2).arrayBuffer());
        expect(Array.from(signature)).toEqual([0xff, 0xd8]);
        expect(download.data.size).toBeGreaterThan(0);
        expect(download.data.size).toBeLessThanOrEqual(1_050_000);

        const publicUrl = admin.storage.from('inspection-photos').getPublicUrl(row.object_path).data.publicUrl;
        const publicResponse = await request.get(publicUrl);
        expect(publicResponse.ok()).toBeFalsy();
      }

      await admin
        .from('inspection_photos')
        .update({ caption: 'Normalized iPhone inspection evidence' })
        .eq('tenant_id', TENANT_ID)
        .eq('inspection_id', created.inspectionId)
        .in('file_name', ['desktop-iphone.heic', 'mobile-landscape.heic']);

      const filenameIndependentPhoto = rows.find((row) => row.file_name === 'desktop-iphone.heic');
      const clearFilename = await admin
        .from('inspection_photos')
        .update({ file_name: null, caption: 'Normalized portrait inspection evidence' })
        .eq('tenant_id', TENANT_ID)
        .eq('inspection_id', created.inspectionId)
        .eq('id', filenameIndependentPhoto.id);
      if (clearFilename.error) throw clearFilename.error;

      await page.goto(`/tvg/crm/inspections/${created.inspectionId}/report`, { waitUntil: 'networkidle' });
      await expect(page.getByRole('heading', { name: 'Photo evidence', exact: true })).toBeVisible();
      const reportImages = page.locator('figure img');
      await expect(reportImages).toHaveCount(rows.length);
      await expect.poll(async () => reportImages.evaluateAll((images) => (
        images.every((image) => image.complete && image.naturalWidth > 0 && image.naturalHeight > 0)
      ))).toBeTruthy();

      await page.evaluate(() => {
        const report = document.querySelector('article.inspection-report');
        if (!report) throw new Error('Inspection report article not found.');
        document.body.replaceChildren(report);
        document.body.style.background = '#ffffff';
        document.body.style.margin = '0';
        report.style.maxWidth = 'none';
      });
      fs.mkdirSync(SAMPLE_DIR, { recursive: true });
      const pdf = await page.pdf({
        path: SAMPLE_PDF,
        format: 'Letter',
        printBackground: true,
        scale: 0.9,
      });
      expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
      expect(pdf.length).toBeGreaterThan(50_000);
      expect(fs.statSync(SAMPLE_PDF).size).toBe(pdf.length);

      expect(await reportImages.count()).toBe(rows.length);

      const functionResult = await page.evaluate(async ({ inspectionId }) => {
        const { supabase } = await import('/src/lib/customSupabaseClient.js');
        const { data, error } = await supabase.functions.invoke('inspection-report-pdf', {
          body: { tenant_id: 'tvg', inspection_id: inspectionId, store: false, return_pdf: true },
        });
        return { data, error: error ? { message: error.message } : null };
      }, { inspectionId: created.inspectionId });
      expect(functionResult.error).toBeNull();
      expect(functionResult.data?.ok).toBeTruthy();
      expect(functionResult.data?.meta?.photos_count).toBe(rows.length);
      expect(functionResult.data?.meta?.renderer_used).toBe('local_pdf');
      const functionPdf = Buffer.from(functionResult.data.pdf.content, 'base64');
      expect(functionPdf.subarray(0, 4).toString()).toBe('%PDF');
      const functionPdfSource = functionPdf.toString('latin1');
      expect(functionPdfSource).toMatch(/\/Count [2-9]\d*/);
      expect(functionPdfSource.match(/\/Subtype \/Image/g)).toHaveLength(rows.length);
      fs.writeFileSync(FUNCTION_PDF, functionPdf);
      expect(fs.statSync(FUNCTION_PDF).size).toBe(functionPdf.length);

      const pendingRow = rows.find((row) => row.file_name === 'interrupted.png');
      const markPending = await admin
        .from('inspection_photos')
        .update({ upload_state: 'pending', storage_error: null })
        .eq('tenant_id', TENANT_ID)
        .eq('inspection_id', created.inspectionId)
        .eq('id', pendingRow.id);
      if (markPending.error) throw markPending.error;

      const submitted = await admin.rpc('inspection_submit', {
        p_tenant_id: TENANT_ID,
        p_inspection_id: created.inspectionId,
        p_expected_revision: inspection.data.revision || 1,
        p_validation_snapshot: { source: 'phase2a_pending_upload_test' },
      });
      if (submitted.error) throw submitted.error;
      const completion = await admin.rpc('inspection_complete', {
        p_tenant_id: TENANT_ID,
        p_inspection_id: created.inspectionId,
        p_expected_revision: submitted.data.revision || 1,
        p_qa_snapshot: { source: 'phase2a_pending_upload_test' },
      });
      expect(completion.error?.message || '').toContain('Upload unresolved');
    } finally {
      if (created.paths.length) await admin.storage.from('inspection-photos').remove(created.paths).catch(() => null);
      if (created.inspectionId) {
        await admin.from('inspection_photos').delete().eq('inspection_id', created.inspectionId);
        await admin.from('inspection_recommendations').delete().eq('inspection_id', created.inspectionId);
        await admin.from('inspection_findings').delete().eq('inspection_id', created.inspectionId);
        await admin.from('inspections').delete().eq('id', created.inspectionId);
      }
      if (created.leadId) await admin.from('leads').delete().eq('id', created.leadId);
      if (created.technicianId) await admin.from('technicians').delete().eq('id', created.technicianId);
      for (const userId of created.userIds.reverse()) await admin.auth.admin.deleteUser(userId);
    }
  });
});
