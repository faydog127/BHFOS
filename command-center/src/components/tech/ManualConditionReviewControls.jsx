import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

const asText = (value) => (typeof value === 'string' ? value.trim() : '');

export const isManualCondition = (finding) => Boolean(finding?.id) && !finding?.source_ai_suggestion_id;

export const manualConditionStatus = (finding) => asText(finding?.condition_status).toLowerCase() || 'draft';

const STATUS_LABELS = {
  draft: 'Draft',
  approved: 'Approved',
  rejected: 'Rejected',
  voided: 'Voided',
  not_relevant: 'Not relevant',
};

/**
 * Review controls for manual structured conditions only (no AI source).
 * Does not render for AI-backed findings.
 */
export default function ManualConditionReviewControls({
  tenantId,
  finding,
  locked = false,
  compact = false,
  onChanged,
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState('');

  if (!isManualCondition(finding)) return null;

  const status = manualConditionStatus(finding);
  const label = STATUS_LABELS[status] || status;

  const setStatus = async (nextStatus) => {
    if (!finding?.id || locked || busy) return;
    setBusy(nextStatus);
    try {
      const { error } = await supabase
        .from('inspection_findings')
        .update({
          condition_status: nextStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('tenant_id', tenantId)
        .eq('id', finding.id);
      if (error) throw error;
      toast({ title: 'Condition updated', description: `Marked ${STATUS_LABELS[nextStatus] || nextStatus}.` });
      await onChanged?.(nextStatus);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Condition update failed',
        description: error?.message || 'Could not update condition status.',
      });
    } finally {
      setBusy('');
    }
  };

  return (
    <div className={`mt-3 space-y-2 ${compact ? '' : ''}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Manual finding</span>
        <Badge variant="outline" className="capitalize text-[11px]">
          {status === 'approved' ? 'Kept' : status === 'rejected' || status === 'not_relevant' ? 'Removed' : label}
        </Badge>
      </div>
      <div className={`grid gap-2 ${compact ? 'grid-cols-1' : 'sm:grid-cols-3'}`}>
        <Button
          type="button"
          size={compact ? 'default' : 'sm'}
          className={compact ? 'min-h-11' : undefined}
          variant={status === 'approved' ? 'default' : 'outline'}
          disabled={locked || Boolean(busy) || status === 'approved'}
          onClick={() => setStatus('approved')}
          data-testid="manual-finding-keep"
        >
          {busy === 'approved' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Keep
        </Button>
        <Button
          type="button"
          size={compact ? 'default' : 'sm'}
          className={compact ? 'min-h-11' : undefined}
          variant="outline"
          disabled={locked || Boolean(busy)}
          onClick={async () => {
            const next = window.prompt('Edit finding description:', asText(finding?.description) || asText(finding?.title));
            if (next === null) return;
            setBusy('edit');
            try {
              const { error } = await supabase
                .from('inspection_findings')
                .update({
                  description: next.trim(),
                  condition_status: 'approved',
                  updated_at: new Date().toISOString(),
                })
                .eq('tenant_id', tenantId)
                .eq('id', finding.id);
              if (error) throw error;
              toast({ title: 'Finding updated', description: 'Edited wording saved and kept for the report.' });
              await onChanged?.('approved');
            } catch (error) {
              toast({
                variant: 'destructive',
                title: 'Edit failed',
                description: error?.message || 'Could not update finding.',
              });
            } finally {
              setBusy('');
            }
          }}
          data-testid="manual-finding-edit"
        >
          {busy === 'edit' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Edit
        </Button>
        <Button
          type="button"
          size={compact ? 'default' : 'sm'}
          className={compact ? 'min-h-11' : undefined}
          variant={status === 'rejected' || status === 'not_relevant' ? 'destructive' : 'outline'}
          disabled={locked || Boolean(busy) || status === 'rejected' || status === 'not_relevant'}
          onClick={() => setStatus('rejected')}
          data-testid="manual-finding-remove"
        >
          {busy === 'rejected' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Remove
        </Button>
      </div>
    </div>
  );
}
