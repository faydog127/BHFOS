/**
 * R2 Intake Clarity — single lead/customer create contract.
 *
 * Required for new leads: name (first OR last OR company), 10-digit phone, service address.
 * Address is stored on the lead only (address + property_formatted_address).
 * Do not invent properties rows; do not silently drop columns on create.
 */

import { formatPhoneNumber, validatePhone } from './formUtils.js';
import { composeAddressFromParts } from './inspectionFieldAddress.js';

export const LEAD_INTAKE_REQUIRED_FIELDS = ['name', 'phone', 'address'];

export const LEAD_INTAKE_MESSAGES = {
  name: 'Add a first name, last name, or company.',
  phone: 'Enter a valid 10-digit phone number.',
  address: 'Enter the service address so the job location is saved on the customer.',
};

const asText = (value) => (typeof value === 'string' ? value.trim() : '');

export const resolveIntakeAddress = (input = {}) => {
  const freeform = asText(input.address || input.service_address || input.serviceAddress);
  if (freeform) return freeform;

  const composed = composeAddressFromParts({
    address1: input.address1 || input.address_line_1 || '',
    address2: input.address2 || input.address_line_2 || '',
    city: input.city || '',
    state: input.state || '',
    zip: input.zip || input.postal_code || '',
  });
  return asText(composed);
};

export const validateLeadIntake = (input = {}) => {
  const firstName = asText(input.first_name || input.firstName);
  const lastName = asText(input.last_name || input.lastName);
  const company = asText(input.company);
  const phoneRaw = input.phone || '';
  const phone = formatPhoneNumber(phoneRaw) || asText(phoneRaw);
  const email = asText(input.email) || null;
  const address = resolveIntakeAddress(input);

  const errors = [];
  if (!firstName && !lastName && !company) {
    errors.push({ field: 'name', message: LEAD_INTAKE_MESSAGES.name });
  }
  if (!validatePhone(phone)) {
    errors.push({ field: 'phone', message: LEAD_INTAKE_MESSAGES.phone });
  }
  if (!address) {
    errors.push({ field: 'address', message: LEAD_INTAKE_MESSAGES.address });
  }

  return {
    ok: errors.length === 0,
    errors,
    normalized: {
      first_name: firstName || null,
      last_name: lastName || null,
      company: company || null,
      phone: phone || null,
      email,
      address,
    },
  };
};

export const formatLeadIntakeErrors = (validation) =>
  (validation?.errors || []).map((entry) => entry.message).join(' ');

export const assertLeadIntakeValid = (input = {}) => {
  const validation = validateLeadIntake(input);
  if (!validation.ok) {
    const error = new Error(formatLeadIntakeErrors(validation));
    error.code = 'LEAD_INTAKE_VALIDATION';
    error.errors = validation.errors;
    throw error;
  }
  return validation;
};

/**
 * Canonical insert shape for new leads. Never sets property_id.
 */
export const buildLeadIntakeInsertPayload = (input = {}, options = {}) => {
  const validation = assertLeadIntakeValid(input);
  const { normalized } = validation;
  const nowIso = options.nowIso || new Date().toISOString();

  const payload = {
    first_name: normalized.first_name,
    last_name: normalized.last_name,
    company: normalized.company,
    phone: normalized.phone,
    email: normalized.email,
    address: normalized.address,
    property_formatted_address: normalized.address,
    source: options.source || input.source || 'crm',
    status: options.status || input.status || 'new',
    pipeline_stage: options.pipeline_stage || input.pipeline_stage || 'new',
    service: options.service || input.service || null,
    created_at: nowIso,
    updated_at: nowIso,
  };

  if (options.tenantId != null) {
    payload.tenant_id = options.tenantId;
  }

  if (options.extras && typeof options.extras === 'object') {
    Object.assign(payload, options.extras);
  }

  return payload;
};

export const isMissingColumnError = (error) =>
  error?.code === '42703' ||
  /column .* does not exist/i.test(error?.message || '') ||
  /could not find the '.*' column/i.test(error?.message || '');

export const getMissingColumnName = (error) => {
  const message = error?.message || '';
  const postgresMatch = message.match(/column "([^"]+)"/i);
  if (postgresMatch) return postgresMatch[1];
  const cacheMatch = message.match(/could not find the '([^']+)' column/i);
  return cacheMatch ? cacheMatch[1] : null;
};

/**
 * Plain-language DB/schema errors for create paths (no silent column strip).
 */
export const describeLeadIntakeDbError = (error) => {
  if (!error) return 'Could not save the customer.';
  if (error.code === 'LEAD_INTAKE_VALIDATION') {
    return error.message || formatLeadIntakeErrors({ errors: error.errors || [] });
  }
  if (isMissingColumnError(error)) {
    const column = getMissingColumnName(error);
    if (column) {
      return `Database is missing the "${column}" field needed to save this customer. Contact support — the record was not saved with missing data.`;
    }
    return 'Database is missing a required customer field. Contact support — the record was not saved with missing data.';
  }
  return error.message || 'Could not save the customer.';
};
