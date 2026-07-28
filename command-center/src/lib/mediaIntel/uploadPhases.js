/** Distinguisable upload/analysis phases (UI may simplify labels). */
export const UPLOAD_PHASE = Object.freeze({
  SELECTED: 'selected',
  QUEUED: 'queued',
  PREPARING: 'preparing',
  AWAITING_AUTHORIZATION: 'awaiting_authorization',
  UPLOADING: 'uploading',
  INTERRUPTED: 'interrupted',
  RETRYING: 'retrying',
  UPLOADED: 'uploaded',
  FINALIZING: 'finalizing',
  FINALIZED: 'finalized',
  QUEUED_FOR_ANALYSIS: 'queued_for_analysis',
  ANALYZING: 'analyzing',
  ANALYSIS_COMPLETE: 'analysis_complete',
  ANALYSIS_FAILED: 'analysis_failed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  NEEDS_RESELECT: 'needs_reselect',
});

export const TERMINAL_UPLOAD_PHASES = new Set([
  UPLOAD_PHASE.FINALIZED,
  UPLOAD_PHASE.ANALYSIS_COMPLETE,
  UPLOAD_PHASE.ANALYSIS_FAILED,
  UPLOAD_PHASE.FAILED,
  UPLOAD_PHASE.CANCELLED,
]);

/** Simplified labels for technicians. */
export const UPLOAD_PHASE_LABELS = Object.freeze({
  [UPLOAD_PHASE.SELECTED]: 'Selected',
  [UPLOAD_PHASE.QUEUED]: 'Queued',
  [UPLOAD_PHASE.PREPARING]: 'Preparing',
  [UPLOAD_PHASE.AWAITING_AUTHORIZATION]: 'Getting upload permission',
  [UPLOAD_PHASE.UPLOADING]: 'Uploading',
  [UPLOAD_PHASE.INTERRUPTED]: 'Interrupted — will retry',
  [UPLOAD_PHASE.RETRYING]: 'Retrying',
  [UPLOAD_PHASE.UPLOADED]: 'Bytes received — confirming',
  [UPLOAD_PHASE.FINALIZING]: 'Finalizing',
  [UPLOAD_PHASE.FINALIZED]: 'In the library',
  [UPLOAD_PHASE.QUEUED_FOR_ANALYSIS]: 'Awaiting analysis',
  [UPLOAD_PHASE.ANALYZING]: 'Analyzing',
  [UPLOAD_PHASE.ANALYSIS_COMPLETE]: 'Ready for review',
  [UPLOAD_PHASE.ANALYSIS_FAILED]: 'Analysis failed',
  [UPLOAD_PHASE.FAILED]: 'Failed',
  [UPLOAD_PHASE.CANCELLED]: 'Cancelled',
  [UPLOAD_PHASE.NEEDS_RESELECT]: 'Reselect this file to continue',
});

export const ERROR_LAYER = Object.freeze({
  UPLOAD_INTERRUPTED: 'upload_interrupted',
  UPLOAD_AUTHORIZATION: 'upload_authorization_failed',
  FINALIZATION: 'finalization_failed',
  ANALYSIS: 'analysis_failed',
  ANALYSIS_DISPLAY: 'analysis_result_could_not_be_loaded',
  UNSUPPORTED: 'unsupported_file',
  NETWORK: 'network',
});

export function isActiveUploadPhase(phase) {
  return [
    UPLOAD_PHASE.QUEUED,
    UPLOAD_PHASE.PREPARING,
    UPLOAD_PHASE.AWAITING_AUTHORIZATION,
    UPLOAD_PHASE.UPLOADING,
    UPLOAD_PHASE.RETRYING,
    UPLOAD_PHASE.FINALIZING,
    UPLOAD_PHASE.UPLOADED,
  ].includes(phase);
}

export function createClientUploadId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `cu_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
