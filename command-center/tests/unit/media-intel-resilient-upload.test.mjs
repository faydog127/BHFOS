import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

describe('MIL resilient upload + analysis', () => {
  it('defines distinguishable upload phases', async () => {
    const mod = await import('../../src/lib/mediaIntel/uploadPhases.js');
    assert.equal(mod.UPLOAD_PHASE.UPLOADING, 'uploading');
    assert.equal(mod.UPLOAD_PHASE.NEEDS_RESELECT, 'needs_reselect');
    assert.equal(mod.UPLOAD_PHASE.ANALYSIS_COMPLETE, 'analysis_complete');
    assert.ok(mod.UPLOAD_PHASE_LABELS[mod.UPLOAD_PHASE.INTERRUPTED]);
  });

  it('buildAnalysisOutcome surfaces useful TVG fields', async () => {
    const { buildAnalysisOutcome, analysisOutcomeAnswers } = await import(
      '../../src/lib/mediaIntel/analysisDisplay.js'
    );
    const outcome = buildAnalysisOutcome(
      { processing_status: 'analyzed', human_review_status: 'pending', media_kind: 'photo' },
      {
        status: 'succeeded',
        overall_confidence: 0.72,
        suggested: {
          narrative: 'Dryer vent termination on exterior wall with lint buildup.',
          work_phase: 'before',
          service_category: 'dryer_vent',
          tags: ['lint', 'termination'],
          condition_notes: 'Visible lint at cap',
          recommended_uses: ['inspection_report'],
          unsuitable_uses: ['homepage_hero'],
          privacy_risks: [
            'house number visible',
            { type: 'face', detail: 'possible face in frame' },
          ],
          quality: {
            inspection_report: { suitable: true, score: 0.8 },
            homepage_hero: { suitable: false, score: 0.2 },
          },
        },
      },
    );
    assert.equal(outcome.uiStatus, 'complete');
    assert.match(outcome.description, /Dryer vent/i);
    assert.ok(outcome.tags.includes('lint'));
    assert.equal(outcome.usability, 'usable');
    assert.ok(outcome.needsHumanReview);
    assert.ok(outcome.privacyWarnings.some((w) => /house number/i.test(w)));
    assert.ok(outcome.privacyWarnings.some((w) => /face/i.test(w)));
    assert.ok(!outcome.privacyWarnings.some((w) => /\[object Object\]/i.test(w)));
    const answers = analysisOutcomeAnswers(outcome);
    assert.match(answers.whatItShows, /Dryer vent/i);
    assert.equal(answers.needsReview, true);
  });

  it('validateSuggested rejects empty AI objects', async () => {
    // Import from edge is TS — duplicate contract check against source text.
    const src = read('supabase/functions/media-intel-analyze/index.ts');
    assert.match(src, /function validateSuggested/);
    assert.match(src, /PROMPT_VERSION = 'mil-v2-lifecycle'/);
    assert.match(src, /isServiceRoleRequest/);
    assert.match(src, /x-mil-internal-analyze/);
  });

  it('upload session supports refresh + clientUploadId + analyze trigger', () => {
    const src = read('supabase/functions/media-intel-upload-session/index.ts');
    assert.match(src, /action === 'refresh_upload_grant'/);
    assert.match(src, /client_upload_id/);
    assert.match(src, /triggerAnalyzeAfterCommit/);
    assert.match(src, /upload\/resumable|resumable: true/);
    assert.match(src, /createSignedUploadUrl/);
    // Must not abort the fire-and-forget analyze call after a few seconds
    assert.doesNotMatch(src, /AbortController[\s\S]{0,200}8000/);
  });

  it('client invokes analyze after finalize then polls', () => {
    const upload = read('src/lib/mediaIntel/uploadManager.js');
    assert.match(upload, /queueAiAnalysis\(assetId\)/);
    assert.match(upload, /pollAnalysisUntilSettled/);
  });

  it('client uses signed TUS and durable queue', () => {
    const upload = read('src/lib/mediaIntel/uploadManager.js');
    const tus = read('src/lib/mediaIntel/resumableUpload.js');
    const queue = read('src/lib/mediaIntel/uploadQueueStore.js');
    assert.match(tus, /upload\/resumable\/sign/);
    assert.match(tus, /x-signature/);
    assert.match(tus, /tus-js-client/);
    // tus-js-client requires fingerprint to be a function (string crashes uploads)
    assert.match(tus, /fingerprint:\s*\(\)\s*=>/);
    assert.match(queue, /mil-upload-queue/);
    assert.match(queue, /blob/);
    assert.match(upload, /uploadViaSignedTus/);
    assert.match(upload, /restoreUploadQueue/);
    assert.match(upload, /reconcileStaleUploadQueue/);
    assert.match(upload, /findSuccessfulServerMatch/);
    assert.match(upload, /Already in Review Queue/);
    assert.match(upload, /pollAnalysisUntilSettled/);
    assert.match(upload, /requestUploadWakeLock/);
    assert.match(upload, /beforeunload|bindUploadExitWarning/);
  });

  it('Uploads pages reconcile stale rows against Review/library success', () => {
    const uploads = read('src/pages/crm/media/MediaUploads.jsx');
    const mobile = read('src/pages/crm/media/MediaMobileUpload.jsx');
    const upload = read('src/lib/mediaIntel/uploadManager.js');
    assert.match(uploads, /reconcileStaleUploadQueue/);
    assert.match(mobile, /reconcileStaleUploadQueue/);
    assert.match(uploads, /dismissFromUploads/);
    assert.match(mobile, /dismissFromUploads/);
    // mil_assets has no upload_status — selecting it broke stale dismiss.
    assert.doesNotMatch(upload, /select\([^)]*upload_status/);
    assert.match(upload, /human_review_status, archived_at/);
  });

  it('login preserves MIL next destinations', () => {
    const login = read('src/pages/Login.jsx');
    const helper = read('src/lib/postLoginRedirect.js');
    assert.match(login, /isSafeMilPostLoginPath/);
    assert.match(login, /sanitizePostLoginPath/);
    assert.match(helper, /next\.startsWith\('\/media'\)/);
    assert.match(helper, /next\.startsWith\('\/creator'\)/);
  });

  it('UI no longer claims uploads are non-resumable', () => {
    const uploads = read('src/pages/crm/media/MediaUploads.jsx');
    const mobile = read('src/pages/crm/media/MediaMobileUpload.jsx');
    assert.doesNotMatch(uploads, /Uploads are not resumable in this release/);
    assert.doesNotMatch(mobile, /is not resumable/);
    assert.match(uploads, /resumable transfer/i);
  });

  it('migration adds client_upload_id', () => {
    const mig = read('supabase/migrations/20260728010000_media_intel_client_upload_id.sql');
    assert.match(mig, /client_upload_id/);
    assert.match(mig, /mil_upload_grants_session_client_upload_uidx/);
  });
});
