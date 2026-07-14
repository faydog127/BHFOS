import React, { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import {
  buildConditionsFingerprint,
  buildFindingsNarrative,
  listApprovedConditions,
  regenerateWillReplaceDraft,
  resolveNarrativeStatusForFingerprint,
} from '@/lib/inspectionFindingsNarrative';

const asText = (value) => (typeof value === 'string' ? value.trim() : '');

export default function InspectionFindingsNarrativeCard({
  tenantId,
  inspection,
  findings = [],
  photos = [],
  suggestions = [],
  locked = false,
  compact = false,
  userId = null,
  onChanged,
}) {
  const { toast } = useToast();
  const [summary, setSummary] = useState(asText(inspection?.summary));
  const [status, setStatus] = useState(asText(inspection?.summary_status) || 'draft');
  const [fingerprint, setFingerprint] = useState(asText(inspection?.summary_conditions_fingerprint));
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  const currentFingerprint = useMemo(
    () => buildConditionsFingerprint(findings, suggestions, photos),
    [findings, photos, suggestions],
  );
  const approvedCount = useMemo(
    () => listApprovedConditions(findings, suggestions).length,
    [findings, suggestions],
  );
  const resolvedStatus = useMemo(
    () => resolveNarrativeStatusForFingerprint({
      summaryStatus: status,
      storedFingerprint: fingerprint,
      currentFingerprint,
    }),
    [currentFingerprint, fingerprint, status],
  );

  useEffect(() => {
    setSummary(asText(inspection?.summary));
    setStatus(asText(inspection?.summary_status) || 'draft');
    setFingerprint(asText(inspection?.summary_conditions_fingerprint));
    setEditing(false);
  }, [
    inspection?.id,
    inspection?.summary,
    inspection?.summary_status,
    inspection?.summary_conditions_fingerprint,
    inspection?.updated_at,
  ]);

  useEffect(() => {
    if (!inspection?.id) return;
    if (resolvedStatus !== 'stale' || status === 'stale') return;
    let cancelled = false;
    const persistStale = async () => {
      const { error } = await supabase
        .from('inspections')
        .update({
          summary_status: 'stale',
          updated_at: new Date().toISOString(),
        })
        .eq('tenant_id', tenantId)
        .eq('id', inspection.id);
      if (cancelled || error) return;
      setStatus('stale');
      onChanged?.();
    };
    persistStale();
    return () => { cancelled = true; };
  }, [inspection?.id, onChanged, resolvedStatus, status, tenantId]);

  const persist = async ({ nextSummary, nextStatus, nextFingerprint }) => {
    if (!inspection?.id) return;
    setSaving(true);
    try {
      const nowIso = new Date().toISOString();
      const reviewed = nextStatus === 'accepted' || nextStatus === 'edited';
      const payload = {
        summary: nextSummary || null,
        summary_status: nextStatus,
        summary_conditions_fingerprint: nextFingerprint || null,
        summary_source_revision: inspection.revision || 1,
        summary_reviewed_at: reviewed ? nowIso : null,
        summary_reviewed_by: reviewed ? userId || null : null,
        updated_at: nowIso,
      };
      const { error } = await supabase
        .from('inspections')
        .update(payload)
        .eq('tenant_id', tenantId)
        .eq('id', inspection.id);
      if (error) throw error;
      setSummary(nextSummary);
      setStatus(nextStatus);
      setFingerprint(nextFingerprint || '');
      setEditing(false);
      onChanged?.();
      toast({ title: 'Findings narrative saved' });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Narrative save failed',
        description: error?.message || 'Could not save the Findings narrative.',
      });
    } finally {
      setSaving(false);
    }
  };

  const generateDraft = async () => {
    if (!approvedCount) {
      return toast({
        variant: 'destructive',
        title: 'No approved conditions',
        description: 'Accept photo conditions before generating the Findings narrative.',
      });
    }
    if (regenerateWillReplaceDraft(resolvedStatus, summary)) {
      const ok = window.confirm(
        resolvedStatus === 'accepted' || resolvedStatus === 'edited'
          ? 'This will replace the technician-reviewed Findings narrative. Continue?'
          : 'This will replace the current unaccepted draft. Continue?',
      );
      if (!ok) return;
    }
    const narrative = buildFindingsNarrative(findings, suggestions, photos);
    if (!narrative) {
      return toast({
        variant: 'destructive',
        title: 'Nothing to draft',
        description: 'Approved conditions did not produce customer-safe narrative text.',
      });
    }
    await persist({
      nextSummary: narrative,
      nextStatus: 'generated',
      nextFingerprint: currentFingerprint,
    });
  };

  const saveEdits = async () => {
    const text = asText(summary);
    if (!text) {
      return toast({
        variant: 'destructive',
        title: 'Narrative required',
        description: 'Enter Findings narrative text before saving.',
      });
    }
    await persist({
      nextSummary: text,
      nextStatus: 'edited',
      nextFingerprint: currentFingerprint,
    });
  };

  const acceptNarrative = async () => {
    const text = asText(summary);
    if (!text) {
      return toast({
        variant: 'destructive',
        title: 'Narrative required',
        description: 'Generate or edit the Findings narrative before accepting.',
      });
    }
    await persist({
      nextSummary: text,
      nextStatus: 'accepted',
      nextFingerprint: currentFingerprint,
    });
  };

  const statusLabel = resolvedStatus === 'stale'
    ? 'Stale — review required'
    : resolvedStatus;

  return (
    <Card id="inspection-summary" className="border-slate-200 shadow-sm">
      <CardHeader className={compact ? 'pb-2' : undefined}>
        <CardTitle className="text-base">Findings narrative</CardTitle>
        <p className="text-xs text-slate-500">
          One customer-facing summary built from approved internal conditions and photo evidence. Pricing stays in Estimates.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="capitalize">{statusLabel}</Badge>
          <span className="text-xs text-slate-500">{approvedCount} approved condition{approvedCount === 1 ? '' : 's'}</span>
        </div>
        {resolvedStatus === 'stale' ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            Approved conditions changed after this narrative was reviewed. Regenerate or edit and accept again before finalizing.
          </div>
        ) : null}
        <div className="space-y-2">
          <Label htmlFor={`findings-narrative-${inspection?.id || 'draft'}`}>Customer Findings</Label>
          <Textarea
            id={`findings-narrative-${inspection?.id || 'draft'}`}
            value={summary}
            onChange={(event) => {
              setSummary(event.target.value);
              setEditing(true);
              if (resolvedStatus !== 'edited') setStatus('edited');
            }}
            placeholder="Generate a draft from approved conditions, or write the customer Findings narrative..."
            className={compact ? 'min-h-32 text-base' : 'min-h-36'}
            disabled={locked || saving}
          />
        </div>
        <div className={`grid gap-2 ${compact ? 'grid-cols-1' : 'sm:grid-cols-2 lg:grid-cols-4'}`}>
          <Button
            type="button"
            variant="outline"
            className={compact ? 'min-h-12' : undefined}
            onClick={generateDraft}
            disabled={locked || saving || !approvedCount}
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {asText(summary) ? 'Regenerate draft' : 'Generate draft'}
          </Button>
          <Button
            type="button"
            variant="outline"
            className={compact ? 'min-h-12' : undefined}
            onClick={saveEdits}
            disabled={locked || saving || !editing}
          >
            Save edits
          </Button>
          <Button
            type="button"
            className={compact ? 'min-h-12' : undefined}
            onClick={acceptNarrative}
            disabled={locked || saving || !asText(summary)}
          >
            Accept narrative
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
