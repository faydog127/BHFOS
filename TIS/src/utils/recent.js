const STORAGE_KEY = "tis:recentProperties";
const LIMIT = 6;

export function loadRecentProperties() {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function recordRecentProperty(propertyId) {
  if (!propertyId || typeof window === "undefined") return;
  const now = new Date().toISOString();
  const existing = loadRecentProperties().filter((item) => item.id !== propertyId);
  const next = [{ id: propertyId, at: now }, ...existing].slice(0, LIMIT);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore storage failures
  }
}
