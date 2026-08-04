#!/usr/bin/env node
/**
 * mil-phase2a-reel-mint-concurrency.mjs
 *
 * True independent-session concurrent reel-mint proof against a disposable
 * local Postgres. Does NOT serialize both calls on one connection.
 *
 * Architecture:
 *   - Parent seeds fixtures on connection A
 *   - Two child `psql` processes each open their own backend session
 *   - Workers rendezvous on a barrier table, then call the RPC
 *   - Parent asserts IDs, row counts, negatives, and response-loss retry
 *
 * Exit: 0 PASS · 2 refused URL · 3 NOT_CONFIGURED · 5 assertion failure · 1 other
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const CRM = 'wwyxohjnyqnegzbxtuxs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const psqlBin = process.env.PSQL_PATH || 'psql';

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
      detail: 'LOCAL_DB_URL is required for concurrent mint proof',
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
  if (!/127\.0\.0\.1|localhost/.test(url)) {
    console.error(JSON.stringify({
      ok: false,
      status: 'REFUSED_NON_LOCAL',
      detail: 'DB URL must target 127.0.0.1 or localhost disposable stack',
    }, null, 2));
    process.exit(2);
  }
}

function psqlFile(dbUrl, sql, label) {
  const tmp = path.join(os.tmpdir(), `mil-conc-${label}-${process.pid}-${Date.now()}.sql`);
  fs.writeFileSync(tmp, sql, 'utf8');
  try {
    const res = spawnSync(psqlBin, [dbUrl, '-v', 'ON_ERROR_STOP=1', '-f', tmp], {
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
  } finally {
    try { fs.unlinkSync(tmp); } catch { /* ignore */ }
  }
}

function psqlTuples(dbUrl, sql) {
  const res = spawnSync(
    psqlBin,
    [dbUrl, '-v', 'ON_ERROR_STOP=1', '-t', '-A', '-F', '\t', '-c', sql],
    { encoding: 'utf8', env: { ...process.env } },
  );
  if (res.status !== 0) {
    throw new Error(`psql failed: ${(res.stderr || res.stdout || res.error || '').slice(0, 2000)}`);
  }
  return (res.stdout || '').trim();
}

