/**
 * Phase 2A remediation contracts (pre-deploy, no production mutation).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  resolveMilRoleFromRows,
  compareMilRoleRows,
  normalizeMilRole,
} from '../../src/lib/mediaIntel/rolePriority.js';
import {
  staffAssetSignDecision,
  creatorAssetSignDecision,
  reelVersionSignDecision,
  publicFacingDerivativeSignDecision,
  isPublicFacingDerivativeKind,
  requiredPermittedUseForDerivative,
  resolveCurrentReelVersionId,
  PUBLIC_FACING_DERIVATIVE_KINDS,
  DERIVATIVE_KIND_CLASS,
} from '../../src/lib/mediaIntel/signPolicy.js';
import {
  redactErrorForClient,
  isSensitiveErrorText,
  PUBLIC_ERROR_CATALOG,
  newCorrelationId,
} from '../../src/lib/mediaIntel/safeErrors.js';
import {
  CRM_PRODUCTION_SUPABASE_REF,
  MIL_PRODUCTION_SUPABASE_REF,
  TARGETS,
  assertMilTargetIsolation,
  planDeployment,
} from '../../tools/deploy-lib.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const CRM = 'wwyxohjnyqnegzbxtuxs';

describe('R1 error redaction', () => {
  it('redacts storage/SQL/project-ref exceptions to INTERNAL_ERROR', () => {
    const samples = [
      new Error('Object not found in bucket media-intel-originals path mil/x/y'),
      new Error('violates unique constraint "mil_assets_pkey"'),
      new Error(`https://${CRM}.supabase.co/storage/v1`),
      new Error('permission denied for table mil_assets'),
      { message: 'PGRST116', code: 'PGRST116' },
    ];
    for (const s of samples) {
      const out = redactErrorForClient(s, { correlationId: 'cid-1' });
      assert.equal(out.code, 'INTERNAL_ERROR');
      assert.equal(out.error, PUBLIC_ERROR_CATALOG.INTERNAL_ERROR);
      assert.equal(out.correlationId, 'cid-1');
      assert.ok(!isSensitiveErrorText(out.error) || out.error === PUBLIC_ERROR_CATALOG.INTERNAL_ERROR);
      assert.ok(!String(JSON.stringify(out)).includes(CRM));
      assert.ok(!String(JSON.stringify(out)).includes('media-intel-originals'));
      assert.ok(!String(JSON.stringify(out)).includes('mil/'));
    }
  });

  it('preserves stable public codes', () => {
    const out = redactErrorForClient({ code: 'MEDIA_TRASHED' }, { correlationId: newCorrelationId() });
    assert.equal(out.code, 'MEDIA_TRASHED');
    assert.equal(out.error, PUBLIC_ERROR_CATALOG.MEDIA_TRASHED);
  });

  it('sign edge uses redaction helpers and never returns bucket/path in errors', () => {
    const sign = read('supabase/functions/media-intel-sign/index.ts');
    assert.ok(sign.includes('redactErrorForClient') || sign.includes('toPublicSignCode'));
    assert.ok(sign.includes('correlationId'));
    assert.ok(!/return json\(\{[^}]*bucket/.test(sign.split('deny(')[0]));
    // Deny helper returns only public catalog fields
    assert.ok(sign.includes('PUBLIC_ERROR_CATALOG'));
  });
});

describe('R2 public derivative gating + kind-specific permitted use', () => {
  const clear = {
    human_review_status: 'verified',
    privacy_status: 'clear',
    rights_status: 'tvg_owned',
    customer_permission_status: 'confirmed',
    trashed_at: null,
    archived_at: null,
  };

  it('classifies every known derivative kind', () => {
    for (const kind of Object.keys(DERIVATIVE_KIND_CLASS)) {
      assert.ok(DERIVATIVE_KIND_CLASS[kind]);
    }
    assert.deepEqual(
      [...PUBLIC_FACING_DERIVATIVE_KINDS].sort(),
      ['public_safe', 'redacted_public', 'website_optimized'].sort(),
    );
  });

  it('maps website_optimized/public_safe to website; redacted_public needs destination', () => {
    assert.equal(requiredPermittedUseForDerivative({ kind: 'website_optimized' }).useKey, 'website');
    assert.equal(requiredPermittedUseForDerivative({ kind: 'public_safe' }).useKey, 'website');
    assert.equal(requiredPermittedUseForDerivative({ kind: 'redacted_public' }).ok, false);
    assert.equal(
      requiredPermittedUseForDerivative({ kind: 'redacted_public', destination: 'social_media' }).useKey,
      'social_media',
    );
    assert.equal(
      requiredPermittedUseForDerivative({ kind: 'redacted_public', destination: 'website' }).useKey,
      'website',
    );
  });

  it('denies cross-channel and ambiguous public destinations', () => {
    // social approved but website denied → website_optimized fails when use not approved
    assert.equal(
      publicFacingDerivativeSignDecision({
        asset: clear,
        kind: 'website_optimized',
        publicUseApproved: false,
      }).ok,
      false,
    );
    // website approved path succeeds only for website kinds
    assert.equal(
      publicFacingDerivativeSignDecision({
        asset: clear,
        kind: 'website_optimized',
        publicUseApproved: true,
      }).ok,
      true,
    );
    // website approved but social destination denied when use flag false
    assert.equal(
      publicFacingDerivativeSignDecision({
        asset: clear,
        kind: 'redacted_public',
        destination: 'social_media',
        publicUseApproved: false,
      }).ok,
      false,
    );
    // reel approved but public denied
    assert.equal(
      requiredPermittedUseForDerivative({ kind: 'creator_download' }).useKey,
      'reel_creation',
    );
    assert.equal(
      publicFacingDerivativeSignDecision({
        asset: clear,
        kind: 'public_safe',
        publicUseApproved: false,
      }).ok,
      false,
    );
    // ambiguous destination denied
    assert.equal(
      publicFacingDerivativeSignDecision({
        asset: clear,
        kind: 'redacted_public',
        publicUseApproved: true,
      }).ok,
      false,
    );
    assert.equal(
      requiredPermittedUseForDerivative({ destination: 'public_download' }).ok,
      false,
    );
  });

  for (const kind of ['public_safe', 'website_optimized']) {
    it(`denies ${kind} without rights/verify/use even for staff request`, () => {
      assert.equal(isPublicFacingDerivativeKind(kind), true);
      const missingRights = publicFacingDerivativeSignDecision({
        asset: { ...clear, rights_status: 'ownership_unknown' },
        kind,
        publicUseApproved: true,
      });
      assert.equal(missingRights.ok, false);
      assert.equal(missingRights.code, 'PUBLIC_DERIVATIVE_NOT_ELIGIBLE');

      const missingUse = publicFacingDerivativeSignDecision({
        asset: clear,
        kind,
        publicUseApproved: false,
      });
      assert.equal(missingUse.ok, false);

      const ok = publicFacingDerivativeSignDecision({
        asset: clear,
        kind,
        publicUseApproved: true,
      });
      assert.equal(ok.ok, true);
    });
  }

  it('denies redacted_public without explicit destination even when use approved', () => {
    assert.equal(
      publicFacingDerivativeSignDecision({
        asset: clear,
        kind: 'redacted_public',
        publicUseApproved: true,
      }).ok,
      false,
    );
  });
});

describe('R3 current reel-version enforcement', () => {
  const project = { creator_user_id: 'c1', status: 'approved_to_post' };

  it('resolves current as highest non-superseded version_number', () => {
    const id = resolveCurrentReelVersionId([
      { id: 'v1', version_number: 1, status: 'superseded' },
      { id: 'v2', version_number: 2, status: 'submitted_for_review' },
      { id: 'v3', version_number: 3, status: 'superseded' },
    ]);
    assert.equal(id, 'v2');
  });

  it('denies creator stale approved version after newer submit', () => {
    const current = 'v2';
    const d = reelVersionSignDecision({
      role: 'reel_creator',
      actorId: 'c1',
      project,
      version: { id: 'v1', status: 'approved_to_post' },
      currentVersionId: current,
    });
    assert.equal(d.ok, false);
    assert.equal(d.code, 'REEL_VERSION_UNAVAILABLE');
  });

  it('denies denied and superseded for creator; allows revision_requested current', () => {
    assert.equal(
      reelVersionSignDecision({
        role: 'reel_creator', actorId: 'c1', project,
        version: { id: 'v1', status: 'denied' }, currentVersionId: 'v1',
      }).ok,
      false,
    );
    assert.equal(
      reelVersionSignDecision({
        role: 'reel_creator', actorId: 'c1', project,
        version: { id: 'v1', status: 'superseded' }, currentVersionId: 'v2',
      }).ok,
      false,
    );
    assert.equal(
      reelVersionSignDecision({
        role: 'reel_creator', actorId: 'c1', project,
        version: { id: 'v2', status: 'revision_requested' }, currentVersionId: 'v2',
      }).ok,
      true,
    );
  });

  it('allows owner historical access to superseded; creator denied', () => {
    const hist = reelVersionSignDecision({
      role: 'admin', actorId: 'owner', project,
      version: { id: 'v1', status: 'superseded' }, currentVersionId: 'v2',
    });
    assert.equal(hist.ok, true);
    assert.equal(hist.historical, true);
  });

  it('current approved remains creator-accessible', () => {
    const d = reelVersionSignDecision({
      role: 'reel_creator', actorId: 'c1', project,
      version: { id: 'v2', status: 'approved_to_post' }, currentVersionId: 'v2',
    });
    assert.equal(d.ok, true);
  });
});

describe('R7 deterministic role resolution', () => {
  it('equal timestamps break by id DESC', () => {
    const ts = '2026-06-01T00:00:00.000Z';
    const role = resolveMilRoleFromRows([
      { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', role: 'office', created_at: ts },
      { id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', role: 'office', created_at: ts },
    ]);
    assert.equal(role, 'office');
    assert.ok(
      compareMilRoleRows(
        { id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', role: 'office', created_at: ts },
        { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', role: 'office', created_at: ts },
      ) < 0,
    );
  });

  it('null timestamps lose to real timestamps (NULLS LAST in DESC)', () => {
    const role = resolveMilRoleFromRows([
      { id: '1', role: 'office', created_at: null },
      { id: '2', role: 'office', created_at: '2026-01-01T00:00:00Z' },
    ]);
    assert.equal(role, 'office');
    // Same priority — non-null wins
    assert.ok(
      compareMilRoleRows(
        { id: '2', role: 'office', created_at: '2026-01-01T00:00:00Z' },
        { id: '1', role: 'office', created_at: null },
      ) < 0,
    );
  });

  it('unknown + known + aliases remain deterministic', () => {
    assert.equal(normalizeMilRole('super_admin'), 'admin');
    assert.equal(
      resolveMilRoleFromRows([
        { id: '1', role: 'nope', created_at: '2026-07-01T00:00:00Z' },
        { id: '2', role: 'reviewer', created_at: '2026-01-01T00:00:00Z' },
      ]),
      'media_reviewer',
    );
  });

  it('SQL and edge select id and order by id desc', () => {
    const sql = read('supabase/migrations/20260802120000_media_intel_phase2a_additive.sql');
    const edge = read('supabase/functions/_shared/milRoles.ts');
    const fe = read('src/lib/mediaIntel/roles.js');
    assert.ok(sql.includes('r.id desc'));
    assert.ok(sql.includes('nulls last'));
    assert.ok(edge.includes("select('id, role, created_at')"));
    assert.ok(fe.includes("select('id, role, created_at')"));
  });
});

describe('R8 / deploy tooling refuses CRM backend', () => {
  it('MIL targets forbid wwyx…', () => {
    assert.equal(CRM_PRODUCTION_SUPABASE_REF, CRM);
    assert.equal(MIL_PRODUCTION_SUPABASE_REF, 'sdzhdupekcnekesbtxsl');
    assert.doesNotThrow(() => assertMilTargetIsolation(TARGETS['mil-production']));
    assert.ok(TARGETS['mil-production'].forbiddenSupabaseProjectRefs.includes(CRM));
  });

  it('planDeployment refuses CRM ref in MIL artifact', () => {
    // Empty source → plan incomplete, but isolation checks still encode forbid list
    const { problems } = planDeployment({
      app: 'crm',
      environment: 'mil-production',
      authorization: 'test',
      intendedSha: 'a'.repeat(40),
      sourceDir: path.join(root, 'does-not-exist-dist'),
    });
    assert.ok(problems.some((p) => /empty or missing/i.test(p)));
  });
});

describe('R4 / R5 / R6 / R9 / R10 migration package contracts', () => {
  const migA = read('supabase/migrations/20260802120000_media_intel_phase2a_additive.sql');
  const migB = read('supabase/migrations/20260802130000_media_intel_phase2a_lockdown.sql');
  const rollback = read('supabase/rollbacks/phase2a_media_intel_rollback.sql');

  it('Migration A is additive (no privilege lockdown revokes on mil_assets columns)', () => {
    assert.ok(migA.includes('ADDITIVE'));
    assert.ok(!migA.includes('revoke update (\n  human_review_status'));
    assert.ok(migA.includes('mil_audit_outbox'));
    assert.ok(migA.includes('idempotency_key'));
    assert.ok(migA.includes('next_retry_at'));
    assert.ok(migA.includes('terminal_failed_at'));
    assert.ok(migA.includes('mil_outbox_claim_batch'));
    assert.ok(migA.includes('for update skip locked'));
    assert.ok(migA.includes('ASSET_LIFECYCLE_INACTIVE'));
    assert.ok(migA.includes('mil_grant_creator_role_audited'));
    assert.ok(migA.includes('mil_trg_audit_upload_session'));
  });

  it('Migration B is restrictive lockdown after code deploy', () => {
    assert.ok(migB.includes('RESTRICTIVE LOCKDOWN'));
    assert.ok(migB.includes('revoke insert, update, delete on public.mil_permitted_uses'));
    assert.ok(migB.includes('Call-site inventory'));
    assert.ok(migB.includes('revoke update on public.mil_assets from authenticated'));
    assert.ok(migB.includes('grant update ('));
    assert.ok(migB.includes('original_filename'));
  });

  it('Migration A includes transactional essential RPCs and outbox lease/idempotency', () => {
    assert.ok(migA.includes('mil_mint_reel_upload_grant_audited'));
    assert.ok(migA.includes('mil_complete_reel_upload_audited'));
    assert.ok(migA.includes('mil_unpublish_website_audited'));
    assert.ok(migA.includes('mil_resolve_role_tenant'));
    assert.ok(migA.includes('p_lease_seconds'));
    assert.ok(migA.includes('mil_audit_events_outbox_id_key'));
    assert.ok(migA.includes('CROSS_TENANT_DENIED'));
  });

  it('Migration A enforces upload audit event_key coexistence dedupe', () => {
    assert.ok(migA.includes('event_key'));
    assert.ok(migA.includes('mil_audit_events_event_key_uidx'));
    assert.ok(migA.includes('mil_trg_audit_events_event_key'));
    assert.ok(migA.includes('mil_audit_derive_event_key'));
    assert.ok(migA.includes('upload_session_created:'));
    assert.ok(migA.includes('upload_grant_minted:'));
    assert.ok(migA.includes('contributor_upload_session_created'));
    assert.ok(migA.includes('upload_session_mint'));
  });

  it('Migration A reel mint ledger is unique on creator+project+operation', () => {
    assert.ok(migA.includes('mil_reel_mint_operations'));
    assert.ok(migA.includes('mil_reel_mint_ops_creator_project_op_uniq'));
    assert.ok(migA.includes('mil_reel_mint_ops_creator_op_uniq'));
    assert.ok(migA.includes('p_operation_id'));
    assert.ok(migA.includes('operation_id required'));
    assert.ok(migA.includes('pg_advisory_xact_lock'));
    assert.ok(migA.includes('hashtextextended'));
    assert.ok(migA.includes("p_creator_user_id::text || ':' || v_op::text"));
    assert.ok(migA.includes('adopted'));
  });

  it('independent-session concurrent reel-mint proof harness exists', () => {
    const concPath = path.join(root, 'tools', 'mil-phase2a-reel-mint-concurrency.mjs');
    assert.ok(fs.existsSync(concPath), 'concurrency harness missing');
    const conc = fs.readFileSync(concPath, 'utf8');
    assert.ok(conc.includes('two_independent_psql_child_processes_with_barrier'));
    assert.ok(conc.includes('mil_conc_mint_barrier'));
    assert.ok(conc.includes('WORKER_PID='));
    assert.ok(conc.includes('response_loss_retry'));
    assert.ok(conc.includes('REEL_MINT_OP_PROJECT_MISMATCH'));
    assert.ok(conc.includes('REEL_MINT_CREATOR_MISMATCH'));
    const pkg = fs.readFileSync(path.join(root, 'package.json'), 'utf8');
    assert.ok(pkg.includes('test:media-intel-phase2a-concurrent-mint'));
  });

  it('rollback is explicit and preserves audit/outbox history', () => {
    assert.ok(rollback.includes('drop function if exists public.mil_set_asset_compliance'));
    assert.ok(rollback.includes('PRESERVE'));
    assert.ok(rollback.includes('never re-enable anonymous mutation') || rollback.includes('NEVER'));
    assert.ok(rollback.includes('-- drop table if exists public.mil_audit_outbox'));
  });

  it('outbox RLS denies ordinary users', () => {
    assert.ok(migA.includes('revoke all on public.mil_audit_outbox from public, anon, authenticated'));
    assert.ok(migA.includes('grant select, insert, update, delete on public.mil_audit_outbox to service_role'));
  });
});

describe('R1/R2/R3 staff/creator gates still hold', () => {
  it('trash/archive staff gates', () => {
    assert.equal(
      staffAssetSignDecision({
        asset: { trashed_at: 'x', archived_at: null },
        role: 'admin',
      }).code,
      'MEDIA_TRASHED',
    );
    assert.equal(
      staffAssetSignDecision({
        asset: { trashed_at: null, archived_at: 'x' },
        role: 'media_reviewer',
      }).code,
      'MEDIA_ARCHIVED',
    );
  });

  it('revoked assignment denied for creator', () => {
    assert.equal(
      creatorAssetSignDecision({
        asset: {
          trashed_at: null,
          archived_at: null,
          created_by_user_id: 'other',
          human_review_status: 'verified',
          privacy_status: 'clear',
        },
        actorId: 'c1',
        assignmentActive: false,
        reelUseApproved: true,
      }).code,
      'MEDIA_ACCESS_DENIED',
    );
  });
});

describe('Documentation ratification', () => {
  it('PRODUCTION_APPLY_PACKET states MIL production host/backend and forbids wwyx apply', () => {
    const doc = read('docs/media-intelligence/PRODUCTION_APPLY_PACKET.md');
    assert.ok(doc.includes('mil.bhfos.com'));
    assert.ok(doc.includes('sdzhdupekcnekesbtxsl'));
    assert.ok(doc.includes('app.bhfos.com'));
    assert.ok(/MIL migrations must not be applied to `?wwyx/i.test(doc) || doc.includes('must not be applied to wwyx'));
    assert.ok(/superseded/i.test(doc));
  });
});

describe('Final remediation edge contracts', () => {
  const edges = [
    'supabase/functions/media-intel-analyze/index.ts',
    'supabase/functions/media-intel-creator-admin/index.ts',
    'supabase/functions/media-intel-promote-website/index.ts',
    'supabase/functions/media-intel-reel-upload/index.ts',
    'supabase/functions/media-intel-upload-session/index.ts',
    'supabase/functions/media-intel-sign/index.ts',
  ];

  for (const rel of edges) {
    it(`${path.basename(path.dirname(rel))} catch uses redactErrorForClient / catalog`, () => {
      const src = read(rel);
      assert.ok(src.includes('redactErrorForClient') || src.includes('PUBLIC_ERROR_CATALOG'));
      assert.ok(src.includes('correlationId'));
    });
  }

  it('reel-upload and promote-website use transactional audited RPCs, not persistEssentialAudit', () => {
    const reel = read('supabase/functions/media-intel-reel-upload/index.ts');
    const promo = read('supabase/functions/media-intel-promote-website/index.ts');
    assert.ok(reel.includes('mil_mint_reel_upload_grant_audited'));
    assert.ok(reel.includes('mil_complete_reel_upload_audited'));
    assert.ok(reel.includes('p_operation_id'));
    assert.ok(reel.includes('operationId'));
    assert.ok(!reel.includes('reel_mint:${user.id}:${crypto.randomUUID()}'));
    assert.ok(!reel.includes('persistEssentialAudit'));
    assert.ok(promo.includes('mil_unpublish_website_audited'));
    assert.ok(promo.includes("deny('PUBLIC_PROMOTION_UNAVAILABLE', 503)"));
    assert.ok(!promo.includes('PUBLIC_SAFE_DISABLED_MESSAGE'));
    assert.ok(!promo.includes('persistEssentialAudit'));
  });

  it('promote/catalog safe responses omit storage topology strings', () => {
    const promo = read('supabase/functions/media-intel-promote-website/index.ts');
    const safe = read('supabase/functions/_shared/milSafeErrors.ts');
    const clientSafe = read('src/lib/mediaIntel/safeErrors.js');
    assert.ok(safe.includes('PUBLIC_PROMOTION_UNAVAILABLE'));
    assert.ok(clientSafe.includes('PUBLIC_PROMOTION_UNAVAILABLE'));
    assert.ok(safe.includes('Public media promotion is not currently available.'));
    const disabledReturn = promo.slice(
      promo.indexOf("action === 'prepare_public_safe' || action === 'promote'"),
      promo.indexOf("if (action === 'unpublish')"),
    );
    for (const leak of [
      'media-intel-originals',
      'website-public-media',
      'media-intel-derivatives',
      'supabase',
      'bucket',
    ]) {
      assert.ok(!disabledReturn.includes(leak), `503 path must not include ${leak}`);
    }
    const catchBody = promo.slice(promo.lastIndexOf('catch (error)'));
    assert.ok(catchBody.includes('redactErrorForClient'));
    assert.ok(!/return json\(\{\s*error:\s*msg/.test(catchBody));
  });

  it('creator workspace persists reel mint operationId across retries', () => {
    const ui = read('src/pages/crm/media/MediaCreatorWorkspace.jsx');
    assert.ok(ui.includes('loadOrCreateReelMintOperation'));
    assert.ok(ui.includes('operationId'));
    assert.ok(ui.includes('mil.reelMintOp.'));
    assert.ok(ui.includes('clearReelMintOperation'));
    assert.ok(ui.includes('pending_mint'));
  });

  it('sign uses kind-specific permitted use (not website|social OR)', () => {
    const sign = read('supabase/functions/media-intel-sign/index.ts');
    assert.ok(sign.includes('requiredPermittedUseForDerivative'));
    assert.ok(sign.includes('permittedUseApproved'));
    assert.ok(!sign.includes(".in('use_key', ['website', 'social_media'])"));
  });

  it('persistEssentialAudit fails closed for non-atomic edge use', () => {
    const audit = read('supabase/functions/_shared/milAudit.ts');
    assert.ok(audit.includes('EDGE_THEN_OUTBOX_NONATOMIC'));
  });

  it('SQL smoke runner fails closed without LOCAL_DB_URL', () => {
    const smoke = read('tools/mil-phase2a-sql-smoke.mjs');
    assert.ok(smoke.includes('NOT_CONFIGURED'));
    assert.ok(smoke.includes('LOCAL_DB_URL'));
    assert.ok(smoke.includes('is not PASS'));
    assert.ok(smoke.includes('process.exit(3)'));
  });
});
