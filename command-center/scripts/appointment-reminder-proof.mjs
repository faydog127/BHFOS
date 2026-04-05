import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

import {
  createAdminClient,
  createRunId,
  insertWithRetry,
} from '../tests/smoke/helpers/supabaseAdmin.js';

const TENANT_ID = 'tvg';
const RUN_AT_IN_HOURS = '2026-03-19T15:00:00.000Z';
const RUN_AT_AFTER_HOURS = '2026-03-19T23:00:00.000Z';

const parseEnvFile = (envPath) => {
  if (!fs.existsSync(envPath)) return {};
  const raw = fs.readFileSync(envPath, 'utf8');
  const out = {};
  raw.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const idx = trimmed.indexOf('=');
    if (idx === -1) return;
    out[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
  });
  return out;
};

const env = {
  ...parseEnvFile(path.join(process.cwd(), '.env')),
  ...parseEnvFile(path.join(process.cwd(), '.env.local')),
};

const anonKey = process.env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
if (!anonKey) {
  throw new Error('Missing VITE_SUPABASE_ANON_KEY for function invocation.');
}

const { client: admin, env: adminEnv } = createAdminClient();
const supabaseUrl = adminEnv.supabaseUrl;
const runId = createRunId().replace(/-/g, '').slice(0, 8).toLowerCase();

const assertTrue = (condition, message, details = undefined) => {
  if (!condition) {
    const error = new Error(message);
    if (details !== undefined) error.details = details;
    throw error;
  }
};

const invokeFunction = async ({ functionName, accessToken, body }) => {
  const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
      'x-tenant-id': TENANT_ID,
    },
    body: JSON.stringify(body),
  });
  const json = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, json };
};

const createTempSession = async () => {
  const client = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const email = `appointment.proof.${Date.now()}@example.com`;
  const password = 'Passw0rd!Appointment1';

  const { data: createdUser, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { tenant_id: TENANT_ID },
  });
  if (createError) throw createError;

  const userId = createdUser?.user?.id;
  const { data: signInData, error: signInError } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError) throw signInError;

  const accessToken = signInData?.session?.access_token;
  if (!accessToken) throw new Error('Failed to get access token for proof user.');

  return {
    accessToken,
    cleanup: async () => {
      if (userId) {
        await admin.auth.admin.deleteUser(userId);
      }
    },
  };
};

const createLead = async (suffix) => {
  const result = await insertWithRetry(admin, 'leads', {
    tenant_id: TENANT_ID,
    first_name: 'Appointment',
    last_name: `Proof ${suffix}`,
    email: `appointment.${suffix}.${runId}@example.com`,
    phone: '3215551111',
    service: 'Dryer Vent Cleaning',
    source: 'APPOINTMENT_PROOF',
    status: 'new',
    stage: 'new',
    persona: 'homeowner',
    is_partner: false,
  });
  if (result.error) throw result.error;
  return result.data;
};

const createTech = async () => {
  const existing = await admin
    .from('technicians')
    .select('id, full_name')
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existing.error) throw existing.error;
  if (existing.data?.id) return existing.data;

  const techUserEmail = `appointment.tech.${runId}@example.com`;
  const techPassword = `Tech!${runId}Aa1`;
  const { data: createdUser, error: techUserError } = await admin.auth.admin.createUser({
    email: techUserEmail,
    password: techPassword,
    email_confirm: true,
    app_metadata: { tenant_id: TENANT_ID, role: 'technician' },
  });
  if (techUserError) throw techUserError;

  const result = await insertWithRetry(admin, 'technicians', {
    user_id: createdUser?.user?.id || null,
    full_name: `Appointment Proof Tech ${runId.toUpperCase()}`,
    email: techUserEmail,
    is_active: true,
    is_primary_default: true,
  });
  if (result.error) throw result.error;
  return result.data;
};

const getActiveService = async () => {
  const { data, error } = await admin
    .from('price_book')
    .select('id, name, category')
    .eq('active', true)
    .in('tenant_id', ['default', TENANT_ID])
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  assertTrue(data?.id, 'Missing active price_book row for appointment proof.');
  return data;
};

