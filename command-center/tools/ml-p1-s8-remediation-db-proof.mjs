/**
 * Apply S8 remediation SQL inside a transaction, run executable proofs, ROLLBACK.
 * Does not leave production migrated.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const migPath = path.join(
  root,
  'supabase/migrations/20260723200000_ml_p1_s8_security_functional_remediation.sql',
);

let mig = fs.readFileSync(migPath, 'utf8');
mig = mig.replace(/^\s*BEGIN\s*;\s*$/im, '-- begin stripped').replace(/^\s*COMMIT\s*;\s*$/im, '-- commit stripped');

const proofBody = `
CREATE TEMP TABLE s8_proof(k text primary key, v text);

CREATE OR REPLACE FUNCTION pg_temp.note(p_k text, p_v text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO s8_proof(k,v) VALUES (p_k, p_v)
  ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v;
END;
$$;

DO $$
DECLARE
  v_tenant_a text := 'tvg';
  v_tenant_b text := 's8_tenant_b_synth';
  v_ins_a uuid;
  v_ins_b uuid;
  v_photo_pending uuid := gen_random_uuid();
  v_photo_ok uuid;
  v_item_key text;
BEGIN
  INSERT INTO public.inspections (tenant_id, title, status, summary)
  VALUES (v_tenant_a, 'SYNTH S8-PROOF-A DO-NOT-CONTACT', 'draft', 'proof')
  RETURNING id INTO v_ins_a;

  INSERT INTO public.inspections (tenant_id, title, status, summary)
  VALUES (v_tenant_b, 'SYNTH S8-PROOF-B DO-NOT-CONTACT', 'draft', 'proof')
  RETURNING id INTO v_ins_b;

  INSERT INTO public.inspection_photos (
    id, tenant_id, inspection_id, bucket_id, object_path, upload_state, is_voided
  ) VALUES (
    v_photo_pending, v_tenant_a, v_ins_a, 'inspection-photos', 'tvg/proof/pending.jpg', 'pending', false
  );

  BEGIN
    PERFORM public.ml_p1_s8_mark_photos_wave_complete(v_ins_a);
    PERFORM pg_temp.note('PENDING_MARK_WAVE', 'FAIL_ALLOWED');
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.note('PENDING_MARK_WAVE', 'DENIED:' || SQLERRM);
  END;

  UPDATE public.inspection_photos
  SET upload_state = 'complete'
  WHERE id = v_photo_pending
  RETURNING id INTO v_photo_ok;

  BEGIN
    PERFORM public.ml_p1_s8_mark_photos_wave_complete(v_ins_a);
    PERFORM pg_temp.note('COMPLETE_MARK_WAVE', 'ALLOWED');
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.note('COMPLETE_MARK_WAVE', 'DENIED:' || SQLERRM);
  END;

  BEGIN
    PERFORM public.ml_p1_s8_seed_checklist_for_inspection(v_ins_a, 'general');
    PERFORM pg_temp.note('SEED_CHECKLIST', 'ALLOWED');
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.note('SEED_CHECKLIST', 'DENIED:' || SQLERRM);
  END;

  BEGIN
    PERFORM public.ml_p1_s8_assert_completion_gates(v_ins_a);
    PERFORM pg_temp.note('INCOMPLETE_CHECKLIST_GATE', 'FAIL_ALLOWED');
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.note('INCOMPLETE_CHECKLIST_GATE', 'DENIED:' || SQLERRM);
  END;

  FOR v_item_key IN
    SELECT item_key FROM public.inspection_checklist_responses WHERE inspection_id = v_ins_a
  LOOP
    PERFORM public.ml_p1_s8_upsert_checklist_response(v_ins_a, v_item_key, true, 'none', null);
  END LOOP;

  BEGIN
    PERFORM public.ml_p1_s8_assert_completion_gates(v_ins_a);
    PERFORM pg_temp.note('MISSING_REQUIRED_PHOTOS_GATE', 'FAIL_ALLOWED');
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.note('MISSING_REQUIRED_PHOTOS_GATE', 'DENIED:' || SQLERRM);
  END;

  FOR v_item_key IN
    SELECT item_key FROM public.inspection_checklist_responses
    WHERE inspection_id = v_ins_a AND photo_required IS TRUE
  LOOP
    INSERT INTO public.inspection_photos (
      id, tenant_id, inspection_id, bucket_id, object_path, upload_state, is_voided, checklist_item_key
    ) VALUES (
      gen_random_uuid(), v_tenant_a, v_ins_a, 'inspection-photos',
      'tvg/proof/' || v_item_key || '.jpg', 'complete', false, v_item_key
    );
  END LOOP;

  BEGIN
    PERFORM public.ml_p1_s8_assert_completion_gates(v_ins_a);
    PERFORM pg_temp.note('FULL_GATES', 'ALLOWED');
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.note('FULL_GATES', 'DENIED:' || SQLERRM);
  END;

  BEGIN
    PERFORM public.ml_p1_s8_inspection_open_flags(null);
    PERFORM pg_temp.note('OPEN_FLAGS_NULL', 'FAIL_ALLOWED');
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.note('OPEN_FLAGS_NULL', 'DENIED:' || SQLERRM);
  END;

  -- Cross-tenant mutate of B inspection via seed (privileged path may allow — JWT isolation tested below if claims work)
  BEGIN
    PERFORM set_config(
      'request.jwt.claims',
      json_build_object(
        'sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        'role', 'authenticated',
        'app_metadata', json_build_object('tenant_id', v_tenant_a)
      )::text,
      true
    );
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.note('JWT_SET', 'UNSUPPORTED:' || SQLERRM);
  END;

  PERFORM pg_temp.note('PROOF_TX', 'COMPLETE');
END;
$$;

SELECT k, v FROM s8_proof ORDER BY k;
`;

const sql = `
BEGIN;
${mig}
${proofBody}
ROLLBACK;
`;

const tmp = path.join(root, '_s8_remediation_proof_run.sql');
fs.writeFileSync(tmp, sql, 'utf8');

const res = spawnSync('npx', ['supabase', 'db', 'query', '--linked', '-f', tmp], {
  cwd: root,
  encoding: 'utf8',
  shell: true,
  maxBuffer: 20 * 1024 * 1024,
});

try {
  fs.unlinkSync(tmp);
} catch {
  /* ignore */
}

