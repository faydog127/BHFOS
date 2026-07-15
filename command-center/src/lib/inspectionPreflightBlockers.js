const CATEGORY_META = {
  FINDING_WITHOUT_EVIDENCE: {
    groupKey: 'missing_evidence',
    title: 'This finding needs a photo',
    actionLabel: 'Add or select photo',
    tab: 'findings',
    target: 'findings',
    step: 'findings',
  },
  CONTRADICTORY_COMPONENT_CONCLUSION: {
    groupKey: 'contradictory_findings',
    title: 'These findings disagree',
    actionLabel: 'Review findings',
    tab: 'findings',
    target: 'findings',
    step: 'findings',
  },
  SUMMARY_FINDING_CONTRADICTION: {
    groupKey: 'summary_contradiction',
    title: 'Findings summary does not match the findings',
    actionLabel: 'Review summary',
    tab: 'overview',
    target: 'summary',
    step: 'finish',
  },
  CUSTOMER_VISIBLE_TEST_LANGUAGE: {
    groupKey: 'test_language',
    title: 'Test wording is still in a finding',
    actionLabel: 'Edit finding',
    tab: 'findings',
    target: 'findings',
    step: 'findings',
  },
  SUMMARY_REQUIRED: {
    groupKey: 'summary_required',
    title: 'Review the Findings summary',
    actionLabel: 'Review summary',
    tab: 'overview',
    target: 'summary',
    step: 'finish',
  },
  AI_DECISIONS_PENDING: {
    groupKey: 'ai_pending',
    title: 'Review this photo',
    actionLabel: 'Review photo',
    tab: 'photos',
    target: 'ai_review',
    step: 'findings',
  },
  NO_CUSTOMER_FINDINGS: {
    groupKey: 'no_customer_findings',
    title: 'Review findings before finishing',
    actionLabel: 'Review findings',
    tab: 'photos',
    target: 'ai_review',
    step: 'findings',
  },
  RECOMMENDATION_REQUIRED: {
    groupKey: 'missing_recommendations',
    title: 'Select a Service Recommendation',
    actionLabel: 'Choose recommendation',
    tab: 'recommendations',
    target: 'recommendations',
    step: 'recommendation',
  },
  SERVICE_ADDRESS_REQUIRED: {
    groupKey: 'missing_address',
    title: 'A service address is required for this report',
    actionLabel: 'Add service address',
    tab: 'overview',
    target: 'customer',
    step: 'customer',
  },
};

const unique = (values) => [...new Set((values || []).filter(Boolean))];

const asText = (value) => (typeof value === 'string' ? value.trim() : '');

const activePhotoCountForFinding = (findingId, photos = []) =>
  (photos || []).filter((photo) => (
    photo?.finding_id === findingId
    && photo?.is_voided !== true
    && asText(photo?.upload_state).toLowerCase() !== 'failed'
  )).length;

/**
 * Client-side evidence blockers for report-included findings.
 * Kept manuals (and other customer-visible kept findings) need a linked photo.
 * Used for immediate warning/highlight without waiting on finalize RPC.
 */
export const listLocalEvidenceIssues = (findings = [], photos = []) => {
  const excluded = new Set(['draft', 'rejected', 'voided', 'not_relevant']);
  return (Array.isArray(findings) ? findings : [])
    .filter((finding) => {
      if (!finding?.id) return false;
      const status = asText(finding.condition_status).toLowerCase() || 'draft';
      const isManual = !finding.source_ai_suggestion_id;
      const keptManual = isManual && status === 'approved';
      const keptCustomerVisible = finding.is_customer_visible === true
        && !excluded.has(status)
        && status !== '';
      if (!keptManual && !(keptCustomerVisible && status === 'approved')) return false;
      return activePhotoCountForFinding(finding.id, photos) === 0;
    })
    .map((finding) => ({
      code: 'FINDING_WITHOUT_EVIDENCE',
      finding_id: finding.id,
      message: 'This finding needs a photo.',
    }));
};

