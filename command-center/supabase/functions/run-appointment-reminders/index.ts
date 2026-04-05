import { corsHeaders } from '../_shared/cors.ts';
import { getTenantIdFromClaims, getVerifiedClaims } from '../_shared/auth.ts';
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { getBusinessHoursPolicy, isWithinBusinessHours, normalizeAutomationDueAt } from '../_shared/businessHours.ts';
import {
  APPOINTMENT_REMINDER_KINDS,
  formatAppointmentTimeRange,
  isAppointmentActiveStatus,
  isAppointmentAutomationSuspended,
} from '../_shared/appointmentUtils.ts';
import { logMoneyLoopEvent } from '../_shared/moneyLoopUtils.ts';
import { sendEmail, renderEmailLayout, escapeHtml } from '../_shared/email.ts';
import { OPEN_TASK_STATUSES } from '../_shared/taskUtils.ts';

type TaskRow = {
  id: string;
  source_id: string;
  lead_id: string | null;
  due_at: string | null;
  title: string;
  metadata: Record<string, unknown> | null;
};

type AppointmentLeadRow = {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

type AppointmentRow = {
  id: string;
  tenant_id: string | null;
  lead_id: string | null;
  service_name: string | null;
  status: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  customer_notes: string | null;
  leads: AppointmentLeadRow | AppointmentLeadRow[] | null;
};

const respondJson = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const parseJson = async (req: Request): Promise<Record<string, unknown>> => {
  try {
    const parsed = await req.json();
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
};

const asString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
const toDate = (value: unknown) => {
  const text = asString(value);
  if (!text) return null;
  const parsed = new Date(text);
  return Number.isNaN(parsed.valueOf()) ? null : parsed;
};

const normalizeLead = (lead: AppointmentLeadRow | AppointmentLeadRow[] | null | undefined) => {
  if (!lead) return null;
  return Array.isArray(lead) ? lead[0] ?? null : lead;
};

const updateTask = async (taskId: string, patch: Record<string, unknown>) => {
  await supabaseAdmin
    .from('crm_tasks')
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq('id', taskId);
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return respondJson({ error: 'Method not allowed' }, 405);

  try {
    const body = await parseJson(req);
    const { claims } = await getVerifiedClaims(req);
    const tenantId = asString(body.tenant_id) || getTenantIdFromClaims(claims) || 'tvg';
    const actorId = typeof claims.sub === 'string' ? claims.sub : null;
    const dryRun = body.dry_run === true;
    const limit = Math.max(1, Math.min(50, Number(body.limit) || 25));
    const requestedRunAt = asString(body.run_at);
    const effectiveNow = requestedRunAt ? new Date(requestedRunAt) : new Date();
    if (Number.isNaN(effectiveNow.valueOf())) {
      return respondJson({ error: 'run_at must be a valid ISO datetime when provided.' }, 400);
    }
    const nowIso = effectiveNow.toISOString();

    const { data: tasksRaw, error: tasksError } = await supabaseAdmin
      .from('crm_tasks')
      .select('id, source_id, lead_id, due_at, title, metadata')
      .eq('tenant_id', tenantId)
      .eq('type', 'follow_up')
      .eq('source_type', 'appointment')
      .in('status', OPEN_TASK_STATUSES)
      .in('metadata->>automation_kind', APPOINTMENT_REMINDER_KINDS)
      .lte('due_at', nowIso)
      .order('due_at', { ascending: true })
      .limit(limit);

    if (tasksError) {
      return respondJson({ error: tasksError.message || 'Failed to load appointment reminder tasks.' }, 500);
    }

    const policy = await getBusinessHoursPolicy(tenantId);
    const results: Array<Record<string, unknown>> = [];

    for (const task of (tasksRaw || []) as TaskRow[]) {
      const taskResult: Record<string, unknown> = {
        task_id: task.id,
        appointment_id: task.source_id,
        outcome: 'skipped',
      };
      const metadata = (task.metadata || {}) as Record<string, unknown>;

      const insideBusinessHours = await isWithinBusinessHours({ tenantId, at: nowIso });
      if (!insideBusinessHours) {
        const deferredTo = await normalizeAutomationDueAt({ tenantId, requestedAt: nowIso });
        taskResult.outcome = 'deferred_after_hours';
        taskResult.deferred_to = deferredTo.toISOString();

        const appointmentStartForTask = toDate(metadata.appointment_start);
        if (appointmentStartForTask && deferredTo >= appointmentStartForTask) {
          taskResult.outcome = 'missed_window_after_hours';
          if (!dryRun) {
            await updateTask(task.id, {
              status: 'completed',
              metadata: { ...metadata, automation_last_result: 'missed_window_after_hours' },
            });
          }
          results.push(taskResult);
          continue;
        }

        if (!dryRun) {
          await updateTask(task.id, {
            due_at: deferredTo.toISOString(),
            metadata: { ...metadata, automation_last_result: 'deferred_after_hours' },
          });
        }
        results.push(taskResult);
        continue;
      }

      const { data: appointmentRaw, error: appointmentError } = await supabaseAdmin
        .from('appointments')
        .select(`
          id,
          tenant_id,
          lead_id,
          service_name,
          status,
          scheduled_start,
          scheduled_end,
          customer_notes,
          leads (
            first_name,
            last_name,
            email
          )
        `)
        .eq('id', task.source_id)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (appointmentError || !appointmentRaw) {
        taskResult.outcome = 'missing_appointment';
        if (!dryRun) {
          await updateTask(task.id, {
            status: 'completed',
            metadata: { ...metadata, automation_last_result: 'missing_appointment' },
          });
        }
        results.push(taskResult);
        continue;
      }

      const appointment = appointmentRaw as AppointmentRow;
      if (!isAppointmentActiveStatus(appointment.status)) {
        taskResult.outcome = 'inactive_appointment';
        if (!dryRun) {
          await updateTask(task.id, {
            status: 'completed',
            metadata: { ...metadata, automation_last_result: 'inactive_appointment' },
          });
        }
        results.push(taskResult);
        continue;
      }

      const appointmentStart = toDate(appointment.scheduled_start);
      if (appointmentStart && effectiveNow >= appointmentStart) {
        taskResult.outcome = 'missed_window_after_start';
        if (!dryRun) {
          await updateTask(task.id, {
            status: 'completed',
            metadata: { ...metadata, automation_last_result: 'missed_window_after_start' },
          });
        }
        results.push(taskResult);
        continue;
      }

      const suspended = await isAppointmentAutomationSuspended({
        tenantId,
        appointmentId: appointment.id,
        leadId: appointment.lead_id,
      });
      if (suspended) {
        taskResult.outcome = 'suppressed_active_suspension';
        if (!dryRun) {
          await updateTask(task.id, {
            status: 'completed',
            metadata: { ...metadata, automation_last_result: 'suppressed_active_suspension' },
          });
        }
        results.push(taskResult);
        continue;
      }

      const lead = normalizeLead(appointment.leads);
      const recipientEmail = asString(lead?.email);
      if (!recipientEmail || !recipientEmail.includes('@')) {
        taskResult.outcome = 'missing_recipient';
        if (!dryRun) {
          await updateTask(task.id, {
            status: 'completed',
            metadata: { ...metadata, automation_last_result: 'missing_recipient' },
          });
        }
        results.push(taskResult);
        continue;
      }

      const recipientName =
        [asString(lead?.first_name), asString(lead?.last_name)].filter(Boolean).join(' ') || 'Customer';
      const reminderKind = asString(metadata.automation_kind);
      const reminderLabel =
        reminderKind === 'appointment_reminder_day_before'
          ? 'Appointment Reminder'
          : 'Arrival Reminder';
      const appointmentTimeText = formatAppointmentTimeRange({
        start: appointment.scheduled_start,
        end: appointment.scheduled_end,
        timeZone: policy.timeZone,
      });

      const bodyHtml = `
        <p>Hello ${escapeHtml(recipientName)},</p>
        <p>This is your ${escapeHtml(reminderLabel.toLowerCase())} from The Vent Guys.</p>
        <p><strong>Service:</strong> ${escapeHtml(asString(appointment.service_name) || 'General Service')}</p>
        <p><strong>When:</strong> ${escapeHtml(appointmentTimeText)}</p>
        ${appointment.customer_notes ? `<p><strong>Notes:</strong> ${escapeHtml(appointment.customer_notes)}</p>` : ''}
        <p>If you need to make a change, please reply to this email or call our office before your appointment time.</p>
      `;

      if (!dryRun) {
        await sendEmail({
          from: 'The Vent Guys <info@vent-guys.com>',
          to: [recipientEmail],
          subject: `${reminderLabel}: ${asString(appointment.service_name) || 'Service Appointment'}`,
          html: renderEmailLayout({
            preheader: `${reminderLabel} from The Vent Guys`,
            title: reminderLabel,
            bodyHtml,
          }),
        });

        await updateTask(task.id, {
          status: 'completed',
          metadata: {
            ...metadata,
            automation_last_result: 'sent',
            automation_sent_at: nowIso,
          },
        });

        await logMoneyLoopEvent({
          tenantId,
          entityType: 'appointment',
          entityId: appointment.id,
          eventType: 'AppointmentReminderSent',
          actorType: actorId ? 'user' : 'system',
          actorId,
          payload: {
            task_id: task.id,
            reminder_kind: reminderKind,
            recipient_email: recipientEmail,
          },
        });
      }

      taskResult.outcome = dryRun ? 'would_send' : 'sent';
      taskResult.recipient_email = recipientEmail;
      taskResult.reminder_kind = reminderKind;
      results.push(taskResult);
    }

    return respondJson({
      success: true,
      tenant_id: tenantId,
      dry_run: dryRun,
      run_at: nowIso,
      processed: results.length,
      results,
    });
  } catch (error) {
    console.error('run-appointment-reminders failed:', error);
    const message = error instanceof Error ? error.message : 'Internal error';
    return respondJson({ error: message }, 500);
  }
});
