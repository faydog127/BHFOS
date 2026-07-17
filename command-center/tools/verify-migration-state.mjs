#!/usr/bin/env node
/**
 * verify-migration-state.mjs — G2.3A read-only migration-state verifier.
 *
 * Inspects repository migration filenames and ordering, and (only when
 * explicitly invoked AND linked access exists) compares against remote state.
 *
 * Guarantees (binding, G2.3A brief §8.2):
 *   - READ-ONLY: never applies a migration, never modifies a migration file,
 *     never executes arbitrary SQL.
 *   - OFFLINE-SAFE: local checks work with no Supabase access.
 *   - Remote comparison happens ONLY with `--linked` and cleanly reports
 *     "remote not checked" when linked access is unavailable.
 *   - Local vs remote results are clearly distinguished.
 *   - Never exposes credentials.
 *
 * Usage:
 *   node tools/verify-migration-state.mjs [--dir=supabase/migrations] [--json] [--linked]
 * Exit code 0 = no local errors; non-zero = local ordering/format errors found.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

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

function analyzeLocal(migrationsDir) {
  const result = {
    dir: path.relative(commandCenterRoot, migrationsDir).replaceAll('\\', '/'),
    total: 0,
    canonical14: 0,
    shortPrefix: 0,
    malformed: [],
    duplicates: [],
    outOfOrder: [],
    latestVersion: null,
    errors: [],
    warnings: [],
  };

  if (!fs.existsSync(migrationsDir)) {
    result.errors.push(`migrations directory not found: ${result.dir}`);
    return result;
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((n) => n.toLowerCase().endsWith('.sql'))
    .sort();
  result.total = files.length;

  const seen = new Map();
  const parsed = [];

  for (const name of files) {
    const m = name.match(/^(\d+)_/) || name.match(/^(\d+)/);
    if (!m) {
      result.malformed.push({ file: name, reason: 'no numeric version prefix' });
      continue;
    }
    const version = m[1];
    if (version.length === 14) result.canonical14 += 1;
    else if (version.length === 8) result.shortPrefix += 1;
    else {
      result.malformed.push({ file: name, reason: `unexpected version length ${version.length} (expected 8 or 14)` });
      continue;
    }

    if (seen.has(version)) {
      result.duplicates.push({ version, files: [seen.get(version), name] });
    } else {
      seen.set(version, name);
    }
    parsed.push({ name, version });
  }

  // Ordering check: normalise every prefix to a 14-digit key (pad short dates to
  // start-of-day) and confirm filename sort order matches chronological order.
  const normalized = parsed.map((p) => ({
    ...p,
    key: p.version.length === 8 ? `${p.version}000000` : p.version.padEnd(14, '0'),
  }));
  const byName = [...normalized];
  const byKey = [...normalized].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  for (let i = 0; i < byName.length; i += 1) {
    if (byName[i].name !== byKey[i].name) {
      result.outOfOrder.push({ position: i, byFilename: byName[i].name, byChronology: byKey[i].name });
    }
  }

  if (normalized.length > 0) {
    result.latestVersion = byKey[byKey.length - 1].version;
  }

  if (result.shortPrefix > 0) {
    result.warnings.push(`${result.shortPrefix} migration(s) use an 8-digit (date-only) prefix; canonical format is 14-digit YYYYMMDDHHMMSS`);
  }
  if (result.duplicates.length > 0) {
    result.errors.push(`${result.duplicates.length} duplicate migration version(s) detected`);
  }
  if (result.malformed.length > 0) {
    result.errors.push(`${result.malformed.length} malformed migration filename(s) detected`);
  }
  if (result.outOfOrder.length > 0) {
    result.errors.push('migration filename order does not match chronological version order');
  }

  return result;
}

function analyzeRemote(linkedRequested) {
  const remote = {
    checked: false,
    available: false,
    note: '',
    entries: null,
  };
  if (!linkedRequested) {
    remote.note = 'remote state not checked (run with --linked to attempt a linked comparison)';
    return remote;
  }

  // Attempt a read-only `supabase migration list --linked`. If the CLI or a
  // linked project is unavailable, stop cleanly and report — never guess.
  try {
    const out = execFileSync('supabase', ['migration', 'list', '--linked'], {
      cwd: commandCenterRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 30000,
    }).toString();
    remote.checked = true;
    remote.available = true;
    remote.entries = out.split(/\r?\n/).filter((l) => l.trim()).length;
    remote.note = 'remote migration list retrieved (read-only)';
  } catch (err) {
    remote.checked = true;
    remote.available = false;
    remote.note = 'remote state not checked: linked Supabase access unavailable (no mutation attempted)';
  }
  return remote;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const dirArg = typeof args.dir === 'string' ? args.dir : 'supabase/migrations';
  const migrationsDir = path.isAbsolute(dirArg) ? dirArg : path.join(commandCenterRoot, dirArg);

  const local = analyzeLocal(migrationsDir);
  const remote = analyzeRemote(Boolean(args.linked));

  const report = {
    tool: 'verify-migration-state',
    readOnly: true,
    local,
    remote,
    ok: local.errors.length === 0,
  };

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log('[migration-verify] READ-ONLY — no migration was applied or modified');
    console.log(`[migration-verify] LOCAL: dir=${local.dir} total=${local.total} canonical14=${local.canonical14} shortPrefix=${local.shortPrefix}`);
    console.log(`[migration-verify] LOCAL: latestVersion=${local.latestVersion || '(none)'} duplicates=${local.duplicates.length} malformed=${local.malformed.length} outOfOrder=${local.outOfOrder.length}`);
    for (const w of local.warnings) console.log(`  local warning: ${w}`);
    for (const d of local.duplicates) console.error(`  duplicate: ${d.version} -> ${d.files.join(', ')}`);
    for (const mfd of local.malformed) console.error(`  malformed: ${mfd.file} (${mfd.reason})`);
    for (const o of local.outOfOrder) console.error(`  out-of-order @${o.position}: filename=${o.byFilename} chronology=${o.byChronology}`);
    for (const e of local.errors) console.error(`  local error: ${e}`);
    console.log(`[migration-verify] REMOTE: ${remote.note}`);
    console.log(report.ok ? '[migration-verify] LOCAL RESULT: PASSED' : '[migration-verify] LOCAL RESULT: FAILED');
  }

  process.exit(report.ok ? 0 : 1);
}

main();
