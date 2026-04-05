import { supabase } from '@/lib/customSupabaseClient';
import { getDispatchAddressValidation } from '@/lib/dispatchAddress';
import { getTenantId } from '@/lib/tenantUtils';
import { normalizeJobStatus, normalizePaymentStatus } from '@/lib/jobStatus';
import { defaultPaymentTermsForCustomerType } from '@/lib/workOrderOperational';

/**
 * Service to handle Job Lifecycle and Workflow Transitions
 * Implements TVG Workflow v3.0
 */
const sanitizePatch = (patch = {}) =>
  Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined));

const isLocalSupabaseUrl = (value) => /127\.0\.0\.1|localhost/i.test(String(value || ''));

const hasLocalFunctionAuthFailure = (error) =>
  /jwks\.json|connection refused|error sending request for url/i.test(String(error?.message || ''));

const findLocalSchedulingConflict = async (jobId, tenantId, mergedPatch) => {
  if (!mergedPatch?.technician_id || !mergedPatch?.scheduled_start || !mergedPatch?.scheduled_end) {
    return null;
  }

  const { data, error } = await supabase
    .from('jobs')
    .select('id, work_order_number, scheduled_start, scheduled_end, status')
    .eq('tenant_id', tenantId)
    .eq('technician_id', mergedPatch.technician_id)
    .neq('id', jobId)
    .in('status', ['scheduled', 'en_route', 'in_progress', 'on_hold']);

  if (error) throw error;

  const nextStart = new Date(mergedPatch.scheduled_start).getTime();
  const nextEnd = new Date(mergedPatch.scheduled_end).getTime();

  return (data || []).find((row) => {
    const existingStart = new Date(row.scheduled_start).getTime();
    const existingEnd = new Date(row.scheduled_end).getTime();
    return existingStart < nextEnd && existingEnd > nextStart;
  }) || null;
};

