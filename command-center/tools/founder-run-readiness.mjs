#!/usr/bin/env node
/**
 * FOUNDER_RUN_READINESS gate — machine-verifiable checks for Founder execution.
 * Never prints secret values. Ends with FOUNDER_RUN_READY or FOUNDER_RUN_BLOCKED.
 */

import childProcess from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_REPO_ROOT = path.resolve(__dirname, '..');

/** Known readiness stages. Unknown or omitted stages fail closed. */
export const READINESS_STAGE_PRE_PROVISIONING = 'pre_provisioning';
export const READINESS_STAGE_OAUTH_EXECUTION = 'oauth_execution';
export const KNOWN_READINESS_STAGES = Object.freeze([
  READINESS_STAGE_PRE_PROVISIONING,
  READINESS_STAGE_OAUTH_EXECUTION,
]);

export const VERDICT_FOUNDER_RUN_READY = 'FOUNDER_RUN_READY';
export const VERDICT_PROVISIONING_ACTION_AUTHORIZED = 'FOUNDER_PROVISIONING_ACTION_AUTHORIZED';
export const VERDICT_FOUNDER_RUN_BLOCKED = 'FOUNDER_RUN_BLOCKED';

/** Authoritative NOS-I2-S1-EVIDENCE-01 campaign root (names/paths only). */
export const DESIGNATED_CAMPAIGN_ROOT = 'F:\\BHFOS-Diagnostics\\NOS-I2-S1-EVIDENCE-01';
export const EXPECTED_OAUTH_APP_NAME = 'BHFOS I2 Diagnostics';
export const EXPECTED_OAUTH_SCOPES = Object.freeze(['projects:read', 'database:read']);
export const EXPECTED_PROJECT_REF = 'wwyxohjnyqnegzbxtuxs';
export const EXPECTED_PUBLIC_CALLBACK = 'https://oauth-diagnostics.bhfos.com/oauth/callback';
export const EXPECTED_TUNNEL_CLASS = 'cloudflare_named';
export const EXPECTED_TUNNEL_HOSTNAME = 'oauth-diagnostics.bhfos.com';

const PRE_PROVISIONING_ACTION_DENY =
  /\bconsent\b|authorization\s+url|authorize\s+url|oauth-authorize|authorize\.mjs|tunnel\s+start|start(?:ing)?\s+the\s+tunnel|cloudflared\s+tunnel\s+run|hosted\s+(?:metadata|call|supabase)|collect(?:ion)?\s+hosted|supabase\s+(?:get|post|select)/i;

/** Basename patterns that are always treated as in-repo credential stores (fail-closed). */
const ALWAYS_DENY_BASENAME = [
  /^\.env$/i,
  /^\.env\./i, // .env.local, .env.diagnostics, etc.
  /^credentials\.json$/i,
  /(?:^|[._-])credentials\.json$/i,
  /\.p12$/i,
  /\.pfx$/i,
  /^id_rsa$/i,
  /^id_ed25519$/i,
  /^id_ecdsa$/i,
  /(?:^|[._-])token-cache(?:\.[^.]+)?$/i,
  /(?:^|[._-])oauth-tokens?(?:\.[^.]+)?$/i,
  /^secrets\.env$/i,
  /^\.secrets$/i,
  /^secrets\.json$/i,
];

const EXAMPLE_OR_TEMPLATE = /\.(?:example|template|sample)(?:\.|$)/i;

/** Secret-named env keys that indicate a populated credential assignment. */
const SECRET_ASSIGNMENT_KEY =
  /(?:SECRET|TOKEN|PASSWORD|PRIVATE_KEY|API_KEY|ACCESS_KEY|CLIENT_SECRET|REFRESH_TOKEN|BEARER|CREDENTIAL)/i;

const PLACEHOLDER_VALUE =
  /^(?:changeme|placeholder|your[_-]?[\w-]*|x{3,}|<.*>|\$\{.*\}|TODO|replace(?:me)?|example|dummy|test[_-]?only|not[_-]?a[_-]?secret|redacted)$/i;

const PRIVATE_KEY_MARKER = /-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/;

export function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isExampleOrTemplateName(name) {
  return EXAMPLE_OR_TEMPLATE.test(name) || /^env\.example$/i.test(name) || name === '.env.example';
}

