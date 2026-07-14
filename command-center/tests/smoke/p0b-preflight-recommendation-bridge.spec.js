/* eslint-disable testing-library/prefer-screen-queries, jest/valid-title */
import { test, expect } from '@playwright/test';
import { createAdminClient, createRunId, insertWithRetry, buildLeadPayload } from './helpers/supabaseAdmin.js';

const TENANT_ID = 'tvg';

test('P0b bridge requires accepted narrative and one inspection-level recommendation', async () => {
  test.setTimeout(90_000);
  const { client: admin, env } = createAdminClient();
  if (!/127\.0\.0\.1|localhost/i.test(env.supabaseUrl)) test.skip(true, 'Local Supabase required.');

  const runId = createRunId('p0b').replace(/-/g, '').slice(0, 10);
  const created = { userId: null, leadId: null, inspectionId: null, findingId: null };

  try {
    const user = await admin.auth.admin.createUser({
      email: `p0b.${runId}@example.com`,
      password: `P0b-${runId}-Aa1!`,
      email_confirm: true,
      app_metadata: { tenant_id: TENANT_ID, role: 'admin' },
    });
    if (user.error) throw user.error;
    created.userId = user.data.user.id;

    const lead = await insertWithRetry(
      admin,
      'leads',
      buildLeadPayload(runId, { first_name: 'P0B', last_name: 'BRIDGE', email: `p0b.${runId}@example.com` }),
    );
    if (lead.error) throw lead.error;
    created.leadId = lead.data.id;

    const inspection = await insertWithRetry(admin, 'inspections', {
      tenant_id: TENANT_ID,
      lead_id: lead.data.id,
      status: 'draft',
      title: `P0B BRIDGE ${runId}`,
      inspection_type: 'air_duct',
      revision: 1,
      summary: 'Dust was observed on accessible return surfaces.',
      summary_status: 'accepted',
    });
    if (inspection.error) throw inspection.error;
    created.inspectionId = inspection.data.id;

    // Customer-visible finding without per-finding recommendation must NOT trip old gate.
    const finding = await insertWithRetry(admin, 'inspection_findings', {
      tenant_id: TENANT_ID,
      inspection_id: created.inspectionId,
      title: 'Customer-visible leftover',
      description: 'Should not require a per-finding recommendation anymore',
      is_customer_visible: true,
      created_by_user_id: created.userId,
    });
    if (finding.error) throw finding.error;
    created.findingId = finding.data.id;

    let preflight = await admin.rpc('inspection_finalization_preflight', {
      p_tenant_id: TENANT_ID,
      p_inspection_id: created.inspectionId,
    });
    if (preflight.error) throw preflight.error;
    expect(JSON.stringify(preflight.data)).toMatch(/RECOMMENDATION_REQUIRED/);
    expect(JSON.stringify(preflight.data)).toMatch(/inspection-level Service Recommendation/i);
    expect(JSON.stringify(preflight.data)).not.toMatch(/NO_CUSTOMER_FINDINGS/);
    expect(JSON.stringify(preflight.data)).not.toMatch(/Each customer-visible finding needs/);

    // Per-finding recommendation alone is not enough.
    await insertWithRetry(admin, 'inspection_recommendations', {
      tenant_id: TENANT_ID,
      inspection_id: created.inspectionId,
      finding_id: created.findingId,
      title: 'Per-finding rec',
      is_customer_visible: true,
      created_by_user_id: created.userId,
    });
    preflight = await admin.rpc('inspection_finalization_preflight', {
      p_tenant_id: TENANT_ID,
      p_inspection_id: created.inspectionId,
    });
    expect(JSON.stringify(preflight.data)).toMatch(/RECOMMENDATION_REQUIRED/);

    // Inspection-level recommendation clears the bridge gate.
    await insertWithRetry(admin, 'inspection_recommendations', {
      tenant_id: TENANT_ID,
      inspection_id: created.inspectionId,
      finding_id: null,
      title: 'Total Home Air Restoration',
      description: 'Duct cleaning and air-handler cleaning package',
      is_customer_visible: true,
      created_by_user_id: created.userId,
    });
    preflight = await admin.rpc('inspection_finalization_preflight', {
      p_tenant_id: TENANT_ID,
      p_inspection_id: created.inspectionId,
    });
    expect(JSON.stringify(preflight.data || [])).not.toMatch(/RECOMMENDATION_REQUIRED/);
    expect(JSON.stringify(preflight.data || [])).not.toMatch(/NO_CUSTOMER_FINDINGS/);
  } finally {
    if (created.inspectionId) {
      await admin.from('inspection_recommendations').delete().eq('inspection_id', created.inspectionId);
      await admin.from('inspection_findings').delete().eq('inspection_id', created.inspectionId);
      await admin.from('inspections').delete().eq('id', created.inspectionId);
    }
    if (created.leadId) await admin.from('leads').delete().eq('id', created.leadId);
    if (created.userId) await admin.auth.admin.deleteUser(created.userId);
  }
});
