import { createFollowUpTask, closeFollowUpTasks } from './taskUtils.ts';
import { normalizeAutomationDueAt } from './businessHours.ts';
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { logMoneyLoopEvent } from './moneyLoopUtils.ts';

const APPOINTMENT_ACTIVE_STATUSES = new Set(['confirmed', 'rescheduled']);
const APPOINTMENT_CLOSED_STATUSES = new Set(['completed', 'cancelled', 'no_show']);

const REMINDER_DEFINITIONS = [
  {
    automationKind: 'appointment_reminder_day_before',
    title: 'Appointment Reminder - Day Before',
    hoursBefore: 24,
    priority: 'medium',
  },
  {
    automationKind: 'appointment_reminder_same_day',
    title: 'Appointment Reminder - 2 Hours',
    hoursBefore: 2,
    priority: 'high',
  },
] as const;

const asString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const toDate = (value: string | Date | null | undefined) => {
  if (value instanceof Date) return value;
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? null : parsed;
};

export const APPOINTMENT_REMINDER_KINDS = REMINDER_DEFINITIONS.map((entry) => entry.automationKind);

export const normalizeAppointmentStatus = (value: unknown) => {
  const normalized = asString(value).toLowerCase();
  if (!normalized) return 'pending';
  if (normalized === 'scheduled') return 'confirmed';
  if (normalized === 'approved') return 'confirmed';
  if (normalized === 'requested') return 'pending';
  return normalized;
};

export const isAppointmentActiveStatus = (value: unknown) =>
  APPOINTMENT_ACTIVE_STATUSES.has(normalizeAppointmentStatus(value));

export const isAppointmentClosedStatus = (value: unknown) =>
  APPOINTMENT_CLOSED_STATUSES.has(normalizeAppointmentStatus(value));

export const closeAppointmentReminderTasks = async (params: {
  tenantId: string;
  appointmentId: string;
  leadId?: string | null;
}) => {
  await closeFollowUpTasks({
    tenantId: params.tenantId,
    sourceType: 'appointment',
    sourceId: params.appointmentId,
    leadId: params.leadId ?? null,
  });
};

export const scheduleAppointmentReminderTasks = async (params: {
  tenantId: string;
  appointmentId: string;
  leadId?: string | null;
  scheduledStart: string | Date;
  serviceName?: string | null;
}) => {
  const appointmentStart = toDate(params.scheduledStart);
  if (!appointmentStart) return { queued: 0, skipped: REMINDER_DEFINITIONS.length };

  await closeAppointmentReminderTasks({
    tenantId: params.tenantId,
    appointmentId: params.appointmentId,
    leadId: params.leadId ?? null,
  });

  let queued = 0;
  let skipped = 0;

  for (const reminder of REMINDER_DEFINITIONS) {
    const rawDueAt = new Date(appointmentStart.getTime() - reminder.hoursBefore * 60 * 60 * 1000);
    const resolvedDueAt = await normalizeAutomationDueAt({
      tenantId: params.tenantId,
      requestedAt: rawDueAt,
    });

    if (resolvedDueAt >= appointmentStart) {
      skipped += 1;
      continue;
    }

    await createFollowUpTask({
      tenantId: params.tenantId,
      sourceType: 'appointment',
      sourceId: params.appointmentId,
      title: reminder.title,
      leadId: params.leadId ?? null,
      dueAt: resolvedDueAt.toISOString(),
      priority: reminder.priority,
      notes:
        reminder.automationKind === 'appointment_reminder_day_before'
          ? 'Send the day-before appointment reminder during business hours.'
          : 'Send the same-day appointment reminder before arrival.',
      metadata: {
        automation_kind: reminder.automationKind,
        appointment_start: appointmentStart.toISOString(),
        hours_before: reminder.hoursBefore,
        service_name: params.serviceName || null,
      },
    });

    queued += 1;
  }

  await logMoneyLoopEvent({
    tenantId: params.tenantId,
    entityType: 'appointment',
    entityId: params.appointmentId,
    eventType: 'AppointmentRemindersQueued',
    actorType: 'system',
    payload: {
      queued,
      skipped,
      scheduled_start: appointmentStart.toISOString(),
      service_name: params.serviceName || null,
    },
  });

  return { queued, skipped };
};

export const isAppointmentAutomationSuspended = async (params: {
  tenantId: string;
  appointmentId: string;
  leadId?: string | null;
}) => {
  const entityIds = [params.appointmentId, params.leadId].filter(Boolean) as string[];
  if (!entityIds.length) return false;

  const { data } = await supabaseAdmin
    .from('automation_suspensions')
    .select('id')
    .eq('tenant_id', params.tenantId)
    .is('resumed_at', null)
    .in('entity_type', ['appointment', 'lead'])
    .in('entity_id', entityIds)
    .limit(1);

  return Boolean(data?.length);
};

export const formatAppointmentTimeRange = (params: {
  start: string | Date | null | undefined;
  end?: string | Date | null | undefined;
  timeZone?: string | null;
}) => {
  const start = toDate(params.start);
  const end = toDate(params.end);
  if (!start) return 'Appointment time pending';

  const dateFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: params.timeZone || 'America/New_York',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
  const timeFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: params.timeZone || 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
  });

  if (!end) return dateFormatter.format(start);
  return `${dateFormatter.format(start)} - ${timeFormatter.format(end)}`;
};
