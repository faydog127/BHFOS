/**
 * All Media search planning — pure helpers (no Supabase I/O).
 *
 * Authoritative tag field: public.mil_asset_tags.tag_slug
 * (ai_suggested | human_verified | human_added).
 */

const MIL_ASSET_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Trim; blank / whitespace-only → null (caller applies no search filter). */
export function normalizeAssetSearchTerm(raw) {
  if (typeof raw !== 'string') return null;
  const term = raw.trim();
  return term || null;
}

export function isAssetSearchUuid(term) {
  return typeof term === 'string' && MIL_ASSET_UUID_RE.test(term.trim());
}

export function normalizeAssetSearchUuid(term) {
  if (!isAssetSearchUuid(term)) return null;
  return term.trim().toLowerCase();
}

/**
 * Neutralize ILIKE multi-character wildcards / backslashes so user `%` cannot
 * broaden a contains search. Underscores are left intact so snake_case filenames
 * and tag_slug values (e.g. dryer_vent, low_quality) still match; in LIKE an
 * unescaped `_` is only a single-character wildcard.
 * Callers must prefer parameterized .ilike() / quoted .or() fragments — never
 * embed unsanitized user text into raw PostgREST expressions.
 */
export function sanitizeSearchLiteral(term) {
  return String(term)
    .replace(/[%\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Build a search plan for listAssets.
 * - none: no search filter (blank input)
 * - no_match: syntactically empty after sanitize (e.g. only %/_) → empty result set
 * - uuid: exact id equality only (never applied for non-UUID text)
 * - text: case-insensitive partial filename + mil_asset_tags.tag_slug
 */
export function buildAssetSearchPlan(raw) {
  const term = normalizeAssetSearchTerm(raw);
  if (!term) return { kind: 'none' };

  const uuid = normalizeAssetSearchUuid(term);
  if (uuid) {
    return { kind: 'uuid', uuid, term };
  }

  const literal = sanitizeSearchLiteral(term);
  if (!literal) {
    return { kind: 'no_match', term };
  }

  return {
    kind: 'text',
    term,
    literal,
    /** Pattern for parameterized .ilike() — wildcards only at edges. */
    ilikePattern: `%${literal}%`,
  };
}

/**
 * Merge asset rows from filename/id query and optional extras; dedupe by id,
 * preserve primary ordering (created_at desc as returned by primary query).
 */
export function mergeAssetsById(primaryRows = [], extraRows = []) {
  const seen = new Set();
  const out = [];
  for (const row of [...primaryRows, ...extraRows]) {
    if (!row?.id || seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
  }
  return out;
}

/**
 * PostgREST .or() fragment for a parameterized-style quoted ilike contains.
 * Literal must already be sanitizeSearchLiteral()'d (no raw `%` / `\`).
 * Double-quotes the pattern so commas, parens, spaces, and dots are safe.
 * Note: `_` is intentionally left literal in the planner input; SQL LIKE still
 * treats `_` as a single-character wildcard inside the pattern.
 */
export function postgrestFilenameIlikeOrClause(literal) {
  const safe = sanitizeSearchLiteral(literal);
  if (!safe) return null;
  const pattern = `%${safe}%`;
  return `original_filename.ilike."${pattern.replace(/"/g, '""')}"`;
}

/**
 * Cap unique tag-derived asset IDs included in id.in.(…).
 * Keeps the PostgREST filter URL bounded for internal-library volumes.
 * Broad tag matches beyond this cap may omit older tag-only hits; filename
 * matches are unaffected. Raise only with a measured URL-budget redesign.
 */
export const MIL_TAG_SEARCH_ASSET_ID_CAP = 200;

/** PostgREST .or() fragment for id.in.(uuid,...). */
export function postgrestIdInOrClause(ids = [], { cap = MIL_TAG_SEARCH_ASSET_ID_CAP } = {}) {
  const clean = [...new Set(ids.map((id) => normalizeAssetSearchUuid(id)).filter(Boolean))];
  if (!clean.length) return null;
  const limited = typeof cap === 'number' && cap > 0 ? clean.slice(0, cap) : clean;
  return `id.in.(${limited.join(',')})`;
}

/**
 * Compose .or() filter for text search: filename partial and/or tag-derived ids.
 * Returns null when neither clause applies.
 */
export function buildTextSearchOrFilter(literal, tagAssetIds = []) {
  const parts = [];
  const fileClause = postgrestFilenameIlikeOrClause(literal);
  if (fileClause) parts.push(fileClause);
  const idClause = postgrestIdInOrClause(tagAssetIds);
  if (idClause) parts.push(idClause);
  return parts.length ? parts.join(',') : null;
}
