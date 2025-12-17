import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Loader2, ArrowRight, UserCog, ClipboardCheck } from 'lucide-react';
import { KANBAN_COLUMNS } from '@/lib/kanbanUtils';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';

const CardProgressionModal = ({ 
    isOpen, 
    onClose, 
    entityId, 
    entityType = 'lead', 
    currentStageId,
    targetStageId, 
    onSuccess 
}) => {
    const [targetStage, setTargetStage] = useState(targetStageId || '');
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);
    
    // Tech Assignment State
    const [technicians, setTechnicians] = useState([]);
    const [selectedTech, setSelectedTech] = useState('');
    const [workOrderNumber, setWorkOrderNumber] = useState('');

    const { toast } = useToast();
    const { user } = useSupabaseAuth();

    // Effect: Update target stage if prop changes
    useEffect(() => {
        if (targetStageId) setTargetStage(targetStageId);
    }, [targetStageId]);

    // Effect: Fetch technicians if moving to In Progress
    useEffect(() => {
        if (targetStage === 'col_in_progress') {
            const fetchTechs = async () => {
                const { data } = await supabase.from('technicians').select('id, full_name').eq('is_active', true);
                if (data) setTechnicians(data);
            };
            fetchTechs();
            
            // Auto-generate WO number suggestion
            const dateStr = new Date().toISOString().slice(0,10).replace(/-/g,'');
            const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
            setWorkOrderNumber(`WO-${dateStr}-${random}`);
        }
    }, [targetStage]);

    const currentStageName = KANBAN_COLUMNS.find(c => c.id === currentStageId)?.title || 'Current Stage';

    const handleConfirm = async () => {
        if (!targetStage) return;
        setLoading(true);
        try {
            // 1. Log Event
            await supabase.from('kanban_status_events').insert({
                entity_type: entityType,
                entity_id: entityId,
                from_stage: currentStageId,
                to_stage: targetStage,
                actor_id: user?.id,
                metadata: { notes, source: 'manual_progression_modal' }
            });

            // 2. Determine Update Logic
            if (entityType === 'lead') {
                const stageMap = { 
                    'col_new': 'new', 
                    'col_contacted': 'working', 
                    'col_visit_scheduled': 'scheduled', 
                    'col_quote_sent': 'quoted',
                    'col_dormant': 'dormant',
                    'col_ready_to_book': 'qualified',
                    'col_in_progress': 'in_progress',
                    // FIX: Add mapping for Ready To Invoice to prevent snap-back
                    'col_ready_to_invoice': 'ready_to_invoice' 
                };
                
                const updateData = { 
                    pipeline_stage: stageMap[targetStage] || 'working',
                    last_touch_at: new Date().toISOString()
                };

                // Archive logic
                if (targetStage === 'col_dormant' || targetStage === 'col_lost') {
                    updateData.status = 'archived';
                }

                await supabase.from('leads').update(updateData).eq('id', entityId);

            } else if (entityType === 'job') {
                 const jobStatusMap = {
                     'col_ready_to_book': 'pending_schedule',
                     'col_scheduled_jobs': 'scheduled', 
                     'col_visit_scheduled': 'scheduled',
                     'col_in_progress': 'in_progress',
                     'col_ready_to_invoice': 'pending_invoice',
                     'col_awaiting_payment': 'completed', 
                     'col_paid_closed': 'paid'
                 };

                 const newStatus = jobStatusMap[targetStage];
                 const updateData = { updated_at: new Date().toISOString() };

                 if (newStatus) updateData.status = newStatus;

                 // Logic for In Progress (Tech Assignment + WO)
                 if (targetStage === 'col_in_progress') {
                     if (selectedTech) updateData.technician_id = selectedTech;
                     if (workOrderNumber) updateData.job_number = workOrderNumber;
                 }

                 await supabase.from('jobs').update(updateData).eq('id', entityId);
            }

            toast({ title: "Card Moved", description: "Pipeline updated successfully." });
            if (onSuccess) onSuccess();

        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to update stage.' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[425px] w-[95vw]">
                <DialogHeader>
                    <DialogTitle>Move Card Stage</DialogTitle>
                    <DialogDescription>
                        Advance this {entityType} to the next logical step.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    {/* Visual Transition */}
                    <div className="flex items-center justify-between text-sm p-3 bg-slate-50 rounded border">
                        <span className="font-semibold text-slate-600 text-xs sm:text-sm">{currentStageName}</span>
                        <ArrowRight className="h-4 w-4 text-slate-400 mx-2" />
                        <span className="font-semibold text-blue-600 text-xs sm:text-sm truncate max-w-[120px]">
                            {KANBAN_COLUMNS.find(c => c.id === targetStage)?.title || 'Select Target...'}
                        </span>
                    </div>

                    {/* Stage Selector */}
                    <div className="space-y-2">
                        <Label>Target Stage</Label>
                        <Select value={targetStage} onValueChange={setTargetStage}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select new stage..." />
                            </SelectTrigger>
                            <SelectContent className="max-h-[200px]">
                                {KANBAN_COLUMNS.filter(c => c.id !== currentStageId).map((col) => (
                                    <SelectItem key={col.id} value={col.id}>
                                        {col.title}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Tech Assignment (Only for In Progress) */}
                    {targetStage === 'col_in_progress' && entityType === 'job' && (
                        <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 space-y-3 animate-in fade-in">
                            <div className="flex items-center gap-2 text-blue-800 font-semibold text-sm">
                                <UserCog className="w-4 h-4" />
                                <span>Assign Technician</span>
                            </div>
                            
                            <div className="space-y-2">
                                <Label className="text-xs">Select Technician</Label>
                                <Select value={selectedTech} onValueChange={setSelectedTech}>
                                    <SelectTrigger className="bg-white">
                                        <SelectValue placeholder="Select tech..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {technicians.map(tech => (
                                            <SelectItem key={tech.id} value={tech.id}>{tech.full_name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs">Work Order #</Label>
                                <div className="flex gap-2">
                                    <Input 
                                        value={workOrderNumber} 
                                        onChange={(e) => setWorkOrderNumber(e.target.value)}
                                        className="bg-white font-mono text-sm"
                                        placeholder="WO-..."
                                    />
                                    <Button variant="outline" size="icon" onClick={() => setWorkOrderNumber(`WO-${Date.now().toString().slice(-6)}`)} title="Regenerate">
                                        <ClipboardCheck className="w-4 h-4 text-slate-500" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Notes */}
                    <div className="space-y-2">
                        <Label>Progression Notes</Label>
                        <Textarea 
                            placeholder="Add context..." 
                            value={notes} 
                            onChange={(e) => setNotes(e.target.value)} 
                            className="min-h-[80px]"
                        />
                    </div>
                </div>

                <DialogFooter className="flex-col sm:flex-row gap-2">
                    <Button variant="outline" onClick={onClose} disabled={loading} className="w-full sm:w-auto">Cancel</Button>
                    <Button onClick={handleConfirm} disabled={!targetStage || loading} className="w-full sm:w-auto">
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Confirm Move
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default CardProgressionModal;