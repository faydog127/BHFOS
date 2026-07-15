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

test('technician sources never select or write invalid lead address columns', async () => {
  for (const relativePath of TECH_SOURCES) {
    const source = readSource(relativePath);
    // Nested PostgREST embed syntax — not comments that merely mention the pattern.
    expect(source, relativePath).not.toMatch(/property\s*:\s*property_id\s*\(/);
    expect(source, relativePath).not.toMatch(/leads\([^)]*\baddress1\b/);
    expect(source, relativePath).not.toMatch(/leads\([^)]*\baddress2\b/);
    if (relativePath.includes('TechInspection') || relativePath.includes('InspectionFieldCustomer')) {
      expect(source).toContain('LEAD_FIELD_SELECT');
      expect(source).toContain('hydrateLeadsWithProperties');
    }
  }

  const customerStep = readSource('src/components/tech/InspectionFieldCustomerStep.jsx');
  const leadPatchBlock = customerStep.match(/const leadPatch = \{[\s\S]*?\n\s*\};/);
  expect(leadPatchBlock?.[0] || '').toMatch(/address:\s*serviceAddress/);
  expect(leadPatchBlock?.[0] || '').not.toMatch(/\baddress1\s*:/);
  expect(leadPatchBlock?.[0] || '').not.toMatch(/\bcity\s*:/);
  expect(customerStep).toContain("from('properties')");
  expect(customerStep).toContain('appointmentService.createCustomer');

  expect(LEAD_FIELD_SELECT).toMatch(/(^|,)\s*address\s*(,|$)/);
  expect(LEAD_FIELD_SELECT).toContain('property_id');
  expect(LEAD_FIELD_SELECT).not.toMatch(/property\s*:\s*property_id/);
  expect(LEAD_FIELD_SELECT).not.toMatch(/\baddress1\b/);
  expect(LEAD_FIELD_SELECT).not.toMatch(/\bcity\b/);
  expect(PROPERTY_FIELD_SELECT).toMatch(/\baddress1\b/);
});

test('hydrateLeadsWithProperties loads properties via separate query', async () => {
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
              return {
                eq() {
                  return Promise.resolve({
                    data: [
                      {
                        id: 'prop-1',
                        address1: '201 Secondary Property Rd',
                        address2: null,
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
    },
  };

  const withProperty = await hydrateLeadsWithProperties(client, 'tvg', [
    { id: 'lead-1', property_id: 'prop-1', address: 'FALLBACK LEAD ADDRESS ONLY' },
    { id: 'lead-2', property_id: null, address: '101 Lead Only Lane' },
  ]);

  expect(calls[0]).toBe('properties');
  expect(calls[1]).toBe(PROPERTY_FIELD_SELECT);
  expect(withProperty[0].property.address1).toBe('201 Secondary Property Rd');
  expect(resolveServiceAddress({ lead: withProperty[0] })).toMatch(/201 Secondary Property Rd/);
  expect(resolveServiceAddress({ lead: withProperty[0] })).not.toMatch(/FALLBACK LEAD ADDRESS ONLY/);
  expect(withProperty[1].property).toBeNull();
  expect(resolveServiceAddress({ lead: withProperty[1] })).toBe('101 Lead Only Lane');
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
