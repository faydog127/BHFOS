/**
 * Media Intelligence Library — static cross-file contract tests.
 * Run: node --test tests/unit/media-intel-contracts.test.mjs
 * Included in: npm run test:media-intel-helpers
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const MIL_EDGE_FUNCTIONS = [
  'media-intel-analyze',
  'media-intel-creator-admin',
  'media-intel-promote-website',
  'media-intel-reel-upload',
  'media-intel-sign',
  'media-intel-upload-session',
  'media-intel-upload-reconcile',
];

const LIFECYCLE_MIGRATION = 'supabase/migrations/20260726090000_media_intel_upload_finalization_lifecycle.sql';
const WEBSITE_BUCKET_MIGRATION = 'supabase/migrations/20260727120000_media_intel_website_public_bucket.sql';
const UPLOAD_SESSION_FN = 'supabase/functions/media-intel-upload-session/index.ts';
const RECONCILE_FN = 'supabase/functions/media-intel-upload-reconcile/index.ts';

describe('MIL derivative kind SQL/JS parity', () => {
  it('ALL_DERIVATIVE_KINDS matches mil_derivatives.kind check in 20260725120000 migration', () => {
    const js = read('src/lib/mediaIntel/derivativeKinds.js');
    const mig = read('supabase/migrations/20260725120000_media_intelligence_library.sql');

    const kindsMatch = js.match(/export const ALL_DERIVATIVE_KINDS = \[([\s\S]*?)\];/);
    assert.ok(kindsMatch, 'ALL_DERIVATIVE_KINDS export not found');
    const jsKinds = [...kindsMatch[1].matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();

    const checkMatch = mig.match(/kind text not null check \(kind in \(([\s\S]*?)\)\)/);
    assert.ok(checkMatch, 'mil_derivatives.kind check not found in migration');
    const sqlKinds = [...checkMatch[1].matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();

    assert.deepEqual(jsKinds, sqlKinds, 'derivativeKinds.js must stay in sync with migration check constraint');
    assert.ok(jsKinds.includes('public_safe'), 'missing public_safe');
    assert.ok(jsKinds.includes('ai_safe'), 'missing ai_safe');
  });
});

describe('MIL edge functions share milCors', () => {
  for (const fn of MIL_EDGE_FUNCTIONS) {
    it(`${fn} imports milCorsHeaders`, () => {
      const src = read(`supabase/functions/${fn}/index.ts`);
      assert.match(src, /from '\.\.\/_shared\/milCors\.ts'/);
      assert.match(src, /milCorsHeaders/);
    });
  }
});

describe('MIL promote website honesty', () => {
  it('prepare_public_safe and promote return not_implemented (503)', () => {
    const fn = read('supabase/functions/media-intel-promote-website/index.ts');
    assert.match(fn, /action === 'prepare_public_safe' \|\| action === 'promote'/);
    assert.match(fn, /503/);
    assert.match(fn, /not_implemented/);
    assert.match(fn, /public_safe_transform_not_implemented/);
  });

  it('unpublishWebsiteMedia invokes edge with action unpublish + assetId only', () => {
    const api = read('src/lib/mediaIntel/api.js');
    const start = api.indexOf('export async function unpublishWebsiteMedia');
    assert.ok(start >= 0, 'unpublishWebsiteMedia export not found');
    const next = api.indexOf('\nexport ', start + 1);
    const src = next === -1 ? api.slice(start) : api.slice(start, next);
    assert.match(src, /media-intel-promote-website/);
    assert.match(src, /action:\s*['"]unpublish['"]/);
    assert.match(src, /assetId:\s*id/);
    assert.doesNotMatch(src, /action:\s*['"]promote['"]/);
    assert.doesNotMatch(src, /prepare_public_safe/);
  });

  it('MediaSettings keeps promote disabled and wires owner/admin unpublish', () => {
    const settings = read('src/pages/crm/media/MediaSettings.jsx');
    assert.match(settings, /unpublishWebsiteMedia/);
    assert.match(settings, /mil_website_promotions/);
    assert.match(settings, /data-testid="website-unpublish"/);
    assert.match(settings, /Promote public derivative \(disabled\)/);
    assert.match(settings, /Promote disabled/);
    // Promote control must stay hard-disabled in the UI.
    assert.match(settings, /title="Disabled pending proven public-safe transform pipeline"/);
    assert.doesNotMatch(settings, /action:\s*['"]promote['"]/);
    assert.doesNotMatch(settings, /action:\s*['"]prepare_public_safe['"]/);
  });
});

describe('MIL website-public-media bucket migration', () => {
  const mig = read(WEBSITE_BUCKET_MIGRATION);

  it('creates public website-public-media bucket with service_role writes only', () => {
    assert.match(mig, /website-public-media/);
    assert.match(mig, /insert into storage\.buckets/);
    // New bucket row is public read; conflict path only forces public=true.
    assert.match(mig, /'website-public-media',\s*\n\s*'website-public-media',\s*\n\s*true,/);
    assert.match(mig, /on conflict \(id\) do update set\s*\n\s*public = true/);
    assert.match(mig, /for select to anon, authenticated/);
    assert.match(mig, /for all to service_role/);
    assert.doesNotMatch(mig, /for insert to (authenticated|anon)/);
    assert.doesNotMatch(mig, /inspection-photos|inspection-reports/);
  });
});

describe('MIL upload session finalize contract', () => {
  const fn = read(UPLOAD_SESSION_FN);

  it('complete_file drives the four-step finalization state machine', () => {
    assert.match(fn, /\.rpc\('mil_begin_upload_finalize'/);
    assert.match(fn, /\.rpc\('mil_mark_upload_placed'/);
    assert.match(fn, /\.rpc\('mil_commit_upload_finalize'/);
    assert.match(fn, /\.rpc\('mil_fail_upload_finalize'/);

    // The placement path must run begin -> placed -> commit. (An earlier commit
    // call exists for the duplicate short-circuit, which never places bytes, so
    // the placement commit is the last one.)
    const begin = fn.indexOf("rpc('mil_begin_upload_finalize'");
    const placed = fn.indexOf("rpc('mil_mark_upload_placed'");
    const commit = fn.lastIndexOf("rpc('mil_commit_upload_finalize'");
    assert.ok(
      begin < placed && placed < commit,
      `finalization must run begin -> placed -> commit, got offsets ${begin}, ${placed}, ${commit}`,
    );
  });

  it('the retired single-shot finalize RPC is gone from the edge', () => {
    assert.doesNotMatch(fn, /mil_finalize_upload_grant/);
    assert.doesNotMatch(fn, /mil_cleanup_expired_upload_grants/);
  });

  it('re-hashes the quarantine object rather than trusting the client checksum', () => {
    assert.match(fn, /crypto\.subtle\.digest\('SHA-256'/);
    assert.match(fn, /verifiedChecksum/);
  });

  it('places the final object with upsert:false', () => {
    assert.match(fn, /\.upload\(finalPath, bytes, \{ contentType: verifiedMime, upsert: false \}\)/);
  });

  it('derives the final path canonically instead of rewriting the quarantine path', () => {
    assert.match(fn, /canonicalOriginalPath/);
    assert.doesNotMatch(fn, /\.replace\(\s*['"`]mil\/quarantine/);
  });

  it('persists the signed upload token expiry at mint', () => {
    assert.match(fn, /upload_token_expires_at/);
    assert.match(fn, /function jwtExpiryIso/);
    // Quarantine bytes are never deleted inline by the finalize path — cleanup
    // is scheduled in SQL and swept later by the reconcile function.
    assert.doesNotMatch(fn, /storage\.from\([^)]*\)\.remove\(/);
  });

  it('hands an indeterminate finalize to reconcile under an abort deadline', () => {
    assert.match(fn, /new AbortController\(\)/);
    assert.match(fn, /RECONCILE_INVOKE_TIMEOUT_MS = 5_?000/);
    assert.match(fn, /functions\/v1\/media-intel-upload-reconcile/);
  });

  it('never reports an unproven finalize as success', () => {
    assert.match(fn, /'pending_reconcile'/);
    // 202 is the only status that may accompany pending_reconcile.
    const pendingBlocks = [...fn.matchAll(/status: 'pending_reconcile'[\s\S]{0,400}?\}\s*,\s*(\d{3})/g)]
      .map((m) => m[1]);
    assert.ok(pendingBlocks.length > 0, 'no pending_reconcile responses found');
    for (const code of pendingBlocks) {
      assert.equal(code, '202', `pending_reconcile must return 202, found ${code}`);
    }
  });

  it('mint_upload uses #session= fragment in returned path', () => {
    assert.match(fn, /#session=\$\{token\}/);
  });
});

describe('MIL upload reconcile edge contract', () => {
  const fn = read(RECONCILE_FN);

  it('requires the shared reconcile key and refuses to run without it', () => {
    assert.match(fn, /MIL_RECONCILE_KEY/);
    assert.match(fn, /x-mil-reconcile-key/);
    assert.match(fn, /503/);
  });

  it('compares the key without leaking length or position', () => {
    assert.match(fn, /function secretsMatch/);
    assert.doesNotMatch(fn, /provided === expected/);
  });

  it('exposes health, run and grant actions only', () => {
    assert.match(fn, /action === 'health'/);
    assert.match(fn, /action === 'run'/);
    assert.match(fn, /action === 'grant'/);
  });

  it('reconciles and abandons through service_role RPCs, never direct state writes', () => {
    assert.match(fn, /rpc\(\s*'mil_reconcile_upload_finalization'/);
    assert.match(fn, /rpc\(\s*\n?\s*'mil_abandon_expired_upload_grants'/);
    assert.doesNotMatch(fn, /from\('mil_upload_grants'\)\s*\.update\(\s*\{\s*finalize_state/);
  });

  it('only sweeps quarantine for grants whose bytes are already safe elsewhere', () => {
    assert.match(fn, /committed/);
    assert.match(fn, /duplicate/);
    assert.match(fn, /quarantine_cleanup_after/);
  });
});

describe('MIL upload finalization migration contract', () => {
  const mig = read(LIFECYCLE_MIGRATION);

  it('retires the single-shot finalize and cleanup RPCs', () => {
    assert.match(mig, /drop function if exists public\.mil_finalize_upload_grant/);
    assert.match(mig, /drop function if exists public\.mil_cleanup_expired_upload_grants/);
  });

  it('grants every finalization RPC to service_role only', () => {
    const rpcs = [
      'mil_begin_upload_finalize',
      'mil_mark_upload_placed',
      'mil_commit_upload_finalize',
      'mil_fail_upload_finalize',
      'mil_recount_upload_batch',
      'mil_abandon_expired_upload_grants',
      'mil_reconcile_upload_finalization',
      'mil_storage_catalog_probe',
      'mil_raise_integrity_alert',
    ];
    for (const rpc of rpcs) {
      assert.match(mig, new RegExp(`create or replace function public\\.${rpc}\\(`), `${rpc} not defined`);
      assert.match(mig, new RegExp(`revoke all on function public\\.${rpc}\\([^)]*\\) from public`), `${rpc} not revoked from public`);
      assert.match(mig, new RegExp(`grant execute on function public\\.${rpc}\\([^)]*\\) to service_role`), `${rpc} not granted to service_role`);
      assert.doesNotMatch(
        mig,
        new RegExp(`grant execute on function public\\.${rpc}\\([^)]*\\) to (authenticated|anon)`),
        `${rpc} must not be callable by browser roles`,
      );
    }
  });

  it('removes client write grants on the lifecycle tables', () => {
    for (const table of [
      'mil_upload_batches',
      'mil_upload_grants',
      'mil_manifest_entries',
      'mil_upload_sessions',
      'mil_integrity_alerts',
    ]) {
      assert.match(
        mig,
        new RegExp(`revoke insert, update, delete on public\\.${table} from authenticated, anon`),
        `${table} still client-writable`,
      );
    }
    assert.match(mig, /revoke insert, delete on public\.mil_assets from authenticated, anon/);
    assert.match(mig, /grant select, update on public\.mil_assets to authenticated/);
  });

  it('drops the staff batch write policies that made counters forgeable', () => {
    assert.match(mig, /drop policy if exists mil_library_staff_write_upload_batches on public\.mil_upload_batches/);
    assert.match(mig, /drop policy if exists mil_library_staff_update_upload_batches on public\.mil_upload_batches/);
  });

  it('never derives an object path by string replacement', () => {
    assert.doesNotMatch(mig, /replace\s*\(\s*[a-z_.]*object_path/i);
    assert.match(mig, /create or replace function public\.mil_original_object_path/);
    assert.match(mig, /create or replace function public\.mil_quarantine_object_path/);
  });

  it('constrains finalize_state and both object paths', () => {
    assert.match(mig, /mil_upload_grants_finalize_state_check/);
    assert.match(mig, /mil_upload_grants_quarantine_path_check/);
    assert.match(mig, /mil_upload_grants_final_path_check/);
    assert.match(mig, /mil_upload_grants_committed_requires_proof/);
  });

  it('schedules quarantine cleanup only after the upload token can no longer be used', () => {
    assert.match(
      mig,
      /coalesce\(v_grant\.upload_token_expires_at, v_grant\.expires_at, now\(\)\)\s*\+\s*interval '15 minutes'/,
    );
  });

  it('adds the abandoned counter, integrity alerts and dedupe index', () => {
    assert.match(mig, /add column if not exists abandoned_count/);
    assert.match(mig, /create table if not exists public\.mil_integrity_alerts/);
    assert.match(mig, /mil_assets_active_checksum_uniq/);
    assert.match(mig, /mil_manifest_entries_grant_uniq/);
  });
});

describe('MIL client security contracts', () => {
  it('signedUrl throws — direct storage signing disabled', () => {
    const api = read('src/lib/mediaIntel/api.js');
    assert.match(api, /export async function signedUrl\(\)/);
    assert.match(api, /throw new Error\([\s\S]*direct storage signing disabled/);
  });

  it('audit throws — no client mil_audit_events inserts', () => {
    const api = read('src/lib/mediaIntel/api.js');
    assert.match(api, /export function audit\(\)/);
    assert.match(api, /throw new Error/);
    assert.doesNotMatch(api, /from\('mil_audit_events'\)\.insert/);
  });

  it('uploadManager never writes batches, manifests, grants or assets', () => {
    const upload = read('src/lib/mediaIntel/uploadManager.js');
    for (const table of [
      'mil_upload_batches',
      'mil_upload_grants',
      'mil_manifest_entries',
      'mil_assets',
    ]) {
      assert.doesNotMatch(
        upload,
        new RegExp(`from\\('${table}'\\)[\\s\\S]{0,80}?\\.(insert|update|upsert|delete)\\(`),
        `uploadManager must not write ${table} — the server owns that state`,
      );
    }
  });

  it('uploadManager takes its paths from the server mint, never from client strings', () => {
    const upload = read('src/lib/mediaIntel/uploadManager.js');
    assert.doesNotMatch(upload, /['"`]mil\/quarantine\//);
    assert.doesNotMatch(upload, /['"`]mil\/originals\//);
    assert.match(upload, /minted\.objectPath/);
  });

  it('uploadManager only calls success states on an explicit 200', () => {
    const upload = read('src/lib/mediaIntel/uploadManager.js');
    assert.match(upload, /export function interpretCompletion/);
    assert.match(upload, /if \(status === 200\)/);
    assert.match(upload, /UPLOAD_FILE_STATUS\.PENDING_RECONCILE/);
  });
});

describe('MIL pre-staging hardening migration contracts', () => {
  const hardening = read('supabase/migrations/20260725140000_media_intel_pre_staging_hardening.sql');

  it('still defines the historical mil_finalize_upload_grant (superseded by 20260726090000)', () => {
    assert.match(hardening, /create or replace function public\.mil_finalize_upload_grant/);
    assert.match(hardening, /grant execute on function public\.mil_finalize_upload_grant[\s\S]* to service_role/);
  });

  it('140000 drops mil_staff_all policies but does not create new mil_staff_all_* policies', () => {
    assert.match(hardening, /policyname like 'mil_staff_all_%'/);
    assert.doesNotMatch(
      hardening,
      /create policy mil_staff_all/i,
    );
    const creates = [...hardening.matchAll(/create policy (\S+)/gi)].map((m) => m[1]);
    assert.ok(
      !creates.some((name) => name.startsWith('mil_staff_all')),
      `unexpected mil_staff_all create policies: ${creates.filter((n) => n.startsWith('mil_staff_all')).join(', ')}`,
    );
  });

  it('mil_is_reviewer excludes office', () => {
    const reviewerBlocks = hardening.match(/create or replace function public\.mil_is_reviewer\([\s\S]*?\$\$;/g);
    assert.ok(reviewerBlocks?.length, 'mil_is_reviewer definition not found');
    const def = reviewerBlocks[reviewerBlocks.length - 1];
    assert.match(def, /media_reviewer/);
    assert.doesNotMatch(def, /office/);
  });
});

describe('MIL UI session fragment preference', () => {
  it('MediaSettings and MediaMobileUpload prefer #session= over query string', () => {
    const settings = read('src/pages/crm/media/MediaSettings.jsx');
    const mobile = read('src/pages/crm/media/MediaMobileUpload.jsx');
    assert.match(settings, /#session=\$\{encodeURIComponent/);
    assert.match(mobile, /#session=/);
    assert.match(mobile, /Prefer the URL fragment/);
  });

  it('MediaMobileUpload authenticated path passes freshly minted batchId (not stale sessionInfo)', () => {
    const mobile = read('src/pages/crm/media/MediaMobileUpload.jsx');
    // Session bearer path still uses validated sessionInfo.
    assert.match(mobile, /runUpload\(files, linkToken, sessionInfo\?\.batchId\)/);
    // Authenticated mint must stash createUploadSession result and pass that batchId.
    assert.match(mobile, /mintedSessionRef\.current = \{ token: created\.token, batchId: created\.batchId \}/);
    assert.match(mobile, /return runUpload\(files, minted\.token, minted\.batchId\)/);
    // Guard the race: do not call runUpload with sessionInfo?.batchId after mint.
    const authReturn = mobile.match(
      /if \(!caps\?\.isOwnerAdmin\)[\s\S]*?return runUpload\(([^)]+)\)/,
    );
    assert.ok(authReturn, 'authenticated startUpload runUpload call not found');
    assert.doesNotMatch(authReturn[1], /sessionInfo/);
  });
});

describe('MIL practical upload limit honesty', () => {
  it('constants advertise 250 MB cap tied to checksum helper', () => {
    const constants = read('src/lib/mediaIntel/constants.js');
    const checksum = read('src/lib/mediaIntel/checksum.js');
    assert.match(checksum, /MAX_PRACTICAL_HASH_BYTES = 250 \* 1024 \* 1024/);
    assert.match(constants, /MAX_PRACTICAL_HASH_BYTES/);
    assert.match(constants, /Do not advertise 2 GB/);
  });
});

describe('MIL on-demand AI analysis queue contract', () => {
  const api = read('src/lib/mediaIntel/api.js');
  const analyze = read('supabase/functions/media-intel-analyze/index.ts');

  /** Isolate queueAiAnalysis (last export) without brittle brace matching. */
  function queueAiAnalysisSource() {
    const start = api.indexOf('export async function queueAiAnalysis');
    assert.ok(start >= 0, 'queueAiAnalysis export not found');
    const next = api.indexOf('\nexport ', start + 1);
    return next === -1 ? api.slice(start) : api.slice(start, next);
  }

  function ensureAndClaimJobSource() {
    const start = analyze.indexOf('async function ensureAndClaimJob');
    const end = analyze.indexOf('async function settleJob');
    assert.ok(start >= 0, 'ensureAndClaimJob not found');
    assert.ok(end > start, 'settleJob must follow ensureAndClaimJob');
    return analyze.slice(start, end);
  }

  it('queueAiAnalysis does not insert mil_processing_jobs or update mil_assets', () => {
    const src = queueAiAnalysisSource();
    assert.doesNotMatch(
      src,
      /from\(['"]mil_processing_jobs['"]\)/,
      'client must not touch mil_processing_jobs (RLS is SELECT-only)',
    );
    assert.doesNotMatch(
      src,
      /from\(['"]mil_assets['"]\)/,
      'client must not update mil_assets.processing_status',
    );
    assert.doesNotMatch(src, /\.insert\(/);
    assert.doesNotMatch(src, /\.update\(/);
  });

  it('queueAiAnalysis awaits invoke and surfaces errors (no fire-and-forget swallow)', () => {
    const src = queueAiAnalysisSource();
    assert.match(src, /await supabase\.functions\.invoke\(['"]media-intel-analyze['"]/);
    assert.match(src, /action:\s*['"]analyze['"]/);
    assert.match(src, /if \(error\)/);
    assert.match(src, /throw new Error/);
    assert.doesNotMatch(src, /\.catch\(\s*\(\)\s*=>\s*\{\s*\}\s*\)/);
    assert.doesNotMatch(src, /functions\.invoke\([\s\S]*?\)\.catch\(/);
  });

  it('analyze edge ensures/claims a job server-side when no queued row exists', () => {
    assert.match(analyze, /async function claimQueuedJob/);
    assert.match(analyze, /const job = await ensureAndClaimJob\(assetId\)/);
    const ensureBody = ensureAndClaimJobSource();
    assert.match(ensureBody, /supabaseAdmin/);
    assert.match(
      ensureBody,
      /from\(['"]mil_processing_jobs['"]\)\s*\n?\s*\.insert\(/,
    );
    assert.match(ensureBody, /job_type:\s*['"]ai_analyze['"]/);
    assert.match(ensureBody, /status:\s*['"]queued['"]/);
    assert.match(ensureBody, /claimQueuedJob/);
    // Prefer new queued rows over rewriting succeeded/cancelled history.
    assert.doesNotMatch(
      ensureBody,
      /\.update\(\s*\{\s*status:\s*['"]queued['"]/,
      'must not reset historical job rows back to queued',
    );
  });

  it('analyze edge keeps staff gate and honest skip statuses', () => {
    assert.match(analyze, /isMilStaff/);
    assert.match(analyze, /skipped_no_key/);
    assert.match(analyze, /skipped_unsupported/);
    assert.match(analyze, /skipped_needs_ai_safe_derivative/);
    assert.match(analyze, /Do NOT write into mil_verified_metadata/);
  });
});

describe('MIL before/after confirmation honesty', () => {
  const api = read('src/lib/mediaIntel/api.js');
  const page = read('src/pages/crm/media/MediaBeforeAfter.jsx');

  it('confirmBeforeAfter updates relationship verification via RLS-gated table write', () => {
    assert.match(api, /export async function confirmBeforeAfter/);
    const start = api.indexOf('export async function confirmBeforeAfter');
    const body = api.slice(start, start + 500);
    assert.match(body, /mil_asset_relationships/);
    assert.match(body, /verification_status/);
    assert.match(body, /confirmed|rejected/);
    assert.match(body, /if \(error\) throw error/);
  });

  it('MediaBeforeAfter surfaces confirm/reject errors and busy-disables actions', () => {
    assert.match(page, /confirmBeforeAfter/);
    assert.match(page, /caps\.canVerify/);
    assert.match(page, /role="alert"/);
    assert.match(page, /Confirm failed|Reject failed|err\?\.message/);
    assert.match(page, /setBusyId/);
    assert.match(page, /catch \(err\)/);
    assert.match(page, /disabled=\{Boolean\(busyId\)\}/);
  });
});

describe('MIL reel review honesty', () => {
  const page = read('src/pages/crm/media/MediaReelReview.jsx');

  it('MediaReelReview catches approve/deny errors and never claims publish', () => {
    assert.match(page, /reviewReelVersion/);
    assert.match(page, /caps\.canApproveReels/);
    assert.match(page, /role="alert"/);
    assert.match(page, /setBusyId/);
    assert.match(page, /catch \(err\)/);
    assert.match(page, /disabled=\{Boolean\(busyId\)\}/);
    assert.match(page, /Nothing was published or scheduled|does not publish or schedule/);
    assert.doesNotMatch(page, /scheduled.*publish|auto.?post|social publish/i);
  });
});

describe('MIL collections membership honesty', () => {
  const api = read('src/lib/mediaIntel/api.js');
  const page = read('src/pages/crm/media/MediaCollections.jsx');
  const hardening = read('supabase/migrations/20260725140000_media_intel_pre_staging_hardening.sql');

  it('staff write policies exist for collections and collection items (no inventing RPCs)', () => {
    assert.match(hardening, /mil_library_staff_write_collections/);
    assert.match(hardening, /mil_library_staff_write_collection_items/);
    assert.match(hardening, /mil_can_browse_library\(\)/);
    assert.doesNotMatch(api, /rpc\(['"]mil_.*collection/);
  });

  it('api exposes thin direct-table helpers for list/create/add/remove', () => {
    assert.match(api, /export async function listCollections/);
    assert.match(api, /export async function createCollection/);
    assert.match(api, /export async function listCollectionItems/);
    assert.match(api, /export async function addCollectionItem/);
    assert.match(api, /export async function removeCollectionItem/);
    assert.match(api, /from\(['"]mil_collections['"]\)/);
    assert.match(api, /from\(['"]mil_collection_items['"]\)/);
    assert.match(api, /normalizeMilAssetId/);
  });

  it('MediaCollections wires membership UI and surfaces item counts', () => {
    assert.match(page, /listCollections/);
    assert.match(page, /createCollection/);
    assert.match(page, /addCollectionItem/);
    assert.match(page, /removeCollectionItem/);
    assert.match(page, /caps\?\.isStaff/);
    assert.match(page, /\{count\} \{count === 1 \? 'item' : 'items'\}/);
    assert.match(page, /Asset UUID/);
    assert.match(page, /data-testid="media-collection-add-item"/);
    assert.match(page, /data-testid="media-collection-remove-item"/);
    // Membership is UUID add/remove only — no browse/search/drag editor affordance.
    assert.doesNotMatch(page, /drag.?and.?drop/i);
    assert.doesNotMatch(page, /search assets/i);
    assert.doesNotMatch(page, /type="file"/);
  });
});
