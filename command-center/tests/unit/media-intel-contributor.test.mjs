/**
 * Contributor Workspace (Creator architecture) source contracts.
 * Run: node --test tests/unit/media-intel-contributor.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  approvedUseChips,
  CONTRIBUTOR_SEARCH_MIN_COUNT,
  CONTRIBUTOR_STANDING_RULES,
  filterAssignedMedia,
  isValidContributorBrief,
  looksLikeInventoryNote,
  pickContributorThumbKind,
  summarizeContributorBrief,
  workingCopyPresentation,
} from '../../src/lib/mediaIntel/contributorWorkspace.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

describe('Contributor Workspace source contracts', () => {
  it('migration denies archived/trashed assignment and adds pause + brief fields', () => {
    const sql = read('supabase/migrations/20260728140000_media_intel_contributor_workspace.sql');
    assert.match(sql, /Cannot assign trashed media to a contributor/);
    assert.match(sql, /Cannot assign archived media to a contributor/);
    assert.match(sql, /mil_set_creator_assignment_status/);
    assert.match(sql, /requested_output/);
    assert.match(sql, /'paused'/);
  });

  it('sign edge mirrors trash denial for creator access', () => {
    const src = read('supabase/functions/media-intel-sign/index.ts');
    assert.match(src, /trashed_at/);
    assert.match(src, /asset\.trashed_at/);
  });

  it('contributor self-upload: session mint, visibility migration, UI, no originals', () => {
    const edge = read('supabase/functions/media-intel-upload-session/index.ts');
    const sign = read('supabase/functions/media-intel-sign/index.ts');
    const mig = read('supabase/migrations/20260730180000_media_intel_contributor_self_upload.sql');
    const workspace = read('src/pages/crm/media/MediaCreatorWorkspace.jsx');
    const roles = read('src/lib/mediaIntel/roles.js');
    const uploadMgr = read('src/lib/mediaIntel/uploadManager.js');
    const api = read('src/lib/mediaIntel/api.js');

    assert.match(edge, /create_contributor_session/);
    assert.match(edge, /Only contributors may create a self-upload session/);
    assert.match(edge, /source_label:\s*'contributor_self'/);
    assert.match(edge, /hasMilCreatorGrant/);
    assert.match(edge, /action === 'create'/);
    assert.match(edge, /Only owner\/admin may create upload sessions/);

    assert.match(mig, /mil_creator_can_view_asset/);
    assert.match(mig, /created_by_user_id = auth\.uid\(\)/);
    assert.match(mig, /mil_auto_assign_contributor_self_upload/);
    assert.match(mig, /contributor_self/);
    assert.match(mig, /contractor_supplied/);

    assert.match(sign, /created_by_user_id/);
    assert.match(sign, /Creators may never access originals/);
    assert.match(sign, /allowOriginal === true/);

    assert.match(roles, /canContributorSelfUpload/);
    assert.match(uploadMgr, /createContributorUploadSession/);
    assert.match(uploadMgr, /create_contributor_session/);
    assert.match(api, /createdByUserId/);
    assert.match(workspace, /contributor-upload-my-shots/);
    assert.match(workspace, /Upload my shots/);
    assert.match(workspace, /createContributorUploadSession/);
    assert.match(workspace, /contributor-my-shots-list/);
    assert.doesNotMatch(workspace, /allowOriginal:\s*true/);

    const constants = read('src/lib/mediaIntel/constants.js');
    const dash = read('src/pages/crm/media/MediaDashboard.jsx');
    const review = read('src/pages/crm/media/MediaReviewQueue.jsx');
    const app = read('src/App.jsx');
    assert.match(constants, /CONTRIBUTOR_SELF_SOURCE_LABEL/);
    assert.match(constants, /id: 'received'/);
    assert.match(api, /contributorSelf/);
    assert.match(api, /contributorReceivedPending/);
    assert.match(api, /mil_upload_batches!inner/);
    assert.match(dash, /media-dashboard-received/);
    assert.match(dash, /Received from contributors/);
    assert.match(review, /media-received-from-contributors|From contributors/);
    assert.match(app, /path="received"/);
  });

  it('UI uses Contributor Workspace labels and /contributor alias', () => {
    const app = read('src/App.jsx');
    const portal = read('src/pages/creator/CreatorPortalLayout.jsx');
    const workspace = read('src/pages/crm/media/MediaCreatorWorkspace.jsx');
    assert.match(app, /path="\/contributor/);
    assert.match(portal, /Contributor Workspace/);
    assert.match(workspace, /Contributor Workspace/);
    assert.match(workspace, /allowOriginal:\s*false/);
  });

  it('login allows /contributor next and defaults creators to /creator', () => {
    const login = read('src/pages/Login.jsx');
    assert.match(login, /\/contributor/);
    assert.match(login, /navigate\('\/creator'/);
  });

  it('tight UI: top brief + standing rules; thumb cards without filename labels; search gated', () => {
    const workspace = read('src/pages/crm/media/MediaCreatorWorkspace.jsx');
    assert.match(workspace, /summarizeContributorBrief/);
    assert.match(workspace, /contributor-job-brief/);
    assert.match(workspace, /contributor-standing-rules/);
    assert.match(workspace, /CONTRIBUTOR_STANDING_RULES/);
    assert.match(workspace, /contributor-download-all/);
    assert.match(workspace, /Download all/);
    assert.match(workspace, /lg:grid-cols-3/);
    assert.match(workspace, /contributor-next-submit/);
    assert.match(workspace, /approvedUseChips/);
    assert.match(workspace, /pickContributorThumbKind/);
    assert.match(workspace, /CONTRIBUTOR_SEARCH_MIN_COUNT/);
    assert.match(workspace, /contributor-media-search/);
    assert.doesNotMatch(workspace, /workingCopyPresentation/);
    assert.doesNotMatch(workspace, /allowOriginal:\s*true/);
  });

  it('owner assign requires a creative brief', () => {
    const settings = read('src/pages/crm/media/MediaSettings.jsx');
    assert.match(settings, /isValidContributorBrief/);
    assert.match(settings, /contributor-assign-brief/);
    assert.match(settings, /Brief for contributor/);
  });
});

describe('contributorWorkspace helpers', () => {
  it('workingCopyPresentation never presents HEIC as the deliverable', () => {
    const heic = workingCopyPresentation({
      original_filename: 'IMG_5010.HEIC',
      mime_type: 'image/heic',
    });
    assert.equal(heic.sourceWasHeic, true);
    assert.equal(heic.workingCopyLabel, 'Working copy (JPEG)');
    assert.match(heic.title, /from HEIC/);
    assert.match(heic.workingCopyHint, /not the protected HEIC original/i);

    const jpeg = workingCopyPresentation({ original_filename: 'IMG_0561.jpeg' });
    assert.equal(jpeg.sourceWasHeic, false);
    assert.equal(jpeg.title, 'IMG_0561.jpeg');
  });

  it('looksLikeInventoryNote filters pack/AI-score metadata', () => {
    assert.equal(
      looksLikeInventoryNote('Website-suitable pack 10 - IMG_4935.HEIC (AI website score 0.70)'),
      true,
    );
    assert.equal(looksLikeInventoryNote('Cut a 15s reel from these duct shots.'), false);
    assert.equal(looksLikeInventoryNote(''), false);
  });

  it('summarizeContributorBrief collapses inventory rows into one job brief', () => {
    const brief = summarizeContributorBrief([
      {
        id: '1',
        asset_id: 'a1',
        notes: 'Website-suitable pack 10 - IMG_4935.HEIC (AI website score 0.70)',
        requested_output: 'reel',
        due_at: '2026-08-01',
      },
      {
        id: '2',
        asset_id: 'a2',
        instructions: 'Cut a 15s reel from these duct shots.',
        requested_output: 'reel',
        due_at: '2026-08-01',
      },
      {
        id: '3',
        asset_id: 'a3',
        notes: 'Website-suitable pack 10 - IMG_0761.jpeg (AI website score 0.85)',
        requested_output: 'reel',
      },
    ]);
    assert.equal(brief.assignmentCount, 3);
    assert.equal(brief.assetCount, 3);
    assert.equal(brief.hasCreativeBrief, true);
    assert.deepEqual(brief.briefs, ['Cut a 15s reel from these duct shots.']);
    assert.deepEqual(brief.outputs, ['reel']);
    assert.equal(brief.dues.length, 1);
    assert.equal(brief.primaryDueAt, '2026-08-01');
    assert.match(brief.packSummary, /3 working copies/);
    assert.match(brief.packSummary, /Output: reel/);
  });

  it('isValidContributorBrief rejects empty and inventory notes', () => {
    assert.equal(isValidContributorBrief(''), false);
    assert.equal(isValidContributorBrief('short'), false);
    assert.equal(
      isValidContributorBrief('Website-suitable pack 10 - IMG_4935.HEIC (AI website score 0.70)'),
      false,
    );
    assert.equal(isValidContributorBrief('Cut a 15s reel from these duct shots.'), true);
  });

  it('pickContributorThumbKind prefers grid_thumb then detail_preview', () => {
    assert.equal(
      pickContributorThumbKind([{ kind: 'creator_download' }, { kind: 'detail_preview' }]),
      'detail_preview',
    );
    assert.equal(
      pickContributorThumbKind([{ kind: 'grid_thumb' }, { kind: 'detail_preview' }]),
      'grid_thumb',
    );
    assert.equal(pickContributorThumbKind([]), null);
  });

  it('filterAssignedMedia searches filename within the assigned set only', () => {
    const assets = [
      { id: 'a', original_filename: 'IMG_5010.HEIC', media_kind: 'photo' },
      { id: 'b', original_filename: 'smoke.jpg', media_kind: 'photo' },
    ];
    assert.equal(filterAssignedMedia(assets, '5010').length, 1);
    assert.equal(filterAssignedMedia(assets, 'photo').length, 2);
    assert.equal(filterAssignedMedia(assets, 'zzz').length, 0);
    assert.equal(filterAssignedMedia(assets, '').length, 2);
  });

  it('approvedUseChips only includes approved use keys', () => {
    const chips = approvedUseChips([
      { use_key: 'reel_creation', approved: true },
      { use_key: 'social_photo', approved: false },
      { use_key: 'website_service_proof', approved: true },
    ]);
    assert.deepEqual(
      chips.map((c) => c.key),
      ['reel_creation', 'website_service_proof'],
    );
    assert.match(chips[0].label, /Reel/i);
  });

  it('standing rules and search gate constants stay honest', () => {
    assert.match(CONTRIBUTOR_STANDING_RULES, /Working copies only/i);
    assert.match(CONTRIBUTOR_STANDING_RULES, /HEIC/i);
    assert.equal(CONTRIBUTOR_SEARCH_MIN_COUNT, 12);
  });
});
