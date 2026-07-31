/**
 * Release A — unified submission + review contracts.
 * Run: node --test tests/unit/media-intel-unified-submission.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

describe('MIL unified submission Release A', () => {
  it('defaults submission type to reel', () => {
    const constants = read('src/lib/mediaIntel/constants.js');
    assert.match(constants, /DEFAULT_SUBMISSION_TYPE\s*=\s*'reel'/);
    assert.match(constants, /id:\s*'reel'/);
    assert.match(constants, /id:\s*'raw_video'/);
    assert.match(constants, /id:\s*'social_post'/);
  });

  it('migration adds mil_submissions, submit/review RPCs, and idempotent reel submit', () => {
    const sql = read('supabase/migrations/20260731120000_media_intel_unified_submissions.sql');
    assert.match(sql, /create table if not exists public\.mil_submissions/);
    assert.match(sql, /create table if not exists public\.mil_submission_assets/);
    assert.match(sql, /mil_generate_submission_public_id/);
    assert.match(sql, /SUB-/);
    assert.match(sql, /mil_submit_content_package/);
    assert.match(sql, /already_submitted/);
    assert.match(sql, /idempotency_key/);
    assert.match(sql, /mil_review_content_submission/);
    assert.match(sql, /create or replace function public\.mil_submit_reel_version/);
    assert.match(sql, /awaiting_owner_review/);
    assert.match(sql, /contributor_self/);
    assert.match(sql, /mil_browse_submissions/);
    assert.doesNotMatch(sql, /drop table/i);
    // Historical gap: Release A revoked EXECUTE only FROM PUBLIC (not anon).
    // Final browser-safe ACL is asserted on the additive hardening migration.
    assert.match(
      sql,
      /revoke all on function public\.mil_submit_content_package\([\s\S]*?\) from public;/,
    );
    assert.doesNotMatch(
      sql,
      /revoke all on function public\.mil_submit_content_package\([\s\S]*?\) from public,\s*anon/,
    );
  });

  it('additive ACL migration revokes PUBLIC/anon EXECUTE and grants only intended roles', () => {
    const acl = read('supabase/migrations/20260731130000_media_intel_submission_rpc_execute_acl.sql');
    const clientRpcs = [
      'mil_submit_content_package',
      'mil_review_content_submission',
      'mil_submit_reel_version',
      'mil_review_reel_version',
    ];

    assert.match(acl, /ALTER DEFAULT PRIVILEGES|default privileges are left unchanged/i);
    assert.match(
      acl,
      /revoke all on function public\.mil_generate_submission_public_id\(\)\s+from public, anon, authenticated/,
    );

    for (const rpc of clientRpcs) {
      assert.match(
        acl,
        new RegExp(
          `revoke all on function public\\.${rpc}\\([\\s\\S]*?\\)\\s*from public, anon, authenticated`,
        ),
        `${rpc} must revoke PUBLIC + anon (+ authenticated before re-grant)`,
      );
      assert.match(
        acl,
        new RegExp(
          `grant execute on function public\\.${rpc}\\([\\s\\S]*?\\)\\s*to authenticated, service_role`,
        ),
        `${rpc} must grant authenticated + service_role only`,
      );
      assert.doesNotMatch(
        acl,
        new RegExp(`grant execute on function public\\.${rpc}\\([\\s\\S]*?\\)\\s*to anon`),
        `${rpc} must not grant anon`,
      );
    }

    // Helper stays internal — no authenticated/anon EXECUTE grant.
    assert.doesNotMatch(
      acl,
      /grant execute on function public\.mil_generate_submission_public_id\(\)/,
    );
  });

  it('API exposes submit package, list submissions, and owner-action count', () => {
    const api = read('src/lib/mediaIntel/api.js');
    assert.match(api, /export async function submitContentPackage/);
    assert.match(api, /mil_submit_content_package/);
    assert.match(api, /export async function listSubmissions/);
    assert.match(api, /queueFilter === 'needs_review'/);
    assert.match(api, /export async function countOwnerActionSubmissions/);
    assert.match(api, /action_owner',\s*'owner'/);
    assert.match(api, /submissionsAwaitingOwner/);
    assert.match(api, /export async function reviewContentSubmission/);
  });

  it('contributor UI: Submit Content, type radios default reel, upload≠submit, confirmation ID', () => {
    const workspace = read('src/pages/crm/media/MediaCreatorWorkspace.jsx');
    assert.match(workspace, /Submit Content/);
    assert.match(workspace, /contributor-submission-type/);
    assert.match(workspace, /DEFAULT_SUBMISSION_TYPE/);
    assert.match(workspace, /What are you submitting\?/);
    assert.match(workspace, /contributor-submit-for-review/);
    assert.match(workspace, /Submit for Review/);
    assert.match(workspace, /contributor-submit-confirmation/);
    assert.match(workspace, /Submission ID/);
    assert.match(workspace, /submitContentPackage/);
    assert.match(workspace, /readyAssetIds/);
    assert.match(workspace, /contributor-my-submissions/);
    assert.match(workspace, /Upload Activity/);
    // Upload alone must not claim owner review success for packages
    assert.doesNotMatch(
      workspace,
      /Uploaded \$\{done \|\| files\.length\} shot\(s\)\. They are in owner Review/,
    );
  });

  it('unified Review Queue filters and reel deep-link compatibility', () => {
    const constants = read('src/lib/mediaIntel/constants.js');
    assert.match(constants, /id:\s*'needs_review'/);
    assert.match(constants, /id:\s*'reel'/);
    assert.match(constants, /id:\s*'raw_video'/);
    assert.match(constants, /id:\s*'social_post'/);
    assert.match(constants, /REVIEW_QUEUE_FILTERS/);

    const review = read('src/pages/crm/media/MediaReviewQueue.jsx');
    assert.match(review, /listSubmissions/);
    assert.match(review, /media-review-queue-filters/);
    assert.match(review, /REVIEW_QUEUE_FILTERS/);
    assert.match(review, /reel-review\?versionId=/);
    assert.match(review, /reviewContentSubmission/);
    assert.match(review, /accept_into_library/);

    const reel = read('src/pages/crm/media/MediaReelReview.jsx');
    assert.match(reel, /versionId/);
    assert.match(reel, /reel-version-\$\{v\.id\}/);
    assert.match(reel, /media\/review\?filter=reel/);
  });

  it('keeps Reel Review nav entry and /media/reel-review route', () => {
    const constants = read('src/lib/mediaIntel/constants.js');
    const app = read('src/App.jsx');
    assert.match(constants, /id: 'reel-review'/);
    assert.match(app, /path="reel-review"/);
  });
});
