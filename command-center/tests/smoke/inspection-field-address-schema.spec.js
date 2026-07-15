/* eslint-disable testing-library/prefer-screen-queries, jest/valid-title */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';
import {
  LEAD_FIELD_SELECT,
  PROPERTY_FIELD_SELECT,
  composeAddressFromParts,
  formatPropertyAddress,
  hydrateLeadsWithProperties,
  normalizeLeadRecord,
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

test('technician sources never select nested lead/property PostgREST embeds', async () => {
  for (const relativePath of TECH_SOURCES) {
    const source = readSource(relativePath);
    expect(source, relativePath).not.toMatch(/property\s*:\s*property_id\s*\(/);
    expect(source, relativePath).not.toMatch(/leads\([^)]*\baddress1\b/);
    if (relativePath.includes('TechInspection') || relativePath.includes('InspectionFieldCustomer')) {
      expect(source).toContain('LEAD_FIELD_SELECT');
      expect(source).toContain('hydrateLeadsWithProperties');
    }
  }

  expect(LEAD_FIELD_SELECT).toMatch(/(^|,)\s*address\s*(,|$)/);
  expect(LEAD_FIELD_SELECT).toContain('property_id');
  expect(LEAD_FIELD_SELECT).toContain('property_formatted_address');
  expect(LEAD_FIELD_SELECT).not.toMatch(/property\s*:\s*property_id/);
  expect(PROPERTY_FIELD_SELECT).toContain('address_line_1');
  expect(PROPERTY_FIELD_SELECT).not.toMatch(/\baddress1\b/);
});

test('hydrate skips UUID property_id and never queries incompatible properties ids', async () => {
  const client = {
    from() {
      throw new Error('properties query must not run for UUID property_id values');
    },
  };

  const lead = await hydrateLeadsWithProperties(client, 'tvg', {
    id: 'lead-uuid',
    property_id: '13662027-a547-46b6-ada6-f89f4fe0ec09',
    address: 'FALLBACK LEAD ADDRESS ONLY',
    property_formatted_address: '201 Secondary Property Rd, Titusville, FL 32780',
  });

  expect(normalizeLeadRecord(lead).property).toBeNull();
  expect(resolveServiceAddress({ lead })).toMatch(/201 Secondary Property Rd/);
  expect(resolveServiceAddress({ lead })).not.toMatch(/FALLBACK LEAD ADDRESS ONLY/);
});

test('hydrate loads numeric property ids via separate query and swallows lookup errors', async () => {
  const calls = [];
  const client = {
    from(table) {
      calls.push(table);
      return {
        select(columns) {
          calls.push(columns);
          return {
            in(column, ids) {
              calls.push({ column, ids });
              return Promise.resolve({
                data: [
                  {
                    id: 42,
                    address_line_1: '42 Numeric Property Way',
                    city: 'Titusville',
                    state: 'FL',
                    zip: '32780',
                  },
                ],
                error: null,
              });
            },
          };
        },
      };
    },
  };

  const withProperty = await hydrateLeadsWithProperties(client, 'tvg', [
    { id: 'lead-1', property_id: 42, address: 'FALLBACK' },
    { id: 'lead-2', property_id: null, address: '101 Lead Only Lane' },
  ]);

  expect(calls[0]).toBe('properties');
  expect(calls[1]).toBe(PROPERTY_FIELD_SELECT);
  expect(formatPropertyAddress(withProperty[0].property)).toMatch(/42 Numeric Property Way/);
  expect(resolveServiceAddress({ lead: withProperty[0] })).toMatch(/42 Numeric Property Way/);
  expect(withProperty[1].property).toBeNull();
  expect(resolveServiceAddress({ lead: withProperty[1] })).toBe('101 Lead Only Lane');

  const failingClient = {
    from() {
      return {
        select() {
          return {
            in() {
              return Promise.resolve({ data: null, error: { message: 'boom' } });
            },
          };
        },
      };
    },
  };
  const resilient = await hydrateLeadsWithProperties(failingClient, 'tvg', {
    id: 'lead-3',
    property_id: '99',
    address: '101 Lead Only Lane',
  });
  expect(resilient.property).toBeNull();
  expect(resolveServiceAddress({ lead: resilient })).toBe('101 Lead Only Lane');
});

test('lead without property_id still loads and uses leads.address', async () => {
  const client = {
    from() {
      throw new Error('properties query should not run when no property_id values exist');
    },
  };
  const lead = await hydrateLeadsWithProperties(client, 'tvg', {
    id: 'lead-3',
    property_id: null,
    address: '101 Test Airflow Lane, Titusville, FL 32780',
  });
  expect(normalizeLeadRecord(lead).property).toBeNull();
  expect(resolveServiceAddress({ lead })).toContain('101 Test Airflow Lane');
});

test('resolveServiceAddress priority: property → formatted → inspection/job → leads.address', async () => {
  const property = {
    address_line_1: '200 Property Ave',
    city: 'Titusville',
    state: 'FL',
    zip: '32780',
  };
  expect(
    resolveServiceAddress({
      property,
      inspectionServiceAddress: '999 Inspection St',
      jobServiceAddress: '888 Job Rd',
      lead: { address: '777 Lead Lane', property_formatted_address: 'Formatted Property' },
    }),
  ).toBe(formatPropertyAddress(property));

  expect(
    resolveServiceAddress({
      property: null,
      inspectionServiceAddress: '999 Inspection St',
      jobServiceAddress: '888 Job Rd',
      lead: { address: '777 Lead Lane', property_formatted_address: 'Formatted Property' },
    }),
  ).toBe('Formatted Property');

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

test('new-lead flow persists freeform lead address and does not write invalid properties.address1', async () => {
  const customerStep = readSource('src/components/tech/InspectionFieldCustomerStep.jsx');
  const leadPatchBlock = customerStep.match(/const leadPatch = \{[\s\S]*?\n\s*\};/);
  expect(leadPatchBlock?.[0] || '').toMatch(/address:\s*serviceAddress/);
  expect(leadPatchBlock?.[0] || '').not.toMatch(/\baddress1\s*:/);
  expect(customerStep).not.toMatch(/\.insert\(\{[\s\S]*address1:/);
  expect(customerStep).toContain('appointmentService.createCustomer');
  expect(customerStep).toMatch(/source:\s*'field_inspection'/);
});
