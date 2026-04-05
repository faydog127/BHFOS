import { supabase } from '@/lib/customSupabaseClient';
import { getTenantId } from '@/lib/tenantUtils';

export const MONEY_LOOP_ENTITY_LABELS = {
  quote: { singular: 'proposal', plural: 'proposals' },
  job: { singular: 'work order', plural: 'work orders' },
  invoice: { singular: 'invoice', plural: 'invoices' },
};

export const moneyLoopDeleteService = {
  async deleteRecords(entityType, ids, tenantId = getTenantId()) {
    const normalizedIds = Array.from(
      new Set((Array.isArray(ids) ? ids : [ids]).map((value) => String(value || '').trim()).filter(Boolean)),
    );

    if (!entityType) {
      throw new Error('Entity type is required.');
    }

    if (!tenantId) {
      throw new Error('Tenant id is required.');
    }

    if (normalizedIds.length === 0) {
      throw new Error('At least one record must be selected.');
    }

    const { data, error } = await supabase.functions.invoke('money-loop-delete', {
      body: {
        entity_type: entityType,
        ids: normalizedIds,
        tenant_id: tenantId,
      },
    });

    if (error) throw error;
    if (data?.error) throw new Error(data.error);

    return data;
  },
};

