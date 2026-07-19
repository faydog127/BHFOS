#!/usr/bin/env node
/**
 * Self-tests for FOUNDER_RUN_READINESS — no live secrets, no production access.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import childProcess from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  evaluateReadiness,
  formatReport,
  secretNamesPresent,
  pathIsOutsideRepo,
  isSha,
} from './founder-run-readiness.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

function pass(results, test, ok, detail) {
  results.push({ test, pass: Boolean(ok), ...(detail ? { detail: String(detail).slice(0, 160) } : {}) });
}

function git(args) {
  return childProcess.execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' }).trim();
}

function basePacket(overrides = {}) {
  const head = git(['rev-parse', 'HEAD']);
  const remote = git(['remote', 'get-url', 'origin']);
  return {
    task_and_authorization_boundary: 'Self-test only; no Founder action authorized',
    exact_repository: remote,
    exact_worktree_path: repoRoot,
    exact_commit_sha: head,
    protected_launcher_or_script_path: 'tools/founder-run-readiness.mjs',
    launcher_sha_pin: head,
    required_files: ['tools/founder-run-readiness.mjs', 'docs/governance/FOUNDER_RUN_READINESS.md'],
    platform_acceptance_tests_passed: true,
    unit_integration_tests_passed: true,
    architecture_guard_approval: {
      applies_to_execution_design: true,
      head_sha: head,
      verdict: 'APPROVE_FOR_INDEPENDENT_UAT',
    },
    expected_safe_output: 'FOUNDER_RUN_READY or FOUNDER_RUN_BLOCKED',
    explicit_stop_conditions: ['Any readiness field fails'],
    one_exact_founder_command_or_action: 'No Founder command — self-test only',
    allow_credential_scan_skip: true,
    fixture_ignore_worktree_dirtiness: true,
    ...overrides,
  };
}

export async function runSelfTests() {
  const results = [];
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'founder-run-ready-'));

  // helpers
  pass(results, 'is_sha', isSha('a'.repeat(40)) && !isSha('short'));
  pass(results, 'path_outside_repo', pathIsOutsideRepo(tmp, repoRoot));

  const secretFile = path.join(tmp, 'secrets.env');
  fs.writeFileSync(secretFile, 'I2_EXAMPLE_NAME=present-value-not-printed\nOTHER=1\n', 'utf8');
  const names = secretNamesPresent(secretFile, ['I2_EXAMPLE_NAME', 'MISSING_NAME']);
  pass(results, 'secret_name_presence', names.present.includes('I2_EXAMPLE_NAME') && names.missing.includes('MISSING_NAME'));
  pass(results, 'secret_values_not_in_helper_output', !JSON.stringify(names).includes('present-value-not-printed'));

  // dirty worktree simulation via packet sha mismatch
  const mismatch = await evaluateReadiness(
    basePacket({ exact_commit_sha: 'b'.repeat(40), launcher_sha_pin: 'b'.repeat(40) }),
    { repoRoot, allowFixtureSkip: true }
  );
  pass(results, 'blocks_sha_mismatch', mismatch.verdict === 'FOUNDER_RUN_BLOCKED' && mismatch.failed.includes('exact_commit_sha'));

  // launcher pin mismatch
  const pinBad = await evaluateReadiness(
    basePacket({ launcher_sha_pin: 'c'.repeat(40) }),
    { repoRoot, allowFixtureSkip: true }
  );
  pass(results, 'blocks_stale_launcher_pin', pinBad.verdict === 'FOUNDER_RUN_BLOCKED' && pinBad.failed.includes('launcher_sha_pin_matches'));

  // missing required file
  const missingFile = await evaluateReadiness(
    basePacket({ required_files: ['tools/does-not-exist-founder-focus.mjs'] }),
    { repoRoot, allowFixtureSkip: true }
  );
  pass(results, 'blocks_missing_required_file', missingFile.failed.includes('required_files_exist'));

  // secret store inside repo blocked
  const insideStore = path.join(repoRoot, 'tools', '.tmp-founder-focus-secret.env');
  fs.writeFileSync(insideStore, 'I2_EXAMPLE_NAME=x\n', 'utf8');
  try {
    const inside = await evaluateReadiness(
      basePacket({
        external_secret_store_path: insideStore,
        required_secret_names: ['I2_EXAMPLE_NAME'],
      }),
      { repoRoot, allowFixtureSkip: true }
    );
    pass(results, 'blocks_secret_store_inside_repo', inside.failed.includes('external_secret_store_path'));
  } finally {
    try {
      fs.unlinkSync(insideStore);
    } catch {
      /* ignore */
    }
  }

  // redirect mismatch
  const redirect = await evaluateReadiness(
    basePacket({
      callback_or_redirect_expected: 'http://127.0.0.1:8765/oauth/callback',
      callback_or_redirect_actual: 'https://127.0.0.1:8765/oauth/callback',
    }),
    { repoRoot, allowFixtureSkip: true }
  );
  pass(results, 'blocks_redirect_mismatch', redirect.failed.includes('callback_or_redirect_match'));

  // AG design not tied to SHA
  const agBad = await evaluateReadiness(
    basePacket({
      architecture_guard_approval: {
        applies_to_execution_design: true,
        head_sha: 'd'.repeat(40),
        verdict: 'APPROVE_FOR_INDEPENDENT_UAT',
      },
    }),
    { repoRoot, allowFixtureSkip: true }
  );
  pass(results, 'blocks_ag_sha_mismatch', agBad.failed.includes('architecture_guard_execution_design'));

  // happy path with external secret store
  const happy = await evaluateReadiness(
    basePacket({
      external_secret_store_path: secretFile,
      required_secret_names: ['I2_EXAMPLE_NAME'],
      callback_or_redirect_expected: 'http://127.0.0.1:8765/oauth/callback',
      callback_or_redirect_actual: 'http://127.0.0.1:8765/oauth/callback',
      required_dependencies: [{ kind: 'file', path: path.join(repoRoot, 'tools/founder-run-readiness.mjs') }],
    }),
    { repoRoot, allowFixtureSkip: true }
  );
  pass(results, 'ready_when_all_fields_pass', happy.verdict === 'FOUNDER_RUN_READY', happy.failed.join(','));

  const report = formatReport(happy);
  pass(results, 'report_has_status_contract', /TECHNICAL RESULT:/.test(report) && /GOVERNANCE STATUS:/.test(report) && /AUTHORIZED NEXT STATE:/.test(report));
  pass(results, 'report_ends_with_verdict', report.trimEnd().endsWith('FOUNDER_RUN_READY'));
  pass(results, 'report_omits_secret_values', !report.includes('present-value-not-printed'));

  // completion-language fixture: blocked reports must not claim governance success
  const blockedReport = formatReport(mismatch);
  pass(
    results,
    'blocked_does_not_claim_governance_ready',
    blockedReport.includes('FOUNDER_RUN_BLOCKED') && !/governance acceptance/i.test(blockedReport.split('GOVERNANCE STATUS:')[1]?.split('\n')[1] || '')
  );

  // ENVIRONMENT_ACCEPTANCE OAuth-style minimum path must remain documented
  const envDoc = fs.readFileSync(path.join(repoRoot, 'docs/governance/ENVIRONMENT_ACCEPTANCE.md'), 'utf8');
  const oauthPathSteps = [
    'protected launcher',
    'SHA verification',
    'clean-worktree verification',
    'secret-store discovery',
    'secret-name presence check',
    'browser executable validation',
    'authorize URL construction',
    'callback listener startup',
    'callback URI contract',
    'safe output',
    'token-store destination',
  ];
  pass(
    results,
    'environment_acceptance_oauth_path_documented',
    oauthPathSteps.every((step) => envDoc.includes(step))
  );

  const laneDoc = fs.readFileSync(path.join(repoRoot, 'docs/governance/LOW_RISK_CONTROL_PLANE_CORRECTION.md'), 'utf8');
  pass(
    results,
    'control_plane_lane_requires_activation_and_gates',
    laneDoc.includes('Activation') && laneDoc.includes('Eligibility gates') && laneDoc.includes('No OAuth consent')
  );

  const scorecard = fs.readFileSync(path.join(repoRoot, 'docs/governance/AGENT_PILOT_SCORECARD.md'), 'utf8');
  pass(
    results,
    'scorecard_has_founder_focus_process_metrics',
    scorecard.includes('founder_manual_relays_requested') &&
      scorecard.includes('failures_caught_before_founder_execution') &&
      scorecard.includes('architecture_guard_changes_requested_before_execution')
  );

  try {
    fs.rmSync(tmp, { recursive: true, force: true });
  } catch {
    /* ignore */
  }

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
