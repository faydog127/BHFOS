import { DOCUMENT_TYPES, REQUIRED_PROTECTION_LINES, SECTION_DEFINITIONS } from './config.js';
import { validateDocumentPayload } from './validate.js';

const asString = (value) => (typeof value === 'string' ? value.trim() : '');

const asNumber = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const hasPresentValue = (value) =>
  value !== null && value !== undefined && !(typeof value === 'string' && value.trim() === '');

const titleCase = (value) =>
  String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(asNumber(value));

const formatDate = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) return null;

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(parsed);
};

const buildAddress = (address) => {
  if (!address || typeof address !== 'object') return '';

  const parts = [
    asString(address.address1),
    asString(address.address2),
    asString(address.city),
    asString(address.state),
    asString(address.zip),
  ].filter(Boolean);

  return parts.join(', ');
};

const PX_PER_INCH = 96;
const BLOCK_VERTICAL_GAP_PX = 12;
const SAFE_FLOW_BUFFER_PX = 28;
const SAFE_FINAL_BUFFER_PX = 32;

export const QUOTE_LAYOUT_VERSION = 'quote-layout-v2';

export const QUOTE_PAGE_GEOMETRY = Object.freeze({
  pageWidthPx: 8.5 * PX_PER_INCH,
  pageHeightPx: 11 * PX_PER_INCH,
  paddingTopPx: 0.45 * PX_PER_INCH,
  paddingBottomPx: 0.45 * PX_PER_INCH,
  paddingXPx: 0.5 * PX_PER_INCH,
  masters: Object.freeze({
    first: Object.freeze({
      headerHeightPx: 2.72 * PX_PER_INCH,
      footerHeightPx: 0.62 * PX_PER_INCH,
    }),
    interior: Object.freeze({
      headerHeightPx: 0.94 * PX_PER_INCH,
      footerHeightPx: 0.58 * PX_PER_INCH,
    }),
    final: Object.freeze({
      headerHeightPx: 0.94 * PX_PER_INCH,
      footerHeightPx: 0.58 * PX_PER_INCH,
    }),
  }),
});

const getMasterGeometry = (master) => {
  const pageMaster = QUOTE_PAGE_GEOMETRY.masters[master] || QUOTE_PAGE_GEOMETRY.masters.first;
  const bodyTopPx = QUOTE_PAGE_GEOMETRY.paddingTopPx + pageMaster.headerHeightPx;
  const bodyBottomPx = QUOTE_PAGE_GEOMETRY.pageHeightPx - QUOTE_PAGE_GEOMETRY.paddingBottomPx - pageMaster.footerHeightPx;

  return {
    master,
    headerHeightPx: pageMaster.headerHeightPx,
    footerHeightPx: pageMaster.footerHeightPx,
    bodyTopPx,
    bodyBottomPx,
    bodyHeightPx: bodyBottomPx - bodyTopPx,
  };
};

const normalizeText = (value) => asString(value).replace(/\s+/g, ' ').trim();

const estimateTextLines = (value, charsPerLine = 96) => {
  const normalized = normalizeText(value);
  if (!normalized) return 0;

  return normalized
    .split(/\n+/)
    .filter(Boolean)
    .reduce((sum, paragraph) => sum + Math.max(1, Math.ceil(paragraph.length / charsPerLine)), 0);
};

const estimateListLineUsage = (items = [], charsPerLine = 34) =>
  (Array.isArray(items) ? items : []).reduce(
    (sum, item) => sum + Math.max(1, Math.ceil(asString(item).length / charsPerLine)),
    0
  );

const splitIntoSentences = (value) => {
  const normalized = normalizeText(value);
  if (!normalized) return [];

  const sentences = normalized.match(/[^.!?]+(?:[.!?]+|$)/g)?.map((entry) => entry.trim()).filter(Boolean) || [];
  return sentences.length > 0 ? sentences : [normalized];
};

const joinSentences = (items = []) => items.join(' ').replace(/\s+/g, ' ').trim();

const takeItemsByLineBudget = (items = [], maxLines, charsPerLine = 34) => {
  const source = Array.isArray(items) ? items : [];
  let usedLines = 0;
  let index = 0;

  while (index < source.length) {
    const item = source[index];
    const lineCost = Math.max(1, Math.ceil(asString(item).length / charsPerLine));
    if (usedLines + lineCost > maxLines) break;
    usedLines += lineCost;
    index += 1;
  }

  return {
    taken: source.slice(0, index),
    remaining: source.slice(index),
    usedLines,
  };
};

const getLeadFullName = (lead) => {
  const first = asString(lead?.first_name);
  const last = asString(lead?.last_name);
  return [first, last].filter(Boolean).join(' ').trim();
};

const getQuoteStatusLabel = (status) => {
  const normalized = asString(status).toLowerCase();
  if (!normalized) return 'Draft';
  if (normalized === 'pending' || normalized === 'pending_review') return 'Pending Review';
  if (normalized === 'superseded') return 'Superseded';
  return titleCase(normalized);
};

