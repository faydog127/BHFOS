/* eslint-disable testing-library/prefer-screen-queries, jest/valid-title */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import {
  buildPreflightBlockerModel,
  listLocalEvidenceIssues,
  mergePreflightIssues,
} from '../../src/lib/inspectionPreflightBlockers.js';
import {
  buildFindingsNarrative,
  listApprovedConditions,
} from '../../src/lib/inspectionFindingsNarrative.js';
import { createAdminClient, createRunId, insertWithRetry, buildLeadPayload } from './helpers/supabaseAdmin.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const TENANT_ID = 'tvg';

const readAnonKey = () => {
  const envPath = path.join(process.cwd(), '.env.local');
  const fallbackPath = path.join(process.cwd(), '.env');
  const raw = [envPath, fallbackPath]
    .filter((candidate) => fs.existsSync(candidate))
    .map((candidate) => fs.readFileSync(candidate, 'utf8'))
    .join('\n');
  const entries = {};
  raw.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) return;
    const eq = trimmed.indexOf('=');
    entries[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  });
  return process.env.VITE_SUPABASE_ANON_KEY
    || process.env.SUPABASE_ANON_KEY
    || entries.VITE_SUPABASE_ANON_KEY
    || entries.SUPABASE_ANON_KEY
    || '';
};

const signIn = async (page, email, password) => {
  await page.goto('/tvg/login', { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: /^sign in$/i }).click();
  await page.waitForURL((url) => url.pathname.startsWith('/tvg/') && !url.pathname.endsWith('/login'));
};

