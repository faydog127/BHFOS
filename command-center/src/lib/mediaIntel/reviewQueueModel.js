/**
 * Review Queue / Received view-model helpers (Fix C).
 * Actionable queues are unified mil_submissions only — never staff/legacy assets.
 * Keep this module Node-testable without pulling Vite-only import graphs.
 */

const TYPE_BADGES = {
  reel: 'REEL',
  raw_video: 'RAW VIDEO',
  social_post: 'SOCIAL POST',
};

export function submissionPrimaryAsset(submission) {
  const links = [...(submission?.mil_submission_assets || [])].sort(
    (a, b) => (a.sort_order || 0) - (b.sort_order || 0),
  );
  return links[0]?.mil_assets || null;
}

/**
 * Whether the Review Queue should load standalone mil_assets into the list.
 * Fix C: never — contributor-submission filters are submission-driven only.
 */
export function shouldIncludeStaffIntakeAssets() {
  return false;
}

/**
 * Map listSubmissions rows into queue view-model rows.
 * Staff/legacy assets are intentionally not accepted here.
 */
export function buildSubmissionQueueRows(submissions) {
  return (submissions || []).map((s) => {
    const asset = submissionPrimaryAsset(s);
    return {
      kind: 'submission',
      id: `sub-${s.id}`,
      submissionId: s.id,
      assetId: asset?.id || null,
      reelVersionId: s.current_reel_version_id || null,
      submissionType: s.submission_type,
      typeBadge: TYPE_BADGES[s.submission_type] || s.submission_type,
      title: s.title || asset?.original_filename || 'Untitled',
      publicId: s.public_id,
      reviewStatus: s.review_status,
      actionOwner: s.action_owner,
      submittedAt: s.submitted_at,
      version: s.latest_version_number || 1,
      asset,
      submission: s,
    };
  });
}

/**
 * Pure predicate used by unit tests to document named-filter intent.
 * Mirrors listSubmissions({ queueFilter }) + default draft exclusion.
 */
export function submissionMatchesQueueFilter(submission, queueFilter) {
  if (!submission) return false;
  const status = String(submission.review_status || '');
  const type = String(submission.submission_type || '');
  const owner = String(submission.action_owner || '');

  if (status === 'draft') return false;

  switch (queueFilter) {
    case 'needs_review':
      return status === 'awaiting_owner_review' && owner === 'owner';
    case 'raw_video':
      return type === 'raw_video';
    case 'social_post':
      return type === 'social_post';
    case 'reel':
      return type === 'reel';
    case 'changes_requested':
      return status === 'changes_requested';
    case 'approved':
      return status === 'approved' || status === 'ready_to_post';
    case 'all':
      return true;
    default:
      return false;
  }
}

export function filterSubmissionsForQueue(submissions, queueFilter) {
  return (submissions || []).filter((s) => submissionMatchesQueueFilter(s, queueFilter));
}

/** Count must equal the rows the filter returns. */
export function queueCountForFilter(submissions, queueFilter) {
  return filterSubmissionsForQueue(submissions, queueFilter).length;
}