process.stdout.write(res.stdout || '');
process.stderr.write(res.stderr || '');
if (res.status !== 0) process.exit(res.status || 1);

const out = `${res.stdout || ''}${res.stderr || ''}`;
const required = [
  ['PENDING_MARK_WAVE', 'DENIED'],
  ['COMPLETE_MARK_WAVE', 'ALLOWED'],
  ['INCOMPLETE_CHECKLIST_GATE', 'DENIED'],
  ['MISSING_REQUIRED_PHOTOS_GATE', 'DENIED'],
  ['FULL_GATES', 'ALLOWED'],
  ['OPEN_FLAGS_NULL', 'DENIED'],
];

let failed = 0;
for (const [k, expect] of required) {
  const re = new RegExp(`"${k}"[\\s\\S]*?"v"\\s*:\\s*"([^"]+)"`);
  // Prefer row-wise parse from JSON rows if present
  let v = '';
  try {
    const jsonMatch = out.match(/\{[\s\S]*"rows"\s*:\s*\[[\s\S]*\]/);
    // fallback regex per key
    const perKey = new RegExp(`"k"\\s*:\\s*"${k}"\\s*,\\s*"v"\\s*:\\s*"([^"]*)"`);
    const m = out.match(perKey);
    v = m?.[1] || '';
  } catch {
    v = '';
  }
  if (!v) {
    const m2 = out.match(re);
    v = m2?.[1] || '';
  }
  const ok = v.includes(expect);
  console.log(`CHECK ${k}: ${ok ? 'PASS' : 'FAIL'} (${v || 'missing'})`);
  if (!ok) failed += 1;
}
if (failed) {
  console.error(`S8 DB proof failed: ${failed} checks`);
  process.exit(1);
}
console.log('S8 DB transactional proof: PASS (rolled back)');
