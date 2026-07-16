/**
 * R3 job↔appointment schedule contract tests.
 * Run: node --test tests/unit/r3-job-appointment-schedule.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  JOB_SCHEDULE_LINKED_MESSAGE,
  isJobScheduleLockedByAppointment,
  omitLockedScheduleFields,
  scheduleTimesMatch,
} from '../../src/lib/jobAppointmentSchedule.js';

describe('R3 job appointment schedule helpers', () => {
  it('locks schedule when an appointment id is present', () => {
    assert.equal(isJobScheduleLockedByAppointment(null), false);
    assert.equal(isJobScheduleLockedByAppointment({}), false);
    assert.equal(isJobScheduleLockedByAppointment({ id: 'appt-1' }), true);
    assert.match(JOB_SCHEDULE_LINKED_MESSAGE, /Calendar/i);
  });

  it('omits schedule-driving fields from job payloads', () => {
    const next = omitLockedScheduleFields({
      scheduled_start: '2026-07-16T14:00:00.000Z',
      scheduled_end: '2026-07-16T16:00:00.000Z',
      technician_id: 'tech-1',
      service_address: '1 Main',
      status: 'scheduled',
      payment_terms: 'NET_7',
    });
    assert.equal(next.scheduled_start, undefined);
    assert.equal(next.scheduled_end, undefined);
    assert.equal(next.technician_id, undefined);
    assert.equal(next.service_address, undefined);
    assert.equal(next.status, 'scheduled');
    assert.equal(next.payment_terms, 'NET_7');
  });

  it('matches linked appointment and job times within tolerance', () => {
    assert.equal(
      scheduleTimesMatch('2026-07-16T14:00:00.000Z', '2026-07-16T14:00:30.000Z'),
      true,
    );
    assert.equal(
      scheduleTimesMatch('2026-07-16T14:00:00.000Z', '2026-07-16T15:00:00.000Z'),
      false,
    );
  });
});
