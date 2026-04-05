import { supabase } from '@/lib/customSupabaseClient';
import {
  computeFallbackOperationalState,
  defaultPaymentTermsForCustomerType,
  normalizeWorkOrderCustomerType,
  normalizeWorkOrderPaymentTerms,
} from '@/lib/workOrderOperational';

const VIEW_SELECT = `
  id,
  tenant_id,
  status,
  payment_status,
  scheduled_start,
  scheduled_end,
  service_address,
  technician_id,
  updated_at,
  completed_at,
  total_amount,
  work_order_number,
  job_number,
  quote_id,
  quote_number,
  lead_id,
  created_at,
  payment_terms,
  customer_type_snapshot,
  operational_stage,
  operational_sort,
  due_at,
  is_overdue,
  overdue_reason,
  next_action_label,
  latest_invoice_id,
  latest_invoice_status,
  latest_invoice_number,
  latest_invoice_due_date,
  latest_invoice_balance_due,
  lead_first_name,
  lead_last_name,
  lead_phone,
  lead_email
`;

const attachLeadShape = (row) => ({
  ...row,
  leads: row.leads || {
    first_name: row.lead_first_name || '',
    last_name: row.lead_last_name || '',
    phone: row.lead_phone || '',
    email: row.lead_email || '',
    service: row.lead_service || '',
  },
  payment_terms:
    normalizeWorkOrderPaymentTerms(row.payment_terms) ||
    defaultPaymentTermsForCustomerType(row.customer_type_snapshot),
  customer_type_snapshot:
    normalizeWorkOrderCustomerType(row.customer_type_snapshot) || 'residential',
});

const mapViewRow = (row) => attachLeadShape(row);

const mapFallbackRow = (row) => {
  const fallback = computeFallbackOperationalState(row);
  return attachLeadShape({
    ...row,
    ...fallback,
    latest_invoice_id: null,
    latest_invoice_status: null,
    latest_invoice_number: null,
    latest_invoice_due_date: null,
    latest_invoice_balance_due: null,
  });
};

const mergeLeadServices = (rows = [], leadRows = []) => {
  if (!rows.length || !leadRows.length) return rows;

  const leadMap = new Map(
    leadRows.map((lead) => [lead.id, lead]),
  );

  return rows.map((row) => {
    const lead = leadMap.get(row.lead_id);
    if (!lead) return row;

    return attachLeadShape({
      ...row,
      lead_service: lead.service || row.lead_service || '',
      leads: {
        ...(row.leads || {}),
        first_name: row.leads?.first_name || row.lead_first_name || lead.first_name || '',
        last_name: row.leads?.last_name || row.lead_last_name || lead.last_name || '',
        phone: row.leads?.phone || row.lead_phone || lead.phone || '',
        email: row.leads?.email || row.lead_email || lead.email || '',
        service: row.leads?.service || row.lead_service || lead.service || '',
      },
    });
  });
};

export const workOrderBoardService = {
  async fetchWorkOrders(tenantId) {
    if (!tenantId) throw new Error('Missing tenant id.');

    const viewQuery = await supabase
      .from('job_operational_state_v1')
      .select(VIEW_SELECT)
      .eq('tenant_id', tenantId)
      .order('is_overdue', { ascending: false })
      .order('operational_sort', { ascending: true })
      .order('due_at', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false });

    if (!viewQuery.error) {
      const viewRows = (viewQuery.data || []).map(mapViewRow);
      const leadIds = [...new Set(viewRows.map((row) => row.lead_id).filter(Boolean))];

      if (leadIds.length === 0) {
        return viewRows;
      }

      const leadQuery = await supabase
        .from('leads')
        .select('id, first_name, last_name, phone, email, service')
        .in('id', leadIds);

      if (leadQuery.error) {
        return viewRows;
      }

      return mergeLeadServices(viewRows, leadQuery.data || []);
    }

    const fallbackQuery = await supabase
      .from('jobs')
      .select(`
        *,
        leads (first_name, last_name, phone, email, service)
      `)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (fallbackQuery.error) {
      throw fallbackQuery.error;
    }

    return (fallbackQuery.data || []).map(mapFallbackRow);
  },
};
