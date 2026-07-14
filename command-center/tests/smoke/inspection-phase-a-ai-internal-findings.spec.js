/* eslint-disable testing-library/prefer-screen-queries, jest/valid-title */
import { test, expect } from '@playwright/test';
import { createAdminClient, createRunId, insertWithRetry, buildLeadPayload } from './helpers/supabaseAdmin.js';

const TENANT_ID = 'tvg';

test('Phase A AI accept/edit store internal findings without customer recommendations', async () => {
  test.setTimeout(90_000);
  const { client: admin, env } = createAdminClient();
  if (!/127\.0\.0\.1|localhost/i.test(env.supabaseUrl)) test.skip(true, 'Local Supabase required.');

  const runId = createRunId('phasea').replace(/-/g, '').slice(0, 10);
  const email = `phasea.${runId}@example.com`;
  const password = `PhaseA-${runId}-Aa1!`;
  const created = {
    userId: null,
    leadId: null,
    inspectionId: null,
    photoIds: [],
    historicalFindingId: null,
    historicalRecId: null,
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
      buildLeadPayload(runId, { first_name: 'PHASE', last_name: 'A', email: `phasea.${runId}@example.com` }),
    );
    if (lead.error) throw lead.error;
    created.leadId = lead.data.id;

    const inspection = await insertWithRetry(admin, 'inspections', {
      tenant_id: TENANT_ID,
      lead_id: lead.data.id,
      status: 'draft',
      title: `PHASE A ${runId}`,
      inspection_type: 'dryer_vent',
      revision: 1,
    });
    if (inspection.error) throw inspection.error;
    created.inspectionId = inspection.data.id;

    const historicalFinding = await insertWithRetry(admin, 'inspection_findings', {
      tenant_id: TENANT_ID,
      inspection_id: created.inspectionId,
      title: `Historical customer finding ${runId}`,
      description: 'Pre-Phase-A customer-facing finding',
      severity: 'medium',
      category: 'dryer_vent',
      recommended_action: 'Historical action',
      is_customer_visible: true,
      created_by_user_id: created.userId,
    });
    if (historicalFinding.error) throw historicalFinding.error;
    created.historicalFindingId = historicalFinding.data.id;

    const historicalRec = await insertWithRetry(admin, 'inspection_recommendations', {
      tenant_id: TENANT_ID,
      inspection_id: created.inspectionId,
      finding_id: created.historicalFindingId,
      title: `Historical customer recommendation ${runId}`,
      description: 'Pre-Phase-A recommendation',
      is_customer_visible: true,
      created_by_user_id: created.userId,
    });
    if (historicalRec.error) throw historicalRec.error;
    created.historicalRecId = historicalRec.data.id;

    const makePhoto = async (fileName) => {
      const photo = await insertWithRetry(admin, 'inspection_photos', {
        tenant_id: TENANT_ID,
        inspection_id: created.inspectionId,
        file_name: fileName,
        bucket_id: 'inspection-photos',
        object_path: `${TENANT_ID}/${created.inspectionId}/${fileName}`,
        content_type: 'image/jpeg',
        upload_state: 'complete',
        is_before: true,
        is_voided: false,
        uploaded_by_user_id: created.userId,
      });
      if (photo.error) throw photo.error;
      created.photoIds.push(photo.data.id);
      return photo.data;
    };

    const acceptPhoto = await makePhoto(`phasea-accept-${runId}.jpg`);
    const editPhoto = await makePhoto(`phasea-edit-${runId}.jpg`);
    const rejectPhoto = await makePhoto(`phasea-reject-${runId}.jpg`);
    const irrelevantPhoto = await makePhoto(`phasea-irrelevant-${runId}.jpg`);

    const insertSuggestions = async (photoId, version = 1) => {
      const finding = await admin.from('inspection_ai_suggestions').insert({
        tenant_id: TENANT_ID,
        inspection_id: created.inspectionId,
        inspection_revision: 1,
        photo_id: photoId,
        suggestion_version: version,
        suggestion_type: 'finding',
        status: 'pending',
        model: 'local-model',
        prompt_version: 'phase-a',
        content: {
          title: 'Moderate lint accumulation',
          description: 'Lint is visible inside the duct.',
          customer_caption: 'Lint visible along the lower duct surface.',
          category: 'dryer_vent',
          severity: 'medium',
          confidence: 'medium',
          uncertainty: 'Limited view.',
          evidence_usability: 'usable',
          recommended_action: 'Complete dryer vent cleaning',
        },
      }).select('*').single();
      if (finding.error) throw finding.error;
      const narrative = await admin.from('inspection_ai_suggestions').insert({
        tenant_id: TENANT_ID,
        inspection_id: created.inspectionId,
        inspection_revision: 1,
        photo_id: photoId,
        suggestion_version: version,
        suggestion_type: 'report_narrative',
        status: 'pending',
        model: 'local-model',
        prompt_version: 'phase-a',
        content: { narrative: 'Moderate lint accumulation was documented.' },
      }).select('*').single();
      if (narrative.error) throw narrative.error;
      return finding.data;
    };

    await insertSuggestions(acceptPhoto.id);
    await insertSuggestions(editPhoto.id);
    await insertSuggestions(rejectPhoto.id);
    await insertSuggestions(irrelevantPhoto.id);

    const acceptResult = await admin.rpc('inspection_review_ai_photo_package', {
      p_tenant_id: TENANT_ID,
      p_photo_id: acceptPhoto.id,
      p_action: 'accept',
      p_reviewed_content: { recommendation: 'Complete dryer vent cleaning' },
      p_internal_only: false,
    });
    if (acceptResult.error) throw acceptResult.error;
    expect(acceptResult.data.customer_visible).toBe(false);
    expect(acceptResult.data.recommendation_id).toBeNull();
    expect(acceptResult.data.finding_id).toBeTruthy();

    const acceptedFinding = await admin.from('inspection_findings').select('*').eq('id', acceptResult.data.finding_id).single();
    expect(acceptedFinding.data.is_customer_visible).toBe(false);
    expect(acceptedFinding.data.title).toBe('Moderate lint accumulation');
    expect(acceptedFinding.data.severity).toBe('medium');
    expect(acceptedFinding.data.category).toBe('dryer_vent');
    expect(acceptedFinding.data.description).toContain('Lint is visible');
    expect(acceptedFinding.data.recommended_action).toBe('Complete dryer vent cleaning');
    expect(acceptedFinding.data.source_ai_suggestion_id).toBeTruthy();

    const acceptedPhoto = await admin.from('inspection_photos').select('finding_id, caption, recommendation_id').eq('id', acceptPhoto.id).single();
    expect(acceptedPhoto.data.finding_id).toBe(acceptResult.data.finding_id);
    expect(acceptedPhoto.data.caption).toBe('Lint visible along the lower duct surface.');

    const editResult = await admin.rpc('inspection_review_ai_photo_package', {
      p_tenant_id: TENANT_ID,
      p_photo_id: editPhoto.id,
      p_action: 'edit',
      p_reviewed_content: {
        title: 'Edited lint condition',
        description: 'Edited description of lint.',
        customer_caption: 'Edited caption.',
        recommendation: 'Inspect exterior termination and airflow',
      },
      p_internal_only: false,
    });
    if (editResult.error) throw editResult.error;
    expect(editResult.data.customer_visible).toBe(false);
    expect(editResult.data.recommendation_id).toBeNull();

    const editedFinding = await admin.from('inspection_findings').select('*').eq('id', editResult.data.finding_id).single();
    expect(editedFinding.data.is_customer_visible).toBe(false);
    expect(editedFinding.data.title).toBe('Edited lint condition');
    expect(editedFinding.data.description).toBe('Edited description of lint.');
    expect(editedFinding.data.recommended_action).toBe('Inspect exterior termination and airflow');

    const editedPhoto = await admin.from('inspection_photos').select('finding_id, caption').eq('id', editPhoto.id).single();
    expect(editedPhoto.data.finding_id).toBe(editResult.data.finding_id);
    expect(editedPhoto.data.caption).toBe('Edited caption.');

    const rejectResult = await admin.rpc('inspection_review_ai_photo_package', {
      p_tenant_id: TENANT_ID,
      p_photo_id: rejectPhoto.id,
      p_action: 'reject',
      p_reviewed_content: {},
      p_internal_only: false,
    });
    if (rejectResult.error) throw rejectResult.error;
    expect(rejectResult.data.finding_id).toBeNull();

    const irrelevantResult = await admin.rpc('inspection_review_ai_photo_package', {
      p_tenant_id: TENANT_ID,
      p_photo_id: irrelevantPhoto.id,
      p_action: 'irrelevant',
      p_reviewed_content: {},
      p_internal_only: false,
    });
    if (irrelevantResult.error) throw irrelevantResult.error;
    expect(irrelevantResult.data.finding_id).toBeNull();

    const rejectFindings = await admin.from('inspection_findings')
      .select('id')
      .eq('inspection_id', created.inspectionId)
      .neq('id', created.historicalFindingId);
    expect((rejectFindings.data || []).length).toBe(2);

    const autoRecs = await admin.from('inspection_recommendations')
      .select('id, title, finding_id, is_customer_visible')
      .eq('inspection_id', created.inspectionId);
    expect(autoRecs.data).toHaveLength(1);
    expect(autoRecs.data[0].id).toBe(created.historicalRecId);
    expect(autoRecs.data[0].title).toBe(`Historical customer recommendation ${runId}`);
    expect(autoRecs.data[0].is_customer_visible).toBe(true);

    const historicalFindingAfter = await admin.from('inspection_findings').select('*').eq('id', created.historicalFindingId).single();
    expect(historicalFindingAfter.data.is_customer_visible).toBe(true);
    expect(historicalFindingAfter.data.title).toBe(`Historical customer finding ${runId}`);

    // Idempotent re-accept on a new suggestion version for the same photo.
    await insertSuggestions(acceptPhoto.id, 2);
    const reaccept = await admin.rpc('inspection_review_ai_photo_package', {
      p_tenant_id: TENANT_ID,
      p_photo_id: acceptPhoto.id,
      p_action: 'accept',
      p_reviewed_content: { recommendation: 'Complete dryer vent cleaning' },
      p_internal_only: false,
    });
    if (reaccept.error) throw reaccept.error;
    expect(reaccept.data.finding_id).toBe(acceptResult.data.finding_id);

    const findingsAfterReaccept = await admin.from('inspection_findings')
      .select('id')
      .eq('inspection_id', created.inspectionId)
      .neq('id', created.historicalFindingId);
    expect((findingsAfterReaccept.data || []).length).toBe(2);

    const recsAfterReaccept = await admin.from('inspection_recommendations')
      .select('id')
      .eq('inspection_id', created.inspectionId);
    expect(recsAfterReaccept.data).toHaveLength(1);

    const events = await admin.from('inspection_events')
      .select('event_type, metadata')
      .eq('inspection_id', created.inspectionId)
      .like('event_type', 'ai_photo_package_%');
    expect((events.data || []).length).toBeGreaterThanOrEqual(4);
  } finally {
    if (created.inspectionId) {
      await admin.from('inspection_events').delete().eq('inspection_id', created.inspectionId);
      await admin.from('inspection_ai_suggestions').delete().eq('inspection_id', created.inspectionId);
      await admin.from('inspection_recommendations').delete().eq('inspection_id', created.inspectionId);
      await admin.from('inspection_photos').delete().eq('inspection_id', created.inspectionId);
      await admin.from('inspection_findings').delete().eq('inspection_id', created.inspectionId);
      await admin.from('inspections').delete().eq('id', created.inspectionId);
    }
    if (created.leadId) await admin.from('leads').delete().eq('id', created.leadId);
    if (created.userId) await admin.auth.admin.deleteUser(created.userId);
  }
});
