/**
 * In-memory drafts for Finance screens.
 * Browser Back/Forward and in-app section changes can remount a screen.
 * The module keeps the unsaved plan and check-in form until save, reload, or confirmed leave.
 */

let planDraft = null;
let checkinDraft = null;

export function rememberPlanDraft(draft) {
  if (!draft || !draft.id) return;
  planDraft = {
    id: draft.id,
    version: draft.version,
    inputs: draft.inputs,
    notes: draft.notes,
  };
}

export function readPlanDraft() {
  return planDraft;
}

export function clearPlanDraft() {
  planDraft = null;
}

/**
 * A draft applies only to the same plan row and the same version.
 * A save bumps the version, so the next load uses the server document.
 */
export function resolveStoredPlan(plan, draft = readPlanDraft()) {
  if (!plan) return { inputs: null, notes: '', dirty: false, held: false };
  if (draft && draft.id === plan.id && draft.version === plan.version) {
    return {
      inputs: draft.inputs,
      notes: draft.notes ?? '',
      dirty: true,
      held: true,
    };
  }
  return {
    inputs: plan.inputs,
    notes: plan.notes || '',
    dirty: false,
    held: false,
  };
}

export function rememberCheckinDraft(draft) {
  checkinDraft = draft ? { ...draft } : null;
}

export function readCheckinDraft() {
  return checkinDraft;
}

export function clearCheckinDraft() {
  checkinDraft = null;
}

export function clearFinanceDrafts() {
  clearPlanDraft();
  clearCheckinDraft();
}
