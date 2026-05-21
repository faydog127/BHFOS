import { corsHeaders } from '../_shared/cors.ts';
import { getTenantIdFromClaims, getVerifiedClaims } from '../_shared/auth.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  isAppointmentActiveStatus,
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

    let token: string;
    let claims: Awaited<ReturnType<typeof getVerifiedClaims>>['claims'];
    try {
      const verified = await getVerifiedClaims(req);
      token = verified.token;
      claims = verified.claims;
    } catch {
      return respondJson({ error: 'Unauthorized' }, 401);
    }

    const supabaseUrl = (Deno.env.get('SUPABASE_URL') ?? '').trim();
    const supabaseAnonKey = (Deno.env.get('SUPABASE_ANON_KEY') ?? '').trim();
    if (!supabaseUrl || !supabaseAnonKey) {
      return respondJson({ error: 'Missing SUPABASE_URL or SUPABASE_ANON_KEY' }, 500);
    }

    // Use the caller JWT + anon key so PostgREST enforces RLS (service_role would bypass it).
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // IMPORTANT: Do not trust client-provided tenant_id.
    const tenantFromClaims = getTenantIdFromClaims(claims);
    if (!tenantFromClaims) return respondJson({ error: 'Missing tenant claim' }, 401);
    const requestedTenantId = asString(body.tenant_id);
    if (requestedTenantId && requestedTenantId !== tenantFromClaims) {
      return respondJson({ error: 'Tenant mismatch' }, 403);
    }
    const tenantId = tenantFromClaims;
    const actorId = typeof claims.sub === 'string' ? claims.sub : null;

    const leadId = asString(body.lead_id);
    if (!leadId) return respondJson({ error: 'lead_id is required' }, 400);

    const scheduledStartIso = toIso(body.scheduled_start);
    if (!scheduledStartIso) {
      return respondJson({ error: 'scheduled_start must be a valid ISO datetime' }, 400);
    }

    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('id, email')
      .eq('id', leadId)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (leadError || !lead?.id) {
      return respondJson({ error: 'lead_id is invalid' }, 400);
    }

    const durationMinutes = Math.max(15, asNumber(body.duration_minutes, 120));
    const scheduledStart = new Date(scheduledStartIso);
    const scheduledEndIso = new Date(scheduledStart.getTime() + durationMinutes * 60_000).toISOString();
    const arrivalWindowEndIso = new Date(
      scheduledStart.getTime() + Math.min(durationMinutes, 60) * 60_000,
    ).toISOString();

    const priceBookId = asString(body.price_book_id) || null;
    let priceBook: Record<string, unknown> | null = null;
    if (priceBookId) {
      const { data, error } = await supabase
        .from('price_book')
        .select('id, code, name, category, base_price, price_type, description, active')
        .eq('id', priceBookId)
        .maybeSingle();

      if (error || !data) {
        return respondJson({ error: 'price_book_id is invalid' }, 400);
      }
      priceBook = data as Record<string, unknown>;
    }

    const status = normalizeAppointmentStatus(body.status);
    const serviceName = asString(body.service_name) || asString(priceBook?.name) || 'General Service';
    const serviceCategory = asString(body.service_category) || asString(priceBook?.category) || null;
    const pricingSnapshot = {
      code: asString(priceBook?.code) || null,
      name: serviceName,
      category: serviceCategory,
      price: typeof priceBook?.base_price === 'number' ? priceBook.base_price : Number(priceBook?.base_price || 0),
      price_type: asString(priceBook?.price_type) || null,
      description: asString(priceBook?.description) || null,
      captured_at: new Date().toISOString(),
    };

    const nowIso = new Date().toISOString();
    const payload: Record<string, unknown> = {
      tenant_id: tenantId,
      lead_id: leadId,
      technician_id: asString(body.technician_id) || null,
      price_book_id: priceBookId,
      service_name: serviceName,
      service_category: serviceCategory,
      pricing_snapshot: pricingSnapshot,
      scheduled_start: scheduledStartIso,
      scheduled_end: scheduledEndIso,
      arrival_window_start: scheduledStartIso,
      arrival_window_end: arrivalWindowEndIso,
      duration_minutes: durationMinutes,
      status,
      service_address: asString(body.service_address) || null,
      customer_notes: asString(body.customer_notes) || null,
      admin_notes: asString(body.admin_notes) || null,
      reminders_enabled: body.reminders_enabled !== false,
      created_at: nowIso,
      updated_at: nowIso,
    };

    // Server-side conflict check (do not rely on UI-only overlap prevention).
    // DB-level trigger also enforces overlap protection; this is for a clearer error response.
    const technicianId = asString(payload.technician_id);
    if (technicianId) {
      const { data: conflictRows, error: conflictError } = await supabase
        .from('appointments')
        .select('id, scheduled_start, scheduled_end, status, leads(first_name,last_name,email)')
        .eq('tenant_id', tenantId)
        .eq('technician_id', technicianId)
        .lt('scheduled_start', scheduledEndIso)
        .gt('scheduled_end', scheduledStartIso)
        .order('scheduled_start', { ascending: true })
        .limit(5);

      if (!conflictError && Array.isArray(conflictRows) && conflictRows.length) {
        const blocking = conflictRows.find((row) => {
          const normalized = normalizeAppointmentStatus((row as Record<string, unknown>).status);
          return !['cancelled', 'completed', 'no_show'].includes(normalized);
        });

        if (blocking) {
          return respondJson(
            {
              error: 'Scheduling conflict with another appointment for this technician.',
              conflict: blocking,
            },
            409,
          );
        }
      }
    }

    if (isAppointmentActiveStatus(status)) {
      payload.confirmed_at = nowIso;
      payload.confirmation_sent_at = nowIso;
    }

    const { data: appointment, error: insertError } = await supabase
      .from('appointments')
      .insert(payload)
      .select(`
        *,
        technicians ( full_name ),
        leads ( id, first_name, last_name, email, phone )
      `)
      .single();

    if (insertError || !appointment) {
      const rawMessage = String(insertError?.message || '');
      if (/scheduling conflict/i.test(rawMessage) || /overlap/i.test(rawMessage)) {
        return respondJson({ error: 'Scheduling conflict with another appointment for this technician.' }, 409);
      }
      return respondJson({ error: insertError?.message || 'Failed to create appointment' }, 500);
    }

    let reminderResult: Record<string, unknown> | null = null;
    if (isAppointmentActiveStatus(status) && payload.reminders_enabled !== false) {
      reminderResult = await scheduleAppointmentReminderTasks({
        tenantId,
        appointmentId: appointment.id,
        leadId,
        scheduledStart: scheduledStartIso,
        serviceName,
      });
    }

    await logMoneyLoopEvent({
      tenantId,
      entityType: 'appointment',
      entityId: appointment.id,
      eventType: 'AppointmentCreated',
      actorType: actorId ? 'user' : 'system',
      actorId,
      payload: {
        lead_id: leadId,
        status,
        scheduled_start: scheduledStartIso,
        duration_minutes: durationMinutes,
        service_name: serviceName,
        technician_id: payload.technician_id,
      },
    });

    if (isAppointmentActiveStatus(status)) {
      await logMoneyLoopEvent({
        tenantId,
        entityType: 'appointment',
        entityId: appointment.id,
        eventType: 'AppointmentConfirmed',
        actorType: actorId ? 'user' : 'system',
        actorId,
        payload: {
          lead_id: leadId,
          scheduled_start: scheduledStartIso,
          reminder_result: reminderResult,
        },
      });
    }

    return respondJson({
      success: true,
      appointment,
      reminder_result: reminderResult,
    });
  } catch (error) {
    console.error('create-appointment failed:', error);
    const message = error instanceof Error ? error.message : 'Internal error';
    return respondJson({ error: message }, 500);
  }
});
