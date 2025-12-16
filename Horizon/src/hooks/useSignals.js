import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { invoke } from '@/lib/api';

export function useSignals(orgName, leadId, limit = 8) {
    const [signals, setSignals] = useState([]);
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();

    const fetchDbSignals = useCallback(async () => {
        if (!leadId) {
            setSignals([]);
            return;
        }
        setLoading(true);
        // NOTE: We assume 'signals' table has a public read policy
        try {
            const { data, error } = await supabase
                .from('signals')
                .select('signal_type, severity, summary, source_domain, source_url, collected_at')
                .eq('lead_id', leadId)
                .order('collected_at', { ascending: false })
                .limit(limit);

            if (error) throw error;
            setSignals(data || []);
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Error fetching signals',
                description: 'Could not load signals. RLS policy might be missing for anon users.',
            });
            setSignals([]);
        } finally {
            setLoading(false);
        }
    }, [leadId, limit, toast]);

    const refetchSignals = useCallback(async () => {
        if (!orgName || !leadId) return;

        setLoading(true);
        try {
            const { ok, data, error } = await invoke('acquire-signals', {
                body: {
                    org_name: orgName,
                    city: "FL", // Placeholder
                    state: "FL",
                    lead_id: leadId,
                    mode: "live"
                }
            });

            if (!ok) throw new Error(error);

            toast({
                title: "Intel Acquired",
                description: `${data.inserted} new signals found.`,
            });
            await fetchDbSignals();

        } catch (error) {
            console.error('Error acquiring signals:', error);
            toast({
                title: "Error Acquiring Intel",
                description: error.message,
                variant: "destructive",
            });
            await fetchDbSignals();
        } finally {
            setLoading(false);
        }
    }, [orgName, leadId, toast, fetchDbSignals]);

    useEffect(() => {
        fetchDbSignals();
    }, [fetchDbSignals]);

    return { signals, loading, refetchSignals };
}