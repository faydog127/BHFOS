const asText = (value) => (typeof value === 'string' ? value.trim() : '');

/**
 * Phase 1.5 compatibility shim:
 * - Legacy inspection statuses like `in_progress` should behave like `draft` in the UI.
 * - DB migrations normalize many of these, but the UI should be resilient to stragglers.
 */
export const normalizeInspectionStatus = (value) => {
  const raw = asText(value).toLowerCase();
  if (!raw) return 'draft';
  if (raw === 'in_progress' || raw === 'open' || raw === 'started') return 'draft';
  return raw;
};

export const isDraftInspection = (value) => normalizeInspectionStatus(value) === 'draft';

