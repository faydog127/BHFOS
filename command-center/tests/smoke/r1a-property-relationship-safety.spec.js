/* eslint-disable testing-library/prefer-screen-queries, jest/valid-title */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';
import {
  LEAD_ADDRESS_SELECT,
  LEAD_FIELD_SELECT,
  resolveLegacyServiceAddress,
  resolveServiceAddress,
} from '../../src/lib/inspectionFieldAddress.js';
import {
  formatOffenders,
  scanIdentityRelationshipGuards,
} from '../../tools/identity-relationship-guards.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '../..');

const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const BANNED_EMBED = /property\s*:\s*property_id\s*\(/;
const BANNED_FK_LEAD = /properties!fk_leads_property/;
const BANNED_FK_INVOICE = /properties!fk_invoices_property/;

test('active src never uses banned lead/property PostgREST embeds', async () => {
  // Canonical walk lives in R1C tools/identity-relationship-guards.mjs
  const result = scanIdentityRelationshipGuards({ root });
  const propertyOffenders = result.offenders.filter((o) => o.domain === 'property');
  expect(propertyOffenders, formatOffenders(propertyOffenders)).toEqual([]);
});

test('paymentService does not use unsafe property embeds and resolves address fallbacks', async () => {
  const source = read('src/services/paymentService.js');
  expect(source).not.toMatch(BANNED_EMBED);
  expect(source).not.toMatch(BANNED_FK_LEAD);
  expect(source).not.toMatch(BANNED_FK_INVOICE);
  expect(source).toContain('LEAD_ADDRESS_SELECT');
  expect(source).toContain('resolveLegacyServiceAddress');
  expect(source).toContain('resolved_service_address');

  // Financial authority unchanged
  expect(source).toMatch(/process_public_payment/);
  expect(source).not.toMatch(/p_metadata/);
});

test('invoice/service address fallback order is correct', async () => {
  const lead = {
    property_id: '13662027-a547-46b6-ada6-f89f4fe0ec09',
    property_formatted_address: '201 Secondary Property Rd, Titusville, FL 32780',
    address: 'FALLBACK LEAD ADDRESS ONLY',
  };

  expect(
    resolveLegacyServiceAddress({
      snapshotAddress: 'SNAP SHOT ADDR',
      serviceAddress: '99 Job Service St',
      lead,
    }),
  ).toBe('SNAP SHOT ADDR');

  expect(
    resolveLegacyServiceAddress({
      snapshotAddress: '',
      serviceAddress: '99 Job Service St',
      lead,
    }),
  ).toBe('99 Job Service St');

  expect(
    resolveLegacyServiceAddress({
      snapshotAddress: '',
      serviceAddress: '',
      lead,
    }),
  ).toMatch(/201 Secondary Property Rd/);

  expect(
    resolveLegacyServiceAddress({
      snapshotAddress: '',
      serviceAddress: '',
      lead: { property_id: '13662027-a547-46b6-ada6-f89f4fe0ec09', address: '101 Lead Only Lane' },
    }),
  ).toBe('101 Lead Only Lane');

  expect(
    resolveLegacyServiceAddress({
      snapshotAddress: '',
      serviceAddress: '',
      lead: { property_id: '13662027-a547-46b6-ada6-f89f4fe0ec09', address: '' },
    }),
  ).toBe('');
});

test('UUID property_id does not require properties join for address resolution', async () => {
  const lead = {
    property_id: '13662027-a547-46b6-ada6-f89f4fe0ec09',
    address: '101 Lead Only Lane',
  };
  expect(resolveLegacyServiceAddress({ lead })).toBe('101 Lead Only Lane');
  expect(resolveServiceAddress({ lead })).toBe('101 Lead Only Lane');
});

test('lead without property_id still resolves leads.address', async () => {
  const lead = { property_id: null, address: '55 Brand New Lead Way' };
  expect(resolveLegacyServiceAddress({ lead })).toBe('55 Brand New Lead Way');
});

test('ProposalBuilder loads leads without nested property embed', async () => {
  const source = read('src/pages/crm/proposals/ProposalBuilder.jsx');
  expect(source).not.toMatch(BANNED_EMBED);
  expect(source).toContain('resolveLegacyServiceAddress');
  expect(source).toMatch(/contact:contacts!leads_contact_id_fkey/);
});

test('office job/audit paths do not embed incompatible properties', async () => {
  const jobManager = read('src/components/crm/jobs/JobManager.jsx');
  const audit = read('src/pages/crm/AuditInspector.jsx');
  const completion = read('src/pages/crm/jobs/JobCompletion.jsx');
  for (const source of [jobManager, audit, completion]) {
    expect(source).not.toMatch(BANNED_EMBED);
    expect(source).not.toMatch(/properties\s*\(/);
  }
  expect(jobManager).toContain('service_address');
  expect(audit).toContain('property_formatted_address');
});

test('inspection safe helper contract remains unchanged for field selects', async () => {
  expect(LEAD_FIELD_SELECT).toContain('property_formatted_address');
  expect(LEAD_FIELD_SELECT).not.toMatch(BANNED_EMBED);
  expect(LEAD_ADDRESS_SELECT).not.toMatch(BANNED_EMBED);
  const helper = read('src/lib/inspectionFieldAddress.js');
  expect(helper).toContain('hydrateLeadsWithProperties');
  expect(helper).toContain('isNumericPropertyId');
});

test('technician assignment selectors remain out of R1A property scope', async () => {
  const jobs = read('src/pages/crm/Jobs.jsx');
  // R1B owns technician identity; R1A must not reintroduce property embeds there.
  expect(jobs).not.toMatch(/property\s*:\s*property_id\s*\(/);
  expect(jobs).toContain('resolveTechnicianSelection');
});
