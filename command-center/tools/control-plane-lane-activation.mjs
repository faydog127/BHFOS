#!/usr/bin/env node
/**
 * LOW-RISK_CONTROL_PLANE_CORRECTION activation checks — fail-closed.
 * Delegated merge is unavailable unless the lane file is verified active on main.
 * Never infers activation from a PR/candidate branch alone.
 */

import childProcess from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_REPO_ROOT = path.resolve(__dirname, '..', '..');

export const LANE_REL_PATH = 'command-center/docs/governance/LOW_RISK_CONTROL_PLANE_CORRECTION.md';
export const LANE_ACTIVATION_MARKER = 'Delegated Release Agent merge authority described here becomes active';

export function git(repoRoot, args, options = {}) {
  return childProcess.execFileSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  });
}

/**
 * Read a blob from a git ref. Returns null if missing or unreadable.
 */
export function readFileAtRef(repoRoot, ref, relPath, execGit = git) {
  try {
    return execGit(repoRoot, ['show', `${ref}:${relPath}`]);
  } catch {
    return null;
  }
}

export function fileExistsAtRef(repoRoot, ref, relPath, execGit = git) {
  return readFileAtRef(repoRoot, ref, relPath, execGit) != null;
}

/**
 * Decide whether delegated merge may be considered (activation only — not full
 * eligibility). Fail-closed on absence, PR-only presence, or ambiguity.
 *
 * @param {object} input
 * @param {string} input.repoRoot
 * @param {string} [input.mainRef='origin/main']
 * @param {string} [input.candidateRef] PR/branch tip (optional; presence here alone never activates)
 * @param {string|number} [input.prNumber]
 * @param {boolean} [input.prIntroducesLane] true when this PR adds/activates the lane file
 * @param {object|null} [input.orchestratorEligibilityRecord]
 * @param {object|null} [input.architectureGuardApproval]
 * @param {function} [input.execGit]
 * @param {'present'|'absent'|'ambiguous'|undefined} [input.mainLaneStateOverride] test hook
 */