export const mergePreflightIssues = (localIssues = [], remoteIssues = []) => {
  const merged = [];
  const seen = new Set();
  [...(Array.isArray(localIssues) ? localIssues : []), ...(Array.isArray(remoteIssues) ? remoteIssues : [])]
    .forEach((issue) => {
      if (!issue?.code) return;
      const key = [
        issue.code,
        issue.finding_id || '',
        issue.photo_id || '',
        issue.recommendation_id || '',
        (Array.isArray(issue.finding_ids) ? issue.finding_ids.join(',') : ''),
      ].join('|');
      if (seen.has(key)) return;
      seen.add(key);
      merged.push(issue);
    });
  return merged;
};

const collectFindingIds = (issue) => unique([
  issue?.finding_id,
  issue?.conflicting_finding_id,
  ...(Array.isArray(issue?.finding_ids) ? issue.finding_ids : []),
]);

const collectPhotoIds = (issue) => unique([
  issue?.photo_id,
  ...(Array.isArray(issue?.photo_ids) ? issue.photo_ids : []),
]);

const collectRecommendationIds = (issue) => unique([
  issue?.recommendation_id,
  ...(Array.isArray(issue?.recommendation_ids) ? issue.recommendation_ids : []),
]);

/**
 * Enrich RPC preflight issues with affected IDs already available in the UI.
 * Does not invent new blocker rules — only attaches deep-link targets.
 */
export const enrichPreflightIssues = (issues, context = {}) => {
  const findings = context.findings || [];
  const recommendations = context.recommendations || [];
  const aiSuggestions = context.aiSuggestions || [];
  const photos = context.photos || [];
  const photosById = new Map(photos.map((photo) => [photo.id, photo]));

  const findingsMissingRecommendations = findings
    .filter((finding) => finding?.is_customer_visible !== false)
    .filter((finding) => !recommendations.some((rec) => (
      rec?.finding_id === finding.id && rec?.is_customer_visible !== false
    )))
    .map((finding) => finding.id);

  const hasInspectionLevelRecommendation = recommendations.some((rec) => (
    rec?.finding_id == null && rec?.is_customer_visible !== false
  ));

  // Never deep-link AI pending blockers to voided/hidden photos.
  const pendingPhotoIds = unique(
    aiSuggestions
      .filter((row) => row?.status === 'pending')
      .map((row) => row.photo_id)
      .filter((photoId) => {
        if (!photos.length) return true;
        const photo = photosById.get(photoId);
        if (!photo) return false;
        return photo.is_voided !== true;
      }),
  );

  return (Array.isArray(issues) ? issues : []).map((issue) => {
    const next = { ...issue };
    if (issue.code === 'RECOMMENDATION_REQUIRED') {
      // P0b bridge: inspection-level rec only. Keep legacy finding_ids empty when satisfied.
      if (!hasInspectionLevelRecommendation && !collectFindingIds(issue).length) {
        next.finding_ids = findingsMissingRecommendations;
      }
    }
    if (issue.code === 'AI_DECISIONS_PENDING') {
      const existing = collectPhotoIds(issue);
      const visible = existing.length
        ? existing.filter((photoId) => {
          if (!photos.length) return true;
          const photo = photosById.get(photoId);
          if (!photo) return false;
          return photo.is_voided !== true;
        })
        : pendingPhotoIds;
      next.photo_ids = visible;
    }
    return next;
  });
};