const getStatusTone = (status) => {
  const normalized = asString(status).toLowerCase();
  if (['approved', 'accepted', 'paid'].includes(normalized)) return 'success';
  if (['declined', 'rejected', 'superseded', 'void'].includes(normalized)) return 'danger';
  if (['expired', 'overdue'].includes(normalized)) return 'warning';
  return 'info';
};

const normalizeQuoteItems = (items = []) =>
  (Array.isArray(items) ? items : [])
    .map((item, index) => {
      const quantity = asNumber(item.quantity || 1);
      const unitPrice = asNumber(item.unit_price);
      const totalPrice = asNumber(item.total_price) || quantity * unitPrice;

      return {
        id: item.id || `quote-item-${index + 1}`,
        description: asString(item.description) || `Service Item ${index + 1}`,
        quantity,
        unit_price: unitPrice,
        total_price: totalPrice,
      };
    })
    .filter((item) => item.description);

const deriveIncludedItems = (quote, items) => {
  const explicit = Array.isArray(quote?.included_items) ? quote.included_items.map(asString).filter(Boolean) : [];
  if (explicit.length > 0) return explicit;

  return [
    ...items.slice(0, 4).map((item) => item.description),
    'Arrival-ready documentation and service coordination',
  ].filter(Boolean);
};

const deriveExcludedItems = (quote) => {
  const explicit = Array.isArray(quote?.excluded_items) ? quote.excluded_items.map(asString).filter(Boolean) : [];
  if (explicit.length > 0) return explicit;

  return [
    'Dryer appliance repair or replacement',
    'Hidden damage, code upgrades, or material replacement not listed above',
    'Access conditions that materially change labor or equipment requirements',
  ];
};

const deriveAssumptionsText = (quote) =>
  asString(quote?.assumptions_text) ||
  'Pricing assumes standard unit access, normal vent routing, and no concealed conditions requiring demolition, specialty lifts, or after-hours access.';

const deriveExclusionsText = (quote) =>
  asString(quote?.exclusions_text) ||
  'Hidden damage, inaccessible routing, code corrections, replacement parts, roof or wall repair, and any field condition that materially changes scope require a formal change order.';

const deriveScopeSnapshot = (quote, items) =>
  asString(quote?.scope_snapshot_text) ||
  (items.length > 0
    ? `Perform the approved services listed below at ${asString(quote?.service_address) || 'the service address'} and document completion for release and scheduling continuity.`
    : 'Perform the approved service scope at the listed service address and document completion.');

const deriveServiceSummary = (quote, items) =>
  asString(quote?.service_summary) || items.map((item) => item.description).slice(0, 3).join(', ');

const derivePaymentTerms = (quote) =>
  asString(quote?.payment_terms) ||
  'Approve to schedule service. Pricing remains valid through the date listed on this quote.';

const TVG_DEFAULT_CONTACT = {
  name: 'TVG Office',
  title: 'Scheduling & Quote Support',
  email: 'info@vent-guys.com',
  phone: '321-360-9704',
  website: 'vent-guys.com',
};

const firstNonEmpty = (...values) => values.map(asString).find(Boolean) || '';

const deriveTvgContact = (quote) => ({
  name: firstNonEmpty(
    quote?.rep_name,
    quote?.prepared_by_name,
    quote?.sales_rep_name,
    quote?.account_manager_name,
    quote?.quote_owner_name,
    TVG_DEFAULT_CONTACT.name,
  ),
  title: firstNonEmpty(
    quote?.rep_title,
    quote?.prepared_by_title,
    quote?.sales_rep_title,
    quote?.account_manager_title,
    quote?.quote_owner_title,
    TVG_DEFAULT_CONTACT.title,
  ),
  email: firstNonEmpty(
    quote?.rep_email,
    quote?.prepared_by_email,
    quote?.sales_rep_email,
    quote?.account_manager_email,
    quote?.quote_owner_email,
    TVG_DEFAULT_CONTACT.email,
  ),
  phone: firstNonEmpty(
    quote?.rep_phone,
    quote?.prepared_by_phone,
    quote?.sales_rep_phone,
    quote?.account_manager_phone,
    quote?.quote_owner_phone,
    TVG_DEFAULT_CONTACT.phone,
  ),
  website: TVG_DEFAULT_CONTACT.website,
});

