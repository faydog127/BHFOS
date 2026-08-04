/**
 * mil-control-plane.test.mjs — negative/positive gates for Phase 2A control plane.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  assertExactMilProjectRef,
  assertSingleMigrationAuthorization,
  assertBuildInfoMatchesStage,
  resolveRolloutStage,
  assertTextHasNoCrmRef,
  assertSingleMilBackendInText,
  collectBackendRefs,
  isUnsafeStalePackageName,
  classifyPackageArtifact,
  classifyEnvFile,
  assertPhase2aCurrentDocsTruth,
  PHASE2A_MIGRATION_A,
  PHASE2A_MIGRATION_B,
  MIL_PRODUCTION_SUPABASE_REF,
  CRM_PRODUCTION_SUPABASE_REF,
  sha256File,
} from '../../tools/mil-control-plane.mjs';
import { assertMilArtifactBackend, TARGETS } from '../../tools/deploy-lib.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const ccRoot = path.resolve(here, '../..');
const repoRoot = path.resolve(ccRoot, '..');

function sha256Buffer(buf) {
  return createHash('sha256').update(buf).digest('hex').toUpperCase();
}

describe('project-ref guards', () => {
  it('refuses missing project ref', () => {
    assert.throws(() => assertExactMilProjectRef(''), /missing/);
  });

  it('refuses wrong project ref', () => {
    assert.throws(() => assertExactMilProjectRef('glkrykpksbsqmmilmjhs'), /must be exactly/);
  });

  it('refuses CRM wwyx… project ref', () => {
    assert.throws(() => assertExactMilProjectRef(CRM_PRODUCTION_SUPABASE_REF), /forbidden CRM/);
  });

  it('accepts exact MIL sdzh… project ref', () => {
    assert.equal(assertExactMilProjectRef(MIL_PRODUCTION_SUPABASE_REF), MIL_PRODUCTION_SUPABASE_REF);
  });

  it('detects multiple backend refs', () => {
    const text = `https://${MIL_PRODUCTION_SUPABASE_REF}.supabase.co https://${CRM_PRODUCTION_SUPABASE_REF}.supabase.co`;
    const refs = collectBackendRefs(text);
    assert.ok(refs.includes(MIL_PRODUCTION_SUPABASE_REF));
    assert.ok(refs.includes(CRM_PRODUCTION_SUPABASE_REF));
    assert.throws(() => assertSingleMilBackendInText(text), /CRM|unexpected/);
  });

  it('refuses text with wwyx present', () => {
    assert.throws(() => assertTextHasNoCrmRef(`x${CRM_PRODUCTION_SUPABASE_REF}y`), /forbidden CRM/);
  });

  it('refuses bundle omitting sdzh…', () => {
    assert.throws(() => assertSingleMilBackendInText('no backend here'), /missing required MIL/);
  });
});

describe('single-migration authorization', () => {
  const sqlA = path.join(ccRoot, 'supabase/migrations/20260802120000_media_intel_phase2a_additive.sql');
  const sqlB = path.join(ccRoot, 'supabase/migrations/20260802130000_media_intel_phase2a_lockdown.sql');

  it('refuses broad push flag path', () => {
    assert.throws(
      () =>
        assertSingleMigrationAuthorization({
          projectRef: MIL_PRODUCTION_SUPABASE_REF,
          migrationVersion: PHASE2A_MIGRATION_A,
          sqlPath: sqlA,
          checksum: sha256File(sqlA),
          allowBroadPush: true,
        }),
      /broad migration push/,
    );
  });

  it('refuses Migration B without explicit authorize', () => {
    assert.throws(
      () =>
        assertSingleMigrationAuthorization({
          projectRef: MIL_PRODUCTION_SUPABASE_REF,
          migrationVersion: PHASE2A_MIGRATION_B,
          sqlPath: sqlB,
          checksum: sha256File(sqlB),
        }),
      /authorize-migration/,
    );
  });

  it('accepts Migration A with matching checksum', () => {
    const meta = assertSingleMigrationAuthorization({
      projectRef: MIL_PRODUCTION_SUPABASE_REF,
      migrationVersion: PHASE2A_MIGRATION_A,
      sqlPath: sqlA,
      checksum: `sha256:${sha256File(sqlA)}`,
    });
    assert.equal(meta.version, PHASE2A_MIGRATION_A);
  });

  it('accepts Migration B only with authorize + checksum', () => {
    const meta = assertSingleMigrationAuthorization({
      projectRef: MIL_PRODUCTION_SUPABASE_REF,
      migrationVersion: PHASE2A_MIGRATION_B,
      sqlPath: sqlB,
      checksum: sha256File(sqlB),
      authorizeMigration: PHASE2A_MIGRATION_B,
    });
    assert.equal(meta.version, PHASE2A_MIGRATION_B);
  });

  it('wrapper CLI refuses missing project ref and CRM ref', () => {
    const script = path.join(ccRoot, 'tools/mil-apply-single-migration.mjs');
    const missing = spawnSync(process.execPath, [script, `--migration-version=${PHASE2A_MIGRATION_A}`], {
      encoding: 'utf8',
    });
    assert.notEqual(missing.status, 0);
    assert.match(missing.stderr, /missing project-ref|ERROR/);

    const crm = spawnSync(
      process.execPath,
      [
        script,
        `--project-ref=${CRM_PRODUCTION_SUPABASE_REF}`,
        `--migration-version=${PHASE2A_MIGRATION_A}`,
        `--sql-path=${sqlA}`,
        `--checksum=${sha256File(sqlA)}`,
      ],
      { encoding: 'utf8' },
    );
    assert.notEqual(crm.status, 0);
    assert.match(crm.stderr, /CRM|ERROR|forbidden/i);
  });
});

describe('rollout-stage metadata', () => {
  it('phase-a pins both schema fields to Migration A', () => {
    const stage = resolveRolloutStage('phase-a');
    assert.equal(stage.schemaAppliedThrough, PHASE2A_MIGRATION_A);
    assert.equal(stage.schemaRequiredThrough, PHASE2A_MIGRATION_A);
    assert.doesNotThrow(() =>
      assertBuildInfoMatchesStage(
        {
          environment: 'mil-production',
          schemaAppliedThrough: PHASE2A_MIGRATION_A,
          schemaRequiredThrough: PHASE2A_MIGRATION_A,
          migrationVersion: PHASE2A_MIGRATION_A,
        },
        stage,
      ),
    );
  });

  it('refuses incorrect migration stage (claims B on phase-a)', () => {
    const stage = resolveRolloutStage('phase-a');
    assert.throws(
      () =>
        assertBuildInfoMatchesStage(
          {
            environment: 'mil-production',
            schemaAppliedThrough: PHASE2A_MIGRATION_B,
            schemaRequiredThrough: PHASE2A_MIGRATION_B,
            migrationVersion: PHASE2A_MIGRATION_B,
          },
          stage,
        ),
      /schemaRequiredThrough|schemaAppliedThrough|Migration B/,
    );
  });

  it('generate-build-info mil-production requires rollout-stage', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mil-bi-'));
    fs.writeFileSync(path.join(tmp, 'index.html'), '<html><head></head><body></body></html>');
    const res = spawnSync(
      process.execPath,
      [path.join(ccRoot, 'tools/generate-build-info.mjs'), `--dist=${tmp}`, '--environment=mil-production'],
      { encoding: 'utf8', cwd: ccRoot },
    );
    assert.notEqual(res.status, 0);
    assert.match(res.stderr, /rollout-stage|ERROR/i);
  });

  it('generate-build-info phase-a does not claim B', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mil-bi-'));
    fs.writeFileSync(path.join(tmp, 'index.html'), '<html><head></head><body></body></html>');
    const out = path.join(tmp, 'build-info.json');
    const res = spawnSync(
      process.execPath,
      [
        path.join(ccRoot, 'tools/generate-build-info.mjs'),
        `--dist=${tmp}`,
        '--environment=mil-production',
        '--rollout-stage=phase-a',
        `--out=${out}`,
      ],
      { encoding: 'utf8', cwd: ccRoot },
    );
    assert.equal(res.status, 0, res.stderr);
    const info = JSON.parse(fs.readFileSync(out, 'utf8'));
    assert.equal(info.schemaAppliedThrough, PHASE2A_MIGRATION_A);
    assert.equal(info.schemaRequiredThrough, PHASE2A_MIGRATION_A);
    assert.equal(info.migrationVersion, PHASE2A_MIGRATION_A);
    assert.equal(info.sourceTipMigrationVersion, PHASE2A_MIGRATION_B);
    assert.notEqual(info.migrationVersion, PHASE2A_MIGRATION_B);
  });
});

describe('artifact backend / secrets / stale packages', () => {
  it('assertMilArtifactBackend refuses missing sdzh and CRM presence', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mil-art-'));
    fs.writeFileSync(path.join(tmp, 'app.js'), 'console.log("no backend")');
    assert.throws(
      () => assertMilArtifactBackend(tmp, TARGETS['mil-production']),
      /missing required MIL/,
    );
    fs.writeFileSync(path.join(tmp, 'app.js'), `const x="${CRM_PRODUCTION_SUPABASE_REF}"`);
    assert.throws(
      () => assertMilArtifactBackend(tmp, TARGETS['mil-production']),
      /CRM backend/,
    );
    fs.writeFileSync(path.join(tmp, 'app.js'), `const x="${MIL_PRODUCTION_SUPABASE_REF}"`);
    assert.doesNotThrow(() => assertMilArtifactBackend(tmp, TARGETS['mil-production']));
  });

  it('marks 5a5653e packages unsafe', () => {
    assert.equal(isUnsafeStalePackageName('mil-production-5a5653e0a24c-20260803T234853Z.zip'), true);
    const c = classifyPackageArtifact('/tmp/mil-production-5a5653e0a24c-20260803T234853Z.zip');
    assert.match(c.classification, /UNSAFE/);
  });

  it('classifies env file with CRM ref as dangerous without returning values', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mil-env-'));
    const envPath = path.join(tmp, '.env');
    fs.writeFileSync(
      envPath,
      `SUPABASE_PROJECT_REF=${CRM_PRODUCTION_SUPABASE_REF}\nSUPABASE_SERVICE_ROLE_KEY=secret-value-not-returned\n`,
    );
    const classified = classifyEnvFile(envPath);
    assert.equal(classified.hasCrmRef, true);
    assert.equal(classified.classification, 'dangerous-crm');
    assert.ok(classified.keys.includes('SUPABASE_PROJECT_REF'));
    assert.ok(!JSON.stringify(classified).includes('secret-value-not-returned'));
  });
});

describe('documentation current-state truth', () => {
  it('IMPLEMENTATION_STATUS Phase 2A current section matches hosted truth markers', () => {
    const doc = fs.readFileSync(
      path.join(ccRoot, 'docs/media-intelligence/IMPLEMENTATION_STATUS.md'),
      'utf8',
    );
    assert.doesNotThrow(() => assertPhase2aCurrentDocsTruth(doc));
    assert.match(doc, /Migration A[^\n]*applied|applied[^\n]*Migration A|A `?20260802120000`?/i);
    assert.match(doc, /edges[^\n]*deployed|seven Phase 2A edge/i);
    assert.match(doc, /Phase 2A frontend[^\n]*not deployed|frontend[^\n]*not deployed/i);
    assert.match(doc, /Migration B[^\n]*absent|B `?20260802130000`?[^\n]*absent/i);
    assert.ok(!/Exact next action:[\s\S]{0,200}wwyxohjnyqnegzbxtuxs/i.test(doc));
  });

  it('PRODUCTION_APPLY_PACKET does not instruct re-applying A as first mutate step blindly', () => {
    const doc = fs.readFileSync(
      path.join(ccRoot, 'docs/media-intelligence/PRODUCTION_APPLY_PACKET.md'),
      'utf8',
    );
    assert.ok(doc.includes(MIL_PRODUCTION_SUPABASE_REF));
    assert.ok(/HISTORICAL|already applied|verify A|A applied/i.test(doc));
    assert.ok(!/^\s*1\.\s*Apply Migration A/m.test(doc) || /verify|already/i.test(doc));
  });
});

describe('package CLI hard failures', () => {
  it('refuses package without project-ref / rollout-stage / expected-sha', () => {
    const script = path.join(ccRoot, 'tools/package-mil-production-archive.mjs');
    const res = spawnSync(process.execPath, [script], { encoding: 'utf8', cwd: ccRoot });
    assert.notEqual(res.status, 0);
    assert.match(res.stderr, /project-ref|ERROR/i);
  });

  it('stage mismatch is hard-fail before package (claims B on phase-a)', () => {
    assert.throws(
      () =>
        assertBuildInfoMatchesStage(
          {
            environment: 'mil-production',
            schemaAppliedThrough: PHASE2A_MIGRATION_B,
            schemaRequiredThrough: PHASE2A_MIGRATION_B,
            migrationVersion: PHASE2A_MIGRATION_B,
          },
          resolveRolloutStage('phase-a'),
        ),
      /schemaRequiredThrough|schemaAppliedThrough|Migration B/,
    );
  });
});

void sha256Buffer;
void repoRoot;
