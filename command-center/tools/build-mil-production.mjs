#!/usr/bin/env node
/**
 * build-mil-production.mjs — fail-closed MIL production frontend build.
 *
 * Requires:
 *   --rollout-stage=phase-a|phase-b
 *   --expected-sha=<git sha>
 *   --project-ref=sdzhdupekcnekesbtxsl
 *   clean worktree
 *   no CRM credential sources in command-center env files / process env
 *   VITE_SUPABASE_URL containing sdzh… (and not wwyx…)
 *   VITE_SUPABASE_ANON_KEY present
 *
 * Runs: vite build → generate-build-info (stage-aware) → secret scan → backend-ref scan
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  parseCliArgs,
  assertExactMilProjectRef,
  assertExpectedSha,
  assertCleanWorktree,
  assertMilCredentialSourcesSafe,
  resolveRolloutStage,
  assertTextHasNoCrmRef,
  assertTextHasMilRef,
  assertSingleMilBackendInText,
} from './mil-control-plane.mjs';
import { commandCenterRoot, walkFiles } from './deploy-lib.mjs';

const toolsDir = path.dirname(fileURLToPath(import.meta.url));

function runNode(scriptArgs) {
  const res = spawnSync(process.execPath, scriptArgs, {
    cwd: commandCenterRoot,
    env: process.env,
    stdio: 'inherit',
  });
  if (res.status !== 0) {
    throw new Error(`command failed: node ${scriptArgs.join(' ')}`);
  }
}

function scanDistBackend(distDir) {
  const assetsDir = path.join(distDir, 'assets');
  if (!fs.existsSync(assetsDir)) {
    throw new Error('MIL build refused: dist/assets missing after vite build');
  }
  const js = fs
    .readdirSync(assetsDir, { withFileTypes: true })
    .filter((d) => d.isFile() && d.name.endsWith('.js'))
    .map((d) => fs.readFileSync(path.join(assetsDir, d.name), 'utf8'))
    .join('\n');
  assertSingleMilBackendInText(js, { label: 'dist JS bundle' });

  runNode([path.join(toolsDir, 'scan-dist-for-secrets.mjs'), distDir]);

  for (const rel of walkFiles(distDir)) {
    if (!/\.(js|css|html|json|map|txt)$/i.test(rel)) continue;
    const content = fs.readFileSync(path.join(distDir, rel), 'utf8');
    assertTextHasNoCrmRef(content, { label: rel });
  }
}

function main() {
  const args = parseCliArgs(process.argv.slice(2));
  const projectRef = assertExactMilProjectRef(args['project-ref']);
  const stage = resolveRolloutStage(args['rollout-stage']);
  const head = assertExpectedSha(args['expected-sha']);
  assertCleanWorktree();
  assertMilCredentialSourcesSafe(commandCenterRoot);

  const viteUrl = process.env.VITE_SUPABASE_URL || '';
  const viteAnon = process.env.VITE_SUPABASE_ANON_KEY || '';
  if (!viteUrl) throw new Error('MIL build refused: VITE_SUPABASE_URL missing');
  if (!viteAnon) throw new Error('MIL build refused: VITE_SUPABASE_ANON_KEY missing');
  assertTextHasNoCrmRef(viteUrl, { label: 'VITE_SUPABASE_URL' });
  assertTextHasMilRef(viteUrl, { label: 'VITE_SUPABASE_URL' });
  if (!viteUrl.includes(projectRef)) {
    throw new Error('MIL build refused: VITE_SUPABASE_URL must include --project-ref');
  }

  const distDir = path.join(commandCenterRoot, 'dist');
  const vite = spawnSync(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['vite', 'build'],
    {
      cwd: commandCenterRoot,
      env: process.env,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    },
  );
  if (vite.status !== 0) throw new Error('MIL build refused: vite build failed');

  runNode([
    path.join(toolsDir, 'generate-build-info.mjs'),
    '--environment=mil-production',
    `--rollout-stage=${stage.id}`,
    `--expected-sha=${head}`,
    '--require-clean',
  ]);

  scanDistBackend(distDir);

  const buildInfo = JSON.parse(fs.readFileSync(path.join(distDir, 'build-info.json'), 'utf8'));
  console.log(
    JSON.stringify(
      {
        ok: true,
        commitSha: buildInfo.commitSha,
        environment: buildInfo.environment,
        rolloutStage: stage.id,
        schemaAppliedThrough: buildInfo.schemaAppliedThrough,
        schemaRequiredThrough: buildInfo.schemaRequiredThrough,
        migrationVersion: buildInfo.migrationVersion,
        projectRef,
      },
      null,
      2,
    ),
  );
}

try {
  main();
} catch (err) {
  console.error(`[build-mil-production] ERROR: ${err && err.message ? err.message : err}`);
  process.exit(1);
}
