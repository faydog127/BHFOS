/**
 * Quality Cleanup lifecycle helpers (pure — no network).
 * AI recommends disposition; humans apply Keep / Archive / Trash.
 */

export const LIFECYCLE_ACTIONS = Object.freeze({
  KEEP: 'keep',
  ARCHIVE: 'archive',
  TRASH: 'trash',
  RESTORE: 'restore',
  PERMANENT_DELETE: 'permanent_delete',
});

export const LIFECYCLE_RECOMMENDATIONS = Object.freeze({
  KEEP: 'keep',
  KEEP_INTERNAL: 'keep_internal',
  ARCHIVE: 'archive',
  TRASH: 'trash',
  HUMAN_REVIEW: 'human_review',
});

export const QUALITY_ISSUE_VOCAB = Object.freeze([
  'blurry',
  'too_dark',
  'duplicate',
  'badly_framed',
  'obstructed_view',
  'accidental',
  'unrelated',
  'overexposed',
  'low_resolution',
]);

export const LIFECYCLE_RECOMMENDATION_LABELS = Object.freeze({
  keep: 'Keep',
  keep_internal: 'Keep for internal / report use',
  archive: 'Recommend archive',
  trash: 'Recommend trash',
  human_review: 'Require human review',
});

export const QUALITY_ISSUE_LABELS = Object.freeze({
  blurry: 'Blurry',
  too_dark: 'Too dark',
  duplicate: 'Duplicate',
  badly_framed: 'Badly framed',
  obstructed_view: 'Obstructed view',
  accidental: 'Accidental photo',
  unrelated: 'Unrelated',
  overexposed: 'Overexposed',
  low_resolution: 'Low resolution',
});

const REC_SET = new Set(Object.values(LIFECYCLE_RECOMMENDATIONS));
const ISSUE_SET = new Set(QUALITY_ISSUE_VOCAB);

/** Normalize AI lifecycle_recommendation to a known value or null. */
export function normalizeLifecycleRecommendation(raw) {
  const v = String(raw || '')
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, '_');
  if (REC_SET.has(v)) return v;
  if (v === 'keep_for_internal' || v === 'internal' || v === 'report_use') return 'keep_internal';
  if (v === 'review' || v === 'needs_review') return 'human_review';
  return null;
}

/** Filter quality_issues to known vocabulary. */
export function normalizeQualityIssues(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const item of raw) {
    const v = String(item || '')
      .toLowerCase()
      .trim()
      .replace(/[\s-]+/g, '_');
    if (ISSUE_SET.has(v) && !out.includes(v)) out.push(v);
  }
  return out.slice(0, 12);
}

/**
 * Derive a recommended action when the model omitted lifecycle_recommendation.
 * Never returns permanent_delete.
 */
export function deriveLifecycleRecommendation({ usability, qualityIssues = [], needsHumanReview } = {}) {
  const issues = normalizeQualityIssues(qualityIssues);
  const u = String(usability || '').toLowerCase();
  if (needsHumanReview || u === 'unknown') return LIFECYCLE_RECOMMENDATIONS.HUMAN_REVIEW;
  if (u === 'unusable' || issues.includes('unrelated') || issues.includes('accidental')) {
    return LIFECYCLE_RECOMMENDATIONS.TRASH;
  }
  if (u === 'poor' || issues.some((i) => ['blurry', 'too_dark', 'badly_framed', 'duplicate', 'obstructed_view'].includes(i))) {
    return LIFECYCLE_RECOMMENDATIONS.ARCHIVE;
  }
  if (u === 'limited') return LIFECYCLE_RECOMMENDATIONS.KEEP_INTERNAL;
  if (u === 'good' || u === 'usable') return LIFECYCLE_RECOMMENDATIONS.KEEP;
  return LIFECYCLE_RECOMMENDATIONS.HUMAN_REVIEW;
}

/** Permanent delete is owner-only and only after purge_eligible_at. */
export function isPermanentDeleteEligible(asset, { now = Date.now() } = {}) {
  if (!asset?.trashed_at) return false;
  if (!asset.purge_eligible_at) return false;
  const eligible = new Date(asset.purge_eligible_at).getTime();
  if (!Number.isFinite(eligible)) return false;
  return eligible <= now;
}

export function permanentDeleteCountdownLabel(asset, { now = Date.now() } = {}) {
  if (!asset?.trashed_at) return null;
  if (isPermanentDeleteEligible(asset, { now })) return 'Eligible for permanent delete';
  const eligible = new Date(asset.purge_eligible_at || 0).getTime();
  if (!Number.isFinite(eligible)) return 'Retention period pending';
  const days = Math.max(1, Math.ceil((eligible - now) / 864e5));
  return `Eligible in ${days} day${days === 1 ? '' : 's'}`;
}

/** Assets that belong on the Quality Cleanup worklist. */
export function isQualityCleanupCandidate(asset) {
  if (!asset) return false;
  if (asset.archived_at || asset.trashed_at || asset.lifecycle_kept_at) return false;
  const rec = normalizeLifecycleRecommendation(asset.ai_lifecycle_recommendation);
  if (rec === 'archive' || rec === 'trash') return true;
  const u = String(asset.ai_usability || '').toLowerCase();
  if (u === 'poor' || u === 'unusable') return true;
  const issues = normalizeQualityIssues(asset.ai_quality_issues || []);
  return issues.length > 0;
}
