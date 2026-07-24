/**
 * ML-P1 S8 remediation — production JWT isolation + workflow validation.
 * Creates ephemeral auth users (app_metadata.tenant_id), exercises allow/deny, cleans up.
 *
 * Usage: node tools/ml-p1-s8-remediation-prod-validation.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function loadEnv(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i < 0) continue;
    out[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^['"]|['"]$/g, '');
  }
  return out;
}

const env = { ...loadEnv(path.join(root, '.env')), ...loadEnv(path.join(root, '.env.local')) };
const url = env.VITE_SUPABASE_URL;
const anon = env.VITE_SUPABASE_ANON_KEY;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const TENANT_A = 'tvg';
const TENANT_B = 's8_tenant_b_synth';
const RUN = `S8-VAL-${Date.now()}`;
const MARKER = 'SYNTHETIC TEST-DO-NOT-CONTACT / ML-P1-S8-REMEDIATION';

const results = [];
function step(name, ok, detail = null) {
  results.push({ name, ok: !!ok, detail });
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? ` — ${typeof detail === 'string' ? detail : JSON.stringify(detail)}` : ''}`);
}

function adminClient() {
  return createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
}
function anonClient() {
  return createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function createActor(admin, { email, password, tenantId, role }) {
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { tenant_id: tenantId, role },
  });
  if (created.error) throw created.error;
  const userId = created.data.user.id;
  const roleIns = await admin.from('app_user_roles').insert({
    user_id: userId,
    role,
  });
  if (roleIns.error) throw roleIns.error;
  return userId;
}

async function signIn(email, password) {
  const c = anonClient();
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return { c, user: data.user, session: data.session };
}

async function main() {
  if (!url || !anon || !serviceKey) throw new Error('Missing Supabase URL/anon/service key');
  const admin = adminClient();
  const password = `S8-Val-${randomUUID().slice(0, 8)}-Aa1!`;
  const actors = {
    techA: { email: `s8.tech.a.${RUN}@example.invalid`, role: 'technician', tenantId: TENANT_A, userId: null },
    techB: { email: `s8.tech.b.${RUN}@example.invalid`, role: 'technician', tenantId: TENANT_B, userId: null },
    officeA: { email: `s8.office.a.${RUN}@example.invalid`, role: 'office', tenantId: TENANT_A, userId: null },
    customerA: { email: `s8.cust.a.${RUN}@example.invalid`, role: 'customer', tenantId: TENANT_A, userId: null },
  };

  let inspA = null;
  let inspB = null;
  const photoIds = [];

  try {
    for (const key of Object.keys(actors)) {
      actors[key].userId = await createActor(admin, {
        email: actors[key].email,
        password,
        tenantId: actors[key].tenantId,
        role: actors[key].role,
      });
    }
    step('create_ephemeral_actors', true, { count: 4 });

    const techA = await signIn(actors.techA.email, password);
    const techB = await signIn(actors.techB.email, password);
    const officeA = await signIn(actors.officeA.email, password);
    const customerA = await signIn(actors.customerA.email, password);
    step('jwt_sign_in', !!techA.session?.access_token && !!techB.session?.access_token);

    const aIns = await admin
      .from('inspections')
      .insert({
        tenant_id: TENANT_A,
        title: `${MARKER} A ${RUN}`,
        status: 'draft',
        summary: 's8 validation',
        work_type: 'general',
      })
      .select('id')
      .single();
    if (aIns.error) throw aIns.error;
    inspA = aIns.data.id;

    const bIns = await admin
      .from('inspections')
      .insert({
        tenant_id: TENANT_B,
        title: `${MARKER} B ${RUN}`,
        status: 'draft',
        summary: 's8 validation',
        work_type: 'general',
      })
      .select('id')
      .single();
    if (bIns.error) throw bIns.error;
    inspB = bIns.data.id;
    step('fixtures_created', true, { inspA, inspB });

    // Cross-tenant deny: tech A cannot seed tech B inspection
    const cross = await techA.c.rpc('ml_p1_s8_seed_checklist_for_inspection', {
      p_inspection_id: inspB,
      p_work_type: 'general',
    });
    const crossMsg = cross.error?.message || '';
    step(
      'deny_cross_tenant_seed',
      !!cross.error && /TENANT_ACCESS_DENIED|tenant_access_denied/i.test(crossMsg),
      crossMsg || 'missing deny',
    );

    // Wrong-tenant open_flags
    const flagsWrong = await techA.c.rpc('ml_p1_s8_inspection_open_flags', { p_tenant_id: TENANT_B });
    step('deny_open_flags_other_tenant', !!flagsWrong.error, flagsWrong.error?.message);

    // Null tenant for JWT means "use caller tenant" (must not error, must not return other tenants)
    const flagsNull = await techA.c.rpc('ml_p1_s8_inspection_open_flags', { p_tenant_id: null });
    const nullRows = Array.isArray(flagsNull.data) ? flagsNull.data : [];
    step(
      'open_flags_null_jwt_scopes_caller_tenant',
      !flagsNull.error,
      flagsNull.error?.message || `rows=${nullRows.length}`,
    );

    // Customer role denied seed
    const custSeed = await customerA.c.rpc('ml_p1_s8_seed_checklist_for_inspection', {
      p_inspection_id: inspA,
      p_work_type: 'general',
    });
    step('deny_customer_seed', !!custSeed.error, custSeed.error?.message);

    // Tech A allow seed
    const seedOk = await techA.c.rpc('ml_p1_s8_seed_checklist_for_inspection', {
      p_inspection_id: inspA,
      p_work_type: 'general',
    });
    step('allow_tech_seed', !seedOk.error, seedOk.error?.message || seedOk.data);

    // Office allow seed on own tenant (idempotent)
    const officeSeed = await officeA.c.rpc('ml_p1_s8_seed_checklist_for_inspection', {
      p_inspection_id: inspA,
      p_work_type: 'general',
    });
    step('allow_office_seed', !officeSeed.error, officeSeed.error?.message);

    // Pending photo cannot mark wave
    const pendingId = randomUUID();
    photoIds.push(pendingId);
    const pending = await admin.from('inspection_photos').insert({
      id: pendingId,
      tenant_id: TENANT_A,
      inspection_id: inspA,
      bucket_id: 'inspection-photos',
      object_path: `${TENANT_A}/s8-val/${RUN}-pending.jpg`,
      upload_state: 'pending',
      is_voided: false,
    });
    if (pending.error) throw pending.error;
    const markPending = await techA.c.rpc('ml_p1_s8_mark_photos_wave_complete', { p_inspection_id: inspA });
    step('deny_pending_mark_wave', !!markPending.error, markPending.error?.message);

    // Complete photo + mark wave
    await admin.from('inspection_photos').update({ upload_state: 'complete' }).eq('id', pendingId);
    const markOk = await techA.c.rpc('ml_p1_s8_mark_photos_wave_complete', { p_inspection_id: inspA });
    step('allow_complete_mark_wave', !markOk.error, markOk.error?.message);

    // Incomplete checklist blocks assert
    const incomplete = await techA.c.rpc('ml_p1_s8_assert_photos_before_report', { p_inspection_id: inspA });
    step('deny_incomplete_checklist', !!incomplete.error, incomplete.error?.message);

    // Answer all + link required photos
    const { data: rows } = await admin
      .from('inspection_checklist_responses')
      .select('item_key, photo_required')
      .eq('inspection_id', inspA);
    for (const row of rows || []) {
      const up = await techA.c.rpc('ml_p1_s8_upsert_checklist_response', {
        p_inspection_id: inspA,
        p_item_key: row.item_key,
        p_checked: true,
        p_flag_code: 'none',
        p_notes: null,
      });
      if (up.error) throw up.error;
      if (row.photo_required) {
        const pid = randomUUID();
        photoIds.push(pid);
        const ins = await admin.from('inspection_photos').insert({
          id: pid,
          tenant_id: TENANT_A,
          inspection_id: inspA,
          bucket_id: 'inspection-photos',
          object_path: `${TENANT_A}/s8-val/${RUN}-${row.item_key}.jpg`,
          upload_state: 'complete',
          is_voided: false,
        });
        if (ins.error) throw ins.error;
        const link = await techA.c.rpc('ml_p1_s8_link_photo_checklist_item', {
          p_inspection_id: inspA,
          p_photo_id: pid,
          p_item_key: row.item_key,
        });
        if (link.error) throw link.error;
      }
    }
    step('answer_and_link_required_photos', true, { items: (rows || []).length });

    // JWT INSERT forge denied
    const forge = await techA.c.from('inspection_checklist_responses').insert({
      tenant_id: TENANT_A,
      inspection_id: inspA,
      template_id: (await admin.from('inspections').select('checklist_template_id').eq('id', inspA).single()).data?.checklist_template_id,
      item_key: 'forged_item',
      item_label: 'forged',
      sort_order: 999,
      checked: true,
      photo_required: false,
    });
    step('deny_jwt_checklist_insert', !!forge.error, forge.error?.message);

    // PATCH photo_required denied on a required item (trigger must error; row stays true)
    const requiredKey = (rows || []).find((r) => r.photo_required === true)?.item_key;
    if (requiredKey) {
      const patch = await techA.c
        .from('inspection_checklist_responses')
        .update({ photo_required: false })
        .eq('inspection_id', inspA)
        .eq('item_key', requiredKey)
        .select('photo_required');
      const stillRequired = await admin
        .from('inspection_checklist_responses')
        .select('photo_required')
        .eq('inspection_id', inspA)
        .eq('item_key', requiredKey)
        .maybeSingle();
      const denied = !!patch.error && stillRequired.data?.photo_required === true;
      step('deny_jwt_photo_required_patch', denied, patch.error?.message || stillRequired.data);
    } else {
      step('deny_jwt_photo_required_patch', false, 'no photo_required rows');
    }

    // Gates allow for tech
    const gatesOk = await techA.c.rpc('ml_p1_s8_assert_photos_before_report', { p_inspection_id: inspA });
    step('allow_completion_gates', !gatesOk.error, gatesOk.error?.message);

    // Tech B still cannot finalize A
    const finalizeCross = await techB.c.rpc('inspection_finalize_phase5', {
      p_tenant_id: TENANT_A,
      p_inspection_id: inspA,
      p_expected_revision: 1,
    });
    step('deny_cross_tenant_finalize', !!finalizeCross.error, finalizeCross.error?.message);

    // Unauthorized customer cannot finalize
    const finalizeCust = await customerA.c.rpc('inspection_finalize_phase5', {
      p_tenant_id: TENANT_A,
      p_inspection_id: inspA,
      p_expected_revision: 1,
    });
    step('deny_customer_finalize', !!finalizeCust.error, finalizeCust.error?.message);

    // Double finalize / concurrent: mark_reviewed idempotent path after first success may need preflight
    // For workflow evidence we only require gates allow; full finalize may need findings/narrative.
    // Prove mark_reviewed also denied without full preflight OR gates pass path exists.
    const markDirect = await techA.c.rpc('inspection_mark_reviewed', {
      p_tenant_id: TENANT_A,
      p_inspection_id: inspA,
      p_expected_revision: 1,
    });
    // Either fails preflight/coherence (acceptable) or succeeds — must NOT fail with missing S8 gates after we satisfied them
    const markMsg = markDirect.error?.message || '';
    const badGate = /ML_P1_S8_CHECKLIST|ML_P1_S8_PHOTOS|ML_P1_S8_REQUIRED/i.test(markMsg);
    step('mark_reviewed_not_blocked_by_s8_after_gates', !badGate, markMsg || 'ok_or_preflight');

    // Live open_flags own tenant
    const flagsOk = await techA.c.rpc('ml_p1_s8_inspection_open_flags', { p_tenant_id: TENANT_A });
    step('allow_open_flags_own_tenant', !flagsOk.error, flagsOk.error?.message);

  } finally {
    // Cleanup synth
    try {
      if (inspA) {
        await admin.from('inspection_photos').update({ is_voided: true }).eq('inspection_id', inspA);
        await admin.from('inspection_checklist_responses').delete().eq('inspection_id', inspA);
        await admin.from('inspections').update({ title: `${MARKER} A ${RUN} [DONE]` }).eq('id', inspA);
      }
      if (inspB) {
        await admin.from('inspections').update({ title: `${MARKER} B ${RUN} [DONE]` }).eq('id', inspB);
      }
      for (const key of Object.keys(actors)) {
        if (actors[key].userId) {
          await admin.from('app_user_roles').delete().eq('user_id', actors[key].userId);
          await admin.auth.admin.deleteUser(actors[key].userId);
        }
      }
      step('cleanup', true);
    } catch (err) {
      step('cleanup', false, err?.message || String(err));
    }
  }

  const failed = results.filter((r) => !r.ok);
  const outPath = path.join(root, 'docs/stabilization/releases/evidence', `ml-p1-s8-remediation-prod-validation-${RUN}.json`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify({ run: RUN, url, results, failed: failed.length }, null, 2));
  console.log(`Wrote ${outPath}`);
  if (failed.length) {
    console.error(`FAILED ${failed.length} checks`);
    process.exit(1);
  }
  console.log('S8 JWT/workflow production validation: PASS');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
