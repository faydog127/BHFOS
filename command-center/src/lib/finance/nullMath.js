/**
 * Null-safe arithmetic for the planning engine.
 * Empty inputs stay null. They are never coerced to zero.
 * A zero divisor returns null. A zero numerator with a non-zero divisor returns 0.
 * No rounding.
 */

export function num(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return null;
    if (!/^[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?$/i.test(trimmed)) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  return null;
}

export function sumNullable(values) {
  let total = 0;
  for (const value of values) {
    if (value === null || value === undefined) return null;
    if (typeof value !== 'number' || !Number.isFinite(value)) return null;
    total += value;
  }
  return total;
}

export function div(numerator, denominator) {
  if (numerator === null || numerator === undefined) return null;
  if (denominator === null || denominator === undefined) return null;
  if (typeof numerator !== 'number' || !Number.isFinite(numerator)) return null;
  if (typeof denominator !== 'number' || !Number.isFinite(denominator)) return null;
  if (denominator === 0) return null;
  return numerator / denominator;
}

export function maxNullable(a, b) {
  if (a === null || b === null) return null;
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(a, b);
}

/**
 * Excel-style ROUNDUP to a positive increment. Exact integers stay put.
 * Presentation rounding does not belong here; this is the named price-increment rule.
 */
export function roundUpToIncrement(value, increment) {
  const amount = num(value);
  const step = num(increment);
  if (amount === null || step === null || step <= 0 || amount < 0) return null;
  const quotient = amount / step;
  const nearest = Math.round(quotient);
  if (Math.abs(quotient - nearest) < 1e-9) return nearest * step;
  return Math.ceil(quotient) * step;
}
