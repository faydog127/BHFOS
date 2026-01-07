
import { supabase } from '@/lib/supabaseClient';
import { sanitizeInput, checkRateLimit } from '@/lib/security';
import { getTenantId } from '@/lib/tenantUtils';

/**
 * Lead Service - Edge Function Only Version
 * 
 * Replaces direct table access with secure Edge Function calls.
 * All public lead intake now routes through 'lead-intake' function.
 */
export const leadService = {
  /**
   * Checks if a booking conflict exists (Address/Email overlap)
   */
  async checkConflict(address, email) {
      if (!address || !email) return { conflict: null };
      
      try {
          // Using lead-intake for conflict check instead of direct query
          const { data, error } = await supabase.functions.invoke('lead-intake', {
            body: { 
                type: 'check_conflict',
                payload: {
                    address: sanitizeInput(address),
                    email: email.trim(),
                    tenant_id: getTenantId()
                }
            }
          });
          
          if (error) throw error;
          return data; // { conflict: 'same_person' | 'different_person' | null }
      } catch (e) {
          console.error("Conflict check failed:", e);
          return { conflict: null }; // Fail open for user experience
      }
  },

  /**
   * Submits a lead via the 'lead-intake' Edge Function.
   * This is the SINGLE standardized entry point for all public leads.
   * NO direct DB inserts allowed here to ensure emails/notifications fire.
   * 
   * @param {Object} data - The raw form data
   * @param {string} formId - ID for rate limiting context
   * @param {string} resolution - 'update', 'add_contact', or null
   */
  async submitLead(data, formId = 'general', resolution = null) {
    // 1. Client-side Rate Limit Check
    if (!checkRateLimit(formId, 3000)) {
      return { success: false, error: 'Please wait a moment before submitting again.' };
    }

    try {
      // 2. Prepare Standardized Payload
      const payload = {
        type: 'submit_lead', // Explicit action type
        payload: {
            tenant_id: getTenantId(),
            
            // Context
            source: data.source_kind || 'WEBSITE',
            page: window.location.href,
            form_id: formId,
            conflict_resolution: resolution,
            referral_code: data.partner_referral_code,

            // Contact Information
            contact: {
                first_name: sanitizeInput(data.first_name || data.firstName || data.fullName?.split(' ')[0]), 
                last_name: sanitizeInput(data.last_name || data.lastName || data.fullName?.split(' ').slice(1).join(' ')),
                email: data.email,
                phone: data.phone,
                best_time: data.bestTime
            },
            
            // Property Information
            property: {
                formatted_address: sanitizeInput(data.address),
                street: sanitizeInput(data.street),
                city: sanitizeInput(data.city),
                state: sanitizeInput(data.state),
                zip: sanitizeInput(data.zip),
                type: data.propertyType || data.property_type || data.houseType || 'Single-family',
                sq_ft: data.sqFootage,
                access_point: data.accessPoint,
                vent_count: parseInt(data.vent_count || data.ventCount || 0)
            },

            // Service Details
            service: {
                type: data.service_type || data.serviceType || 'General Inquiry',
                message: sanitizeInput(data.message),
                intent_level: data.pqi || 50
            },
            
            // Technical/Health Metadata
            metadata: {
                hvac: data.hvac || {},
                health_risks: data.healthRisks || data.health || {},
                consent_marketing: data.consent_marketing || false
            }
        }
      };

      console.log('[LeadService] Invoking lead-intake:', payload);

      // 3. Invoke Edge Function (No Direct DB Access)
      const { data: responseData, error: apiError } = await supabase.functions.invoke('lead-intake', {
        body: payload
      });

      if (apiError) {
        console.error('[LeadService] API Error:', apiError);
        // User-friendly error mapping
        let userMsg = 'Connection error. Please try again.';
        if (apiError.message && !apiError.message.includes('FetchError')) {
             userMsg = `Server error: ${apiError.message}`;
        }
        return { success: false, error: userMsg };
      }
      
      // The function might return 200 OK but with logical errors in the body
      if (responseData && responseData.error) {
          return { success: false, error: responseData.error };
      }
      
      return { success: true, data: responseData };

    } catch (error) {
      console.error('[LeadService] Client Error:', error);
      return { success: false, error: error.message || 'An unexpected error occurred.' };
    }
  }
};
