import { apiClient } from '@/lib/apiClient';

/**
 * @typedef {'REACHED_DM' | 'VOICEMAIL' | 'QUAL_INT' | 'QUAL_NOT' | 'NO_SHOW' | 'WRONG_NUM'} ResultDbValue
 */

/**
 * @typedef {'TASK_CALL' | 'TASK_PROPOSAL' | 'TASK_EMAIL' | 'TASK_SMS' | 'TASK_SITE' | 'NO_ACTION'} NextStepDbValue
 */

/**
 * @typedef {Object} LogAndOutreachPayload
 * @property {string} lead_id - The ID of the lead.
 * @property {string} script_type - The type of script used.
 * @property {ResultDbValue} result - The result of the call.
 * @property {NextStepDbValue} next_step - The next step after the call.
 * @property {string} notes - Any notes from the call.
 * @property {string} call_state - The state of the call when logged.
 * @property {number} duration_seconds - The duration of the call in seconds.
 */

/**
 * @typedef {Object} LogAndOutreachResponse
 * @property {boolean} success - Indicates if the operation was successful.
 * @property {string} [pipeline_stage] - The updated pipeline stage, if successful.
 * @property {string} [error] - Error message if the operation failed.
 */

/**
 * Flag to enable or disable mocking of the API call.
 * @type {boolean}
 */
const IS_MOCKED = true;

/**
 * Logs a call and potentially updates the lead's pipeline stage.
 * @param {LogAndOutreachPayload} payload - The payload containing call details.
 * @returns {Promise<LogAndOutreachResponse>} A promise that resolves to a LogAndOutreachResponse.
 */
export async function logAndOutreach(payload) {
  if (IS_MOCKED) {
    // console.log('Mock logAndOutreach payload:', payload); // Commented out as requested
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500)); 
    return { success: true, pipeline_stage: 'attempting' };
  }

  try {
    const res = await apiClient.post('/calls/log-and-outreach', payload);

    if (res.error || !res.data) {
      return { success: false, error: res.error || 'Unknown error from API' };
    }

    return res.data;
  } catch (err) {
    console.error("Error in logAndOutreach API call:", err);
    return { success: false, error: err.message || 'Network error occurred.' };
  }
}