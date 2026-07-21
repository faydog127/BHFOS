/**
 * ML-P1 Slice 1 — Duplicate customer detection (deterministic rules).
 * Tenant-scoped. No name-only matching as sole criterion.
 */

import { formatPhoneNumber } from './formUtils.js';

const asText = (value) => (typeof value === 'string' ? value.trim() : '');

export const normalizePhoneDigits = (phone) => {
  const formatted = formatPhoneNumber(phone) || asText(phone);
  const digits = String(formatted).replace(/\D/g, '');
  if (digits.length >= 10) return digits.slice(-10);
  return digits || '';
};

/**
 * Build PostgREST `.or()` filter fragments for duplicate search.
 * Requires at least one strong signal (phone, email, or address fragment).
 *
 * @param {object} input
 * @returns {{ ok: boolean, filters: string[], reason?: string }}
 */
export function buildDuplicateCustomerFilters(input = {}) {
  const phoneDigits = normalizePhoneDigits(input.phone);
  const email = asText(input.email).toLowerCase();
  const lastName = asText(input.last_name || input.lastName);
  const address1 = asText(input.address1 || input.address_line_1 || '');
  const address = asText(input.address || input.service_address || '');
  const streetHint = address1 || address.split(',')[0] || '';

  const filters = [];
  if (phoneDigits.length === 10) {
    filters.push(`phone.ilike.%${phoneDigits}%`);
  }
  if (email) {
    filters.push(`email.ilike.${email}`);
  }
  // Address street is a supporting signal; last name alone is never enough.
  if (streetHint.length >= 5) {
    filters.push(`address.ilike.%${streetHint}%`);
    filters.push(`property_formatted_address.ilike.%${streetHint}%`);
  }
  if (lastName && (phoneDigits.length === 10 || email || streetHint.length >= 5)) {
    filters.push(`last_name.ilike.%${lastName}%`);
  }

  if (!phoneDigits && !email && streetHint.length < 5) {
    return {
      ok: false,
      filters: [],
      reason: 'Need phone, email, or service address street to check for duplicates.',
    };
  }

  return { ok: true, filters };
}

/**
 * Rank matches: phone > email > address.
 */
export function scoreDuplicateCandidate(input = {}, candidate = {}) {
  let score = 0;
  const phoneDigits = normalizePhoneDigits(input.phone);
  const candPhone = normalizePhoneDigits(candidate.phone);
  if (phoneDigits && candPhone && phoneDigits === candPhone) score += 100;
  const email = asText(input.email).toLowerCase();
  const candEmail = asText(candidate.email).toLowerCase();
  if (email && candEmail && email === candEmail) score += 50;
  const street = asText(input.address1 || input.address_line_1 || input.address).toLowerCase();
  const candAddr = asText(
    candidate.address || candidate.property_formatted_address || '',
  ).toLowerCase();
  if (street && candAddr && candAddr.includes(street.split(',')[0].slice(0, 12))) score += 20;
  return score;
}

export function sortDuplicateCandidates(input, rows = []) {
  return [...rows].sort(
    (a, b) => scoreDuplicateCandidate(input, b) - scoreDuplicateCandidate(input, a),
  );
}
