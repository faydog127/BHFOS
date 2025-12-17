import { supabase } from '@/lib/customSupabaseClient';

/**
 * Service to handle Job Lifecycle and Workflow Transitions
 * Implements TVG Workflow v3.0
 */
export const jobService = {
  
  /**
   * Create a new job from a lead
   * Transition: Lead (Any) -> Lead (Scheduled) handled by DB Trigger
   */
  async createJob({ leadId, scheduledStart, scheduledEnd, address, items, isTest = false }) {
    try {
      // 1. Create Job Header
      const { data: job, error: jobError } = await supabase
        .from('jobs')
        .insert({
          lead_id: leadId,
          status: 'SCHEDULED',
          scheduled_start: scheduledStart,
          scheduled_end: scheduledEnd,
          service_address: address,
          payment_status: 'UNPAID',
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
   * Mark a job as complete and Trigger Sentiment Gate
   * Transition: Job (In Progress) -> Job (Completed) -> Sentiment Gate
   */
  async completeJob(jobId, notes) {
    // 1. Update Database
    const { data, error } = await supabase
      .from('jobs')
      .update({
        status: 'COMPLETED',
        completed_at: new Date().toISOString(),
        technician_notes: notes
      })
      .eq('id', jobId)
      .select()
      .single();

    if (error) return { success: false, error: error.message };

    // 2. Trigger Sentiment Gate (v3.0)
    try {
        const { error: funcError } = await supabase.functions.invoke('sentiment-gate', {
            body: {
                action: 'REQUEST_RATING',
                jobId: jobId,
                leadId: data.lead_id
            }
        });
        
        if (funcError) console.error("Sentiment Gate Trigger Failed:", funcError);
        
    } catch (e) {
        console.error("Error invoking sentiment-gate:", e);
    }

    return { success: true, data };
  },

  /**
   * Process Payment
   * Transition: Job (Unpaid) -> Job (Paid) -> Lead (Won) [via DB Trigger]
   */
  async recordPayment(jobId, amount, method) {
    // In a real app, this would integrate with Stripe/Square
    // Here we simulate the recording
    const { data, error } = await supabase
      .from('jobs')
      .update({
        payment_status: 'PAID',
        amount_paid: amount,
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId)
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data };
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
          phone,
          risk_tags
        )
      `)
      .eq('id', jobId)
      .single();

    if (error) throw error;
    return data;
  }
};