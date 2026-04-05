import { REQUIRED_PROTECTION_LINES } from './config.js';

const buildLineItem = (description, quantity, unitPrice) => ({
  description,
  quantity,
  unit_price: unitPrice,
  total_price: Number((quantity * unitPrice).toFixed(2)),
});

const withTotals = (payload, overrides = {}) => {
  const subtotal = Number(
    (payload.line_items || []).reduce((sum, item) => sum + Number(item.total_price || 0), 0).toFixed(2)
  );
  const discountAmount = Number(overrides.discount_amount ?? payload.discount_amount ?? 0);
  const feesAmount = Number(overrides.fees_amount ?? payload.fees_amount ?? 0);
  const taxRate = Number(overrides.tax_rate ?? payload.tax_rate ?? 0);
  const taxAmount = Number(overrides.tax_amount ?? payload.tax_amount ?? Number((subtotal * taxRate).toFixed(2)));
  const totalAmount = Number((subtotal - discountAmount + feesAmount + taxAmount).toFixed(2));

  return {
    ...payload,
    ...overrides,
    subtotal,
    discount_amount: discountAmount,
    fees_amount: feesAmount,
    tax_rate: taxRate,
    tax_amount: taxAmount,
    total_amount: totalAmount,
  };
};

const baseQuote = {
  document_type: 'quote',
  tenant_id: 'tvg',
  status: 'sent',
  issue_date: '2026-03-29',
  valid_through: '2026-04-05',
  service_summary: 'Dryer vent cleaning and airflow restoration',
  scope_snapshot_text:
    'Clean the full dryer exhaust path from appliance connection to exterior termination, remove lint obstruction, and verify restored airflow.',
  included_items: [
    'Full dryer vent path cleaning',
    'Exterior termination cleaning',
    'Airflow verification',
  ],
  excluded_items: [
    'Dryer repair or replacement',
    'Roof or drywall repair',
  ],
  assumptions_text:
    'Dryer and vent path are accessible without drywall removal, specialty lift equipment, or resident relocation.',
  exclusions_text:
    'Hidden damage, code upgrades, replacement parts, and access restrictions outside the approved scope require a formal change order.',
  dispute_protection_line: REQUIRED_PROTECTION_LINES.dispute,
  service_verification_text: REQUIRED_PROTECTION_LINES.serviceVerification,
  approval_required: true,
  approval_method: 'digital_signature',
  approved_version: 'v1',
  payment_terms: 'Approve to schedule service. Final payment due upon completion unless otherwise stated.',
  payment_instructions: 'Approval locks scope and schedules service. Invoice will be issued after work is completed.',
  document_version: 'v1',
  source_snapshot_id: 'snap-fixture-v1',
  template_version: 'quote-letter-v1',
  render_profile: 'quote-letter-v1',
  generated_by: 'fixture',
  release_checked_by: 'fixture',
  document_freeze_at: '2026-03-29T09:00:00.000Z',
  snapshot_hash: 'fixture-snapshot-hash',
  snapshot_storage_mode: 'both',
  customer_name: 'Olivia Parker',
  customer_email: 'olivia.parker@example.com',
  customer_phone: '(321) 555-0110',
  company_name: 'Parker Household',
  property_name: 'Harbor Ridge Apartments',
  service_address: '123 Seabreeze Court, Melbourne, FL 32940',
  release_audit: {
    page_count_stable: true,
    null_render_clean: true,
  },
};

