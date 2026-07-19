#!/usr/bin/env node
/**
 * Governance tests for LOW-RISK_CONTROL_PLANE_CORRECTION fail-closed activation.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  evaluateDelegatedMergeAvailability,
  formatDelegatedMergeReport,
  LANE_ACTIVATION_MARKER,
  LANE_REL_PATH,
} from './control-plane-lane-activation.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const commandCenterRoot = path.resolve(__dirname, '..');
const gitRepoRoot = path.resolve(commandCenterRoot, '..');

function pass(results, test, ok, detail) {
  results.push({ test, pass: Boolean(ok), ...(detail ? { detail: String(detail).slice(0, 180) } : {}) });
}

const ACTIVE_BODY = `# Lane\n\n${LANE_ACTIVATION_MARKER} only after merge to main.\n`;

function eligibleRecord(sha = 'a'.repeat(40)) {
  return {
    lane: 'LOW-RISK_CONTROL_PLANE_CORRECTION',
    prNumber: 61,
    headSha: sha,
    allGatesTrue: true,
  };
}

function agApproval(sha = 'a'.repeat(40)) {
  return { headSha: sha, verdict: 'APPROVE_FOR_CONTROL_PLANE_MERGE' };
}

export async function runSelfTests() {
  const results = [];

  // 1. Lane file absent from main → delegated merge denied
  const absent = evaluateDelegatedMergeAvailability({
    repoRoot: gitRepoRoot,
    mainLaneStateOverride: 'absent',
    orchestratorEligibilityRecord: eligibleRecord(),
    architectureGuardApproval: agApproval(),
  });
  pass(
    results,
    'lane_absent_on_main_denies_delegated_merge',
    absent.requireFounderExactPrShaAuthorization &&
      !absent.delegatedMergeAllowed &&
      absent.reasons.includes('LANE_ABSENT_ON_MAIN')
  );

  // 2. Lane activation cannot be inferred from a PR branch
  const fakeGit = (repoRoot, args) => {
    const cmd = args.join(' ');
    if (cmd.startsWith('rev-parse --verify origin/main')) return 'mainsha\n';
    if (cmd.startsWith(`show origin/main:${LANE_REL_PATH}`)) {
      const err = new Error('missing');
      throw err;
    }
    if (cmd.startsWith(`show pr-branch:${LANE_REL_PATH}`)) return ACTIVE_BODY;
    throw new Error(`unexpected git ${cmd}`);
  };
  const prInfer = evaluateDelegatedMergeAvailability({
    repoRoot: gitRepoRoot,
    mainRef: 'origin/main',
    candidateRef: 'pr-branch',
    execGit: fakeGit,
    orchestratorEligibilityRecord: eligibleRecord(),
    architectureGuardApproval: agApproval(),
  });
  pass(
    results,
    'lane_not_inferred_from_pr_branch',
    !prInfer.delegatedMergeAllowed &&
      prInfer.reasons.includes('LANE_ABSENT_ON_MAIN') &&
      prInfer.reasons.includes('LANE_PRESENT_ONLY_ON_CANDIDATE')
  );

  // 3. Lane file present only on candidate branch → delegated merge denied
  pass(
    results,
    'lane_present_only_on_candidate_denies',
    prInfer.checks.some((c) => c.id === 'candidate_does_not_activate' && c.ok === false)
  );

  // 4. Ambiguous main-state verification → Founder authorization required
  const ambiguous = evaluateDelegatedMergeAvailability({
    repoRoot: gitRepoRoot,
    mainLaneStateOverride: 'ambiguous',
    orchestratorEligibilityRecord: eligibleRecord(),
    architectureGuardApproval: agApproval(),
  });
  pass(
    results,
    'ambiguous_main_state_requires_founder_auth',
    ambiguous.requireFounderExactPrShaAuthorization &&
      ambiguous.reasons.includes('LANE_MAIN_STATE_AMBIGUOUS')
  );

  // 5. PR #60 cannot use the lane to merge itself (bootstrap)
  const bootstrap = evaluateDelegatedMergeAvailability({
    repoRoot: gitRepoRoot,
    mainLaneStateOverride: 'present',
    mainLaneBody: ACTIVE_BODY,
    prNumber: 60,
    prIntroducesLane: true,
    orchestratorEligibilityRecord: eligibleRecord('b'.repeat(40)),
    architectureGuardApproval: agApproval('b'.repeat(40)),
  });
  pass(
    results,
    'pr60_bootstrap_cannot_self_merge_via_lane',
    !bootstrap.delegatedMergeAllowed &&
      bootstrap.reasons.includes('BOOTSTRAP_PR_CANNOT_SELF_MERGE_VIA_LANE')
  );

  // 6. Later eligible PR still requires Orchestrator record + AG exact-head
  const missingElig = evaluateDelegatedMergeAvailability({
    repoRoot: gitRepoRoot,
    mainLaneStateOverride: 'present',
    mainLaneBody: ACTIVE_BODY,
    prIntroducesLane: false,
    architectureGuardApproval: agApproval(),
  });
  pass(
    results,
    'later_pr_requires_orchestrator_eligibility_record',
    !missingElig.delegatedMergeAllowed &&
      missingElig.reasons.includes('ORCHESTRATOR_ELIGIBILITY_MISSING')
  );

  const missingAg = evaluateDelegatedMergeAvailability({
    repoRoot: gitRepoRoot,
    mainLaneStateOverride: 'present',
    mainLaneBody: ACTIVE_BODY,
    prIntroducesLane: false,
    orchestratorEligibilityRecord: eligibleRecord(),
  });
  pass(
    results,
    'later_pr_requires_architecture_guard_exact_head',
    !missingAg.delegatedMergeAllowed &&
      missingAg.reasons.includes('ARCHITECTURE_GUARD_EXACT_HEAD_MISSING')
  );

  const shaMismatch = evaluateDelegatedMergeAvailability({
    repoRoot: gitRepoRoot,
    mainLaneStateOverride: 'present',
    mainLaneBody: ACTIVE_BODY,
    prIntroducesLane: false,
    orchestratorEligibilityRecord: eligibleRecord('c'.repeat(40)),
    architectureGuardApproval: agApproval('d'.repeat(40)),
  });
  pass(
    results,
    'later_pr_ag_sha_must_match_eligibility_sha',
    !shaMismatch.delegatedMergeAllowed &&
      shaMismatch.reasons.includes('ARCHITECTURE_GUARD_EXACT_HEAD_MISSING')
  );

  const allowed = evaluateDelegatedMergeAvailability({
    repoRoot: gitRepoRoot,
    mainLaneStateOverride: 'present',
    mainLaneBody: ACTIVE_BODY,
    prIntroducesLane: false,
    orchestratorEligibilityRecord: eligibleRecord('e'.repeat(40)),
    architectureGuardApproval: agApproval('e'.repeat(40)),
  });
  pass(results, 'eligible_later_pr_may_allow_delegated_merge', allowed.delegatedMergeAllowed === true);

  const report = formatDelegatedMergeReport(absent);
  pass(
    results,
    'report_status_contract',
    /TECHNICAL RESULT:/.test(report) &&
      /GOVERNANCE STATUS:/.test(report) &&
      /AUTHORIZED NEXT STATE:/.test(report) &&
      report.includes('DELEGATED_MERGE_DENIED')
  );

  // Agent definitions must carry self-contained fail-closed text (not only cross-doc inference)
  const releaseAgent = fs.readFileSync(
    path.join(commandCenterRoot, '.cursor/agents/release-agent.md'),
    'utf8'
  );
  const orchestrator = fs.readFileSync(
    path.join(commandCenterRoot, '.cursor/agents/v1-orchestrator.md'),
    'utf8'
  );
  const requiredPhrases = [
    'FAIL-CLOSED DELEGATED MERGE ACTIVATION',
    'absent from the current main branch',
    'cannot be verified as active on main',
    'activation status is ambiguous',
    'delegated merge authority is unavailable',
    'Founder exact PR/SHA authorization is required',
    'must not be inferred from a pull-request or candidate branch alone',
  ];
  pass(
    results,
    'release_agent_has_self_contained_fail_closed_rule',
    requiredPhrases.every((p) => releaseAgent.includes(p))
  );
  pass(
    results,
    'orchestrator_has_self_contained_fail_closed_rule',
    requiredPhrases.every((p) => orchestrator.includes(p))
  );

  // Live main (origin/main) today: lane file should be absent → deny (until #60 merges)
  let liveMainAbsent = false;
  try {
    const live = evaluateDelegatedMergeAvailability({
      repoRoot: gitRepoRoot,
      mainRef: 'origin/main',
      candidateRef: 'HEAD',
      prIntroducesLane: true,
      prNumber: 60,
      orchestratorEligibilityRecord: eligibleRecord('f'.repeat(40)),
      architectureGuardApproval: agApproval('f'.repeat(40)),
    });
    liveMainAbsent =
      live.requireFounderExactPrShaAuthorization &&
      (live.reasons.includes('LANE_ABSENT_ON_MAIN') ||
        live.reasons.includes('BOOTSTRAP_PR_CANNOT_SELF_MERGE_VIA_LANE') ||
        live.reasons.includes('LANE_PRESENT_ONLY_ON_CANDIDATE'));
  } catch {
    liveMainAbsent = false;
  }
  pass(results, 'live_origin_main_denies_pr60_delegated_merge', liveMainAbsent);

  const ok = results.every((r) => r.pass);
  return { ok, results };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runSelfTests().then(({ ok, results }) => {
    for (const r of results) {
      console.log(`${r.pass ? 'PASS' : 'FAIL'} ${r.test}${r.detail ? ` — ${r.detail}` : ''}`);
    }
    process.exit(ok ? 0 : 1);
  });
}
