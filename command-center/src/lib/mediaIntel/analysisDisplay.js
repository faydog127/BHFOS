/**
 * Normalize mil_ai_analyses.suggested into a technician-facing outcome card.
 * Never treats missing fields as success; never renders HTML.
 */

const USE_LABELS = {
  inspection_report: 'Inspection report',
  customer_proof: 'Customer proof',
  internal_documentation: 'Internal documentation',
  internal_docs: 'Internal documentation',
  marketing_candidate: 'Marketing candidate',
  social_media_candidate: 'Social media candidate',
  social_photo: 'Social media candidate',
  training: 'Training',
  do_not_use: 'Do not use',
  homepage_hero: 'Homepage hero',
  website_service_proof: 'Website service proof',
  reel_short_video: 'Reel / short video',
};

function asPlainText(value) {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value).trim();
  }
  if (Array.isArray(value)) {
    return value.map((v) => asPlainText(v)).filter(Boolean).join('; ');
  }
  if (typeof value === 'object') {
    const preferred = [value.label, value.type, value.kind, value.risk, value.message, value.detail, value.description]
      .map((v) => (typeof v === 'string' ? v.trim() : ''))
      .filter(Boolean);
    if (preferred.length) return preferred.join(' — ');
    try {
      return JSON.stringify(value);
    } catch {
      return '';
    }
  }
  return '';
}

function asStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map((v) => asPlainText(v)).filter(Boolean);
}

function qualitySummary(quality) {
  if (!quality || typeof quality !== 'object') return null;
  const preferred = [
    'inspection_report',
    'website_service_proof',
    'social_photo',
    'homepage_hero',
    'training',
    'internal_docs',
  ];
  for (const key of preferred) {
    const row = quality[key];
    if (row && typeof row === 'object') {
      if (row.suitable === false) continue;
      if (row.suitable === true || typeof row.score === 'number') {
        return {
          key,
          label: USE_LABELS[key] || key,
          suitable: row.suitable !== false,
          score: typeof row.score === 'number' ? row.score : null,
          explanation: row.explanation ? String(row.explanation) : null,
        };
      }
    }
  }
  return null;
}

function recommendedUses(suggested) {
  const fromList = asStringArray(suggested?.recommended_uses).map((u) => USE_LABELS[u] || u);
  const unsuitable = asStringArray(suggested?.unsuitable_uses).map((u) => USE_LABELS[u] || u);
  const q = suggested?.quality;
  if (q && typeof q === 'object') {
    for (const [key, row] of Object.entries(q)) {
      if (row?.suitable === true) {
        const label = USE_LABELS[key] || key;
        if (!fromList.includes(label)) fromList.push(label);
      }
      if (row?.suitable === false) {
        const label = USE_LABELS[key] || key;
        if (!unsuitable.includes(label)) unsuitable.push(label);
      }
    }
  }
  return { recommended: fromList, unsuitable };
}

export function classifyAnalysisUiStatus(asset, analysis) {
  const processing = String(asset?.processing_status || '');
  const aStatus = String(analysis?.status || '');
  if (aStatus === 'succeeded') return 'complete';
  if (aStatus.startsWith('skipped_') || aStatus === 'failed') return 'failed';
  if (processing === 'analyzing') return 'analyzing';
  if (processing === 'queued' || processing === 'uploaded') return 'queued';
  if (processing === 'analyzed') return analysis ? 'complete' : 'queued';
  if (processing === 'processing_failed') return 'failed';
  return 'not_requested';
}

/**
 * Build a useful, plain-language analysis card for TVG technicians.
 */
export function buildAnalysisOutcome(asset, analysis) {
  const uiStatus = classifyAnalysisUiStatus(asset, analysis);
  const suggested = analysis?.suggested && typeof analysis.suggested === 'object' ? analysis.suggested : {};
  const uses = recommendedUses(suggested);
  const quality = qualitySummary(suggested.quality);
  const tags = asStringArray(suggested.tags);
  const privacy = asStringArray(suggested.privacy_risks);
  const needsReview =
    privacy.length > 0 ||
    uiStatus === 'failed' ||
    String(asset?.human_review_status || '') === 'pending' ||
    /review/i.test(String(suggested.explanation || ''));

  const classification = [
    suggested.work_phase,
    suggested.service_category,
    suggested.media_type,
    suggested.location_component,
  ]
    .map((v) => String(v || '').trim())
    .filter(Boolean);

  let usability = 'unknown';
  if (quality?.suitable === true) usability = quality.score != null && quality.score < 0.45 ? 'limited' : 'usable';
  if (quality?.suitable === false) usability = 'poor';
  if (uses.unsuitable.includes('Do not use')) usability = 'unusable';

  return {
    uiStatus,
    description: String(suggested.narrative || suggested.explanation || analysis?.explanation || '').trim() || null,
    classification,
    tags,
    usability,
    recommendedUses: uses.recommended,
    unsuitableUses: uses.unsuitable,
    observations: String(suggested.condition_notes || '').trim() || null,
    confidence:
      typeof analysis?.overall_confidence === 'number'
        ? analysis.overall_confidence
        : null,
    needsHumanReview: needsReview,
    privacyWarnings: privacy,
    analysisStatus: analysis?.status || null,
    processingStatus: asset?.processing_status || null,
    model: analysis?.model || null,
    promptVersion: analysis?.prompt_version || null,
    videoNote:
      asset?.media_kind && asset.media_kind !== 'photo'
        ? 'Video: full-length AI review is not implemented. Treat any notes as incomplete until a person reviews the video.'
        : null,
    errorMessage:
      uiStatus === 'failed'
        ? String(analysis?.explanation || analysis?.status || 'Analysis could not be completed')
        : null,
  };
}

export function analysisOutcomeAnswers(outcome) {
  if (!outcome) return null;
  return {
    whatItShows: outcome.description || outcome.classification.join(' · ') || 'Not enough AI detail yet.',
    usable: outcome.usability,
    tags: outcome.tags,
    recommendedUse: outcome.recommendedUses.length
      ? outcome.recommendedUses.join(', ')
      : outcome.unsuitableUses.length
        ? `Avoid: ${outcome.unsuitableUses.join(', ')}`
        : 'Needs human judgment',
    needsReview: outcome.needsHumanReview,
  };
}