function runWorker(dbUrl, sql, label) {
  return new Promise((resolve) => {
    const tmp = path.join(os.tmpdir(), `mil-conc-worker-${label}-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.sql`);
    fs.writeFileSync(tmp, sql, 'utf8');
    const child = spawn(psqlBin, [dbUrl, '-v', 'ON_ERROR_STOP=1', '-f', tmp], {
      env: { ...process.env },
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('error', (err) => {
      try { fs.unlinkSync(tmp); } catch { /* ignore */ }
      resolve({
        label,
        status: 1,
        stdout,
        stderr,
        error: String(err.message || err),
        pid: child.pid,
      });
    });
    child.on('close', (status) => {
      try { fs.unlinkSync(tmp); } catch { /* ignore */ }
      resolve({
        label,
        status,
        stdout,
        stderr,
        error: null,
        pid: child.pid,
      });
    });
  });
}

function extractMarker(stdout, name) {
  const re = new RegExp(`${name}=(.*)$`, 'm');
  const m = String(stdout || '').match(re);
  return m ? m[1].trim() : null;
}

function parseJsonMarker(stdout, name) {
  const raw = extractMarker(stdout, name);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return { parseError: true, raw };
  }
}

function fail(detail, extras = {}) {
  console.error(JSON.stringify({ ok: false, status: 'CONCURRENCY_FAIL', detail, ...extras }, null, 2));
  process.exit(5);
}

function workerMintSql({
  runId,
  worker,
  actorId,
  creatorId,
  projectId,
  operationId,
  contentType = 'video/mp4',
  maxBytes = 1048576,
  expectError = false,
}) {
  // Independent session: barrier rendezvous then RPC in this backend only.
  return `
\\set ON_ERROR_STOP on
create temporary table if not exists _mil_worker_out(k text, v text);

insert into public.mil_conc_mint_barrier(run_id, worker)
values ('${runId}'::uuid, ${Number(worker)})
on conflict do nothing;

do $wait$
declare
  deadline timestamptz := clock_timestamp() + interval '8 seconds';
  n int := 0;
begin
  loop
    select count(*) into n
    from public.mil_conc_mint_barrier
    where run_id = '${runId}'::uuid;
    exit when n >= 2;
    exit when clock_timestamp() > deadline;
    perform pg_sleep(0.01);
  end loop;
  if n < 2 then
    raise exception 'BARRIER_TIMEOUT run=% worker=%', '${runId}', ${Number(worker)};
  end if;
  -- Give the peer a beat so both leave the barrier before RPC.
  perform pg_sleep(0.05);
end
$wait$;

select 'WORKER_PID=' || pg_backend_pid()::text;
select 'WORKER_OS_PID=' || pg_backend_pid()::text;

do $mint$
declare
  v_result jsonb;
  v_err text;
begin
  begin
    v_result := public.mil_mint_reel_upload_grant_audited(
      '${actorId}'::uuid,
      '${creatorId}'::uuid,
      '${projectId}'::uuid,
      null,
      null,
      '${contentType}',
      ${Number(maxBytes)},
      null,
      null,
      null,
      '${operationId}'::uuid
    );
    insert into _mil_worker_out(k, v) values ('RESULT', v_result::text);
    insert into _mil_worker_out(k, v) values ('ERROR', '');
  exception when others then
    get stacked diagnostics v_err = message_text;
    insert into _mil_worker_out(k, v) values ('RESULT', '');
    insert into _mil_worker_out(k, v) values ('ERROR', v_err);
    ${expectError ? '-- expected denial path' : 'raise;'}
  end;
end
$mint$;

select 'RESULT=' || coalesce((select v from _mil_worker_out where k = 'RESULT'), '');
select 'ERROR=' || coalesce((select v from _mil_worker_out where k = 'ERROR'), '');
`;
}

function seedSql(fixture) {
  return `
begin;

create table if not exists public.mil_conc_mint_barrier (
  run_id uuid not null,
  worker int not null,
  created_at timestamptz not null default now(),
  primary key (run_id, worker)
);
revoke all on public.mil_conc_mint_barrier from public, anon, authenticated;
grant all on public.mil_conc_mint_barrier to postgres, service_role;

-- disposable fixture users
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token,
  email_change_token_new, email_change
) values
  ('${fixture.actorId}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'conc-actor-${fixture.tag}@example.test', crypt('x', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
   now(), now(), '', '', '', ''),
  ('${fixture.creatorId}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'conc-creator-${fixture.tag}@example.test', crypt('x', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
   now(), now(), '', '', '', ''),
  ('${fixture.otherCreatorId}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'conc-other-${fixture.tag}@example.test', crypt('x', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
   now(), now(), '', '', '', '')
on conflict (id) do nothing;

insert into public.mil_reel_projects (id, title, creator_user_id, status)
values
  ('${fixture.projectId}', 'conc-mint-${fixture.tag}', '${fixture.creatorId}', 'creator_draft'),
  ('${fixture.projectId2}', 'conc-mint-b-${fixture.tag}', '${fixture.creatorId}', 'creator_draft'),
  ('${fixture.otherProjectId}', 'conc-mint-other-${fixture.tag}', '${fixture.otherCreatorId}', 'creator_draft')
on conflict (id) do nothing;

commit;
select 'SEED_OK';
`;
}

async function main() {
  const dbUrl = resolveDbUrl();
  assertLocalDisposable(dbUrl);

  const fnCheck = psqlTuples(
    dbUrl,
    `select to_regprocedure('public.mil_mint_reel_upload_grant_audited(uuid,uuid,uuid,text,uuid,text,bigint,text,uuid,text,uuid)') is not null`,
  );
  if (fnCheck !== 't') {
    fail('mil_mint_reel_upload_grant_audited missing — apply Phase 2A migrations on disposable DB first');
  }

  const tag = randomUUID().slice(0, 8);
  const fixture = {
    tag,
    actorId: randomUUID(),
    creatorId: randomUUID(),
    otherCreatorId: randomUUID(),
    projectId: randomUUID(),
    projectId2: randomUUID(),
    otherProjectId: randomUUID(),
  };

  const seed = psqlFile(dbUrl, seedSql(fixture), 'seed');
  if (seed.status !== 0 || !/SEED_OK/.test(seed.stdout)) {
    fail('fixture seed failed', { seed });
  }

  const report = {
    ok: true,
    status: 'PASS',
    architecture: 'two_independent_psql_child_processes_with_barrier',
    db: 'local_disposable',
    fixtureTag: tag,
    cases: {},
  };

  // -------------------------------------------------------------------------
  // Case 1: same creator + project + operation — true concurrent mint
  // -------------------------------------------------------------------------
  const opSame = randomUUID();
  const runSame = randomUUID();
  const w1Sql = workerMintSql({
    runId: runSame,
    worker: 1,
    actorId: fixture.actorId,
    creatorId: fixture.creatorId,
    projectId: fixture.projectId,
    operationId: opSame,
  });
  const w2Sql = workerMintSql({
    runId: runSame,
    worker: 2,
    actorId: fixture.actorId,
    creatorId: fixture.creatorId,
    projectId: fixture.projectId,
    operationId: opSame,
  });

  const [w1, w2] = await Promise.all([
    runWorker(dbUrl, w1Sql, 'same-op-1'),
    runWorker(dbUrl, w2Sql, 'same-op-2'),
  ]);

  const pid1 = extractMarker(w1.stdout, 'WORKER_PID');
  const pid2 = extractMarker(w2.stdout, 'WORKER_PID');
  const r1 = parseJsonMarker(w1.stdout, 'RESULT');
  const r2 = parseJsonMarker(w2.stdout, 'RESULT');
  const e1 = extractMarker(w1.stdout, 'ERROR') || '';
  const e2 = extractMarker(w2.stdout, 'ERROR') || '';

  if (!pid1 || !pid2 || pid1 === pid2) {
    fail('sessions were not independent (backend PIDs missing or equal)', {
      pid1, pid2, osPid1: w1.pid, osPid2: w2.pid, w1, w2,
    });
  }
  if (w1.pid === w2.pid) {
    fail('worker OS PIDs were not independent', { w1, w2 });
  }
  if (w1.status !== 0 || w2.status !== 0) {
    fail('concurrent same-op worker process failed', { w1, w2 });
  }
  if (e1 || e2) {
    fail('concurrent same-op returned errors', { e1, e2, r1, r2 });
  }
  if (!r1?.ok || !r2?.ok) {
    fail('concurrent same-op did not both succeed/adopt', { r1, r2 });
  }
  if (r1.grantId !== r2.grantId || r1.versionId !== r2.versionId) {
    fail('concurrent same-op returned different grant/version IDs', { r1, r2 });
  }
  const adoptedCount = [r1.adopted, r2.adopted].filter(Boolean).length;
  if (adoptedCount < 1) {
    // Under true serialization one creates, one adopts. If both report adopted=false
    // that would mean duplicate create — unique constraints should prevent that.
    fail('expected at least one adopted=true under concurrent same-op', { r1, r2 });
  }

  let counts;
  try {
    counts = JSON.parse(psqlTuples(dbUrl, `
select json_build_object(
  'ledger', (select count(*)::int from public.mil_reel_mint_operations
             where creator_user_id = '${fixture.creatorId}'
               and operation_id = '${opSame}'::uuid),
  'versions', (select count(*)::int from public.mil_reel_versions
               where project_id = '${fixture.projectId}'::uuid),
  'grants', (select count(*)::int from public.mil_reel_upload_grants
             where project_id = '${fixture.projectId}'::uuid),
  'audits', (select count(*)::int from public.mil_audit_events
             where action = 'reel_upload_grant_minted'
               and target_id = '${r1.grantId}'::uuid),
  'orphan_versions', (select count(*)::int from public.mil_reel_versions v
                      where v.project_id = '${fixture.projectId}'::uuid
                        and not exists (
                          select 1 from public.mil_reel_mint_operations o where o.version_id = v.id
                        )),
  'orphan_grants', (select count(*)::int from public.mil_reel_upload_grants g
                    where g.project_id = '${fixture.projectId}'::uuid
                      and not exists (
                        select 1 from public.mil_reel_mint_operations o where o.grant_id = g.id
                      ))
)::text;
`));
  } catch (err) {
    fail('post-count parse failed', { err: String(err) });
  }

  if (counts.ledger !== 1 || counts.versions !== 1 || counts.grants !== 1 || counts.audits !== 1) {
    fail('post concurrent same-op row counts not exactly one', { counts, r1, r2 });
  }
  if (counts.orphan_versions !== 0 || counts.orphan_grants !== 0) {
    fail('orphan rows after concurrent same-op', { counts });
  }

  report.cases.concurrent_same_operation = {
    ok: true,
    independentSessions: true,
    backendPids: [Number(pid1), Number(pid2)],
    workerOsPids: [w1.pid, w2.pid],
    results: [r1, r2],
    versionId: r1.versionId,
    grantId: r1.grantId,
    counts,
    deadlock: false,
    rawDbError: false,
  };

  // -------------------------------------------------------------------------
  // Case 2: same operation ID, different creator (concurrent)
  // -------------------------------------------------------------------------
  const opCrossCreator = randomUUID();
  const runCross = randomUUID();
  // Concurrent: authorized creator on own project vs foreign creator on that project,
  // same operation id. Cross-creator reuse must be denied; no second grant/version.
  const [c1, c2] = await Promise.all([
    runWorker(dbUrl, workerMintSql({
      runId: runCross,
      worker: 1,
      actorId: fixture.actorId,
      creatorId: fixture.creatorId,
      projectId: fixture.projectId,
      operationId: opCrossCreator,
      maxBytes: 2097152,
    }), 'cross-creator-1'),
    runWorker(dbUrl, workerMintSql({
      runId: runCross,
      worker: 2,
      actorId: fixture.actorId,
      creatorId: fixture.otherCreatorId,
      projectId: fixture.projectId, // foreign project owned by creatorId
      operationId: opCrossCreator,
      maxBytes: 2097152,
      expectError: true,
    }), 'cross-creator-2'),
  ]);

  const cPid1 = extractMarker(c1.stdout, 'WORKER_PID');
  const cPid2 = extractMarker(c2.stdout, 'WORKER_PID');
  const cr1 = parseJsonMarker(c1.stdout, 'RESULT');
  const cr2 = parseJsonMarker(c2.stdout, 'RESULT');
  const ce1 = extractMarker(c1.stdout, 'ERROR') || '';
  const ce2 = extractMarker(c2.stdout, 'ERROR') || '';

  if (!cPid1 || !cPid2 || cPid1 === cPid2) {
    fail('cross-creator sessions not independent', { cPid1, cPid2, c1, c2 });
  }

  const creatorOk = c1.status === 0 && cr1?.ok === true && !ce1;
  const otherDenied = /REEL_MINT_CREATOR_MISMATCH|Reel project not found/i.test(ce2)
    || (c2.status !== 0 && /REEL_MINT_CREATOR_MISMATCH/i.test(c2.stderr + c2.stdout));
  // With expectError=true, worker suppresses rethrow; ERROR marker should carry denial.
  const otherDeniedMarker = /REEL_MINT_CREATOR_MISMATCH|Reel project not found/i.test(ce2);

  if (!creatorOk) {
    fail('authorized creator concurrent call did not succeed', { cr1, ce1, c1 });
  }
  if (!otherDeniedMarker) {
    fail('cross-creator reuse was not denied', { cr2, ce2, c2 });
  }
  if (cr2?.grantId && cr2.grantId !== cr1.grantId) {
    fail('cross-creator created a second grant', { cr1, cr2 });
  }

  const crossCounts = JSON.parse(psqlTuples(dbUrl, `
select json_build_object(
  'ledger_op', (select count(*)::int from public.mil_reel_mint_operations
                where operation_id = '${opCrossCreator}'::uuid),
  'grants_project', (select count(*)::int from public.mil_reel_upload_grants
                     where project_id = '${fixture.projectId}'::uuid
                       and id = '${cr1.grantId}'::uuid),
  'versions_for_grant', (select count(*)::int from public.mil_reel_versions
                         where id = '${cr1.versionId}'::uuid),
  'extra_grants_other_creator', (select count(*)::int from public.mil_reel_upload_grants
                                 where creator_user_id = '${fixture.otherCreatorId}'
                                   and created_at > now() - interval '10 minutes'
                                   and project_id = '${fixture.projectId}'::uuid)
)::text;
`));

  if (crossCounts.ledger_op !== 1 || crossCounts.extra_grants_other_creator !== 0) {
    fail('cross-creator concurrency created extra ledger/grant rows', { crossCounts, cr1, cr2, ce2 });
  }

  report.cases.concurrent_same_op_different_creator = {
    ok: true,
    independentSessions: true,
    backendPids: [Number(cPid1), Number(cPid2)],
    authorized: cr1,
    deniedError: ce2,
    counts: crossCounts,
  };

  // -------------------------------------------------------------------------
  // Case 3: same operation ID, different project (same creator, concurrent)
  // -------------------------------------------------------------------------
  const opCrossProject = randomUUID();
  const runProj = randomUUID();
  // Either worker may win the advisory lock; both must tolerate denial.
  const [p1, p2] = await Promise.all([
    runWorker(dbUrl, workerMintSql({
      runId: runProj,
      worker: 1,
      actorId: fixture.actorId,
      creatorId: fixture.creatorId,
      projectId: fixture.projectId,
      operationId: opCrossProject,
      maxBytes: 3145728,
      expectError: true,
    }), 'cross-project-1'),
    runWorker(dbUrl, workerMintSql({
      runId: runProj,
      worker: 2,
      actorId: fixture.actorId,
      creatorId: fixture.creatorId,
      projectId: fixture.projectId2,
      operationId: opCrossProject,
      maxBytes: 3145728,
      expectError: true,
    }), 'cross-project-2'),
  ]);

  const pp1 = extractMarker(p1.stdout, 'WORKER_PID');
  const pp2 = extractMarker(p2.stdout, 'WORKER_PID');
  const pr1 = parseJsonMarker(p1.stdout, 'RESULT');
  const pr2 = parseJsonMarker(p2.stdout, 'RESULT');
  const pe1 = extractMarker(p1.stdout, 'ERROR') || '';
  const pe2 = extractMarker(p2.stdout, 'ERROR') || '';

  if (!pp1 || !pp2 || pp1 === pp2) {
    fail('cross-project sessions not independent', { pp1, pp2 });
  }

  // Exactly one succeeds; the other must be PROJECT_MISMATCH (serialized by advisory lock).
  const pSuccesses = [];
  const pDenials = [];
  for (const [res, err, label] of [[pr1, pe1, 'p1'], [pr2, pe2, 'p2']]) {
    if (res?.ok && !err) pSuccesses.push({ label, res });
    else if (/REEL_MINT_OP_PROJECT_MISMATCH/i.test(err)) pDenials.push({ label, err });
    else fail('cross-project concurrent call unexpected outcome', { pr1, pr2, pe1, pe2 });
  }
  if (pSuccesses.length !== 1 || pDenials.length !== 1) {
    fail('cross-project expected exactly one success and one PROJECT_MISMATCH', {
      pSuccesses, pDenials, pr1, pr2, pe1, pe2,
    });
  }

  const winner = pSuccesses[0].res;
  const projCounts = JSON.parse(psqlTuples(dbUrl, `
select json_build_object(
  'ledger_op', (select count(*)::int from public.mil_reel_mint_operations
                where creator_user_id = '${fixture.creatorId}'
                  and operation_id = '${opCrossProject}'::uuid),
  'ledger_p1', (select count(*)::int from public.mil_reel_mint_operations
                where operation_id = '${opCrossProject}'::uuid
                  and project_id = '${fixture.projectId}'::uuid),
  'ledger_p2', (select count(*)::int from public.mil_reel_mint_operations
                where operation_id = '${opCrossProject}'::uuid
                  and project_id = '${fixture.projectId2}'::uuid),
  'grants_for_op', (select count(*)::int from public.mil_reel_upload_grants g
                    join public.mil_reel_mint_operations o on o.grant_id = g.id
                    where o.operation_id = '${opCrossProject}'::uuid),
  'versions_for_op', (select count(*)::int from public.mil_reel_versions v
                      join public.mil_reel_mint_operations o on o.version_id = v.id
                      where o.operation_id = '${opCrossProject}'::uuid)
)::text;
`));
  const winnerOnP1 = winner.projectId === fixture.projectId;
  const winnerOnP2 = winner.projectId === fixture.projectId2;
  if (!winnerOnP1 && !winnerOnP2) {
    fail('cross-project winner project unexpected', { winner, fixture });
  }
  if (
    projCounts.ledger_op !== 1
    || projCounts.grants_for_op !== 1
    || projCounts.versions_for_op !== 1
    || (winnerOnP1 && (projCounts.ledger_p1 !== 1 || projCounts.ledger_p2 !== 0))
    || (winnerOnP2 && (projCounts.ledger_p2 !== 1 || projCounts.ledger_p1 !== 0))
  ) {
    fail('cross-project concurrency created a second grant/version', { projCounts, winner });
  }

  report.cases.concurrent_same_op_different_project = {
    ok: true,
    independentSessions: true,
    backendPids: [Number(pp1), Number(pp2)],
    winner,
    deniedError: pDenials[0].err,
    counts: projCounts,
  };

  // -------------------------------------------------------------------------
  // Case 4: different operation IDs, same project (concurrent)
  // -------------------------------------------------------------------------
  const opA = randomUUID();
  const opB = randomUUID();
  const runDiff = randomUUID();
  // Separate barriers per pair — use two run IDs? Same barrier run with both workers.
  const [d1, d2] = await Promise.all([
    runWorker(dbUrl, workerMintSql({
      runId: runDiff,
      worker: 1,
      actorId: fixture.actorId,
      creatorId: fixture.creatorId,
      projectId: fixture.projectId,
      operationId: opA,
      maxBytes: 4194304,
    }), 'diff-op-1'),
    runWorker(dbUrl, workerMintSql({
      runId: runDiff,
      worker: 2,
      actorId: fixture.actorId,
      creatorId: fixture.creatorId,
      projectId: fixture.projectId,
      operationId: opB,
      maxBytes: 4194304,
    }), 'diff-op-2'),
  ]);

  const dp1 = extractMarker(d1.stdout, 'WORKER_PID');
  const dp2 = extractMarker(d2.stdout, 'WORKER_PID');
  const dr1 = parseJsonMarker(d1.stdout, 'RESULT');
  const dr2 = parseJsonMarker(d2.stdout, 'RESULT');
  const de1 = extractMarker(d1.stdout, 'ERROR') || '';
  const de2 = extractMarker(d2.stdout, 'ERROR') || '';

  if (!dp1 || !dp2 || dp1 === dp2) {
    fail('diff-op sessions not independent', { dp1, dp2 });
  }
  if (!dr1?.ok || !dr2?.ok || de1 || de2) {
    fail('different operation IDs should both succeed', { dr1, dr2, de1, de2, d1, d2 });
  }
  if (dr1.grantId === dr2.grantId || dr1.versionId === dr2.versionId) {
    fail('different operations were incorrectly deduplicated', { dr1, dr2 });
  }
  if (dr1.adopted || dr2.adopted) {
    fail('fresh distinct operations should not adopt', { dr1, dr2 });
  }

  const diffCounts = JSON.parse(psqlTuples(dbUrl, `
select json_build_object(
  'ledger_a', (select count(*)::int from public.mil_reel_mint_operations
               where operation_id = '${opA}'::uuid),
  'ledger_b', (select count(*)::int from public.mil_reel_mint_operations
               where operation_id = '${opB}'::uuid),
  'both_versions', (select count(*)::int from public.mil_reel_versions
                    where id in ('${dr1.versionId}'::uuid, '${dr2.versionId}'::uuid))
)::text;
`));
  if (diffCounts.ledger_a !== 1 || diffCounts.ledger_b !== 1 || diffCounts.both_versions !== 2) {
    fail('different ops did not each create one ledger/version', { diffCounts, dr1, dr2 });
  }

  report.cases.concurrent_different_operations_same_project = {
    ok: true,
    independentSessions: true,
    backendPids: [Number(dp1), Number(dp2)],
    results: [dr1, dr2],
    counts: diffCounts,
  };

  // -------------------------------------------------------------------------
  // Case 5: response-loss simulation (commit, drop response, retry new session)
  // -------------------------------------------------------------------------
  const opLoss = randomUUID();
  const first = psqlFile(dbUrl, `
select 'WORKER_PID=' || pg_backend_pid()::text;
select 'RESULT=' || public.mil_mint_reel_upload_grant_audited(
  '${fixture.actorId}'::uuid,
  '${fixture.creatorId}'::uuid,
  '${fixture.projectId}'::uuid,
  null, null, 'video/mp4', 5242880,
  null, null, null, '${opLoss}'::uuid
)::text;
`, 'response-loss-1');
  if (first.status !== 0) {
    fail('response-loss first mint failed', { first });
  }
  const lossFirst = parseJsonMarker(first.stdout, 'RESULT');
  const lossPid1 = extractMarker(first.stdout, 'WORKER_PID');
  if (!lossFirst?.ok) fail('response-loss first result not ok', { lossFirst, first });

  // Client "loses" the response — second independent session retries with same op.
  const second = psqlFile(dbUrl, `
select 'WORKER_PID=' || pg_backend_pid()::text;
select 'RESULT=' || public.mil_mint_reel_upload_grant_audited(
  '${fixture.actorId}'::uuid,
  '${fixture.creatorId}'::uuid,
  '${fixture.projectId}'::uuid,
  null, null, 'video/mp4', 5242880,
  null, null, null, '${opLoss}'::uuid
)::text;
`, 'response-loss-2');
  if (second.status !== 0) {
    fail('response-loss retry failed', { second });
  }
  const lossSecond = parseJsonMarker(second.stdout, 'RESULT');
  const lossPid2 = extractMarker(second.stdout, 'WORKER_PID');
  if (!lossPid1 || !lossPid2 || lossPid1 === lossPid2) {
    fail('response-loss sessions not independent', { lossPid1, lossPid2 });
  }
  if (!lossSecond?.ok || lossSecond.adopted !== true) {
    fail('response-loss retry must adopt', { lossFirst, lossSecond });
  }
  if (lossSecond.grantId !== lossFirst.grantId || lossSecond.versionId !== lossFirst.versionId) {
    fail('response-loss retry changed IDs', { lossFirst, lossSecond });
  }

  const lossCounts = JSON.parse(psqlTuples(dbUrl, `
select json_build_object(
  'ledger', (select count(*)::int from public.mil_reel_mint_operations
             where operation_id = '${opLoss}'::uuid),
  'grants', (select count(*)::int from public.mil_reel_upload_grants
             where id = '${lossFirst.grantId}'::uuid),
  'versions', (select count(*)::int from public.mil_reel_versions
               where id = '${lossFirst.versionId}'::uuid),
  'audits', (select count(*)::int from public.mil_audit_events
             where action = 'reel_upload_grant_minted'
               and target_id = '${lossFirst.grantId}'::uuid)
)::text;
`));
  if (lossCounts.ledger !== 1 || lossCounts.grants !== 1 || lossCounts.versions !== 1 || lossCounts.audits !== 1) {
    fail('response-loss retry created new rows', { lossCounts });
  }

  report.cases.response_loss_retry = {
    ok: true,
    independentSessions: true,
    backendPids: [Number(lossPid1), Number(lossPid2)],
    first: lossFirst,
    retry: lossSecond,
    counts: lossCounts,
  };

  // Design review notes (source-inspected; recorded with runtime proof)
  report.concurrencyDesign = {
    transactionScopedAdvisoryLock: true,
    stableLockKey: 'hashtextextended(creator_user_id || : || operation_id, 0)',
    lockScope: 'per creator+operation — not a global system lock',
    uniqueConstraints: [
      'mil_reel_mint_ops_creator_project_op_uniq',
      'mil_reel_mint_ops_creator_op_uniq',
    ],
    insertOnConflict: false,
    adoptionLogic: 'post-lock ledger select returns existing grant/version IDs',
    rowLocking: 'mil_reel_projects FOR UPDATE on existing project path',
    failureModel: 'single plpgsql function = single transaction; failure rolls back ledger/version/grant/audit',
  };

  report.deadlockObserved = false;
  report.rawDatabaseErrorsObserved = false;
  report.corrections = [];

  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({
    ok: false,
    status: 'RUNNER_FAILURE',
    detail: err instanceof Error ? err.message : String(err),
  }, null, 2));
  process.exit(1);
});
