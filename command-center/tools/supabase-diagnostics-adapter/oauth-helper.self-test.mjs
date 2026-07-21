/**
 * Self-tests for Supabase OAuth helper — no network, no live tokens, no fixtures with secrets.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  PRODUCTION_PROJECT_REF,
  SECRET_NAMES,
  REDIRECT_URI,
  PUBLIC_REDIRECT_URI,
  LOCAL_LISTENER_URI,
  PUBLIC_CALLBACK_HOST,
  CALLBACK_PATH,
  CALLBACK_HOST,
  CALLBACK_PORT,
  CALLBACK_BIND,
  APPROVED_WINDOWS_BROWSER_PATHS,
  loadDiagnosticsSecrets,
  assertPreAuthorizeSecrets,
  assertSplitRedirectContract,
  generateState,
  generatePkce,
  buildAuthorizeUrl,
  buildTokenExchangeRequest,
  validateCallbackRequest,
  assertTokenScopes,
  attestPreStoreCapabilities,
  attestationOutOfCeilingPath,
  computeExpiryIso,
  writeTokenSecretsToEnvFile,
  wipeTransient,
  formatStatusResult,
  OAuthHelperError,
  buildBrowserLaunchSpec,
  extractUrlFromBrowserLaunchSpec,
  authorizeUrlParamPresence,
  defectiveCmdStartTruncatesAtAmpersand,
  isApprovedWindowsBrowserPath,
  assertNotForbiddenBrowserCommand,
  resolveWindowsBrowserExecutable,
  callbackListenArgs,
} from './oauth-helper.mjs';

function pass(results, test, ok, detail) {
  results.push({ test, pass: Boolean(ok), ...(detail ? { detail: String(detail).slice(0, 120) } : {}) });
}

export async function runSelfTests() {
  const results = [];
  const syntheticSecrets = {
    access: 'tok_access_synthetic_value_xyz',
    refresh: 'tok_refresh_synthetic_value_xyz',
  };

  // --- missing secrets ---
  try {
    assertPreAuthorizeSecrets({
      clientId: undefined,
      projectRef: PRODUCTION_PROJECT_REF,
      filePath: '/tmp/x.env',
    });
    pass(results, 'missing_client_id', false);
  } catch (e) {
    pass(results, 'missing_client_id', e instanceof OAuthHelperError && e.code === 'MISSING_CLIENT_ID');
  }

  try {
    assertPreAuthorizeSecrets({
      clientId: 'cid',
      projectRef: 'nottheproductionref00',
      filePath: '/tmp/x.env',
    });
    pass(results, 'project_ref_mismatch', false);
  } catch (e) {
    pass(results, 'project_ref_mismatch', e.code === 'PROJECT_REF_MISMATCH');
  }

  // --- split public HTTPS redirect vs local HTTP listener ---
  pass(
    results,
    'exact_public_https_redirect',
    PUBLIC_REDIRECT_URI === 'https://oauth-diagnostics.bhfos.com/oauth/callback' &&
      REDIRECT_URI === PUBLIC_REDIRECT_URI &&
      CALLBACK_BIND.publicRedirectUri === PUBLIC_REDIRECT_URI &&
      String(PUBLIC_REDIRECT_URI).startsWith('https:')
  );
  pass(
    results,
    'exact_local_http_listener',
    LOCAL_LISTENER_URI === 'http://127.0.0.1:8765/oauth/callback' &&
      CALLBACK_BIND.localListenerUri === LOCAL_LISTENER_URI &&
      !String(LOCAL_LISTENER_URI).startsWith('https:')
  );
  pass(
    results,
    'split_redirect_contract',
    assertSplitRedirectContract() === true &&
      PUBLIC_CALLBACK_HOST === 'oauth-diagnostics.bhfos.com' &&
      PUBLIC_REDIRECT_URI !== LOCAL_LISTENER_URI
  );
  pass(
    results,
    'http_loopback_not_used_as_oauth_redirect',
    REDIRECT_URI !== 'http://127.0.0.1:8765/oauth/callback'
  );
  pass(
    results,
    'http_public_redirect_scheme_rejected_by_contract',
    assertSplitRedirectContract() === true &&
      !PUBLIC_REDIRECT_URI.startsWith('http://') &&
      PUBLIC_REDIRECT_URI.startsWith('https://')
  );

  // --- listener bind loopback only ---
  const listenArgs = callbackListenArgs();
  pass(
    results,
    'listener_binds_only_127_0_0_1',
    listenArgs[0] === CALLBACK_PORT &&
      listenArgs[1] === '127.0.0.1' &&
      listenArgs[1] !== '0.0.0.0' &&
      listenArgs[1] !== 'localhost'
  );

  const state = generateState();
  const pkce = generatePkce();

  // --- wrong host ---
  try {
    validateCallbackRequest({
      method: 'GET',
      hostHeader: '192.168.1.1:8765',
      urlPathWithQuery: `${CALLBACK_PATH}?code=syntheticcodevalue99&state=${state}`,
      expectedState: state,
    });
    pass(results, 'wrong_host_rejected', false);
  } catch (e) {
    pass(results, 'wrong_host_rejected', e.code === 'CALLBACK_HOST');
  }

  // --- wrong port ---
  try {
    validateCallbackRequest({
      method: 'GET',
      hostHeader: '127.0.0.1:9999',
      urlPathWithQuery: `${CALLBACK_PATH}?code=syntheticcodevalue99&state=${state}`,
      expectedState: state,
    });
    pass(results, 'wrong_port_rejected', false);
  } catch (e) {
    pass(results, 'wrong_port_rejected', e.code === 'CALLBACK_PORT');
  }

  // --- wrong path ---
  try {
    validateCallbackRequest({
      method: 'GET',
      hostHeader: '127.0.0.1:8765',
      urlPathWithQuery: `/wrong?code=syntheticcodevalue99&state=${state}`,
      expectedState: state,
    });
    pass(results, 'wrong_path_rejected', false);
  } catch (e) {
    pass(results, 'wrong_path_rejected', e.code === 'CALLBACK_PATH');
  }

  // --- state mismatch ---
  try {
    validateCallbackRequest({
      method: 'GET',
      hostHeader: '127.0.0.1:8765',
      urlPathWithQuery: `${CALLBACK_PATH}?code=syntheticcodevalue99&state=wrong`,
      expectedState: state,
    });
    pass(results, 'state_mismatch_rejected', false);
  } catch (e) {
    pass(results, 'state_mismatch_rejected', e.code === 'STATE_MISMATCH');
  }

  // --- missing code ---
  try {
    validateCallbackRequest({
      method: 'GET',
      hostHeader: '127.0.0.1:8765',
      urlPathWithQuery: `${CALLBACK_PATH}?state=${state}`,
      expectedState: state,
    });
    pass(results, 'missing_code_rejected', false);
  } catch (e) {
    pass(results, 'missing_code_rejected', e.code === 'MISSING_CODE');
  }

  // --- happy callback ---
  const okCb = validateCallbackRequest({
    method: 'GET',
    hostHeader: '127.0.0.1:8765',
    urlPathWithQuery: `${CALLBACK_PATH}?code=syntheticcodevalue99&state=${state}`,
    expectedState: state,
  });
  pass(results, 'callback_ok', okCb.code === 'syntheticcodevalue99');

  // --- scopes ---
  try {
    assertTokenScopes('projects:read edge_functions:read');
    pass(results, 'unexpected_scope_rejected', false);
  } catch (e) {
    pass(results, 'unexpected_scope_rejected', e.code === 'UNEXPECTED_SCOPE');
  }
  const omitted = assertTokenScopes('');
  const omittedUndef = assertTokenScopes(undefined);
  pass(
    results,
    'omitted_scope_platform_attested',
    omitted.omitted === true &&
      omitted.platformAttestedOmission === true &&
      omittedUndef.omitted === true &&
      Array.isArray(omitted.scopes) &&
      omitted.scopes.length === 0
  );
  pass(results, 'allowed_scope_ok', assertTokenScopes('projects:read').scopes.includes('projects:read'));

  // --- pre-store capability attestation (injected fetch; no live network) ---
  const allowPath = `/v1/projects/${PRODUCTION_PROJECT_REF}`;
  const probePath = attestationOutOfCeilingPath();
  pass(
    results,
    'attestation_probe_path_is_api_keys',
    probePath === `/v1/projects/${PRODUCTION_PROJECT_REF}/api-keys`
  );

  const mockResolveAllowed = () => ({
    method: 'GET',
    path: allowPath,
    ref: PRODUCTION_PROJECT_REF,
    operation: 'project_status',
  });
  const mockAssertProhibited = (p) => {
    if (String(p).includes('/api-keys')) {
      throw new Error(`DENY: prohibited path pattern "/api-keys" in ${p}`);
    }
  };

  try {
    await attestPreStoreCapabilities('tok_ephemeral_attest_ok', {
      fetchImpl: async (url) => {
        if (String(url).endsWith(allowPath)) return { ok: true, status: 200 };
        if (String(url).endsWith(probePath)) return { ok: false, status: 403 };
        return { ok: false, status: 404 };
      },
      resolveAllowedPathFn: mockResolveAllowed,
      assertNotProhibitedFn: mockAssertProhibited,
    });
    pass(results, 'attestation_allow_ok_probe_denied', true);
  } catch (e) {
    pass(results, 'attestation_allow_ok_probe_denied', false, e && e.message);
  }

  try {
    await attestPreStoreCapabilities('tok_ephemeral_attest_allow_fail', {
      fetchImpl: async (url) => {
        if (String(url).endsWith(allowPath)) return { ok: false, status: 401 };
        return { ok: false, status: 403 };
      },
      resolveAllowedPathFn: mockResolveAllowed,
      assertNotProhibitedFn: mockAssertProhibited,
    });
    pass(results, 'attestation_allow_fail_no_store', false);
  } catch (e) {
    pass(results, 'attestation_allow_fail_no_store', e.code === 'ATTEST_ALLOW_FAILED');
  }

  try {
    await attestPreStoreCapabilities('tok_ephemeral_attest_ceiling', {
      fetchImpl: async () => ({ ok: true, status: 200 }),
      resolveAllowedPathFn: mockResolveAllowed,
      assertNotProhibitedFn: mockAssertProhibited,
    });
    pass(results, 'attestation_ceiling_breach_denied', false);
  } catch (e) {
    pass(results, 'attestation_ceiling_breach_denied', e.code === 'ATTEST_CEILING_BREACH');
  }

  // --- authorize URL / PKCE S256 / ampersands ---
  const url = buildAuthorizeUrl({
    clientId: 'test-client-id',
    state,
    codeChallenge: pkce.challenge,
  });
  const u = new URL(url);
  pass(
    results,
    'pkce_s256_present',
    u.searchParams.get('code_challenge_method') === 'S256' &&
      Boolean(u.searchParams.get('code_challenge')) &&
      !url.includes(pkce.verifier)
  );
  pass(
    results,
    'exact_redirect_in_authorize_url',
    u.searchParams.get('redirect_uri') === PUBLIC_REDIRECT_URI &&
      u.searchParams.get('redirect_uri') !== LOCAL_LISTENER_URI
  );
  const tokenReq = buildTokenExchangeRequest({
    code: 'syntheticcodevalue99',
    codeVerifier: pkce.verifier,
    clientId: 'test-client-id',
    clientSecret: undefined,
  });
  pass(
    results,
    'exact_public_redirect_in_token_exchange',
    tokenReq.body.includes(
      `redirect_uri=${encodeURIComponent(PUBLIC_REDIRECT_URI)}`
    ) && !tokenReq.body.includes(encodeURIComponent(LOCAL_LISTENER_URI))
  );
  const defective = defectiveCmdStartTruncatesAtAmpersand(url);
  pass(results, 'cmd_ampersand_truncation_model', defective.truncated);

  // --- Windows browser absolute path allowlist ---
  const fakeEdge = APPROVED_WINDOWS_BROWSER_PATHS[0];
  const existsAllow = (p) => normalizeEq(p, fakeEdge);
  function normalizeEq(a, b) {
    return path.normalize(a).toLowerCase() === path.normalize(b).toLowerCase();
  }

  const winSpec = buildBrowserLaunchSpec(url, 'win32', { existsSyncFn: existsAllow });
  const delivered = extractUrlFromBrowserLaunchSpec(winSpec);
  const presence = authorizeUrlParamPresence(delivered);
  pass(
    results,
    'full_ampersand_url_preserved',
    delivered === url &&
      presence.clientIdPresent &&
      presence.redirectUriPresent &&
      presence.statePresent &&
      presence.codeChallengePresent &&
      presence.codeChallengeMethodS256 &&
      presence.ampersandCount >= 4
  );
  pass(
    results,
    'approved_browser_absolute_path_accepted',
    winSpec.command === fakeEdge &&
      path.win32.isAbsolute(winSpec.command) &&
      winSpec.args.length === 1 &&
      winSpec.options.shell === false
  );

  // forbidden / PATH / env-steered
  try {
    assertNotForbiddenBrowserCommand('explorer.exe');
    pass(results, 'forbidden_explorer_rejected', false);
  } catch (e) {
    pass(results, 'forbidden_explorer_rejected', e.code === 'BROWSER_FORBIDDEN');
  }
  try {
    assertNotForbiddenBrowserCommand('chrome.exe', { pathApi: path.win32 }); // PATH-only basename
    pass(results, 'path_resolved_executable_rejected', false);
  } catch (e) {
    pass(
      results,
      'path_resolved_executable_rejected',
      e.code === 'BROWSER_NOT_ABSOLUTE' || e.code === 'BROWSER_FORBIDDEN'
    );
  }
  // Env-steered locations (LOCALAPPDATA / custom dirs) are not on the allowlist
  const steeredPath = path.join(
    process.env.LOCALAPPDATA || 'C:\\Users\\steered\\AppData\\Local',
    'Google',
    'Chrome',
    'Application',
    'chrome.exe'
  );
  pass(
    results,
    'environment_steered_fake_browser_rejected',
    !isApprovedWindowsBrowserPath(steeredPath) &&
      resolveWindowsBrowserExecutable((p) => normalizeEq(p, steeredPath)) === null
  );

  // no approved browser → fail closed (no explorer fallback)
  try {
    buildBrowserLaunchSpec(url, 'win32', { existsSyncFn: () => false });
    pass(results, 'no_explorer_fallback_fail_closed', false);
  } catch (e) {
    pass(
      results,
      'no_explorer_fallback_fail_closed',
      e.code === 'BROWSER_NOT_FOUND' && !String(e.message).includes('explorer')
    );
  }

  try {
    buildBrowserLaunchSpec(url, 'win32', { existsSyncFn: existsAllow });
    const bad = { platform: 'win32', command: 'explorer.exe', args: [url] };
    extractUrlFromBrowserLaunchSpec(bad);
    pass(results, 'unapproved_executable_rejected', false);
  } catch (e) {
    pass(
      results,
      'unapproved_executable_rejected',
      e.code === 'BROWSER_FORBIDDEN' || e.code === 'BROWSER_NOT_APPROVED'
    );
  }

  // --- secret store / redaction / no private key material ---
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bhfos-oauth-'));
  const filePath = path.join(dir, 'diagnostics.env');
  const expiry = computeExpiryIso(3600);
  writeTokenSecretsToEnvFile({
    filePath,
    existingMap: { [SECRET_NAMES.clientId]: 'cid' },
    accessToken: syntheticSecrets.access,
    refreshToken: syntheticSecrets.refresh,
    tokenExpiry: expiry,
  });
  const status = formatStatusResult({
    completed: true,
    accessPresent: true,
    refreshPresent: true,
    expiryPresent: true,
    projectRefConfigured: true,
  });
  pass(
    results,
    'status_has_no_token_values',
    !status.includes(syntheticSecrets.access) &&
      !status.includes(syntheticSecrets.refresh) &&
      status.includes('token values: not displayed')
  );

  const helperSrc = fs.readFileSync(new URL('./oauth-helper.mjs', import.meta.url), 'utf8');
  const authSrc = fs.readFileSync(new URL('./oauth-authorize.mjs', import.meta.url), 'utf8');
  const tunnelSrc = fs.readFileSync(new URL('./oauth-tunnel.mjs', import.meta.url), 'utf8');
  pass(
    results,
    'no_self_signed_cert_or_private_key_codegen',
    !/New-SelfSignedCertificate|BEGIN (RSA )?PRIVATE KEY|createPrivateKey|oauth-callback\.pfx/.test(
      helperSrc + authSrc + tunnelSrc
    ) && !/import https/.test(authSrc)
  );
  pass(
    results,
    'named_tunnel_only_constants',
    /cloudflare_named/.test(tunnelSrc) &&
      !tunnelSrc.includes('trycloudflare.com') &&
      helperSrc.includes('oauth-diagnostics.bhfos.com') &&
      tunnelSrc.includes('PUBLIC_CALLBACK_HOST') &&
      !helperSrc.includes('trycloudflare.com')
  );

  try {
    fs.unlinkSync(filePath);
    fs.rmdirSync(dir);
  } catch {
    /* ignore */
  }

  wipeTransient({ code: 'x', verifier: pkce.verifier, state });
  pass(results, 'wipe_transient', true);

  const publicDump = JSON.stringify({
    ok: true,
    failed: results.filter((r) => !r.pass).map((r) => r.test),
  });
  const combined = results.map((r) => JSON.stringify(r)).join('\n') + status + publicDump;
  pass(
    results,
    'no_secrets_state_pkce_or_authorize_url_in_output',
    !combined.includes(syntheticSecrets.access) &&
      !combined.includes(syntheticSecrets.refresh) &&
      !combined.includes(pkce.verifier) &&
      !combined.includes('code_challenge=') &&
      !publicDump.includes(state) &&
      !combined.includes('BEGIN PRIVATE KEY')
  );

  // load missing
  try {
    const s = loadDiagnosticsSecrets({
      [SECRET_NAMES.secretEnvFile]: path.join(os.tmpdir(), 'bhfos-missing-env-file.env'),
    });
    assertPreAuthorizeSecrets(s);
    pass(results, 'load_missing_secrets', false);
  } catch (e) {
    pass(results, 'load_missing_secrets', /DENY|MISSING/.test(String(e.message || e)));
  }

  const failed = results.filter((r) => !r.pass);
  return { ok: failed.length === 0, results, failed };
}