const buildPayload = (quote, items) => {
  const lead = quote?.leads || {};
  const tvgContact = deriveTvgContact(quote);
  const customerName = asString(quote?.customer_name) || getLeadFullName(lead) || 'Customer';
  const serviceAddress = asString(quote?.service_address) || buildAddress(lead?.address);
  const issueDate = asString(quote?.sent_at) || asString(quote?.created_at) || new Date().toISOString();
  const subtotal = items.reduce((sum, item) => sum + asNumber(item.total_price), 0);
  const taxAmount = hasPresentValue(quote?.tax_amount)
    ? asNumber(quote?.tax_amount)
    : Number((subtotal * asNumber(quote?.tax_rate)).toFixed(2));
  const totalAmount = hasPresentValue(quote?.total_amount)
    ? asNumber(quote?.total_amount)
    : subtotal + taxAmount;
  const propertyName = asString(quote?.property_name) || (customerName ? `${customerName} Property` : 'Service Property');
  const documentId = asString(quote?.id) || asString(quote?.quote_id) || 'quote-preview';
  const approvedVersion = asString(quote?.approved_version) || asString(quote?.document_version) || 'v1';
  const jobId = asString(quote?.job_id) || asString(quote?.work_order_number) || `PENDING-${documentId.slice(0, 6).toUpperCase()}`;

  return {
    document_type: DOCUMENT_TYPES.QUOTE,
    document_id: documentId,
    document_number: asString(quote?.quote_number) || documentId.slice(0, 8).toUpperCase(),
    quote_number: asString(quote?.quote_number) || documentId.slice(0, 8).toUpperCase(),
    job_id: jobId,
    status: asString(quote?.status) || 'draft',
    issue_date: issueDate,
    valid_through: asString(quote?.valid_until) || null,
    customer_name: customerName,
    company_name: asString(quote?.company_name),
    customer_email: asString(quote?.customer_email) || asString(lead?.email),
    customer_phone: asString(quote?.customer_phone) || asString(lead?.phone),
    property_name: propertyName,
    service_address: serviceAddress,
    unit_reference: asString(quote?.unit_reference),
    batch_reference: asString(quote?.batch_reference),
    po_required: Boolean(quote?.po_required),
    po_number: asString(quote?.po_number),
    accounting_contact: asString(quote?.accounting_contact),
    tvg_contact_name: tvgContact.name,
    tvg_contact_title: tvgContact.title,
    tvg_contact_email: tvgContact.email,
    tvg_contact_phone: tvgContact.phone,
    tvg_contact_website: tvgContact.website,
    service_summary: deriveServiceSummary(quote, items),
    scope_snapshot_text: deriveScopeSnapshot(quote, items),
    included_items: deriveIncludedItems(quote, items),
    excluded_items: deriveExcludedItems(quote),
    assumptions_text: deriveAssumptionsText(quote),
    exclusions_text: deriveExclusionsText(quote),
    subtotal,
    tax_rate: asNumber(quote?.tax_rate),
    tax_amount: taxAmount,
    total_amount: totalAmount,
    payment_terms: derivePaymentTerms(quote),
    payment_instructions:
      asString(quote?.payment_instructions) ||
      'Approve this quote to lock scope and move into scheduling. Any scope changes after approval require a formal change order.',
    dispute_protection_line: REQUIRED_PROTECTION_LINES.dispute,
    service_verification_text: REQUIRED_PROTECTION_LINES.serviceVerification,
    approval_required: true,
    approval_method: asString(quote?.approval_method) || 'digital_confirmation',
    approved_version: approvedVersion,
    document_version: asString(quote?.document_version) || approvedVersion,
    source_snapshot_id: asString(quote?.source_snapshot_id) || `quote-${documentId}-snapshot`,
    header_text: asString(quote?.header_text),
    footer_text: asString(quote?.footer_text),
    line_items: items,
    release_audit: {
      page_count_stable: true,
      null_render_clean: true,
    },
  };
};

const estimateClientPropertyHeight = (payload) => {
  const leftLines =
    1 +
    Number(Boolean(payload.customer_email)) +
    Number(Boolean(payload.customer_phone)) +
    Number(Boolean(payload.company_name));
  const rightLines =
    1 +
    Number(Boolean(payload.property_name)) +
    Number(Boolean(payload.unit_reference)) +
    Number(Boolean(payload.batch_reference));

  return 92 + Math.max(leftLines, rightLines) * 30;
};

const estimateScopeSnapshotHeight = (payload, fragment = {}) => {
  const scopeText = fragment.text || payload.scope_snapshot_text;
  const helperText = fragment.helperText ?? payload.header_text;
  const scopeLines = estimateTextLines(scopeText, 92);
  const helperLines = helperText ? estimateTextLines(helperText, 88) : 0;

  return 92 + scopeLines * 22 + (helperLines > 0 ? 24 + helperLines * 18 : 0);
};

const estimatePricingTableHeight = (items = []) => 72 + 38 + (Array.isArray(items) ? items.length : 0) * 46;

const estimateServiceNotesHeight = (payload) => {
  const noteCount =
    Number(Boolean(payload.batch_reference)) +
    Number(Boolean(payload.unit_reference)) +
    Number(Boolean(payload.po_number)) +
    Number(Boolean(payload.accounting_contact));

  return 84 + Math.max(1, Math.ceil(noteCount / 2)) * 22;
};

const estimateNarrativeSectionHeight = (text) => 72 + estimateTextLines(text, 100) * 20;

const estimateIncludedExcludedHeight = (includedItems = [], excludedItems = []) => {
  const includedLines = estimateListLineUsage(includedItems, 34);
  const excludedLines = estimateListLineUsage(excludedItems, 34);
  const hasIncluded = includedItems.length > 0;
  const hasExcluded = excludedItems.length > 0;

  if (hasIncluded && hasExcluded) {
    return 94 + Math.max(includedLines, excludedLines) * 26;
  }

  return 78 + Math.max(includedLines, excludedLines, 1) * 22;
};

