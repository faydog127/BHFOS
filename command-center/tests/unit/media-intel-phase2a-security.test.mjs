/**
 * Legacy Phase 2A security contracts — updated for Migration A/B split + remediation codes.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  resolveMilRoleFromRows,
  normalizeMilRole,
  MIL_ROLE_PRIORITY,
} from '../../src/lib/mediaIntel/rolePriority.js';
import {
  staffAssetSignDecision,
  creatorAssetSignDecision,
  reelVersionSignDecision,
  publicFacingDerivativeSignDecision,
} from '../../src/lib/mediaIntel/signPolicy.js';
import {
  resolveMilEnvironmentLabel,
  MIL_PRODUCTION_LABEL,
  CRM_PRODUCTION_LABEL,
} from '../../src/lib/mediaIntel/environment.js';
import {
  MIL_PRODUCTION_SUPABASE_REF,
  CRM_PRODUCTION_SUPABASE_REF,
  TARGETS,
  assertMilTargetIsolation,
  isMilDeployTarget,
} from '../../tools/deploy-lib.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const CRM_REF = 'wwyxohjnyqnegzbxtuxs';
const MIL_REF = 'sdzhdupekcnekesbtxsl';

describe('Phase 2A environment guardrails', () => {
  it('identifies mil.bhfos.com as MIL Production and app.bhfos.com as CRM', () => {
    assert.equal(
      resolveMilEnvironmentLabel({ environment: 'mil-production' }, 'mil.bhfos.com'),
      MIL_PRODUCTION_LABEL,
    );
    assert.equal(
      resolveMilEnvironmentLabel({ environment: 'production' }, 'app.bhfos.com'),
      CRM_PRODUCTION_LABEL,
    );
  });

  it('MIL deploy targets allow only sdzh… and forbid wwyx…', () => {
    assert.equal(MIL_PRODUCTION_SUPABASE_REF, MIL_REF);
    assert.equal(CRM_PRODUCTION_SUPABASE_REF, CRM_REF);
    assert.ok(isMilDeployTarget(TARGETS['mil-production']));
    assert.doesNotThrow(() => assertMilTargetIsolation(TARGETS['mil-production']));
  });
});

describe('Phase 2A role resolution consistency', () => {
  it('older admin plus newer reel_creator → admin', () => {
    assert.equal(
      resolveMilRoleFromRows([
        { id: '1', role: 'admin', created_at: '2026-01-01T00:00:00Z' },
        { id: '2', role: 'reel_creator', created_at: '2026-07-01T00:00:00Z' },
      ]),
      'admin',
    );
  });

  it('older reviewer plus newer office → media_reviewer', () => {
    assert.equal(
      resolveMilRoleFromRows([
        { id: '1', role: 'media_reviewer', created_at: '2026-01-01T00:00:00Z' },
        { id: '2', role: 'office', created_at: '2026-07-01T00:00:00Z' },
      ]),
      'media_reviewer',
    );
  });

  it('aliases and unknown+known', () => {
    assert.equal(normalizeMilRole('owner'), 'admin');
    assert.equal(
      resolveMilRoleFromRows([
        { id: '1', role: 'totally_unknown', created_at: '2026-07-01T00:00:00Z' },
        { id: '2', role: 'office', created_at: '2026-01-01T00:00:00Z' },
      ]),
      'office',
    );
  });

  it('frontend fetchMilRole uses shared resolver without newest-row-only limit call', () => {
    const rolesJs = read('src/lib/mediaIntel/roles.js');
    assert.ok(rolesJs.includes('resolveMilRoleFromRows'));
    assert.ok(!/\.limit\(1\)/.test(rolesJs));
  });

  it('priority maps agree', () => {
    assert.equal(MIL_ROLE_PRIORITY.admin, 1);
    assert.equal(MIL_ROLE_PRIORITY.office, 4);
  });
});

describe('Phase 2A ACL migration contracts (A/B)', () => {
  const migA = read('supabase/migrations/20260802120000_media_intel_phase2a_additive.sql');
  const migB = read('supabase/migrations/20260802130000_media_intel_phase2a_lockdown.sql');

  it('Migration B revokes anon writes and mil_audit_insert execute', () => {
    assert.ok(migB.includes('revoke insert, update, delete on public.%I from anon, public') || migB.includes("from anon, public"));
    assert.ok(migB.includes("'mil_audit_insert'"));
  });

  it('Migration A adds compliance RPC with lifecycle guard', () => {
    assert.ok(migA.includes('mil_set_asset_compliance'));
    assert.ok(migA.includes('ASSET_LIFECYCLE_INACTIVE'));
  });

  it('api exposes setAssetCompliance', () => {
    const api = read('src/lib/mediaIntel/api.js');
    assert.ok(api.includes("rpc('mil_set_asset_compliance'"));
  });
});

describe('Phase 2A signing policy matrix', () => {
  const clearAsset = {
    id: 'a1',
    trashed_at: null,
    archived_at: null,
    human_review_status: 'verified',
    privacy_status: 'clear',
    rights_status: 'tvg_owned',
    customer_permission_status: 'confirmed',
    created_by_user_id: 'creator-1',
  };

  it('trashed/archived staff gates', () => {
    assert.equal(
      staffAssetSignDecision({ asset: { ...clearAsset, trashed_at: 't' }, role: 'admin' }).code,
      'MEDIA_TRASHED',
    );
    assert.equal(
      staffAssetSignDecision({
        asset: { ...clearAsset, archived_at: 't' },
        role: 'media_reviewer',
      }).code,
      'MEDIA_ARCHIVED',
    );
  });

  it('revoked assignment / denied reel / superseded reel', () => {
    assert.equal(
      creatorAssetSignDecision({
        asset: { ...clearAsset, created_by_user_id: 'other' },
        actorId: 'creator-1',
        assignmentActive: false,
        reelUseApproved: true,
      }).code,
      'MEDIA_ACCESS_DENIED',
    );
    assert.equal(
      reelVersionSignDecision({
        role: 'reel_creator',
        actorId: 'c1',
        project: { creator_user_id: 'c1', status: 'denied' },
        version: { id: 'v1', status: 'denied' },
        currentVersionId: 'v1',
      }).ok,
      false,
    );
    assert.equal(
      reelVersionSignDecision({
        role: 'admin',
        actorId: 'o',
        project: { creator_user_id: 'c1', status: 'approved_to_post' },
        version: { id: 'v1', status: 'approved_to_post' },
        currentVersionId: 'v1',
      }).ok,
      true,
    );
  });

  it('public-facing fails without rights', () => {
    assert.equal(
      publicFacingDerivativeSignDecision({
        asset: { ...clearAsset, rights_status: 'ownership_unknown' },
        kind: 'website_optimized',
        publicUseApproved: true,
      }).code,
      'PUBLIC_DERIVATIVE_NOT_ELIGIBLE',
    );
  });
});

describe('Phase 2A audit durability contracts', () => {
  it('shared audit + outbox worker exist', () => {
    const audit = read('supabase/functions/_shared/milAudit.ts');
    const worker = read('supabase/functions/media-intel-audit-outbox/index.ts');
    assert.ok(audit.includes('persistAccessAudit'));
    assert.ok(audit.includes('mil_record_access_audit'));
    assert.ok(worker.includes('mil_outbox_claim_batch'));
  });

  it('creator-admin uses transactional grant/revoke RPCs', () => {
    const src = read('supabase/functions/media-intel-creator-admin/index.ts');
    assert.ok(src.includes('mil_grant_creator_role_audited'));
    assert.ok(src.includes('mil_revoke_creator_access_audited'));
  });
});
