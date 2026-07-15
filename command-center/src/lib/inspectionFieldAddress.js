/**
 * Production-safe address helpers for the technician inspection field flow.
 *
 * Lead freeform address: leads.address
 * Denormalized property text on the lead: leads.property_formatted_address
 *
 * Important production facts:
 * - Do not use nested PostgREST relationship embeds from leads onto properties.
 * - public.properties.id is bigint (marketing/scouting table).
 * - leads.property_id is uuid and is NOT a resolvable FK to public.properties.
 * - Never let a failed properties lookup block inspection load.
 */

const asText = (value) => (typeof value === 'string' ? value.trim() : '');

/** Lead columns that exist in production. No nested relationship embeds. */
export const LEAD_FIELD_SELECT =
  'id, first_name, last_name, company, email, phone, address, property_id, property_formatted_address, contact_id';

/**
 * Columns for public.properties when a numeric id is present.
 * Production uses address_line_1 (not address1/address2).
 */
export const PROPERTY_FIELD_SELECT = 'id, address_line_1, city, state, zip';

const isNumericPropertyId = (value) => /^\d+$/.test(String(value ?? '').trim());

export const normalizeLeadRecord = (lead) => {
  if (!lead) return null;
  const property = Array.isArray(lead.property) ? lead.property[0] : lead.property;
  return { ...lead, property: property || null };
};

/**
 * Optionally attach a properties row for numeric property ids only.
 * UUID leads.property_id values are left unresolved (no throw).
 */
export const hydrateLeadsWithProperties = async (client, _tenantId, leadsInput) => {
  const inputWasArray = Array.isArray(leadsInput);
  const leads = (inputWasArray ? leadsInput : [leadsInput])
    .filter(Boolean)
    .map(normalizeLeadRecord);
  if (!leads.length) return inputWasArray ? [] : null;

  const propertyIds = [
    ...new Set(leads.map((lead) => lead.property_id).filter(isNumericPropertyId)),
  ];
  if (!propertyIds.length) return inputWasArray ? leads : leads[0];

  try {
    const { data, error } = await client
      .from('properties')
      .select(PROPERTY_FIELD_SELECT)
      .in('id', propertyIds);
    if (error) throw error;

    const byId = new Map((data || []).map((row) => [String(row.id), row]));
    const hydrated = leads.map((lead) => ({
      ...lead,
      property:
        (lead.property_id && byId.get(String(lead.property_id))) || lead.property || null,
    }));
    return inputWasArray ? hydrated : hydrated[0];
  } catch (error) {
    // Never block technician inspection load on properties lookup mismatch.
    console.warn('Property hydrate skipped:', error?.message || error);
    return inputWasArray ? leads : leads[0];
  }
};

export const formatPropertyAddress = (property) => {
  if (!property || typeof property !== 'object') return '';
  const line1 = asText(property.address_line_1 || property.address1);
  const line2 = asText(property.address_line_2 || property.address2);
  const cityLine = [asText(property.city), asText(property.state), asText(property.zip)]
    .filter(Boolean)
    .join(' ');
  return [line1, line2, cityLine].filter(Boolean).join(', ');
};

/**
 * Compose a freeform service-address string from form parts the technician typed.
 * This is composition of structured form input — not parsing of leads.address.
 */
export const composeAddressFromParts = ({
  address1 = '',
  address2 = '',
  city = '',
  state = '',
  zip = '',
} = {}) => {
  const cityLine = [asText(city), asText(state), asText(zip)].filter(Boolean).join(' ');
  return [asText(address1), asText(address2), cityLine].filter(Boolean).join(', ');
};

/**
 * Resolve the display/report service address.
 * Priority:
 *   a. attached property structured address OR leads.property_formatted_address
 *   b. inspection / job service address already in context
 *   c. leads.address
 *   d. empty
 */
export const resolveServiceAddress = ({
  property = null,
  inspectionServiceAddress = '',
  jobServiceAddress = '',
  lead = null,
} = {}) => {
  const attached =
    property || (Array.isArray(lead?.property) ? lead.property[0] : lead?.property) || null;
  const fromProperty = formatPropertyAddress(attached);
  if (fromProperty) return fromProperty;

  const fromFormatted = asText(lead?.property_formatted_address);
  if (fromFormatted) return fromFormatted;

  const fromInspection = asText(inspectionServiceAddress);
  if (fromInspection) return fromInspection;

  const fromJob = asText(jobServiceAddress);
  if (fromJob) return fromJob;

  return asText(lead?.address) || '';
};

/**
 * CRM / invoice / job address resolution that never depends on PostgREST
 * lead→properties embeds.
 *
 * Priority:
 *   a. snapshot / formatted address already on the record
 *   b. job or invoice service_address
 *   c. leads.property_formatted_address
 *   d. leads.address
 *   e. empty
 */
export const resolveLegacyServiceAddress = ({
  snapshotAddress = '',
  serviceAddress = '',
  lead = null,
  property = null,
} = {}) => {
  const snapshot = asText(snapshotAddress);
  if (snapshot) return snapshot;

  const fromService = asText(serviceAddress);
  if (fromService) return fromService;

  const attached =
    property || (Array.isArray(lead?.property) ? lead.property[0] : lead?.property) || null;
  const fromProperty = formatPropertyAddress(attached);
  if (fromProperty) return fromProperty;

  const fromFormatted = asText(lead?.property_formatted_address);
  if (fromFormatted) return fromFormatted;

  return asText(lead?.address) || '';
};

/** Lead columns safe for CRM selects — no nested property embeds. */
export const LEAD_ADDRESS_SELECT =
  'id, first_name, last_name, company, email, phone, address, property_id, property_formatted_address, contact_id';

export const leadHasUsableAddress = (lead) => Boolean(resolveServiceAddress({ lead }));
