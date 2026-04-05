import { supabase } from '@/lib/customSupabaseClient';

/**
 * Send an SMS via Twilio.
 * @param {string} to - Phone number
 * @param {string} body - Message body
 * @param {boolean} isTrainingMode - GUARDRAIL
 */
export const sendSms = async (to, body, isTrainingMode = false) => {
    console.log(`[SmsService] Sending SMS to ${to}: ${body.substring(0, 20)}...`);

    if (isTrainingMode) {
        console.warn(`TRAINING MODE: SMS suppressed to ${to}`);
        return { success: true, sid: 'mock_sms_sid', status: 'sent (mock)' };
    }

    try {
        const { data, error } = await supabase.functions.invoke('send-sms', {
            body: { to, body }
        });
        if (error) throw error;
        return data;
    } catch (err) {
        console.error("SMS failed:", err);
        throw err;
    }
};