/* eslint-disable testing-library/prefer-screen-queries, jest/valid-title */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';
import {
  JOB_SCHEDULE_LINKED_MESSAGE,
  isJobScheduleLockedByAppointment,
  omitLockedScheduleFields,
} from '../../src/lib/jobAppointmentSchedule.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '../..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('tech schedule is mounted and reachable from tech nav', async () => {
  const routes = read('src/pages/tech/TechRoutes.jsx');
  const layout = read('src/components/tech/TechLayout.jsx');
  const schedule = read('src/pages/tech/TechSchedule.jsx');

  expect(routes).toContain("path=\"schedule\"");
  expect(routes).toContain('TechSchedule');
  expect(layout).toContain('/tech/schedule');
  expect(layout).toMatch(/label:\s*'Schedule'/);
  expect(schedule).toContain('eq(\'tenant_id\'');
  expect(schedule).toContain('resolveLoggedInTechnicianRosterId');
  expect(schedule).toContain('/tech/jobs/');
  expect(schedule).toMatch(/Read-only|read-only/i);
  expect(schedule).toContain('selectedDate');
});

test('CRM job and dispatch schedule edits lock when appointment is linked', async () => {
  const jobs = read('src/pages/crm/Jobs.jsx');
  const dispatch = read('src/pages/crm/Schedule.jsx');
  const helper = read('src/lib/jobAppointmentSchedule.js');

  expect(helper).toContain('fetchLinkedAppointmentForJob');
  expect(helper).toContain('omitLockedScheduleFields');
  expect(JOB_SCHEDULE_LINKED_MESSAGE).toMatch(/Calendar/);

  expect(jobs).toContain('fetchLinkedAppointmentForJob');
  expect(jobs).toContain('JOB_SCHEDULE_LINKED_MESSAGE');
  expect(jobs).toContain('recordScheduleLocked');
  expect(jobs).toContain('scheduleLocked');
  expect(jobs).toContain('omitLockedScheduleFields');

  expect(dispatch).toContain('fetchLinkedAppointmentForJob');
  expect(dispatch).toContain('scheduleLocked');
  expect(dispatch).toContain('omitLockedScheduleFields');
  expect(dispatch).toContain('JOB_SCHEDULE_LINKED_MESSAGE');

  expect(isJobScheduleLockedByAppointment({ id: 'a1' })).toBe(true);
  expect(omitLockedScheduleFields({ scheduled_start: 'x', status: 'scheduled' })).not.toHaveProperty(
    'scheduled_start',
  );
});

test('R3 does not rewrite work order board service', async () => {
  // Guardrail: board service should not appear in this release's ownership changes.
  // We only assert Jobs/Schedule/Tech files reference the helper, not a board rewrite.
  const board = read('src/services/workOrderBoardService.js');
  expect(board).not.toContain('jobAppointmentSchedule');
});
