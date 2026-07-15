/* eslint-disable testing-library/prefer-screen-queries, jest/valid-title */
/**
 * R1C Playwright wrapper — runs the shared Node guard + asserts helper imports remain wired.
 * Prefer `npm run guard:identity` / `npm run test:identity-helpers` in CI (no browsers).
 */
import { test, expect } from '@playwright/test';
import {
  formatOffenders,
  scanIdentityRelationshipGuards,
} from '../../tools/identity-relationship-guards.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '../..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('R1C source-walk guard passes on active src', async () => {
  const result = scanIdentityRelationshipGuards({ root });
  expect(result.ok, formatOffenders(result.offenders)).toBeTruthy();
});

test('approved helpers remain the single source of identity/address resolution', async () => {
  const addressHelper = read('src/lib/inspectionFieldAddress.js');
  const techHelper = read('src/lib/technicianIdentity.js');

  expect(addressHelper).toContain('resolveLegacyServiceAddress');
  expect(addressHelper).toContain('hydrateLeadsWithProperties');
  expect(addressHelper).toContain('isNumericPropertyId');
  expect(addressHelper).toContain('Never block technician inspection load');

  expect(techHelper).toContain('resolveTechnicianSelectValue');
  expect(techHelper).toContain('resolveLoggedInTechnicianRosterId');
  expect(techHelper).toContain('technicians.id');
  expect(techHelper).toContain('never technicians.user_id');
});

test('Jobs and Schedule remain on shared technician helper', async () => {
  const jobs = read('src/pages/crm/Jobs.jsx');
  const schedule = read('src/pages/crm/Schedule.jsx');
  for (const source of [jobs, schedule]) {
    expect(source).toContain("from '@/lib/technicianIdentity'");
    expect(source).toContain('resolveTechnicianSelectValue');
    expect(source).not.toContain('value={tech.user_id}');
    expect(source).not.toContain('dispatch_id');
  }
});

test('paymentService remains on shared address helper without property embeds', async () => {
  const source = read('src/services/paymentService.js');
  expect(source).toContain('resolveLegacyServiceAddress');
  expect(source).toContain('LEAD_ADDRESS_SELECT');
  expect(source).not.toMatch(/property\s*:\s*property_id\s*\(/);
  expect(source).not.toMatch(/properties!fk_leads_property/);
});
