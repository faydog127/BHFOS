const asText = (value) => (typeof value === 'string' ? value.trim() : '');

const APPROVED_AI_STATUSES = new Set(['accepted', 'edited']);
const APPROVED_MANUAL_STATUS = 'approved';
const EXCLUDED_MANUAL_STATUSES = new Set(['draft', 'rejected', 'voided', 'not_relevant']);

const suggestionById = (suggestions = []) => {
  const map = new Map();
  (suggestions || []).forEach((row) => {
    if (row?.id) map.set(row.id, row);
  });
  return map;
};

const conditionStatusOf = (finding) => asText(finding?.condition_status).toLowerCase() || 'draft';

/**
 * Approved structured condition for the Findings narrative:
 * - AI-backed: source suggestion status is accepted or edited
 * - Manual (no source_ai_suggestion_id): condition_status must be approved
 * - Excludes draft / unresolved / rejected / not_relevant / voided manuals
 * - Excludes rejected / irrelevant / pending AI suggestions
 * - is_customer_visible is ignored (internal conditions remain eligible)
 */
export const listApprovedConditions = (findings = [], suggestions = []) => {
  const byId = suggestionById(suggestions);
  return (findings || []).filter((finding) => {
    if (!finding?.id) return false;

    const sourceId = finding.source_ai_suggestion_id;
    if (sourceId) {
      const suggestion = byId.get(sourceId);
      if (!suggestion) return false;
      return APPROVED_AI_STATUSES.has(asText(suggestion.status).toLowerCase());
    }

    const status = conditionStatusOf(finding);
    if (EXCLUDED_MANUAL_STATUSES.has(status)) return false;
    return status === APPROVED_MANUAL_STATUS;
  });
};

/** Narrative prose gate: non-empty text only. No vocabulary blacklist. */
export const isNarrativeProse = (value) => Boolean(asText(value));

/** @deprecated use isNarrativeProse — kept for callers during hardening */
export const isCustomerSafeText = isNarrativeProse;

const uniqueTexts = (values) => {
  const seen = new Set();
  const out = [];
  (values || []).forEach((value) => {
    const text = asText(value);
    if (!text) return;
    const key = text.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(text);
  });
  return out;
};

/**
 * Evidence captions only — never recommendation/pricing fields.
 * Voided or incomplete photos are excluded by source state.
 */
const linkedCaptions = (condition, photos = []) => (
  (photos || [])
    .filter((photo) => (
      photo
      && photo.finding_id === condition.id
      && photo.is_voided !== true
      && (!photo.upload_state || photo.upload_state === 'complete')
    ))
    .map((photo) => photo.caption)
    .filter(isNarrativeProse)
);

export const buildConditionsFingerprint = (findings = [], suggestions = [], photos = []) => {
  const approved = listApprovedConditions(findings, suggestions);
  const parts = approved.map((finding) => {
    const captions = uniqueTexts(linkedCaptions(finding, photos)).sort().join('~');
    return [
      finding.id,
      asText(finding.title),
      asText(finding.description),
      captions,
    ].join('|');
  }).sort();
  return parts.join('||');
};

const joinProse = (items) => {
  if (!items.length) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join('; ')}; and ${items[items.length - 1]}`;
};

const ensureSentence = (text) => {
  const value = asText(text);
  if (!value) return '';
  return /[.!?]$/.test(value) ? value : `${value}.`;
};

/**
 * One consolidated customer Findings narrative from approved conditions + captions.
 * Uses only title/description/caption source fields — never recommended_action,
 * inspection_recommendations, or pricing columns.
 */
export const buildFindingsNarrative = (findings = [], suggestions = [], photos = []) => {
  const approved = listApprovedConditions(findings, suggestions);
  const conditionTexts = uniqueTexts(
    approved.map((finding) => {
      const description = asText(finding.description);
      const title = asText(finding.title);
      // Explicitly ignore recommended_action and any pricing fields on the row.
      if (isNarrativeProse(description)) return description.replace(/[.]+$/, '');
      if (isNarrativeProse(title)) return title.replace(/[.]+$/, '');
      return '';
    }),
  );

  const captionTexts = uniqueTexts(
    approved.flatMap((finding) => linkedCaptions(finding, photos)),
  ).filter((caption) => !conditionTexts.some((condition) => (
    condition.toLowerCase() === caption.toLowerCase()
    || condition.toLowerCase().includes(caption.toLowerCase())
    || caption.toLowerCase().includes(condition.toLowerCase())
  )));

  if (!conditionTexts.length && !captionTexts.length) return '';

  const parts = [];
  if (conditionTexts.length === 1) {
    parts.push(ensureSentence(conditionTexts[0]));
  } else if (conditionTexts.length > 1) {
    parts.push(ensureSentence(`The inspection documented these conditions: ${joinProse(conditionTexts)}`));
  }

  if (captionTexts.length) {
    parts.push(ensureSentence(`Supporting photos document ${joinProse(captionTexts)}`));
  }

  return parts.join(' ').replace(/\s+/g, ' ').trim();
};

export const narrativeNeedsReview = (status) => {
  const value = asText(status).toLowerCase() || 'draft';
  return value === 'draft' || value === 'generated' || value === 'stale' || !value;
};

/**
 * Decide displayed/persisted status when approved-condition fingerprint changes.
 * Never silently rewrites accepted/edited narrative text.
 */
export const resolveNarrativeStatusForFingerprint = ({
  summaryStatus,
  storedFingerprint,
  currentFingerprint,
} = {}) => {
  const status = asText(summaryStatus).toLowerCase() || 'draft';
  const stored = asText(storedFingerprint);
  const current = asText(currentFingerprint);
  if (!current) return status;
  if ((status === 'accepted' || status === 'edited') && stored && stored !== current) {
    return 'stale';
  }
  if (status === 'stale' && stored && stored === current) {
    return 'stale';
  }
  return status;
};

export const shouldAutoGenerateNarrative = () => false;

export const regenerateWillReplaceDraft = (summaryStatus, summary) => {
  const status = asText(summaryStatus).toLowerCase() || 'draft';
  if (status === 'accepted' || status === 'edited') return true;
  if (status === 'generated' && asText(summary)) return true;
  if (status === 'stale' && asText(summary)) return true;
  return false;
};
