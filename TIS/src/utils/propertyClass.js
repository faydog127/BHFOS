export const PROPERTY_CLASS_OPTIONS = {
  exterior_condition: [
    {
      value: "excellent",
      label: "Excellent",
      helper: "Clean and well-kept. No meaningful wear or damage."
    },
    {
      value: "good",
      label: "Good",
      helper: "Mostly clean. Minor wear or aging, no neglect."
    },
    {
      value: "fair",
      label: "Fair",
      helper: "Noticeable wear, staining, or inconsistent upkeep."
    },
    {
      value: "poor",
      label: "Poor",
      helper: "Clear neglect, damage, or heavy deterioration."
    }
  ],
  maintenance_signals: [
    {
      value: "well_kept",
      label: "Well Kept",
      helper: "Consistent maintenance, few visible issues."
    },
    {
      value: "minor_issues",
      label: "Minor Issues",
      helper: "Mostly maintained with small visible issues."
    },
    {
      value: "deferred_maintenance",
      label: "Deferred",
      helper: "Multiple signs of postponed upkeep."
    },
    {
      value: "heavy_wear",
      label: "Heavy Wear",
      helper: "Widespread deterioration or neglect."
    }
  ],
  overall_feel: [
    {
      value: "high",
      label: "High",
      helper: "Clean, organized, and well-run."
    },
    {
      value: "moderate",
      label: "Moderate",
      helper: "Mixed impression; some areas lag."
    },
    {
      value: "low",
      label: "Low",
      helper: "Disorganized, worn, or reactive."
    }
  ]
};

export function derivePropertyClass(values) {
  const exterior = values?.exterior_condition || "";
  const maintenance = values?.maintenance_signals || "";
  const overall = values?.overall_feel || "";
  if (!exterior || !maintenance || !overall) return "";

  const isA =
    (exterior === "excellent" || exterior === "good") &&
    maintenance === "well_kept" &&
    overall === "high";
  if (isA) return "A";

  const isC =
    (exterior === "fair" || exterior === "poor") &&
    (maintenance === "deferred_maintenance" || maintenance === "heavy_wear") &&
    overall === "low";
  if (isC) return "C";

  return "B";
}

export function getPropertyClassWarnings(values) {
  const exterior = values?.exterior_condition || "";
  const maintenance = values?.maintenance_signals || "";
  const overall = values?.overall_feel || "";
  if (!exterior || !maintenance || !overall) return [];

  const warnings = [];
  const exteriorHigh = exterior === "excellent" || exterior === "good";
  const exteriorLow = exterior === "fair" || exterior === "poor";
  const maintenanceLow = maintenance === "deferred_maintenance" || maintenance === "heavy_wear";
  const maintenanceHigh = maintenance === "well_kept";

  if (exteriorHigh && maintenanceLow) {
    warnings.push("Confirm: exterior looks strong, but maintenance appears heavily worn.");
  }
  if (exteriorLow && maintenanceHigh) {
    warnings.push("Confirm: exterior looks worn, but maintenance appears well kept.");
  }
  if (overall === "high" && (exteriorLow || maintenanceLow)) {
    warnings.push("Confirm: overall feel is high, but exterior/maintenance signals are weak.");
  }
  if (overall === "low" && (exteriorHigh || maintenanceHigh)) {
    warnings.push("Confirm: overall feel is low, but exterior/maintenance signals are strong.");
  }

  return warnings;
}
