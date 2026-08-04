/**
 * MIL authorization / policy contracts for the security repair slice.
 * Run: node --test tests/unit/media-intel-security.test.mjs
 *
 * These tests encode required security rules in source + pure helpers.
 * They do not prove deployed RLS/storage/edge behavior.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

/** Mirrors mil_creator_can_view_asset / edge creatorCanView intent. */
function creatorCanViewAsset({ asset, uses, assignments, actorId }) {
  if (!asset || asset.archived_at) return false;
  if (asset.privacy_status !== 'clear' || asset.human_review_status !== 'verified') return false;
  const eligible = uses.some((u) => u.use_key === 'reel_creation' && u.approved);
  if (!eligible) return false;
  const active = assignments.filter((a) => a.creator_user_id === actorId && a.status === 'active' && !a.revoked_at);
  if (active.some((a) => a.asset_id === asset.id)) return true;
  const collectionIds = active.map((a) => a.collection_id).filter(Boolean);
  return active.some((a) => a.collection_asset_ids?.some((id) => id === asset.id))
    || collectionIds.length > 0 && active.some((a) => a.collection_id && a.collection_asset_ids?.includes(asset.id));
}

function creatorCanViewSimplified({ asset, reelApproved, assignment, actorId }) {
  if (!asset || asset.archived_at) return false;
  if (asset.privacy_status !== 'clear' || asset.human_review_status !== 'verified') return false;
  if (!reelApproved) return false;
  if (!assignment) return false;
  if (assignment.creator_user_id !== actorId) return false;
  if (assignment.status !== 'active' || assignment.revoked_at) return false;
  return assignment.asset_id === asset.id || Boolean(assignment.collectionContainsAsset);
}

/** Minimal JPEG EXIF stripper (APP0–APP15 dropped) — mirrors promote edge helper. */
function stripJpegExif(input) {
  if (input.length < 4 || input[0] !== 0xff || input[1] !== 0xd8) throw new Error('Not a JPEG');
  const out = [0xff, 0xd8];
  let i = 2;
  while (i + 1 < input.length) {
    if (input[i] !== 0xff) {
      for (; i < input.length; i++) out.push(input[i]);
      break;
    }
    while (i < input.length && input[i] === 0xff) i++;
    if (i >= input.length) break;
    const marker = input[i];
    i += 1;
    if (marker === 0xd9) {
      out.push(0xff, 0xd9);
      break;
    }
    if (marker >= 0xd0 && marker <= 0xd7) {
      out.push(0xff, marker);
      continue;
    }
    if (i + 1 >= input.length) break;
    const len = (input[i] << 8) | input[i + 1];
    if (len < 2 || i + len > input.length) break;
    const isApp = marker >= 0xe0 && marker <= 0xef;
    if (!isApp) {
      out.push(0xff, marker);
      for (let j = 0; j < len; j++) out.push(input[i + j]);
    }
    i += len;
    if (marker === 0xda) {
      for (; i < input.length; i++) out.push(input[i]);
      break;
    }
  }
  return Uint8Array.from(out);
}

function jpegHasApp1(bytes) {
  let i = 2;
  while (i + 3 < bytes.length) {
    if (bytes[i] !== 0xff) return false;
    const marker = bytes[i + 1];
    if (marker === 0xe1) return true;
    if (marker === 0xda || marker === 0xd9) return false;
    if (marker >= 0xd0 && marker <= 0xd7) {
      i += 2;
      continue;
    }
    const len = (bytes[i + 2] << 8) | bytes[i + 3];
    i += 2 + len;
  }
  return false;
}

describe('Creator assignment isolation', () => {
  const asset = {
    id: 'asset-a',
    privacy_status: 'clear',
    human_review_status: 'verified',
    archived_at: null,
  };

  it('denies creator B when only global reel_creation is approved', () => {
    assert.equal(
      creatorCanViewSimplified({
        asset,
        reelApproved: true,
        assignment: null,
        actorId: 'creator-b',
      }),
      false,
    );
  });

  it('allows creator A with active direct assignment + eligibility', () => {
    assert.equal(
      creatorCanViewSimplified({
        asset,
        reelApproved: true,
        assignment: {
          creator_user_id: 'creator-a',
          status: 'active',
          revoked_at: null,
          asset_id: 'asset-a',
        },
        actorId: 'creator-a',
      }),
      true,
    );
  });

  it('denies after assignment revocation', () => {
    assert.equal(
      creatorCanViewSimplified({
        asset,
        reelApproved: true,
        assignment: {
          creator_user_id: 'creator-a',
          status: 'revoked',
          revoked_at: '2026-01-01',
          asset_id: 'asset-a',
        },
        actorId: 'creator-a',
      }),
      false,
    );
  });

  it('denies creator B requesting creator A assignment', () => {
    assert.equal(
      creatorCanViewSimplified({
        asset,
        reelApproved: true,
        assignment: {
          creator_user_id: 'creator-a',
          status: 'active',
          revoked_at: null,
          asset_id: 'asset-a',
        },
        actorId: 'creator-b',
      }),
      false,
    );
  });

  it('SQL helper requires assignment and does not OR global use alone', () => {
    const mig = read('supabase/migrations/20260725120000_media_intelligence_library.sql');
    const fn = mig.slice(
      mig.indexOf('create or replace function public.mil_creator_can_view_asset'),
      mig.indexOf('-- ---------------------------------------------------------------------------\n-- RLS'),
    );
    assert.match(fn, /reel_creation/);
    assert.match(fn, /mil_creator_assignments/);
    assert.match(fn, /status = 'active'/);
    assert.match(fn, /revoked_at is null/);
    // Global use must AND with assignment — not an alternate OR branch that grants alone.
    assert.doesNotMatch(
      fn.replace(/\s+/g, ' '),
      /approved = true \) or exists \( select 1 from public\.mil_creator_assignments/,
    );
  });
});

