/**
 * mil-control-plane.mjs — machine controls for MIL Phase 2A release tooling.
 *
 * Pure validation helpers + thin git/fs probes. Never prints secret values.
 * Never mutates hosted systems. Import from build/package/apply wrappers.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  CRM_PRODUCTION_SUPABASE_REF,
  MIL_PRODUCTION_SUPABASE_REF,
  commandCenterRoot,
  repoRoot,
} from './deploy-lib.mjs';

export { CRM_PRODUCTION_SUPABASE_REF, MIL_PRODUCTION_SUPABASE_REF };

/** Phase 2A Migration A (additive) — currently applied on hosted MIL. */
export const PHASE2A_MIGRATION_A = '20260802120000';
/** Phase 2A Migration B (lockdown) — absent on hosted MIL until authorized. */
export const PHASE2A_MIGRATION_B = '20260802130000';

/** Runtime edge/source boundary currently deployed for Phase 2A edges. */
export const PHASE2A_RUNTIME_BOUNDARY_SHA = '63d619fcc3303f05a60888174585408b745f79fc';

export const ROLLOUT_STAGES = Object.freeze({
  'phase-a': Object.freeze({
    id: 'phase-a',
    schemaAppliedThrough: PHASE2A_MIGRATION_A,
    schemaRequiredThrough: PHASE2A_MIGRATION_A,
    description: 'Migration A applied; frontend may deploy; Migration B not yet authorized',
  }),
  'phase-b': Object.freeze({
    id: 'phase-b',
    schemaAppliedThrough: PHASE2A_MIGRATION_B,
    schemaRequiredThrough: PHASE2A_MIGRATION_B,
    description: 'Migration B lockdown applied; schema tip equals B',
  }),
});

const UNSAFE_PACKAGE_SHA_PREFIXES = Object.freeze(['5a5653e0a24c']);

export function parseCliArgs(argv = process.argv.slice(2)) {
  const args = { _: [] };
  for (const value of argv) {
    if (!value.startsWith('--')) {
      args._.push(value);
      continue;
    }
    const body = value.slice(2);
    const eq = body.indexOf('=');
    if (eq === -1) args[body] = true;
    else args[body.slice(0, eq)] = body.slice(eq + 1);
  }
  return args;
}

export function assertExactMilProjectRef(projectRef, { label = 'project-ref' } = {}) {
  const ref = String(projectRef || '').trim();
  if (!ref) {
    throw new Error(`MIL control-plane refused: missing ${label} (exact ${MIL_PRODUCTION_SUPABASE_REF} required)`);
  }
  if (ref.includes(CRM_PRODUCTION_SUPABASE_REF) || ref === CRM_PRODUCTION_SUPABASE_REF) {
    throw new Error(
      `MIL control-plane refused: ${label} targets forbidden CRM ${CRM_PRODUCTION_SUPABASE_REF}`,
    );
  }
  if (ref !== MIL_PRODUCTION_SUPABASE_REF) {
    throw new Error(
      `MIL control-plane refused: ${label} must be exactly ${MIL_PRODUCTION_SUPABASE_REF} (got ${ref})`,
    );
  }
  return ref;
}

export function assertTextHasNoCrmRef(text, { label = 'input' } = {}) {
  const s = String(text || '');
  if (s.includes(CRM_PRODUCTION_SUPABASE_REF)) {
    throw new Error(`MIL control-plane refused: ${label} contains forbidden CRM ref ${CRM_PRODUCTION_SUPABASE_REF}`);
  }
}

export function assertTextHasMilRef(text, { label = 'input' } = {}) {
  const s = String(text || '');
  if (!s.includes(MIL_PRODUCTION_SUPABASE_REF)) {
    throw new Error(`MIL control-plane refused: ${label} missing required MIL ref ${MIL_PRODUCTION_SUPABASE_REF}`);
  }
}

export function collectBackendRefs(text) {
  const s = String(text || '');
  const refs = new Set();
  if (s.includes(MIL_PRODUCTION_SUPABASE_REF)) refs.add(MIL_PRODUCTION_SUPABASE_REF);
  if (s.includes(CRM_PRODUCTION_SUPABASE_REF)) refs.add(CRM_PRODUCTION_SUPABASE_REF);
  const generic = s.match(/https:\/\/([a-z0-9]{20})\.supabase\.co/gi) || [];
  for (const match of generic) {
    const m = match.match(/https:\/\/([a-z0-9]{20})\.supabase\.co/i);
    if (m) refs.add(m[1]);
  }
  return [...refs];
}

