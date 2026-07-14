/* eslint-disable testing-library/prefer-screen-queries, jest/valid-title */
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';
import {
  buildConditionsFingerprint,
  buildFindingsNarrative,
} from '../../src/lib/inspectionFindingsNarrative.js';
import {
  createAdminClient,
  createRunId,
  insertWithRetry,
  buildLeadPayload,
} from './helpers/supabaseAdmin.js';

const TENANT_ID = 'tvg';

const tinyJpegBuffer = () => {
  // Minimal valid JPEG
  const base64 = '/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBxAQEBAQDxAQDw8QDw8PDw8PDw8QFREWFhURFRUYHSggGBolGxUVITEhJSkrLi4uFx8zODMtNygtLisBCgoKDg0OGxAQGy0lHyUtLSUvLSUvLSUvLSUvLSUvLSUvLSUvLSUvLSUvLSUvLSUvLSUvLSUvLSUvLSUvLSUvLf/AABEIAAEAAQMBIgACEQEDEQH/xAAbAAACAwEBAQAAAAAAAAAAAAAFBgAEBwIDAf/EAD0QAAIBAwMCBAMFBQcBAAAAAAECAwAEEQUSITFBBhMiUWFxMoGRFEJSobHB0fAVYnKS4fEzQ2OCkv/EABkBAAMBAQEAAAAAAAAAAAAAAAABAgMEBf/EACIRAAICAQQCAwEAAAAAAAAAAAABAhEDEiExBBMiQVFhcf/aAAwDAQACEQMRAD8A9oFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAH/9k=';
  return Buffer.from(base64, 'base64');
};

const parseEnv = () => {
  const read = (file) => {
    if (!fs.existsSync(file)) return {};
    return Object.fromEntries(
      fs.readFileSync(file, 'utf8').split(/\r?\n/)
        .filter((line) => line && !line.startsWith('#') && line.includes('='))
        .map((line) => {
          const i = line.indexOf('=');
          return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
        }),
    );
  };
  return { ...read('.env'), ...read('.env.local') };
};

