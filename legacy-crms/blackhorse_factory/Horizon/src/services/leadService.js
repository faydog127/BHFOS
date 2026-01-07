import { supabase } from '@/lib/supabaseClient';
import { sanitizeInput, checkRateLimit } from '@/lib/security';

export const leadService = {
  /**
   * Checks if a booking conflict exists (Address/Email overlap)
   */
  async checkConflict(address, email) {
      if (!address || !email) return { conflict: null };
      
      try {
          const { data, error } = await supabase.functions.invoke('web-wizard-processor', {
            body: { 
                action: 'check_conflict',
                property: { address: sanitizeInput(address) },
                contact: { email: email.trim() }
            },
            method: 'POST'
          });
          
          if (error) throw error;
          return data; // { conflict: 'same_person' | 'different_person' | null, lead: ... }
      } catch (e) {
          console.error("Conflict check failed:", e);
          return { conflict: null }; // Fail open
      }
  },

  /**
   * Submits a lead to the processing edge function.
   * @param {Object} data - The raw form data from React state
   * @param {string} formId - ID for rate limiting
   * @param {string} resolution - 'update', 'add_contact', or null
   */
  async submitLead(data, formId = 'general', resolution = null) {
    // 1. Rate Check
    if (!checkRateLimit(formId, 3000)) {
      return { success: false, error: 'Please wait a moment before submitting again.' };
    }

    try {
      // 2. Prepare Payload (Data Transformation Layer)
      
      const payload = {
        action: formId === 'wizard_full' ? 'full' : 'partial',
        conflict_resolution: resolution, // Pass the resolution strategy
        
        // CONTACT OBJECT
        contact: {
            firstName: sanitizeInput(data.first_name || data.firstName || data.fullName?.split(' ')[0]), 
            lastName: sanitizeInput(data.last_name || data.lastName || data.fullName?.split(' ').slice(1).join(' ')),
            email: data.email,
            phone: data.phone,
        },
        
        // PROPERTY OBJECT
        property: {
            address: sanitizeInput(data.address), // Full formatted address string
            street: sanitizeInput(data.street),
            city: sanitizeInput(data.city),
            state: sanitizeInput(data.state),
            zip: sanitizeInput(data.zip),
            houseType: data.propertyType || data.property_type || 'Single-family', 
            ventCount: parseInt(data.vent_count || data.ventCount || 0)
        },
        
        // OPTIONAL METADATA
        hvac: data.hvac || {},
        health: data.health || {},
        
        // SOURCE DETAILS
        source_details: {
            source_kind: data.source_kind || 'WEBSITE',
            landing_page: window.location.href,
            service_type: data.service_type || data.serviceType || 'General Inquiry',
            message: sanitizeInput(data.message),
            partner_referral_code: data.partner_referral_code
        }
      };

      console.log('[LeadService] Sending payload:', payload);

      // 3. Invoke Edge Function
      const { data: responseData, error: apiError } = await supabase.functions.invoke('web-wizard-processor', {
        body: payload,
        method: 'POST'
      });

      if (apiError) {
        console.error('[LeadService] API Error:', apiError);
        let userMsg = 'Connection error. Please try again.';
        if (apiError.message) userMsg = `Server error: ${apiError.message}`;
        return { success: false, error: userMsg };
      }
      
      return { success: true, data: responseData };

    } catch (error) {
      console.error('[LeadService] Client Error:', error);
      return { success: false, error: error.message || 'An unexpected error occurred.' };
    }
  }
};