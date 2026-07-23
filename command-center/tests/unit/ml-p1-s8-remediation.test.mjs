import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  countValidEvidencePhotos,
  evaluateCompletionGates,
  isChecklistComplete,
  isValidEvidencePhoto,
  missingRequiredPhotoItemKeys,
  unansweredChecklistCount,
} from '../../src/lib/inspectionCompletionRules.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const remMig = fs.readFileSync(
  path.join(root, 'supabase/migrations/20260723200000_ml_p1_s8_security_functional_remediation.sql'),
  'utf8',
);

test('unit: pending/failed/voided photos are not valid evidence', () => {
  assert.equal(isValidEvidencePhoto({ upload_state: 'pending', is_voided: false }), false);
  assert.equal(isValidEvidencePhoto({ upload_state: 'failed', is_voided: false }), false);
  assert.equal(isValidEvidencePhoto({ upload_state: 'complete', is_voided: true }), false);
  assert.equal(isValidEvidencePhoto({ upload_state: 'complete', is_voided: false }), true);
  assert.equal(
    countValidEvidencePhotos([
      { upload_state: 'pending' },
      { upload_state: 'complete', is_voided: false },
      { upload_state: 'complete', is_voided: true },
    ]),
    1,
  );
});

test('unit: checklist completion requires answered items', () => {
  assert.equal(isChecklistComplete([]), false);
  assert.equal(isChecklistComplete([{ checked: null }]), false);
  assert.equal(isChecklistComplete([{ checked: true }, { checked: false }]), true);
  assert.equal(unansweredChecklistCount([{ checked: null }, { checked: true }]), 1);
});

test('unit: photo_required items need linked complete evidence', () => {
  const responses = [
    { item_key: 'a', photo_required: true, checked: true },
    { item_key: 'b', photo_required: false, checked: true },
  ];
  assert.deepEqual(
    missingRequiredPhotoItemKeys(responses, [{ checklist_item_key: 'a', upload_state: 'pending' }]),
    ['a'],
  );
  assert.deepEqual(
    missingRequiredPhotoItemKeys(responses, [
      { checklist_item_key: 'a', upload_state: 'complete', is_voided: false },
    ]),
    [],
  );
});

test('unit: evaluateCompletionGates allow and deny paths', () => {
  const deny = evaluateCompletionGates({
    responses: [{ item_key: 'a', photo_required: true, checked: null }],
    photos: [{ upload_state: 'pending' }],
  });
  assert.equal(deny.ok, false);
  assert.ok(deny.codes.includes('ML_P1_S8_CHECKLIST_INCOMPLETE'));
  assert.ok(deny.codes.includes('ML_P1_S8_REQUIRED_PHOTOS_MISSING'));

  const allow = evaluateCompletionGates({
    responses: [{ item_key: 'a', photo_required: true, checked: true }],
    photos: [{ checklist_item_key: 'a', upload_state: 'complete', is_voided: false }],
    photosWaveCompleteAt: '2026-07-23T00:00:00Z',
  });
  assert.equal(allow.ok, true);
});

test('remediation migration hardens DEFINER + finalize order + grants', () => {
  assert.match(remMig, /ml_p1_s8_assert_inspection_actor/);
  assert.match(remMig, /inspection_tenant_access/);
  assert.match(remMig, /ml_p1_s2_current_actor_role/);
  assert.match(remMig, /upload_state.*complete|lower\(coalesce\(p\.upload_state/);
  assert.match(remMig, /ml_p1_s8_assert_completion_gates/);
  assert.match(remMig, /PERFORM public\.ml_p1_s8_assert_completion_gates/);
  assert.match(remMig, /REVOKE ALL ON FUNCTION public\.ml_p1_s8_.* FROM PUBLIC, anon/);
  assert.match(remMig, /checklist_item_key/);
  assert.match(remMig, /reviewed_at IS NOT NULL/);
});

test('UI finalize calls assert before finalize_phase5', () => {
  const review = fs.readFileSync(path.join(root, 'src/pages/tech/TechInspectionReview.jsx'), 'utf8');
  const assertIdx = review.indexOf("ml_p1_s8_assert_photos_before_report");
  const finalizeIdx = review.indexOf("inspection_finalize_phase5");
  assert.ok(assertIdx > 0 && finalizeIdx > assertIdx);
});

test('offline budget never auto-evicts queued/failed', () => {
  const queue = fs.readFileSync(path.join(root, 'src/lib/offlineInspectionMediaQueue.js'), 'utf8');
  assert.match(queue, /status === 'uploaded'/);
  assert.match(queue, /discardQueuedOrFailed/);
  assert.doesNotMatch(
    queue,
    /filter\(\(r\) => r\.status === 'uploaded' \|\| r\.status === 'failed'\)/,
  );
});
