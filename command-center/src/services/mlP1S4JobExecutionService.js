/**
 * ML-P1 Slice 4 — client facade for canonical job execution RPCs.
 * No direct jobs.status writes. No invoice creation.
 */

const newMutationId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `s4-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const rpcError = (error, fallback) => {
  const err = new Error(error?.message || fallback);
  err.code = error?.code || 'ML_P1_S4_RPC_ERROR';
  err.details = error?.details;
  throw err;
};

export function createMlP1S4JobExecutionService({ supabase } = {}) {
  if (!supabase) throw new Error('mlP1S4JobExecutionService requires supabase');

  const transition = async (jobId, action, { reason = null, expectedRowVersion = null, payload = {}, clientMutationId = null } = {}) => {
    const { data, error } = await supabase.rpc('ml_p1_s4_job_transition', {
      p_job_id: jobId,
      p_action: action,
      p_client_mutation_id: clientMutationId || newMutationId(),
      p_reason: reason,
      p_expected_row_version: expectedRowVersion,
      p_payload: payload,
    });
    if (error) rpcError(error, `Transition ${action} failed`);
    return data;
  };

  return {
    transition,
    onMyWay: (jobId, opts) => transition(jobId, 'on_my_way', opts),
    arrive: (jobId, opts) => transition(jobId, 'arrive', opts),
    start: (jobId, opts) => transition(jobId, 'start', opts),
    pause: (jobId, opts) => transition(jobId, 'pause', opts),
    resume: (jobId, opts) => transition(jobId, 'resume', opts),
    noAccess: (jobId, reason, opts = {}) => transition(jobId, 'no_access', { ...opts, reason }),
    requestReschedule: (jobId, reason, opts = {}) =>
      transition(jobId, 'request_reschedule', { ...opts, reason }),
    completeSubmit: (jobId, opts) => transition(jobId, 'complete_submit', opts),
    completeFinalize: (jobId, opts) => transition(jobId, 'complete_finalize', opts),
    cancel: (jobId, reason, opts = {}) => transition(jobId, 'cancel', { ...opts, reason }),
    reopen: (jobId, reason, opts = {}) => transition(jobId, 'reopen', { ...opts, reason }),

    assignAndSchedule: async (jobId, { technicianId, scheduledStart, scheduledEnd, reason, clientMutationId } = {}) => {
      const { data, error } = await supabase.rpc('ml_p1_s4_assign_and_schedule', {
        p_job_id: jobId,
        p_technician_id: technicianId ?? null,
        p_scheduled_start: scheduledStart ?? null,
        p_scheduled_end: scheduledEnd ?? null,
        p_client_mutation_id: clientMutationId || newMutationId(),
        p_reason: reason ?? null,
      });
      if (error) rpcError(error, 'Assign/schedule failed');
      return data;
    },

    upsertEvidence: async (jobId, evidence = {}, { clientMutationId } = {}) => {
      const { data, error } = await supabase.rpc('ml_p1_s4_upsert_evidence', {
        p_job_id: jobId,
        p_client_mutation_id: clientMutationId || newMutationId(),
        p_technician_notes: evidence.technicianNotes ?? null,
        p_customer_summary: evidence.customerSummary ?? null,
        p_execution_findings: evidence.executionFindings ?? null,
        p_execution_photos: evidence.executionPhotos ?? null,
        p_execution_checklist: evidence.executionChecklist ?? null,
        p_materials_none: evidence.materialsNone ?? null,
        p_customer_ack_method: evidence.customerAckMethod ?? null,
        p_customer_ack_waiver_reason: evidence.customerAckWaiverReason ?? null,
      });
      if (error) rpcError(error, 'Evidence upsert failed');
      return data;
    },

    completionReadiness: async (jobId) => {
      const { data, error } = await supabase.rpc('ml_p1_s4_completion_readiness', {
        p_job_id: jobId,
      });
      if (error) rpcError(error, 'Completion readiness failed');
      return data;
    },

    recordMakeSafe: async (
      jobId,
      {
        actionType,
        summary,
        evidenceRefs = [],
        reasonCode,
        customerNotificationMethod,
        evidenceBeforeRef,
        evidenceAfterRef,
        clientMutationId,
      } = {},
    ) => {
      const { data, error } = await supabase.rpc('ml_p1_s4_record_make_safe', {
        p_job_id: jobId,
        p_action_type: actionType,
        p_summary: summary,
        p_client_mutation_id: clientMutationId || newMutationId(),
        p_evidence_refs: evidenceRefs,
        p_reason_code: reasonCode,
        p_customer_notification_method: customerNotificationMethod,
        p_evidence_before_ref: evidenceBeforeRef,
        p_evidence_after_ref: evidenceAfterRef,
      });
      if (error) rpcError(error, 'Make-safe record failed');
      return data;
    },

    proposeChangeOrder: async (jobId, { reason, items, pricingMode = 'price_book', submitForApproval = true, evidenceRefs = [], clientMutationId } = {}) => {
      const { data, error } = await supabase.rpc('ml_p1_s4_change_order_propose', {
        p_job_id: jobId,
        p_reason: reason,
        p_items: items,
        p_client_mutation_id: clientMutationId || newMutationId(),
        p_pricing_mode: pricingMode,
        p_submit_for_approval: submitForApproval,
        p_evidence_refs: evidenceRefs,
      });
      if (error) rpcError(error, 'Change order propose failed');
      return data;
    },

    transitionChangeOrder: async (
      changeOrderId,
      action,
      {
        reason = null,
        customerAuthProof = null,
        customerAuthEvidenceType = null,
        customerAuthEvidenceRef = null,
        customerAuthAt = null,
        clientMutationId,
      } = {},
    ) => {
      const { data, error } = await supabase.rpc('ml_p1_s4_change_order_transition', {
        p_change_order_id: changeOrderId,
        p_action: action,
        p_client_mutation_id: clientMutationId || newMutationId(),
        p_reason: reason,
        p_customer_auth_proof: customerAuthProof,
        p_customer_auth_evidence_type: customerAuthEvidenceType,
        p_customer_auth_evidence_ref: customerAuthEvidenceRef,
        p_customer_auth_at: customerAuthAt,
      });
      if (error) rpcError(error, `Change order ${action} failed`);
      return data;
    },

    correctTimeEvent: async (
      jobId,
      sourceEventId,
      { reason, correctedStartedAt = null, correctedEndedAt = null, correctedMiles = null, clientMutationId } = {},
    ) => {
      const { data, error } = await supabase.rpc('ml_p1_s4_correct_time_event', {
        p_job_id: jobId,
        p_source_event_id: sourceEventId,
        p_client_mutation_id: clientMutationId || newMutationId(),
        p_reason: reason,
        p_corrected_started_at: correctedStartedAt,
        p_corrected_ended_at: correctedEndedAt,
        p_corrected_miles: correctedMiles,
      });
      if (error) rpcError(error, 'Time correction failed');
      return data;
    },

    listChangeOrders: async (jobId, tenantId) => {
      const { data, error } = await supabase
        .from('change_orders')
        .select('id, status, reason, financial_delta_cents, pricing_mode, free_form_pricing, free_form_office_approved, approval_method, version, created_at, updated_at')
        .eq('job_id', jobId)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });
      if (error) rpcError(error, 'List change orders failed');
      return data || [];
    },
  };
}
