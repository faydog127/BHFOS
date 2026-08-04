#!/usr/bin/env node
/**
 * mil-apply-single-migration.mjs
 *
 * Approved Phase 2A single-migration executor guard.
 *
 * Hard rules:
 *   - Exact --project-ref=sdzhdupekcnekesbtxsl required
 *   - Exact --migration-version + --sql-path + --checksum required
 *   - Refuses CRM ref / wwyx… anywhere in args
 *   - Refuses broad push / include-all
 *   - Migration B requires --authorize-migration=20260802130000
 *   - Default mode is validate-only
 *   - --execute applies ONLY against LOCAL_DB_URL (disposable local DB)
 *   - Never runs `supabase db push`
 *
 * Usage (validate):
 *   node tools/mil-apply-single-migration.mjs \
 *     --project-ref=sdzhdupekcnekesbtxsl \
 *     --migration-version=20260802120000 \
 *     --sql-path=supabase/migrations/20260802120000_media_intel_phase2a_additive.sql \
 *     --checksum=sha256:<hex>
 *
 * Usage (local apply):
 *   LOCAL_DB_URL=postgresql://… node tools/mil-apply-single-migration.mjs … --execute --mode=apply-local
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  parseCliArgs,
  assertSingleMigrationAuthorization,
  assertTextHasNoCrmRef,
  assertExactMilProjectRef,
  PHASE2A_MIGRATION_A,
  PHASE2A_MIGRATION_B,
  MIL_PRODUCTION_SUPABASE_REF,
} from './mil-control-plane.mjs';
import { commandCenterRoot } from './deploy-lib.mjs';

const toolsDir = path.dirname(fileURLToPath(import.meta.url));

function resolveSqlPath(raw) {
  if (!raw) return '';
  if (path.isAbsolute(raw)) return raw;
  const fromCc = path.resolve(commandCenterRoot, raw);
  if (fs.existsSync(fromCc)) return fromCc;
  return path.resolve(toolsDir, '..', raw);
}

function psqlAt(dbUrl, sql) {
  return execFileSync('psql', [dbUrl, '-v', 'ON_ERROR_STOP=1', '-At', '-c', sql], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
    .toString()
    .trim();
}

function readLedgerVersions(dbUrl) {
  try {
    const out = psqlAt(
      dbUrl,
      `select version from supabase_migrations.schema_migrations order by version;`,
    );
    return out
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function phase2aObjectPresent(dbUrl) {
  return psqlAt(dbUrl, `select coalesce(to_regclass('public.mil_audit_outbox')::text, '');`) === 'mil_audit_outbox';
}

function applySqlFile(dbUrl, sqlPath) {
  execFileSync('psql', [dbUrl, '-v', 'ON_ERROR_STOP=1', '-f', sqlPath], {
    stdio: 'inherit',
  });
}

function main() {
  const args = parseCliArgs(process.argv.slice(2));
  for (const [k, v] of Object.entries(args)) {
    assertTextHasNoCrmRef(`${k}=${v}`, { label: `cli:${k}` });
  }

  if (args['db-push'] || args['include-all'] || args.push) {
    throw new Error(
      'MIL apply refused: broad migration push flags are prohibited. Use single-migration mode only.',
    );
  }

  const projectRef = assertExactMilProjectRef(args['project-ref']);
  const version = String(args['migration-version'] || '').trim();
  const sqlPath = resolveSqlPath(args['sql-path']);
  const checksum = args.checksum;
  const mode = String(args.mode || 'validate').trim();
  const execute = Boolean(args.execute);

  const meta = assertSingleMigrationAuthorization({
    projectRef,
    migrationVersion: version,
    sqlPath,
    checksum,
    authorizeMigration: args['authorize-migration'],
    allowBroadPush: false,
  });

  const report = {
    ok: true,
    mode,
    execute: false,
    projectRef,
    migrationVersion: version,
    sqlPath: meta.sqlPath,
    sha256: meta.sha256,
    note:
      version === PHASE2A_MIGRATION_A
        ? 'Migration A path validated'
        : 'Migration B path validated with explicit authorization',
  };

  if (!execute) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  if (mode !== 'apply-local') {
    throw new Error(
      'MIL apply refused: --execute only supports --mode=apply-local (disposable local DB). Hosted apply is not enabled in this wrapper.',
    );
  }

  const dbUrl = process.env.LOCAL_DB_URL || '';
  if (!dbUrl) {
    throw new Error('MIL apply refused: LOCAL_DB_URL required for --mode=apply-local');
  }
  assertTextHasNoCrmRef(dbUrl, { label: 'LOCAL_DB_URL' });
  if (!/127\.0\.0\.1|localhost/i.test(dbUrl)) {
    throw new Error('MIL apply refused: LOCAL_DB_URL must point at localhost/127.0.0.1');
  }

  const beforeLedger = readLedgerVersions(dbUrl);
  const beforeObjects = phase2aObjectPresent(dbUrl);
  if (version === PHASE2A_MIGRATION_B && !beforeObjects && !beforeLedger.includes(PHASE2A_MIGRATION_A)) {
    throw new Error(
      `MIL apply refused: Migration B requires Migration A (${PHASE2A_MIGRATION_A}) already present locally`,
    );
  }
  if (beforeLedger.includes(version)) {
    throw new Error(`MIL apply refused: migration ${version} already present in local ledger`);
  }

  applySqlFile(dbUrl, meta.sqlPath);

  const afterLedger = readLedgerVersions(dbUrl);
  const afterObjects = phase2aObjectPresent(dbUrl);
  if (version === PHASE2A_MIGRATION_A && !afterObjects) {
    throw new Error('MIL apply refused: post-apply verification failed (mil_audit_outbox missing)');
  }
  if (version === PHASE2A_MIGRATION_A && afterLedger.includes(PHASE2A_MIGRATION_B)) {
    throw new Error('MIL apply refused: applying A unexpectedly resulted in B present in ledger');
  }

  report.execute = true;
  report.ledgerBefore = beforeLedger;
  report.ledgerAfter = afterLedger;
  report.phase2aObjectsBefore = beforeObjects;
  report.phase2aObjectsAfter = afterObjects;
  report.milTarget = MIL_PRODUCTION_SUPABASE_REF;
  console.log(JSON.stringify(report, null, 2));
}

try {
  main();
} catch (err) {
  console.error(`[mil-apply-single-migration] ERROR: ${err && err.message ? err.message : err}`);
  process.exit(1);
}
