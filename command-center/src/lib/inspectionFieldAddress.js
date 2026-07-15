/**
 * Production-safe address helpers for the technician inspection field flow.
 *
 * Lead freeform address: leads.address
 * Structured address: properties.address1/address2/city/state/zip via property_id
 *
 * Do not read or write leads.address1/address2/city/state/zip — those columns
 * do not exist in production.
 */

const asText = (value) => (typeof value === 'string' ? value.trim() : '');

/** Lead columns + nested property embed that match production. */
export const LEAD_FIELD_SELECT =
  'id, first_name, last_name, company, email, phone, address, property_id, contact_id, property:property_id(id, address1, address2, city, state, zip)';

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