export function evaluateDelegatedMergeAvailability(input = {}) {
  const repoRoot = input.repoRoot || DEFAULT_REPO_ROOT;
  const mainRef = input.mainRef || 'origin/main';
  const candidateRef = input.candidateRef || null;
  const execGit = input.execGit || git;
  const reasons = [];
  const checks = [];

  const add = (id, ok, detail) => {
    checks.push({ id, ok: Boolean(ok), detail });
  };

  // --- Activation on main (self-contained; not inferred from PR branch) ---
  let mainState = input.mainLaneStateOverride;
  let mainBody = null;
  if (!mainState) {
    try {
      // Ensure ref is resolvable; ambiguity if main cannot be verified.
      execGit(repoRoot, ['rev-parse', '--verify', mainRef]);
      mainBody = readFileAtRef(repoRoot, mainRef, LANE_REL_PATH, execGit);
      mainState = mainBody == null ? 'absent' : 'present';
    } catch {
      mainState = 'ambiguous';
    }
  } else if (mainState === 'present' && input.mainLaneBody != null) {
    mainBody = input.mainLaneBody;
  }

  if (mainState === 'absent') {
    add('lane_file_on_main', false, 'LOW_RISK_CONTROL_PLANE_CORRECTION.md absent from main');
    reasons.push('LANE_ABSENT_ON_MAIN');
  } else if (mainState === 'ambiguous') {
    add('lane_file_on_main', false, 'main lane activation state could not be verified');
    reasons.push('LANE_MAIN_STATE_AMBIGUOUS');
  } else if (mainState === 'present') {
    const body = mainBody != null ? mainBody : readFileAtRef(repoRoot, mainRef, LANE_REL_PATH, execGit);
    const markerOk = typeof body === 'string' && body.includes(LANE_ACTIVATION_MARKER);
    add('lane_file_on_main', markerOk, markerOk ? 'lane file present on main' : 'lane file on main lacks activation marker');
    if (!markerOk) reasons.push('LANE_MAIN_MARKER_MISSING');
  } else {
    add('lane_file_on_main', false, `unknown mainLaneState=${mainState}`);
    reasons.push('LANE_MAIN_STATE_AMBIGUOUS');
  }

  // Candidate/PR branch presence must never activate the lane by itself.
  if (candidateRef) {
    const onCandidate = fileExistsAtRef(repoRoot, candidateRef, LANE_REL_PATH, execGit);
    add(
      'candidate_alone_insufficient',
      true,
      onCandidate
        ? 'lane file may exist on candidate; ignored for activation'
        : 'lane file absent on candidate; irrelevant'
    );
    if (onCandidate && mainState !== 'present') {
      reasons.push('LANE_PRESENT_ONLY_ON_CANDIDATE');
      add('candidate_does_not_activate', false, 'lane on candidate branch does not activate delegated merge');
    } else {
      add('candidate_does_not_activate', true, 'activation not inferred from candidate');
    }
  } else {
    add('candidate_alone_insufficient', true, 'no candidate ref supplied');
    add('candidate_does_not_activate', true, 'no candidate ref supplied');
  }

  // Bootstrap: the PR that introduces the lane cannot use delegated merge.
  if (input.prIntroducesLane === true) {
    add('bootstrap_pr_denied', false, 'PR introducing the lane cannot use delegated merge');
    reasons.push('BOOTSTRAP_PR_CANNOT_SELF_MERGE_VIA_LANE');
  } else {
    add('bootstrap_pr_denied', true, 'not a lane-introducing bootstrap PR');
  }

  // Later eligible PRs still require Orchestrator exact-PR/SHA eligibility + AG exact-head.
  const elig = input.orchestratorEligibilityRecord || null;
  const ag = input.architectureGuardApproval || null;
  const eligOk =
    elig &&
    elig.lane === 'LOW-RISK_CONTROL_PLANE_CORRECTION' &&
    (elig.prNumber != null || elig.pr_number != null) &&
    typeof elig.headSha === 'string' &&
    /^[0-9a-f]{40}$/i.test(elig.headSha) &&
    elig.allGatesTrue === true;
  add(
    'orchestrator_eligibility_record',
    Boolean(eligOk),
    eligOk ? 'orchestrator eligibility recorded for exact PR/SHA' : 'missing orchestrator exact-PR/SHA eligibility record'
  );
  if (!eligOk) reasons.push('ORCHESTRATOR_ELIGIBILITY_MISSING');

  const agOk =
    ag &&
    typeof ag.headSha === 'string' &&
    /^[0-9a-f]{40}$/i.test(ag.headSha) &&
    eligOk &&
    String(ag.headSha).toLowerCase() === String(elig.headSha).toLowerCase() &&
    typeof ag.verdict === 'string' &&
    ag.verdict.length > 0;
  add(
    'architecture_guard_exact_head',
    Boolean(agOk),
    agOk ? 'AG exact-head approval present' : 'missing AG exact-head approval matching eligibility SHA'
  );
  if (!agOk) reasons.push('ARCHITECTURE_GUARD_EXACT_HEAD_MISSING');

  const activationOk = checks.find((c) => c.id === 'lane_file_on_main')?.ok === true;
  const bootstrapOk = checks.find((c) => c.id === 'bootstrap_pr_denied')?.ok === true;
  const candidateOk = checks.find((c) => c.id === 'candidate_does_not_activate')?.ok === true;

  const delegatedMergeAllowed =
    activationOk && bootstrapOk && candidateOk && eligOk && agOk && reasons.length === 0;

  return {
    delegatedMergeAllowed: Boolean(delegatedMergeAllowed),
    requireFounderExactPrShaAuthorization: !delegatedMergeAllowed,
    mainLaneState: mainState,
    reasons: [...new Set(reasons)],
    checks,
    technical_result: delegatedMergeAllowed
      ? 'Delegated merge activation and eligibility prerequisites are satisfied.'
      : `Delegated merge unavailable: ${[...new Set(reasons)].join(', ') || 'fail-closed'}`,
    governance_status: delegatedMergeAllowed
      ? 'Delegated merge path may be considered only with continuing exact-head guards.'
      : 'Founder exact PR/SHA merge authorization is required.',
    authorized_next_state: delegatedMergeAllowed
      ? 'Release Agent may perform mechanical merge of the exact eligible PR/SHA only.'
      : 'Stop delegated path; obtain Founder exact PR/SHA merge authorization.',
  };
}

export function formatDelegatedMergeReport(result) {
  return [
    'TECHNICAL RESULT:',
    result.technical_result,
    '',
    'GOVERNANCE STATUS:',
    result.governance_status,
    '',
    'AUTHORIZED NEXT STATE:',
    result.authorized_next_state,
    '',
    result.delegatedMergeAllowed ? 'DELEGATED_MERGE_AVAILABLE' : 'DELEGATED_MERGE_DENIED',
  ].join('\n');
}

async function main(argv) {
  if (argv.includes('--self-test')) {
    const { runSelfTests } = await import('./control-plane-lane-activation.self-test.mjs');
    const { ok, results } = await runSelfTests();
    for (const r of results) {
      console.log(`${r.pass ? 'PASS' : 'FAIL'} ${r.test}${r.detail ? ` — ${r.detail}` : ''}`);
    }
    process.exit(ok ? 0 : 1);
  }

  console.error('Usage: node tools/control-plane-lane-activation.mjs --self-test');
  process.exit(2);
}

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  main(process.argv.slice(2)).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
