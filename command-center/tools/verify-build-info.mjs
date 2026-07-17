#!/usr/bin/env node
/**
 * verify-build-info.mjs — G2.3A read-only build-identity verifier.
 *
 * Independently validates a generated `build-info.json` so build identity is
 * verifiable without trusting the generator. Checks:
 *   - the file exists and is well-formed JSON;
 *   - the expected schema and required fields are present;
 *   - required fields are non-empty;
 *   - no secret-looking value is present (defence in depth);
 *   - (with --require-release) that git-derivable identity is real, i.e. the
 *     commit SHA is a 40-hex value and not "unknown".
 *
 * This tool performs NO network operation, reads no secret, and writes nothing.
 *
 * Usage:
 *   node tools/verify-build-info.mjs [path=dist/build-info.json]
 *                                    [--require-release] [--json]
 * Exit code 0 = valid; non-zero = invalid/malformed.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const toolsDir = path.dirname(fileURLToPath(import.meta.url));
const commandCenterRoot = path.resolve(toolsDir, '..');
const UNKNOWN = 'unknown';

const REQUIRED_FIELDS = [
  'schema',
  'generatedAt',
  'buildTimestamp',
  'commitSha',
  'mergeSha',
  'releaseId',
  'environment',
  'migrationVersion',
  'frontendAssetVersion',
];

// Defence-in-depth: reject any obvious secret material that must never appear
// in a public build-identity artifact.
const SECRET_PATTERNS = [
  { id: 'openai_key', regex: /sk-[A-Za-z0-9]{20,}/ },
  { id: 'stripe_secret', regex: /sk_live_[0-9a-zA-Z]{12,}/ },
  { id: 'stripe_restricted', regex: /rk_live_[0-9a-zA-Z]{12,}/ },
  { id: 'stripe_webhook', regex: /whsec_[0-9a-zA-Z]{12,}/ },
  { id: 'supabase_access_token', regex: /sbp_[0-9a-f]{20,}/i },
  { id: 'bearer_token', regex: /bearer\s+[a-z0-9._-]{20,}/i },
  { id: 'jwt', regex: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/ },
];

function parseArgs(argv) {
  const args = { _: [] };
  for (const raw of argv) {
    if (raw.startsWith('--')) {
      const body = raw.slice(2);
      const eq = body.indexOf('=');
      if (eq === -1) args[body] = true;
      else args[body.slice(0, eq)] = body.slice(eq + 1);
    } else {
      args._.push(raw);
    }
  }
  return args;
}

function isIso(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  const d = new Date(value);
  return !Number.isNaN(d.getTime());
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const target = args._[0] || 'dist/build-info.json';
  const infoPath = path.isAbsolute(target) ? target : path.join(commandCenterRoot, target);

  const errors = [];
  const warnings = [];
  let info = null;

  if (!fs.existsSync(infoPath)) {
    errors.push(`build-info file not found: ${target}`);
  } else {
    const raw = fs.readFileSync(infoPath, 'utf8');

    for (const pattern of SECRET_PATTERNS) {
      if (pattern.regex.test(raw)) {
        errors.push(`possible secret material detected (${pattern.id}); build-info must contain no secrets`);
      }
    }

    try {
      info = JSON.parse(raw);
    } catch (err) {
      errors.push(`build-info is not valid JSON: ${err.message}`);
    }
  }

  if (info) {
    if (typeof info !== 'object' || Array.isArray(info)) {
      errors.push('build-info must be a JSON object');
    } else {
      for (const field of REQUIRED_FIELDS) {
        if (!(field in info)) errors.push(`missing required field: ${field}`);
        else if (typeof info[field] !== 'string' || !info[field].trim()) {
          errors.push(`field must be a non-empty string: ${field}`);
        }
      }
      if (info.schema && info.schema !== 'bhfos.build-info/v1') {
        warnings.push(`unexpected schema: ${info.schema}`);
      }
      if ('generatedAt' in info && !isIso(info.generatedAt)) errors.push('generatedAt must be an ISO datetime');
      if ('buildTimestamp' in info && !isIso(info.buildTimestamp)) errors.push('buildTimestamp must be an ISO datetime');

      if (typeof info.commitSha === 'string' && info.commitSha !== UNKNOWN && !/^[0-9a-f]{40}$/i.test(info.commitSha)) {
        errors.push('commitSha must be a 40-char hex SHA or the string "unknown"');
      }
      if (typeof info.mergeSha === 'string' && info.mergeSha !== UNKNOWN && !/^[0-9a-f]{40}$/i.test(info.mergeSha)) {
        errors.push('mergeSha must be a 40-char hex SHA or the string "unknown"');
      }

      if (info.commitSha === UNKNOWN) warnings.push('commitSha is unknown (not a release-grade identity)');
      if (info.mergeSha === UNKNOWN) warnings.push('mergeSha is unknown (expected outside a merge/PR context)');

      if (args['require-release']) {
        if (info.commitSha === UNKNOWN || !/^[0-9a-f]{40}$/i.test(info.commitSha || '')) {
          errors.push('--require-release: commitSha must be a real 40-hex SHA (a deployed SHA must never be fabricated)');
        }
        if (info.frontendAssetVersion === UNKNOWN) {
          errors.push('--require-release: frontendAssetVersion is unknown (build output missing)');
        }
      }
    }
  }

  const result = {
    tool: 'verify-build-info',
    path: path.relative(commandCenterRoot, infoPath).replaceAll('\\', '/'),
    ok: errors.length === 0,
    requireRelease: Boolean(args['require-release']),
    errors,
    warnings,
    info,
  };

  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`[verify-build-info] target: ${result.path}`);
    if (info) {
      console.log(`[verify-build-info] commitSha=${info.commitSha} environment=${info.environment} releaseId=${info.releaseId}`);
    }
    for (const w of warnings) console.log(`  warning: ${w}`);
    for (const e of errors) console.error(`  error: ${e}`);
    console.log(result.ok ? '[verify-build-info] PASSED' : '[verify-build-info] FAILED');
  }

  process.exit(result.ok ? 0 : 1);
}

main();