describe('Creator storage / reel signing', () => {
  it('removes broad creator storage SELECT policy', () => {
    const mig = read('supabase/migrations/20260725120000_media_intelligence_library.sql');
    assert.match(mig, /drop policy if exists "MIL derivatives creator reel read"/);
    assert.doesNotMatch(
      mig,
      /create policy "MIL derivatives creator reel read"[\s\S]*mil_is_creator\(\)/,
    );
  });

  it('sign function supports reelVersionId ownership check and audits', () => {
    const fn = read('supabase/functions/media-intel-sign/index.ts');
    const policy = read('supabase/functions/_shared/milSignPolicy.ts');
    assert.match(fn, /reelVersionId/);
    assert.match(fn, /reelVersionSignDecision/);
    assert.match(policy, /creator_user_id === actorId|REEL_NOT_ASSIGNED/);
    assert.match(fn, /reel_preview|reel_download/);
    assert.match(fn, /mil\/reels\//);
    assert.doesNotMatch(fn, /if \(use\) return true/);
  });

  it('creator workspace does not call client storage.createSignedUrl for reels', () => {
    const src = read('src/pages/crm/media/MediaCreatorWorkspace.jsx');
    assert.match(src, /requestSignedReelUrl/);
    assert.doesNotMatch(src, /signedUrl\(/);
    assert.doesNotMatch(src, /createSignedUrl/);
  });
});

describe('Upload grant binding', () => {
  it('migration defines mil_upload_grants with unique path/asset bindings', () => {
    const mig = read('supabase/migrations/20260725130000_media_intel_access_sessions.sql');
    assert.match(mig, /mil_upload_grants/);
    assert.match(mig, /unique \(session_id, asset_id\)/);
    assert.match(mig, /unique \(object_path\)/);
    assert.match(mig, /completed_at/);
  });

  it('complete_file requires grant match and answers a replay from recorded state', () => {
    const fn = read('supabase/functions/media-intel-upload-session/index.ts');
    assert.match(fn, /mil_upload_grants/);
    assert.match(fn, /Grant mismatch/);
    // A repeat call is answered from the grant's committed/duplicate state
    // rather than re-running the transfer.
    assert.match(fn, /begun\.status === 'already_committed'/);
    assert.match(fn, /begun\.status === 'already_duplicate'/);
    assert.match(fn, /replay: true/);
    assert.match(fn, /The uploaded file is not in quarantine storage/);
    assert.match(fn, /ALLOWED_MIME/);
    assert.match(fn, /MAX_UPLOAD_BYTES/);
  });

  it('complete_file never deletes storage inline — cleanup is the reconciler\'s job', () => {
    const fn = read('supabase/functions/media-intel-upload-session/index.ts');
    assert.doesNotMatch(fn, /\.remove\(/);
  });

  it('the reconciler only removes the grant-bound quarantine path', () => {
    const fn = read('supabase/functions/media-intel-upload-reconcile/index.ts');
    assert.match(fn, /remove\(\[grant\.object_path\]\)/);
    assert.doesNotMatch(fn, /remove\(\[objectPath\]\)/);
    assert.doesNotMatch(fn, /remove\(\[body\./);
  });

  it('mint generates server assetId and records grant before signed upload', () => {
    const fn = read('supabase/functions/media-intel-upload-session/index.ts');
    const mint = fn.slice(fn.indexOf("action === 'mint_upload'"), fn.indexOf("action === 'complete_file'"));
    assert.match(mint, /crypto\.randomUUID\(\)/);
    assert.match(mint, /mil_upload_grants/);
    assert.doesNotMatch(mint, /body\.assetId/);
  });
});

describe('Website promotion public-safe path', () => {
  it('prepare_public_safe and promote are disabled (503) with catalog-safe body', () => {
    const fn = read('supabase/functions/media-intel-promote-website/index.ts');
    assert.match(fn, /prepare_public_safe/);
    assert.match(fn, /stripJpegExif/);
    assert.match(fn, /action === 'prepare_public_safe' \|\| action === 'promote'/);
    assert.match(fn, /PUBLIC_PROMOTION_UNAVAILABLE/);
    assert.match(fn, /website_promotion_attempt_blocked/);
    assert.doesNotMatch(fn, /PUBLIC_SAFE_DISABLED_MESSAGE/);
    assert.doesNotMatch(fn, /code:\s*['"]not_implemented['"]/);
    // Client-visible path must not name storage topology.
    const promoteBlock = fn.slice(
      fn.indexOf("action === 'prepare_public_safe' || action === 'promote'"),
      fn.indexOf("if (action === 'unpublish')"),
    );
    assert.doesNotMatch(promoteBlock, /stripJpegExif\(/);
    assert.doesNotMatch(promoteBlock, /website-public-media/);
    assert.doesNotMatch(promoteBlock, /media-intel-originals/);
    assert.match(promoteBlock, /deny\('PUBLIC_PROMOTION_UNAVAILABLE',\s*503\)/);
  });

  it('unpublish removes public objects and marks promotions unavailable', () => {
    const fn = read('supabase/functions/media-intel-promote-website/index.ts');
    assert.match(fn, /action === 'unpublish'/);
    assert.match(fn, /mil_unpublish_website_audited/);
    assert.match(fn, /display_status: 'unavailable'/);
    assert.match(fn, /website-public-media/);
    assert.match(fn, /website_unpublish/);
  });

  it('strips APP1 EXIF from a synthetic JPEG', () => {
    // SOI + APP1(EXIF) + SOS(minimal) + EOI
    const bytes = Uint8Array.from([
      0xff, 0xd8,
      0xff, 0xe1, 0x00, 0x08, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00, // APP1 "Exif\0\0"
      0xff, 0xda, 0x00, 0x02,
      0x00, 0x01, 0x02, 0x03,
      0xff, 0xd9,
    ]);
    assert.equal(jpegHasApp1(bytes), true);
    const stripped = stripJpegExif(bytes);
    assert.equal(stripped[0], 0xff);
    assert.equal(stripped[1], 0xd8);
    assert.equal(jpegHasApp1(stripped), false);
  });
});

describe('Role capability narrowing', () => {
  it('technicians are not MIL library staff in SQL or client', () => {
    const mig = read('supabase/migrations/20260725120000_media_intelligence_library.sql');
    const staffFn = mig.slice(
      mig.indexOf('create or replace function public.mil_is_staff()'),
      mig.indexOf('create or replace function public.mil_is_owner_admin()'),
    );
    assert.doesNotMatch(staffFn, /technician/);
    const roles = read('src/lib/mediaIntel/roles.js');
    assert.match(roles, /LIBRARY_STAFF/);
    assert.doesNotMatch(roles, /new Set\(\['admin', 'manager', 'office', 'media_reviewer', 'technician'\]\)/);
    assert.match(roles, /isTechnician/);
  });

  it('client isReviewer excludes office; library staff browse/upload still includes office', () => {
    const roles = read('src/lib/mediaIntel/roles.js');
    assert.match(roles, /LIBRARY_STAFF = new Set\(\['admin', 'manager', 'office', 'media_reviewer'\]\)/);
    assert.match(roles, /REVIEWERS = new Set\(\['admin', 'manager', 'media_reviewer'\]\)/);
    assert.doesNotMatch(roles, /REVIEWERS = new Set\(\[[^\]]*['"]office['"]/);
    assert.match(roles, /isReviewer:\s*REVIEWERS\.has\(r\)/);
    assert.match(roles, /canVerify:\s*REVIEWERS\.has\(r\)/);
    assert.match(roles, /canBrowseLibrary:\s*isLibraryStaff/);
    assert.match(roles, /canUpload:\s*isLibraryStaff/);
  });

  it('edge isMilReviewer matches SQL mil_is_reviewer (excludes office, not aliased to staff)', () => {
    const src = read('supabase/functions/_shared/milRoles.ts');
    const reviewerFn = src.slice(
      src.indexOf('export async function isMilReviewer'),
      src.indexOf('export async function isMilCreator'),
    );
    assert.match(reviewerFn, /resolveMilRole/);
    assert.match(reviewerFn, /\['admin', 'manager', 'media_reviewer'\]/);
    assert.doesNotMatch(reviewerFn, /isMilStaff/);
    assert.doesNotMatch(reviewerFn, /office/);
    assert.doesNotMatch(reviewerFn, /technician/);
    assert.doesNotMatch(reviewerFn, /reel_creator/);
    assert.doesNotMatch(reviewerFn, /phone_uploader/);
  });

  it('docs define role capability matrix including manager owner/admin actions', () => {
    const doc = read('docs/media-intelligence/ACCESS_ARCHITECTURE.md');
    assert.match(doc, /Role → MIL capability matrix/);
    assert.match(doc, /technician.*\*\*No\*\*/i);
    assert.match(doc, /Managers are treated as owner\/admin/);
  });

  it('analyze edge excludes technicians from staff analysis', () => {
    const fn = read('supabase/functions/media-intel-analyze/index.ts');
    assert.doesNotMatch(fn, /technician', 'tech'\]\.includes\(r\)\) return 'staff'/);
  });
});
