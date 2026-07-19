/**
 * Self-tests for Supabase OAuth helper — no network, no live tokens.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  PRODUCTION_PROJECT_REF,
  SECRET_NAMES,
  loadDiagnosticsSecrets,
  assertPreAuthorizeSecrets,
  generateState,
  generatePkce,
  buildAuthorizeUrl,
  validateCallbackRequest,
  assertTokenScopes,
  computeExpiryIso,
  writeTokenSecretsToEnvFile,
  wipeTransient,
  redactSecrets,
  formatStatusResult,
  REDIRECT_URI,
  CALLBACK_PATH,
  OAuthHelperError,
  buildBrowserLaunchSpec,
  extractUrlFromBrowserLaunchSpec,
  authorizeUrlParamPresence,
  defectiveCmdStartTruncatesAtAmpersand,
} from './oauth-helper.mjs';

function pass(results, test, ok, detail) {
  results.push({ test, pass: Boolean(ok), detail });
}

export async function runSelfTests() {
  const results = [];

  // --- missing secret failure ---
  try {
    assertPreAuthorizeSecrets({
      clientId: undefined,
      projectRef: PRODUCTION_PROJECT_REF,
      filePath: '/tmp/x.env',
    });
    pass(results, 'missing_client_id', false, 'expected deny');
  } catch (e) {
    pass(results, 'missing_client_id', e instanceof OAuthHelperError && e.code === 'MISSING_CLIENT_ID');
  }

  try {
    assertPreAuthorizeSecrets({
      clientId: 'cid',
      projectRef: PRODUCTION_PROJECT_REF,
      filePath: null,
    });
    pass(results, 'missing_secret_env_file', false, 'expected deny');
  } catch (e) {
    pass(
      results,
      'missing_secret_env_file',
      e instanceof OAuthHelperError && e.code === 'MISSING_SECRET_ENV_FILE'
    );
  }

  // --- project-ref mismatch ---
  try {
    assertPreAuthorizeSecrets({
      clientId: 'cid',
      projectRef: 'nottheproductionref00',
      filePath: '/tmp/x.env',
    });
    pass(results, 'project_ref_mismatch', false, 'expected deny');
  } catch (e) {
    pass(
      results,
      'project_ref_mismatch',
      e instanceof OAuthHelperError && e.code === 'PROJECT_REF_MISMATCH'
    );
  }

  // --- state mismatch ---
  const state = generateState();
  try {
    validateCallbackRequest({
      method: 'GET',
      hostHeader: '127.0.0.1:8765',
      urlPathWithQuery: `${CALLBACK_PATH}?code=syntheticcodevalue&state=wrong`,
      expectedState: state,
    });
    pass(results, 'state_mismatch', false, 'expected deny');
  } catch (e) {
    pass(results, 'state_mismatch', e instanceof OAuthHelperError && e.code === 'STATE_MISMATCH');
  }

  // --- wrong callback path ---
  try {
    validateCallbackRequest({
      method: 'GET',
      hostHeader: '127.0.0.1:8765',
      urlPathWithQuery: `/wrong?code=syntheticcodevalue&state=${state}`,
      expectedState: state,
    });
    pass(results, 'wrong_callback_path', false, 'expected deny');
  } catch (e) {
    pass(results, 'wrong_callback_path', e instanceof OAuthHelperError && e.code === 'CALLBACK_PATH');
  }

  // --- happy callback path (synthetic code only in memory; never printed) ---
  const okCb = validateCallbackRequest({
    method: 'GET',
    hostHeader: '127.0.0.1:8765',
    urlPathWithQuery: `${CALLBACK_PATH}?code=syntheticcodevalue99&state=${state}`,
    expectedState: state,
  });
  pass(results, 'callback_ok', okCb.code === 'syntheticcodevalue99');

  // --- unexpected scope ---
  try {
    assertTokenScopes('projects:read edge_functions:read');
    pass(results, 'unexpected_scope', false, 'expected deny');
  } catch (e) {
    pass(results, 'unexpected_scope', e instanceof OAuthHelperError && e.code === 'UNEXPECTED_SCOPE');
  }
  pass(results, 'allowed_scope', assertTokenScopes('projects:read').omitted === false);

  // --- token response redaction ---
  const leaked = redactSecrets(
    'access_token":"supersecrettokenvalue" Authorization: Bearer supersecrettokenvalue code=abc123secret',
    ['supersecrettokenvalue', 'abc123secret']
  );
  pass(
    results,
    'token_response_redaction',
    !leaked.includes('supersecrettokenvalue') &&
      !leaked.includes('abc123secret') &&
      /REDACTED/.test(leaked)
  );

  // --- secret-store write failure ---
  try {
    writeTokenSecretsToEnvFile({
      filePath: path.join(os.tmpdir(), 'bhfos-oauth-test-no-such', 'nope.env'),
      existingMap: {},
      accessToken: 'tok_access_synthetic',
      refreshToken: 'tok_refresh_synthetic',
      tokenExpiry: computeExpiryIso(3600),
      writeFileSync: () => {
        const err = new Error('ENOSPC');
        err.code = 'ENOSPC';
        throw err;
      },
      renameSync: () => {},
      mkdirSync: () => {},
    });
    pass(results, 'secret_store_write_failure', false, 'expected deny');
  } catch (e) {
    pass(
      results,
      'secret_store_write_failure',
      e instanceof OAuthHelperError && e.code === 'SECRET_STORE_WRITE'
    );
  }

  // --- successful write + no secrets in status stdout shape ---
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bhfos-oauth-'));
  const filePath = path.join(dir, 'diagnostics.env');
  const access = 'tok_access_synthetic_value_xyz';
  const refresh = 'tok_refresh_synthetic_value_xyz';
  const expiry = computeExpiryIso(3600);
  const stored = writeTokenSecretsToEnvFile({
    filePath,
    existingMap: {
      [SECRET_NAMES.clientId]: 'cid',
      [SECRET_NAMES.projectRef]: PRODUCTION_PROJECT_REF,
    },
    accessToken: access,
    refreshToken: refresh,
    tokenExpiry: expiry,
  });
  const status = formatStatusResult({
    completed: true,
    accessPresent: stored.accessTokenPresent,
    refreshPresent: stored.refreshTokenPresent,
    expiryPresent: stored.expiryPresent,
    projectRefConfigured: stored.projectRefConfigured,
  });
  pass(
    results,
    'status_has_no_token_values',
    !status.includes(access) &&
      !status.includes(refresh) &&
      status.includes('token values: not displayed') &&
      status.includes('OAuth authorization: completed')
  );
  const fileBody = fs.readFileSync(filePath, 'utf8');
  pass(
    results,
    'secret_file_contains_names',
    fileBody.includes(SECRET_NAMES.accessToken) &&
      fileBody.includes(SECRET_NAMES.refreshToken) &&
      fileBody.includes(PRODUCTION_PROJECT_REF)
  );
  // cleanup file with secrets
  try {
    fs.unlinkSync(filePath);
    fs.rmdirSync(dir);
  } catch {
    /* ignore */
  }

  // --- load missing secrets from empty env ---
  try {
    const s = loadDiagnosticsSecrets({
      [SECRET_NAMES.secretEnvFile]: path.join(os.tmpdir(), 'bhfos-missing-env-file.env'),
    });
    assertPreAuthorizeSecrets(s);
    pass(results, 'load_missing_secrets', false, 'expected deny');
  } catch (e) {
    pass(results, 'load_missing_secrets', /DENY|MISSING/.test(String(e.message || e)));
  }

  // --- authorize URL shape (no secret in URL except client_id which is id) ---
  const pkce = generatePkce();
  const url = buildAuthorizeUrl({
    clientId: 'test-client-id',
    state: 'st',
    codeChallenge: pkce.challenge,
  });
  const u = new URL(url);
  pass(
    results,
    'authorize_url_shape',
    u.searchParams.get('response_type') === 'code' &&
      u.searchParams.get('redirect_uri') === REDIRECT_URI &&
      u.searchParams.get('code_challenge_method') === 'S256' &&
      u.searchParams.get('code_challenge') === pkce.challenge &&
      !url.includes(pkce.verifier)
  );

  // --- wipe transient ---
  const bag = { code: 'x', verifier: 'y', state: 'z' };
  wipeTransient(bag);
  pass(results, 'wipe_transient', Object.keys(bag).length === 0);

  // --- Windows browser launch: ampersand-safe delivery (no URL printed) ---
  const winState = generateState();
  const winPkce = generatePkce();
  const winClientId = 'win-test-client-id-not-a-secret';
  const winUrl = buildAuthorizeUrl({
    clientId: winClientId,
    state: winState,
    codeChallenge: winPkce.challenge,
  });
  const defective = defectiveCmdStartTruncatesAtAmpersand(winUrl);
  pass(
    results,
    'windows_defective_cmd_truncates_ampersand',
    defective.truncated && defective.firstSegmentHasOnlyResponseType
  );

  const captured = [];
  const winSpec = buildBrowserLaunchSpec(winUrl, 'win32');
  // Simulate launcher handoff: spawn receives intact argv; extract URL for presence checks only
  captured.push({ command: winSpec.command, args: winSpec.args });
  const delivered = extractUrlFromBrowserLaunchSpec(winSpec);
  const presence = authorizeUrlParamPresence(delivered);
  pass(
    results,
    'windows_launcher_delivers_full_authorize_url',
    delivered === winUrl &&
      presence.responseTypeCode &&
      presence.clientIdPresent &&
      presence.redirectUriPresent &&
      presence.statePresent &&
      presence.codeChallengePresent &&
      presence.codeChallengeMethodS256 &&
      presence.ampersandCount >= 4
  );
  const winCmd = String(winSpec.command || '').toLowerCase();
  const usesDirectBrowserArgv =
    winSpec.args.length === 1 &&
    winSpec.args[0] === winUrl &&
    (winCmd.endsWith('msedge.exe') ||
      winCmd.endsWith('chrome.exe') ||
      winCmd === 'explorer.exe') &&
    !captured.some((c) => c.command === 'cmd' || c.command === 'cmd.exe' || c.command === 'powershell.exe');
  pass(results, 'windows_launcher_uses_direct_browser_not_cmd_start', usesDirectBrowserArgv);

  // Runtime: resolved Windows browser path must exist when present (no navigation).
  if (process.platform === 'win32') {
    try {
      const { existsSync } = await import('node:fs');
      const resolvedIsFile =
        winCmd === 'explorer.exe' || (winSpec.command && existsSync(winSpec.command));
      pass(results, 'windows_launcher_browser_executable_resolves', resolvedIsFile);
      pass(
        results,
        'windows_launcher_ampersand_url_is_single_argv',
        winSpec.args.length === 1 && presence.ampersandCount >= 4
      );
    } catch (e) {
      pass(results, 'windows_launcher_browser_executable_resolves', false, String(e.message || e));
      pass(results, 'windows_launcher_ampersand_url_is_single_argv', false);
    }
  } else {
    pass(results, 'windows_launcher_browser_executable_resolves', true, 'skipped_non_windows');
    pass(results, 'windows_launcher_ampersand_url_is_single_argv', true, 'skipped_non_windows');
  }
  pass(
    results,
    'windows_launcher_pkce_verifier_not_in_launch_args',
    !JSON.stringify(winSpec.args).includes(winPkce.verifier)
  );

  // Presence-only result object must not embed raw state / challenge values
  const presenceDump = JSON.stringify(presence);
  pass(
    results,
    'windows_presence_checks_omit_param_values',
    !presenceDump.includes(winState) &&
      !presenceDump.includes(winPkce.challenge) &&
      !presenceDump.includes(winPkce.verifier)
  );

  // --- stdout/stderr scan of this test module's status strings ---
  const combined = results.map((r) => JSON.stringify(r)).join('\n') + '\n' + status;
  pass(
    results,
    'no_token_values_in_stdout_stderr',
    !combined.includes(access) && !combined.includes(refresh)
  );
  // Self-test public JSON must not include state / PKCE verifier / full authorize URL
  const publicDump = JSON.stringify({
    ok: true,
    failed: results.filter((r) => !r.pass).map((r) => r.test),
  });
  pass(
    results,
    'no_state_or_pkce_verifier_in_public_self_test_json',
    !publicDump.includes(winState) &&
      !publicDump.includes(winPkce.verifier) &&
      !publicDump.includes('code_challenge=') &&
      !combined.includes(winPkce.verifier)
  );

  const failed = results.filter((r) => !r.pass);
  return { ok: failed.length === 0, results, failed };
}