export const groupPreflightBlockers = (issues) => {
  const groups = new Map();

  (Array.isArray(issues) ? issues : []).forEach((issue) => {
    const meta = CATEGORY_META[issue?.code] || {
      groupKey: `other_${issue?.code || 'unknown'}`,
      title: issue?.message || 'Resolve this report issue',
      actionLabel: 'Open related section',
      tab: 'report',
      target: 'report',
    };

    const existing = groups.get(meta.groupKey) || {
      key: meta.groupKey,
      code: issue.code,
      title: meta.title,
      actionLabel: meta.actionLabel,
      tab: meta.tab,
      target: meta.target,
      step: meta.step || null,
      count: 0,
      messages: [],
      findingIds: [],
      photoIds: [],
      recommendationIds: [],
      issues: [],
    };

    existing.count += 1;
    if (issue.message && !existing.messages.includes(issue.message)) {
      existing.messages.push(issue.message);
    }
    existing.findingIds = unique([...existing.findingIds, ...collectFindingIds(issue)]);
    existing.photoIds = unique([...existing.photoIds, ...collectPhotoIds(issue)]);
    existing.recommendationIds = unique([...existing.recommendationIds, ...collectRecommendationIds(issue)]);
    existing.issues.push(issue);
    groups.set(meta.groupKey, existing);
  });

  return [...groups.values()];
};

export const collectHighlightedIds = (groups) => {
  const list = Array.isArray(groups) ? groups : [];
  return {
    findingIds: unique(list.flatMap((group) => group.findingIds)),
    photoIds: unique(list.flatMap((group) => group.photoIds)),
    recommendationIds: unique(list.flatMap((group) => group.recommendationIds)),
  };
};

export const buildPreflightBlockerModel = (issues, context = {}) => {
  const enriched = enrichPreflightIssues(issues, context);
  const groups = groupPreflightBlockers(enriched);
  return {
    enriched,
    groups,
    highlights: collectHighlightedIds(groups),
  };
};

export const resolveInspectionTargetId = (target, itemId = '') => {
  if (typeof document === 'undefined') return null;

  // Never scroll/highlight a voided photo target — it is hidden on mobile AI review.
  if (target === 'ai_review' && itemId) {
    const meta = document.getElementById(`inspection-photo-meta-${itemId}`);
    const voidedBadge = meta?.closest('[data-photo-voided="true"]');
    if (voidedBadge || meta?.dataset?.voided === 'true') {
      return 'inspection-ai-review';
    }
  }

  const candidates = [
    itemId && target === 'findings' ? `inspection-finding-${itemId}` : null,
    itemId && target === 'ai_review' ? `inspection-photo-meta-${itemId}` : null,
    itemId && target === 'ai_review' ? `inspection-photo-${itemId}` : null,
    itemId && target === 'recommendations' ? `inspection-recommendation-${itemId}` : null,
    target === 'summary' ? 'inspection-summary' : null,
    target === 'customer' ? 'inspection-customer-step' : null,
    target === 'customer' ? 'inspection-service-address' : null,
    target === 'ai_review' ? 'inspection-ai-review' : null,
    target === 'findings' ? 'inspection-findings' : null,
    target === 'recommendations' ? 'inspection-recommendations' : null,
    target === 'report' ? 'inspection-report' : null,
  ].filter(Boolean);

  for (const id of candidates) {
    if (document.getElementById(id)) return id;
  }
  return null;
};

export const scrollToInspectionTarget = (target, itemId = '') => {
  if (typeof document === 'undefined') return null;
  const id = resolveInspectionTargetId(target, itemId);
  if (!id) return null;
  const node = document.getElementById(id);
  if (!node) return null;
  node.scrollIntoView({ behavior: 'smooth', block: 'center' });
  return id;
};

/** Retry scroll until the deterministic target mounts (step changes / quiet reloads). */
export const scrollToInspectionTargetWhenReady = (target, itemId = '', options = {}) => {
  if (typeof document === 'undefined') return Promise.resolve(null);
  const attempts = Array.isArray(options.delaysMs) ? options.delaysMs : [0, 50, 150, 350, 700];
  return new Promise((resolve) => {
    let index = 0;
    const tryScroll = () => {
      const hit = scrollToInspectionTarget(target, itemId);
      if (hit || index >= attempts.length - 1) {
        resolve(hit);
        return;
      }
      index += 1;
      window.setTimeout(tryScroll, Math.max(0, attempts[index] - (attempts[index - 1] || 0)));
    };
    tryScroll();
  });
};