export function assertSingleMilBackendInText(text, { label = 'bundle' } = {}) {
  assertTextHasNoCrmRef(text, { label });
  assertTextHasMilRef(text, { label });
  const refs = collectBackendRefs(text);
  const foreign = refs.filter((r) => r !== MIL_PRODUCTION_SUPABASE_REF);
  if (foreign.length > 0) {
    throw new Error(`MIL control-plane refused: ${label} contains unexpected backend ref(s): ${foreign.join(', ')}`);
  }
  if (refs.filter((r) => r === MIL_PRODUCTION_SUPABASE_REF).length === 0) {
    throw new Error(`MIL control-plane refused: ${label} missing ${MIL_PRODUCTION_SUPABASE_REF}`);
  }
}

function tryGit(args, cwd = repoRoot) {
  try {
    return execFileSync('git', args, {
      cwd,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
  } catch {
    return '';
  }
}

export function resolveGitHead(cwd = repoRoot) {
  const sha = tryGit(['rev-parse', 'HEAD'], cwd);
  if (!/^[0-9a-f]{40}$/i.test(sha)) {
    throw new Error('MIL control-plane refused: git HEAD SHA unavailable');
  }
  return sha.toLowerCase();
}

export function assertExpectedSha(expectedSha, cwd = repoRoot) {
  const expected = String(expectedSha || '').trim().toLowerCase();
  if (!expected) {
    throw new Error('MIL control-plane refused: missing explicit --expected-sha / commit SHA');
  }
  if (!/^[0-9a-f]{7,40}$/i.test(expected)) {
    throw new Error(`MIL control-plane refused: invalid expected SHA ${expected}`);
  }
  const head = resolveGitHead(cwd);
  if (!head.startsWith(expected) && expected !== head) {
    throw new Error(
      `MIL control-plane refused: HEAD ${head} does not match expected SHA ${expected}`,
    );
  }
  return head;
}

/**
 * Fail if the worktree is dirty. Optionally allowlist relative paths
 * (posix-style) that may be present without failing.
 */
export function assertCleanWorktree({ cwd = repoRoot, allowlist = [] } = {}) {
  const porcelain = tryGit(['status', '--porcelain=v1'], cwd);
  if (!porcelain) return { clean: true, entries: [] };
  const allowed = new Set(allowlist.map((p) => p.replaceAll('\\', '/')));
  const entries = porcelain
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .map((line) => {
      // "XY path" or "XY orig -> path"
      const pathPart = line.slice(3).split(' -> ').pop().replaceAll('\\', '/');
      return { raw: line, path: pathPart };
    });
  const blockers = entries.filter((e) => !allowed.has(e.path));
  if (blockers.length > 0) {
    throw new Error(
      `MIL control-plane refused: dirty worktree (${blockers.length} path(s)); first=${blockers[0].path}`,
    );
  }
  return { clean: true, entries };
}

/**
 * Classify env files by project-ref presence only. Never returns secret values.
 */
export function classifyEnvFile(filePath) {
  const result = {
    path: filePath,
    exists: false,
    keys: [],
    scopes: [],
    hasCrmRef: false,
    hasMilRef: false,
    classification: 'absent',
  };
  if (!fs.existsSync(filePath)) return result;
  result.exists = true;
  let text = '';
  try {
    text = fs.readFileSync(filePath, 'utf8');
  } catch {
    result.classification = 'unreadable';
    return result;
  }
  result.hasCrmRef = text.includes(CRM_PRODUCTION_SUPABASE_REF);
  result.hasMilRef = text.includes(MIL_PRODUCTION_SUPABASE_REF);
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    if (m) result.keys.push(m[1]);
  }
  if (result.hasCrmRef && result.hasMilRef) {
    result.scopes = ['MIL', 'CRM'];
    result.classification = 'dangerous-mixed';
  } else if (result.hasCrmRef) {
    result.scopes = ['CRM'];
    result.classification = 'dangerous-crm';
  } else if (result.hasMilRef) {
    result.scopes = ['MIL'];
    result.classification = 'safe-mil';
  } else {
    result.classification = 'ambiguous';
  }
  return result;
}

/**
 * Refuse MIL release operations when CRM credentials are loadable from
 * command-center env sources. Reports classifications only (no values).
 */
export function assertMilCredentialSourcesSafe(ccRoot = commandCenterRoot) {
  const envPath = path.join(ccRoot, '.env');
  const localPath = path.join(ccRoot, '.env.local');
  const env = classifyEnvFile(envPath);
  const local = classifyEnvFile(localPath);
  const problems = [];
  if (env.hasCrmRef) {
    problems.push(`.env classified ${env.classification} (CRM ref present)`);
  }
  if (local.hasCrmRef) {
    problems.push(`.env.local classified ${local.classification} (CRM ref present)`);
  }
  for (const [name, value] of Object.entries(process.env)) {
    if (typeof value !== 'string') continue;
    if (value.includes(CRM_PRODUCTION_SUPABASE_REF)) {
      problems.push(`process env ${name} contains CRM project ref`);
    }
  }
  if (problems.length > 0) {
    throw new Error(
      `MIL control-plane refused: unsafe credential sources — ${problems.join('; ')}. Owner must quarantine CRM secrets from MIL worktrees before release ops.`,
    );
  }
  return { env, local };
}

export function resolveRolloutStage(stageId) {
  const id = String(stageId || '').trim();
  if (!id) {
    throw new Error(
      'MIL control-plane refused: missing --rollout-stage (phase-a|phase-b)',
    );
  }
  const stage = ROLLOUT_STAGES[id];
  if (!stage) {
    throw new Error(
      `MIL control-plane refused: unknown rollout stage ${id} (allowed: ${Object.keys(ROLLOUT_STAGES).join(', ')})`,
    );
  }
  return stage;
}

export function assertBuildInfoMatchesStage(buildInfo, stage) {
  const required = stage.schemaRequiredThrough;
  const applied = stage.schemaAppliedThrough;
  const gotRequired = String(buildInfo?.schemaRequiredThrough || '');
  const gotApplied = String(buildInfo?.schemaAppliedThrough || '');
  const migrationVersion = String(buildInfo?.migrationVersion || '');
  const env = String(buildInfo?.environment || '');
  if (env !== 'mil-production') {
    throw new Error(
      `MIL control-plane refused: build-info.environment must be mil-production (got ${env || '(empty)'})`,
    );
  }
  if (gotRequired !== required) {
    throw new Error(
      `MIL control-plane refused: schemaRequiredThrough=${gotRequired || '(empty)'} != stage ${stage.id} (${required})`,
    );
  }
  if (gotApplied !== applied) {
    throw new Error(
      `MIL control-plane refused: schemaAppliedThrough=${gotApplied || '(empty)'} != stage ${stage.id} (${applied})`,
    );
  }
  // migrationVersion retained as alias of required tip for this rollout stage
  if (migrationVersion && migrationVersion !== required) {
    throw new Error(
      `MIL control-plane refused: migrationVersion=${migrationVersion} conflicts with stage required ${required}`,
    );
  }
  if (stage.id === 'phase-a' && migrationVersion === PHASE2A_MIGRATION_B) {
    throw new Error(
      'MIL control-plane refused: phase-a artifact must not claim Migration B via migrationVersion',
    );
  }
}

export function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex').toUpperCase();
}

