/**
 * Pure completion rules for ML-P1 S8 inspection workflow.
 * Server RPCs remain authoritative; this mirrors gates for UI + unit tests.
 */

export function isValidEvidencePhoto(photo) {
  if (!photo) return false;
  if (photo.is_voided === true) return false;
  const state = String(photo.upload_state || '').toLowerCase();
  return state === 'complete';
}

export function countValidEvidencePhotos(photos = []) {
  return (photos || []).filter(isValidEvidencePhoto).length;
}

export function unansweredChecklistCount(responses = []) {
  return (responses || []).filter((r) => r == null || r.checked === null || r.checked === undefined).length;
}

export function missingRequiredPhotoItemKeys(responses = [], photos = []) {
  const valid = (photos || []).filter(isValidEvidencePhoto);
  return (responses || [])
    .filter((r) => r?.photo_required === true)
    .filter((r) => !valid.some((p) => p.checklist_item_key === r.item_key))
    .map((r) => r.item_key);
}

export function isChecklistComplete(responses = []) {
  if (!responses?.length) return false;
  return unansweredChecklistCount(responses) === 0;
}

export function photosWaveSatisfied({ photos = [], photosWaveCompleteAt = null } = {}) {
  if (photosWaveCompleteAt) return true;
  return countValidEvidencePhotos(photos) >= 1;
}

/**
 * Full client-side mirror of ml_p1_s8_assert_completion_gates (allow path).
 */
export function evaluateCompletionGates({
  responses = [],
  photos = [],
  photosWaveCompleteAt = null,
  photosBeforeReportEnabled = true,
} = {}) {
  if (!photosBeforeReportEnabled) {
    return { ok: true, codes: [] };
  }
  const codes = [];
  if (!responses?.length) codes.push('ML_P1_S8_CHECKLIST_REQUIRED');
  if (unansweredChecklistCount(responses) > 0) codes.push('ML_P1_S8_CHECKLIST_INCOMPLETE');
  const missing = missingRequiredPhotoItemKeys(responses, photos);
  if (missing.length) codes.push('ML_P1_S8_REQUIRED_PHOTOS_MISSING');
  if (!photosWaveCompleteAt && countValidEvidencePhotos(photos) < 1) {
    codes.push('ML_P1_S8_PHOTOS_REQUIRED');
  }
  return { ok: codes.length === 0, codes, missingPhotoItemKeys: missing };
}
