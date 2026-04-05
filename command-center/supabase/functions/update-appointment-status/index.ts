import { corsHeaders } from '../_shared/cors.ts';
import { getTenantIdFromClaims, getVerifiedClaims } from '../_shared/auth.ts';
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';
import {
  closeAppointmentReminderTasks,
  isAppointmentActiveStatus,
  isAppointmentClosedStatus,
  normalizeAppointmentStatus,
  scheduleAppointmentReminderTasks,
} from '../_shared/appointmentUtils.ts';
import { logMoneyLoopEvent } from '../_shared/moneyLoopUtils.ts';

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
const asNumber = (value: unknown, fallback: number) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};
const toIso = (value: unknown) => {
  const text = asString(value);
  if (!text) return null;
  const parsed = new Date(text);
  return Number.isNaN(parsed.valueOf()) ? null : parsed.toISOString();
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return respondJson({ error: 'Method not allowed' }, 405);

  try {
    const body = await parseJson(req);
    const { claims } = await getVerifiedClaims(req);
    const tenantId = asString(body.tenant_id) || getTenantIdFromClaims(claims) || 'tvg';
    const actorId = typeof claims.sub === 'string' ? claims.sub : null;
    const appointmentId = asString(body.appointment_id) || asString(body.id);
    if (!appointmentId) return respondJson({ error: 'appointment_id is required' }, 400);

    const { data: current, error: currentError } = await supabaseAdmin
      .from('appointments')
      .select('*')
      .eq('id', appointmentId)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (currentError || !current) {
      return respondJson({ error: currentError?.message || 'Appointment not found' }, 404);
    }

    const nextStatus = normalizeAppointmentStatus(body.status || current.status);
    const nextStartIso = toIso(body.scheduled_start) || current.scheduled_start;
    const nextStart = new Date(nextStartIso);
    if (Number.isNaN(nextStart.valueOf())) {
      return respondJson({ error: 'scheduled_start must be a valid ISO datetime' }, 400);
    }

    const durationMinutes = Math.max(15, asNumber(body.duration_minutes, current.duration_minutes || 120));
    const nowIso = new Date().toISOString();
    const patch: Record<string, unknown> = {
      status: nextStatus,
      technician_id: asString(body.technician_id) || current.technician_id || null,
      customer_notes: asString(body.customer_notes) || current.customer_notes || null,
      admin_notes: asString(body.admin_notes) || current.admin_notes || null,
      service_address: asString(body.service_address) || current.service_address || null,
      reminders_enabled: body.reminders_enabled === false ? false : current.reminders_enabled !== false,
      scheduled_start: nextStartIso,
      scheduled_end: new Date(nextStart.getTime() + durationMinutes * 60_000).toISOString(),
      arrival_window_start: nextStartIso,
      arrival_window_end: new Date(nextStart.getTime() + Math.min(durationMinutes, 60) * 60_000).toISOString(),
      duration_minutes: durationMinutes,
      updated_at: nowIso,
    };

    if (isAppointmentActiveStatus(nextStatus)) {
      patch.confirmed_at = current.confirmed_at || nowIso;
      patch.confirmation_sent_at = current.confirmation_sent_at || nowIso;
    }
    if (nextStatus === 'completed') patch.completed_at = nowIso;
    if (nextStatus === 'cancelled' || nextStatus === 'no_show') patch.cancelled_at = nowIso;

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('appointments')
      .update(patch)
      .eq('id', appointmentId)
      .eq('tenant_id', tenantId)
      .select(`
        *,
        technicians ( full_name ),
        leads ( id, first_name, last_name, email, phone )
      `)
      .single();

    if (updateError || !updated) {
      return respondJson({ error: updateError?.message || 'Failed to update appointment' }, 500);
    }

    let reminderResult: Record<string, unknown> | null = null;
    if (isAppointmentActiveStatus(nextStatus) && patch.reminders_enabled !== false) {
      reminderResult = await scheduleAppointmentReminderTasks({
        tenantId,
        appointmentId,
        leadId: updated.lead_id,
        scheduledStart: patch.scheduled_start as string,
        serviceName: updated.service_name,
      });
    } else if (isAppointmentClosedStatus(nextStatus) || nextStatus === 'pending') {
      await closeAppointmentReminderTasks({
        tenantId,
        appointmentId,
        leadId: updated.lead_id,
      });
    }

    const eventType =
      nextStatus === 'completed'
        ? 'AppointmentCompleted'
        : nextStatus === 'cancelled'
          ? 'AppointmentCancelled'
          : nextStatus === 'no_show'
            ? 'AppointmentNoShow'
            : nextStatus === 'rescheduled'
              ? 'AppointmentRescheduled'
              : nextStatus === 'confirmed'
                ? 'AppointmentConfirmed'
                : 'AppointmentUpdated';

    await logMoneyLoopEvent({
      tenantId,
      entityType: 'appointment',
      entityId: appointmentId,
      eventType,
      actorType: actorId ? 'user' : 'system',
      actorId,
      payload: {
        previous_status: current.status,
        status: nextStatus,
        scheduled_start: patch.scheduled_start,
        duration_minutes: durationMinutes,
        reminder_result: reminderResult,
      },
    });

    return respondJson({
      success: true,
      appointment: updated,
      reminder_result: reminderResult,
    });
  } catch (error) {
    console.error('update-appointment-status failed:', error);
    const message = error instanceof Error ? error.message : 'Internal error';
    return respondJson({ error: message }, 500);
  }
});
