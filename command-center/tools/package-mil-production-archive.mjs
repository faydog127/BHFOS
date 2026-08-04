#!/usr/bin/env node
/**
 * package-mil-production-archive.mjs
 *
 * Packages command-center/dist into a dated zip for mil.bhfos.com (MIL Production).
 * Applies MIL-only discoverability controls inside the package (noindex robots),
 * without mutating tracked source files.
 *
 * Usage:
 *   node tools/package-mil-production-archive.mjs [--dist=dist] [--out=tmp/mil-production-….zip]
 *
 * Deprecated alias: tools/package-mil-staging-archive.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { CRM_PRODUCTION_SUPABASE_REF, MIL_PRODUCTION_SUPABASE_REF } from './deploy-lib.mjs';

const toolsDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(toolsDir, '..');

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

function main() {
  const args = parseArgs(process.argv.slice(2));
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
  const env = String(buildInfo.environment || '');
  if (env !== 'mil-production' && env !== 'mil-staging') {
    throw new Error(
      `refusing package: build-info environment must be mil-production (got ${env || '(empty)'})`,
    );
  }

  // Defense: never ship a CRM-backend bundle to the MIL host.
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
  if (!indexJs.includes(MIL_PRODUCTION_SUPABASE_REF) && env === 'mil-production') {
    console.warn(
      `[mil-package] WARNING: bundle does not contain ${MIL_PRODUCTION_SUPABASE_REF}; verify VITE_SUPABASE_URL before deploy`,
    );
  }

  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  let shortSha = 'unknown';
  if (typeof buildInfo.shortSha === 'string' && buildInfo.shortSha) shortSha = buildInfo.shortSha;
  else if (typeof buildInfo.commitSha === 'string') shortSha = buildInfo.commitSha.slice(0, 12);

  const outDir = path.join(root, 'tmp');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.resolve(
    root,
    args.out || path.join('tmp', `mil-production-${shortSha}-${stamp}.zip`),
  );

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
  console.log(JSON.stringify({ ok: true, archivePath: outPath, bytes: size, shortSha, environment: env }, null, 2));
}

main();
