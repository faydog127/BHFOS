import { supabase } from '@/lib/customSupabaseClient';

const DEFAULT_OPERATING_HOURS = {
  monday: { isOpen: true, start: '09:00', end: '17:00' },
  tuesday: { isOpen: true, start: '09:00', end: '17:00' },
  wednesday: { isOpen: true, start: '09:00', end: '17:00' },
  thursday: { isOpen: true, start: '09:00', end: '17:00' },
  friday: { isOpen: true, start: '09:00', end: '17:00' },
  saturday: { isOpen: false, start: '10:00', end: '14:00' },
  sunday: { isOpen: false, start: '10:00', end: '14:00' },
};

const DEFAULT_BOOKING_SETTINGS = {
  operating_hours: DEFAULT_OPERATING_HOURS,
  time_zone: 'America/New_York',
  appointment_slot_duration: 60,
  appointment_buffer_time: 15,
  appointment_lead_time_hours: 24,
};

const isMissingRelationError = (error) =>
  ['42P01', 'PGRST204', 'PGRST205'].includes(error?.code) ||
  /relation .* does not exist/i.test(error?.message || '') ||
  /could not find the (table|relation) .* schema cache/i.test(error?.message || '');

const isMissingColumnError = (error) =>
  error?.code === '42703' ||
  /column .* does not exist/i.test(error?.message || '') ||
  /could not find the '.*' column/i.test(error?.message || '');

const getMissingColumnName = (error) => {
  const message = error?.message || '';
  const postgresMatch = message.match(/column "([^"]+)"/i);
  if (postgresMatch) return postgresMatch[1];
  const cacheMatch = message.match(/could not find the '([^']+)' column/i);
  return cacheMatch ? cacheMatch[1] : null;
};

const normalizeSettings = (row) => ({
  ...DEFAULT_BOOKING_SETTINGS,
  ...(row || {}),
  operating_hours: {
    ...DEFAULT_OPERATING_HOURS,
    ...((row && row.operating_hours) || {}),
  },
});

const sortByCategoryThenName = (rows) =>
  [...rows].sort((left, right) => {
    const leftCategory = String(left?.category || 'uncategorized').toLowerCase();
    const rightCategory = String(right?.category || 'uncategorized').toLowerCase();
    if (leftCategory !== rightCategory) {
      return leftCategory.localeCompare(rightCategory);
    }

    const leftName = String(left?.name || '').toLowerCase();
    const rightName = String(right?.name || '').toLowerCase();
    return leftName.localeCompare(rightName);
  });

const unwrapFunctionResult = (result, fallbackError) => {
  if (result?.error) {
    throw result.error;
  }
  if (result?.data?.error) {
    throw new Error(result.data.error);
  }
  return result?.data || fallbackError || null;
};

export const appointmentService = {
  async fetchAppointments(tenantId) {
    const { data, error } = await supabase
      .from('appointments')
      .select(`
        *,
        technicians ( full_name ),
        leads ( id, first_name, last_name, email, phone, company )
      `)
      .eq('tenant_id', tenantId)
      .order('scheduled_start', { ascending: true });

    if (error) {
      if (isMissingRelationError(error)) return [];
      throw error;
    }

    return data || [];
  },

  async fetchCustomers(tenantId) {
    const baseQuery = supabase
      .from('leads')
      .select('id, first_name, last_name, email, phone, company, created_at, updated_at, is_test_data')
      .eq('tenant_id', tenantId)
      .order('updated_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(250);

    let { data, error } = await baseQuery.or('is_test_data.eq.false,is_test_data.is.null');

    if (error && isMissingColumnError(error)) {
      const fallback = await supabase
        .from('leads')
        .select('id, first_name, last_name, email, phone, company, created_at, updated_at')
        .eq('tenant_id', tenantId)
        .order('updated_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(250);

      data = fallback.data;
      error = fallback.error;
    }

    if (error) throw error;
    return data || [];
  },

  async fetchServices(tenantId) {
    const tenantIds = Array.from(new Set(['default', tenantId].filter(Boolean)));
    const { data, error } = await supabase
      .from('price_book')
      .select('id, tenant_id, code, name, category, base_price, price_type, description, active')
      .eq('active', true)
      .in('tenant_id', tenantIds)
      .order('name', { ascending: true });

    if (error) throw error;

    const sorted = [...(data || [])].sort((left, right) => {
      const leftRank = left?.tenant_id === tenantId ? 0 : 1;
      const rightRank = right?.tenant_id === tenantId ? 0 : 1;
      if (leftRank !== rightRank) return leftRank - rightRank;
      return String(left?.name || '').localeCompare(String(right?.name || ''));
    });

    const deduped = [];
    const seenKeys = new Set();
    sorted.forEach((row) => {
      const key = row?.code || row?.id;
      if (seenKeys.has(key)) return;
      seenKeys.add(key);
      deduped.push(row);
    });

    return sortByCategoryThenName(deduped);
  },

  async fetchTechnicians() {
    const { data, error } = await supabase
      .from('technicians')
      .select('id, user_id, full_name, phone, email, is_active, is_primary_default')
      .eq('is_active', true)
      .order('full_name', { ascending: true });

    if (error) {
      if (isMissingRelationError(error)) return [];
      throw error;
    }

    return data || [];
  },

  async fetchBusinessSettings(tenantId) {
    try {
      const { data, error } = await supabase
        .from('business_settings')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        if (isMissingRelationError(error)) return normalizeSettings(null);
        throw error;
      }

      if (data) return normalizeSettings(data);

      const { data: fallback, error: fallbackError } = await supabase
        .from('business_settings')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fallbackError) {
        if (isMissingRelationError(fallbackError)) return normalizeSettings(null);
        throw fallbackError;
      }

      return normalizeSettings(fallback || null);
    } catch (error) {
      if (isMissingRelationError(error)) return normalizeSettings(null);
      throw error;
    }
  },

  async createCustomer(payload, tenantId) {
    const insertPayload = {
      tenant_id: tenantId,
      first_name: payload.first_name,
      last_name: payload.last_name,
      email: payload.email || null,
      phone: payload.phone || null,
      company: payload.company || null,
      service: payload.service || null,
      source: payload.source || 'appointment_scheduler',
      status: payload.status || 'new',
      pipeline_stage: payload.pipeline_stage || 'new',
      created_at: new Date().toISOString(),
    };

    let { data, error } = await supabase.from('leads').insert(insertPayload).select().single();

    if (error && isMissingColumnError(error) && getMissingColumnName(error) === 'pipeline_stage') {
      const fallbackPayload = {
        ...insertPayload,
        stage: insertPayload.pipeline_stage,
      };
      delete fallbackPayload.pipeline_stage;

      const fallback = await supabase.from('leads').insert(fallbackPayload).select().single();
      data = fallback.data;
      error = fallback.error;
    }

    if (error) throw error;
    return data;
  },

  async createAppointment(payload, tenantId) {
    const result = await supabase.functions.invoke('create-appointment', {
      body: {
        tenant_id: tenantId,
        ...payload,
      },
    });

    return unwrapFunctionResult(result);
  },

  async updateAppointmentStatus(appointmentId, payload, tenantId) {
    const result = await supabase.functions.invoke('update-appointment-status', {
      body: {
        tenant_id: tenantId,
        appointment_id: appointmentId,
        ...payload,
      },
    });

    return unwrapFunctionResult(result);
  },
};
