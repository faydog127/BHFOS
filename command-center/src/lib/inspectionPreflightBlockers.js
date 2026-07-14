const CATEGORY_META = {
  FINDING_WITHOUT_EVIDENCE: {
    groupKey: 'missing_evidence',
    title: 'Findings missing evidence',
    actionLabel: 'Open affected findings',
    tab: 'findings',
    target: 'findings',
  },
  CONTRADICTORY_COMPONENT_CONCLUSION: {
    groupKey: 'contradictory_findings',
    title: 'Contradictory findings',
    actionLabel: 'Open contradictory findings',
    tab: 'findings',
    target: 'findings',
  },
  SUMMARY_FINDING_CONTRADICTION: {
    groupKey: 'summary_contradiction',
    title: 'Summary contradicts findings',
    actionLabel: 'Open summary and findings',
    tab: 'overview',
    target: 'summary',
  },
  CUSTOMER_VISIBLE_TEST_LANGUAGE: {
    groupKey: 'test_language',
    title: 'Test language in customer findings',
    actionLabel: 'Open affected findings',
    tab: 'findings',
    target: 'findings',
  },
  SUMMARY_REQUIRED: {
    groupKey: 'summary_required',
    title: 'Inspection summary not accepted',
    actionLabel: 'Edit summary',
    tab: 'overview',
    target: 'summary',
  },
  AI_DECISIONS_PENDING: {
    groupKey: 'ai_pending',
    title: 'Photos need a technician decision',
    actionLabel: 'Review photo decisions',
    tab: 'photos',
    target: 'ai_review',
  },
  NO_CUSTOMER_FINDINGS: {
    groupKey: 'no_customer_findings',
    title: 'No customer-approved findings',
    actionLabel: 'Review findings and photo decisions',
    tab: 'photos',
    target: 'ai_review',
  },
  RECOMMENDATION_REQUIRED: {
    groupKey: 'missing_recommendations',
    title: 'Service recommendation required',
    actionLabel: 'Add service recommendation',
    tab: 'recommendations',
    target: 'recommendations',
  },
};

const unique = (values) => [...new Set((values || []).filter(Boolean))];

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

export const scrollToInspectionTarget = (target, itemId = '') => {
  if (typeof document === 'undefined') return null;

  // Never scroll/highlight a voided photo target — it is hidden on mobile AI review.
  if (target === 'ai_review' && itemId) {
    const meta = document.getElementById(`inspection-photo-meta-${itemId}`);
    const voidedBadge = meta?.closest('[data-photo-voided="true"]');
    if (voidedBadge || meta?.dataset?.voided === 'true') {
      const fallback = document.getElementById('inspection-ai-review');
      if (fallback) {
        fallback.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return fallback;
      }
      return null;
    }
  }

  const candidates = [
    itemId && target === 'findings' ? `inspection-finding-${itemId}` : null,
    itemId && target === 'ai_review' ? `inspection-photo-meta-${itemId}` : null,
    itemId && target === 'recommendations' ? `inspection-recommendation-${itemId}` : null,
    target === 'summary' ? 'inspection-summary' : null,
    target === 'ai_review' ? 'inspection-ai-review' : null,
    target === 'findings' ? 'inspection-findings' : null,
    target === 'recommendations' ? 'inspection-recommendations' : null,
    target === 'report' ? 'inspection-report' : null,
  ].filter(Boolean);

  for (const id of candidates) {
    const node = document.getElementById(id);
    if (node) {
      node.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return id;
    }
  }
  return null;
};
