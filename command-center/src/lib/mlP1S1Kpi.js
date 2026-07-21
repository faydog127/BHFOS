/**
 * ML-P1 Slice 1 — KPI instrumentation (in-memory + optional event).
 * Baseline-first: timings are recorded; targets not invented here.
 */

/* Avoid globalThis (eslint no-undef under react-app). Prefer window, then Node global. */
function rootObject() {
  if (typeof window !== 'undefined') return window;
  if (typeof global !== 'undefined') return global;
  return {};
}

const STORE_KEY = '__ML_P1_S1_KPI_STORE__';

function store() {
  const g = rootObject();
  if (!g[STORE_KEY]) {
    g[STORE_KEY] = {
      timers: Object.create(null),
      counters: Object.create(null),
      notesEscapeDiary: [],
    };
  }
  return g[STORE_KEY];
}

export function resetMlP1S1KpiStore() {
  const g = rootObject();
  g[STORE_KEY] = {
    timers: Object.create(null),
    counters: Object.create(null),
    notesEscapeDiary: [],
  };
}

export function startKpiTimer(name) {
  store().timers[name] = { startedAt: Date.now(), endedAt: null, ms: null };
}

export function endKpiTimer(name) {
  const t = store().timers[name];
  if (!t || t.startedAt == null) return null;
  t.endedAt = Date.now();
  t.ms = t.endedAt - t.startedAt;
  return t.ms;
}

export function incrementKpi(name, by = 1) {
  const c = store().counters;
  c[name] = (c[name] || 0) + by;
  return c[name];
}

export function recordNotesEscape({ usedExternalTool, tool, task, at = null } = {}) {
  const entry = {
    usedExternalTool: Boolean(usedExternalTool),
    tool: tool || null,
    task: task || null,
    at: at || new Date().toISOString(),
  };
  store().notesEscapeDiary.push(entry);
  if (usedExternalTool) incrementKpi('notes_escape');
  else incrementKpi('notes_escape_clean');
  return entry;
}

export function getKpiSnapshot() {
  const s = store();
  return {
    timers: { ...s.timers },
    counters: { ...s.counters },
    notesEscapeDiary: [...s.notesEscapeDiary],
  };
}