const updateWorkOrderLocally = async (jobId, nextPatch, tenantId) => {
  const { data: existingJob, error: existingJobError } = await supabase
    .from('jobs')
    .select('id, status, scheduled_start, scheduled_end, service_address, technician_id')
    .eq('id', jobId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (existingJobError) throw existingJobError;
  if (!existingJob) throw new Error('Work order not found.');

  const mergedPatch = {
    ...existingJob,
    ...nextPatch,
  };

  if (['scheduled', 'en_route', 'in_progress'].includes(String(mergedPatch.status || '').toLowerCase())) {
    if (!mergedPatch.scheduled_start) {
      throw new Error('Scheduled start is required before dispatching this work order.');
    }
    const addressValidation = getDispatchAddressValidation(mergedPatch.service_address);
    if (!addressValidation.hasDispatchableAddress) {
      throw new Error('Service address must include street, city, and state before dispatching this work order.');
    }
  }

  const conflict = await findLocalSchedulingConflict(jobId, tenantId, mergedPatch);
  if (conflict) {
    throw new Error(`Scheduling conflict with ${conflict.work_order_number || 'another work order'} (${conflict.status || 'scheduled'}).`);
  }

  const { data, error } = await supabase
    .from('jobs')
    .update(nextPatch)
    .eq('id', jobId)
    .eq('tenant_id', tenantId)
    .select()
    .single();

  if (error) throw error;

  return {
    success: true,
    job: data,
    invoice: null,
    invoiceResult: null,
  };
};

export const jobService = {
  async updateWorkOrder(jobId, patch, tenantId = getTenantId()) {
    try {
      if (!jobId) throw new Error('Missing work order id.');
      if (!tenantId) throw new Error('Missing tenant id.');

      const nextPatch = sanitizePatch({
        ...patch,
        status: Object.prototype.hasOwnProperty.call(patch || {}, 'status')
          ? normalizeJobStatus(patch.status)
          : undefined,
        payment_status: Object.prototype.hasOwnProperty.call(patch || {}, 'payment_status')
          ? normalizePaymentStatus(patch.payment_status)
          : undefined,
        updated_at: patch?.updated_at ?? new Date().toISOString(),
      });

      const { data, error } = await supabase.functions.invoke('work-order-update', {
        body: {
          job_id: jobId,
          tenant_id: tenantId,
          patch: nextPatch,
        },
      });

      if (error) {
        const response = error?.context;
        if (response && typeof response === 'object') {
          try {
            let details = null;
            if (typeof response.json === 'function') {
              details = await response.json();
            } else if (typeof response.text === 'function') {
              const text = await response.text();
              details = text ? { error: text } : null;
            }

            if (details?.error) {
              throw new Error(details.error);
            }
          } catch (parseError) {
            if (parseError instanceof Error && parseError.message) {
              throw parseError;
            }
          }
        }

        if (isLocalSupabaseUrl(import.meta.env.VITE_SUPABASE_URL) && hasLocalFunctionAuthFailure(error)) {
          return await updateWorkOrderLocally(jobId, nextPatch, tenantId);
        }

        throw error;
      }
      if (data?.error) throw new Error(data.error);
      if (!data?.job) throw new Error('Work order update returned no row.');

      return {
        success: true,
        job: data.job,
        invoice: data.invoice ?? null,
        invoiceResult: data.invoice_result ?? null,
      };
    } catch (error) {
      console.error('Update Work Order Failed:', error);
      return { success: false, error: error.message };
    }
  },
  
  /**
   * Create a new job from a lead
   * Transition: Lead (Any) -> Lead (Scheduled) handled by DB Trigger
   */
  async createJob({ leadId, scheduledStart, scheduledEnd, address, items, isTest = false }) {
    try {
      let customerTypeSnapshot = 'residential';
      if (leadId) {
        const leadLookup = await supabase
          .from('leads')
          .select('customer_type')
          .eq('id', leadId)
          .maybeSingle();
        customerTypeSnapshot = String(leadLookup.data?.customer_type || 'residential').toLowerCase();
      }

      // 1. Create Job Header
      const { data: job, error: jobError } = await supabase
        .from('jobs')
        .insert({
          lead_id: leadId,
          status: normalizeJobStatus('scheduled'),
          scheduled_start: scheduledStart,
          scheduled_end: scheduledEnd,
          service_address: address,
          payment_status: normalizePaymentStatus('unpaid'),
          customer_type_snapshot: customerTypeSnapshot,
          payment_terms: defaultPaymentTermsForCustomerType(customerTypeSnapshot),
          is_test_data: isTest
        })
        .select()
        .single();

      if (jobError) throw jobError;

      // 2. Create Line Items
      if (items && items.length > 0) {
        const lineItems = items.map(item => ({
          job_id: job.id,
          service_code: item.code,
          description: item.name,
          quantity: item.qty || 1,
          unit_price: item.price
        }));

        const { error: itemsError } = await supabase
          .from('job_items')
          .insert(lineItems);

        if (itemsError) throw itemsError;

        // 3. Update Job Totals
        const total = lineItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
        await supabase
          .from('jobs')
          .update({ 
            subtotal: total, 
            total_amount: total // Tax logic can be added here
          })
          .eq('id', job.id);
      }

      return { success: true, job };
    } catch (error) {
      console.error('Create Job Failed:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Mark a job as complete.
   * Completion authority lives in the work-order-update edge function.
   * It creates a draft invoice for founder review instead of auto-sending.
   */
  async completeJob(jobId, notes) {
    const result = await this.updateWorkOrder(jobId, {
        status: normalizeJobStatus('completed'),
        completed_at: new Date().toISOString(),
        technician_notes: notes,
      });

    if (!result.success) return result;

    return { success: true, data: result.job };
  },

  /**
   * Process Payment
   * Transition: Job (Unpaid) -> Job (Paid) -> Lead (Won) [via DB Trigger]
   */
  async recordPayment(jobId, invoiceId, amount, method) {
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return { success: false, error: 'Payment amount must be greater than 0.' };
    }

    if (!invoiceId) {
      return { success: false, error: 'Missing invoice for this work order. Create/open the invoice before recording payment.' };
    }

    try {
      const tenantId = getTenantId();
      const { data, error } = await supabase.functions.invoke('invoice-update-status', {
        body: {
          tenant_id: tenantId,
          invoice_id: invoiceId,
          payment_amount: numericAmount,
          payment_method: method || 'offline',
          source_screen: 'work_order',
          job_id: jobId,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      return {
        success: true,
        data: { payment_status: data?.job_payment_status || 'paid' },
        invoice: data?.invoice ?? null,
        invoiceResult: null,
      };
    } catch (error) {
      console.error('Record Payment Failed:', error);
      return { success: false, error: error?.message || 'Payment recording failed.' };
    }
  },

  /**
   * Get full job details with items and lead info
   */
  async getJobDetails(jobId) {
    const { data, error } = await supabase
      .from('jobs')
      .select(`
        *,
        job_items (*),
        leads (
          first_name,
          last_name,
          email,
          phone
        )
      `)
      .eq('id', jobId)
      .single();

    if (error) throw error;
    return data;
  }
};
