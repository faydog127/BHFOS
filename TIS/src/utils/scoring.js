// `access_score` is the commercial/sales-path score for opportunity movement, not service access.
export const SCORE_FIELDS = ["problem_score", "access_score", "leverage_score", "momentum_score"];

const toNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

export function computeTotalScore(assessment) {
  return SCORE_FIELDS.reduce((sum, field) => sum + toNumber(assessment?.[field]), 0);
}

export function computeMomentumSuggestion(assessment) {
  const priority = assessment?.follow_up_priority || "";
  if (!priority) return 0;
  if (priority === "high") {
    const due = assessment?.next_action_due;
    if (due) {
      const dueDate = new Date(due);
      if (!Number.isNaN(dueDate.getTime())) {
        const hours = (dueDate.getTime() - Date.now()) / 36e5;
        if (hours <= 48 && hours >= 0) return 2;
      }
    }
    return 1;
  }
  if (priority === "medium") return 1;
  return 0;
}
