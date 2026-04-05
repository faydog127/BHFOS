import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Loader2, ArrowRight } from 'lucide-react';
import { KANBAN_COLUMNS } from '@/lib/kanbanUtils';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';

const CardProgressionModal = ({
  isOpen,
  onClose,
  entityId,
  entityType = 'lead',
  currentStageId,
  targetStageId,
  onSuccess,
}) => {
  const [targetStage, setTargetStage] = useState(targetStageId || '');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (targetStageId) setTargetStage(targetStageId);
  }, [targetStageId]);

  const currentStageName = KANBAN_COLUMNS.find((c) => c.id === currentStageId)?.title || 'Current Stage';

  const handleConfirm = async () => {
    if (!targetStage || !entityId) return;
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('kanban-move', {
        body: {
          entity_type: entityType,
          entity_id: entityId,
          to_column_key: targetStage,
        },
      });

      if (error || data?.error) {
        throw new Error(error?.message || data?.error || 'Failed to move card.');
      }

      toast({ title: 'Card Moved', description: 'Pipeline updated successfully.' });
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Error', description: err.message || 'Failed to update stage.' });
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
            Select the next stage for this {entityType}.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="flex items-center justify-between text-sm p-3 bg-slate-50 rounded border">
            <span className="font-semibold text-slate-600 text-xs sm:text-sm">{currentStageName}</span>
            <ArrowRight className="h-4 w-4 text-slate-400 mx-2" />
            <span className="font-semibold text-blue-600 text-xs sm:text-sm truncate max-w-[120px]">
              {KANBAN_COLUMNS.find((c) => c.id === targetStage)?.title || 'Select Target...'}
            </span>
          </div>

          <div className="space-y-2">
            <Label>Target Stage</Label>
            <Select value={targetStage} onValueChange={setTargetStage}>
              <SelectTrigger>
                <SelectValue placeholder="Select new stage..." />
              </SelectTrigger>
              <SelectContent className="max-h-[200px]">
                {KANBAN_COLUMNS.filter((c) => c.id !== currentStageId).map((col) => (
                  <SelectItem key={col.id} value={col.id}>
                    {col.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
