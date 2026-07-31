/**
 * Fix B — in-queue reel selection / preview (Review Queue + Received).
 * Run: node --test tests/unit/media-intel-reel-queue-select.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PREVIEW_STATES,
  buildReelReviewPath,
  resolveReelPreviewAccess,
} from '../../src/lib/mediaIntel/previewAccess.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

describe('buildReelReviewPath', () => {
  it('retains the correct versionId deep link', () => {
    const id = '81d820b9-e99e-4394-bb33-fa58741daaa5';
    assert.equal(buildReelReviewPath(id), `/media/reel-review?versionId=${encodeURIComponent(id)}`);
    assert.equal(buildReelReviewPath(null), '/media/reel-review');
  });
});

describe('resolveReelPreviewAccess', () => {
  it('available reel renders ready with preview URL (inline video)', async () => {
    const access = await resolveReelPreviewAccess('ver-ok', {
      requestSignedMediaUrl: async ({ reelVersionId, purpose }) => {
        assert.equal(reelVersionId, 'ver-ok');
        return { url: `https://example.test/reel-${purpose}.mp4`, kind: 'reel_version' };
      },
      probeSignedMediaUrl: async () => ({ ok: true, status: 206, expired: false }),
    });
    assert.equal(access.state, PREVIEW_STATES.READY);
    assert.equal(access.canPreview, true);
    assert.match(access.url, /reel-preview\.mp4/);
  });

  it('missing reel source shows Fix A source_missing / File unavailable', async () => {
    const err = new Error('Source object not found in storage');
    err.code = 'SOURCE_OBJECT_MISSING';
    const access = await resolveReelPreviewAccess('ver-missing', {
      requestSignedMediaUrl: async () => {
        throw err;
      },
      probeSignedMediaUrl: async () => ({ ok: false, status: 404, expired: false }),
    });
    assert.equal(access.state, PREVIEW_STATES.SOURCE_MISSING);
    assert.equal(access.title, 'File unavailable');
    assert.equal(access.canDownload, false);
    assert.doesNotMatch(access.message, /HEIC/i);
  });
});

describe('Review Queue / Received reel selection contracts', () => {
  it('clicking a reel selects it without navigating away', () => {
    const review = read('src/pages/crm/media/MediaReviewQueue.jsx');
    assert.match(review, /const selectQueueRow = \(row\) =>/);
    assert.match(review, /onClick=\{\(\) => selectQueueRow\(row\)\}/);
    assert.doesNotMatch(review, /navigate\(`\/media\/reel-review/);
    assert.doesNotMatch(review, /useNavigate/);
  });

  it('Open in Reel Review is a separate action with versionId deep link', () => {
    const review = read('src/pages/crm/media/MediaReviewQueue.jsx');
    assert.match(review, /media-review-open-reel-review/);
    assert.match(review, /Open in Reel Review/);
    assert.match(review, /buildReelReviewPath\(selectedReelVersionId\)/);
    assert.match(review, /resolveReviewReelPreviewAccess/);
    assert.match(review, /media-review-inline-video/);
  });

  it('review actions remain usable from the queue', () => {
    const review = read('src/pages/crm/media/MediaReviewQueue.jsx');
    assert.match(review, /media-review-submission-actions/);
    assert.match(review, /accept_into_library/);
    assert.match(review, /request_changes/);
    // Actions live outside the row button (no nested navigation side effects).
    assert.match(review, /data-testid="media-review-queue-row"/);
  });

  it('non-reel asset selection path is unchanged (asset preview resolver)', () => {
    const review = read('src/pages/crm/media/MediaReviewQueue.jsx');
    assert.match(review, /resolveReviewPreviewAccess\(b\.asset\)/);
    assert.match(review, /!selectedReelVersionId/);
  });

  it('Review Queue and Received share MediaReviewQueue (contributorOnly)', () => {
    const app = read('src/App.jsx');
    assert.match(app, /MediaReviewQueue/);
    assert.match(app, /contributorOnly/);
    assert.match(app, /path="received"/);
    assert.match(app, /path="review"/);
  });

  it('direct ?versionId= Reel Review URL still focuses the intended version', () => {
    const reel = read('src/pages/crm/media/MediaReelReview.jsx');
    assert.match(reel, /focusVersionId = searchParams\.get\('versionId'\)/);
    assert.match(reel, /reel-version-\$\{focusVersionId\}/);
    assert.match(reel, /focusVersionId === v\.id/);
    assert.match(reel, /scrollIntoView/);
  });

  it('Reel Review remains in nav', () => {
    const constants = read('src/lib/mediaIntel/constants.js');
    assert.match(constants, /id: 'reel-review'/);
  });
});