export function assertMigrationSqlMatchesVersion(sqlPath, version) {
  const base = path.basename(sqlPath);
  if (!base.startsWith(`${version}_`)) {
    throw new Error(
      `MIL control-plane refused: SQL basename ${base} does not start with ${version}_`,
    );
  }
  if (!fs.existsSync(sqlPath)) {
    throw new Error(`MIL control-plane refused: SQL path missing: ${sqlPath}`);
  }
  const sql = fs.readFileSync(sqlPath, 'utf8');
  // CRM ref may appear in forbid-comments; refuse executable targeting patterns only.
  if (
    new RegExp(
      `supabase\\s+link[^\\n]*${CRM_PRODUCTION_SUPABASE_REF}|project[_-]?ref\\s*=\\s*['"]?${CRM_PRODUCTION_SUPABASE_REF}`,
      'i',
    ).test(sql)
  ) {
    throw new Error(
      `MIL control-plane refused: migration SQL appears to target CRM ${CRM_PRODUCTION_SUPABASE_REF}`,
    );
  }
  // Single-file apply: reject accidental concatenation of the other Phase2A file.
  // Mentions of the companion version in header comments are allowed.
  const beginCount = (sql.match(/^\s*begin\s*;/gim) || []).length;
  if (beginCount > 1) {
    throw new Error(
      `MIL control-plane refused: SQL for ${version} contains multiple BEGIN blocks (possible multi-migration concat)`,
    );
  }
  return { sqlPath, version, bytes: Buffer.byteLength(sql), sha256: sha256File(sqlPath) };
}

