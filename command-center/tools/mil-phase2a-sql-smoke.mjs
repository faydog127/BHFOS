#!/usr/bin/env node
/**
 * mil-phase2a-sql-smoke.mjs — fail-closed disposable SQL integration runner.
 *
 * Requires LOCAL_DB_URL (preferred) or SUPABASE_DB_URL pointing at a disposable
 * local Postgres (127.0.0.1 / localhost). Refuses CRM ref wwyx….
 *
 * Exit codes:
 *   0  successful A → B → verify → rollback → post-rollback → reapply A/B
 *   2  refused forbidden CRM URL
 *   3  NOT_CONFIGURED (missing LOCAL_DB_URL)
 *   4  migration failure
 *   5  verification failure
 *   6  rollback failure
 *   1  other failure
 *
 * Skipped SQL execution is NEVER labeled PASS.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CRM = 'wwyxohjnyqnegzbxtuxs';
const MIL = 'sdzhdupekcnekesbtxsl';

const migARel = 'supabase/migrations/20260802120000_media_intel_phase2a_additive.sql';
const migBRel = 'supabase/migrations/20260802130000_media_intel_phase2a_lockdown.sql';
const rollbackRel = 'supabase/rollbacks/phase2a_media_intel_rollback.sql';
const verifyRel = 'supabase/tests/mil/phase2a_verification.sql';
const postRollbackRel = 'supabase/tests/mil/phase2a_post_rollback.sql';

function mustExist(rel) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) throw new Error(`missing ${rel}`);
  const text = fs.readFileSync(abs, 'utf8');
  if (text.length < 200) throw new Error(`too small: ${rel}`);
  return abs;
}

function resolveDbUrl() {
  return (
    process.env.LOCAL_DB_URL
    || process.env.SUPABASE_DB_URL
    || process.env.DATABASE_URL
    || ''
  ).trim();
}

function assertLocalDisposable(url) {
  if (!url) {
    console.error(JSON.stringify({
      ok: false,
      status: 'NOT_CONFIGURED',
      detail: 'LOCAL_DB_URL is required. Example: postgresql://postgres:postgres@127.0.0.1:25432/postgres',
      note: 'Skipped SQL execution is not PASS.',
    }, null, 2));
    process.exit(3);
  }
  if (url.includes(CRM)) {
    console.error(JSON.stringify({
      ok: false,
      status: 'REFUSED_FORBIDDEN_CRM',
      detail: `Refusing DB URL that mentions ${CRM}`,
    }, null, 2));
    process.exit(2);
  }
  const local = /127\.0\.0\.1|localhost/.test(url);
  if (!local) {
    console.error(JSON.stringify({
      ok: false,
      status: 'REFUSED_NON_LOCAL',
      detail: 'DB URL must target 127.0.0.1 or localhost disposable stack',
    }, null, 2));
    process.exit(2);
  }
}

function runPsql(dbUrl, fileAbs, label) {
  const psql = process.env.PSQL_PATH || 'psql';
  const args = [
    dbUrl,
    '-v', 'ON_ERROR_STOP=1',
    '-f', fileAbs,
  ];
  const res = spawnSync(psql, args, {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env },
  });
  return {
    label,
    status: res.status,
    stdout: res.stdout || '',
    stderr: res.stderr || '',
    error: res.error ? String(res.error.message || res.error) : null,
  };
}

function runSupabaseDbReset() {
  const res = spawnSync(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['supabase', 'db', 'reset', '--yes'],
    {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env },
      shell: process.platform === 'win32',
    },
  );
  return {
    label: 'baseline_reset',
    status: res.status,
    stdout: res.stdout || '',
    stderr: res.stderr || '',
    error: res.error ? String(res.error.message || res.error) : null,
  };
}

function fail(code, status, detail, extras = {}) {
  console.error(JSON.stringify({ ok: false, status, detail, ...extras }, null, 2));
  process.exit(code);
}

function main() {
  const migA = mustExist(migARel);
  const migB = mustExist(migBRel);
  const rollback = mustExist(rollbackRel);
  const verify = mustExist(verifyRel);
  const postRollback = mustExist(postRollbackRel);

  const migAText = fs.readFileSync(migA, 'utf8');
  const migBText = fs.readFileSync(migB, 'utf8');
  if (!migAText.includes('ADDITIVE')) throw new Error('Migration A missing ADDITIVE marker');
  if (!migBText.includes('RESTRICTIVE LOCKDOWN')) throw new Error('Migration B missing lockdown marker');
  if (!migBText.includes('revoke update on public.mil_assets')) {
    throw new Error('Migration B must revoke table-level UPDATE on mil_assets');
  }

  const dbUrl = resolveDbUrl();
  assertLocalDisposable(dbUrl);

  const steps = [];

  // 1) Baseline reset applies the full migration chain including A+B.
  console.error('[phase2a-sql] baseline reset (supabase db reset --yes)…');
  const reset = runSupabaseDbReset();
  steps.push({
    step: reset.label,
    ok: reset.status === 0,
    status: reset.status,
    stderrTail: (reset.stderr || reset.stdout || '').slice(-2000),
  });
  if (reset.status !== 0) {
    fail(4, 'MIGRATION_FAILURE', 'baseline supabase db reset failed', { steps, error: reset.error });
  }

  // 2) Verification suite (A+B already applied by reset)
  console.error('[phase2a-sql] verification suite…');
  const ver = runPsql(dbUrl, verify, 'verification');
  steps.push({
    step: ver.label,
    ok: ver.status === 0 && /PHASE2A_VERIFICATION_PASS/.test(ver.stdout),
    status: ver.status,
    stdoutTail: ver.stdout.slice(-2000),
    stderrTail: ver.stderr.slice(-2000),
  });
  if (ver.status !== 0 || !/PHASE2A_VERIFICATION_PASS/.test(ver.stdout)) {
    fail(5, 'VERIFICATION_FAILURE', 'phase2a_verification.sql failed', { steps });
  }

  // 3) Rollback
  console.error('[phase2a-sql] rollback…');
  const rb = runPsql(dbUrl, rollback, 'rollback');
  steps.push({
    step: rb.label,
    ok: rb.status === 0,
    status: rb.status,
    stderrTail: (rb.stderr || rb.stdout || '').slice(-2000),
  });
  if (rb.status !== 0) {
    fail(6, 'ROLLBACK_FAILURE', 'phase2a rollback SQL failed', { steps });
  }

  // 4) Post-rollback suite
  console.error('[phase2a-sql] post-rollback suite…');
  const post = runPsql(dbUrl, postRollback, 'post_rollback');
  steps.push({
    step: post.label,
    ok: post.status === 0 && /PHASE2A_POST_ROLLBACK_PASS/.test(post.stdout),
    status: post.status,
    stdoutTail: post.stdout.slice(-2000),
    stderrTail: post.stderr.slice(-2000),
  });
  if (post.status !== 0 || !/PHASE2A_POST_ROLLBACK_PASS/.test(post.stdout)) {
    fail(5, 'VERIFICATION_FAILURE', 'post-rollback suite failed', { steps });
  }

  // 5) Reapply A then B (rerun safety)
  console.error('[phase2a-sql] reapply Migration A…');
  const a2 = runPsql(dbUrl, migA, 'reapply_A');
  steps.push({
    step: a2.label,
    ok: a2.status === 0,
    status: a2.status,
    stderrTail: (a2.stderr || a2.stdout || '').slice(-2000),
  });
  if (a2.status !== 0) {
    fail(4, 'MIGRATION_FAILURE', 'reapply Migration A failed', { steps });
  }

  console.error('[phase2a-sql] reapply Migration B…');
  const b2 = runPsql(dbUrl, migB, 'reapply_B');
  steps.push({
    step: b2.label,
    ok: b2.status === 0,
    status: b2.status,
    stderrTail: (b2.stderr || b2.stdout || '').slice(-2000),
  });
  if (b2.status !== 0) {
    fail(4, 'MIGRATION_FAILURE', 'reapply Migration B failed', { steps });
  }

  console.log(JSON.stringify({
    ok: true,
    status: 'SUCCESSFUL_AB_VERIFY_ROLLBACK_REAPPLY',
    migrationA: path.basename(migARel),
    migrationB: path.basename(migBRel),
    rollback: rollbackRel,
    verification: verifyRel,
    postRollback: postRollbackRel,
    db: 'local_disposable',
    forbiddenRef: CRM,
    milRef: MIL,
    steps,
  }, null, 2));
}

try {
  main();
} catch (e) {
  console.error(JSON.stringify({
    ok: false,
    status: 'RUNNER_FAILURE',
    detail: e instanceof Error ? e.message : String(e),
  }, null, 2));
  process.exit(1);
}
