/* eslint-disable testing-library/prefer-screen-queries, jest/valid-title */
import { test, expect } from '@playwright/test';
import {
  buildConditionsFingerprint,
  buildFindingsNarrative,
  listApprovedConditions,
  regenerateWillReplaceDraft,
  resolveNarrativeStatusForFingerprint,
  shouldAutoGenerateNarrative,
} from '../../src/lib/inspectionFindingsNarrative.js';
import { createAdminClient, createRunId, insertWithRetry, buildLeadPayload } from './helpers/supabaseAdmin.js';

const TENANT_ID = 'tvg';

test('narrative helpers include internal approved conditions and exclude rejected', async () => {
  const suggestions = [
    { id: 's-accept', status: 'accepted', suggestion_type: 'finding' },
    { id: 's-edit', status: 'edited', suggestion_type: 'finding' },
    { id: 's-reject', status: 'rejected', suggestion_type: 'finding' },
    { id: 's-irrelevant', status: 'irrelevant', suggestion_type: 'finding' },
    { id: 's-pending', status: 'pending', suggestion_type: 'finding' },
  ];
  const findings = [
    { id: 'f1', title: 'Lint in duct', description: 'Lint accumulation was observed in the dryer exhaust system', is_customer_visible: false, source_ai_suggestion_id: 's-accept' },
    { id: 'f2', title: 'Restricted airflow', description: 'Restricted airflow was observed at the termination', is_customer_visible: false, source_ai_suggestion_id: 's-edit' },
    { id: 'f3', title: 'Rejected dust', description: 'Should not appear', is_customer_visible: false, source_ai_suggestion_id: 's-reject' },
    { id: 'f4', title: 'Irrelevant stain', description: 'Should not appear', is_customer_visible: true, source_ai_suggestion_id: 's-irrelevant' },
    { id: 'f5', title: 'Pending only', description: 'Should not appear', is_customer_visible: false, source_ai_suggestion_id: 's-pending' },
    { id: 'f6', title: 'Manual condition', description: 'Blower dust was observed on accessible surfaces', is_customer_visible: false, source_ai_suggestion_id: null, condition_status: 'approved' },
    { id: 'f7', title: 'Unapproved manual', description: 'Should not appear unapproved', is_customer_visible: false, source_ai_suggestion_id: null, condition_status: 'draft' },
  ];
  const photos = [
    { id: 'p1', finding_id: 'f1', caption: 'Lint visible along the lower duct surface', is_voided: false, upload_state: 'complete' },
    { id: 'p2', finding_id: 'f3', caption: 'Rejected caption', is_voided: false, upload_state: 'complete' },
  ];

  const approved = listApprovedConditions(findings, suggestions);
  expect(approved.map((row) => row.id).sort()).toEqual(['f1', 'f2', 'f6']);

  const narrative = buildFindingsNarrative(findings, suggestions, photos);
  expect(narrative).toMatch(/Lint accumulation was observed in the dryer exhaust system/i);
  expect(narrative).toMatch(/Restricted airflow was observed at the termination/i);
  expect(narrative).toMatch(/Blower dust was observed on accessible surfaces/i);
  expect(narrative).toMatch(/Supporting photos document Lint visible along the lower duct surface/i);
  expect(narrative).not.toMatch(/Should not appear|Rejected|Pending/i);
  expect(narrative).not.toMatch(/Complete dryer vent cleaning/i);

  const fingerprint = buildConditionsFingerprint(findings, suggestions, photos);
  expect(fingerprint).toContain('f1|');
  expect(shouldAutoGenerateNarrative()).toBe(false);
  expect(regenerateWillReplaceDraft('accepted', 'Existing')).toBe(true);
  expect(regenerateWillReplaceDraft('draft', '')).toBe(false);
  expect(resolveNarrativeStatusForFingerprint({
    summaryStatus: 'accepted',
    storedFingerprint: fingerprint,
    currentFingerprint: `${fingerprint}|changed`,
  })).toBe('stale');
  expect(resolveNarrativeStatusForFingerprint({
    summaryStatus: 'accepted',
    storedFingerprint: fingerprint,
    currentFingerprint: fingerprint,
  })).toBe('accepted');
});

