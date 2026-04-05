const DRAFT_PREFIX = "tis-draft:";
const META_PREFIX = "tis-draft-meta:";

export function loadDraft(key, fallback = null) {
  const raw = localStorage.getItem(`${DRAFT_PREFIX}${key}`);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch (error) {
    return fallback;
  }
}

export function saveDraft(key, data) {
  localStorage.setItem(`${DRAFT_PREFIX}${key}`, JSON.stringify(data));
}

export function clearDraft(key) {
  localStorage.removeItem(`${DRAFT_PREFIX}${key}`);
  localStorage.removeItem(`${META_PREFIX}${key}`);
}

export function loadDraftMeta(key) {
  const raw = localStorage.getItem(`${META_PREFIX}${key}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
}

export function saveDraftMeta(key, data) {
  localStorage.setItem(`${META_PREFIX}${key}`, JSON.stringify(data));
}