export function isAlwaysDenyCredentialBasename(name) {
  if (isExampleOrTemplateName(name)) return false;
  return ALWAYS_DENY_BASENAME.some((re) => re.test(name));
}

export function stripEnvValueQuotes(raw) {
  let val = String(raw ?? '').trim();
  if (
    (val.startsWith('"') && val.endsWith('"')) ||
    (val.startsWith("'") && val.endsWith("'"))
  ) {
    val = val.slice(1, -1);
  }
  return val.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
}

export function isPlaceholderSecretValue(value) {
  const v = String(value ?? '').trim();
  if (!v) return true;
  return PLACEHOLDER_VALUE.test(v);
}

/**
 * True when text contains a populated secret-named assignment (value not displayed).
 * Names-only inventories and placeholder fixtures return false.
 */
export function hasPopulatedSecretAssignment(text) {
  if (typeof text !== 'string' || !text) return false;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    if (!SECRET_ASSIGNMENT_KEY.test(key)) continue;
    const val = stripEnvValueQuotes(line.slice(eq + 1));
    if (isPlaceholderSecretValue(val)) continue;
    return true;
  }
  return false;
}

export function hasPrivateKeyMaterial(text) {
  return typeof text === 'string' && PRIVATE_KEY_MARKER.test(text);
}

function shouldContentInspect(basename) {
  if (isAlwaysDenyCredentialBasename(basename)) return false; // already denied by name
  if (isExampleOrTemplateName(basename)) return false;
  if (/\.(?:pem|key)$/i.test(basename)) return true;
  if (/\.env$/i.test(basename)) return true; // e.g. diagnostics.env inside repo
  if (/^(?:\.env|secrets\.env|\.secrets|secrets\.json|credentials\.json)$/i.test(basename)) return true;
  if (/(?:^|[._-])(?:token-cache|oauth-tokens?)(?:\.[^.]+)?$/i.test(basename)) return true;
  if (/credentials\.json$/i.test(basename)) return true;
  return false;
}

function safeReadHead(filePath, readFileSync, maxBytes = 64 * 1024) {
  try {
    const buf = readFileSync(filePath);
    const slice = Buffer.isBuffer(buf) ? buf.subarray(0, maxBytes) : Buffer.from(String(buf)).subarray(0, maxBytes);
    return slice.toString('utf8');
  } catch {
    return null;
  }
}

export function isSha(value) {
  return typeof value === 'string' && /^[0-9a-f]{40}$/i.test(value.trim());
}

export function git(repoRoot, args) {
  return childProcess
    .execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    .trim();
}

export function portAvailable(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.once('error', () => resolve(false));
    server.listen(port, host, () => {
      server.close(() => resolve(true));
    });
  });
}

export function secretNamesPresent(envFilePath, names) {
  if (!fs.existsSync(envFilePath)) {
    return { ok: false, missing: names.slice(), present: [] };
  }
  const text = fs.readFileSync(envFilePath, 'utf8');
  const present = [];
  const missing = [];
  for (const name of names) {
    const re = new RegExp(`^\\s*${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*=\\s*\\S`, 'm');
    if (re.test(text)) present.push(name);
    else missing.push(name);
  }
  return { ok: missing.length === 0, missing, present };
}

/**
 * Find live credential / secret-store files inside the repository.
 *
 * Distinguishes documentation, source identifiers, UI names, and names-only
 * inventories from .env stores, private keys, token caches, and populated
 * secret assignments. Never returns file contents or secret values.
 */
export function credentialFilesInsideRepo(repoRoot, options = {}) {
  const readFileSync = options.readFileSync || fs.readFileSync;
  const readdirSync = options.readdirSync || fs.readdirSync;
  const hits = [];
  const walk = (dir, depth = 0) => {
    if (depth > 6) return;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      if (
        ent.name === 'node_modules' ||
        ent.name === '.git' ||
        ent.name === 'dist' ||
        ent.name === 'coverage' ||
        ent.name === '.turbo'
      ) {
        continue;
      }
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        walk(full, depth + 1);
        continue;
      }

      const rel = path.relative(repoRoot, full).replaceAll('\\', '/');

      // Never treat ordinary docs / source as credential stores by keyword alone.
      if (isAlwaysDenyCredentialBasename(ent.name)) {
        hits.push(rel);
        continue;
      }

      if (!shouldContentInspect(ent.name)) continue;

      const text = safeReadHead(full, readFileSync);
      if (text == null) continue;

      if (/\.(?:pem|key)$/i.test(ent.name)) {
        if (hasPrivateKeyMaterial(text)) hits.push(rel);
        continue;
      }

      if (hasPrivateKeyMaterial(text) || hasPopulatedSecretAssignment(text)) {
        hits.push(rel);
      }
    }
  };
  walk(repoRoot);
  return hits;
}