test('AI Keep/Edit/Remove controls stay available after review (source contract)', async () => {
  const aiPanel = fs.readFileSync(
    path.join(here, '../../src/components/tech/InspectionAiReviewPanel.jsx'),
    'utf8',
  );
  const review = fs.readFileSync(
    path.join(here, '../../src/pages/tech/TechInspectionReview.jsx'),
    'utf8',
  );
  const manual = fs.readFileSync(
    path.join(here, '../../src/components/tech/ManualConditionReviewControls.jsx'),
    'utf8',
  );

  // Defect 1 root cause was pending-only gating. Decision controls must key off findingSuggestion.
  expect(aiPanel).toContain('findingSuggestion && !locked');
  expect(aiPanel).toContain('data-testid="finding-remove"');
  expect(aiPanel).toContain('data-testid="finding-keep"');
  expect(aiPanel).toContain('data-testid="finding-edit"');
  expect(aiPanel).not.toMatch(/\{pending \?\s*\([\s\S]*finding-remove/);

  // Manual path always renders Remove; after Keep/Edit (approved) it stays enabled.
  expect(manual).toContain('data-testid="manual-finding-remove"');
  expect(manual).toContain("disabled={locked || Boolean(busy) || status === 'rejected' || status === 'not_relevant'}");

  // Quiet reload + durable highlight contract for blocker UX.
  expect(review).toContain("load({ quiet: true })");
  expect(review).toContain('holdFindingHighlight');
  expect(review).toContain('data-highlighted={highlighted ? \'true\' : \'false\'}');
  expect(review).toContain('data-testid={`finding-needs-photo-${finding.id}`}');
  expect(review).toContain('listLocalEvidenceIssues');
  expect(review).toContain('aria-label={label}');
});

test('local evidence issues warn and highlight immediately without RPC', async () => {
  const findings = [
    { id: 'kept-no-photo', condition_status: 'approved', source_ai_suggestion_id: null, is_customer_visible: false, title: 'Lint' },
    { id: 'kept-with-photo', condition_status: 'approved', source_ai_suggestion_id: null, is_customer_visible: false, title: 'Dust' },
    { id: 'draft', condition_status: 'draft', source_ai_suggestion_id: null, is_customer_visible: false, title: 'Draft' },
    { id: 'removed', condition_status: 'rejected', source_ai_suggestion_id: null, is_customer_visible: false, title: 'Removed' },
  ];
  const photos = [
    { id: 'p1', finding_id: 'kept-with-photo', is_voided: false, upload_state: 'complete' },
  ];

  const local = listLocalEvidenceIssues(findings, photos);
  expect(local).toEqual([
    {
      code: 'FINDING_WITHOUT_EVIDENCE',
      finding_id: 'kept-no-photo',
      message: 'This finding needs a photo.',
    },
  ]);

  const merged = mergePreflightIssues(local, [
    { code: 'FINDING_WITHOUT_EVIDENCE', finding_id: 'kept-no-photo', message: 'duplicate from rpc' },
    { code: 'SUMMARY_REQUIRED', message: 'Review the Findings summary' },
  ]);
  expect(merged.filter((issue) => issue.code === 'FINDING_WITHOUT_EVIDENCE')).toHaveLength(1);

  const model = buildPreflightBlockerModel(local, { findings, photos, recommendations: [], aiSuggestions: [] });
  expect(model.highlights.findingIds).toEqual(['kept-no-photo']);
  expect(model.groups[0].actionLabel).toBe('Add or select photo');
  expect(model.groups[0].findingIds).toEqual(['kept-no-photo']);
  expect(model.groups[0].step).toBe('findings');
  expect(model.groups[0].target).toBe('findings');
});

test('Remove after Keep/Edit excludes narrative and preserves finding + audit', async ({ page }) => {
  test.setTimeout(180_000);
  const { client: admin, env } = createAdminClient();
  if (!/127\.0\.0\.1|localhost/i.test(env.supabaseUrl)) {
    test.skip(true, 'Local Supabase required.');
  }

  const runId = createRunId('rmvis').replace(/-/g, '').slice(0, 10);
  const email = `rmvis.${runId}@example.com`;
  const password = `RmVis-${runId}-Aa1!`;
  const created = {
    userId: null,
    leadId: null,
    inspectionId: null,
    photoId: null,
    suggestionId: null,
    findingId: null,
    manualId: null,
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

    const lead = await insertWithRetry(
      admin,
      'leads',
      buildLeadPayload(runId, { first_name: 'RM', last_name: 'VIS', email }),
    );
    if (lead.error) throw lead.error;
    created.leadId = lead.data.id;

    const inspection = await insertWithRetry(admin, 'inspections', {
      tenant_id: TENANT_ID,
      lead_id: lead.data.id,
      status: 'draft',
      title: `REMOVE VIS ${runId}`,
      inspection_type: 'dryer_vent',
      revision: 1,
      summary_status: 'draft',
    });
    if (inspection.error) throw inspection.error;
    created.inspectionId = inspection.data.id;

    const photo = await insertWithRetry(admin, 'inspection_photos', {
      tenant_id: TENANT_ID,
      inspection_id: created.inspectionId,
      file_name: `rmvis-${runId}.jpg`,
      bucket_id: 'inspection-photos',
      object_path: `${TENANT_ID}/${created.inspectionId}/rmvis-${runId}.jpg`,
      content_type: 'image/jpeg',
      upload_state: 'complete',
      is_before: true,
      is_voided: false,
      uploaded_by_user_id: created.userId,
    });
    if (photo.error) throw photo.error;
    created.photoId = photo.data.id;

    const suggestion = await insertWithRetry(admin, 'inspection_ai_suggestions', {
      tenant_id: TENANT_ID,
      inspection_id: created.inspectionId,
      inspection_revision: 1,
      photo_id: created.photoId,
      suggestion_version: 1,
      suggestion_type: 'finding',
      status: 'pending',
      model: 'local-model',
      prompt_version: 'remove-visibility',
      content: {
        title: 'Lint buildup',
        description: 'Lint buildup was observed at the dryer connection',
        customer_caption: 'Lint at dryer connection',
        recommended_action: 'Complete dryer vent cleaning',
      },
    });
    if (suggestion.error) throw suggestion.error;
    created.suggestionId = suggestion.data.id;

    const anonKey = readAnonKey();
    if (!anonKey) throw new Error('Missing VITE_SUPABASE_ANON_KEY for authenticated RPC.');
    const authed = createClient(env.supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const signedIn = await authed.auth.signInWithPassword({ email, password });
    if (signedIn.error) throw signedIn.error;

    await signIn(page, email, password);
    await page.goto(`/tvg/tech/inspections/${created.inspectionId}/review?step=findings`, {
      waitUntil: 'domcontentloaded',
    });
    // Remove available on pending item.
    await expect(page.getByTestId('finding-remove')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('finding-keep')).toBeVisible();
    await expect(page.getByTestId('finding-edit')).toBeVisible();

    // Pending → Keep: Remove path must remain available afterward.
    const keep = await authed.rpc('inspection_review_ai_photo_package', {
      p_tenant_id: TENANT_ID,
      p_photo_id: created.photoId,
      p_action: 'accept',
      p_reviewed_content: { recommendation: 'Complete dryer vent cleaning' },
      p_internal_only: true,
    });
    if (keep.error) throw keep.error;

    let suggestions = (await admin.from('inspection_ai_suggestions').select('*').eq('id', created.suggestionId)).data;
    expect(suggestions[0].status).toBe('accepted');
    let findings = (await admin.from('inspection_findings').select('*').eq('inspection_id', created.inspectionId)).data;
    const aiFinding = findings.find((row) => row.source_ai_suggestion_id === created.suggestionId);
    expect(aiFinding).toBeTruthy();
    created.findingId = aiFinding.id;
    expect(listApprovedConditions(findings, suggestions).some((row) => row.id === created.findingId)).toBe(true);

    // Remove available after Keep + navigation/reload.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('finding-remove')).toBeVisible({ timeout: 20_000 });

    // Edit path still leaves a removable accepted/edited suggestion.
    const edit = await authed.rpc('inspection_review_ai_photo_package', {
      p_tenant_id: TENANT_ID,
      p_photo_id: created.photoId,
      p_action: 'edit',
      p_reviewed_content: {
        title: 'Lint buildup',
        description: 'Edited lint observation at the dryer connection',
        customer_caption: 'Edited lint caption',
        recommendation: 'Complete dryer vent cleaning',
      },
      p_internal_only: true,
    });
    if (edit.error) throw edit.error;
    suggestions = (await admin.from('inspection_ai_suggestions').select('*').eq('id', created.suggestionId)).data;
    expect(suggestions[0].status).toBe('edited');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('finding-remove')).toBeVisible({ timeout: 20_000 });

    // Remove after Keep/Edit.
    const remove = await authed.rpc('inspection_review_ai_photo_package', {
      p_tenant_id: TENANT_ID,
      p_photo_id: created.photoId,
      p_action: 'reject',
      p_reviewed_content: {},
      p_internal_only: true,
    });
    if (remove.error) throw remove.error;

    suggestions = (await admin.from('inspection_ai_suggestions').select('*').eq('inspection_id', created.inspectionId)).data;
    findings = (await admin.from('inspection_findings').select('*').eq('inspection_id', created.inspectionId)).data;
    const photos = (await admin.from('inspection_photos').select('*').eq('id', created.photoId)).data;
    const events = (await admin.from('inspection_events')
      .select('*')
      .eq('inspection_id', created.inspectionId)
      .eq('event_type', 'ai_photo_package_reject')).data;

    expect(suggestions.find((row) => row.id === created.suggestionId)?.status).toBe('rejected');
    expect(findings.find((row) => row.id === created.findingId)).toBeTruthy();
    expect(photos[0]).toBeTruthy();
    expect(listApprovedConditions(findings, suggestions).some((row) => row.id === created.findingId)).toBe(false);
    expect(buildFindingsNarrative(findings, suggestions, photos)).not.toMatch(/Edited lint observation/i);
    expect(events?.length || 0).toBeGreaterThan(0);

    // Manual Keep → Remove stays a valid decision path and excludes narrative.
    const manual = await insertWithRetry(admin, 'inspection_findings', {
      tenant_id: TENANT_ID,
      inspection_id: created.inspectionId,
      title: 'Manual soot',
      description: 'Soot residue was observed near the termination',
      is_customer_visible: false,
      source_ai_suggestion_id: null,
      condition_status: 'draft',
      created_by_user_id: created.userId,
    });
    if (manual.error) throw manual.error;
    created.manualId = manual.data.id;

    await admin.from('inspection_findings').update({ condition_status: 'approved' }).eq('id', created.manualId);
    findings = (await admin.from('inspection_findings').select('*').eq('inspection_id', created.inspectionId)).data;
    expect(listApprovedConditions(findings, suggestions).some((row) => row.id === created.manualId)).toBe(true);

    await admin.from('inspection_findings').update({ condition_status: 'rejected' }).eq('id', created.manualId);
    findings = (await admin.from('inspection_findings').select('*').eq('inspection_id', created.inspectionId)).data;
    expect(listApprovedConditions(findings, suggestions).some((row) => row.id === created.manualId)).toBe(false);
    expect(buildFindingsNarrative(findings, suggestions, photos)).not.toMatch(/Soot residue/i);
    expect(findings.find((row) => row.id === created.manualId)).toBeTruthy();

    // Persist decision across reload-equivalent re-query.
    const reloaded = (await admin.from('inspection_ai_suggestions').select('id,status').eq('id', created.suggestionId).single()).data;
    expect(reloaded.status).toBe('rejected');
  } finally {
    if (created.inspectionId) {
      await admin.from('inspection_events').delete().eq('inspection_id', created.inspectionId);
      await admin.from('inspection_ai_suggestions').delete().eq('inspection_id', created.inspectionId);
      await admin.from('inspection_photos').delete().eq('inspection_id', created.inspectionId);
      await admin.from('inspection_findings').delete().eq('inspection_id', created.inspectionId);
      await admin.from('inspections').delete().eq('id', created.inspectionId);
    }
    if (created.leadId) await admin.from('leads').delete().eq('id', created.leadId);
    if (created.userId) await admin.auth.admin.deleteUser(created.userId);
  }
});

test('blocker warning opens exact finding, highlights, and clears after evidence link', async ({ page }) => {
  test.setTimeout(180_000);
  const { client: admin, env } = createAdminClient();
  if (!/127\.0\.0\.1|localhost/i.test(env.supabaseUrl)) {
    test.skip(true, 'Local Supabase required.');
  }

  const runId = createRunId('blkhl').replace(/-/g, '').slice(0, 10);
  const email = `blkhl.${runId}@example.com`;
  const password = `BlkHl-${runId}-Aa1!`;
  const created = {
    userId: null,
    leadId: null,
    inspectionId: null,
    photoId: null,
    findingId: null,
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

    const lead = await insertWithRetry(
      admin,
      'leads',
      buildLeadPayload(runId, {
        first_name: 'BLK',
        last_name: 'HL',
        email,
        address: '100 Blocker Highlight Ave',
      }),
    );
    if (lead.error) throw lead.error;
    created.leadId = lead.data.id;

    const inspection = await insertWithRetry(admin, 'inspections', {
      tenant_id: TENANT_ID,
      lead_id: lead.data.id,
      status: 'draft',
      title: `BLOCKER HIGHLIGHT ${runId}`,
      inspection_type: 'dryer_vent',
      revision: 1,
      summary_status: 'draft',
      service_address: '100 Blocker Highlight Ave',
    });
    if (inspection.error) throw inspection.error;
    created.inspectionId = inspection.data.id;

    const photo = await insertWithRetry(admin, 'inspection_photos', {
      tenant_id: TENANT_ID,
      inspection_id: created.inspectionId,
      file_name: `blkhl-${runId}.jpg`,
      bucket_id: 'inspection-photos',
      object_path: `${TENANT_ID}/${created.inspectionId}/blkhl-${runId}.jpg`,
      content_type: 'image/jpeg',
      upload_state: 'complete',
      is_before: true,
      is_voided: false,
      uploaded_by_user_id: created.userId,
      caption: 'Unlinked evidence photo',
    });
    if (photo.error) throw photo.error;
    created.photoId = photo.data.id;

    const finding = await insertWithRetry(admin, 'inspection_findings', {
      tenant_id: TENANT_ID,
      inspection_id: created.inspectionId,
      title: `Orphan finding ${runId}`,
      description: 'Approved finding intentionally missing linked evidence',
      is_customer_visible: true,
      source_ai_suggestion_id: null,
      condition_status: 'approved',
      created_by_user_id: created.userId,
    });
    if (finding.error) throw finding.error;
    created.findingId = finding.data.id;

    await signIn(page, email, password);
    await page.goto(`/tvg/tech/inspections/${created.inspectionId}/review?step=findings`, {
      waitUntil: 'domcontentloaded',
    });

    const warning = page.getByTestId(`finding-needs-photo-${created.findingId}`);
    await expect(warning).toBeVisible({ timeout: 20_000 });
    await expect(warning).toContainText(/This finding needs a photo/i);

    const findingCard = page.getByTestId(`inspection-finding-${created.findingId}`);
    await expect(findingCard).toHaveAttribute('data-highlighted', 'true');
    await expect(findingCard).toBeVisible();

    // Highlight remains observable briefly (not a single-frame flash).
    await page.waitForTimeout(500);
    await expect(findingCard).toHaveAttribute('data-highlighted', 'true');

    // Use the deterministic finding picker (not the blocker-group action button).
    const photoPicker = page.getByTestId(`add-or-select-photo-${created.findingId}`);
    await expect(photoPicker).toBeVisible();
    await expect(photoPicker).toHaveAttribute('aria-label', /Add or select photo/i);
    await photoPicker.click();
    await page.getByRole('option', { name: /Unlinked evidence photo/i }).click();

    await expect(warning).toHaveCount(0, { timeout: 15_000 });
    await expect(findingCard).toHaveAttribute('data-highlighted', 'false');

    // No full-page reload required: URL unchanged and finding remains mounted.
    expect(page.url()).toContain('step=findings');
    await expect(findingCard).toBeVisible();

    const linked = await admin
      .from('inspection_photos')
      .select('finding_id')
      .eq('id', created.photoId)
      .single();
    expect(linked.data.finding_id).toBe(created.findingId);

    // Blocker action opens the exact finding and keeps highlight observable.
    await admin.from('inspection_photos').update({ finding_id: null }).eq('id', created.photoId);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId(`finding-needs-photo-${created.findingId}`)).toBeVisible({ timeout: 20_000 });
    await page
      .getByRole('region', { name: /Finalization blockers/i })
      .getByRole('button', { name: /Add or select photo/i })
      .click();
    await expect(page.getByTestId(`inspection-finding-${created.findingId}`)).toHaveAttribute('data-highlighted', 'true');
    await page.waitForTimeout(500);
    await expect(page.getByTestId(`inspection-finding-${created.findingId}`)).toHaveAttribute('data-highlighted', 'true');
  } finally {
    if (created.inspectionId) {
      await admin.from('inspection_photos').delete().eq('inspection_id', created.inspectionId);
      await admin.from('inspection_findings').delete().eq('inspection_id', created.inspectionId);
      await admin.from('inspections').delete().eq('id', created.inspectionId);
    }
    if (created.leadId) await admin.from('leads').delete().eq('id', created.leadId);
    if (created.userId) await admin.auth.admin.deleteUser(created.userId);
  }
});
