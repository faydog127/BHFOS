/**
 * Fix C — Review Queue / Received filter semantics.
 * Run: node --test tests/unit/media-intel-review-queue-filters.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildSubmissionQueueRows,
  filterSubmissionsForQueue,
  queueCountForFilter,
  shouldIncludeStaffIntakeAssets,
  submissionMatchesQueueFilter,
} from '../../src/lib/mediaIntel/reviewQueueModel.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

const staffHeic = {
  id: 'asset-heic',
  original_filename: 'IMG_4862.HEIC',
  media_kind: 'photo',
  human_review_status: 'pending',
  mil_upload_batches: { source_label: 'Desktop transfer' },
};

const awaitingRaw = {
  id: 'sub-raw',
  public_id: 'SUB-RAW1',
  submission_type: 'raw_video',
  review_status: 'awaiting_owner_review',
  action_owner: 'owner',
  title: 'MVI_4463.mp4',
  latest_version_number: 1,
  submitted_at: '2026-07-31T00:00:00Z',
  mil_submission_assets: [],
};

const awaitingSocial = {
  id: 'sub-social',
  public_id: 'SUB-SOC1',
  submission_type: 'social_post',
  review_status: 'awaiting_owner_review',
  action_owner: 'owner',
  title: 'Gate social',
  latest_version_number: 1,
  submitted_at: '2026-07-31T00:01:00Z',
  mil_submission_assets: [],
};

const awaitingReel = {
  id: 'sub-reel',
  public_id: 'SUB-REEL1',
  submission_type: 'reel',
  review_status: 'awaiting_owner_review',
  action_owner: 'owner',
  title: 'IMG_4106.MP4',
  current_reel_version_id: 'ver-1',
  latest_version_number: 1,
  submitted_at: '2026-07-31T00:02:00Z',
  mil_submission_assets: [],
};

const changesReel = {
  id: 'sub-reel-cr',
  public_id: 'SUB-REEL2',
  submission_type: 'reel',
  review_status: 'changes_requested',
  action_owner: 'contributor',
  title: 'Smoke Reel',
  current_reel_version_id: 'ver-2',
  latest_version_number: 2,
  submitted_at: '2026-07-31T00:03:00Z',
  mil_submission_assets: [],
};

const uploadOnlyDraft = {
  id: 'sub-draft',
  public_id: 'SUB-DRAFT',
  submission_type: 'raw_video',
  review_status: 'draft',
  action_owner: 'contributor',
  title: 'Not submitted yet',
  latest_version_number: 1,
  mil_submission_assets: [],
};

const catalog = [awaitingRaw, awaitingSocial, awaitingReel, changesReel, uploadOnlyDraft];

describe('Fix C filter predicates', () => {
  it('staff HEIC photo is not a submission and is excluded from Needs review / Raw media', () => {
    assert.equal(shouldIncludeStaffIntakeAssets(), false);
    assert.equal(submissionMatchesQueueFilter(staffHeic, 'needs_review'), false);
    assert.equal(submissionMatchesQueueFilter(staffHeic, 'raw_video'), false);
    const rows = buildSubmissionQueueRows(catalog);
    assert.equal(rows.some((r) => r.title === 'IMG_4862.HEIC'), false);
  });

  it('awaiting-owner contributor submission included in Needs review', () => {
    assert.equal(submissionMatchesQueueFilter(awaitingRaw, 'needs_review'), true);
    assert.equal(submissionMatchesQueueFilter(awaitingSocial, 'needs_review'), true);
    assert.equal(submissionMatchesQueueFilter(awaitingReel, 'needs_review'), true);
    assert.equal(submissionMatchesQueueFilter(changesReel, 'needs_review'), false);
  });

  it('raw_video contributor submission included in Raw media; reel/social excluded', () => {
    assert.equal(submissionMatchesQueueFilter(awaitingRaw, 'raw_video'), true);
    assert.equal(submissionMatchesQueueFilter(awaitingReel, 'raw_video'), false);
    assert.equal(submissionMatchesQueueFilter(awaitingSocial, 'raw_video'), false);
  });

  it('reel excluded from Raw media and included in Reels (incl. changes-requested)', () => {
    assert.equal(submissionMatchesQueueFilter(awaitingReel, 'reel'), true);
    assert.equal(submissionMatchesQueueFilter(changesReel, 'reel'), true);
    assert.equal(submissionMatchesQueueFilter(awaitingRaw, 'reel'), false);
  });

  it('social package excluded from Raw media and included in Social posts', () => {
    assert.equal(submissionMatchesQueueFilter(awaitingSocial, 'social_post'), true);
    assert.equal(submissionMatchesQueueFilter(awaitingSocial, 'raw_video'), false);
  });

  it('changes-requested submission appears under Changes requested', () => {
    assert.equal(submissionMatchesQueueFilter(changesReel, 'changes_requested'), true);
    assert.equal(submissionMatchesQueueFilter(awaitingRaw, 'changes_requested'), false);
  });

  it('upload-only draft excluded from actionable filters', () => {
    for (const f of ['needs_review', 'raw_video', 'social_post', 'reel', 'changes_requested', 'all']) {
      assert.equal(submissionMatchesQueueFilter(uploadOnlyDraft, f), false, f);
    }
  });

  it('counts match the records returned', () => {
    const needs = filterSubmissionsForQueue(catalog, 'needs_review');
    assert.equal(queueCountForFilter(catalog, 'needs_review'), needs.length);
    assert.equal(needs.length, 3);
    assert.equal(queueCountForFilter(catalog, 'raw_video'), 1);
    assert.equal(queueCountForFilter(catalog, 'reel'), 2);
    assert.equal(queueCountForFilter(catalog, 'social_post'), 1);
    assert.equal(queueCountForFilter(catalog, 'changes_requested'), 1);
  });
});

describe('Fix C wiring + Fix A/B regressions', () => {
  it('Review Queue and Received share submission-only MediaReviewQueue', () => {
    const review = read('src/pages/crm/media/MediaReviewQueue.jsx');
    const app = read('src/App.jsx');
    assert.match(review, /buildSubmissionQueueRows/);
    assert.match(review, /shouldIncludeStaffIntakeAssets/);
    assert.doesNotMatch(review, /listAssets/);
    assert.doesNotMatch(review, /showStaffIntake/);
    assert.doesNotMatch(review, /staff phone-dump intake/);
    assert.match(review, /media-review-queue-count/);
    assert.match(app, /contributorOnly/);
    assert.match(app, /path="received"/);
  });

  it('listSubmissions named filters stay submission-state driven', () => {
    const api = read('src/lib/mediaIntel/api.js');
    assert.match(api, /queueFilter === 'needs_review'/);
    assert.match(api, /awaiting_owner_review/);
    assert.match(api, /action_owner',\s*'owner'|action_owner", "owner"|eq\('action_owner', 'owner'\)/);
    assert.match(api, /queueFilter === 'raw_video'/);
    assert.match(api, /queueFilter === 'changes_requested'/);
    assert.match(api, /neq\('review_status', 'draft'\)/);
  });

  it('Fix B reel in-queue selection remains', () => {
    const review = read('src/pages/crm/media/MediaReviewQueue.jsx');
    assert.match(review, /selectQueueRow/);
    assert.match(review, /media-review-open-reel-review/);
    assert.doesNotMatch(review, /navigate\(`\/media\/reel-review/);
  });

  it('Fix A preview-state wiring remains', () => {
    const review = read('src/pages/crm/media/MediaReviewQueue.jsx');
    assert.match(review, /resolveReviewPreviewAccess/);
    assert.match(review, /PREVIEW_STATES/);
    assert.match(review, /File unavailable|SOURCE_MISSING|source_missing/);
    assert.doesNotMatch(review, /HEIC may need a derivative/);
  });
});
