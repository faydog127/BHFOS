import { ZONE_ORDER } from "./zones";

const STORAGE_KEY = "tis:activeZones";

export function normalizeActiveZones(zones) {
  const list = Array.isArray(zones) ? zones : [];
  const next = [];
  list.forEach((zone) => {
    if (ZONE_ORDER.includes(zone) && !next.includes(zone)) {
      next.push(zone);
    }
  });
  return next;
}

export function loadActiveZones() {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return normalizeActiveZones(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function saveActiveZones(zones) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeActiveZones(zones)));
  } catch {
    // ignore storage failures
  }
}

export function isZoneActive(zone, activeZones) {
  if (!activeZones || !activeZones.length) return true;
  return activeZones.includes(zone);
}
