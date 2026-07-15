/* eslint-disable testing-library/prefer-screen-queries, jest/valid-title */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';
import {
  LEAD_INTAKE_MESSAGES,
  buildLeadIntakeInsertPayload,
  validateLeadIntake,
} from '../../src/lib/leadIntakeContract.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '../..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const INTAKE_SURFACES = [
  'src/lib/leadIntakeContract.js',
  'src/services/appointmentService.js',
  'src/pages/crm/Leads.jsx',
  'src/components/tech/InspectionFieldCustomerStep.jsx',
  'src/pages/crm/appointments/AppointmentScheduler.jsx',
];

test('shared intake contract blocks incomplete creates with plain language', async () => {
  const missing = validateLeadIntake({});
  expect(missing.ok).toBe(false);
  expect(missing.errors.map((e) => e.message)).toEqual(
    expect.arrayContaining([
      LEAD_INTAKE_MESSAGES.name,
      LEAD_INTAKE_MESSAGES.phone,
      LEAD_INTAKE_MESSAGES.address,
    ]),
  );

  const ok = validateLeadIntake({
    first_name: 'Pat',
    phone: '3215551212',
    address: '101 Test Airflow Lane, Titusville, FL 32780',
  });
  expect(ok.ok).toBe(true);

  const payload = buildLeadIntakeInsertPayload(ok.normalized, { tenantId: 'tvg', source: 'test' });
  expect(payload.address).toBeTruthy();
  expect(payload.property_formatted_address).toBe(payload.address);
  expect(payload).not.toHaveProperty('property_id');
});

test('CRM, field, and scheduler create paths import the intake contract', async () => {
  for (const relativePath of INTAKE_SURFACES.slice(1)) {
    const source = read(relativePath);
    expect(source, relativePath).toMatch(/leadIntakeContract/);
  }

  expect(read('src/pages/crm/Leads.jsx')).toContain('assertLeadIntakeValid');
  expect(read('src/pages/crm/Leads.jsx')).toContain('buildLeadIntakeInsertPayload');
  expect(read('src/components/tech/InspectionFieldCustomerStep.jsx')).toContain('assertLeadIntakeValid');
  expect(read('src/pages/crm/appointments/AppointmentScheduler.jsx')).toContain('assertLeadIntakeValid');
  expect(read('src/services/appointmentService.js')).toContain('buildLeadIntakeInsertPayload');
});

test('create paths do not silently strip columns on lead insert', async () => {
  const leads = read('src/pages/crm/Leads.jsx');
  const handleAddSave = leads.match(/const handleAddSave = async \(\) => \{[\s\S]*?\n  \};/);
  expect(handleAddSave?.[0] || '', 'handleAddSave missing').toBeTruthy();
  expect(handleAddSave[0]).not.toMatch(/delete payload\./);
  expect(handleAddSave[0]).toContain('describeLeadIntakeDbError');

  const service = read('src/services/appointmentService.js');
  const createCustomer = service.match(/async createCustomer\([\s\S]*?\n  \},/);
  expect(createCustomer?.[0] || '', 'createCustomer missing').toBeTruthy();
  expect(createCustomer[0]).not.toMatch(/delete fallbackPayload/);
  expect(createCustomer[0]).not.toMatch(/delete .*pipeline_stage/);
  expect(createCustomer[0]).toContain('describeLeadIntakeDbError');
});

test('intake create paths never invent properties rows', async () => {
  for (const relativePath of INTAKE_SURFACES) {
    const source = read(relativePath);
    expect(source, relativePath).not.toMatch(/\.from\(\s*['"]properties['"]\s*\)\s*\.insert/);
  }
});