const quoteFixtures = [
  {
    id: 'quote-one-page-residential',
    name: 'One-page residential quote',
    payload: withTotals({
      ...baseQuote,
      document_id: 'quote-fixture-001',
      document_number: 'Q-2026-0101',
      quote_number: 'Q-2026-0101',
      job_id: 'JOB-2026-0101',
      related_estimate_id: 'EST-2026-0041',
      property_name: 'Parker Residence',
      company_name: '',
      service_address: '123 Seabreeze Court, Melbourne, FL 32940',
      line_items: [
        buildLineItem('Dryer vent cleaning', 1, 225),
        buildLineItem('Exterior termination cleanup', 1, 45),
      ],
    }),
    pagePlan: {
      pages: [
        {
          master: 'first',
          footerLocked: true,
          fillRatio: 0.82,
          majorSections: 2,
          denseTables: 1,
          sections: [
            'scan_first',
            'client_property',
            'scope_snapshot',
            'pricing_table',
            'included_excluded',
            'validity_window',
            'totals',
            'payment_terms',
            'approval',
            'dispute_protection',
          ],
        },
      ],
    },
  },
  {
    id: 'quote-two-page-residential',
    name: 'Two-page residential quote',
    payload: withTotals({
      ...baseQuote,
      document_id: 'quote-fixture-002',
      document_number: 'Q-2026-0102',
      quote_number: 'Q-2026-0102',
      job_id: 'JOB-2026-0102',
      related_estimate_id: 'EST-2026-0042',
      property_name: 'Ortega Residence',
      customer_name: 'David Ortega',
      customer_email: 'david.ortega@example.com',
      service_address: '4401 Pine Valley Drive, Palm Bay, FL 32909',
      line_items: [
        buildLineItem('Dryer vent cleaning', 1, 225),
        buildLineItem('Bird guard installation', 1, 95),
        buildLineItem('Transition hose replacement', 1, 42),
      ],
    }),
    pagePlan: {
      pages: [
        {
          master: 'first',
          footerLocked: true,
          fillRatio: 0.72,
          majorSections: 2,
          denseTables: 1,
          sections: [
            'scan_first',
            'client_property',
            'scope_snapshot',
            'pricing_table',
          ],
        },
        {
          master: 'final',
          footerLocked: true,
          fillRatio: 0.7,
          majorSections: 2,
          denseTables: 0,
          sections: [
            'included_excluded',
            'validity_window',
            'totals',
            'payment_terms',
            'approval',
            'dispute_protection',
          ],
        },
      ],
    },
  },
  {
    id: 'quote-multi-unit-po',
    name: 'Multi-unit property-manager quote with PO',
    payload: withTotals({
      ...baseQuote,
      document_id: 'quote-fixture-003',
      document_number: 'Q-2026-0103',
      quote_number: 'Q-2026-0103',
      job_id: 'JOB-2026-0103',
      related_estimate_id: 'EST-2026-0043',
      customer_name: 'Ana Valle',
      customer_email: 'ana.valle@example.com',
      company_name: 'Coastal Property Group',
      property_name: 'Harbor Ridge Apartments',
      building_name: 'Building C',
      unit_reference: 'Units 201-212',
      batch_reference: 'Turn Batch 02',
      po_required: true,
      po_number: 'PO-44789',
      accounting_contact: 'ap@coastalproperty.example.com',
      payment_terms: 'Net 15 from invoice date. Approved quote locks scope and pricing for the listed units.',
      service_summary: 'Apartment turn dryer vent program for 12 vacant units',
      line_items: [
        buildLineItem('Dryer vent cleaning - units 201-206', 6, 110),
        buildLineItem('Dryer vent cleaning - units 207-212', 6, 110),
        buildLineItem('Roof termination cleanup', 2, 75),
      ],
    }),
    pagePlan: {
      pages: [
        {
          master: 'first',
          footerLocked: true,
          fillRatio: 0.68,
          majorSections: 2,
          denseTables: 1,
          sections: [
            'scan_first',
            'client_property',
            'scope_snapshot',
            'pricing_table',
          ],
        },
        {
          master: 'interior',
          footerLocked: true,
          fillRatio: 0.74,
          majorSections: 2,
          denseTables: 1,
          sections: [
            'unit_schedule',
            'assumptions',
            'exclusions',
          ],
        },
        {
          master: 'final',
          footerLocked: true,
          fillRatio: 0.73,
          majorSections: 2,
          denseTables: 0,
          sections: [
            'included_excluded',
            'validity_window',
            'totals',
            'payment_terms',
            'approval',
            'dispute_protection',
          ],
        },
      ],
    },
  },
  {
    id: 'quote-long-exclusions',
    name: 'Quote with long exclusions',
    payload: withTotals({
      ...baseQuote,
      document_id: 'quote-fixture-004',
      document_number: 'Q-2026-0104',
      quote_number: 'Q-2026-0104',
      job_id: 'JOB-2026-0104',
      related_estimate_id: 'EST-2026-0044',
      customer_name: 'Mila Henderson',
      customer_email: 'mila.henderson@example.com',
      property_name: 'Henderson Residence',
      service_address: '18 Sandpiper Lane, Cocoa Beach, FL 32931',
      exclusions_text:
        'Hidden construction defects, inaccessible chases, code upgrades, asbestos concerns, roof membrane penetrations, replacement parts, masonry repair, siding repair, drywall repair, after-hours access, resident-caused delays, weather impacts, and any condition discovered after approval that materially changes labor or access requirements require a formal change order.',
      line_items: [
        buildLineItem('Dryer vent cleaning', 1, 225),
        buildLineItem('Booster fan inspection', 1, 65),
        buildLineItem('Exterior cap replacement allowance', 1, 85),
      ],
    }),
    pagePlan: {
      pages: [
        {
          master: 'first',
          footerLocked: true,
          fillRatio: 0.65,
          majorSections: 2,
          denseTables: 1,
          sections: [
            'scan_first',
            'client_property',
            'scope_snapshot',
            'pricing_table',
          ],
        },
        {
          master: 'interior',
          footerLocked: true,
          fillRatio: 0.77,
          majorSections: 2,
          denseTables: 0,
          sections: [
            'assumptions',
            'exclusions',
            'service_notes',
          ],
        },
        {
          master: 'final',
          footerLocked: true,
          fillRatio: 0.69,
          majorSections: 2,
          denseTables: 0,
          sections: [
            'included_excluded',
            'validity_window',
            'totals',
            'payment_terms',
            'approval',
            'dispute_protection',
          ],
        },
      ],
    },
  },
  {
    id: 'quote-continued-pricing-table',
    name: 'Quote with continued pricing table',
    payload: withTotals({
      ...baseQuote,
      document_id: 'quote-fixture-005',
      document_number: 'Q-2026-0105',
      quote_number: 'Q-2026-0105',
      job_id: 'JOB-2026-0105',
      related_estimate_id: 'EST-2026-0045',
      customer_name: 'Westport Communities',
      customer_email: 'operations@westport.example.com',
      company_name: 'Westport Communities',
      property_name: 'Westport Villas',
      service_address: '7800 Legacy Parkway, Titusville, FL 32780',
      unit_reference: 'Units 101-124',
      batch_reference: 'Dryer Turn Batch 07',
      po_required: true,
      po_number: 'PO-55219',
      line_items: [
        buildLineItem('Unit 101-106 dryer vent cleaning', 6, 110),
        buildLineItem('Unit 107-112 dryer vent cleaning', 6, 110),
        buildLineItem('Unit 113-118 dryer vent cleaning', 6, 110),
        buildLineItem('Unit 119-124 dryer vent cleaning', 6, 110),
        buildLineItem('Exterior cap reset allowance', 4, 42),
      ],
    }),
    pagePlan: {
      pages: [
        {
          master: 'first',
          footerLocked: true,
          fillRatio: 0.79,
          majorSections: 2,
          denseTables: 1,
          sections: [
            'scan_first',
            'client_property',
            'scope_snapshot',
            'pricing_table',
          ],
        },
        {
          master: 'interior',
          footerLocked: true,
          fillRatio: 0.76,
          majorSections: 2,
          denseTables: 1,
          sections: [
            { key: 'pricing_table', continued: true },
            'unit_schedule',
          ],
        },
        {
          master: 'final',
          footerLocked: true,
          fillRatio: 0.71,
          majorSections: 2,
          denseTables: 0,
          sections: [
            'included_excluded',
            'validity_window',
            'totals',
            'payment_terms',
            'approval',
            'dispute_protection',
          ],
        },
      ],
    },
  },
  {
    id: 'quote-final-page-approval',
    name: 'Quote that forces final-page approval',
    payload: withTotals({
      ...baseQuote,
      document_id: 'quote-fixture-006',
      document_number: 'Q-2026-0106',
      quote_number: 'Q-2026-0106',
      job_id: 'JOB-2026-0106',
      related_estimate_id: 'EST-2026-0046',
      customer_name: 'Bayside Portfolio Services',
      customer_email: 'maintenance@bayside.example.com',
      company_name: 'Bayside Portfolio Services',
      property_name: 'Bayside Commons',
      service_address: '1414 Riverside Drive, Rockledge, FL 32955',
      payment_terms: 'Net 15 from invoice date. Approval today holds the quoted unit pricing for the current turn batch.',
      line_items: [
        buildLineItem('Dryer vent cleaning - building A', 8, 112),
        buildLineItem('Dryer vent cleaning - building B', 8, 112),
        buildLineItem('Common termination cleaning', 4, 75),
      ],
    }),
    pagePlan: {
      pages: [
        {
          master: 'first',
          footerLocked: true,
          fillRatio: 0.68,
          majorSections: 2,
          denseTables: 1,
          sections: [
            'scan_first',
            'client_property',
            'scope_snapshot',
            'pricing_table',
          ],
        },
        {
          master: 'interior',
          footerLocked: true,
          fillRatio: 0.75,
          majorSections: 2,
          denseTables: 0,
          sections: [
            'included_excluded',
            'assumptions',
            'exclusions',
          ],
        },
        {
          master: 'final',
          footerLocked: true,
          fillRatio: 0.67,
          majorSections: 2,
          denseTables: 0,
          sections: [
            'validity_window',
            'totals',
            'payment_terms',
            'approval',
            'dispute_protection',
          ],
        },
      ],
    },
  },
];

export const QUOTE_FIXTURES = quoteFixtures;

export const getQuoteFixtureById = (fixtureId) =>
  QUOTE_FIXTURES.find((fixture) => fixture.id === fixtureId) || null;
