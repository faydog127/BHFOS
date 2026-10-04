/**
 * Readable labels already used by Executive and Advanced.
 * Reports import this module so they do not define a second map.
 */
export const TOKEN_LABELS = {
  NotReady: 'Not ready',
  below_near: 'Below near capacity',
  near_capacity: 'Near capacity',
  at_or_over_capacity: 'At or over capacity',
};

export function presentLabel(value) {
  if (typeof value !== 'string' || value === '') return value;
  let next = value;
  for (const [token, label] of Object.entries(TOKEN_LABELS)) next = next.replaceAll(token, label);
  if (/^[a-z][a-z0-9_]*$/.test(next)) {
    const parts = next.split('_');
    return parts.map((part, index) => (index === 0 && part ? part.charAt(0).toUpperCase() + part.slice(1) : part)).join(' ');
  }
  return next;
}