test('fresh Air Duct report generation UAT (new inspection end-to-end)', async ({ page }) => {
  test.setTimeout(240_000);
  const { client: admin, env } = createAdminClient();
  if (!/127\.0\.0\.1|localhost/i.test(env.supabaseUrl)) test.skip(true, 'Local Supabase required.');

  const runId = createRunId('newrpt').replace(/-/g, '').slice(0, 10);
  const email = `newrpt.${runId}@example.com`;
  const password = `NewRpt-${runId}-Aa1!`;
  const dotenv = parseEnv();
  const anonKey = dotenv.VITE_SUPABASE_ANON_KEY || dotenv.SUPABASE_ANON_KEY;
  if (!anonKey) throw new Error('Missing anon key for authenticated RPC/PDF invoke.');

  const created = {
    userId: null,
    leadId: null,
    inspectionId: null,
    photoIds: [],
    objectPaths: [],
    findingIds: [],
    reportPath: null,
  };
  const findingsReport = {
    runId,
    inspectionId: null,
    steps: [],
    preflightBeforeFinalize: null,
    preflightAfter: null,
    finalizeOk: false,
    pdfOk: false,
    pdfChecks: {},
    productGaps: [],
  };

  try {
    const user = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { tenant_id: TENANT_ID, role: 'admin' },
    });
    if (user.error) throw user.error;
    created.userId = user.data.user.id;

    const lead = await insertWithRetry(admin, 'leads', buildLeadPayload(runId, {
      first_name: 'NEW',
      last_name: 'REPORT',
      email: `newrpt.lead.${runId}@example.invalid`,
      company: 'SYNTHETIC TEST DATA - DO NOT CONTACT',
      address: '456 Fresh Report Ave, Titusville, FL 32780',
    }));
    if (lead.error) throw lead.error;
    created.leadId = lead.data.id;

    const inspection = await insertWithRetry(admin, 'inspections', {
      tenant_id: TENANT_ID,
      lead_id: lead.data.id,
      status: 'draft',
      title: `NEW Air Duct Cleaning Inspection ${runId}`,
      inspection_type: 'air_duct',
      revision: 1,
      created_by_user_id: created.userId,
    });
    if (inspection.error) throw inspection.error;
    created.inspectionId = inspection.data.id;
    findingsReport.inspectionId = created.inspectionId;
    findingsReport.steps.push('created_inspection');

    const userClient = createClient(env.supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const signedIn = await userClient.auth.signInWithPassword({ email, password });
    if (signedIn.error) throw signedIn.error;

    // Upload 3 photos: 2 keep, 1 will be voided after pending AI
    for (let i = 0; i < 3; i += 1) {
      const fileName = `newrpt-${runId}-${i + 1}.jpg`;
      const objectPath = `${TENANT_ID}/${created.inspectionId}/${fileName}`;
      const upload = await admin.storage.from('inspection-photos').upload(objectPath, tinyJpegBuffer(), {
        contentType: 'image/jpeg',
        upsert: true,
      });
      if (upload.error) throw upload.error;
      created.objectPaths.push(objectPath);
      const photo = await insertWithRetry(admin, 'inspection_photos', {
        tenant_id: TENANT_ID,
        inspection_id: created.inspectionId,
        file_name: fileName,
        bucket_id: 'inspection-photos',
        object_path: objectPath,
        content_type: 'image/jpeg',
        upload_state: 'complete',
        is_before: true,
        is_voided: false,
        quality_status: 'good',
        caption: i === 0
          ? 'Dust on return grille louvers'
          : i === 1
            ? 'Debris visible on accessible blower area'
            : 'Dark underexposed capture',
        uploaded_by_user_id: created.userId,
      });
      if (photo.error) throw photo.error;
      created.photoIds.push(photo.data.id);
    }
    findingsReport.steps.push('uploaded_three_photos');

    const seedSuggestion = async (photoId, title, description, status = 'pending') => {
      const finding = await insertWithRetry(admin, 'inspection_ai_suggestions', {
        tenant_id: TENANT_ID,
        inspection_id: created.inspectionId,
        inspection_revision: 1,
        photo_id: photoId,
        suggestion_version: 1,
        suggestion_type: 'finding',
        status,
        model: 'local-model',
        prompt_version: 'new-report-uat',
        content: {
          title,
          description,
          customer_caption: title,
          category: 'air_duct',
          severity: 'medium',
          confidence: 'medium',
          recommended_action: 'Complete duct cleaning',
        },
      });
      if (finding.error) throw finding.error;
      const narrative = await insertWithRetry(admin, 'inspection_ai_suggestions', {
        tenant_id: TENANT_ID,
        inspection_id: created.inspectionId,
        inspection_revision: 1,
        photo_id: photoId,
        suggestion_version: 1,
        suggestion_type: 'report_narrative',
        status,
        model: 'local-model',
        prompt_version: 'new-report-uat',
        content: { narrative: description },
      });
      if (narrative.error) throw narrative.error;
      return finding.data;
    };

    await seedSuggestion(
      created.photoIds[0],
      'Return grille dust accumulation',
      'Substantial dust and lint were observed on the return grille louvers.',
    );
    await seedSuggestion(
      created.photoIds[1],
      'Blower area debris',
      'Debris was observed on accessible blower and adjacent metal surfaces.',
    );
    await seedSuggestion(
      created.photoIds[2],
      'Underexposed dark capture',
      'Photo is too dark to assess conditions.',
    );
    findingsReport.steps.push('seeded_ai_suggestions');

    // Accept first two packages as internal conditions
    for (const photoId of created.photoIds.slice(0, 2)) {
      const accept = await userClient.rpc('inspection_review_ai_photo_package', {
        p_tenant_id: TENANT_ID,
        p_photo_id: photoId,
        p_action: 'accept',
        p_reviewed_content: { recommendation: 'Complete duct cleaning' },
        p_internal_only: false,
      });
      if (accept.error) throw accept.error;
      expect(accept.data.customer_visible).toBe(false);
      expect(accept.data.recommendation_id).toBeNull();
      created.findingIds.push(accept.data.finding_id);
    }
    findingsReport.steps.push('accepted_two_internal_conditions');

    // Void third photo while pending — must clear hidden pending AI
    const voided = await userClient.rpc('inspection_void_photo', {
      p_tenant_id: TENANT_ID,
      p_photo_id: created.photoIds[2],
      p_reason: 'Too dark to use',
    });
    if (voided.error) throw voided.error;
    expect(voided.data.is_voided).toBe(true);
    findingsReport.steps.push('voided_dark_photo_with_pending_ai');

    const pendingAfterVoid = await admin
      .from('inspection_ai_suggestions')
      .select('id,status,photo_id')
      .eq('inspection_id', created.inspectionId)
      .eq('status', 'pending');
    expect(pendingAfterVoid.data || []).toHaveLength(0);

    // Build and accept Findings narrative
    const findings = (await admin.from('inspection_findings').select('*').eq('inspection_id', created.inspectionId)).data || [];
    const photos = (await admin.from('inspection_photos').select('*').eq('inspection_id', created.inspectionId)).data || [];
    const suggestions = (await admin.from('inspection_ai_suggestions').select('*').eq('inspection_id', created.inspectionId)).data || [];
    const narrative = buildFindingsNarrative(findings, suggestions, photos);
    const fingerprint = buildConditionsFingerprint(findings, suggestions, photos);
    expect(narrative.length).toBeGreaterThan(20);
    expect(narrative).not.toMatch(/Complete duct cleaning|Chessman|\$/i);

    const narrativeSave = await admin.from('inspections').update({
      summary: narrative,
      summary_status: 'accepted',
      summary_conditions_fingerprint: fingerprint,
      summary_reviewed_at: new Date().toISOString(),
      summary_reviewed_by: created.userId,
    }).eq('id', created.inspectionId);
    if (narrativeSave.error) throw narrativeSave.error;
    findingsReport.steps.push('accepted_findings_narrative');

    // One inspection-level service recommendation (bridge / Phase C shape)
    const rec = await insertWithRetry(admin, 'inspection_recommendations', {
      tenant_id: TENANT_ID,
      inspection_id: created.inspectionId,
      finding_id: null,
      title: 'Total Home Air Restoration',
      description: 'Duct cleaning, air-handler cleaning, coil and blower cleaning, and sanitization of accessible metal AHU components.',
      is_customer_visible: true,
      created_by_user_id: created.userId,
    });
    if (rec.error) throw rec.error;
    findingsReport.steps.push('added_one_inspection_level_recommendation');

    const preflight = await admin.rpc('inspection_finalization_preflight', {
      p_tenant_id: TENANT_ID,
      p_inspection_id: created.inspectionId,
    });
    if (preflight.error) throw preflight.error;
    findingsReport.preflightBeforeFinalize = preflight.data;
    expect(preflight.data || []).toEqual([]);

    if ((await admin.from('inspections').select('status').eq('id', created.inspectionId).single()).data.status === 'draft') {
      const submitted = await userClient.rpc('inspection_submit', {
        p_tenant_id: TENANT_ID,
        p_inspection_id: created.inspectionId,
        p_expected_revision: 1,
        p_validation_snapshot: { source: 'new_report_uat' },
      });
      if (submitted.error) throw submitted.error;
    }

    const finalized = await userClient.rpc('inspection_finalize_phase5', {
      p_tenant_id: TENANT_ID,
      p_inspection_id: created.inspectionId,
      p_expected_revision: 1,
    });
    if (finalized.error) throw finalized.error;
    findingsReport.finalizeOk = true;
    findingsReport.steps.push('finalized_phase5');

    const pdf = await userClient.functions.invoke('inspection-report-pdf', {
      body: {
        tenant_id: TENANT_ID,
        inspection_id: created.inspectionId,
        store: true,
        return_pdf: true,
      },
    });
    if (pdf.error || pdf.data?.error) throw pdf.error || new Error(pdf.data.error);
    expect(pdf.data?.ok || pdf.data?.pdf || pdf.data?.report).toBeTruthy();
    findingsReport.pdfOk = true;
    findingsReport.steps.push('generated_pdf');

    const reportRow = await admin
      .from('inspection_reports')
      .select('*')
      .eq('inspection_id', created.inspectionId)
      .order('generated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    expect(reportRow.data?.file_path).toBeTruthy();
    created.reportPath = reportRow.data.file_path;

    const downloaded = await admin.storage.from('inspection-reports').download(created.reportPath);
    if (downloaded.error) throw downloaded.error;
    const buf = Buffer.from(await downloaded.data.arrayBuffer());
    const outDir = path.join(process.cwd(), 'tmp');
    fs.mkdirSync(outDir, { recursive: true });
    const pdfPath = path.join(outDir, `new-airduct-report-${runId}.pdf`);
    fs.writeFileSync(pdfPath, buf);
    const text = buf.toString('latin1');

    findingsReport.pdfChecks = {
      bytes: buf.length,
      validPdf: buf.slice(0, 4).toString() === '%PDF',
      hasNarrative: /Substantial dust|Return grille|Blower area|documented these conditions/i.test(text),
      hasTotalHome: /Total Home Air Restoration/i.test(text),
      hasChessman: /Chessman/i.test(text),
      hasPerFindingRecommended: /Recommended:/i.test(text),
      hasTechnicianApprovedFindings: /Technician-Approved Findings/i.test(text),
      hasRecommendationsSection: /Recommendations/i.test(text),
      hasEstimateLanguage: /estimate|pricing/i.test(text),
      pdfPath,
    };

    // Product gaps expected until Phase E PDF rewrite
    if (findingsReport.pdfChecks.hasTechnicianApprovedFindings) {
      findingsReport.productGaps.push('PDF still renders Technician-Approved Findings section');
    }
    if (findingsReport.pdfChecks.hasPerFindingRecommended) {
      findingsReport.productGaps.push('PDF still includes per-finding Recommended lines');
    }
    if (!findingsReport.pdfChecks.hasTotalHome) {
      findingsReport.productGaps.push('PDF missing inspection-level Total Home Air Restoration recommendation text');
    }
    if (findingsReport.pdfChecks.hasChessman) {
      findingsReport.productGaps.push('PDF unexpectedly contains Chessman');
    }

    // UI smoke: report tab shows PDF ready on desktop + phone
    await page.goto('/tvg/login', { waitUntil: 'domcontentloaded' });
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await Promise.all([
      page.waitForURL((url) => url.pathname.startsWith('/tvg/') && !url.pathname.endsWith('/login')),
      page.getByRole('button', { name: /^sign in$/i }).click(),
    ]);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/tvg/crm/inspections/${created.inspectionId}`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('tab', { name: 'Report', exact: true }).scrollIntoViewIfNeeded();
    await page.getByRole('tab', { name: 'Report', exact: true }).click();
    await expect(page.getByText(/PDF ready|Current report version/i).first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: /Download PDF/i })).toBeVisible();
    findingsReport.steps.push('verified_mobile_report_tab');

    const preflightAfter = await admin.rpc('inspection_finalization_preflight', {
      p_tenant_id: TENANT_ID,
      p_inspection_id: created.inspectionId,
    });
    findingsReport.preflightAfter = preflightAfter.data;

    console.log('NEW_REPORT_UAT_JSON_START');
    console.log(JSON.stringify(findingsReport, null, 2));
    console.log('NEW_REPORT_UAT_JSON_END');
    console.log(`OPEN_URL=/tvg/crm/inspections/${created.inspectionId}`);

    expect(findingsReport.finalizeOk).toBe(true);
    expect(findingsReport.pdfOk).toBe(true);
    expect(findingsReport.pdfChecks.validPdf).toBe(true);
    expect(findingsReport.pdfChecks.hasChessman).toBe(false);
  } finally {
    // Keep the synthetic inspection for human review. Print IDs above.
    // Cleanup auth password is local-only; leave rows for founder inspection.
  }
});
