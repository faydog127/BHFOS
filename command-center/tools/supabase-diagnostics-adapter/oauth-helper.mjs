/**
 * Supabase Diagnostics OAuth helper — pure/testable core (G2.3B-B2D)
 *
 * No network I/O here except what callers inject. Never logs secrets.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const PRODUCTION_PROJECT_REF = 'wwyxohjnyqnegzbxtuxs';
export const CALLBACK_HOST = '127.0.0.1';
export const CALLBACK_PORT = 8765;
export const CALLBACK_PATH = '/oauth/callback';
/** Public HTTPS redirect (Cloudflare Named Tunnel). Authorize + token exchange. */
export const PUBLIC_CALLBACK_HOST = 'oauth-diagnostics.bhfos.com';
export const PUBLIC_REDIRECT_URI = `https://${PUBLIC_CALLBACK_HOST}${CALLBACK_PATH}`;
/** Local loopback listener only — never used as OAuth redirect_uri. */
export const LOCAL_LISTENER_URI = `http://${CALLBACK_HOST}:${CALLBACK_PORT}${CALLBACK_PATH}`;
/** OAuth redirect_uri contract (public HTTPS). Alias of PUBLIC_REDIRECT_URI. */
export const REDIRECT_URI = PUBLIC_REDIRECT_URI;
export const AUTHORIZE_URL = 'https://api.supabase.com/v1/oauth/authorize';
export const TOKEN_URL = 'https://api.supabase.com/v1/oauth/token';
export const ALLOWED_SCOPES = new Set(['projects:read']);

/** Listener bind contract — host must be loopback IP only (not 0.0.0.0). */
export const CALLBACK_BIND = Object.freeze({
  host: CALLBACK_HOST,
  port: CALLBACK_PORT,
  path: CALLBACK_PATH,
  localListenerUri: LOCAL_LISTENER_URI,
  publicRedirectUri: PUBLIC_REDIRECT_URI,
  /** @deprecated use publicRedirectUri — OAuth redirect is public HTTPS */
  redirectUri: PUBLIC_REDIRECT_URI,
});

/**
 * Approved Windows browser absolute paths only.
 * Do not derive from PATH, PATHEXT, or environment-steered directories.
 */
export const APPROVED_WINDOWS_BROWSER_PATHS = Object.freeze([
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
]);

const SECRET_NAMES = {
  clientId: 'I2_SUPABASE_OAUTH_CLIENT_ID',
  clientSecret: 'I2_SUPABASE_OAUTH_CLIENT_SECRET',
  projectRef: 'SUPABASE_DIAGNOSTICS_PROJECT_REF',
  accessToken: 'I2_SUPABASE_OAUTH_ACCESS_TOKEN',
  refreshToken: 'I2_SUPABASE_OAUTH_REFRESH_TOKEN',
  tokenExpiry: 'I2_SUPABASE_OAUTH_TOKEN_EXPIRY',
  secretEnvFile: 'I2_DIAGNOSTICS_SECRET_ENV_FILE',
  orgSlug: 'I2_SUPABASE_OAUTH_ORGANIZATION_SLUG',
};

export { SECRET_NAMES };

export class OAuthHelperError extends Error {
  constructor(message, code = 'OAUTH_HELPER_DENY') {
    super(message);
    this.name = 'OAuthHelperError';
    this.code = code;
  }
}

