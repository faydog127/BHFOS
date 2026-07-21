/**
 * ML-P1 Slice 1 — Identity / address join pattern (KI-03 / KI-04).
 *
 * Authoritative P1 customer = `leads` row (stable UUID id).
 * Service address for P1 path = lead.address / lead.property_formatted_address,
 * composed from structured parts using address_line_1 alias (never invent properties UUID joins).
 *
 * Do NOT:
 * - join money-loop entities to properties on name
 * - assume leads.property_id UUID equals properties.id bigint
 * - write address1 column on hosted properties (use address_line_1 when touching properties)
 */

import { resolveIntakeAddress } from './leadIntakeContract.js';

export const ML_P1_S1_CUSTOMER_ENTITY = 'lead';

export const ML_P1_S1_ADDRESS_FIELD_POLICY = Object.freeze({
  lead_freeform: ['address', 'property_formatted_address'],
  structured_aliases: {
    street: ['address1', 'address_line_1'],
    street2: ['address2', 'address_line_2'],
    city: ['city'],
    state: ['state'],
    zip: ['zip', 'postal_code'],
  },
  properties_table_street_column: 'address_line_1',
  forbidden_properties_street_column: 'address1',
});

/**
 * Resolve service address for quote draft from lead + optional form overrides.
 */
export function resolveP1ServiceAddress({ lead = null, form = null } = {}) {
  if (form) {
    const fromForm = resolveIntakeAddress(form);
    if (fromForm) return fromForm;
  }
  if (lead) {
    const fromLead =
      (typeof lead.property_formatted_address === 'string' && lead.property_formatted_address.trim()) ||
      (typeof lead.address === 'string' && lead.address.trim()) ||
      '';
    if (fromLead) return fromLead;
  }
  return '';
}

/**
 * Assert quote payload does not use name-based customer linking.
 */
export function assertStableCustomerLink(quotePayload = {}) {
  if (!quotePayload.lead_id) {
    const err = new Error('DENY: draft quote requires stable lead_id (no name-based linking).');
    err.code = 'ML_P1_S1_MISSING_LEAD_ID';
    throw err;
  }
  if (quotePayload.property_id != null && quotePayload.property_id !== '') {
    // Soft policy: allow opaque pointer only if caller marks it; default strip guidance.
    // S1 does not invent property UUID/bigint joins.
  }
  return true;
}

export function documentUuidBigintPolicy() {
  return {
    status: 'DEFER_SIGNED_unification',
    rule: 'P1 uses lead UUID as customer authority; do not join properties.id bigint to lead UUID as equality.',
    address_column: 'address_line_1 on properties when needed; leads use freeform address fields.',
  };
}
