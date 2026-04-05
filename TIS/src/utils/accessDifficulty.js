const LEVELS = ["Easy", "Moderate", "Difficult", "High Risk"];

export function computeAccessDifficulty({ building_height, termination_type, access_constraints }) {
  if (!building_height || !termination_type || !access_constraints) return "";

  let level = 0;
  if (building_height === "3") level = 1;
  if (building_height === "4+") level = 2;

  if (termination_type === "roof") level += 1;
  if (termination_type === "mixed") level += 1;

  if (access_constraints === "major") return "High Risk";
  if (access_constraints === "moderate") level += 2;
  if (access_constraints === "minor") level += 1;

  const capped = Math.min(level, 3);
  return LEVELS[capped] || "";
}
