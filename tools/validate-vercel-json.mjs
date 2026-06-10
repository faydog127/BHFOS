import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');

const IGNORED_DIR_NAMES = new Set([
  '.git',
  'node_modules',
  '.vercel',
  'dist',
  'build',
  'out',
  '.next',
  'coverage',
  'playwright-report',
  'test-results',
  'archive',
]);

async function findVercelJsonFiles(dir) {
  const results = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (IGNORED_DIR_NAMES.has(entry.name)) continue;
      results.push(...(await findVercelJsonFiles(fullPath)));
      continue;
    }

    if (entry.isFile() && entry.name === 'vercel.json') {
      results.push(fullPath);
    }
  }

  return results;
}

function hexPrefix(raw, maxBytes) {
  return Buffer.from(raw, 'utf8')
    .subarray(0, maxBytes)
    .toString('hex')
    .match(/.{1,2}/g)
    ?.join(' ') ?? '';
}

function validateJsonObject(raw) {
  if (raw.length === 0) {
    return {
      kind: 'empty',
      detail: 'File is zero bytes (not valid JSON).',
    };
  }

  if (raw.trim().length === 0) {
    return {
      kind: 'whitespace-only',
      detail: `File is whitespace-only (not valid JSON). utf8_hex_prefix=${hexPrefix(raw, 16)}`,
    };
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    const message =
      err && typeof err === 'object' && 'message' in err
        ? String(err.message)
        : String(err);

    return {
      kind: 'invalid-json',
      detail: `Invalid JSON: ${message}`,
    };
  }

  if (parsed === null || Array.isArray(parsed) || typeof parsed !== 'object') {
    return {
      kind: 'not-object',
      detail: `Top-level JSON value must be an object (got ${parsed === null ? 'null' : Array.isArray(parsed) ? 'array' : typeof parsed}).`,
    };
  }

  return null;
}

const files = await findVercelJsonFiles(repoRoot);
if (files.length === 0) {
  console.error('No vercel.json files found.');
  process.exit(1);
}

const failures = [];
for (const filePath of files.sort()) {
  const raw = await fs.readFile(filePath, 'utf8');
  const err = validateJsonObject(raw);
  if (err) failures.push({ filePath, ...err });
}

if (failures.length > 0) {
  console.error('Invalid vercel.json detected (fix before deploying):');
  for (const f of failures) {
    console.error(`- ${path.relative(repoRoot, f.filePath)}: ${f.kind}: ${f.detail}`);
  }
  process.exit(1);
}

console.log(`OK: ${files.length} vercel.json file(s) are valid JSON objects.`);