export function assertSingleMigrationAuthorization({
  projectRef,
  migrationVersion,
  sqlPath,
  checksum,
  authorizeMigration,
  allowBroadPush = false,
}) {
  if (allowBroadPush) {
    throw new Error(
      'MIL control-plane refused: broad migration push (supabase db push / include-all) is prohibited for Phase 2A hosted apply',
    );
  }
  assertExactMilProjectRef(projectRef);
  const version = String(migrationVersion || '').trim();
  if (!version) {
    throw new Error('MIL control-plane refused: missing --migration-version');
  }
  if (version !== PHASE2A_MIGRATION_A && version !== PHASE2A_MIGRATION_B) {
    throw new Error(
      `MIL control-plane refused: unsupported migration version ${version} (allowed ${PHASE2A_MIGRATION_A}|${PHASE2A_MIGRATION_B})`,
    );
  }
  if (version === PHASE2A_MIGRATION_B) {
    const auth = String(authorizeMigration || '').trim();
    if (auth !== PHASE2A_MIGRATION_B) {
      throw new Error(
        `MIL control-plane refused: Migration B requires --authorize-migration=${PHASE2A_MIGRATION_B}`,
      );
    }
  }
  if (!sqlPath) {
    throw new Error('MIL control-plane refused: missing --sql-path');
  }
  const meta = assertMigrationSqlMatchesVersion(sqlPath, version);
  const expected = String(checksum || '')
    .trim()
    .replace(/^sha256:/i, '')
    .toUpperCase();
  if (!expected) {
    throw new Error('MIL control-plane refused: missing --checksum (sha256 of SQL file)');
  }
  if (expected !== meta.sha256) {
    throw new Error(
      `MIL control-plane refused: checksum mismatch for ${path.basename(sqlPath)} (expected ${expected}, got ${meta.sha256})`,
    );
  }
  return meta;
}

export function isUnsafeStalePackageName(name) {
  const base = path.basename(String(name || ''));
  return UNSAFE_PACKAGE_SHA_PREFIXES.some((prefix) => base.includes(`mil-production-${prefix}`));
}

export function classifyPackageArtifact(filePath) {
  const base = path.basename(filePath);
  if (isUnsafeStalePackageName(base)) {
    return {
      path: filePath,
      classification: 'UNSAFE — DO NOT DEPLOY',
      reason: 'pre-boundary 5a5653e package (missing Phase 2A security / may lack baked sdzh…)',
    };
  }
  if (base.includes('mil-production-63d619f')) {
    return {
      path: filePath,
      classification: 'PRE-CONTROL — NOT FINAL',
      reason: 'runtime-boundary package predates control-plane hardening; rebuild after controls merge',
    };
  }
  return {
    path: filePath,
    classification: 'UNREVIEWED',
    reason: 'not in known unsafe or certified inventory',
  };
}

export function inventoryMilPackages(searchRoots) {
  const out = [];
  for (const root of searchRoots) {
    if (!root || !fs.existsSync(root)) continue;
    const entries = fs.readdirSync(root, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (!/^mil-production-.*\.zip$/i.test(entry.name)) continue;
      const full = path.join(root, entry.name);
      out.push({
        ...classifyPackageArtifact(full),
        bytes: fs.statSync(full).size,
        sha256: sha256File(full),
      });
    }
  }
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

/** Doc truth markers expected in current-state Phase 2A sections. */
export function assertPhase2aCurrentDocsTruth(markdown) {
  const text = String(markdown || '');
  const problems = [];
  if (/No hosted Migration A\/B/i.test(text)) {
    problems.push('docs still claim "No hosted Migration A/B"');
  }
  // Current executable next-action must not target CRM; historical markers are allowed nearby.
  if (/Exact next action:[\s\S]{0,220}wwyxohjnyqnegzbxtuxs/i.test(text)) {
    problems.push('docs still present executable next-action targeting wwyx…');
  }
  if (/## Phase 2A —/i.test(text)) {
    const hasAApplied =
      /Migration A[^\n]{0,80}applied/i.test(text) ||
      /Hosted Migration A[^\n]{0,80}Applied/i.test(text) ||
      /A `?20260802120000`?[^\n]{0,40}Applied/i.test(text);
    if (!hasAApplied) {
      problems.push('Phase 2A section missing Migration A applied statement');
    }
  }
  if (problems.length > 0) {
    throw new Error(`MIL doc truth refused: ${problems.join('; ')}`);
  }
}

export function moduleDir() {
  return path.dirname(fileURLToPath(import.meta.url));
}
