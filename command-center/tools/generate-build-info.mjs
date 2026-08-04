#!/usr/bin/env node
/**
 * generate-build-info.mjs — G2.3A deterministic, non-secret build identity.
 *
 * Emits `dist/build-info.json` describing the build that produced the current
 * `dist` output. Every field is derived from git, the CI environment, the
 * repository migration filenames, or the built asset names. NO secret or
 * environment-variable value is ever read or emitted.
 *
 * Design guarantees:
 *   - Deterministic: identical inputs (same commit + same dist) produce the
 *     same identity fields (timestamp excepted, which is explicitly the build
 *     time).
 *   - Honest: any field that cannot be determined is emitted as the explicit
 *     string "unknown" — it is never faked and a deployed SHA is never
 *     fabricated.
 *   - Non-secret: only public build metadata is written.
 *
 * Usage:
 *   node tools/generate-build-info.mjs [--dist=dist] [--environment=<env>]
 *                                      [--release=<id>] [--out=<path>]
 *                                      [--rollout-stage=phase-a|phase-b]
 *                                      [--expected-sha=<sha>] [--require-clean]
 *
 * For mil-production builds, --rollout-stage is REQUIRED. Schema fields are
 * pinned by rollout stage (not by max migration filename):
 *   schemaAppliedThrough / schemaRequiredThrough
 * migrationVersion is retained as an alias of schemaRequiredThrough for the
 * selected stage (never the source-tree maximum when a stage is set).
 *
 * This tool performs NO network operation and NO deployment. It only reads the
 * local repository/build output and writes one JSON file.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  resolveRolloutStage,
  assertExpectedSha,
  assertCleanWorktree,
  resolveGitHead,
} from './mil-control-plane.mjs';

const SCHEMA = 'bhfos.build-info/v1';
const UNKNOWN = 'unknown';

const toolsDir = path.dirname(fileURLToPath(import.meta.url));
const commandCenterRoot = path.resolve(toolsDir, '..');

function parseArgs(argv) {
  const args = {};
  for (const raw of argv) {
    if (!raw.startsWith('--')) continue;
    const body = raw.slice(2);
    const eq = body.indexOf('=');
    if (eq === -1) args[body] = true;
    else args[body.slice(0, eq)] = body.slice(eq + 1);
  }
  return args;
}

function tryGit(args) {
  try {
    return execFileSync('git', args, {
      cwd: commandCenterRoot,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
  } catch {
    return '';
  }
}

function resolveCommitSha() {
  // Prefer the CI-provided commit SHA when present, else derive from git.
  const fromGit = tryGit(['rev-parse', 'HEAD']);
  if (/^[0-9a-f]{40}$/i.test(fromGit)) return fromGit;
  const fromEnv = process.env.GITHUB_SHA || '';
  if (/^[0-9a-f]{40}$/i.test(fromEnv)) return fromEnv;
  return UNKNOWN;
}

function resolveMergeSha() {
  // A merge SHA is only meaningful in a pull-request / merge context. In
  // GitHub Actions PR runs, GITHUB_SHA is the ephemeral merge commit and
  // GITHUB_EVENT_NAME is "pull_request". Outside that context the merge SHA is
  // genuinely unavailable and is reported as unknown (never fabricated).
  if (process.env.GITHUB_EVENT_NAME === 'pull_request') {
    const sha = process.env.GITHUB_SHA || '';
    if (/^[0-9a-f]{40}$/i.test(sha)) return sha;
  }
  const mergeHead = tryGit(['rev-parse', '--verify', '--quiet', 'MERGE_HEAD']);
  if (/^[0-9a-f]{40}$/i.test(mergeHead)) return mergeHead;
  return UNKNOWN;
}

function resolveBranch() {
  const ref = process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || '';
  if (ref) return ref;
  const fromGit = tryGit(['rev-parse', '--abbrev-ref', 'HEAD']);
  return fromGit || UNKNOWN;
}

function resolveEnvironment(args) {
  if (typeof args.environment === 'string' && args.environment.trim()) {
    return args.environment.trim();
  }
  if (process.env.BHFOS_BUILD_ENV) return process.env.BHFOS_BUILD_ENV;
  if (process.env.GITHUB_ACTIONS === 'true') return 'ci';
  return 'development';
}

async function resolveReleaseId(args) {
  if (typeof args.release === 'string' && args.release.trim()) {
    return args.release.trim();
  }
  if (process.env.BHFOS_RELEASE_ID) return process.env.BHFOS_RELEASE_ID;
  // Fall back to the semantic version declared in the app version module.
  try {
    const mod = await import('../src/config/version.js');
    const sv = mod.SYSTEM_VERSION || mod.default;
    if (sv && typeof sv.getFullVersion === 'function') return sv.getFullVersion();
  } catch {
    /* version module unavailable in this context */
  }
  return UNKNOWN;
}

/** Source-tree maximum migration filename — NOT applied schema; NOT used for mil-production stage builds. */
function resolveSourceTipMigrationVersion() {
  const migrationsDir = path.join(commandCenterRoot, 'supabase', 'migrations');
  if (!fs.existsSync(migrationsDir)) return UNKNOWN;
  const prefixes = fs
    .readdirSync(migrationsDir)
    .filter((n) => n.toLowerCase().endsWith('.sql'))
    .map((n) => (n.match(/^(\d{8,14})/) || [])[1])
    .filter(Boolean)
    .sort();
  if (prefixes.length === 0) return UNKNOWN;
  return prefixes[prefixes.length - 1];
}

