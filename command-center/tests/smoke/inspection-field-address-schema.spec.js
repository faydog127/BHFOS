/* eslint-disable testing-library/prefer-screen-queries, jest/valid-title */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';
import {
  LEAD_FIELD_SELECT,
  composeAddressFromParts,
  formatPropertyAddress,
  resolveServiceAddress,
} from '../../src/lib/inspectionFieldAddress.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '../..');

const readSource = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), 'utf8');

const TECH_SOURCES = [
  'src/components/tech/InspectionFieldCustomerStep.jsx',
  'src/pages/tech/TechInspectionSession.jsx',
  'src/pages/tech/TechInspectionReview.jsx',
  'src/lib/inspectionFieldAddress.js',
];

const leadSelectTopLevelColumns = (select) => {
  // Strip nested property embeds so we only inspect top-level lead columns.
  const withoutPropertyEmbed = String(select).replace(/property:property_id\([^)]*\)/g, '');
  return withoutPropertyEmbed;
};

test('technician sources never select or write invalid lead address columns', async () => {
  for (const relativePath of TECH_SOURCES) {
    const source = readSource(relativePath);
    const leadTopLevel = leadSelectTopLevelColumns(source);
    expect(leadTopLevel, relativePath).not.toMatch(/leads\([^)]*\baddress1\b/);
    expect(leadTopLevel, relativePath).not.toMatch(/leads\([^)]*\baddress2\b/);
    if (relativePath.includes('TechInspection') || relativePath.includes('InspectionFieldCustomer')) {
      expect(source).toContain('LEAD_FIELD_SELECT');
    }
  }

  const customerStep = readSource('src/components/tech/InspectionFieldCustomerStep.jsx');
  // Lead patch must write freeform address only (plus property_id), never structured lead cols.
  const leadPatchBlock = customerStep.match(/const leadPatch = \{[\s\S]*?\n\s*\};/);
  expect(leadPatchBlock?.[0] || '').toMatch(/address:\s*serviceAddress/);
  expect(leadPatchBlock?.[0] || '').not.toMatch(/\baddress1\s*:/);
  expect(leadPatchBlock?.[0] || '').not.toMatch(/\bcity\s*:/);
  expect(customerStep).toContain("from('properties')");
  expect(customerStep).toContain('appointmentService.createCustomer');

  const topLevel = leadSelectTopLevelColumns(LEAD_FIELD_SELECT);
  expect(LEAD_FIELD_SELECT).toMatch(/(^|,)\s*address\s*(,|$)/);
  expect(LEAD_FIELD_SELECT).toContain('property:property_id');
  expect(LEAD_FIELD_SELECT).toMatch(/property:property_id\([^)]*address1/);
  expect(topLevel).not.toMatch(/\baddress1\b/);
  expect(topLevel).not.toMatch(/\bcity\b/);
  expect(topLevel).not.toMatch(/\bstate\b/);
  expect(topLevel).not.toMatch(/\bzip\b/);
});

test('resolveServiceAddress priority: property → inspection/job → leads.address', async () => {
  const property = {
    address1: '200 Property Ave',
    address2: 'Unit 2',
    city: 'Titusville',
    state: 'FL',
    zip: '32780',
  };
  expect(
    resolveServiceAddress({
      property,
      inspectionServiceAddress: '999 Inspection St',
      jobServiceAddress: '888 Job Rd',
      lead: { address: '777 Lead Lane' },
    }),
  ).toBe(formatPropertyAddress(property));

  expect(
    resolveServiceAddress({
      property: null,
      inspectionServiceAddress: '999 Inspection St',
      jobServiceAddress: '888 Job Rd',
      lead: { address: '777 Lead Lane' },
    }),
  ).toBe('999 Inspection St');

  expect(
    resolveServiceAddress({
      property: null,
      inspectionServiceAddress: '',
      jobServiceAddress: '888 Job Rd',
      lead: { address: '777 Lead Lane' },
    }),
  ).toBe('888 Job Rd');

  expect(
    resolveServiceAddress({
      property: null,
      inspectionServiceAddress: '',
      jobServiceAddress: '',
      lead: { address: '777 Lead Lane' },
    }),
  ).toBe('777 Lead Lane');

  expect(
    resolveServiceAddress({
      property: null,
      inspectionServiceAddress: '',
      jobServiceAddress: '',
      lead: { address: '' },
    }),
  ).toBe('');
});

test('existing lead with leads.address loads without structured lead columns', async () => {
  const lead = { id: 'lead-1', address: '101 Test Airflow Lane, Titusville, FL 32780', property: null };
  const resolved = resolveServiceAddress({ lead });
  expect(resolved).toContain('101 Test Airflow Lane');
  expect(lead).not.toHaveProperty('address1');
});

test('linked property structured address takes precedence over leads.address', async () => {
  const lead = {
    address: 'FALLBACK LEAD ADDRESS ONLY',
    property: {
      address1: '201 Secondary Property Rd',
      city: 'Titusville',
      state: 'FL',
      zip: '32780',
    },
  };
  expect(resolveServiceAddress({ lead })).toMatch(/201 Secondary Property Rd/);
  expect(resolveServiceAddress({ lead })).not.toMatch(/FALLBACK LEAD ADDRESS ONLY/);
});

test('composeAddressFromParts builds freeform text from form input without parsing leads.address', async () => {
  const composed = composeAddressFromParts({
    address1: '55 Brand New Lead Way',
    address2: '',
    city: 'Titusville',
    state: 'FL',
    zip: '32780',
  });
  expect(composed).toBe('55 Brand New Lead Way, Titusville FL 32780');
});

test('new-lead production payload uses createCustomer fields only on leads insert', async () => {
  const appointmentSource = readSource('src/services/appointmentService.js');
  expect(appointmentSource).toMatch(/async createCustomer/);
  expect(appointmentSource).toMatch(/from\('leads'\)\.insert\(insertPayload\)/);
  expect(appointmentSource).not.toMatch(/insertPayload[\s\S]{0,200}address1/);

  const customerStep = readSource('src/components/tech/InspectionFieldCustomerStep.jsx');
  expect(customerStep).toMatch(/source:\s*'field_inspection'/);
  expect(customerStep).toMatch(/linkSelection\(/);
  expect(customerStep).toMatch(/onContinue\?\.\(\)/);
});
