/**
 * Evidence-based MIL preview/download classification.
 * Run: node --test tests/unit/media-intel-preview-access.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PREVIEW_STATES,
  classifyPreviewAccess,
  isBrowserPreviewableOriginal,
  isHeicLikeAsset,
  previewStateCopy,
  resolveAssetPreviewAccess,
} from '../../src/lib/mediaIntel/previewAccess.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

describe('previewAccess helpers', () => {
  it('treats MP4/JPEG as browser-previewable and HEIC as not', () => {
    assert.equal(isBrowserPreviewableOriginal({ original_filename: 'MVI_4463.mp4', media_kind: 'video' }), true);
    assert.equal(isBrowserPreviewableOriginal({ original_filename: 'shot.jpg', mime_type: 'image/jpeg' }), true);
    assert.equal(isHeicLikeAsset({ original_filename: 'IMG_4862.HEIC' }), true);
    assert.equal(isBrowserPreviewableOriginal({ original_filename: 'IMG_4862.HEIC' }), false);
  });

  it('never uses HEIC-specific copy for source-missing or temporary states', () => {
    for (const state of Object.values(PREVIEW_STATES)) {
      const copy = previewStateCopy(state);
      assert.doesNotMatch(copy.title + copy.message, /HEIC/i);
    }
  });
});

describe('classifyPreviewAccess evidence distinctions', () => {
  it('MP4 source missing (sign code) → source_missing and download disabled', () => {
    const result = classifyPreviewAccess({
      asset: {
        id: 'a1',
        original_filename: 'MVI_4463.mp4',
        media_kind: 'video',
        processing_status: 'queued',
        mil_derivatives: [],
      },
      previewSign: {
        ok: false,
        code: 'SOURCE_OBJECT_MISSING',
        error: 'Source object not found in storage',
        kind: 'original',
      },
      sourceSign: {
        ok: false,
        code: 'SOURCE_OBJECT_MISSING',
        error: 'Source object not found in storage',
      },
    });
    assert.equal(result.state, PREVIEW_STATES.SOURCE_MISSING);
    assert.equal(result.title, 'File unavailable');
    assert.match(result.message, /could not be found in storage/i);
    assert.equal(result.canPreview, false);
    assert.equal(result.canDownload, false);
    assert.doesNotMatch(result.message, /HEIC/i);
  });

  it('social submission source missing (probe 404 on original) → source_missing', () => {
    const result = classifyPreviewAccess({
      asset: {
        id: 'a2',
        original_filename: 'social-gate.jpg',
        mime_type: 'image/jpeg',
        media_kind: 'photo',
        processing_status: 'queued',
        mil_derivatives: [],
      },
      previewSign: { ok: true, url: 'https://example.test/signed', kind: 'original' },
      probe: { ok: false, status: 404, expired: false },
      sourceSign: { ok: false, code: 'SOURCE_OBJECT_MISSING', error: 'Source object not found in storage' },
    });
    assert.equal(result.state, PREVIEW_STATES.SOURCE_MISSING);
    assert.equal(result.canDownload, false);
  });

  it('HEIC preview available → ready', () => {
    const result = classifyPreviewAccess({
      asset: {
        id: 'a3',
        original_filename: 'IMG_4862.HEIC',
        mime_type: 'image/heic',
        media_kind: 'photo',
        processing_status: 'analyzed',
        mil_derivatives: [{ kind: 'heic_preview', object_path: 'mil/x.jpg' }],
      },
      previewSign: { ok: true, url: 'https://example.test/heic-preview', kind: 'heic_preview' },
      probe: { ok: true, status: 206, expired: false },
      sourceSign: { ok: true },
    });
    assert.equal(result.state, PREVIEW_STATES.READY);
    assert.equal(result.canPreview, true);
    assert.equal(result.canDownload, true);
    assert.equal(result.url, 'https://example.test/heic-preview');
  });

  it('HEIC derivative pending (no derivative row, processing queued, source present) → derivative_pending', () => {
    const result = classifyPreviewAccess({
      asset: {
        id: 'a4',
        original_filename: 'IMG_pending.HEIC',
        media_kind: 'photo',
        processing_status: 'queued',
        mil_derivatives: [],
      },
      previewSign: { ok: false, error: 'No preview derivative' },
      sourceSign: { ok: true },
    });
    assert.equal(result.state, PREVIEW_STATES.DERIVATIVE_PENDING);
    assert.equal(result.canPreview, false);
    assert.equal(result.canDownload, true);
    assert.doesNotMatch(result.message, /could not be found in storage/i);
  });

  it('derivative processing failure → derivative_failed', () => {
    const result = classifyPreviewAccess({
      asset: {
        id: 'a5',
        original_filename: 'IMG_fail.HEIC',
        media_kind: 'photo',
        processing_status: 'processing_failed',
        mil_derivatives: [],
      },
      previewSign: { ok: false, error: 'No preview derivative' },
      sourceSign: { ok: true },
    });
    assert.equal(result.state, PREVIEW_STATES.DERIVATIVE_FAILED);
    assert.equal(result.canDownload, true);
  });

  it('derivative object 404 (row exists) is not source_missing', () => {
    const result = classifyPreviewAccess({
      asset: {
        id: 'a6',
        original_filename: 'IMG_4862.HEIC',
        media_kind: 'photo',
        processing_status: 'analyzed',
        mil_derivatives: [{ kind: 'heic_preview' }],
      },
      previewSign: { ok: true, url: 'https://example.test/der', kind: 'heic_preview' },
      probe: { ok: false, status: 404, expired: false },
      sourceSign: { ok: true },
    });
    assert.equal(result.state, PREVIEW_STATES.DERIVATIVE_FAILED);
    assert.notEqual(result.state, PREVIEW_STATES.SOURCE_MISSING);
  });

  it('expired signed URL is temporarily unavailable, not missing', () => {
    const result = classifyPreviewAccess({
      asset: {
        id: 'a7',
        original_filename: 'clip.mp4',
        media_kind: 'video',
        mil_derivatives: [],
      },
      previewSign: { ok: true, url: 'https://example.test/expired', kind: 'original' },
      probe: { ok: false, status: 400, expired: true },
      sourceSign: { ok: true },
    });
    assert.equal(result.state, PREVIEW_STATES.TEMPORARILY_UNAVAILABLE);
  });

  it('valid previewable MP4 → ready with download enabled', () => {
    const result = classifyPreviewAccess({
      asset: {
        id: 'a8',
        original_filename: 'good.mp4',
        media_kind: 'video',
        processing_status: 'analyzed',
        mil_derivatives: [],
      },
      previewSign: { ok: true, url: 'https://example.test/good.mp4', kind: 'original' },
      probe: { ok: true, status: 206, expired: false },
      sourceSign: { ok: true },
    });
    assert.equal(result.state, PREVIEW_STATES.READY);
    assert.equal(result.canPreview, true);
    assert.equal(result.canDownload, true);
  });

  it('null preview URL alone is not treated as source missing', () => {
    const result = classifyPreviewAccess({
      asset: {
        id: 'a9',
        original_filename: 'clip.mp4',
        media_kind: 'video',
        processing_status: 'queued',
        mil_derivatives: [],
      },
      previewSign: null,
      sourceSign: null,
    });
    assert.notEqual(result.state, PREVIEW_STATES.SOURCE_MISSING);
    assert.equal(result.state, PREVIEW_STATES.TEMPORARILY_UNAVAILABLE);
  });
});

describe('resolveAssetPreviewAccess integration (mocked sign/probe)', () => {
  it('MP4 source missing disables download', async () => {
    const asset = {
      id: 'mp4-missing',
      original_filename: 'MVI_4463.mp4',
      media_kind: 'video',
      processing_status: 'queued',
      mil_derivatives: [],
    };
    const err = new Error('Source object not found in storage');
    err.code = 'SOURCE_OBJECT_MISSING';
    err.kind = 'original';
    const access = await resolveAssetPreviewAccess(asset, {
      requestSignedMediaUrl: async () => {
        throw err;
      },
      probeSignedMediaUrl: async () => ({ ok: false, status: 404, expired: false }),
    });
    assert.equal(access.state, PREVIEW_STATES.SOURCE_MISSING);
    assert.equal(access.canDownload, false);
  });

  it('HEIC with preview derivative resolves ready', async () => {
    const asset = {
      id: 'heic-ok',
      original_filename: 'IMG_4862.HEIC',
      media_kind: 'photo',
      processing_status: 'analyzed',
      mil_derivatives: [{ kind: 'heic_preview' }],
    };
    const access = await resolveAssetPreviewAccess(asset, {
      requestSignedMediaUrl: async ({ purpose, allowOriginal }) => {
        if (purpose === 'download' && allowOriginal) {
          return { url: 'https://example.test/original', kind: 'original' };
        }
        return { url: 'https://example.test/preview.jpg', kind: 'heic_preview' };
      },
      probeSignedMediaUrl: async () => ({ ok: true, status: 206, expired: false }),
    });
    assert.equal(access.state, PREVIEW_STATES.READY);
    assert.equal(access.canPreview, true);
    assert.equal(access.canDownload, true);
  });

  it('HEIC pending does not call original as preview', async () => {
    const asset = {
      id: 'heic-pending',
      original_filename: 'IMG_new.HEIC',
      media_kind: 'photo',
      processing_status: 'queued',
      mil_derivatives: [],
    };
    const calls = [];
    const access = await resolveAssetPreviewAccess(asset, {
      requestSignedMediaUrl: async (args) => {
        calls.push(args);
        if (args.purpose === 'download') {
          return { url: 'https://example.test/original', kind: 'original' };
        }
        throw new Error('should not preview-sign without derivative');
      },
      probeSignedMediaUrl: async () => ({ ok: true, status: 200, expired: false }),
    });
    assert.equal(access.state, PREVIEW_STATES.DERIVATIVE_PENDING);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].purpose, 'download');
    assert.equal(calls[0].allowOriginal, true);
  });
});

describe('Review Queue / Received wiring contracts', () => {
  it('MediaReviewQueue uses resolveReviewPreviewAccess and no HEIC-only fallback copy', () => {
    const page = read('src/pages/crm/media/MediaReviewQueue.jsx');
    assert.match(page, /resolveReviewPreviewAccess/);
    assert.match(page, /media-review-preview-fallback/);
    assert.match(page, /media-review-download/);
    assert.match(page, /PREVIEW_STATES/);
    assert.doesNotMatch(page, /HEIC may need a derivative/);
  });

  it('api exports resolveReviewPreviewAccess', () => {
    const api = read('src/lib/mediaIntel/api.js');
    assert.match(api, /export async function resolveReviewPreviewAccess/);
  });

  it('sign edge returns structured SOURCE_OBJECT_MISSING / DERIVATIVE_OBJECT_MISSING', () => {
    const sign = read('supabase/functions/media-intel-sign/index.ts');
    assert.match(sign, /SOURCE_OBJECT_MISSING/);
    assert.match(sign, /DERIVATIVE_OBJECT_MISSING/);
    assert.match(sign, /isStorageObjectMissingMessage/);
  });
});
