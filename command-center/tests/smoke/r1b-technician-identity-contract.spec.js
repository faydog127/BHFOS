/* eslint-disable testing-library/prefer-screen-queries, jest/valid-title */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';
import {
  resolveLoggedInTechnicianRosterId,
  resolveTechnicianAuthUserId,
  resolveTechnicianDisplayName,
  resolveTechnicianRosterId,
  resolveTechnicianSelectValue,
  TECHNICIAN_ROSTER_SELECT,
} from '../../src/lib/technicianIdentity.js';
import {
  formatOffenders,
  scanIdentityRelationshipGuards,
} from '../../tools/identity-relationship-guards.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '../..');

const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const TECH_ROSTER_ID = '11111111-1111-4111-8111-111111111111';
const TECH_USER_ID = '22222222-2222-4222-8222-222222222222';
const OTHER_ROSTER_ID = '33333333-3333-4333-8333-333333333333';

const technicians = [
  {
    id: TECH_ROSTER_ID,
    user_id: TECH_USER_ID,
    full_name: 'Roster Tech',
    is_active: true,
  },
  {
    id: OTHER_ROSTER_ID,
    user_id: null,
    full_name: 'No Login Tech',
    is_active: true,
  },
];

test('helper resolves auth user → roster id and never returns user_id for assignment writes', async () => {
  expect(TECHNICIAN_ROSTER_SELECT).toContain('id');
  expect(TECHNICIAN_ROSTER_SELECT).toContain('user_id');

  expect(resolveTechnicianRosterId({ technicians, value: TECH_ROSTER_ID })).toBe(TECH_ROSTER_ID);
  expect(resolveTechnicianRosterId({ technicians, value: TECH_USER_ID })).toBe(TECH_ROSTER_ID);
  expect(resolveTechnicianSelectValue({ technicians, value: TECH_USER_ID })).toBe(TECH_ROSTER_ID);
  expect(resolveTechnicianSelectValue({ technicians, value: null })).toBe('unassigned');

  expect(resolveLoggedInTechnicianRosterId({ technicians, authUserId: TECH_USER_ID })).toBe(
    TECH_ROSTER_ID,
  );
  expect(resolveTechnicianAuthUserId({ technicians, value: TECH_ROSTER_ID })).toBe(TECH_USER_ID);
  expect(resolveTechnicianDisplayName({ technicians, value: TECH_USER_ID })).toBe('Roster Tech');

  // Assignment payload shape: select value is always roster id.
  const assignmentPayload = {
    technician_id:
      resolveTechnicianSelectValue({ technicians, value: TECH_USER_ID }) === 'unassigned'
        ? null
        : resolveTechnicianSelectValue({ technicians, value: TECH_USER_ID }),
  };
  expect(assignmentPayload.technician_id).toBe(TECH_ROSTER_ID);
  expect(assignmentPayload.technician_id).not.toBe(TECH_USER_ID);
});

test('Jobs assignment selector writes technicians.id', async () => {
  const jobs = read('src/pages/crm/Jobs.jsx');
  expect(jobs).toContain("from '@/lib/technicianIdentity'");
  expect(jobs).toContain('resolveTechnicianSelectValue');
  expect(jobs).toContain('value={tech.id}');
  expect(jobs).not.toContain('value={tech.user_id}');
  expect(jobs).toContain('TECHNICIAN_ROSTER_SELECT');
  // Save payload still uses the select state (now roster id).
  expect(jobs).toMatch(/technician_id:\s*recordTechnicianId/);
  expect(jobs).toMatch(/technician_id:\s*scheduleTechnicianId|payload\.technician_id\s*=\s*scheduleTechnicianId/);
});

test('Dispatch Schedule assignment selector writes technicians.id', async () => {
  const schedule = read('src/pages/crm/Schedule.jsx');
  expect(schedule).toContain("from '@/lib/technicianIdentity'");
  expect(schedule).toContain('resolveTechnicianSelectValue');
  expect(schedule).toContain('value={technician.id}');
  expect(schedule).not.toContain('dispatch_id');
  expect(schedule).not.toContain('tech.user_id || tech.id');
  expect(schedule).toContain('technician_id: dispatchTechnicianId');
});

test('AppointmentScheduler continues to write technicians.id', async () => {
  const source = read('src/pages/crm/appointments/AppointmentScheduler.jsx');
  expect(source).toContain('value={tech.id}');
  expect(source).not.toContain('value={tech.user_id}');
  expect(source).toMatch(/technician_id/);
});

test('TechQueue and TechJobDetail resolve auth user then filter by roster id', async () => {
  const queue = read('src/pages/tech/TechQueue.jsx');
  const detail = read('src/pages/tech/TechJobDetail.jsx');

  expect(queue).toContain(".eq('user_id', user.id)");
  expect(queue).toContain(".eq('technician_id', tech.id)");
  expect(queue).not.toMatch(/\.eq\(\s*['"]technician_id['"]\s*,\s*user\.id\s*\)/);

  expect(detail).toContain(".eq('user_id', user?.id || '')");
  expect(detail).toContain(".eq('technician_id', techData.id)");
  expect(detail).toContain('technician_id: technician.id');
  expect(detail).not.toMatch(/\.eq\(\s*['"]technician_id['"]\s*,\s*user\.id\s*\)/);
});

test('InspectionEditor assignment control uses technicians.id', async () => {
  const editor = read('src/pages/crm/inspections/InspectionEditor.jsx');
  expect(editor).toContain('value={tech.id}');
  expect(editor).not.toContain('value={tech.user_id}');
});

test('active assignment controls never store technicians.user_id as option value', async () => {
  // Canonical walk lives in R1C tools/identity-relationship-guards.mjs
  const result = scanIdentityRelationshipGuards({ root });
  const techOffenders = result.offenders.filter((o) => o.domain === 'technician');
  expect(techOffenders, formatOffenders(techOffenders)).toEqual([]);
});

test('active src does not compare auth.uid/user.id directly to assignment technician_id filters', async () => {
  const result = scanIdentityRelationshipGuards({ root });
  const filterOffenders = result.offenders.filter(
    (o) => o.ruleId === 'filter_technician_id_by_user_id',
  );
  expect(filterOffenders, formatOffenders(filterOffenders)).toEqual([]);
});

test('money-loop / estimate modules are untouched by R1B identity changes', async () => {
  // Guard that this PR does not expand into pricing/invoice/payment/estimate files.
  const moneyPaths = [
    'src/services/paymentService.js',
    'src/pages/public/PaymentPage.jsx',
    'src/pages/crm/proposals/ProposalBuilder.jsx',
  ];
  for (const relativePath of moneyPaths) {
    const source = read(relativePath);
    expect(source).not.toContain("from '@/lib/technicianIdentity'");
  }
});