function extractAssetRefs(html) {
  const refs = new Set();
  const patterns = [/(?:src|href)\s*=\s*"(\/[^"]+)"/gi, /(?:src|href)\s*=\s*'(\/[^']+)'/gi];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(String(html || '')))) {
      const ref = match[1];
      if (/\.(?:js|css|wasm)$/i.test(ref)) refs.add(ref);
    }
  }
  return [...refs].sort();
}

function resolveFrontendAssetVersion(distDir) {
  const indexPath = path.join(distDir, 'index.html');
  if (!fs.existsSync(indexPath)) return { assetVersion: UNKNOWN, assetRefs: [] };
  const html = fs.readFileSync(indexPath, 'utf8');
  const refs = extractAssetRefs(html);
  if (refs.length === 0) return { assetVersion: UNKNOWN, assetRefs: [] };
  const digest = crypto.createHash('sha256').update(refs.join('\n')).digest('hex').slice(0, 16);
  return { assetVersion: digest, assetRefs: refs };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const distArg = typeof args.dist === 'string' ? args.dist : 'dist';
  const distDir = path.isAbsolute(distArg) ? distArg : path.join(commandCenterRoot, distArg);
  const outPath = typeof args.out === 'string'
    ? (path.isAbsolute(args.out) ? args.out : path.join(commandCenterRoot, args.out))
    : path.join(distDir, 'build-info.json');

  const environment = resolveEnvironment(args);
  const sourceTipMigration = resolveSourceTipMigrationVersion();

  let rolloutStage = null;
  let schemaAppliedThrough = UNKNOWN;
  let schemaRequiredThrough = UNKNOWN;
  let migrationVersion = sourceTipMigration;

  if (environment === 'mil-production') {
    rolloutStage = resolveRolloutStage(args['rollout-stage']);
    schemaAppliedThrough = rolloutStage.schemaAppliedThrough;
    schemaRequiredThrough = rolloutStage.schemaRequiredThrough;
    // Alias: stage-required tip — never the source-tree maximum while B is pending.
    migrationVersion = schemaRequiredThrough;
    if (args['require-clean']) assertCleanWorktree();
    if (args['expected-sha']) {
      assertExpectedSha(args['expected-sha']);
    } else {
      // mil-production always needs a resolvable SHA
      resolveGitHead();
    }
  } else if (typeof args['rollout-stage'] === 'string' && args['rollout-stage'].trim()) {
    rolloutStage = resolveRolloutStage(args['rollout-stage']);
    schemaAppliedThrough = rolloutStage.schemaAppliedThrough;
    schemaRequiredThrough = rolloutStage.schemaRequiredThrough;
    migrationVersion = schemaRequiredThrough;
  }

  let commitSha = resolveCommitSha();
  if (environment === 'mil-production' && commitSha === UNKNOWN) {
    throw new Error('build-info refused: mil-production requires a resolvable commit SHA');
  }
  if (args['expected-sha'] && commitSha !== UNKNOWN) {
    const head = assertExpectedSha(args['expected-sha']);
    commitSha = head;
  }

  const { assetVersion, assetRefs } = resolveFrontendAssetVersion(distDir);

  const buildInfo = {
    schema: SCHEMA,
    generator: 'tools/generate-build-info.mjs',
    generatedAt: new Date().toISOString(),
    buildTimestamp: new Date().toISOString(),
    commitSha,
    shortSha: commitSha === UNKNOWN ? UNKNOWN : commitSha.slice(0, 12),
    mergeSha: resolveMergeSha(),
    branch: resolveBranch(),
    releaseId: await resolveReleaseId(args),
    environment,
    // Truthful Phase-A/B metadata (stage-pinned). Not live hosted probe.
    schemaAppliedThrough,
    schemaRequiredThrough,
    sourceTipMigrationVersion: sourceTipMigration,
    // Backward-compatible alias of schemaRequiredThrough when stage is set.
    migrationVersion,
    rolloutStage: rolloutStage ? rolloutStage.id : UNKNOWN,
    frontendAssetVersion: assetVersion,
    frontendAssetCount: assetRefs.length,
    node: process.version,
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(buildInfo, null, 2)}\n`, 'utf8');

  const rel = path.relative(commandCenterRoot, outPath).replaceAll('\\', '/');
  console.log(`[build-info] wrote ${rel}`);
  console.log(`[build-info] commitSha=${buildInfo.commitSha} environment=${buildInfo.environment} releaseId=${buildInfo.releaseId}`);
  console.log(
    `[build-info] schemaAppliedThrough=${buildInfo.schemaAppliedThrough} schemaRequiredThrough=${buildInfo.schemaRequiredThrough} migrationVersion=${buildInfo.migrationVersion} sourceTip=${buildInfo.sourceTipMigrationVersion}`,
  );
  if (buildInfo.commitSha === UNKNOWN) {
    console.warn('[build-info] WARNING: commitSha is unknown (git/CI SHA unavailable). Not a release-grade identity.');
  }
}

main().catch((err) => {
  console.error(`[build-info] ERROR: ${err && err.message ? err.message : err}`);
  process.exit(1);
});
