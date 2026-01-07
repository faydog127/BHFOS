import React, { useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, Loader2, ShieldAlert, Info } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Label } from '@/components/ui/label';

const CHAOS_TYPES = [
    { value: 'HARD_COMPETITOR', label: 'Hard Competitor (Direct Rival)' },
    { value: 'GEOGRAPHIC_VAMPIRE', label: 'Geographic Vampire (Out of Area)' },
    { value: 'ETHICS_BREACH', label: 'Ethics/Safety Breach (Serious)' },
    { value: 'FINANCIAL_BLACK_HOLE', label: 'Financial Black Hole (Non-Payment)' },
    { value: 'ABUSE_PROTOCOL', label: 'Abuse Protocol (Staff Harassment)' }
];

const FlagChaosModal = ({ isOpen, onClose, partnerId, partnerName, onFlagSuccess }) => {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [chaosType, setChaosType] = useState('');
    const [notes, setNotes] = useState('');

    const handleConfirm = async () => {
        if (!partnerId) {
             toast({ variant: 'destructive', title: 'Error', description: 'No partner selected.' });
             return;
        }
        if (!chaosType || !notes) {
            toast({ variant: 'destructive', title: 'Validation Error', description: 'Please select a chaos type and add incident notes.' });
            return;
        }

        setLoading(true);
        try {
            // 1. Update Partner Status directly
            const { error: updateError } = await supabase
                .from('partner_prospects')
                .update({
                    chaos_flag: true,
                    chaos_flag_type: chaosType,
                    chaos_flag_source: 'REP',
                    notes: `[CHAOS FLAG ${new Date().toISOString().split('T')[0]}] ${notes}`, // In real app, append to notes array or separate table
                    updated_at: new Date().toISOString()
                })
                .eq('id', partnerId);

            if (updateError) throw updateError;

            // 2. Add to Blacklist (Audit Trail)
            const { error: blacklistError } = await supabase
                .from('blacklist_identifiers')
                .insert([{
                    account_id: partnerId,
                    reason: `${chaosType}: ${notes}`,
                    created_at: new Date().toISOString()
                }]);

            if (blacklistError) throw blacklistError;

            toast({ 
                title: 'Protocol Activated', 
                description: `Partner ${partnerName || ''} has been flagged and blacklisted.`,
                className: 'bg-red-600 text-white border-red-700'
            });
            
            if (onFlagSuccess) onFlagSuccess();
            setNotes('');
            setChaosType('');
            onClose();
        } catch (err) {
            console.error(err);
            toast({ variant: 'destructive', title: 'System Error', description: err.message });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !loading && onClose(open)}>
            <DialogContent className="sm:max-w-[550px] border-l-8 border-l-red-600 shadow-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-red-700 text-xl">
                        <ShieldAlert className="h-6 w-6" />
                        Flag Chaos Protocol
                    </DialogTitle>
                    <DialogDescription className="text-gray-600">
                        You are about to initiate a defensive protocol against <strong>{partnerName || 'this partner'}</strong>. 
                        This will immediately <span className="font-bold text-red-600">blacklist</span> the account and alert management.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    <div className="bg-red-50 p-3 rounded-md flex items-start gap-3 border border-red-100">
                        <Info className="h-5 w-5 text-red-600 mt-0.5" />
                        <p className="text-sm text-red-800">
                            Only use this feature for verifiable issues. "Bad vibes" are not a valid reason for a Chaos Flag. 
                            Misuse may result in disciplinary action.
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="chaos-type" className="text-sm font-medium text-gray-900">Violation Type</Label>
                        <Select onValueChange={setChaosType} value={chaosType}>
                            <SelectTrigger id="chaos-type" className="border-gray-300 focus:ring-red-500">
                                <SelectValue placeholder="Select the primary reason..." />
                            </SelectTrigger>
                            <SelectContent>
                                {CHAOS_TYPES.map(type => (
                                    <SelectItem key={type.value} value={type.value} className="cursor-pointer">
                                        {type.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    
                    <div className="space-y-2">
                        <Label htmlFor="chaos-notes" className="text-sm font-medium text-gray-900">Incident Report</Label>
                        <Textarea 
                            id="chaos-notes"
                            placeholder="Describe exactly what happened. Include names, dates, and quotes if possible..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={5}
                            className="border-gray-300 focus:border-red-500 focus:ring-red-500"
                        />
                    </div>
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="outline" onClick={() => onClose(false)} disabled={loading}>Cancel</Button>
                    <Button 
                        variant="destructive" 
                        onClick={handleConfirm} 
                        disabled={loading}
                        className="bg-red-600 hover:bg-red-700 text-white font-semibold"
                    >
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <AlertTriangle className="mr-2 h-4 w-4" />}
                        CONFIRM BLACKLIST
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default FlagChaosModal;