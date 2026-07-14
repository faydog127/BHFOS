/* eslint-disable testing-library/prefer-screen-queries, jest/valid-title */
import { test, expect } from '@playwright/test';
import {
  buildConditionsFingerprint,
  buildFindingsNarrative,
  listApprovedConditions,
  resolveNarrativeStatusForFingerprint,
} from '../../src/lib/inspectionFindingsNarrative.js';
import { createAdminClient, createRunId, insertWithRetry, buildLeadPayload } from './helpers/supabaseAdmin.js';

const TENANT_ID = 'tvg';
const isManualCondition = (finding) => Boolean(finding?.id) && !finding?.source_ai_suggestion_id;
const manualConditionStatus = (finding) => (
  typeof finding?.condition_status === 'string' ? finding.condition_status.trim().toLowerCase() : ''
) || 'draft';

test('manual condition review eligibility and stale narrative fingerprint', async () => {
  test.setTimeout(90_000);
  const { client: admin, env } = createAdminClient();
  if (!/127\.0\.0\.1|localhost/i.test(env.supabaseUrl)) test.skip(true, 'Local Supabase required.');

  const runId = createRunId('manrev').replace(/-/g, '').slice(0, 10);
  const created = {
    userId: null,
    leadId: null,
    inspectionId: null,
    manualId: null,
    aiFindingId: null,
    suggestionId: null,
    photoId: null,
  };

  try {
    const user = await admin.auth.admin.createUser({
      email: `manrev.${runId}@example.com`,
      password: `ManRev-${runId}-Aa1!`,
      email_confirm: true,
      app_metadata: { tenant_id: TENANT_ID, role: 'admin' },
    });
    if (user.error) throw user.error;
    created.userId = user.data.user.id;

    const lead = await insertWithRetry(
      admin,
      'leads',
      buildLeadPayload(runId, { first_name: 'MAN', last_name: 'REV', email: `manrev.${runId}@example.com` }),
    );
    if (lead.error) throw lead.error;
    created.leadId = lead.data.id;

    const inspection = await insertWithRetry(admin, 'inspections', {
      tenant_id: TENANT_ID,
      lead_id: lead.data.id,
      status: 'draft',
      title: `MANUAL REVIEW ${runId}`,
      inspection_type: 'dryer_vent',
      revision: 1,
      summary_status: 'draft',
    });
    if (inspection.error) throw inspection.error;
    created.inspectionId = inspection.data.id;

    const photo = await insertWithRetry(admin, 'inspection_photos', {
      tenant_id: TENANT_ID,
      inspection_id: created.inspectionId,
      file_name: `manrev-${runId}.jpg`,
      bucket_id: 'inspection-photos',
      object_path: `${TENANT_ID}/${created.inspectionId}/manrev-${runId}.jpg`,
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
      status: 'accepted',
      model: 'local-model',
      prompt_version: 'manual-review',
      content: { title: 'AI lint', description: 'AI-backed lint condition' },
    });
    if (suggestion.error) throw suggestion.error;
    created.suggestionId = suggestion.data.id;

    const aiFinding = await insertWithRetry(admin, 'inspection_findings', {
      tenant_id: TENANT_ID,
      inspection_id: created.inspectionId,
      title: 'AI lint',
      description: 'AI-backed lint condition',
      is_customer_visible: false,
      source_ai_suggestion_id: created.suggestionId,
      condition_status: 'draft',
      created_by_user_id: created.userId,
    });
    if (aiFinding.error) throw aiFinding.error;
    created.aiFindingId = aiFinding.data.id;

    const manual = await insertWithRetry(admin, 'inspection_findings', {
      tenant_id: TENANT_ID,
      inspection_id: created.inspectionId,
      title: 'Manual blower dust',
      description: 'Blower dust was observed on accessible surfaces',
      is_customer_visible: false,
      source_ai_suggestion_id: null,
      condition_status: 'draft',
      created_by_user_id: created.userId,
    });
    if (manual.error) throw manual.error;
    created.manualId = manual.data.id;

    expect(isManualCondition(manual.data)).toBe(true);
    expect(isManualCondition(aiFinding.data)).toBe(false);
    expect(manualConditionStatus(manual.data)).toBe('draft');

    let rows = (await admin.from('inspection_findings').select('*').eq('inspection_id', created.inspectionId)).data;
    let suggestions = (await admin.from('inspection_ai_suggestions').select('*').eq('inspection_id', created.inspectionId)).data;
    expect(listApprovedConditions(rows, suggestions).map((row) => row.id).sort()).toEqual([created.aiFindingId]);
    expect(buildFindingsNarrative(rows, suggestions, [])).not.toMatch(/Blower dust/i);

    const approve = await admin.from('inspection_findings').update({ condition_status: 'approved' }).eq('id', created.manualId).select('*').single();
    if (approve.error) throw approve.error;
    rows = (await admin.from('inspection_findings').select('*').eq('inspection_id', created.inspectionId)).data;
    expect(listApprovedConditions(rows, suggestions).map((row) => row.id).sort()).toEqual(
      [created.aiFindingId, created.manualId].sort(),
    );
    const narrative = buildFindingsNarrative(rows, suggestions, []);
    expect(narrative).toMatch(/Blower dust was observed on accessible surfaces/i);
    expect(narrative).toMatch(/AI-backed lint condition/i);

    const fingerprintApproved = buildConditionsFingerprint(rows, suggestions, []);
    const acceptNarrative = await admin.from('inspections').update({
      summary: narrative,
      summary_status: 'accepted',
      summary_conditions_fingerprint: fingerprintApproved,
    }).eq('id', created.inspectionId).select('summary, summary_status, summary_conditions_fingerprint').single();
    if (acceptNarrative.error) throw acceptNarrative.error;

    const reject = await admin.from('inspection_findings').update({ condition_status: 'rejected' }).eq('id', created.manualId).select('*').single();
    if (reject.error) throw reject.error;
    rows = (await admin.from('inspection_findings').select('*').eq('inspection_id', created.inspectionId)).data;
    expect(listApprovedConditions(rows, suggestions).map((row) => row.id)).toEqual([created.aiFindingId]);
    expect(buildFindingsNarrative(rows, suggestions, [])).not.toMatch(/Blower dust/i);

    const fingerprintRejected = buildConditionsFingerprint(rows, suggestions, []);
    expect(resolveNarrativeStatusForFingerprint({
      summaryStatus: acceptNarrative.data.summary_status,
      storedFingerprint: acceptNarrative.data.summary_conditions_fingerprint,
      currentFingerprint: fingerprintRejected,
    })).toBe('stale');
    expect(acceptNarrative.data.summary).toBe(narrative);

    const notRelevant = await admin.from('inspection_findings').update({ condition_status: 'not_relevant' }).eq('id', created.manualId).select('*').single();
    if (notRelevant.error) throw notRelevant.error;
    rows = (await admin.from('inspection_findings').select('*').eq('inspection_id', created.inspectionId)).data;
    expect(listApprovedConditions(rows, suggestions).map((row) => row.id)).toEqual([created.aiFindingId]);

    // AI-backed finding remains eligible without manual Approve controls / status.
    expect(isManualCondition(rows.find((row) => row.id === created.aiFindingId))).toBe(false);
    expect(listApprovedConditions(rows, suggestions).some((row) => row.id === created.aiFindingId)).toBe(true);
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
