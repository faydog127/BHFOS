import { supabase } from '@/lib/customSupabaseClient';

const GOOGLE_API_KEY = "AIzaSyDHNy0fQ_XBwuXQKlVIkwn_IMnactNS5rQ"; // Reusing key from console

/**
 * Retrieves a cached home image URL for a lead, or generates/caches a new one using Google Street View.
 * Implements Option 1 Caching Strategy.
 * 
 * @param {string} leadId - The UUID of the lead
 * @param {string} [fallbackAddress] - Address to use if database fields are missing (useful for first run)
 * @returns {Promise<string|null>} The image URL or null if generation failed
 */
export async function getOrCreateHomeImageUrlForLead(leadId, fallbackAddress = null) {
    try {
        if (!leadId) return null;

        // 1. Validate UUID to prevent errors with mock data IDs
        const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(leadId);
        
        if (!isValidUUID) {
            // For mock leads, just return the generated URL directly without caching logic
            if (fallbackAddress) {
                return `https://maps.googleapis.com/maps/api/streetview?size=600x300&location=${encodeURIComponent(fallbackAddress)}&key=${GOOGLE_API_KEY}`;
            }
            return null;
        }

        // 2. Fetch lead details
        const { data: lead, error: fetchError } = await supabase
            .from('leads')
            .select('id, google_place_id, latitude, longitude, home_image_url, home_image_source')
            .eq('id', leadId)
            .single();

        if (fetchError) {
            console.error('Error fetching lead for image cache:', fetchError);
            return null;
        }

        // 3. Return cached URL if exists
        if (lead.home_image_url) {
            return lead.home_image_url;
        }

        // 4. Check for reusable cached image from another lead (by google_place_id)
        if (lead.google_place_id) {
            const { data: existingCache } = await supabase
                .from('leads')
                .select('home_image_url')
                .eq('google_place_id', lead.google_place_id)
                .not('home_image_url', 'is', null)
                .limit(1)
                .maybeSingle();

            if (existingCache?.home_image_url) {
                // Reuse the found URL for the current lead
                await supabase
                    .from('leads')
                    .update({ 
                        home_image_url: existingCache.home_image_url,
                        home_image_source: 'reused-cache' 
                    })
                    .eq('id', leadId);
                
                return existingCache.home_image_url;
            }
        }

        // 5. Construct Google Street View URL
        let locationParam = null;
        if (lead.google_place_id) {
            locationParam = `pano=${lead.google_place_id}`; // Or try place_id directly if API supports, usually requires coords or pano
        } else if (lead.latitude && lead.longitude) {
            locationParam = `${lead.latitude},${lead.longitude}`;
        } else if (fallbackAddress) {
            locationParam = encodeURIComponent(fallbackAddress);
        }

        if (!locationParam) {
            console.warn('No location data available to generate street view for lead:', leadId);
            return null;
        }

        const newImageUrl = `https://maps.googleapis.com/maps/api/streetview?size=600x300&location=${locationParam}&key=${GOOGLE_API_KEY}`;

        // 6. Cache the new URL
        // Note: In a real production app, we might fetch the image blob and upload to storage bucket here
        // to strictly follow "caching" of the asset itself, but for this implementation "caching the URL"
        // is the requested Option 1 behavior.
        await supabase
            .from('leads')
            .update({
                home_image_url: newImageUrl,
                home_image_source: 'google-street-view'
            })
            .eq('id', leadId);

        // TODO: Integration point for AI Vision Analysis
        // Future implementation will trigger an edge function here to:
        // 1. Send `newImageUrl` to Claude Vision / OpenAI Vision
        // 2. Detect: home_is_two_story, dryer_vent_roof_exit, is_multi_unit, dryer_vent_has_screen
        // 3. Store results in `ai_property_insights` table
        // 4. These insights will populate the "Suggestions" in the UI

        return newImageUrl;

    } catch (error) {
        console.error('Unexpected error in getOrCreateHomeImageUrlForLead:', error);
        return null;
    }
}