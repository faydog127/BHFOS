/**
 * Production-safe address helpers for the technician inspection field flow.
 *
 * Lead freeform address: leads.address
 * Structured address: properties.address1/address2/city/state/zip via property_id
 *
 * Do not read or write leads.address1/address2/city/state/zip — those columns
 * do not exist in production.
 *
 * Do not use nested PostgREST relationship embeds from leads onto properties.
 * Production does not expose a leads→properties FK relationship in the schema cache.
 * Load properties with a separate query and attach in application code.
 */

const asText = (value) => (typeof value === 'string' ? value.trim() : '');

/** Lead columns that exist in production. No nested relationship embeds. */
export const LEAD_FIELD_SELECT =
  'id, first_name, last_name, company, email, phone, address, property_id, contact_id';

/** Property columns used for structured service addresses. */
export const PROPERTY_FIELD_SELECT = 'id, address1, address2, city, state, zip';

export const normalizeLeadRecord = (lead) => {
  if (!lead) return null;
  const property = Array.isArray(lead.property) ? lead.property[0] : lead.property;
  return { ...lead, property: property || null };
};

/**
 * Load properties by id and attach them onto lead rows as `property`.
 * Uses an explicit properties query — not a PostgREST relationship embed.
 */
export const hydrateLeadsWithProperties = async (client, tenantId, leadsInput) => {
  const inputWasArray = Array.isArray(leadsInput);
  const leads = (inputWasArray ? leadsInput : [leadsInput])
    .filter(Boolean)
    .map(normalizeLeadRecord);
  if (!leads.length) return inputWasArray ? [] : null;

  const propertyIds = [...new Set(leads.map((lead) => lead.property_id).filter(Boolean))];
  if (!propertyIds.length) return inputWasArray ? leads : leads[0];

  let query = client
    .from('properties')
    .select(PROPERTY_FIELD_SELECT)
    .in('id', propertyIds);
  if (tenantId) query = query.eq('tenant_id', tenantId);

  const { data, error } = await query;
  if (error) throw error;

  const byId = new Map((data || []).map((row) => [row.id, row]));
  const hydrated = leads.map((lead) => ({
    ...lead,
    property: (lead.property_id && byId.get(lead.property_id)) || lead.property || null,
  }));
  return inputWasArray ? hydrated : hydrated[0];
};

export const formatPropertyAddress = (property) => {
  if (!property || typeof property !== 'object') return '';
  const cityLine = [asText(property.city), asText(property.state), asText(property.zip)]
    .filter(Boolean)
    .join(' ');
  return [asText(property.address1), asText(property.address2), cityLine]
    .filter(Boolean)
    .join(', ');
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
 *   a. linked property structured address
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
  const fromProperty = formatPropertyAddress(
    property || (Array.isArray(lead?.property) ? lead.property[0] : lead?.property) || null,
  );
  if (fromProperty) return fromProperty;

  const fromInspection = asText(inspectionServiceAddress);
  if (fromInspection) return fromInspection;

  const fromJob = asText(jobServiceAddress);
  if (fromJob) return fromJob;

  return asText(lead?.address) || '';
};

export const leadHasUsableAddress = (lead) => Boolean(resolveServiceAddress({ lead }));
