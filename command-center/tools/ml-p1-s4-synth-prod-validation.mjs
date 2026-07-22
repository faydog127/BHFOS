/**
 * ML-P1 Slice 4 — bounded synthetic production validation (tech + office).
 * Uses ML_P1_S4_* credentials. Creates/cleans only is_test_data marked records.
 * Run: node tools/ml-p1-s4-synth-prod-validation.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const envPath = path.join(root, '.env');

function loadEnv(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i < 0) continue;
    out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return out;
}

const env = loadEnv(envPath);
const url = env.VITE_SUPABASE_URL;
const anon = env.VITE_SUPABASE_ANON_KEY;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const TECH_EMAIL = env.ML_P1_S4_TECH_EMAIL;
const TECH_PASSWORD = env.ML_P1_S4_TECH_PASSWORD;
const OFFICE_EMAIL = env.ML_P1_S4_OFFICE_EMAIL;
const OFFICE_PASSWORD = env.ML_P1_S4_OFFICE_PASSWORD;

const EXPECT_TECH_UID = '8eadcdd3-0723-4a95-bc03-4d69a6281f1d';
const EXPECT_OFFICE_UID = 'e8a4c5ed-a3f3-4817-b7ac-6e8d617fe3ce';
const EXPECT_TECH_ROSTER = '02743912-4123-4764-81ac-e9a3af7dc8ee';
const RUN_TAG = `S4-SYNTH-${Date.now()}`;
const MARKER = 'SYNTHETIC TEST-DO-NOT-CONTACT / ML-P1-S4';

const results = [];
function step(name, ok, detail = null) {
  results.push({ name, ok: !!ok, detail });
  const flag = ok ? 'PASS' : 'FAIL';
  console.log(`[${flag}] ${name}${detail ? ` — ${typeof detail === 'string' ? detail : JSON.stringify(detail)}` : ''}`);
}

function client(key) {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function signIn(email, password) {
  const c = client(anon);
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return { c, user: data.user, session: data.session };
}

async function rpc(c, name, args) {
  const { data, error } = await c.rpc(name, args);
  return { data, error };
}

async function main() {
  if (!url || !anon || !serviceKey) throw new Error('Missing Supabase URL/anon/service key');
  if (!TECH_EMAIL || !TECH_PASSWORD || !OFFICE_EMAIL || !OFFICE_PASSWORD) {
    throw new Error('Missing ML_P1_S4_* credential keys');
  }
  step('credential_emails', TECH_EMAIL === 'synth.tech.s4@example.invalid' && OFFICE_EMAIL === 'synth.office.s4@example.invalid', {
    tech: TECH_EMAIL,
    office: OFFICE_EMAIL,
  });

  const admin = client(serviceKey);

  // Preflight role + linkage (service read)
  const { data: roles } = await admin.from('app_user_roles').select('user_id,role,created_at').in('user_id', [EXPECT_TECH_UID, EXPECT_OFFICE_UID]);
  const resolve = (uid) =>
    (roles || [])
      .filter((r) => r.user_id === uid)
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0]?.role;
  const techRole = resolve(EXPECT_TECH_UID);
  const officeRole = resolve(EXPECT_OFFICE_UID);
  step('office_role', officeRole === 'office', officeRole);
  step('technician_role', techRole === 'technician', techRole);

  const { data: techRow } = await admin
    .from('technicians')
    .select('id,user_id,email,full_name,is_active')
    .eq('id', EXPECT_TECH_ROSTER)
    .maybeSingle();
  step(
    'technician_roster_link',
    techRow?.user_id === EXPECT_TECH_UID &&
      techRow?.email === 'synth.tech.s4@example.invalid' &&
      /S4 Synthetic/i.test(techRow?.full_name || '') &&
      techRow?.is_active === true,
    techRow,
  );

  const officeAuth = await signIn(OFFICE_EMAIL, OFFICE_PASSWORD);
  const techAuth = await signIn(TECH_EMAIL, TECH_PASSWORD);
  step('office_login', officeAuth.user?.id === EXPECT_OFFICE_UID, officeAuth.user?.id);
  step('tech_login', techAuth.user?.id === EXPECT_TECH_UID, techAuth.user?.id);

  let leadId = null;
  let jobId = null;
  let coId = null;

  try {
    // Fixture create via service role — marked synthetic, non-contactable, no automation consent
    const { data: lead, error: leadErr } = await admin
      .from('leads')
      .insert({
        name: `${MARKER} ${RUN_TAG}`,
        first_name: 'S4',
        last_name: 'SYNTHETIC-DO-NOT-CONTACT',
        email: `synth.lead.s4.${Date.now()}@example.invalid`,
        phone: null,
        status: 'new',
        source: 'ml_p1_s4_synth_validation',
        notes: `${MARKER}; exclude billing/comms/automation; run=${RUN_TAG}`,
        is_test_data: true,
        consent_marketing: false,
        sms_consent: false,
        sms_opt_out: true,
        needs_ai_action: false,
      })
      .select('id')
      .single();
    if (leadErr) throw leadErr;
    leadId = lead.id;
    step('create_synthetic_lead', !!leadId, leadId);

    const start = new Date(Date.now() + 60 * 60 * 1000);
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
    const { data: job, error: jobErr } = await admin
      .from('jobs')
      .insert({
        lead_id: leadId,
        status: 'unscheduled',
        payment_status: 'unpaid',
        is_test_data: true,
        customer_email: `synth.job.s4.${Date.now()}@example.invalid`,
        customer_summary: null,
        technician_notes: null,
        s4_invoice_on_complete_disabled: true,
        follow_up_required: false,
      })
      .select('id,status,technician_id,execution_row_version,s4_invoice_on_complete_disabled')
      .single();
    if (jobErr) throw jobErr;
    jobId = job.id;
    step('create_synthetic_job', !!jobId && job.s4_invoice_on_complete_disabled === true, {
      jobId,
      status: job.status,
    });

    // Office: assign + schedule to synthetic tech only
    {
      const mut = `s4-office-assign-${randomUUID()}`;
      const { data, error } = await rpc(officeAuth.c, 'ml_p1_s4_assign_and_schedule', {
        p_job_id: jobId,
        p_technician_id: EXPECT_TECH_ROSTER,
        p_scheduled_start: start.toISOString(),
        p_scheduled_end: end.toISOString(),
        p_client_mutation_id: mut,
        p_reason: 'S4 synthetic office assign/schedule',
      });
      step('office_assign_schedule', !error && data?.status === 'scheduled', error?.message || data);
      if (!error) {
        const { data: evs } = await admin
          .from('events')
          .select('actor_id,event_type')
          .eq('entity_id', jobId)
          .eq('event_type', 'JobAssignedScheduled')
          .order('created_at', { ascending: false })
          .limit(1);
        const actor = evs?.[0]?.actor_id;
        step('office_assign_audit_actor_uuid', actor === EXPECT_OFFICE_UID, { actor, event: evs?.[0] });
      }
    }

    // Tech field transitions
    for (const action of ['on_my_way', 'arrive', 'start']) {
      const mut = `s4-tech-${action}-${randomUUID()}`;
      const { data, error } = await rpc(techAuth.c, 'ml_p1_s4_job_transition', {
        p_job_id: jobId,
        p_action: action,
        p_client_mutation_id: mut,
        p_reason: null,
        p_expected_row_version: null,
        p_payload: {},
      });
      step(`tech_transition_${action}`, !error && !!data?.status, error?.message || data?.status);
      if (action === 'on_my_way' && !error) {
        const { data: evs } = await admin
          .from('events')
          .select('actor_id,event_type')
          .eq('entity_id', jobId)
          .eq('event_type', 'JobTransition_on_my_way')
          .order('created_at', { ascending: false })
          .limit(1);
        step('tech_transition_audit_actor_uuid', evs?.[0]?.actor_id === EXPECT_TECH_UID, evs?.[0]);
      }
    }

    // Tech propose CO (description-only price-book path)
    {
      const mut = `s4-tech-co-${randomUUID()}`;
      const { data, error } = await rpc(techAuth.c, 'ml_p1_s4_change_order_propose', {
        p_job_id: jobId,
        p_reason: 'S4 synthetic additional dryer-vent scope — DO NOT BILL CUSTOMER',
        p_items: [
          {
            description: 'SYNTHETIC CO LINE — DO NOT CONTACT / DO NOT BILL',
            quantity: 1,
            unit_price_cents: 0,
            line_delta_cents: 0,
            allow_description_only: true,
          },
        ],
        p_client_mutation_id: mut,
        p_pricing_mode: 'price_book',
        p_submit_for_approval: true,
        p_evidence_refs: [{ ref: `synth/s4/${RUN_TAG}/co-evidence.txt`, kind: 'note' }],
      });
      coId = data?.change_order_id || null;
      step('tech_co_propose', !error && !!coId, error?.message || data);
    }

    // Tech self-approve must DENY
    {
      const mut = `s4-tech-self-approve-${randomUUID()}`;
      const { error } = await rpc(techAuth.c, 'ml_p1_s4_change_order_transition', {
        p_change_order_id: coId,
        p_action: 'approve_break_glass',
        p_client_mutation_id: mut,
        p_reason: 'should deny',
        p_customer_auth_proof: 'x',
        p_customer_auth_evidence_type: 'recorded_verbal',
        p_customer_auth_evidence_ref: `synth/s4/${RUN_TAG}/should-deny`,
        p_customer_auth_at: new Date().toISOString(),
      });
      const denied = !!error && /TECH_SELF_APPROVE_DENY|ROLE_DENY|42501|permission|deny/i.test(error.message);
      step('tech_self_approve_deny', denied, error?.message || 'expected deny');
    }

    // Office break-glass approve with immutable evidence (allowlisted type)
    {
      const mut = `s4-office-bg-${randomUUID()}`;
      const { data, error } = await rpc(officeAuth.c, 'ml_p1_s4_change_order_transition', {
        p_change_order_id: coId,
        p_action: 'approve_break_glass',
        p_client_mutation_id: mut,
        p_reason: 'S4 synthetic office break-glass — customer unreachable; test only',
        p_customer_auth_proof: `synth-proof-${RUN_TAG}`,
        p_customer_auth_evidence_type: 'recorded_verbal',
        p_customer_auth_evidence_ref: `synth/s4/${RUN_TAG}/break-glass-proof.wav`,
        p_customer_auth_at: new Date().toISOString(),
      });
      step('office_co_break_glass_approve', !error && data?.status === 'approved', error?.message || data);
    }

    // Make-safe (in_person notify — no SMS/email automation)
    {
      const mut = `s4-tech-ms-${randomUUID()}`;
      const { data, error } = await rpc(techAuth.c, 'ml_p1_s4_record_make_safe', {
        p_job_id: jobId,
        p_action_type: 'document_condition',
        p_summary: 'S4 synthetic make-safe documentation only — never billable',
        p_client_mutation_id: mut,
        p_evidence_refs: [],
        p_reason_code: 'unsafe_condition_documented',
        p_customer_notification_method: 'in_person',
        p_evidence_before_ref: `synth/s4/${RUN_TAG}/ms-before.jpg`,
        p_evidence_after_ref: `synth/s4/${RUN_TAG}/ms-after.jpg`,
      });
      step('tech_make_safe', !error && !!data, error?.message || data);
    }

    // Evidence + completion readiness
    {
      const mut = `s4-tech-ev-${randomUUID()}`;
      const { data, error } = await rpc(techAuth.c, 'ml_p1_s4_upsert_evidence', {
        p_job_id: jobId,
        p_client_mutation_id: mut,
        p_technician_notes: 'S4 synthetic technician notes — DO NOT CONTACT',
        p_customer_summary: 'S4 synthetic customer summary — test only',
        p_execution_findings: [{ code: 'synth_ok', detail: 'Synthetic finding' }],
        p_execution_photos: [
          { kind: 'before', object_path: `synth/s4/${RUN_TAG}/before.jpg` },
          { kind: 'after', object_path: `synth/s4/${RUN_TAG}/after.jpg` },
        ],
        p_execution_checklist: {
          materials_declared: true,
          approved_change_orders_accounted: true,
        },
        p_materials_none: true,
        p_customer_ack_method: 'in_person',
        p_customer_ack_waiver_reason: null,
      });
      step('tech_upsert_evidence', !error && !!data, error?.message || data?.job_id);
    }

    {
      const { data, error } = await rpc(techAuth.c, 'ml_p1_s4_completion_readiness', { p_job_id: jobId });
      step('completion_readiness_ready', !error && data?.ready === true, error?.message || data);
    }

    {
      const mut = `s4-tech-complete-${randomUUID()}`;
      const { data, error } = await rpc(techAuth.c, 'ml_p1_s4_job_transition', {
        p_job_id: jobId,
        p_action: 'complete_finalize',
        p_client_mutation_id: mut,
        p_reason: null,
        p_expected_row_version: null,
        p_payload: {},
      });
      step(
        'tech_complete_finalize',
        !error && data?.status === 'completed' && data?.invoice_created === false,
        error?.message || data,
      );
    }

    // No invoice created for synthetic job
    {
      const { data: inv, error } = await admin.from('invoices').select('id').eq('job_id', jobId);
      step('no_invoice_created', !error && (inv || []).length === 0, error?.message || { count: (inv || []).length });
    }

    // Office can read readiness / job status
    {
      const { data: j, error } = await admin.from('jobs').select('status,is_test_data,technician_id').eq('id', jobId).single();
      step(
        'final_job_posture',
        !error && j?.status === 'completed' && j?.is_test_data === true && j?.technician_id === EXPECT_TECH_ROSTER,
        j,
      );
    }
  } finally {
    // Cleanup synthetic graph
    const cleanup = { leadId, jobId, coId, errors: [] };
    try {
      if (jobId) {
        await admin.from('job_execution_mutations').delete().eq('job_id', jobId);
        await admin.from('job_time_events').delete().eq('job_id', jobId);
        await admin.from('job_make_safe_events').delete().eq('job_id', jobId);
        const { data: cos } = await admin.from('change_orders').select('id').eq('job_id', jobId);
        const coIds = (cos || []).map((c) => c.id);
        if (coIds.length) {
          await admin.from('change_order_events').delete().in('change_order_id', coIds);
          await admin.from('change_order_items').delete().in('change_order_id', coIds);
          await admin.from('change_orders').delete().in('id', coIds);
        }
        await admin.from('events').delete().eq('entity_id', jobId);
        await admin.from('invoices').delete().eq('job_id', jobId);
        const { error: jobDelErr } = await admin.from('jobs').delete().eq('id', jobId).eq('is_test_data', true);
        if (jobDelErr) cleanup.errors.push(jobDelErr.message);
      }
      if (leadId) {
        const { error: leadDelErr } = await admin.from('leads').delete().eq('id', leadId).eq('is_test_data', true);
        if (leadDelErr) cleanup.errors.push(leadDelErr.message);
      }
    } catch (e) {
      cleanup.errors.push(String(e?.message || e));
    }

    // Aggregate cleanup verification
    const { count: jobCount } = await admin
      .from('jobs')
      .select('id', { count: 'exact', head: true })
      .eq('is_test_data', true)
      .ilike('customer_email', '%synth.job.s4.%');
    const { count: leadCount } = await admin
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('is_test_data', true)
      .ilike('name', '%ML-P1-S4%');
    const { count: orphanJobs } = await admin
      .from('jobs')
      .select('id', { count: 'exact', head: true })
      .eq('id', jobId || '00000000-0000-0000-0000-000000000000');
    const { count: orphanLeads } = await admin
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('id', leadId || '00000000-0000-0000-0000-000000000000');

    step('cleanup_job_gone', (orphanJobs || 0) === 0, { orphanJobs, jobId });
    step('cleanup_lead_gone', (orphanLeads || 0) === 0, { orphanLeads, leadId });
    step('cleanup_aggregate_synth_jobs', (jobCount || 0) === 0, { jobCount });
    step('cleanup_aggregate_synth_leads', (leadCount || 0) === 0, { leadCount });
    step('cleanup_no_errors', cleanup.errors.length === 0, cleanup.errors);

    await officeAuth.c.auth.signOut();
    await techAuth.c.auth.signOut();
  }

  const failed = results.filter((r) => !r.ok);
  const disposition = failed.length === 0 ? 'SLICE4_PRODUCTION_VALIDATION_PASS' : 'SLICE4_PRODUCTION_VALIDATION_FAIL';
  const out = {
    disposition,
    runTag: RUN_TAG,
    techEmail: TECH_EMAIL,
    officeEmail: OFFICE_EMAIL,
    techUid: EXPECT_TECH_UID,
    officeUid: EXPECT_OFFICE_UID,
    techRosterId: EXPECT_TECH_ROSTER,
    results,
    failed: failed.map((f) => f.name),
    at: new Date().toISOString(),
  };
  const outPath = path.join(root, 'docs/stabilization/releases/ML-P1_SLICE4_SYNTH_PROD_VALIDATION_RESULT.json');
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(`\nDISPOSITION: ${disposition}`);
  console.log(`Wrote ${outPath}`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('FATAL', err);
  process.exit(2);
});
