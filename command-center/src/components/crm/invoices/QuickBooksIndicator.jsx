import React, { useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, CheckCircle2, AlertTriangle, CloudOff } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const QuickBooksIndicator = ({ invoiceId, status, qbId, onSyncComplete }) => {
    const { toast } = useToast();
    const [syncing, setSyncing] = useState(false);

    const handleSync = async (e) => {
        e.stopPropagation(); // Prevent row click
        setSyncing(true);
        try {
            const { data, error } = await supabase.functions.invoke('quickbooks-sync', {
                body: { entity: 'invoice', id: invoiceId, action: 'sync' }
            });

            if (error || (data && !data.success)) {
                throw new Error(error?.message || data?.error || "Sync failed");
            }

            toast({ title: "Sync Successful", description: "Invoice updated in QuickBooks." });
            if (onSyncComplete) onSyncComplete();
        } catch (err) {
            console.error("QB Sync Error:", err);
            toast({ variant: "destructive", title: "Sync Failed", description: err.message });
        } finally {
            setSyncing(false);
        }
    };

    if (status === 'synced' && qbId) {
        return (
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger>
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 flex gap-1 items-center">
                            <CheckCircle2 className="w-3 h-3" /> Synced
                        </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>QB ID: {qbId}</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        );
    }

    if (status === 'failed') {
        return (
            <Button size="sm" variant="ghost" className="h-6 px-2 text-red-600 bg-red-50 hover:bg-red-100 border border-red-200" onClick={handleSync} disabled={syncing}>
                {syncing ? <Loader2 className="w-3 h-3 animate-spin"/> : <AlertTriangle className="w-3 h-3 mr-1"/>}
                Retry
            </Button>
        );
    }

    // Default / Pending / Not Synced
    return (
        <Button size="sm" variant="ghost" className="h-6 px-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50" onClick={handleSync} disabled={syncing}>
            {syncing ? <Loader2 className="w-3 h-3 animate-spin"/> : <RefreshCw className="w-3 h-3 mr-1"/>}
            Sync
        </Button>
    );
};

export default QuickBooksIndicator;