/**
 * Presentation rounding only. The calculation engine does not call this.
 * Null renders as "--".
 */

export function roundHalfUp(value, decimals) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const places = decimals === undefined ? 0 : decimals;
  const factor = 10 ** places;
  const shifted = value * factor;
  const sign = shifted < 0 ? -1 : 1;
  const rounded = sign * Math.round(Math.abs(shifted) + 1e-10);
  return rounded / factor;
}

export function formatCurrencyWhole(value) {
  if (value === null || value === undefined || typeof value !== 'number' || !Number.isFinite(value)) {
    return '--';
  }
  const rounded = roundHalfUp(value, 0);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(rounded);
}

export function formatCurrencyCents(value) {
  if (value === null || value === undefined || typeof value !== 'number' || !Number.isFinite(value)) {
    return '--';
  }
  const rounded = roundHalfUp(value, 2);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(rounded);
}

export function formatNumber(value, digits) {
  if (value === null || value === undefined || typeof value !== 'number' || !Number.isFinite(value)) {
    return '--';
  }
  const rounded = roundHalfUp(value, digits);
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(rounded);
}

export function formatPercentFromFraction(value) {
  if (value === null || value === undefined || typeof value !== 'number' || !Number.isFinite(value)) {
    return '--';
  }
  const rounded = roundHalfUp(value * 100, 2);
  return `${formatNumber(rounded, 2)}%`;
}

export function formatHours(value) {
  return formatNumber(value, 2);
}
