import { supabase } from '@/lib/customSupabaseClient';
import { getDispatchAddressValidation } from '@/lib/dispatchAddress';
import { getTenantId } from '@/lib/tenantUtils';
import { normalizeJobStatus, normalizePaymentStatus } from '@/lib/jobStatus';
import { defaultPaymentTermsForCustomerType } from '@/lib/workOrderOperational';
import { createMlP1S4JobExecutionService } from '@/services/mlP1S4JobExecutionService';

const s4Service = () => createMlP1S4JobExecutionService({ supabase });

const mapStatusToS4Action = (fromStatus, toStatus) => {
  const from = normalizeJobStatus(fromStatus);
  const to = normalizeJobStatus(toStatus);
  if (!to || from === to) return null;
  if (to === 'en_route') return 'on_my_way';
  if (to === 'arrived') return 'arrive';
  if (to === 'in_progress' && from === 'on_hold') return 'resume';
  if (to === 'in_progress') return 'start';
  if (to === 'on_hold') return 'pause';
  if (to === 'no_access') return 'no_access';
  if (to === 'reschedule_required') return 'request_reschedule';
  if (to === 'completion_pending') return 'complete_submit';
  if (to === 'completed') return 'complete_finalize';
  if (to === 'cancelled') return 'cancel';
  return null;
};

const updateViaS4CanonicalWriter = async (jobId, nextPatch, tenantId) => {
  const { data: existingJob, error: existingJobError } = await supabase
    .from('jobs')
    .select('id, status, scheduled_start, scheduled_end, technician_id, execution_row_version')
    .eq('id', jobId)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (existingJobError) throw existingJobError;
  if (!existingJob) throw new Error('Work order not found.');

  const svc = s4Service();
  const statusChanging =
    Object.prototype.hasOwnProperty.call(nextPatch, 'status') &&
    normalizeJobStatus(nextPatch.status) !== normalizeJobStatus(existingJob.status);
  const scheduleChanging =
    Object.prototype.hasOwnProperty.call(nextPatch, 'scheduled_start') ||
    Object.prototype.hasOwnProperty.call(nextPatch, 'scheduled_end') ||
    Object.prototype.hasOwnProperty.call(nextPatch, 'technician_id');

  if (scheduleChanging) {
    await svc.assignAndSchedule(jobId, {
      technicianId: nextPatch.technician_id ?? existingJob.technician_id,
      scheduledStart: nextPatch.scheduled_start ?? existingJob.scheduled_start,
      scheduledEnd: nextPatch.scheduled_end ?? existingJob.scheduled_end,
      reason: 'office jobService bridge',
    });
  }

  if (statusChanging) {
    const action = mapStatusToS4Action(existingJob.status, nextPatch.status);
    if (!action) {
      throw new Error(
        `ML_P1_S4_USE_CANONICAL_WRITER: unsupported status bridge ${existingJob.status} -> ${nextPatch.status}`,
      );
    }
    await svc.transition(jobId, action, {
      reason: nextPatch.reason || 'office jobService bridge',
      expectedRowVersion: null,
    });
  }

  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', jobId)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Work order not found after S4 update.');

  return {
    success: true,
    job: data,
    invoice: null,
    invoiceResult: { skipped: 'ml_p1_s4_invoice_on_complete_disabled', invoice_created: false },
  };
};

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

/** Legacy direct jobs.update path — denied under ML-P1 S4 (no independent writer). */
const updateWorkOrderLocally = async () => {
  throw new Error(
    'ML_P1_S4_ALT_WRITER_DENY: direct jobs.update is forbidden; use ml_p1_s4_* RPCs via jobService/S4 service',
  );
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

      const touchesExecution =
        Object.prototype.hasOwnProperty.call(nextPatch, 'status') ||
        Object.prototype.hasOwnProperty.call(nextPatch, 'technician_id') ||
        Object.prototype.hasOwnProperty.call(nextPatch, 'scheduled_start') ||
        Object.prototype.hasOwnProperty.call(nextPatch, 'scheduled_end');

      // ML-P1 S4: prefer canonical RPC writer for execution fields.
      if (touchesExecution) {
        try {
          return await updateViaS4CanonicalWriter(jobId, nextPatch, tenantId);
        } catch (s4Error) {
          // Fall through to edge only for non-migration local/dev diagnostics.
          if (!String(s4Error?.message || '').includes('ML_P1_S4_')) {
            console.warn('S4 writer path failed, trying edge:', s4Error);
          } else {
            throw s4Error;
          }
        }
      }

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

            if (details?.code === 'ML_P1_S4_USE_CANONICAL_WRITER') {
              return await updateViaS4CanonicalWriter(jobId, nextPatch, tenantId);
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
          return await updateViaS4CanonicalWriter(jobId, nextPatch, tenantId);
        }

        throw error;
      }
      if (data?.code === 'ML_P1_S4_USE_CANONICAL_WRITER') {
        return await updateViaS4CanonicalWriter(jobId, nextPatch, tenantId);
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
   * Mark a job as complete via ML-P1 S4 canonical writer.
   * Does not create invoices (Slice 5).
   */
  async completeJob(jobId, notes) {
    try {
      const svc = s4Service();
      if (notes) {
        await svc.upsertEvidence(jobId, { technicianNotes: notes });
      }
      const data = await svc.completeFinalize(jobId, { reason: 'jobService.completeJob' });
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
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
