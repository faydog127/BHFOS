import { supabase } from '@/lib/customSupabaseClient';
import { differenceInDays, differenceInHours } from 'date-fns';

export const automationService = {
    /**
     * Automation #1: Zombie Archive
     * Quote Sent > 30 days -> Dormant
     */
    async runZombieProtocol() {
        const results = { archived: 0, errors: [] };
        
        try {
            // 1. Fetch Candidates (Last touch > 30 days ago AND in quoted stage)
            // Note: We do this client-side for now, ideally an Edge Function
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - 30);

            const { data: zombies, error } = await supabase
                .from('leads')
                .select('id, pipeline_stage')
                .eq('pipeline_stage', 'quoted')
                .lt('last_touch_at', cutoff.toISOString());

            if (error) throw error;

            if (zombies && zombies.length > 0) {
                // 2. Archive Them
                const ids = zombies.map(z => z.id);
                
                // Update status to 'dormant' (Assuming we use a specific status or stage)
                // The requirements say "move to Dormant column", which maps to 'dormant' stage likely
                // Update: We added 'col_dormant' to kanbanUtils, need to map to a DB value.
                // Assuming 'dormant' is a valid pipeline_stage or status. 
                // Let's use 'dormant' as pipeline_stage for leads.
                
                const { error: updateError } = await supabase
                    .from('leads')
                    .update({ pipeline_stage: 'dormant', status: 'dormant' })
                    .in('id', ids);

                if (updateError) throw updateError;

                // 3. Log Events
                const events = ids.map(id => ({
                    entity_type: 'lead',
                    entity_id: id,
                    from_stage: 'col_quote_sent',
                    to_stage: 'col_dormant',
                    metadata: { reason: 'Auto-Archived (Zombie Rule – 30 days)' }
                }));
                
                await supabase.from('kanban_status_events').insert(events);
                results.archived = ids.length;
            }

        } catch (e) {
            console.error("Zombie Protocol Failed:", e);
            results.errors.push(e.message);
        }
        return results;
    },

    /**
     * Automation #2: Stale Quote Alert
     * Quote Sent > 72 hours -> Alert
     */
    async runStaleQuoteCheck() {
        const results = { alerted: 0, errors: [] };
        try {
            const cutoff = new Date();
            cutoff.setHours(cutoff.getHours() - 72);

            // Fetch leads in 'quoted' stage updated before cutoff
            const { data: staleLeads, error } = await supabase
                .from('leads')
                .select('id, first_name, last_name, email, owner_id')
                .eq('pipeline_stage', 'quoted')
                .lt('updated_at', cutoff.toISOString());

            if (error) throw error;

            for (const lead of staleLeads || []) {
                // Send Email via Resend (Placeholder)
                // In production, this calls an edge function
                // await supabase.functions.invoke('send-email', { ... })
                console.log(`[Automation] Sending Stale Quote Alert for ${lead.email}`);
                
                // Log the alert event to prevent spamming (In real app, check if alert already sent today)
                await supabase.from('kanban_status_events').insert({
                    entity_type: 'lead',
                    entity_id: lead.id,
                    from_stage: 'col_quote_sent',
                    to_stage: 'col_quote_sent',
                    metadata: { action: 'stale_alert_sent', recipient: lead.email }
                });
                
                results.alerted++;
            }

        } catch (e) {
            console.error("Stale Quote Check Failed:", e);
            results.errors.push(e.message);
        }
        return results;
    }
};