const estimateValidityHeight = () => 116;
const estimateTotalsHeight = () => 152;
const estimateApprovalHeight = () => 166;

const estimatePaymentTermsHeight = (payload) =>
  64 +
  estimateTextLines(payload.payment_terms, 112) * 16 +
  estimateTextLines(payload.payment_instructions, 112) * 16;

const estimateDisputeHeight = (payload) =>
  22 +
  estimateTextLines(payload.dispute_protection_line, 118) * 16 +
  (payload.footer_text ? estimateTextLines(payload.footer_text, 118) * 16 + 8 : 0);

const QUOTE_BLOCK_SCHEMA = Object.freeze({
  client_property: Object.freeze({
    id: 'client_property',
    type: 'section',
    pageEligibility: Object.freeze(['first', 'interior']),
    atomic: true,
    splittable: false,
    keepWithNext: true,
    reservedFinal: false,
    minPresenceHeight: 124,
    maxHeight: 210,
    priority: 10,
    estimateHeight: (payload) => estimateClientPropertyHeight(payload),
  }),
  scope_snapshot: Object.freeze({
    id: 'scope_snapshot',
    type: 'section',
    pageEligibility: Object.freeze(['first', 'interior']),
    atomic: true,
    splittable: false,
    keepWithNext: true,
    reservedFinal: false,
    minPresenceHeight: 138,
    maxHeight: 240,
    priority: 20,
    estimateHeight: (payload, fragment) => estimateScopeSnapshotHeight(payload, fragment),
  }),
  pricing_table: Object.freeze({
    id: 'pricing_table',
    type: 'table',
    pageEligibility: Object.freeze(['first', 'interior']),
    atomic: false,
    splittable: true,
    keepWithNext: true,
    reservedFinal: false,
    minPresenceHeight: 188,
    maxHeight: null,
    minRowsBeforeSplit: 2,
    priority: 30,
    estimateHeight: (_, fragment) => estimatePricingTableHeight(fragment.items),
  }),
  service_notes: Object.freeze({
    id: 'service_notes',
    type: 'section',
    pageEligibility: Object.freeze(['interior', 'final']),
    atomic: true,
    splittable: false,
    keepWithNext: false,
    reservedFinal: false,
    minPresenceHeight: 118,
    maxHeight: 180,
    priority: 40,
    estimateHeight: (payload) => estimateServiceNotesHeight(payload),
  }),
  assumptions: Object.freeze({
    id: 'assumptions',
    type: 'section',
    pageEligibility: Object.freeze(['interior', 'final']),
    atomic: false,
    splittable: true,
    keepWithNext: true,
    reservedFinal: false,
    minPresenceHeight: 112,
    maxHeight: 220,
    priority: 50,
    estimateHeight: (_, fragment) => estimateNarrativeSectionHeight(fragment.text),
  }),
  exclusions: Object.freeze({
    id: 'exclusions',
    type: 'section',
    pageEligibility: Object.freeze(['interior', 'final']),
    atomic: false,
    splittable: true,
    keepWithNext: true,
    reservedFinal: false,
    minPresenceHeight: 118,
    maxHeight: 230,
    priority: 60,
    estimateHeight: (_, fragment) => estimateNarrativeSectionHeight(fragment.text),
  }),
  included_excluded: Object.freeze({
    id: 'included_excluded',
    type: 'list',
    pageEligibility: Object.freeze(['first', 'interior', 'final']),
    atomic: false,
    splittable: true,
    keepWithNext: true,
    reservedFinal: false,
    minPresenceHeight: 128,
    maxHeight: 250,
    priority: 70,
    estimateHeight: (_, fragment) => estimateIncludedExcludedHeight(fragment.includedItems, fragment.excludedItems),
  }),
  validity_window: Object.freeze({
    id: 'validity_window',
    type: 'section',
    pageEligibility: Object.freeze(['first', 'interior', 'final']),
    atomic: true,
    splittable: false,
    keepWithNext: false,
    reservedFinal: false,
    minPresenceHeight: 96,
    maxHeight: 110,
    priority: 80,
    estimateHeight: () => estimateValidityHeight(),
  }),
  totals: Object.freeze({
    id: 'totals',
    type: 'section',
    pageEligibility: Object.freeze(['first', 'final']),
    atomic: true,
    splittable: false,
    keepWithNext: true,
    reservedFinal: true,
    minPresenceHeight: 120,
    maxHeight: 140,
    priority: 90,
    estimateHeight: () => estimateTotalsHeight(),
  }),
  payment_terms: Object.freeze({
    id: 'payment_terms',
    type: 'section',
    pageEligibility: Object.freeze(['first', 'final']),
    atomic: true,
    splittable: false,
    keepWithNext: true,
    reservedFinal: true,
    minPresenceHeight: 104,
    maxHeight: 180,
    priority: 100,
    estimateHeight: (payload) => estimatePaymentTermsHeight(payload),
  }),
  approval: Object.freeze({
    id: 'approval',
    type: 'section',
    pageEligibility: Object.freeze(['first', 'final']),
    atomic: true,
    splittable: false,
    keepWithNext: false,
    reservedFinal: true,
    minPresenceHeight: 140,
    maxHeight: 172,
    priority: 110,
    estimateHeight: () => estimateApprovalHeight(),
  }),
  dispute_protection: Object.freeze({
    id: 'dispute_protection',
    type: 'section',
    pageEligibility: Object.freeze(['first', 'final']),
    atomic: true,
    splittable: false,
    keepWithNext: false,
    reservedFinal: true,
    minPresenceHeight: 56,
    maxHeight: 90,
    priority: 120,
    estimateHeight: (payload) => estimateDisputeHeight(payload),
  }),
});

