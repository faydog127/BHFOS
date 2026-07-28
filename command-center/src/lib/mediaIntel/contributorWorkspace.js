/**
 * Contributor Workspace presentation helpers (assignment workbench).
 * Never imply original/HEIC delivery — working copies are JPEG/safe derivatives only.
 */

const HEIC_EXT = /\.(heic|heif)$/i;
const IMAGE_EXT = /\.(jpe?g|png|webp|gif|heic|heif)$/i;

/** Prefer grid thumb, then detail preview, then creator download for in-page display. */
export const CONTRIBUTOR_THUMB_KIND_ORDER = ['grid_thumb', 'detail_preview', 'creator_download', 'video_thumb'];

/** Show filename search only when the assigned set is large enough to need it. */
export const CONTRIBUTOR_SEARCH_MIN_COUNT = 12;

/** Standing rules — shown once in the top brief block, not repeated on every card. */
export const CONTRIBUTOR_STANDING_RULES =
  'Working copies only (JPEG). Preview and Download never expose HEIC or protected originals. Download what you need, create your deliverable, then submit for owner review.';

const USE_LABELS = {
  reel_creation: 'Reel / short video',
  social_photo: 'Social photo',
  website_service_proof: 'Website proof',
  homepage_hero: 'Homepage hero',
  training: 'Training',
  archive_only: 'Archive only',
};

/**
 * Pack/filename/AI-score notes are inventory metadata, not a creative brief.
 * @param {string|null|undefined} text
 */
export function looksLikeInventoryNote(text) {
  const t = String(text || '').trim();
  if (!t) return false;
  if (/\bAI\s+(website|social|reel)\s+score\b/i.test(t)) return true;
  if (/\bpack\s+\d+\b/i.test(t) && /\.(heic|heif|jpe?g|png|webp)\b/i.test(t)) return true;
  return false;
}

/**
 * Collapse assignment rows into one job brief for the top block.
 * @param {Array<object>|null|undefined} assignments
 */
export function summarizeContributorBrief(assignments) {
  const rows = assignments || [];
  const briefs = [];
  const seenBrief = new Set();
  const outputs = new Set();
  const formats = new Set();
  const dues = new Set();
  let assetCount = 0;
  let collectionCount = 0;

  for (const a of rows) {
    if (a?.asset_id) assetCount += 1;
    else if (a?.collection_id) collectionCount += 1;
    if (a?.requested_output) outputs.add(String(a.requested_output));
    if (a?.platform_format) formats.add(String(a.platform_format));
    if (a?.due_at) dues.add(String(a.due_at));
    for (const field of [a?.instructions, a?.notes]) {
      const text = String(field || '').trim();
      if (!text || looksLikeInventoryNote(text)) continue;
      const key = text.toLowerCase();
      if (seenBrief.has(key)) continue;
      seenBrief.add(key);
      briefs.push(text);
    }
  }

  const outputList = [...outputs];
  const formatList = [...formats];
  const dueList = [...dues].sort();
  const parts = [];
  if (assetCount > 0) {
    parts.push(`${assetCount} working cop${assetCount === 1 ? 'y' : 'ies'}`);
  } else if (collectionCount > 0) {
    parts.push(`${collectionCount} collection${collectionCount === 1 ? '' : 's'}`);
  }
  if (outputList.length === 1) parts.push(`Output: ${outputList[0]}`);
  else if (outputList.length > 1) parts.push(`Output: ${outputList.join(', ')}`);
  if (formatList.length === 1) parts.push(`Format: ${formatList[0]}`);

  return {
    assignmentCount: rows.length,
    assetCount,
    collectionCount,
    briefs,
    outputs: outputList,
    formats: formatList,
    dues: dueList,
    hasCreativeBrief: briefs.length > 0,
    /** One-line pack summary for the top brief chrome. */
    packSummary: parts.join(' · '),
    primaryDueAt: dueList[0] || null,
  };
}

/**
 * Owner-side brief gate: non-empty creative instructions, not inventory metadata.
 * @param {string|null|undefined} text
 * @param {{ minLength?: number }} [opts]
 */
export function isValidContributorBrief(text, opts = {}) {
  const minLength = opts.minLength ?? 8;
  const t = String(text || '').trim();
  if (t.length < minLength) return false;
  if (looksLikeInventoryNote(t)) return false;
  return true;
}

/**
 * Honest display for assigned media — never present HEIC/original as the deliverable.
 * @param {{ original_filename?: string|null, mime_type?: string|null, media_kind?: string|null }} asset
 */
export function workingCopyPresentation(asset) {
  const filename = String(asset?.original_filename || 'Assigned media').trim() || 'Assigned media';
  const sourceWasHeic =
    HEIC_EXT.test(filename) || /heic|heif/i.test(String(asset?.mime_type || ''));
  const base = filename.replace(HEIC_EXT, '').replace(IMAGE_EXT, '') || filename;
  const title = sourceWasHeic ? `${base} (from HEIC)` : filename;
  return {
    title,
    filename,
    sourceWasHeic,
    workingCopyLabel: 'Working copy (JPEG)',
    workingCopyHint: sourceWasHeic
      ? 'Preview and download are JPEG working copies — not the protected HEIC original.'
      : 'Preview and download are contributor-safe working copies — not protected originals.',
  };
}

/**
 * Pick the best derivative kind already present for a contributor thumb.
 * @param {Array<{ kind?: string }>|null|undefined} derivatives
 */
export function pickContributorThumbKind(derivatives) {
  const kinds = new Set((derivatives || []).map((d) => d.kind).filter(Boolean));
  return CONTRIBUTOR_THUMB_KIND_ORDER.find((k) => kinds.has(k)) || null;
}

/**
 * Filter assigned assets by filename / media kind (client-side; assigned set only).
 * Tags are not used — contributors do not have library tag browse RLS.
 * @param {Array<object>} assets
 * @param {string} query
 */
export function filterAssignedMedia(assets, query) {
  const q = String(query || '')
    .trim()
    .toLowerCase();
  if (!q) return assets || [];
  return (assets || []).filter((a) => {
    const name = String(a.original_filename || '').toLowerCase();
    const kind = String(a.media_kind || '').toLowerCase();
    const id = String(a.id || '').toLowerCase();
    return name.includes(q) || kind.includes(q) || id.startsWith(q);
  });
}

/**
 * Read-only approved-use chips from mil_permitted_uses rows.
 * @param {Array<{ use_key?: string, approved?: boolean }>|null|undefined} uses
 */
export function approvedUseChips(uses) {
  return (uses || [])
    .filter((u) => u && u.approved === true && u.use_key)
    .map((u) => ({
      key: u.use_key,
      label: USE_LABELS[u.use_key] || String(u.use_key).replace(/_/g, ' '),
    }));
}