/** Base64url without padding (PKCE / OAuth). */
export function base64Url(buf) {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

export function generateState() {
  return base64Url(crypto.randomBytes(32));
}

export function generatePkce() {
  const verifier = base64Url(crypto.randomBytes(32));
  const challenge = base64Url(crypto.createHash('sha256').update(verifier).digest());
  return { verifier, challenge, method: 'S256' };
}

/**
 * Parse a dotenv-style file into a map. Does not evaluate shell.
 * Lines must be KEY=VALUE (VALUE may be quoted).
 */
export function parseEnvFile(contents) {
  const out = Object.create(null);
  for (const raw of String(contents).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

export function serializeEnvFile(map) {
  const keys = Object.keys(map).sort();
  return keys
    .map((k) => {
      const v = String(map[k] ?? '');
      // Always double-quote to preserve special chars without shell expansion.
      const escaped = v.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      return `${k}="${escaped}"`;
    })
    .join('\n')
    .concat('\n');
}

/**
 * Load Diagnostics secrets: process env wins over file for reads.
 * File path from I2_DIAGNOSTICS_SECRET_ENV_FILE (required for durable writes).
 */
export function loadDiagnosticsSecrets(env = process.env, readFileSync = fs.readFileSync) {
  const filePath = env[SECRET_NAMES.secretEnvFile];
  let fileMap = Object.create(null);
  if (filePath) {
    try {
      fileMap = parseEnvFile(readFileSync(filePath, 'utf8'));
    } catch (e) {
      if (e && e.code !== 'ENOENT') {
        throw new OAuthHelperError(
          `DENY: cannot read Diagnostics secret env file (${e.code || 'error'})`,
          'SECRET_FILE_READ'
        );
      }
    }
  }

  const get = (name) => {
    if (env[name] !== undefined && env[name] !== '') return String(env[name]);
    if (fileMap[name] !== undefined && fileMap[name] !== '') return String(fileMap[name]);
    return undefined;
  };

  return {
    filePath: filePath || null,
    fileMap,
    clientId: get(SECRET_NAMES.clientId),
    clientSecret: get(SECRET_NAMES.clientSecret),
    projectRef: get(SECRET_NAMES.projectRef),
    organizationSlug: get(SECRET_NAMES.orgSlug),
  };
}

export function assertPreAuthorizeSecrets(secrets) {
  if (!secrets.clientId) {
    throw new OAuthHelperError(
      `DENY: missing ${SECRET_NAMES.clientId} in Diagnostics secret environment`,
      'MISSING_CLIENT_ID'
    );
  }
  if (!secrets.projectRef) {
    throw new OAuthHelperError(
      `DENY: missing ${SECRET_NAMES.projectRef} in Diagnostics secret environment`,
      'MISSING_PROJECT_REF'
    );
  }
  if (secrets.projectRef !== PRODUCTION_PROJECT_REF) {
    throw new OAuthHelperError(
      `DENY: ${SECRET_NAMES.projectRef} must be ${PRODUCTION_PROJECT_REF}`,
      'PROJECT_REF_MISMATCH'
    );
  }
  if (!secrets.filePath) {
    throw new OAuthHelperError(
      `DENY: missing ${SECRET_NAMES.secretEnvFile} (required for durable token storage)`,
      'MISSING_SECRET_ENV_FILE'
    );
  }
}

export function buildAuthorizeUrl({
  clientId,
  state,
  codeChallenge,
  organizationSlug,
}) {
  const u = new URL(AUTHORIZE_URL);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('client_id', clientId);
  u.searchParams.set('redirect_uri', PUBLIC_REDIRECT_URI);
  u.searchParams.set('state', state);
  u.searchParams.set('code_challenge', codeChallenge);
  u.searchParams.set('code_challenge_method', 'S256');
  if (organizationSlug && /^[a-z0-9][a-z0-9-]*$/i.test(organizationSlug)) {
    u.searchParams.set('organization_slug', organizationSlug);
  }
  return u.toString();
}

/** Assert public HTTPS redirect is pinned and distinct from local HTTP listener. */
export function assertSplitRedirectContract() {
  if (PUBLIC_REDIRECT_URI !== 'https://oauth-diagnostics.bhfos.com/oauth/callback') {
    throw new OAuthHelperError(
      'DENY: public redirect URI must be https://oauth-diagnostics.bhfos.com/oauth/callback',
      'PUBLIC_REDIRECT'
    );
  }
  if (LOCAL_LISTENER_URI !== 'http://127.0.0.1:8765/oauth/callback') {
    throw new OAuthHelperError(
      'DENY: local listener URI must be http://127.0.0.1:8765/oauth/callback',
      'LOCAL_LISTENER'
    );
  }
  if (PUBLIC_REDIRECT_URI === LOCAL_LISTENER_URI) {
    throw new OAuthHelperError(
      'DENY: public redirect and local listener must be split',
      'REDIRECT_SPLIT'
    );
  }
  if (!PUBLIC_REDIRECT_URI.startsWith('https://')) {
    throw new OAuthHelperError('DENY: public redirect must use HTTPS', 'PUBLIC_REDIRECT_SCHEME');
  }
  if (!LOCAL_LISTENER_URI.startsWith('http://')) {
    throw new OAuthHelperError('DENY: local listener must use plain HTTP loopback', 'LOCAL_LISTENER_SCHEME');
  }
  if (REDIRECT_URI !== PUBLIC_REDIRECT_URI) {
    throw new OAuthHelperError(
      'DENY: OAuth redirect_uri alias must equal public HTTPS URI',
      'REDIRECT_ALIAS'
    );
  }
  return true;
}

/**
 * Validate callback request. Returns { code } or throws.
 * Never include code in thrown messages.
 */
export function parseCallbackHostHeader(hostHeader) {
  const raw = String(hostHeader || '').trim();
  if (!raw) {
    throw new OAuthHelperError('DENY: callback host header missing', 'CALLBACK_HOST');
  }
  // IPv4 Host:port only (listener is 127.0.0.1).
  const m = raw.match(/^([^:]+):(\d+)$/) || raw.match(/^([^:]+)$/);
  if (!m) {
    throw new OAuthHelperError('DENY: callback host header invalid', 'CALLBACK_HOST');
  }
  const host = m[1];
  const port = m[2] !== undefined ? Number(m[2]) : CALLBACK_PORT;
  return { host, port };
}

export function validateCallbackRequest({
  method,
  hostHeader,
  urlPathWithQuery,
  expectedState,
}) {
  if (method !== 'GET') {
    throw new OAuthHelperError('DENY: callback method must be GET', 'CALLBACK_METHOD');
  }

  const { host, port } = parseCallbackHostHeader(hostHeader);
  if (host !== CALLBACK_HOST) {
    throw new OAuthHelperError('DENY: callback host must be 127.0.0.1', 'CALLBACK_HOST');
  }
  if (port !== CALLBACK_PORT) {
    throw new OAuthHelperError('DENY: callback port mismatch', 'CALLBACK_PORT');
  }

  let parsed;
  try {
    parsed = new URL(urlPathWithQuery, `http://${CALLBACK_HOST}:${CALLBACK_PORT}`);
  } catch {
    throw new OAuthHelperError('DENY: invalid callback URL', 'CALLBACK_URL');
  }

  if (parsed.pathname !== CALLBACK_PATH) {
    throw new OAuthHelperError('DENY: callback path mismatch', 'CALLBACK_PATH');
  }

  const state = parsed.searchParams.get('state');
  const code = parsed.searchParams.get('code');
  const err = parsed.searchParams.get('error');

  if (err) {
    throw new OAuthHelperError('DENY: authorization provider returned error', 'PROVIDER_ERROR');
  }
  if (!state || state !== expectedState) {
    throw new OAuthHelperError('DENY: OAuth state mismatch', 'STATE_MISMATCH');
  }
  if (!code || typeof code !== 'string' || code.length < 8) {
    throw new OAuthHelperError('DENY: authorization code missing', 'MISSING_CODE');
  }

  return { code };
}

/**
 * Assert token response scopes ⊆ allowed (projects:read only).
 * Omitted/empty scope is fail-closed (explicit decision — do not treat as OK).
 */
export function assertTokenScopes(scopeField) {
  if (scopeField === undefined || scopeField === null || String(scopeField).trim() === '') {
    throw new OAuthHelperError(
      'DENY: token response missing scope; expected projects:read',
      'MISSING_SCOPE'
    );
  }
  const parts = String(scopeField)
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  for (const p of parts) {
    if (!ALLOWED_SCOPES.has(p)) {
      throw new OAuthHelperError(
        `DENY: unexpected OAuth scope in token response: ${p}`,
        'UNEXPECTED_SCOPE'
      );
    }
  }
  if (!parts.includes('projects:read')) {
    throw new OAuthHelperError(
      'DENY: token response scope must include projects:read',
      'MISSING_PROJECTS_READ'
    );
  }
  return { omitted: false, scopes: parts };
}

export function computeExpiryIso(expiresIn, nowMs = Date.now()) {
  const sec = Number(expiresIn);
  if (!Number.isFinite(sec) || sec <= 0) {
    throw new OAuthHelperError('DENY: invalid expires_in in token response', 'INVALID_EXPIRES');
  }
  return new Date(nowMs + sec * 1000).toISOString();
}

/**
 * Build token POST body + headers. Never log these.
 */
export function buildTokenExchangeRequest({
  code,
  codeVerifier,
  clientId,
  clientSecret,
}) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: PUBLIC_REDIRECT_URI,
    code_verifier: codeVerifier,
  });

  const headers = {
    'Content-Type': 'application/x-www-form-urlencoded',
    Accept: 'application/json',
  };

  if (clientSecret) {
    headers.Authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`;
  } else {
    // Public client: include client_id in body (no secret).
    body.set('client_id', clientId);
  }

  return { url: TOKEN_URL, method: 'POST', headers, body: body.toString() };
}

/**
 * Redact any secret-shaped strings from text for safe logging/tests.
 */
export function redactSecrets(text, extraSecrets = []) {
  let s = String(text);
  for (const secret of extraSecrets) {
    if (secret && String(secret).length >= 4) {
      s = s.split(String(secret)).join('[REDACTED]');
    }
  }
  s = s
    .replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]')
    .replace(/Basic\s+\S+/gi, 'Basic [REDACTED]')
    .replace(/code=[^&\s]+/gi, 'code=[REDACTED]')
    .replace(/code_verifier=[^&\s]+/gi, 'code_verifier=[REDACTED]')
    .replace(/refresh_token":\s*"[^"]+"/gi, 'refresh_token":"[REDACTED]"')
    .replace(/access_token":\s*"[^"]+"/gi, 'access_token":"[REDACTED]"');
  return s;
}

/**
 * Upsert token fields into Diagnostics secret env file. Fail closed on write error.
 */
export function writeTokenSecretsToEnvFile({
  filePath,
  existingMap,
  accessToken,
  refreshToken,
  tokenExpiry,
  writeFileSync = fs.writeFileSync,
  renameSync = fs.renameSync,
  mkdirSync = fs.mkdirSync,
}) {
  if (!filePath) {
    throw new OAuthHelperError('DENY: secret env file path missing', 'MISSING_SECRET_ENV_FILE');
  }
  if (!accessToken || !refreshToken || !tokenExpiry) {
    throw new OAuthHelperError('DENY: incomplete token material for storage', 'INCOMPLETE_TOKENS');
  }

  const next = { ...existingMap };
  next[SECRET_NAMES.accessToken] = accessToken;
  next[SECRET_NAMES.refreshToken] = refreshToken;
  next[SECRET_NAMES.tokenExpiry] = tokenExpiry;
  // Preserve project ref lock in file
  next[SECRET_NAMES.projectRef] = PRODUCTION_PROJECT_REF;

  const dir = path.dirname(filePath);
  mkdirSync(dir, { recursive: true });
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  const payload = serializeEnvFile(next);
  try {
    writeFileSync(tmp, payload, { encoding: 'utf8', mode: 0o600 });
    renameSync(tmp, filePath);
  } catch (e) {
    try {
      fs.unlinkSync(tmp);
    } catch {
      /* ignore */
    }
    throw new OAuthHelperError(
      `DENY: token storage failed (${e && e.code ? e.code : 'write_error'})`,
      'SECRET_STORE_WRITE'
    );
  }

  return {
    accessTokenPresent: true,
    refreshTokenPresent: true,
    expiryPresent: true,
    projectRefConfigured: next[SECRET_NAMES.projectRef] === PRODUCTION_PROJECT_REF,
  };
}

/** Clear transient auth material from a mutable bag. */
export function wipeTransient(bag) {
  if (!bag || typeof bag !== 'object') return;
  for (const k of Object.keys(bag)) {
    bag[k] = null;
    delete bag[k];
  }
}

export function formatStatusResult({
  completed,
  accessPresent,
  refreshPresent,
  expiryPresent,
  projectRefConfigured,
}) {
  return [
    `OAuth authorization: ${completed ? 'completed' : 'failed'}`,
    `access token secret: ${accessPresent ? 'present' : 'absent'}`,
    `refresh token secret: ${refreshPresent ? 'present' : 'absent'}`,
    `expiration metadata: ${expiryPresent ? 'present' : 'absent'}`,
    `project ref restriction: ${projectRefConfigured ? 'configured' : 'missing'}`,
    'token values: not displayed',
  ].join('\n');
}

export function normalizeWindowsPath(p) {
  return path.normalize(String(p || '')).toLowerCase();
}

export function isApprovedWindowsBrowserPath(candidate) {
  const n = normalizeWindowsPath(candidate);
  return APPROVED_WINDOWS_BROWSER_PATHS.some((allowed) => normalizeWindowsPath(allowed) === n);
}

/**
 * Resolve an approved Edge/Chrome absolute path. Never searches PATH.
 * Never uses ProgramFiles/LOCALAPPDATA env (environment-steerable).
 */
export function resolveWindowsBrowserExecutable(existsSyncFn = fs.existsSync) {
  for (const candidate of APPROVED_WINDOWS_BROWSER_PATHS) {
    if (existsSyncFn(candidate) && isApprovedWindowsBrowserPath(candidate)) {
      return candidate;
    }
  }
  return null;
}

export function assertNotForbiddenBrowserCommand(command, { pathApi = path } = {}) {
  const raw = String(command || '');
  const base = pathApi.basename(raw).toLowerCase();
  const forbidden = new Set([
    'explorer.exe',
    'cmd.exe',
    'powershell.exe',
    'pwsh.exe',
    'wscript.exe',
    'cscript.exe',
    'mshta.exe',
  ]);
  if (forbidden.has(base)) {
    throw new OAuthHelperError(
      'DENY: forbidden browser/launcher executable',
      'BROWSER_FORBIDDEN'
    );
  }
  // Use win32 absolute rules when validating Windows browser paths (CI may run on Linux).
  if (!pathApi.isAbsolute(raw)) {
    throw new OAuthHelperError(
      'DENY: browser executable must be an absolute path (PATH resolution forbidden)',
      'BROWSER_NOT_ABSOLUTE'
    );
  }
}

/**
 * Build OS browser-launch argv. Never log the URL (contains state / PKCE challenge).
 *
 * Windows: spawn approved Edge/Chrome absolute path with the authorize URL as
 * one argv element (ampersands preserved). No cmd.exe, no explorer.exe, no PATH.
 */
export function buildBrowserLaunchSpec(
  url,
  platform = process.platform,
  { existsSyncFn = fs.existsSync } = {}
) {
  if (!url || typeof url !== 'string') {
    throw new OAuthHelperError('DENY: browser launch requires URL', 'BROWSER_URL');
  }
  if (!/^https:\/\/api\.supabase\.com\/v1\/oauth\/authorize\?/i.test(url)) {
    throw new OAuthHelperError(
      'DENY: browser launch URL must be Supabase authorize endpoint',
      'BROWSER_URL_HOST'
    );
  }

  if (platform === 'win32') {
    const browser = resolveWindowsBrowserExecutable(existsSyncFn);
    if (!browser) {
      throw new OAuthHelperError(
        'DENY: no approved Edge/Chrome absolute path found',
        'BROWSER_NOT_FOUND'
      );
    }
    assertNotForbiddenBrowserCommand(browser, { pathApi: path.win32 });
    if (!isApprovedWindowsBrowserPath(browser)) {
      throw new OAuthHelperError('DENY: browser path not on allowlist', 'BROWSER_NOT_APPROVED');
    }
    return {
      platform: 'win32',
      command: browser,
      args: [url],
      options: { detached: true, stdio: 'ignore', windowsHide: true, shell: false },
    };
  }

  if (platform === 'darwin') {
    const openPath = '/usr/bin/open';
    if (!existsSyncFn(openPath)) {
      throw new OAuthHelperError('DENY: /usr/bin/open not found', 'BROWSER_NOT_FOUND');
    }
    return {
      platform: 'darwin',
      command: openPath,
      args: [url],
      options: { detached: true, stdio: 'ignore', shell: false },
    };
  }

  const xdg = '/usr/bin/xdg-open';
  if (!existsSyncFn(xdg)) {
    throw new OAuthHelperError('DENY: /usr/bin/xdg-open not found', 'BROWSER_NOT_FOUND');
  }
  return {
    platform: 'linux',
    command: xdg,
    args: [url],
    options: { detached: true, stdio: 'ignore', shell: false },
  };
}

/** Recover the target URL from a launch spec (tests only — do not print). */
export function extractUrlFromBrowserLaunchSpec(spec) {
  if (!spec || !spec.command) {
    throw new OAuthHelperError('DENY: invalid browser launch spec', 'BROWSER_SPEC');
  }
  const pathApi = spec.platform === 'win32' ? path.win32 : path;
  assertNotForbiddenBrowserCommand(spec.command, { pathApi });
  if (spec.args && spec.args.length === 1 && /^https:\/\/api\.supabase\.com\//i.test(spec.args[0])) {
    return spec.args[0];
  }
  throw new OAuthHelperError('DENY: launch spec missing authorize URL argv', 'BROWSER_SPEC');
}

/** Bind args for the callback listener (tests assert loopback-only). */
export function callbackListenArgs() {
  return [CALLBACK_BIND.port, CALLBACK_BIND.host];
}

/**
 * Presence checks only — never return parameter values to callers that might log them.
 */
export function authorizeUrlParamPresence(url) {
  const u = new URL(url);
  return {
    responseTypeCode: u.searchParams.get('response_type') === 'code',
    clientIdPresent: Boolean(u.searchParams.get('client_id')),
    redirectUriPresent: Boolean(u.searchParams.get('redirect_uri')),
    statePresent: Boolean(u.searchParams.get('state')),
    codeChallengePresent: Boolean(u.searchParams.get('code_challenge')),
    codeChallengeMethodS256: u.searchParams.get('code_challenge_method') === 'S256',
    ampersandCount: (url.match(/&/g) || []).length,
  };
}

/**
 * Demonstrate the defective cmd.exe pattern truncates at the first `&`.
 * Used only in tests — never used for live launch.
 */
export function defectiveCmdStartTruncatesAtAmpersand(url) {
  // Models: cmd.exe parsing of `start "" <unquoted-url>` where `&` starts a new command.
  const first = url.split('&')[0];
  return {
    truncated: first !== url,
    firstSegmentEqualsFullUrl: first === url,
    firstSegmentHasOnlyResponseType:
      first.includes('response_type=') && !first.includes('client_id='),
  };
}
