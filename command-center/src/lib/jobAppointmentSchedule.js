/**
 * R3 — Appointment is the schedule source of truth when linked to a job.
 *
 * Link direction: appointments.job_id → jobs.id (Packet 008).
 * When a link exists, CRM job/dispatch UIs must not edit scheduled_* (or
 * mirroring tech/address) on the job; edit the appointment on Calendar instead.
 */

const asText = (value) => (typeof value === 'string' ? value.trim() : '');

export const JOB_SCHEDULE_LINKED_MESSAGE =
  'This work order is linked to a calendar appointment. Change the date, time, technician, or service address on Calendar — not on the work order.';

export const LINKED_APPOINTMENT_SELECT =
  'id, job_id, scheduled_start, scheduled_end, technician_id, service_address, status, lead_id';

/**
 * Fetch the appointment row linked to a job, if any.
 */
export const fetchLinkedAppointmentForJob = async (client, { tenantId, jobId } = {}) => {
  const id = asText(jobId);
  if (!client || !id) return null;

  let query = client
    .from('appointments')
    .select(LINKED_APPOINTMENT_SELECT)
    .eq('job_id', id)
    .maybeSingle();

  if (tenantId) {
    query = client
      .from('appointments')
      .select(LINKED_APPOINTMENT_SELECT)
      .eq('tenant_id', tenantId)
      .eq('job_id', id)
      .maybeSingle();
  }

  const { data, error } = await query;
  if (error) {
    // Missing column / relation should not crash office screens.
    if (
      error.code === '42703' ||
      error.code === '42P01' ||
      /column .* does not exist|could not find the/i.test(error.message || '')
    ) {
      return null;
    }
    throw error;
  }
  return data || null;
};

export const isJobScheduleLockedByAppointment = (appointment) => Boolean(appointment?.id);

/** Compare ISO timestamps within 60s (trigger sync / UI rounding). */
export const scheduleTimesMatch = (leftIso, rightIso, toleranceMs = 60_000) => {
  if (!leftIso || !rightIso) return false;
  const left = new Date(leftIso).getTime();
  const right = new Date(rightIso).getTime();
  if (!Number.isFinite(left) || !Number.isFinite(right)) return false;
  return Math.abs(left - right) <= toleranceMs;
};

/**
 * When schedule is locked, drop schedule-driving fields from a job update payload.
 * Leaves payment_terms and other non-schedule fields intact.
 */
export const omitLockedScheduleFields = (payload = {}) => {
  const next = { ...payload };
  delete next.scheduled_start;
  delete next.scheduled_end;
  delete next.technician_id;
  delete next.service_address;
  return next;
};