test('persisted findings narrative is shared, idempotent, and becomes stale on condition change', async () => {
  test.setTimeout(90_000);
  const { client: admin, env } = createAdminClient();
  if (!/127\.0\.0\.1|localhost/i.test(env.supabaseUrl)) test.skip(true, 'Local Supabase required.');

  const runId = createRunId('phaseb').replace(/-/g, '').slice(0, 10);
  const created = {
    userId: null,
    leadId: null,
    inspectionId: null,
    findingId: null,
    suggestionId: null,
    photoId: null,
  };

  try {
    const user = await admin.auth.admin.createUser({
      email: `phaseb.${runId}@example.com`,
      password: `PhaseB-${runId}-Aa1!`,
      email_confirm: true,
      app_metadata: { tenant_id: TENANT_ID, role: 'admin' },
    });
    if (user.error) throw user.error;
    created.userId = user.data.user.id;

    const lead = await insertWithRetry(
      admin,
      'leads',
      buildLeadPayload(runId, { first_name: 'PHASE', last_name: 'B', email: `phaseb.${runId}@example.com` }),
    );
    if (lead.error) throw lead.error;
    created.leadId = lead.data.id;

    const inspection = await insertWithRetry(admin, 'inspections', {
      tenant_id: TENANT_ID,
      lead_id: lead.data.id,
      status: 'draft',
      title: `PHASE B ${runId}`,
      inspection_type: 'dryer_vent',
      revision: 1,
      summary_status: 'draft',
    });
    if (inspection.error) throw inspection.error;
    created.inspectionId = inspection.data.id;

    const photo = await insertWithRetry(admin, 'inspection_photos', {
      tenant_id: TENANT_ID,
      inspection_id: created.inspectionId,
      file_name: `phaseb-${runId}.jpg`,
      bucket_id: 'inspection-photos',
      object_path: `${TENANT_ID}/${created.inspectionId}/phaseb-${runId}.jpg`,
      content_type: 'image/jpeg',
      upload_state: 'complete',
      is_before: true,
      is_voided: false,
      caption: 'Lint visible in the exhaust path',
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
      status: 'accepted',
      model: 'local-model',
      prompt_version: 'phase-b',
      content: { title: 'Lint accumulation', description: 'Lint accumulation and restricted airflow were observed in the dryer exhaust system' },
    });
    if (suggestion.error) throw suggestion.error;
    created.suggestionId = suggestion.data.id;

    const finding = await insertWithRetry(admin, 'inspection_findings', {
      tenant_id: TENANT_ID,
      inspection_id: created.inspectionId,
      title: 'Lint accumulation',
      description: 'Lint accumulation and restricted airflow were observed in the dryer exhaust system',
      severity: 'medium',
      category: 'dryer_vent',
      recommended_action: 'Complete dryer vent cleaning',
      is_customer_visible: false,
      source_ai_suggestion_id: created.suggestionId,
      created_by_user_id: created.userId,
    });
    if (finding.error) throw finding.error;
    created.findingId = finding.data.id;

    await admin.from('inspection_photos').update({ finding_id: created.findingId }).eq('id', created.photoId);

    const findings = [(await admin.from('inspection_findings').select('*').eq('id', created.findingId).single()).data];
    const photos = [(await admin.from('inspection_photos').select('*').eq('id', created.photoId).single()).data];
    const suggestions = [(await admin.from('inspection_ai_suggestions').select('*').eq('id', created.suggestionId).single()).data];

    const narrative = buildFindingsNarrative(findings, suggestions, photos);
    const fingerprint = buildConditionsFingerprint(findings, suggestions, photos);
    expect(narrative).toMatch(/Lint accumulation and restricted airflow were observed/i);
    expect(narrative).not.toMatch(/Complete dryer vent cleaning/i);

    const save1 = await admin.from('inspections').update({
      summary: narrative,
      summary_status: 'generated',
      summary_conditions_fingerprint: fingerprint,
    }).eq('id', created.inspectionId).select('summary, summary_status, summary_conditions_fingerprint').single();
    if (save1.error) throw save1.error;

    const save2 = await admin.from('inspections').update({
      summary: narrative,
      summary_status: 'generated',
      summary_conditions_fingerprint: fingerprint,
    }).eq('id', created.inspectionId).select('summary, summary_status, summary_conditions_fingerprint').single();
    if (save2.error) throw save2.error;
    expect(save2.data.summary).toBe(save1.data.summary);
    expect(save2.data.summary_conditions_fingerprint).toBe(fingerprint);

    const editedText = `${narrative} Technician clarified termination access.`;
    const accept = await admin.from('inspections').update({
      summary: editedText,
      summary_status: 'accepted',
      summary_conditions_fingerprint: fingerprint,
      summary_reviewed_at: new Date().toISOString(),
      summary_reviewed_by: created.userId,
    }).eq('id', created.inspectionId).select('summary, summary_status').single();
    if (accept.error) throw accept.error;
    expect(accept.data.summary).toBe(editedText);
    expect(accept.data.summary_status).toBe('accepted');

    const reopen = await admin.from('inspections').select('summary, summary_status, summary_conditions_fingerprint').eq('id', created.inspectionId).single();
    expect(reopen.data.summary).toBe(editedText);
    expect(reopen.data.summary_status).toBe('accepted');
    expect(shouldAutoGenerateNarrative()).toBe(false);

    await admin.from('inspection_findings').update({
      description: 'Heavy lint packing and severe airflow restriction were observed in the dryer exhaust system',
    }).eq('id', created.findingId);
    const changedFindings = [(await admin.from('inspection_findings').select('*').eq('id', created.findingId).single()).data];
    const nextFingerprint = buildConditionsFingerprint(changedFindings, suggestions, photos);
    expect(nextFingerprint).not.toBe(fingerprint);
    expect(resolveNarrativeStatusForFingerprint({
      summaryStatus: reopen.data.summary_status,
      storedFingerprint: reopen.data.summary_conditions_fingerprint,
      currentFingerprint: nextFingerprint,
    })).toBe('stale');

    const markStale = await admin.from('inspections').update({ summary_status: 'stale' }).eq('id', created.inspectionId).select('summary, summary_status').single();
    expect(markStale.data.summary).toBe(editedText);
    expect(markStale.data.summary_status).toBe('stale');

    const preflight = await admin.rpc('inspection_finalization_preflight', {
      p_tenant_id: TENANT_ID,
      p_inspection_id: created.inspectionId,
    });
    if (preflight.error) throw preflight.error;
    expect(JSON.stringify(preflight.data || [])).toMatch(/stale|Findings narrative/i);
  } finally {
    if (created.inspectionId) {
      await admin.from('inspection_ai_suggestions').delete().eq('inspection_id', created.inspectionId);
      await admin.from('inspection_photos').delete().eq('inspection_id', created.inspectionId);
      await admin.from('inspection_findings').delete().eq('inspection_id', created.inspectionId);
      await admin.from('inspections').delete().eq('id', created.inspectionId);
    }
    if (created.leadId) await admin.from('leads').delete().eq('id', created.leadId);
    if (created.userId) await admin.auth.admin.deleteUser(created.userId);
  }
});
