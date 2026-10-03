/**
 * Monthly Check-In conflict handling.
 * After version_conflict, Save stays blocked until Reload.
 * Reload copies the server row into the form. Unsaved edits are discarded.
 * There is no merge.
 */
import { CHECKIN_FIELDS, actualFactsFromForm, formatStoredDecimal, parseActualMonth } from './actuals.js';

export const CHECKIN_CONFLICT_COPY = 'Changed elsewhere. Saving stays blocked until you reload. Reload discards the unsaved edits on this screen and shows the saved month. There is no merge.';

export function formFromActual(row) {
  const form = { notes: row?.notes || '', source_note: row?.source_note || '' };
  for (const field of CHECKIN_FIELDS) {
    if (field.kind === 'count') {
      form[field.key] = row?.[field.key] === null || row?.[field.key] === undefined ? '' : String(row[field.key]);
    } else {
      form[field.key] = formatStoredDecimal(row?.[field.key], 2);
    }
  }
  return form;
}

export function nextCheckinCorrection({
  conflict,
  saving,
  writesEnabled,
  selected,
  form,
  monthInput,
  associateOnCreate,
  approved,
}) {
  if (!writesEnabled || saving) return { ok: false, code: 'checkin_busy' };
  if (conflict) return { ok: false, code: 'conflict_unresolved' };
  const month = selected
    ? { ok: true, value: String(selected.month).slice(0, 10) }
    : parseActualMonth(monthInput);
  if (!month.ok) return month;
  const parsed = actualFactsFromForm(form);
  if (!parsed.ok) return parsed;
  if (selected) {
    return {
      ok: true,
      mode: 'correct',
      payload: {
        id: selected.id,
        expectedVersion: selected.version,
        facts: parsed.facts,
      },
    };
  }
  return {
    ok: true,
    mode: 'create',
    payload: {
      month: month.value,
      facts: parsed.facts,
      comparisonPlanId: associateOnCreate && approved ? approved.id : null,
    },
  };
}

export function reloadCheckinFromServer(actuals, selectedId) {
  const server = (Array.isArray(actuals) ? actuals : []).find((row) => row.id === selectedId) || null;
  if (!server) return { ok: false, code: 'reload_missing' };
  return {
    ok: true,
    actual: server,
    form: formFromActual(server),
    expectedVersion: server.version,
  };
}
