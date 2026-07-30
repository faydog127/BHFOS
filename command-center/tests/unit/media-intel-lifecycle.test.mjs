/**
 * MIL Quality Cleanup lifecycle helpers.
 * Run: node --test tests/unit/media-intel-lifecycle.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  deriveLifecycleRecommendation,
  isPermanentDeleteEligible,
  isQualityCleanupCandidate,
  normalizeLifecycleRecommendation,
  normalizeQualityIssues,
  permanentDeleteCountdownLabel,
} from '../../src/lib/mediaIntel/lifecycleHelpers.js';

describe('MIL lifecycle helpers', () => {
  it('normalizes lifecycle recommendations', () => {
    assert.equal(normalizeLifecycleRecommendation('KEEP_INTERNAL'), 'keep_internal');
    assert.equal(normalizeLifecycleRecommendation('needs-review'), 'human_review');
    assert.equal(normalizeLifecycleRecommendation('nope'), null);
  });

  it('filters quality issues to known vocab', () => {
    assert.deepEqual(normalizeQualityIssues(['blurry', 'FACE', 'too dark', 'blurry']), [
      'blurry',
      'too_dark',
    ]);
  });

  it('derives archive/trash/keep from usability + issues', () => {
    assert.equal(deriveLifecycleRecommendation({ usability: 'good' }), 'keep');
    assert.equal(deriveLifecycleRecommendation({ usability: 'limited' }), 'keep_internal');
    assert.equal(
      deriveLifecycleRecommendation({ usability: 'poor', qualityIssues: ['blurry'] }),
      'archive',
    );
    assert.equal(
      deriveLifecycleRecommendation({ usability: 'unusable', qualityIssues: ['unrelated'] }),
      'trash',
    );
    assert.equal(
      deriveLifecycleRecommendation({ usability: 'good', needsHumanReview: true }),
      'human_review',
    );
  });

  it('permanent delete eligibility requires trash + elapsed retention', () => {
    const now = Date.parse('2026-07-28T12:00:00.000Z');
    assert.equal(isPermanentDeleteEligible({ trashed_at: null }, { now }), false);
    assert.equal(
      isPermanentDeleteEligible(
        {
          trashed_at: '2026-06-01T00:00:00.000Z',
          purge_eligible_at: '2026-07-29T00:00:00.000Z',
        },
        { now },
      ),
      false,
    );
    assert.equal(
      isPermanentDeleteEligible(
        {
          trashed_at: '2026-06-01T00:00:00.000Z',
          purge_eligible_at: '2026-07-01T00:00:00.000Z',
        },
        { now },
      ),
      true,
    );
    assert.match(
      permanentDeleteCountdownLabel(
        {
          trashed_at: '2026-06-01T00:00:00.000Z',
          purge_eligible_at: '2026-07-30T00:00:00.000Z',
        },
        { now },
      ),
      /Eligible in \d+ day/,
    );
  });

  it('quality cleanup candidates exclude archived/trashed/kept', () => {
    assert.equal(
      isQualityCleanupCandidate({
        ai_lifecycle_recommendation: 'archive',
        archived_at: null,
        trashed_at: null,
        lifecycle_kept_at: null,
      }),
      true,
    );
    assert.equal(
      isQualityCleanupCandidate({
        ai_lifecycle_recommendation: 'archive',
        archived_at: '2026-07-01T00:00:00.000Z',
      }),
      false,
    );
    assert.equal(
      isQualityCleanupCandidate({
        ai_usability: 'poor',
        lifecycle_kept_at: '2026-07-01T00:00:00.000Z',
      }),
      false,
    );
  });
});

describe('MIL lifecycle source contracts', () => {
  it('migration defines trash + lifecycle RPC and never AI-auto-delete', async () => {
    const { readFileSync } = await import('node:fs');
    const { dirname, join } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
    const mig = readFileSync(
      join(root, 'supabase/migrations/20260728120000_media_intel_quality_cleanup_lifecycle.sql'),
      'utf8',
    );
    const analyze = readFileSync(join(root, 'supabase/functions/media-intel-analyze/index.ts'), 'utf8');
    assert.match(mig, /trashed_at/);
    assert.match(mig, /purge_eligible_at/);
    assert.match(mig, /mil_set_asset_lifecycle/);
    assert.match(mig, /mil_set_assets_lifecycle/);
    assert.match(mig, /permanent_delete/);
    assert.match(mig, /interval '30 days'/);
    assert.match(mig, /trashed_at is null/);
    assert.match(analyze, /lifecycle_recommendation/);
    assert.match(analyze, /quality_issues/);
    assert.match(analyze, /Advisory disposition only/);
    assert.doesNotMatch(analyze, /trashed_at:\s*new Date|trashed_at:\s*now/i);
    assert.doesNotMatch(analyze, /\.update\(\{[^}]*trashed_at/);
  });

  it('UI wires Keep Archive Trash and Quality Cleanup route', async () => {
    const { readFileSync } = await import('node:fs');
    const { dirname, join } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
    const review = readFileSync(join(root, 'src/pages/crm/media/MediaReviewQueue.jsx'), 'utf8');
    const cleanup = readFileSync(join(root, 'src/pages/crm/media/MediaQualityCleanup.jsx'), 'utf8');
    const archive = readFileSync(join(root, 'src/pages/crm/media/MediaArchive.jsx'), 'utf8');
    const app = readFileSync(join(root, 'src/App.jsx'), 'utf8');
    const api = readFileSync(join(root, 'src/lib/mediaIntel/api.js'), 'utf8');
    assert.match(review, /media-review-keep/);
    assert.match(review, /media-review-archive/);
    assert.match(review, /media-review-trash/);
    assert.match(review, /media-review-queue-thumb/);
    assert.match(review, /media-review-queue-thumb-fallback/);
    assert.match(review, /assetPreviewUrl/);
    assert.match(review, /loadQueueThumbs/);
    assert.doesNotMatch(review, /allowOriginal:\s*true/);
    assert.doesNotMatch(review, /createSignedUrl/);
    assert.match(cleanup, /media-quality-cleanup/);
    assert.match(cleanup, /setAssetsLifecycle/);
    assert.match(archive, /permanentlyDeleteAsset/);
    assert.match(app, /quality-cleanup/);
    assert.match(api, /mil_set_asset_lifecycle/);
    assert.match(api, /qualityCleanup/);
    assert.match(api, /allowOriginal:\s*false/);
    assert.match(api, /no direct storage fallback/i);
    assert.match(api, /PREVIEW_DERIVATIVE_KINDS/);
  });
});