const getBlockSchema = (key) => QUOTE_BLOCK_SCHEMA[key];

const createBlock = (key, fragment = {}) => ({
  key,
  fragment,
  continued: Boolean(fragment.continued),
});

const estimateBlockHeight = (payload, block) => {
  const schema = getBlockSchema(block.key);
  return Math.ceil(schema.estimateHeight(payload, block.fragment || {}));
};

const splitNarrativeBlock = (key, payload, block, remainingHeight) => {
  const schema = getBlockSchema(key);
  const sentences = block.fragment.sentences || splitIntoSentences(block.fragment.text);
  if (sentences.length < 2) return null;

  const placed = [];
  for (const sentence of sentences) {
    const candidateText = joinSentences([...placed, sentence]);
    const candidateHeight = schema.estimateHeight(payload, { text: candidateText, continued: block.continued });
    if (candidateHeight <= remainingHeight) {
      placed.push(sentence);
    } else {
      break;
    }
  }

  if (placed.length === 0) return null;

  const placedText = joinSentences(placed);
  const remainingText = joinSentences(sentences.slice(placed.length));
  if (!remainingText) return null;

  const placedBlock = createBlock(key, {
    text: placedText,
    sentences: placed,
    continued: block.continued,
  });

  if (estimateBlockHeight(payload, placedBlock) < schema.minPresenceHeight) {
    return null;
  }

  return {
    placedBlock,
    remainderBlock: createBlock(key, {
      text: remainingText,
      sentences: sentences.slice(placed.length),
      continued: true,
    }),
  };
};

const splitPricingBlock = (payload, block, remainingHeight) => {
  const schema = getBlockSchema('pricing_table');
  const items = block.fragment.items || [];
  const baseHeight = 110;
  const rowHeight = 46;
  const rowsThatFit = Math.floor((remainingHeight - baseHeight) / rowHeight);

  if (rowsThatFit < schema.minRowsBeforeSplit || items.length <= schema.minRowsBeforeSplit) {
    return null;
  }

  const placedCount = Math.max(schema.minRowsBeforeSplit, Math.min(rowsThatFit, items.length - 1));
  if (placedCount <= 0 || placedCount >= items.length) {
    return null;
  }

  return {
    placedBlock: createBlock('pricing_table', {
      items: items.slice(0, placedCount),
      continued: block.continued,
    }),
    remainderBlock: createBlock('pricing_table', {
      items: items.slice(placedCount),
      continued: true,
    }),
  };
};

const splitIncludedExcludedBlock = (payload, block, remainingHeight) => {
  const schema = getBlockSchema('included_excluded');
  const sourceIncludedItems = block.fragment.includedItems || [];
  const sourceExcludedItems = block.fragment.excludedItems || [];
  const baseHeight = 94;
  const rowHeight = 26;
  const maxLines = Math.floor((remainingHeight - baseHeight) / rowHeight);

  if (maxLines < 2) return null;

  const wholeGroupCandidates = [
    {
      includedItems: sourceIncludedItems,
      excludedItems: [],
    },
    {
      includedItems: [],
      excludedItems: sourceExcludedItems,
    },
  ];

  for (const candidate of wholeGroupCandidates) {
    if (candidate.includedItems.length === 0 && candidate.excludedItems.length === 0) continue;

    const placedBlock = createBlock('included_excluded', {
      includedItems: candidate.includedItems,
      excludedItems: candidate.excludedItems,
      continued: block.continued,
    });

    const candidateHeight = estimateBlockHeight(payload, placedBlock);
    if (candidateHeight > remainingHeight || candidateHeight < schema.minPresenceHeight) {
      continue;
    }

    const remainderIncludedItems = sourceIncludedItems.slice(candidate.includedItems.length);
    const remainderExcludedItems = sourceExcludedItems.slice(candidate.excludedItems.length);

    if (remainderIncludedItems.length === 0 && remainderExcludedItems.length === 0) {
      return null;
    }

    return {
      placedBlock,
      remainderBlock: createBlock('included_excluded', {
        includedItems: remainderIncludedItems,
        excludedItems: remainderExcludedItems,
        continued: true,
      }),
    };
  }

  const fitColumn = (items) => takeItemsByLineBudget(items, maxLines, 34).taken;
  let placedIncludedItems = fitColumn(sourceIncludedItems);
  let placedExcludedItems = fitColumn(sourceExcludedItems);

  const removeOneFromLongerColumn = () => {
    const includedLineUsage = estimateListLineUsage(placedIncludedItems, 34);
    const excludedLineUsage = estimateListLineUsage(placedExcludedItems, 34);

    if (placedIncludedItems.length === 0 && placedExcludedItems.length === 0) {
      return false;
    }

    if (includedLineUsage >= excludedLineUsage && placedIncludedItems.length > 0) {
      placedIncludedItems = placedIncludedItems.slice(0, -1);
      return true;
    }

    if (placedExcludedItems.length > 0) {
      placedExcludedItems = placedExcludedItems.slice(0, -1);
      return true;
    }

    if (placedIncludedItems.length > 0) {
      placedIncludedItems = placedIncludedItems.slice(0, -1);
      return true;
    }

    return false;
  };

  let placedBlock = createBlock('included_excluded', {
    includedItems: placedIncludedItems,
    excludedItems: placedExcludedItems,
    continued: block.continued,
  });

  while (
    (estimateBlockHeight(payload, placedBlock) > remainingHeight ||
      estimateBlockHeight(payload, placedBlock) < schema.minPresenceHeight) &&
    removeOneFromLongerColumn()
  ) {
    placedBlock = createBlock('included_excluded', {
      includedItems: placedIncludedItems,
      excludedItems: placedExcludedItems,
      continued: block.continued,
    });
  }

  if (estimateBlockHeight(payload, placedBlock) > remainingHeight) {
    return null;
  }

  const remainderIncludedItems = sourceIncludedItems.slice(placedIncludedItems.length);
  const remainderExcludedItems = sourceExcludedItems.slice(placedExcludedItems.length);

  if (remainderIncludedItems.length === 0 && remainderExcludedItems.length === 0) {
    return null;
  }

  if (
    placedIncludedItems.length === 0 &&
    placedExcludedItems.length === 0
  ) {
    return null;
  }

  return {
    placedBlock,
    remainderBlock: createBlock('included_excluded', {
      includedItems: remainderIncludedItems,
      excludedItems: remainderExcludedItems,
      continued: true,
    }),
  };
};

