/* eslint-disable testing-library/prefer-screen-queries, jest/valid-title */
import { test, expect } from '@playwright/test';
import { enrichPreflightIssues } from '../../src/lib/inspectionPreflightBlockers.js';
import { createAdminClient, createRunId, insertWithRetry, buildLeadPayload } from './helpers/supabaseAdmin.js';

const TENANT_ID = 'tvg';

test('P0a voided photo pending AI does not block; active pending still does', async () => {
  test.setTimeout(90_000);
  const { client: admin, env } = createAdminClient();
  if (!/127\.0\.0\.1|localhost/i.test(env.supabaseUrl)) test.skip(true, 'Local Supabase required.');

  const runId = createRunId('p0a').replace(/-/g, '').slice(0, 10);
  const created = {
    userId: null,
    leadId: null,
    inspectionId: null,
    activePhotoId: null,
    voidPhotoId: null,
    findingId: null,
    activeSuggestionIds: [],
    voidSuggestionIds: [],
  };

  try {
    const user = await admin.auth.admin.createUser({
      email: `p0a.${runId}@example.com`,
      password: `P0a-${runId}-Aa1!`,
      email_confirm: true,
      app_metadata: { tenant_id: TENANT_ID, role: 'admin' },
    });
    if (user.error) throw user.error;
    created.userId = user.data.user.id;

    const lead = await insertWithRetry(
      admin,
      'leads',
      buildLeadPayload(runId, { first_name: 'P0A', last_name: 'VOID', email: `p0a.${runId}@example.com` }),
    );
    if (lead.error) throw lead.error;
    created.leadId = lead.data.id;

    const inspection = await insertWithRetry(admin, 'inspections', {
      tenant_id: TENANT_ID,
      lead_id: lead.data.id,
      status: 'draft',
      title: `P0A VOID ${runId}`,
      inspection_type: 'air_duct',
      revision: 1,
      summary: 'Accepted findings narrative for preflight.',
      summary_status: 'accepted',
    });
    if (inspection.error) throw inspection.error;
    created.inspectionId = inspection.data.id;

    const makePhoto = async (name, voided = false) => {
      const photo = await insertWithRetry(admin, 'inspection_photos', {
        tenant_id: TENANT_ID,
        inspection_id: created.inspectionId,
        file_name: name,
        bucket_id: 'inspection-photos',
        object_path: `${TENANT_ID}/${created.inspectionId}/${name}`,
        content_type: 'image/jpeg',
        upload_state: 'complete',
        is_before: true,
        is_voided: voided,
        void_reason: voided ? 'Dark room' : null,
        uploaded_by_user_id: created.userId,
      });
      if (photo.error) throw photo.error;
      return photo.data;
    };

    const activePhoto = await makePhoto(`p0a-active-${runId}.jpg`, false);
    const voidPhoto = await makePhoto(`p0a-void-${runId}.jpg`, false);
    created.activePhotoId = activePhoto.id;
    created.voidPhotoId = voidPhoto.id;

    const insertPending = async (photoId) => {
      const finding = await insertWithRetry(admin, 'inspection_ai_suggestions', {
        tenant_id: TENANT_ID,
        inspection_id: created.inspectionId,
        inspection_revision: 1,
        photo_id: photoId,
        suggestion_version: 1,
        suggestion_type: 'finding',
        status: 'pending',
        model: 'local-model',
        prompt_version: 'p0a',
        content: { title: 'Pending condition', description: 'Pending AI draft' },
      });
      if (finding.error) throw finding.error;
      const narrative = await insertWithRetry(admin, 'inspection_ai_suggestions', {
        tenant_id: TENANT_ID,
        inspection_id: created.inspectionId,
        inspection_revision: 1,
        photo_id: photoId,
        suggestion_version: 1,
        suggestion_type: 'report_narrative',
        status: 'pending',
        model: 'local-model',
        prompt_version: 'p0a',
        content: { narrative: 'Pending narrative' },
      });
      if (narrative.error) throw narrative.error;
      return [finding.data.id, narrative.data.id];
    };

    created.activeSuggestionIds = await insertPending(created.activePhotoId);
    created.voidSuggestionIds = await insertPending(created.voidPhotoId);

    // Active pending blocks.
    let preflight = await admin.rpc('inspection_finalization_preflight', {
      p_tenant_id: TENANT_ID,
      p_inspection_id: created.inspectionId,
    });
    if (preflight.error) throw preflight.error;
    expect(JSON.stringify(preflight.data)).toMatch(/AI_DECISIONS_PENDING/);

    // Void the second photo — pending on that photo becomes irrelevant; audit row remains.
    const voided = await admin.rpc('inspection_void_photo', {
      p_tenant_id: TENANT_ID,
      p_photo_id: created.voidPhotoId,
      p_reason: 'Dark room',
    });
    if (voided.error) throw voided.error;
    expect(voided.data.is_voided).toBe(true);

    const voidSuggestions = await admin
      .from('inspection_ai_suggestions')
      .select('id, status, reviewed_content')
      .in('id', created.voidSuggestionIds);
    expect(voidSuggestions.data.every((row) => row.status === 'irrelevant')).toBe(true);
    expect(voidSuggestions.data.every((row) => row.reviewed_content?.inactive_reason === 'photo_voided')).toBe(true);

    const activeSuggestions = await admin
      .from('inspection_ai_suggestions')
      .select('id, status')
      .in('id', created.activeSuggestionIds);
    expect(activeSuggestions.data.every((row) => row.status === 'pending')).toBe(true);

    // Still blocked by active pending only.
    preflight = await admin.rpc('inspection_finalization_preflight', {
      p_tenant_id: TENANT_ID,
      p_inspection_id: created.inspectionId,
    });
    expect(JSON.stringify(preflight.data)).toMatch(/AI_DECISIONS_PENDING/);

    // Resolve active pending → AI pending blocker clears (may still have other gates).
    await admin.from('inspection_ai_suggestions').update({ status: 'rejected' }).in('id', created.activeSuggestionIds);
    preflight = await admin.rpc('inspection_finalization_preflight', {
      p_tenant_id: TENANT_ID,
      p_inspection_id: created.inspectionId,
    });
    expect(JSON.stringify(preflight.data || [])).not.toMatch(/AI_DECISIONS_PENDING/);

    // Accepted finding whose only evidence is later voided → actionable evidence blocker.
    const acceptedSuggestion = await insertWithRetry(admin, 'inspection_ai_suggestions', {
      tenant_id: TENANT_ID,
      inspection_id: created.inspectionId,
      inspection_revision: 1,
      photo_id: created.voidPhotoId,
      suggestion_version: 2,
      suggestion_type: 'finding',
      status: 'accepted',
      model: 'local-model',
      prompt_version: 'p0a',
      content: { title: 'Accepted then voided', description: 'Condition with voided evidence' },
    });
    if (acceptedSuggestion.error) throw acceptedSuggestion.error;

    const finding = await insertWithRetry(admin, 'inspection_findings', {
      tenant_id: TENANT_ID,
      inspection_id: created.inspectionId,
      title: 'Accepted then voided',
      description: 'Condition with voided evidence',
      is_customer_visible: false,
      source_ai_suggestion_id: acceptedSuggestion.data.id,
      created_by_user_id: created.userId,
    });
    if (finding.error) throw finding.error;
    created.findingId = finding.data.id;
    await admin.from('inspection_photos').update({ finding_id: created.findingId }).eq('id', created.voidPhotoId);

    preflight = await admin.rpc('inspection_finalization_preflight', {
      p_tenant_id: TENANT_ID,
      p_inspection_id: created.inspectionId,
    });
    const evidenceIssue = (preflight.data || []).find((issue) => (
      issue.code === 'FINDING_WITHOUT_EVIDENCE' && issue.finding_id === created.findingId
    ));
    expect(evidenceIssue).toBeTruthy();
    expect(evidenceIssue.message).toMatch(/voided|active evidence/i);

    // Mobile deep-link enrichment never targets voided photos.
    const enriched = enrichPreflightIssues(
      [{ code: 'AI_DECISIONS_PENDING', message: 'One or more photos still need a technician decision.' }],
      {
        photos: [
          { id: created.activePhotoId, is_voided: false },
          { id: created.voidPhotoId, is_voided: true },
        ],
        aiSuggestions: [
          { photo_id: created.voidPhotoId, status: 'pending' },
          { photo_id: created.activePhotoId, status: 'pending' },
        ],
      },
    );
    expect(enriched[0].photo_ids).toEqual([created.activePhotoId]);

    // Restoring void flag alone does not revive inactivated suggestions (must re-analyze).
    await admin.from('inspection_photos').update({
      is_voided: false,
      void_reason: null,
      voided_at: null,
    }).eq('id', created.voidPhotoId);
    const afterRestore = await admin
      .from('inspection_ai_suggestions')
      .select('status')
      .in('id', created.voidSuggestionIds);
    expect(afterRestore.data.every((row) => row.status === 'irrelevant')).toBe(true);
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
