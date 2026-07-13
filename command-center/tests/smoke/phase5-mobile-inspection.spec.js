/* eslint-disable testing-library/prefer-screen-queries, jest/valid-title */
import { test, expect } from '@playwright/test';
import { createAdminClient, createRunId, insertWithRetry, buildLeadPayload } from './helpers/supabaseAdmin.js';

const TENANT_ID = 'tvg';

test('quality check identifies dark, glare, low-detail, and duplicate evidence', async ({ page }) => {
  await page.goto('/src/lib/inspectionPhotoQuality.js', { waitUntil: 'domcontentloaded' });
  const results = await page.evaluate(async () => {
    const { assessInspectionPhotoQuality } = await import('/src/lib/inspectionPhotoQuality.js');
    const makeFile = (name, color) => {
      const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 100;
      const context = canvas.getContext('2d'); context.fillStyle = color; context.fillRect(0, 0, 100, 100);
      return new Promise((resolve) => canvas.toBlob((blob) => resolve(new File([blob], name, { type: 'image/jpeg' })), 'image/jpeg', 0.9));
    };
    const dark = await assessInspectionPhotoQuality(await makeFile('dark.jpg', '#050505'));
    const glare = await assessInspectionPhotoQuality(await makeFile('glare.jpg', '#ffffff'));
    const duplicate = await assessInspectionPhotoQuality(await makeFile('duplicate.jpg', '#050505'), [dark.metrics.normalized_hash]);
    return { dark, glare, duplicate };
  });
  expect(results.dark.warnings.join(' ')).toMatch(/dark|low visible detail|blurry/i);
  expect(results.glare.warnings.join(' ')).toMatch(/glare|overexposure|low visible detail|blurry/i);
  expect(results.duplicate.warnings.join(' ')).toContain('exact duplicate');
});

