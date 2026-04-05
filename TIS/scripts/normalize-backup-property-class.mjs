import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { derivePropertyClass } from "../src/utils/propertyClass.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const inputPath = process.argv[2];
if (!inputPath) {
  console.error("Usage: node scripts/normalize-backup-property-class.mjs <backup.json>");
  process.exit(1);
}

const raw = fs.readFileSync(inputPath, "utf8");
const payload = JSON.parse(raw);

const EXTERIOR_MAP = {
  strong: "good",
  average: "fair",
  poor: "poor"
};
const MAINTENANCE_MAP = {
  proactive: "well_kept",
  mixed: "minor_issues",
  average: "minor_issues",
  reactive: "deferred_maintenance"
};
const FEEL_MAP = {
  premium: "high",
  standard: "moderate",
  tired: "low"
};

const ALLOWED = {
  exterior_condition: new Set(["excellent", "good", "fair", "poor"]),
  maintenance_signals: new Set(["well_kept", "minor_issues", "deferred_maintenance", "heavy_wear"]),
  overall_feel: new Set(["high", "moderate", "low"])
};

const stats = {
  total: 0,
  mapped: 0,
  recomputed: 0,
  nulled: 0,
  classCounts: {
    A: 0,
    B: 0,
    C: 0,
    unclassified: 0
  },
  unknown: {
    exterior_condition: new Set(),
    maintenance_signals: new Set(),
    overall_feel: new Set()
  }
};

const normalizeValue = (value, map, allowedSet, unknownSet) => {
  if (value === null || value === undefined) return "";
  const rawValue = String(value).trim();
  if (!rawValue) return "";
  const key = rawValue.toLowerCase();
  if (Object.prototype.hasOwnProperty.call(map, key)) {
    const mapped = map[key];
    if (mapped !== key) stats.mapped += 1;
    return mapped;
  }
  if (allowedSet.has(key)) {
    return key;
  }
  unknownSet.add(rawValue);
  return "";
};

const properties = Array.isArray(payload?.properties) ? payload.properties : [];
stats.total = properties.length;

const normalizedProperties = properties.map((property) => {
  const exterior_condition = normalizeValue(
    property.exterior_condition,
    EXTERIOR_MAP,
    ALLOWED.exterior_condition,
    stats.unknown.exterior_condition
  );
  const maintenance_signals = normalizeValue(
    property.maintenance_signals,
    MAINTENANCE_MAP,
    ALLOWED.maintenance_signals,
    stats.unknown.maintenance_signals
  );
  const overall_feel = normalizeValue(
    property.overall_feel,
    FEEL_MAP,
    ALLOWED.overall_feel,
    stats.unknown.overall_feel
  );

  const next = {
    ...property,
    exterior_condition,
    maintenance_signals,
    overall_feel
  };

  if (!exterior_condition || !maintenance_signals || !overall_feel) {
    next.property_class = "";
    next.class_guess = "";
    stats.nulled += 1;
    stats.classCounts.unclassified += 1;
  } else {
    const computed = derivePropertyClass(next);
    next.property_class = computed;
    next.class_guess = computed;
    stats.recomputed += 1;
    if (computed === "A" || computed === "B" || computed === "C") {
      stats.classCounts[computed] += 1;
    } else {
      stats.classCounts.unclassified += 1;
    }
  }

  return next;
});

const outputPayload = {
  ...payload,
  properties: normalizedProperties
};

const outputDir = path.resolve(__dirname, "..", "_normalized_backups");
fs.mkdirSync(outputDir, { recursive: true });

const baseName = path.basename(inputPath, path.extname(inputPath));
const outputPath = path.join(outputDir, `${baseName}-normalized.json`);
fs.writeFileSync(outputPath, JSON.stringify(outputPayload, null, 2), "utf8");

const unknownSummary = {
  exterior_condition: Array.from(stats.unknown.exterior_condition).sort(),
  maintenance_signals: Array.from(stats.unknown.maintenance_signals).sort(),
  overall_feel: Array.from(stats.unknown.overall_feel).sort()
};

const report = {
  input: inputPath,
  output: outputPath,
  total_records: stats.total,
  total_mapped: stats.mapped,
  total_recomputed: stats.recomputed,
  total_nulled_missing_inputs: stats.nulled,
  class_counts: stats.classCounts,
  unknown_values: unknownSummary
};

console.log(JSON.stringify(report, null, 2));
