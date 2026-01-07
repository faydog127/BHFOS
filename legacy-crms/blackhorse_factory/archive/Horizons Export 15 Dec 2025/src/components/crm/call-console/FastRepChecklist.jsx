import React, { useState, useEffect } from 'react';
import { ClipboardCheck, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';

const FastRepChecklist = ({ lead, user, onUpdate }) => {
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);
    const [notes, setNotes] = useState('');
    const [existingChecklistId, setExistingChecklistId] = useState(null);

    useEffect(() => {
        const fetchChecklist = async () => {
            if (!lead || !user) {
                setNotes('');
                setExistingChecklistId(null);
                return;
            };

            const { data, error } = await supabase
                .from('rep_checklists')
                .select('id, notes')
                .eq('lead_id', lead.id)
                .eq('author', user.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (data) {
                setNotes(data.notes || '');
                setExistingChecklistId(data.id);
            } else {
                setNotes('');
                setExistingChecklistId(null);
            }
        };

        fetchChecklist();
    }, [lead, user]);
    
    const handleSaveChecklist = async () => {
        if (!lead || !user) return;
        setIsSaving(true);
        
        const checklistPayload = {
            lead_id: lead.id,
            notes: notes,
            author: user.id,
            // Mock data for other fields until UI is built
            why_now: 'not_set',
            fit: 'not_set',
            dm_reachable: false,
            momentum: 'not_set',
        };

        let error;
        if (existingChecklistId) {
            // Update existing checklist
            ({ error } = await supabase
                .from('rep_checklists')
                .update({ notes: notes })
                .eq('id', existingChecklistId));
        } else {
            // Insert new checklist
            ({ error } = await supabase
                .from('rep_checklists')
                .insert(checklistPayload));
        }


        if (error) {
            toast({ variant: 'destructive', title: 'Error Saving Checklist', description: error.message });
        } else {
            toast({ title: 'Checklist Saved!', description: 'Lead context has been updated.' });
            if (onUpdate) onUpdate();
        }

        setIsSaving(false);
    };

    if (!lead) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center p-4">
                <ClipboardCheck className="h-12 w-12 text-gray-300 mb-4" />
                <h3 className="text-lg font-semibold text-gray-700">No Lead Selected</h3>
                <p className="text-sm text-gray-500">Select a lead to use the checklist.</p>
            </div>
        )
    }

    return (
        <Card className="flex flex-col bg-white h-full border-0 shadow-none rounded-none">
            <CardContent className="p-4 pt-4 flex-1 flex flex-col space-y-3">
                <Textarea 
                    placeholder="Add timestamped notes, gut feelings, or next steps..." 
                    value={notes} 
                    onChange={(e) => setNotes(e.target.value)} 
                    className="flex-1 text-base" 
                    disabled={!lead || !user} 
                />
                <Button 
                    onClick={handleSaveChecklist} 
                    size="lg" 
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold" 
                    disabled={isSaving || !lead || !user}
                >
                    <Zap className="mr-2 h-5 w-5"/>
                    {isSaving ? 'Saving...' : 'Save Notes'}
                </Button>
            </CardContent>
        </Card>
    );
};

export default FastRepChecklist;