const splitBlockForRemainingHeight = (payload, block, remainingHeight) => {
  switch (block.key) {
    case 'pricing_table':
      return splitPricingBlock(payload, block, remainingHeight);
    case 'assumptions':
    case 'exclusions':
      return splitNarrativeBlock(block.key, payload, block, remainingHeight);
    case 'included_excluded':
      return splitIncludedExcludedBlock(payload, block, remainingHeight);
    default:
      return null;
  }
};

const buildQuoteBlocks = (payload) => {
  const hasMultiUnitContext = Boolean(payload.unit_reference || payload.batch_reference || payload.po_number);
  const showAssumptions = hasMultiUnitContext || estimateTextLines(payload.assumptions_text, 100) > 2;
  const showExclusions = hasMultiUnitContext || estimateTextLines(payload.exclusions_text, 100) > 2;

  const flowBlocks = [
    createBlock('client_property'),
    createBlock('scope_snapshot', {
      text: payload.scope_snapshot_text,
      helperText: payload.header_text,
    }),
    createBlock('pricing_table', {
      items: payload.line_items,
      continued: false,
    }),
  ];

  if (hasMultiUnitContext) {
    flowBlocks.push(createBlock('service_notes'));
  }

  if (showAssumptions) {
    flowBlocks.push(
      createBlock('assumptions', {
        text: payload.assumptions_text,
        sentences: splitIntoSentences(payload.assumptions_text),
        continued: false,
      })
    );
  }

  if (showExclusions) {
    flowBlocks.push(
      createBlock('exclusions', {
        text: payload.exclusions_text,
        sentences: splitIntoSentences(payload.exclusions_text),
        continued: false,
      })
    );
  }

  flowBlocks.push(
    createBlock('included_excluded', {
      includedItems: payload.included_items,
      excludedItems: payload.excluded_items,
      continued: false,
    }),
    createBlock('validity_window')
  );

  const reservedFinalBlocks = [
    createBlock('totals'),
    createBlock('payment_terms'),
    createBlock('approval'),
    createBlock('dispute_protection'),
  ];

  return {
    flowBlocks,
    reservedFinalBlocks,
  };
};

const createPage = (master) => {
  const geometry = getMasterGeometry(master);

  return {
    master,
    geometry,
    blocks: [],
    footerLocked: true,
    usedHeightPx: 0,
    remainingHeightPx: geometry.bodyHeightPx,
    overflow: false,
    layoutDebug: {
      bodyHeightPx: geometry.bodyHeightPx,
      blockHeights: [],
    },
  };
};

const canBlockRenderOnPage = (block, page, { allowFirstAsFinal = false } = {}) => {
  const schema = getBlockSchema(block.key);
  if (!schema) return false;
  if (schema.pageEligibility.includes(page.master)) return true;
  return allowFirstAsFinal && page.master === 'first' && schema.pageEligibility.includes('final');
};