const getAppointmentTasks = async (appointmentId) => {
  const { data, error } = await admin
    .from('crm_tasks')
    .select('id, title, status, due_at, metadata')
    .eq('tenant_id', TENANT_ID)
    .eq('source_type', 'appointment')
    .eq('source_id', appointmentId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
};

const getTaskByKind = async (appointmentId, kind) => {
  const tasks = await getAppointmentTasks(appointmentId);
  return tasks.find((task) => task.metadata?.automation_kind === kind) || null;
};

const setTaskDueAt = async (taskId, dueAt) => {
  const { error } = await admin
    .from('crm_tasks')
    .update({ due_at: dueAt, updated_at: new Date().toISOString() })
    .eq('id', taskId);
  if (error) throw error;
};

const countEvents = async (entityType, entityId, eventType) => {
  const { count, error } = await admin
    .from('events')
    .select('id', { count: 'exact', head: true })
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .eq('event_type', eventType);
  if (error) throw error;
  return count || 0;
};

const removeTestData = async (appointmentIds, leadIds) => {
  if (appointmentIds.length) {
    await admin.from('crm_tasks').delete().eq('tenant_id', TENANT_ID).eq('source_type', 'appointment').in('source_id', appointmentIds);
    await admin.from('appointments').delete().eq('tenant_id', TENANT_ID).in('id', appointmentIds);
  }
  if (leadIds.length) {
    await admin.from('leads').delete().eq('tenant_id', TENANT_ID).in('id', leadIds);
  }
};

const summary = {
  run_id: runId,
  create_confirmed: null,
  reminder_send: null,
  pending_to_confirmed: null,
  cancel_stop: null,
  after_hours: null,
};

const { accessToken, cleanup } = await createTempSession();
const appointmentIds = [];
const leadIds = [];

try {
  const tech = await createTech();
  const service = await getActiveService();

  const confirmedLead = await createLead('confirmed');
  leadIds.push(confirmedLead.id);
  const createConfirmed = await invokeFunction({
    functionName: 'create-appointment',
    accessToken,
    body: {
      tenant_id: TENANT_ID,
      lead_id: confirmedLead.id,
      technician_id: tech.id,
      price_book_id: service.id,
      scheduled_start: '2026-03-20T19:00:00.000Z',
      duration_minutes: 120,
      service_address: '530 Loxley Ct, Titusville, FL 32780',
      status: 'confirmed',
      admin_notes: 'Appointment reminder proof',
    },
  });
  assertTrue(createConfirmed.ok, 'create-appointment failed for confirmed scenario.', createConfirmed);
  const confirmedAppointmentId = createConfirmed.json?.appointment?.id;
  appointmentIds.push(confirmedAppointmentId);
  assertTrue(confirmedAppointmentId, 'Confirmed appointment did not return an id.');
  assertTrue(Number(createConfirmed.json?.reminder_result?.queued || 0) >= 2, 'Confirmed appointment did not queue both reminders.', createConfirmed.json);
  const confirmedTasks = await getAppointmentTasks(confirmedAppointmentId);
  assertTrue(confirmedTasks.length >= 2, 'Confirmed appointment reminder tasks missing.', confirmedTasks);
  summary.create_confirmed = {
    appointment_id: confirmedAppointmentId,
    queued: createConfirmed.json?.reminder_result?.queued || 0,
  };

  const dayBeforeTask = await getTaskByKind(confirmedAppointmentId, 'appointment_reminder_day_before');
  assertTrue(dayBeforeTask?.id, 'Missing day-before task for confirmed appointment.');
  await setTaskDueAt(dayBeforeTask.id, RUN_AT_IN_HOURS);
  const reminderRun = await invokeFunction({
    functionName: 'run-appointment-reminders',
    accessToken,
    body: {
      tenant_id: TENANT_ID,
      run_at: RUN_AT_IN_HOURS,
      limit: 10,
    },
  });
  assertTrue(reminderRun.ok, 'run-appointment-reminders failed for send scenario.', reminderRun);
  const sentResult = reminderRun.json?.results?.find((result) => result.task_id === dayBeforeTask.id);
  assertTrue(sentResult?.outcome === 'sent', 'Appointment reminder did not send in-hours.', reminderRun.json?.results);
  const sentEventCount = await countEvents('appointment', confirmedAppointmentId, 'AppointmentReminderSent');
  assertTrue(sentEventCount >= 1, 'AppointmentReminderSent event missing after send.');
  summary.reminder_send = {
    task_id: dayBeforeTask.id,
    outcome: sentResult?.outcome,
    sent_event_count: sentEventCount,
  };

  const pendingLead = await createLead('pending');
  leadIds.push(pendingLead.id);
  const createPending = await invokeFunction({
    functionName: 'create-appointment',
    accessToken,
    body: {
      tenant_id: TENANT_ID,
      lead_id: pendingLead.id,
      technician_id: tech.id,
      price_book_id: service.id,
      scheduled_start: '2026-03-24T19:00:00.000Z',
      duration_minutes: 90,
      status: 'pending',
    },
  });
  assertTrue(createPending.ok, 'create-appointment failed for pending scenario.', createPending);
  const pendingAppointmentId = createPending.json?.appointment?.id;
  appointmentIds.push(pendingAppointmentId);
  assertTrue(pendingAppointmentId, 'Pending appointment did not return an id.');
  const pendingTasksBefore = await getAppointmentTasks(pendingAppointmentId);
  assertTrue(pendingTasksBefore.length === 0, 'Pending appointment should not queue reminders before confirmation.', pendingTasksBefore);
  const confirmPending = await invokeFunction({
    functionName: 'update-appointment-status',
    accessToken,
    body: {
      tenant_id: TENANT_ID,
      appointment_id: pendingAppointmentId,
      status: 'confirmed',
    },
  });
  assertTrue(confirmPending.ok, 'update-appointment-status failed for pending->confirmed.', confirmPending);
  const pendingTasksAfter = await getAppointmentTasks(pendingAppointmentId);
  assertTrue(pendingTasksAfter.length >= 2, 'Confirmed appointment did not queue reminder tasks.', pendingTasksAfter);
  summary.pending_to_confirmed = {
    appointment_id: pendingAppointmentId,
    queued: confirmPending.json?.reminder_result?.queued || 0,
  };

  const cancelLead = await createLead('cancel');
  leadIds.push(cancelLead.id);
  const createCancel = await invokeFunction({
    functionName: 'create-appointment',
    accessToken,
    body: {
      tenant_id: TENANT_ID,
      lead_id: cancelLead.id,
      technician_id: tech.id,
      price_book_id: service.id,
      scheduled_start: '2026-03-24T21:00:00.000Z',
      duration_minutes: 60,
      status: 'confirmed',
    },
  });
  assertTrue(createCancel.ok, 'create-appointment failed for cancel scenario.', createCancel);
  const cancelAppointmentId = createCancel.json?.appointment?.id;
  appointmentIds.push(cancelAppointmentId);
  const cancelTask = await getTaskByKind(cancelAppointmentId, 'appointment_reminder_day_before');
  assertTrue(cancelTask?.id, 'Missing reminder task for cancel scenario.');
  await setTaskDueAt(cancelTask.id, RUN_AT_IN_HOURS);
  const cancelUpdate = await invokeFunction({
    functionName: 'update-appointment-status',
    accessToken,
    body: {
      tenant_id: TENANT_ID,
      appointment_id: cancelAppointmentId,
      status: 'cancelled',
    },
  });
  assertTrue(cancelUpdate.ok, 'Failed to cancel appointment before reminder run.', cancelUpdate);
  const cancelRun = await invokeFunction({
    functionName: 'run-appointment-reminders',
    accessToken,
    body: {
      tenant_id: TENANT_ID,
      run_at: RUN_AT_IN_HOURS,
      limit: 20,
    },
  });
  assertTrue(cancelRun.ok, 'run-appointment-reminders failed for cancellation scenario.', cancelRun);
  const cancelledTaskRow = await admin.from('crm_tasks').select('status, metadata').eq('id', cancelTask.id).maybeSingle();
  assertTrue(
    cancelledTaskRow.data?.status === 'completed',
    'Cancelled appointment task was not closed.',
    cancelledTaskRow.data,
  );
  summary.cancel_stop = {
    appointment_id: cancelAppointmentId,
    task_status: cancelledTaskRow.data?.status || null,
    last_result: cancelledTaskRow.data?.metadata?.automation_last_result || null,
  };

  const afterHoursLead = await createLead('afterhours');
  leadIds.push(afterHoursLead.id);
  const createAfterHours = await invokeFunction({
    functionName: 'create-appointment',
    accessToken,
    body: {
      tenant_id: TENANT_ID,
      lead_id: afterHoursLead.id,
      technician_id: tech.id,
      price_book_id: service.id,
      scheduled_start: '2026-03-20T19:00:00.000Z',
      duration_minutes: 120,
      status: 'confirmed',
    },
  });
  assertTrue(createAfterHours.ok, 'create-appointment failed for after-hours scenario.', createAfterHours);
  const afterHoursAppointmentId = createAfterHours.json?.appointment?.id;
  appointmentIds.push(afterHoursAppointmentId);
  const afterHoursTask = await getTaskByKind(afterHoursAppointmentId, 'appointment_reminder_day_before');
  assertTrue(afterHoursTask?.id, 'Missing after-hours reminder task.');
  await setTaskDueAt(afterHoursTask.id, RUN_AT_AFTER_HOURS);
  const afterHoursRun = await invokeFunction({
    functionName: 'run-appointment-reminders',
    accessToken,
    body: {
      tenant_id: TENANT_ID,
      run_at: RUN_AT_AFTER_HOURS,
      limit: 20,
    },
  });
  assertTrue(afterHoursRun.ok, 'run-appointment-reminders failed for after-hours scenario.', afterHoursRun);
  const afterHoursResult = afterHoursRun.json?.results?.find((result) => result.task_id === afterHoursTask.id);
  assertTrue(afterHoursResult?.outcome === 'deferred_after_hours', 'After-hours reminder was not deferred.', afterHoursRun.json?.results);
  summary.after_hours = {
    appointment_id: afterHoursAppointmentId,
    outcome: afterHoursResult?.outcome || null,
    deferred_to: afterHoursResult?.deferred_to || null,
  };

  console.log(JSON.stringify(summary, null, 2));
} finally {
  await removeTestData(appointmentIds.filter(Boolean), leadIds.filter(Boolean));
  await cleanup();
}
