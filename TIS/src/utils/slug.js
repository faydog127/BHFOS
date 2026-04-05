export function slugify(input) {
  const safe = String(input || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
  return safe || "property";
}

export function normalizeKey(...parts) {
  return parts
    .map((part) =>
      String(part || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "")
    )
    .join("");
}