test('mobile capture and one-decision review share the Phase 5 contract', async ({ page }) => {
  test.setTimeout(120_000);
  const { client: admin, env } = createAdminClient();
  if (!/127\.0\.0\.1|localhost/i.test(env.supabaseUrl)) test.skip(true, 'Local Supabase required.');
  const runId = createRunId('phase5').replace(/-/g, '').slice(0, 10);
  const email = `phase5.${runId}@example.com`;
  const password = `Phase5-${runId}-Aa1!`;
  const created = { userId: null, leadId: null, inspectionId: null, photoIds: [] };

  try {
    const user = await admin.auth.admin.createUser({ email, password, email_confirm: true, app_metadata: { tenant_id: TENANT_ID, role: 'admin' } });
    if (user.error) throw user.error;
    created.userId = user.data.user.id;
    const lead = await insertWithRetry(admin, 'leads', buildLeadPayload(runId, { first_name: 'MOBILE', last_name: 'CAPTURE', email: `capture.${runId}@example.com` }));
    if (lead.error) throw lead.error;
    created.leadId = lead.data.id;
    const inspection = await insertWithRetry(admin, 'inspections', {
      tenant_id: TENANT_ID, lead_id: lead.data.id, status: 'draft', title: `MOBILE CAPTURE ${runId}`, inspection_type: 'dryer_vent',
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
    await page.getByRole('tab', { name: 'Photos', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Take Before Photo' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Take After Photo' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

    const lowDetailJpeg = await page.evaluate(() => {
      const canvas = document.createElement('canvas'); canvas.width = 80; canvas.height = 80;
      const context = canvas.getContext('2d'); context.fillStyle = '#080808'; context.fillRect(0, 0, 80, 80);
      return canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
    });
    page.once('dialog', (dialog) => dialog.accept());
    await page.locator('input[capture="environment"]').first().setInputFiles({
      name: 'mobile-before.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(lowDetailJpeg, 'base64'),
    });
    await expect.poll(async () => {
      const result = await admin.from('inspection_photos').select('*').eq('inspection_id', created.inspectionId).eq('file_name', 'mobile-before.jpg');
      if (result.error) throw result.error;
      if (result.data?.[0]?.id) created.photoIds = [result.data[0].id];
      return result.data?.[0]?.upload_state;
    }).toBe('complete');
    const photo = await admin.from('inspection_photos').select('*').eq('id', created.photoIds[0]).single();
    expect(photo.data.is_before).toBe(true);
    expect(photo.data.quality_status).toBe('kept_with_warning');
    expect(photo.data.quality_warnings.length).toBeGreaterThan(0);

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('tab', { name: 'Photos', exact: true }).click();
    const batchControl = page.getByText('Batch assignment', { exact: true }).locator('..').getByRole('combobox');
    await expect(batchControl).toBeVisible();
    await batchControl.click();
    await page.getByRole('option', { name: 'After', exact: true }).click();
    const afterJpeg = await page.evaluate(() => {
      const canvas = document.createElement('canvas'); canvas.width = 80; canvas.height = 80;
      const context = canvas.getContext('2d'); context.fillStyle = '#181818'; context.fillRect(0, 0, 80, 80);
      return canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
    });
    page.once('dialog', (dialog) => dialog.accept());
    await page.locator('input[type="file"]:not([capture])').setInputFiles({ name: 'desktop-after.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(afterJpeg, 'base64') });
    await expect.poll(async () => {
      const result = await admin.from('inspection_photos').select('id,is_before,upload_state').eq('inspection_id', created.inspectionId).eq('file_name', 'desktop-after.jpg');
      if (result.data?.[0]?.id && !created.photoIds.includes(result.data[0].id)) created.photoIds.push(result.data[0].id);
      return result.data?.[0]?.upload_state === 'complete' ? result.data[0].is_before : null;
    }).toBe(false);

    await admin.from('inspection_ai_suggestions').insert([
      { tenant_id: TENANT_ID, inspection_id: created.inspectionId, inspection_revision: 1, photo_id: created.photoIds[0], suggestion_version: 1, suggestion_type: 'finding', status: 'pending', model: 'local-model', prompt_version: 'v2', content: { title: 'Moderate lint accumulation', description: 'Moderate lint accumulation is visible inside the duct.', customer_caption: 'Lint visible along the lower duct surface.', category: 'dryer_vent', severity: 'medium', confidence: 'medium', uncertainty: 'Image quality is limited.', evidence_usability: 'limited', recommended_action: 'Complete dryer vent cleaning' } },
      { tenant_id: TENANT_ID, inspection_id: created.inspectionId, inspection_revision: 1, photo_id: created.photoIds[0], suggestion_version: 1, suggestion_type: 'report_narrative', status: 'pending', model: 'local-model', prompt_version: 'v2', content: { narrative: 'Moderate lint accumulation was documented.' } },
    ]);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('tab', { name: 'Photos', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Accept', exact: true })).toHaveCount(1);
    await page.getByRole('button', { name: 'Accept', exact: true }).click();
    await expect.poll(async () => {
      const result = await admin.from('inspection_ai_suggestions').select('status').eq('inspection_id', created.inspectionId);
      return result.data?.map((row) => row.status).sort().join(',');
    }).toBe('accepted,accepted');
    const finding = await admin.from('inspection_findings').select('*').eq('inspection_id', created.inspectionId).single();
    const recommendation = await admin.from('inspection_recommendations').select('*').eq('inspection_id', created.inspectionId).single();
    const updatedPhoto = await admin.from('inspection_photos').select('caption').eq('id', created.photoIds[0]).single();
    expect(finding.data.is_customer_visible).toBe(true);
    expect(finding.data.title).toBe('Moderate lint accumulation');
    expect(updatedPhoto.data.caption).toBe('Lint visible along the lower duct surface.');
    expect(recommendation.data.title).toBe('Complete dryer vent cleaning');
  } finally {
    if (created.inspectionId) await admin.from('inspections').delete().eq('id', created.inspectionId);
    if (created.leadId) await admin.from('leads').delete().eq('id', created.leadId);
    if (created.userId) await admin.auth.admin.deleteUser(created.userId);
  }
});
