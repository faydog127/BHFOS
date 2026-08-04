#!/usr/bin/env node
/**
 * package-mil-production-archive.mjs
 *
 * Packages command-center/dist into a dated zip for mil.bhfos.com (MIL Production).
 * Fail-closed control-plane gates (dirty tree, SHA, refs, rollout stage metadata).
 *
 * Usage:
 *   node tools/package-mil-production-archive.mjs \
 *     --expected-sha=<sha> \
 *     --project-ref=sdzhdupekcnekesbtxsl \
 *     --rollout-stage=phase-a \
 *     [--dist=dist] [--out=tmp/mil-production-….zip] [--allow-test-artifact]
 *
 * Deprecated alias: tools/package-mil-staging-archive.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import {
  parseCliArgs,
  assertExactMilProjectRef,
  assertExpectedSha,
  assertCleanWorktree,
  assertMilCredentialSourcesSafe,
  resolveRolloutStage,
  assertBuildInfoMatchesStage,
  assertSingleMilBackendInText,
  assertTextHasNoCrmRef,
  sha256File,
  isUnsafeStalePackageName,
} from './mil-control-plane.mjs';
import { CRM_PRODUCTION_SUPABASE_REF, MIL_PRODUCTION_SUPABASE_REF } from './deploy-lib.mjs';

const toolsDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(toolsDir, '..');

function main() {
  const args = parseCliArgs(process.argv.slice(2));
  const projectRef = assertExactMilProjectRef(args['project-ref']);
  const stage = resolveRolloutStage(args['rollout-stage']);
  const head = assertExpectedSha(args['expected-sha']);
  assertCleanWorktree();
  assertMilCredentialSourcesSafe(root);

  const distDir = path.resolve(root, args.dist || 'dist');
  if (!fs.existsSync(path.join(distDir, 'index.html'))) {
    throw new Error(`missing ${path.join(distDir, 'index.html')}`);
  }
  const buildInfoPath = path.join(distDir, 'build-info.json');
  if (!fs.existsSync(buildInfoPath)) {
    throw new Error(`missing ${buildInfoPath}`);
  }
  if (!fs.existsSync(path.join(distDir, '.htaccess'))) {
    throw new Error(`missing ${path.join(distDir, '.htaccess')} (SPA fallback required)`);
  }

  const buildInfo = JSON.parse(fs.readFileSync(buildInfoPath, 'utf8'));
  if (String(buildInfo.environment || '') !== 'mil-production') {
    throw new Error(
      `refusing package: build-info environment must be mil-production (got ${buildInfo.environment || '(empty)'})`,
    );
  }
  assertBuildInfoMatchesStage(buildInfo, stage);

  const buildSha = String(buildInfo.commitSha || '').toLowerCase();
  if (!buildSha || buildSha === 'unknown') {
    throw new Error('refusing package: build-info.commitSha missing');
  }
  if (buildSha !== head) {
    throw new Error(
      `refusing package: build-info.commitSha ${buildSha} != HEAD/expected ${head}`,
    );
  }

  const indexJs = fs
    .readdirSync(path.join(distDir, 'assets'), { withFileTypes: true })
    .filter((d) => d.isFile() && d.name.endsWith('.js'))
    .map((d) => fs.readFileSync(path.join(distDir, 'assets', d.name), 'utf8'))
    .join('\n');
  if (indexJs.includes(CRM_PRODUCTION_SUPABASE_REF)) {
    throw new Error(
      `refusing package: bundle references CRM backend ${CRM_PRODUCTION_SUPABASE_REF}`,
    );
  }
  assertSingleMilBackendInText(indexJs, { label: 'dist JS bundle' });
  if (!indexJs.includes(projectRef)) {
    throw new Error(`refusing package: bundle missing project-ref ${projectRef}`);
  }

  // Full dist CRM-ref scan
  for (const name of fs.readdirSync(distDir)) {
    const full = path.join(distDir, name);
    if (!fs.statSync(full).isFile()) continue;
    if (!/\.(js|css|html|json|map|txt)$/i.test(name)) continue;
    assertTextHasNoCrmRef(fs.readFileSync(full, 'utf8'), { label: name });
  }

  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  let shortSha = 'unknown';
  if (typeof buildInfo.shortSha === 'string' && buildInfo.shortSha) shortSha = buildInfo.shortSha;
  else if (typeof buildInfo.commitSha === 'string') shortSha = buildInfo.commitSha.slice(0, 12);

  const outDir = path.join(root, 'tmp');
  fs.mkdirSync(outDir, { recursive: true });
  const defaultName = args['allow-test-artifact']
    ? `mil-production-TEST-${shortSha}-${stamp}.zip`
    : `mil-production-${shortSha}-${stamp}.zip`;
  const outPath = path.resolve(root, args.out || path.join('tmp', defaultName));
  if (isUnsafeStalePackageName(outPath)) {
    throw new Error(`refusing package: output name looks like unsafe stale artifact ${path.basename(outPath)}`);
  }

  const packDir = path.join(outDir, `mil-pack-${stamp}`);
  fs.rmSync(packDir, { recursive: true, force: true });
  fs.cpSync(distDir, packDir, { recursive: true });

  fs.writeFileSync(
    path.join(packDir, 'robots.txt'),
    'User-agent: *\nDisallow: /\n',
    'utf8',
  );
  let indexHtml = fs.readFileSync(path.join(packDir, 'index.html'), 'utf8');
  if (!/name=["']robots["']/i.test(indexHtml)) {
    indexHtml = indexHtml.replace(
      /<head>/i,
      '<head>\n    <meta name="robots" content="noindex, nofollow, noarchive" />',
    );
  }
  indexHtml = indexHtml.replace(
    /<title>[^<]*<\/title>/i,
    '<title>MIL Production | BHFOS</title>',
  );
  fs.writeFileSync(path.join(packDir, 'index.html'), indexHtml, 'utf8');

  const attestation = {
    schema: 'bhfos.mil-package-attestation/v1',
    classification: args['allow-test-artifact'] ? 'TEST_ARTIFACT — NOT FINAL DEPLOYABLE' : 'PACKAGE_CANDIDATE — REQUIRES CERTIFICATION',
    createdAt: new Date().toISOString(),
    projectRef: MIL_PRODUCTION_SUPABASE_REF,
    rolloutStage: stage.id,
    commitSha: head,
    schemaAppliedThrough: buildInfo.schemaAppliedThrough,
    schemaRequiredThrough: buildInfo.schemaRequiredThrough,
    migrationVersion: buildInfo.migrationVersion,
    environment: buildInfo.environment,
    finalDeployable: false,
  };
  fs.writeFileSync(
    path.join(packDir, 'mil-package-attestation.json'),
    `${JSON.stringify(attestation, null, 2)}\n`,
    'utf8',
  );

  if (fs.existsSync(outPath)) fs.rmSync(outPath, { force: true });

  if (process.platform === 'win32') {
    execFileSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-Command',
        `Compress-Archive -Path '${packDir}\\*' -DestinationPath '${outPath}' -Force`,
      ],
      { stdio: 'inherit' },
    );
  } else {
    execFileSync('zip', ['-r', outPath, '.'], { cwd: packDir, stdio: 'inherit' });
  }

  fs.rmSync(packDir, { recursive: true, force: true });
  const size = fs.statSync(outPath).size;
  const archiveSha = sha256File(outPath);
  console.log(
    JSON.stringify(
      {
        ok: true,
        archivePath: outPath,
        bytes: size,
        sha256: archiveSha,
        shortSha,
        environment: buildInfo.environment,
        rolloutStage: stage.id,
        schemaAppliedThrough: buildInfo.schemaAppliedThrough,
        schemaRequiredThrough: buildInfo.schemaRequiredThrough,
        projectRef,
        finalDeployable: false,
        classification: attestation.classification,
      },
      null,
      2,
    ),
  );
}

try {
  main();
} catch (err) {
  console.error(`[mil-package] ERROR: ${err && err.message ? err.message : err}`);
  process.exit(1);
}
