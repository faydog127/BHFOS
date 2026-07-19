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
  credentialFilesInsideRepo,
  hasPopulatedSecretAssignment,
  hasPrivateKeyMaterial,
  isAlwaysDenyCredentialBasename,
} from './founder-run-readiness.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

function pass(results, test, ok, detail) {
  results.push({ test, pass: Boolean(ok), ...(detail ? { detail: String(detail).slice(0, 160) } : {}) });
}

function git(args) {
  return childProcess.execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' }).trim();
}

function write(filePath, text) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, text, 'utf8');
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
    fixture_ignore_worktree_dirtiness: true,
    ...overrides,
  };
}

export async function runSelfTests() {
  const results = [];
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'founder-run-ready-'));
  const fixtureRepo = path.join(tmp, 'fixture-repo');
  fs.mkdirSync(fixtureRepo, { recursive: true });

  // helpers
  pass(results, 'is_sha', isSha('a'.repeat(40)) && !isSha('short'));
  pass(results, 'path_outside_repo', pathIsOutsideRepo(tmp, repoRoot));

  const secretFile = path.join(tmp, 'external-approved-store.env');
  fs.writeFileSync(secretFile, 'I2_EXAMPLE_NAME=present-value-not-printed\nOTHER=1\n', 'utf8');
  const names = secretNamesPresent(secretFile, ['I2_EXAMPLE_NAME', 'MISSING_NAME']);
  pass(results, 'secret_name_presence', names.present.includes('I2_EXAMPLE_NAME') && names.missing.includes('MISSING_NAME'));
  pass(results, 'secret_values_not_in_helper_output', !JSON.stringify(names).includes('present-value-not-printed'));

  // --- credential scanner: false positives must not block ---
  write(
    path.join(fixtureRepo, 'docs/governance/SECRET_INVENTORY.md'),
    '# Secret inventory\n\nNames only:\n\n- I2_SUPABASE_OAUTH_CLIENT_ID\n- I2_SUPABASE_OAUTH_ACCESS_TOKEN\n\nNo values.\n'
  );
  write(
    path.join(fixtureRepo, 'src/components/crm/settings/SecretsManager.jsx'),
    'export function SecretsManager() { return <div>token credential key secret UI</div>; }\n'
  );
  write(
    path.join(fixtureRepo, 'docs/token-and-secret-guide.md'),
    'This documentation mentions token, secret, credential, and key without assignments.\n'
  );
  write(
    path.join(fixtureRepo, 'docs/governance/names-only-inventory.md'),
    '| Name | Purpose |\n| --- | --- |\n| I2_EXAMPLE_TOKEN | inventory name only |\n'
  );
  write(path.join(fixtureRepo, '.env.example'), 'I2_EXAMPLE_TOKEN=placeholder\nAPI_SECRET=changeme\n');
  write(
    path.join(fixtureRepo, 'tests/fixtures/oauth-placeholder.env'),
    'I2_SUPABASE_OAUTH_CLIENT_SECRET=placeholder\nREFRESH_TOKEN=example\n'
  );

  let hits = credentialFilesInsideRepo(fixtureRepo);
  pass(results, 'scan_allows_SECRET_INVENTORY_md', !hits.some((h) => h.includes('SECRET_INVENTORY.md')), hits.join(','));
  pass(results, 'scan_allows_SecretsManager_jsx', !hits.some((h) => h.includes('SecretsManager.jsx')), hits.join(','));
  pass(results, 'scan_allows_docs_with_secret_words', !hits.some((h) => h.includes('token-and-secret-guide.md')), hits.join(','));
  pass(results, 'scan_allows_names_only_inventory', !hits.some((h) => h.includes('names-only-inventory.md')), hits.join(','));
  pass(results, 'scan_allows_env_example', !hits.some((h) => h.includes('.env.example')), hits.join(','));
  pass(results, 'scan_allows_placeholder_fixture_env', !hits.some((h) => h.includes('oauth-placeholder.env')), hits.join(','));

  // --- credential scanner: true positives must block ---
  write(path.join(fixtureRepo, '.env'), 'I2_SUPABASE_OAUTH_CLIENT_ID=live-client-id-value\n');
  write(path.join(fixtureRepo, '.env.diagnostics'), 'I2_SUPABASE_OAUTH_CLIENT_SECRET=live-secret-value\n');
  write(path.join(fixtureRepo, 'private.pem'), '-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC7\n-----END PRIVATE KEY-----\n');
  write(path.join(fixtureRepo, 'id_rsa'), '-----BEGIN OPENSSH PRIVATE KEY-----\nx\n-----END OPENSSH PRIVATE KEY-----\n');
  write(path.join(fixtureRepo, 'oauth-token-cache.json'), 'ACCESS_TOKEN=eyJhbGciOiJIUzI1NiJ9.payload.sig\n');
  write(path.join(fixtureRepo, 'nested/diagnostics.env'), 'I2_SUPABASE_OAUTH_REFRESH_TOKEN=refresh-live-value-xyz\n');
  write(path.join(fixtureRepo, 'app-credentials.json'), 'CLIENT_SECRET=not-a-placeholder-value\n');

  hits = credentialFilesInsideRepo(fixtureRepo);
  pass(results, 'scan_blocks_populated_dotenv', hits.includes('.env'), hits.join(','));
  pass(results, 'scan_blocks_dotenv_diagnostics', hits.includes('.env.diagnostics'), hits.join(','));
  pass(results, 'scan_blocks_private_key_pem', hits.includes('private.pem'), hits.join(','));
  pass(results, 'scan_blocks_id_rsa', hits.includes('id_rsa'), hits.join(','));
  pass(results, 'scan_blocks_token_cache', hits.includes('oauth-token-cache.json'), hits.join(','));
  pass(results, 'scan_blocks_repo_relative_secret_store', hits.includes('nested/diagnostics.env'), hits.join(','));
  pass(results, 'scan_blocks_credentials_json', hits.some((h) => h.endsWith('app-credentials.json') || h.includes('credentials.json')), hits.join(','));

  pass(results, 'helper_detects_populated_assignment', hasPopulatedSecretAssignment('API_SECRET=live-value-here\n'));
  pass(results, 'helper_ignores_placeholder_assignment', !hasPopulatedSecretAssignment('API_SECRET=placeholder\n'));
  pass(results, 'helper_detects_private_key_marker', hasPrivateKeyMaterial('-----BEGIN RSA PRIVATE KEY-----\nx\n'));
  pass(results, 'basename_dotenv_always_deny', isAlwaysDenyCredentialBasename('.env'));
  pass(results, 'basename_SecretsManager_not_always_deny', !isAlwaysDenyCredentialBasename('SecretsManager.jsx'));

  // External approved secret store path is outside the repo scan root
  pass(
    results,
    'external_approved_secret_store_not_in_repo_scan',
    !credentialFilesInsideRepo(fixtureRepo).some((h) => h.includes('external-approved-store'))
  );

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

  // Live repo must not be blocked by doc/UI false positives
  const liveRepoHits = credentialFilesInsideRepo(path.resolve(repoRoot, '..'));
  // Scan command-center parent (repo root). Path: tools is under command-center, so repo root is parent.
  const gitRepoRoot = path.resolve(repoRoot, '..');
  const gitRootHits = credentialFilesInsideRepo(gitRepoRoot);
  pass(
    results,
    'live_repo_scan_omits_SECRET_INVENTORY_and_SecretsManager',
    !gitRootHits.some((h) => /SECRET_INVENTORY\.md$|SecretsManager\.jsx$/i.test(h)),
    gitRootHits.slice(0, 8).join(',')
  );
  void liveRepoHits;

  // Plant a populated .env under a temp clone-like tree and ensure evaluateReadiness blocks
  const dirtyCredRepo = path.join(tmp, 'dirty-cred-repo');
  fs.mkdirSync(path.join(dirtyCredRepo, 'tools'), { recursive: true });
  fs.writeFileSync(path.join(dirtyCredRepo, '.env'), 'CLIENT_SECRET=live-blocking-value\n', 'utf8');
  // Minimal fake git is not available; unit-test scanner hit instead (evaluate needs git).
  pass(
    results,
    'populated_env_in_repo_is_credential_hit',
    credentialFilesInsideRepo(dirtyCredRepo).includes('.env')
  );

  // happy path with external secret store — no credential-scan skip
  const happy = await evaluateReadiness(
    basePacket({
      external_secret_store_path: secretFile,
      required_secret_names: ['I2_EXAMPLE_NAME'],
      callback_or_redirect_expected: 'https://oauth-diagnostics.bhfos.com/oauth/callback',
      callback_or_redirect_actual: 'https://oauth-diagnostics.bhfos.com/oauth/callback',
      required_dependencies: [{ kind: 'file', path: path.join(repoRoot, 'tools/founder-run-readiness.mjs') }],
    }),
    { repoRoot, allowFixtureSkip: true }
  );
  pass(results, 'ready_when_all_fields_pass', happy.verdict === 'FOUNDER_RUN_READY', happy.failed.join(','));
  pass(results, 'ready_includes_credential_field', happy.checks.some((c) => c.id === 'no_credential_file_in_repo' && c.ok));

  // OAuth tunnel packet — credentials outside repo + exact public redirect
  const tunnelCreds = path.join(tmp, 'named-tunnel-creds.json');
  fs.writeFileSync(tunnelCreds, '{"TunnelID":"synthetic"}\n', 'utf8');
  const tunnelReady = await evaluateReadiness(
    basePacket({
      external_secret_store_path: secretFile,
      required_secret_names: ['I2_EXAMPLE_NAME'],
      callback_or_redirect_expected: 'https://oauth-diagnostics.bhfos.com/oauth/callback',
      callback_or_redirect_actual: 'https://oauth-diagnostics.bhfos.com/oauth/callback',
      required_local_port: undefined,
      tunnel: {
        required: true,
        class: 'cloudflare_named',
        stable_hostname: 'oauth-diagnostics.bhfos.com',
        public_redirect_uri: 'https://oauth-diagnostics.bhfos.com/oauth/callback',
        local_listener_uri: 'http://127.0.0.1:8765/oauth/callback',
        credentials_path: tunnelCreds,
        path_only_config_attested: true,
        stop_after_run_and_closure_procedure_present: true,
      },
    }),
    { repoRoot, allowFixtureSkip: true }
  );
  pass(
    results,
    'tunnel_packet_ready',
    tunnelReady.verdict === 'FOUNDER_RUN_READY',
    tunnelReady.failed.join(',')
  );

  const tunnelBadHost = await evaluateReadiness(
    basePacket({
      callback_or_redirect_expected: 'https://oauth-diagnostics.bhfos.com/oauth/callback',
      callback_or_redirect_actual: 'https://oauth-diagnostics.bhfos.com/oauth/callback',
      tunnel: {
        required: true,
        class: 'cloudflare_named',
        stable_hostname: 'random-abc.trycloudflare.com',
        public_redirect_uri: 'https://oauth-diagnostics.bhfos.com/oauth/callback',
        local_listener_uri: 'http://127.0.0.1:8765/oauth/callback',
        credentials_path: tunnelCreds,
        path_only_config_attested: true,
        stop_after_run_and_closure_procedure_present: true,
      },
    }),
    { repoRoot, allowFixtureSkip: true }
  );
  pass(
    results,
    'tunnel_random_hostname_blocked',
    tunnelBadHost.verdict === 'FOUNDER_RUN_BLOCKED' &&
      tunnelBadHost.failed.includes('tunnel_stable_hostname_pinned')
  );

  const report = formatReport(happy);
  pass(results, 'report_has_status_contract', /TECHNICAL RESULT:/.test(report) && /GOVERNANCE STATUS:/.test(report) && /AUTHORIZED NEXT STATE:/.test(report));
  pass(results, 'report_ends_with_verdict', report.trimEnd().endsWith('FOUNDER_RUN_READY'));
  pass(results, 'report_omits_secret_values', !report.includes('present-value-not-printed') && !report.includes('live-client-id-value'));

  const blockedReport = formatReport(mismatch);
  pass(
    results,
    'blocked_does_not_claim_governance_ready',
    blockedReport.includes('FOUNDER_RUN_BLOCKED') && !/governance acceptance/i.test(blockedReport.split('GOVERNANCE STATUS:')[1]?.split('\n')[1] || '')
  );

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
    'tunnel stop after every authorize attempt',
    'public callback closure verification',
    'oauth-diagnostics.bhfos.com',
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