const appendBlockToPage = (payload, page, block) => {
  const schema = getBlockSchema(block.key);
  const gapPx = page.blocks.length > 0 ? BLOCK_VERTICAL_GAP_PX : 0;
  const contentHeightPx = estimateBlockHeight(payload, block);
  const usedHeightPx = gapPx + contentHeightPx;

  page.blocks.push({
    ...block,
    type: schema.type,
    atomic: schema.atomic,
    splittable: schema.splittable,
    keepWithNext: schema.keepWithNext,
    reservedFinal: Boolean(schema.reservedFinal),
    pageEligibility: schema.pageEligibility,
    minPresenceHeight: schema.minPresenceHeight,
    maxHeight: schema.maxHeight,
    estimatedHeightPx: contentHeightPx,
  });

  page.usedHeightPx += usedHeightPx;
  page.remainingHeightPx = Math.max(0, page.geometry.bodyHeightPx - page.usedHeightPx);
  page.layoutDebug.blockHeights.push({
    key: block.key,
    continued: Boolean(block.continued),
    usedHeightPx,
    contentHeightPx,
    remainingAfterPx: page.remainingHeightPx,
  });

  if (page.usedHeightPx > page.geometry.bodyHeightPx) {
    page.overflow = true;
  }

  return page;
};

const finalizePage = (page) => {
  const sectionEntries = page.blocks.map((block) => ({
    key: block.key,
    continued: Boolean(block.continued),
  }));

  return {
    ...page,
    fillRatio: Number((page.usedHeightPx / page.geometry.bodyHeightPx).toFixed(2)),
    majorSections: Math.min(
      2,
      page.blocks.filter((block) => SECTION_DEFINITIONS[block.key]?.major).length
    ),
    denseTables: Math.min(
      1,
      page.blocks.filter((block) => SECTION_DEFINITIONS[block.key]?.denseTable).length
    ),
    sections: sectionEntries,
    layoutDebug: {
      ...page.layoutDebug,
      usedHeightPx: page.usedHeightPx,
      remainingHeightPx: page.remainingHeightPx,
      overflow: page.overflow,
    },
  };
};

const estimateClusterHeight = (payload, page, blocks) =>
  blocks.reduce((sum, block, index) => {
    const gapPx = page.blocks.length > 0 || index > 0 ? BLOCK_VERTICAL_GAP_PX : 0;
    return sum + gapPx + estimateBlockHeight(payload, block);
  }, 0);

const estimateReservedFinalBudget = (payload, reservedFinalBlocks) =>
  estimateClusterHeight(payload, createPage('final'), reservedFinalBlocks) + SAFE_FINAL_BUFFER_PX;

const tryPlaceBlockOnPage = (payload, page, block, options = {}) => {
  const nextBlock = options.nextBlock || null;
  const reservedAfterPx = Math.max(0, options.reservedAfterPx || 0);
  const gapPx = page.blocks.length > 0 ? BLOCK_VERTICAL_GAP_PX : 0;
  const wholeHeightPx = gapPx + estimateBlockHeight(payload, block);
  const schema = getBlockSchema(block.key);
  const nextSchema = nextBlock ? getBlockSchema(nextBlock.key) : null;
  const nextGapPx = nextBlock ? BLOCK_VERTICAL_GAP_PX : 0;
  const nextPresenceHeightPx =
    nextBlock && nextSchema && canBlockRenderOnPage(nextBlock, page, options)
      ? nextSchema.minPresenceHeight + nextGapPx
      : 0;
  const safetyBufferPx = page.blocks.length > 0 ? (page.master === 'final' ? SAFE_FINAL_BUFFER_PX : SAFE_FLOW_BUFFER_PX) : 0;
  const requiredRemainingAfterPx = Math.max(safetyBufferPx, reservedAfterPx);

  if (
    wholeHeightPx <= page.remainingHeightPx &&
    canBlockRenderOnPage(block, page, options) &&
    wholeHeightPx + nextPresenceHeightPx + requiredRemainingAfterPx <= page.remainingHeightPx &&
    (!schema?.keepWithNext || wholeHeightPx + nextPresenceHeightPx + requiredRemainingAfterPx <= page.remainingHeightPx)
  ) {
    return {
      placedBlock: block,
    };
  }

  if (!schema?.splittable || !canBlockRenderOnPage(block, page, options)) {
    return null;
  }

  const splitResult = splitBlockForRemainingHeight(
    payload,
    block,
    page.remainingHeightPx - gapPx - requiredRemainingAfterPx
  );
  if (!splitResult) return null;

  return splitResult;
};

const placeFlowBlocks = (payload, pages, flowBlocks, reservedFinalBlocks) => {
  let currentPage = createPage('first');
  pages.push(currentPage);

  for (let sourceIndex = 0; sourceIndex < flowBlocks.length; sourceIndex += 1) {
    const sourceBlock = flowBlocks[sourceIndex];
    const nextFlowBlock = flowBlocks[sourceIndex + 1] || null;
    const isLastFlowBlock = sourceIndex === flowBlocks.length - 1;
    let block = sourceBlock;
    let placed = false;

    while (block) {
      const placement = tryPlaceBlockOnPage(payload, currentPage, block, {
        nextBlock: nextFlowBlock,
        reservedAfterPx: isLastFlowBlock ? estimateReservedFinalBudget(payload, reservedFinalBlocks) : 0,
      });
      if (placement?.placedBlock) {
        appendBlockToPage(payload, currentPage, placement.placedBlock);
        placed = true;

        if (placement.remainderBlock) {
          block = placement.remainderBlock;
          currentPage = createPage('interior');
          pages.push(currentPage);
        } else {
          block = null;
        }
        continue;
      }

      if (currentPage.blocks.length === 0) {
        appendBlockToPage(payload, currentPage, block);
        block = null;
        placed = true;
        continue;
      }

      currentPage = createPage('interior');
      pages.push(currentPage);
    }

    if (!placed && currentPage.blocks.length === 0) {
      appendBlockToPage(payload, currentPage, sourceBlock);
    }
  }

  return currentPage;
};

