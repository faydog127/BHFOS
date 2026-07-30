#!/usr/bin/env node
/**
 * package-mil-staging-archive.mjs
 *
 * Packages command-center/dist into a dated zip for mil.bhfos.com deploy.
 * Applies MIL-only discoverability controls inside the package (noindex robots),
 * without mutating tracked source files.
 *
 * Usage:
 *   node tools/package-mil-staging-archive.mjs [--dist=dist] [--out=tmp/mil-staging-….zip]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

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
  if (!fs.existsSync(path.join(distDir, 'build-info.json'))) {
    throw new Error(`missing ${path.join(distDir, 'build-info.json')}`);
  }
  if (!fs.existsSync(path.join(distDir, '.htaccess'))) {
    throw new Error(`missing ${path.join(distDir, '.htaccess')} (SPA fallback required)`);
  }

  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  let shortSha = 'unknown';
  try {
    const info = JSON.parse(fs.readFileSync(path.join(distDir, 'build-info.json'), 'utf8'));
    if (typeof info.shortSha === 'string' && info.shortSha) shortSha = info.shortSha;
    else if (typeof info.commitSha === 'string') shortSha = info.commitSha.slice(0, 12);
  } catch {
    /* keep unknown */
  }

  const outDir = path.join(root, 'tmp');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.resolve(
    root,
    args.out || path.join('tmp', `mil-staging-${shortSha}-${stamp}.zip`)
  );

  // Staging packaging directory (gitignored via tmp/)
  const packDir = path.join(outDir, `mil-pack-${stamp}`);
  fs.rmSync(packDir, { recursive: true, force: true });
  fs.cpSync(distDir, packDir, { recursive: true });

  // Internal/staging discoverability controls (package-only)
  fs.writeFileSync(
    path.join(packDir, 'robots.txt'),
    'User-agent: *\nDisallow: /\n',
    'utf8'
  );
  let indexHtml = fs.readFileSync(path.join(packDir, 'index.html'), 'utf8');
  if (!/name=["']robots["']/i.test(indexHtml)) {
    indexHtml = indexHtml.replace(
      /<head>/i,
      '<head>\n    <meta name="robots" content="noindex, nofollow, noarchive" />'
    );
  }
  indexHtml = indexHtml.replace(
    /<title>[^<]*<\/title>/i,
    '<title>MIL Staging (internal) | BHFOS</title>'
  );
  fs.writeFileSync(path.join(packDir, 'index.html'), indexHtml, 'utf8');

  if (fs.existsSync(outPath)) fs.rmSync(outPath, { force: true });

  // Prefer tar/zip via PowerShell Compress-Archive on Windows
  if (process.platform === 'win32') {
    execFileSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-Command',
        `Compress-Archive -Path '${packDir}\\*' -DestinationPath '${outPath}' -Force`,
      ],
      { stdio: 'inherit' }
    );
  } else {
    execFileSync('zip', ['-r', outPath, '.'], { cwd: packDir, stdio: 'inherit' });
  }

  fs.rmSync(packDir, { recursive: true, force: true });
  const size = fs.statSync(outPath).size;
  console.log(JSON.stringify({ ok: true, archivePath: outPath, bytes: size, shortSha }, null, 2));
}

main();