export function pathIsOutsideRepo(candidate, repoRoot) {
  const abs = path.resolve(candidate);
  const root = path.resolve(repoRoot);
  const rel = path.relative(root, abs);
  return rel.startsWith('..') || path.isAbsolute(rel);
}

export function normalizeCampaignPath(value) {
  return String(value ?? '')
    .trim()
    .replace(/\//g, '\\')
    .replace(/[\\/]+$/, '');
}

export function isHistoricalLocalAppDataCampaignStore(value) {
  const n = normalizeCampaignPath(value).toLowerCase();
  if (!n) return false;
  if (n.includes('%localappdata%') || n.includes('localappdata')) return true;
  return /(?:^|[\\/])appdata[\\/]local[\\/]bhfos[\\/]production-diagnostics(?:$|[\\/])/i.test(n);
}

export function isDesignatedCampaignRoot(value) {
  return normalizeCampaignPath(value).toLowerCase() === DESIGNATED_CAMPAIGN_ROOT.toLowerCase();
}

export function isUnderDesignatedCampaignRoot(value) {
  const n = normalizeCampaignPath(value).toLowerCase();
  const root = DESIGNATED_CAMPAIGN_ROOT.toLowerCase();
  return n === root || n.startsWith(`${root}\\`);
}

export function oauthScopesExact(scopes) {
  if (!Array.isArray(scopes) || scopes.length !== EXPECTED_OAUTH_SCOPES.length) return false;
  const unique = new Set(scopes.map((s) => String(s)));
  return EXPECTED_OAUTH_SCOPES.every((s) => unique.has(s)) && unique.size === EXPECTED_OAUTH_SCOPES.length;
}

export function preProvisioningActionProhibited(action) {
  return PRE_PROVISIONING_ACTION_DENY.test(String(action ?? ''));
}

function designatedExternalPathEntries(paths) {
  if (!paths || typeof paths !== 'object' || Array.isArray(paths)) return [];
  return Object.entries(paths).filter(([, value]) => value != null && String(value).trim() !== '');
}

/**
 * Evaluate a readiness packet. Returns { verdict, checks[], technical_result, governance_status, authorized_next_state }.
 */
export async function evaluateReadiness(packet, options = {}) {
  const repoRoot = options.repoRoot || DEFAULT_REPO_ROOT;
  const checks = [];
  const add = (id, ok, detail) => {
    checks.push({ id, ok: Boolean(ok), detail: detail ? String(detail).slice(0, 240) : undefined });
  };

  const stage = packet.readiness_stage;
  const isPre = stage === READINESS_STAGE_PRE_PROVISIONING;
  const isOauth = stage === READINESS_STAGE_OAUTH_EXECUTION;
  add(
    'readiness_stage_known',
    isPre || isOauth,
    stage == null || stage === '' ? 'omitted' : `stage=${stage}`
  );

  // 1
  add('task_and_authorization_boundary', nonEmpty(packet.task_and_authorization_boundary), 'must be non-empty');

  // 2
  let remote = '';
  try {
    remote = git(repoRoot, ['remote', 'get-url', 'origin']);
  } catch (e) {
    remote = '';
  }
  const expectedRepo = packet.exact_repository;
  add(
    'exact_repository',
    nonEmpty(expectedRepo) && (remote === expectedRepo || remote.replace(/\.git$/, '') === String(expectedRepo).replace(/\.git$/, '')),
    `origin=${remote || 'unavailable'} expected=${expectedRepo || 'missing'}`
  );

  // 3
  const worktree = packet.exact_worktree_path;
  const worktreeOk =
    nonEmpty(worktree) &&
    fs.existsSync(worktree) &&
    path.resolve(worktree) === path.resolve(repoRoot);
  add('exact_worktree_path', worktreeOk, worktree || 'missing');

  // 4
  let head = '';
  try {
    head = git(repoRoot, ['rev-parse', 'HEAD']);
  } catch {
    head = '';
  }
  add(
    'exact_commit_sha',
    isSha(packet.exact_commit_sha) && head.toLowerCase() === String(packet.exact_commit_sha).toLowerCase(),
    `head=${head || 'unavailable'} packet=${packet.exact_commit_sha || 'missing'}`
  );

  // 5
  let porcelain = 'dirty-unknown';
  try {
    porcelain = git(repoRoot, ['status', '--porcelain']);
  } catch {
    porcelain = 'dirty-unknown';
  }
  if (packet.fixture_ignore_worktree_dirtiness === true && options.allowFixtureSkip) {
    add('worktree_cleanliness', true, 'fixture ignore dirtiness');
  } else {
    add('worktree_cleanliness', porcelain === '', porcelain === '' ? 'clean' : 'dirty');
  }

  // 6
  const launcher = packet.protected_launcher_or_script_path;
  const launcherAbs = launcher ? path.resolve(repoRoot, launcher) : '';
  add('protected_launcher_or_script_path', Boolean(launcher) && fs.existsSync(launcherAbs), launcher || 'missing');

  // 7
  if (packet.launcher_sha_pin === undefined || packet.launcher_sha_pin === null || packet.launcher_sha_pin === '') {
    add('launcher_sha_pin_matches', true, 'no pin provided; skipped');
  } else {
    add(
      'launcher_sha_pin_matches',
      isSha(packet.launcher_sha_pin) &&
        isSha(packet.exact_commit_sha) &&
        String(packet.launcher_sha_pin).toLowerCase() === String(packet.exact_commit_sha).toLowerCase(),
      'pin must equal exact_commit_sha'
    );
  }

  // 8
  const requiredFiles = Array.isArray(packet.required_files) ? packet.required_files : [];
  const missingFiles = requiredFiles.filter((f) => !fs.existsSync(path.resolve(repoRoot, f)));
  add('required_files_exist', requiredFiles.length > 0 && missingFiles.length === 0, missingFiles.join(',') || 'ok');

  // 9–10
  const secretStore = packet.external_secret_store_path;
  const secretNames = Array.isArray(packet.required_secret_names) ? packet.required_secret_names : [];
  if (isPre) {
    add('external_secret_store_path', true, 'not required before provisioning');
    add('required_secret_names_present', true, 'not required before provisioning');
  } else if (isOauth) {
    const storeExists = nonEmpty(secretStore) && fs.existsSync(secretStore);
    const outside = storeExists && pathIsOutsideRepo(secretStore, repoRoot);
    add(
      'external_secret_store_path',
      storeExists && outside && !isHistoricalLocalAppDataCampaignStore(secretStore),
      storeExists ? (outside ? 'outside repo' : 'inside repo') : 'missing'
    );
    const names = secretNamesPresent(secretStore || '', secretNames);
    add(
      'required_secret_names_present',
      secretNames.length > 0 && names.ok,
      secretNames.length === 0
        ? 'secret names required at oauth_execution'
        : names.missing.length
          ? `missing_names=${names.missing.join(',')}`
          : `present_count=${names.present.length}`
    );
  } else if (!secretStore && secretNames.length === 0) {
    add('external_secret_store_path', true, 'not required for this packet');
    add('required_secret_names_present', true, 'not required for this packet');
  } else {
    const storeExists = nonEmpty(secretStore) && fs.existsSync(secretStore);
    const outside = storeExists && pathIsOutsideRepo(secretStore, repoRoot);
    add('external_secret_store_path', storeExists && outside, storeExists ? (outside ? 'outside repo' : 'inside repo') : 'missing');
    const names = secretNamesPresent(secretStore || '', secretNames);
    add(
      'required_secret_names_present',
      names.ok,
      names.missing.length ? `missing_names=${names.missing.join(',')}` : `present_count=${names.present.length}`
    );
  }

  // 11
  const credHits = credentialFilesInsideRepo(repoRoot);
  // For live packets, also honor an explicit attestation override used in fixtures.
  if (packet.allow_credential_scan_skip === true && options.allowFixtureSkip) {
    add('no_credential_file_in_repo', true, 'fixture skip');
  } else {
    add('no_credential_file_in_repo', credHits.length === 0, credHits.slice(0, 5).join(',') || 'none');
  }

  // 12
  const expectedRedirect = packet.callback_or_redirect_expected;
  const actualRedirect = packet.callback_or_redirect_actual;
  if (isPre || isOauth) {
    add(
      'expected_public_callback_contract',
      expectedRedirect === EXPECTED_PUBLIC_CALLBACK,
      expectedRedirect || 'missing expected callback'
    );
  }
  if (isPre) {
    add('callback_or_redirect_match', true, 'actual callback not required before provisioning');
  } else if (isOauth) {
    add(
      'callback_or_redirect_match',
      nonEmpty(expectedRedirect) && expectedRedirect === actualRedirect && expectedRedirect === EXPECTED_PUBLIC_CALLBACK,
      'expected must equal actual and helper contract'
    );
  } else if (!expectedRedirect && !actualRedirect) {
    add('callback_or_redirect_match', true, 'not required for this packet');
  } else {
    add(
      'callback_or_redirect_match',
      nonEmpty(expectedRedirect) && expectedRedirect === actualRedirect,
      'expected must equal actual'
    );
  }

  // 13
  if (packet.required_local_port === undefined || packet.required_local_port === null || packet.required_local_port === '') {
    add('required_local_port_available', true, 'not required for this packet');
  } else {
    const available = await portAvailable(Number(packet.required_local_port));
    add('required_local_port_available', available, `port=${packet.required_local_port}`);
  }

  // 14
  const deps = Array.isArray(packet.required_dependencies) ? packet.required_dependencies : [];
  if (deps.length === 0) {
    add('required_dependencies_detected', true, 'not required for this packet');
  } else {
    const missingDeps = deps.filter((d) => {
      if (d.kind === 'file') return !fs.existsSync(d.path);
      return true;
    });
    add('required_dependencies_detected', missingDeps.length === 0, missingDeps.length ? 'missing dependency' : 'ok');
  }

  // 15–16
  add('platform_acceptance_tests_passed', packet.platform_acceptance_tests_passed === true, 'must be true');
  add('unit_integration_tests_passed', packet.unit_integration_tests_passed === true, 'must be true');

  // 17
  const ag = packet.architecture_guard_approval || {};
  add(
    'architecture_guard_execution_design',
    ag.applies_to_execution_design === true &&
      isSha(ag.head_sha) &&
      isSha(packet.exact_commit_sha) &&
      String(ag.head_sha).toLowerCase() === String(packet.exact_commit_sha).toLowerCase() &&
      nonEmpty(ag.verdict),
    'AG must apply to exact execution design SHA'
  );

  // 18–20
  add('expected_safe_output', nonEmpty(packet.expected_safe_output), 'must be non-empty');
  const stops = Array.isArray(packet.explicit_stop_conditions) ? packet.explicit_stop_conditions : [];
  add('explicit_stop_conditions', stops.length > 0 && stops.every((s) => nonEmpty(s)), 'need at least one');
  add('one_exact_founder_command_or_action', nonEmpty(packet.one_exact_founder_command_or_action), 'exactly one action string');

  if (isPre || isOauth) {
    add(
      'oauth_app_name_exact',
      packet.oauth_app_name === EXPECTED_OAUTH_APP_NAME,
      packet.oauth_app_name || 'missing'
    );
    add(
      'oauth_scopes_exact',
      oauthScopesExact(packet.oauth_scopes),
      Array.isArray(packet.oauth_scopes) ? packet.oauth_scopes.join(',') : 'missing'
    );
    add(
      'project_ref_locked',
      packet.project_ref === EXPECTED_PROJECT_REF,
      packet.project_ref || 'missing'
    );
    add(
      'designated_campaign_root',
      isDesignatedCampaignRoot(packet.designated_campaign_root) &&
        !isHistoricalLocalAppDataCampaignStore(packet.designated_campaign_root),
      packet.designated_campaign_root || 'missing'
    );
    const extPaths = designatedExternalPathEntries(packet.designated_external_paths);
    const extOk =
      extPaths.length > 0 &&
      extPaths.every(
        ([, value]) => isUnderDesignatedCampaignRoot(value) && !isHistoricalLocalAppDataCampaignStore(value)
      );
    add(
      'designated_external_paths_under_campaign',
      extOk,
      extPaths.length ? 'paths declared' : 'missing designated external paths'
    );
    const acls = Array.isArray(packet.designated_acls) ? packet.designated_acls : [];
    add(
      'designated_acls_present',
      acls.length > 0 && acls.every((a) => nonEmpty(a)),
      acls.length ? `acl_count=${acls.length}` : 'missing ACLs'
    );
    add(
      'localappdata_not_campaign_store',
      !isHistoricalLocalAppDataCampaignStore(packet.designated_campaign_root) &&
        !isHistoricalLocalAppDataCampaignStore(secretStore) &&
        extPaths.every(([, value]) => !isHistoricalLocalAppDataCampaignStore(value)),
      'LOCALAPPDATA is historical/generic only'
    );
  }

  if (isPre) {
    const prohibited = Array.isArray(packet.prohibited_actions) ? packet.prohibited_actions : [];
    add(
      'prohibited_actions_present',
      prohibited.length > 0 && prohibited.every((s) => nonEmpty(s)),
      'need at least one prohibited action'
    );
    add(
      'pre_provisioning_action_not_execution',
      nonEmpty(packet.one_exact_founder_command_or_action) &&
        !preProvisioningActionProhibited(packet.one_exact_founder_command_or_action),
      'pre-provisioning cannot authorize consent, tunnel start, or hosted calls'
    );
    add('oauth_app_verified', true, 'live app verification not required before provisioning');
  } else if (isOauth) {
    add(
      'oauth_app_verified',
      packet.oauth_app_verified === true && packet.oauth_app_name === EXPECTED_OAUTH_APP_NAME,
      'verified app required at oauth_execution'
    );
  }

  // 21–32 OAuth Named Tunnel (when tunnel.required, or class/hostname at pre-provisioning)
  const tunnel = packet.tunnel && typeof packet.tunnel === 'object' ? packet.tunnel : null;
  if (isPre) {
    add(
      'tunnel_required_named_class',
      Boolean(tunnel) && tunnel.class === EXPECTED_TUNNEL_CLASS,
      `class=${tunnel?.class || 'missing'}`
    );
    add(
      'tunnel_stable_hostname_pinned',
      Boolean(tunnel) && tunnel.stable_hostname === EXPECTED_TUNNEL_HOSTNAME,
      tunnel?.stable_hostname || 'missing'
    );
    add('tunnel_public_redirect_uri_match', true, 'not required before provisioning');
    add('tunnel_credentials_outside_repo', true, 'not required before provisioning');
    add('tunnel_path_only_attested', true, 'not required before provisioning');
    add('tunnel_catch_all_deny_attested', true, 'not required before provisioning');
    add('tunnel_stop_and_closure_procedure', true, 'not required before provisioning');
    add('tunnel_executable_present', true, 'not required before provisioning');
    add('tunnel_config_present', true, 'not required before provisioning');
    add('tunnel_start_command_present', true, 'not required before provisioning');
    add('tunnel_stop_command_present', true, 'not required before provisioning');
    add('tunnel_closure_verification_command_present', true, 'not required before provisioning');
    add('tunnel_local_listener_loopback_only', true, 'not required before provisioning');
    add(
      'tunnel_no_random_or_quick_hostname',
      Boolean(tunnel) &&
        tunnel.stable_hostname === EXPECTED_TUNNEL_HOSTNAME &&
        !/trycloudflare\.com|cfargotunnel\.com/i.test(String(tunnel.stable_hostname || '')),
      'no random or quick-tunnel hostname'
    );
  } else if (!tunnel || tunnel.required !== true) {
    const skipDetail = isOauth ? 'tunnel required at oauth_execution' : 'tunnel not required for this packet';
    const skipOk = !isOauth;
    add('tunnel_required_named_class', skipOk, skipDetail);
    add('tunnel_stable_hostname_pinned', skipOk, skipDetail);
    add('tunnel_public_redirect_uri_match', skipOk, skipDetail);
    add('tunnel_credentials_outside_repo', skipOk, skipDetail);
    add('tunnel_path_only_attested', skipOk, skipDetail);
    add('tunnel_catch_all_deny_attested', skipOk, skipDetail);
    add('tunnel_stop_and_closure_procedure', skipOk, skipDetail);
    add('tunnel_executable_present', skipOk, skipDetail);
    add('tunnel_config_present', skipOk, skipDetail);
    add('tunnel_start_command_present', skipOk, skipDetail);
    add('tunnel_stop_command_present', skipOk, skipDetail);
    add('tunnel_closure_verification_command_present', skipOk, skipDetail);
    add('tunnel_local_listener_loopback_only', skipOk, skipDetail);
    add('tunnel_no_random_or_quick_hostname', skipOk, skipDetail);
  } else {
    const expectedHost = 'oauth-diagnostics.bhfos.com';
    const expectedPublic = 'https://oauth-diagnostics.bhfos.com/oauth/callback';
    const expectedLocal = 'http://127.0.0.1:8765/oauth/callback';
    add(
      'tunnel_required_named_class',
      tunnel.class === 'cloudflare_named',
      `class=${tunnel.class || 'missing'}`
    );
    add(
      'tunnel_stable_hostname_pinned',
      tunnel.stable_hostname === expectedHost,
      tunnel.stable_hostname || 'missing'
    );
    add(
      'tunnel_public_redirect_uri_match',
      tunnel.public_redirect_uri === expectedPublic &&
        tunnel.local_listener_uri === expectedLocal &&
        packet.callback_or_redirect_expected === expectedPublic &&
        packet.callback_or_redirect_actual === expectedPublic &&
        String(tunnel.public_redirect_uri || '').startsWith('https://') &&
        !String(tunnel.public_redirect_uri || '').startsWith('http://127.'),
      'public HTTPS redirect + local HTTP listener split must match contract'
    );
    const credPath = tunnel.credentials_path;
    const credExists = nonEmpty(credPath) && fs.existsSync(credPath);
    const credOutside = credExists && pathIsOutsideRepo(credPath, repoRoot);
    add(
      'tunnel_credentials_outside_repo',
      credExists && credOutside && !isHistoricalLocalAppDataCampaignStore(credPath),
      credExists ? (credOutside ? 'outside repo' : 'inside repo') : 'missing'
    );
    add(
      'tunnel_path_only_attested',
      tunnel.path_only_config_attested === true,
      'path-only forward contract must be attested'
    );
    add(
      'tunnel_catch_all_deny_attested',
      tunnel.catch_all_deny_attested === true || tunnel.path_only_config_attested === true,
      'catch-all deny must be attested (path_only implies catch-all in Option B)'
    );
    add(
      'tunnel_stop_and_closure_procedure',
      tunnel.stop_after_run_and_closure_procedure_present === true,
      'stop-after-run + public callback closure procedure required'
    );
    const exePath = tunnel.executable_path;
    add(
      'tunnel_executable_present',
      nonEmpty(exePath) && fs.existsSync(exePath) && path.isAbsolute(exePath),
      exePath ? (fs.existsSync(exePath) ? 'present' : 'missing') : 'missing path'
    );
    const cfgPath = tunnel.config_path;
    add(
      'tunnel_config_present',
      nonEmpty(cfgPath) &&
        fs.existsSync(cfgPath) &&
        pathIsOutsideRepo(cfgPath, repoRoot) &&
        !isHistoricalLocalAppDataCampaignStore(cfgPath),
      cfgPath ? 'config outside repo' : 'missing config path'
    );
    add(
      'tunnel_start_command_present',
      nonEmpty(tunnel.start_command),
      'tunnel start command required'
    );
    add(
      'tunnel_stop_command_present',
      nonEmpty(tunnel.stop_command),
      'tunnel stop command required'
    );
    add(
      'tunnel_closure_verification_command_present',
      nonEmpty(tunnel.closure_verification_command),
      'public callback closure verification command required'
    );
    add(
      'tunnel_local_listener_loopback_only',
      tunnel.local_listener_uri === expectedLocal &&
        String(tunnel.local_listener_uri || '').startsWith('http://127.0.0.1:') &&
        !/0\.0\.0\.0|localhost/i.test(String(tunnel.local_listener_uri || '')),
      'local listener must remain 127.0.0.1 loopback-only'
    );
    const host = String(tunnel.stable_hostname || '');
    add(
      'tunnel_no_random_or_quick_hostname',
      host === expectedHost &&
        !/trycloudflare\.com|cfargotunnel\.com/i.test(host) &&
        !/trycloudflare\.com|cfargotunnel\.com/i.test(String(tunnel.public_redirect_uri || '')),
      'no random or quick-tunnel hostname'
    );
  }

  const failed = checks.filter((c) => !c.ok);
  const allPassed = failed.length === 0;
  let verdict = VERDICT_FOUNDER_RUN_BLOCKED;
  if (allPassed && isOauth) {
    verdict = VERDICT_FOUNDER_RUN_READY;
  } else if (allPassed && isPre) {
    verdict = VERDICT_PROVISIONING_ACTION_AUTHORIZED;
  }

  const ready = verdict === VERDICT_FOUNDER_RUN_READY;
  const provisioningAuthorized = verdict === VERDICT_PROVISIONING_ACTION_AUTHORIZED;

  return {
    verdict,
    readiness_stage: isPre || isOauth ? stage : stage == null || stage === '' ? null : stage,
    checks,
    failed: failed.map((c) => c.id),
    technical_result: ready
      ? 'All FOUNDER_RUN_READINESS machine and declarative checks passed for oauth_execution.'
      : provisioningAuthorized
        ? 'Pre-provisioning checks passed. One bounded Founder provisioning action is authorized. OAuth consent, tunnel start, and hosted collection remain unauthorized.'
        : `Readiness blocked on: ${failed.map((c) => c.id).join(', ')}`,
    governance_status: ready
      ? 'Founder execution command may be issued for the single recorded action.'
      : provisioningAuthorized
        ? 'Founder provisioning action is authorized. OAuth consent, tunnel start, and hosted metadata collection are not authorized. FOUNDER_RUN_READY is not declared.'
        : 'Founder execution is not authorized. Route correction; do not send the Founder the command.',
    authorized_next_state: ready
      ? `Issue exactly one Founder action: ${packet.one_exact_founder_command_or_action}`
      : provisioningAuthorized
        ? `Issue exactly one Founder provisioning action: ${packet.one_exact_founder_command_or_action} Do not start the tunnel. Do not open OAuth consent. Do not collect hosted metadata.`
        : 'Orchestrator classifies failure and routes to Builder/Architecture Guard/Diagnostics without Founder diagnosis.',
  };
}

export function formatReport(result) {
  const lines = [
    'TECHNICAL RESULT:',
    result.technical_result,
    '',
    'GOVERNANCE STATUS:',
    result.governance_status,
    '',
    'AUTHORIZED NEXT STATE:',
    result.authorized_next_state,
    '',
    result.verdict,
  ];
  return lines.join('\n');
}

async function main(argv) {
  if (argv.includes('--self-test')) {
    const { runSelfTests } = await import('./founder-run-readiness.self-test.mjs');
    const { ok, results } = await runSelfTests();
    for (const r of results) {
      console.log(`${r.pass ? 'PASS' : 'FAIL'} ${r.test}${r.detail ? ` — ${r.detail}` : ''}`);
    }
    process.exit(ok ? 0 : 1);
  }

  const packetIdx = argv.indexOf('--packet');
  if (packetIdx === -1 || !argv[packetIdx + 1]) {
    console.error('Usage: node tools/founder-run-readiness.mjs --packet <file.json> | --self-test');
    process.exit(2);
  }
  const packetPath = path.resolve(argv[packetIdx + 1]);
  const packet = JSON.parse(fs.readFileSync(packetPath, 'utf8'));
  const repoRootIdx = argv.indexOf('--repo-root');
  const repoRoot = repoRootIdx !== -1 ? path.resolve(argv[repoRootIdx + 1]) : DEFAULT_REPO_ROOT;
  const result = await evaluateReadiness(packet, { repoRoot });
  console.log(formatReport(result));
  process.exit(
    result.verdict === VERDICT_FOUNDER_RUN_READY || result.verdict === VERDICT_PROVISIONING_ACTION_AUTHORIZED
      ? 0
      : 1
  );
}

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  main(process.argv.slice(2)).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