const canReusePageAsFinal = (payload, page, reservedFinalBlocks) => {
  if (!page) return false;

  const allowFirstAsFinal = page.master === 'first';
  const pageBlocksEligible = page.blocks.every((block) =>
    canBlockRenderOnPage(block, page.master === 'first' ? page : { ...page, master: 'final' }, {
      allowFirstAsFinal,
    })
  );

  if (!pageBlocksEligible) return false;

  return estimateClusterHeight(payload, page, reservedFinalBlocks) + SAFE_FINAL_BUFFER_PX <= page.remainingHeightPx;
};

const placeReservedFinalBlocks = (payload, pages, currentPage, reservedFinalBlocks) => {
  let page = currentPage;
  let allowFirstAsFinal = page?.master === 'first' && pages.length === 1;

  if (!canReusePageAsFinal(payload, page, reservedFinalBlocks)) {
    page = createPage('final');
    pages.push(page);
    allowFirstAsFinal = false;
  } else if (page.master !== 'first') {
    page.master = 'final';
    page.geometry = getMasterGeometry('final');
  }

  for (let index = 0; index < reservedFinalBlocks.length; index += 1) {
    const block = reservedFinalBlocks[index];
    const remainingCluster = reservedFinalBlocks.slice(index);
    const clusterHeightPx = estimateClusterHeight(payload, page, remainingCluster) + SAFE_FINAL_BUFFER_PX;

    if (page.blocks.length > 0 && clusterHeightPx > page.remainingHeightPx) {
      page = createPage('final');
      pages.push(page);
      allowFirstAsFinal = false;
    }

    if (!canBlockRenderOnPage(block, page, { allowFirstAsFinal })) {
      page = createPage('final');
      pages.push(page);
      allowFirstAsFinal = false;
    }

    const placement = tryPlaceBlockOnPage(payload, page, block, { allowFirstAsFinal });
    if (placement?.placedBlock) {
      appendBlockToPage(payload, page, placement.placedBlock);
      continue;
    }

    if (page.blocks.length > 0) {
      page = createPage('final');
      pages.push(page);
      allowFirstAsFinal = false;
    }

    appendBlockToPage(payload, page, block);
  }
};

const buildPagePlan = (payload) => {
  const { flowBlocks, reservedFinalBlocks } = buildQuoteBlocks(payload);
  const pages = [];
  const currentPage = placeFlowBlocks(payload, pages, flowBlocks, reservedFinalBlocks);
  placeReservedFinalBlocks(payload, pages, currentPage, reservedFinalBlocks);

  return {
    version: QUOTE_LAYOUT_VERSION,
    geometry: QUOTE_PAGE_GEOMETRY,
    pages: pages.map(finalizePage),
  };
};

export const buildQuoteDocumentModel = (quote, items) => {
  const normalizedItems = normalizeQuoteItems(items);
  const payload = buildPayload(quote, normalizedItems);
  const pagePlan = buildPagePlan(payload);
  const validation = validateDocumentPayload('quote', payload, { pagePlan });
  const lead = quote?.leads || {};

  return {
    payload,
    pagePlan,
    validation,
    priceSummary: {
      subtotal: payload.subtotal,
      taxAmount: payload.tax_amount,
      total: payload.total_amount,
      subtotalLabel: 'Subtotal',
      taxLabel: 'Tax',
      totalLabel: 'Total Investment',
    },
    display: {
      documentTypeLabel: 'Quote',
      statusLabel: getQuoteStatusLabel(payload.status),
      statusTone: getStatusTone(payload.status),
      validThroughLabel: formatDate(payload.valid_through) || 'Upon receipt',
      issueDateLabel: formatDate(payload.issue_date) || formatDate(new Date().toISOString()),
      acceptedAtLabel: formatDate(quote?.accepted_at),
      customerName: payload.customer_name,
      customerEmail: payload.customer_email,
      customerPhone: payload.customer_phone,
      serviceAddress: payload.service_address,
      propertyName: payload.property_name,
      leadName: getLeadFullName(lead),
      tvgContactName: payload.tvg_contact_name,
      tvgContactTitle: payload.tvg_contact_title,
      tvgContactEmail: payload.tvg_contact_email,
      tvgContactPhone: payload.tvg_contact_phone,
      tvgContactWebsite: payload.tvg_contact_website,
      headerText: payload.header_text,
      footerText: payload.footer_text,
    },
    formatCurrency,
    formatDate,
  };
};
