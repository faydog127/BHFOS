export const HAZARD_FIELDS = [
  "hazard_severity",
  "hazard_prevalence",
  "hazard_maintenance_gap",
  "hazard_engagement_path"
];

const normalizeNumber = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);

export function computeHazardTotal(assessment) {
  if (!assessment) return 0;
  return (
    normalizeNumber(assessment.hazard_severity) +
    normalizeNumber(assessment.hazard_prevalence) +
    normalizeNumber(assessment.hazard_maintenance_gap) +
    normalizeNumber(assessment.hazard_engagement_path)
  );
}

export function computeHazardBand(total) {
  if (total >= 9) return "Immediate Priority";
  if (total >= 7) return "Strong Target";
  if (total >= 5) return "Secondary";
  return "Watch";
}

export function computeHazardPrimaryAngle(assessment) {
  if (!assessment) return "watch";
  const severity = normalizeNumber(assessment.hazard_severity);
  const prevalence = normalizeNumber(assessment.hazard_prevalence);
  const maintenance = normalizeNumber(assessment.hazard_maintenance_gap);
  const total = Number.isFinite(Number(assessment.hazard_total))
    ? Number(assessment.hazard_total)
    : computeHazardTotal(assessment);

  if (total <= 3) return "watch";
  if (total >= 8 && (severity >= 4 || maintenance >= 2)) return "safety";
  if (total >= 6 && prevalence >= 2) return "repeat_service";
  if (total >= 4) return "process_gap";
  return "watch";
}
