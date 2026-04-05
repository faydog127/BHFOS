import { slugify } from "./slug";

const pad = (value) => String(value).padStart(2, "0");

export function formatDateTime(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
}

export function formatDate(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString();
}

export function formatTimestampFilename(isoOrDate) {
  const date = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(
    date.getHours()
  )}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

export function buildPhotoFilename(propertyName, tag, timestampIso, uniqueToken = "") {
  const slug = slugify(propertyName);
  let safeTag = String(tag || "general_observation")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+/, "")
    .replace(/_+$/, "");
  if (!safeTag) safeTag = "general_observation";
  const stamp = formatTimestampFilename(timestampIso || new Date());
  const safeUnique = String(uniqueToken || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(-8);
  return safeUnique
    ? `${slug}__${safeTag}__${stamp}__${safeUnique}.jpg`
    : `${slug}__${safeTag}__${stamp}.jpg`;
}

export function toDbBool(value) {
  if (value === null || value === undefined) return null;
  return value ? 1 : 0;
}

export function fromDbBool(value) {
  if (value === null || value === undefined) return null;
  return Boolean(value);
}

export function ensureIso(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}
