import React, { useEffect, useState } from 'react';
import { Bot, Check, Loader2, Pencil, X } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';

const suggestionText = (row) => row.suggestion_type === 'report_narrative'
  ? row.content?.narrative
  : [row.content?.title, row.content?.description, row.content?.recommended_action].filter(Boolean).join('\n\n');

export default function InspectionAiReviewPanel({ tenantId, inspectionId, revision, locked, onChanged }) {
  const { toast } = useToast();
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data, error } = await supabase.from('inspection_ai_suggestions').select('*')
      .eq('tenant_id', tenantId).eq('inspection_id', inspectionId).eq('inspection_revision', revision)
      .order('created_at');
    if (!error) setRows(data || []);
  };

  useEffect(() => {
    load();
    // load is intentionally scoped to the current inspection inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inspectionId, revision, tenantId]);

  const analyze = async () => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('inspection-ai-analyze', { body: { inspection_id: inspectionId } });
    setBusy(false);
    if (error || data?.error) return toast({ variant: 'destructive', title: 'Analysis failed', description: data?.error || error?.message });
    await load();
    toast({ title: 'Advisory analysis ready', description: `${data.created} suggestion(s) created for technician review.` });
  };

  const review = async (row, action) => {
    let reviewedContent = null;
    if (action === 'edit') {
      const edited = window.prompt('Edit this advisory suggestion before accepting it:', suggestionText(row) || '');
      if (edited === null) return;
      reviewedContent = row.suggestion_type === 'report_narrative'
        ? { ...row.content, narrative: edited }
        : { ...row.content, description: edited };
    }
    setBusy(true);
    const { error } = await supabase.rpc('inspection_review_ai_suggestion', {
      p_tenant_id: tenantId, p_suggestion_id: row.id, p_action: action, p_reviewed_content: reviewedContent,
    });
    setBusy(false);
    if (error) return toast({ variant: 'destructive', title: 'Review failed', description: error.message });
    await load();
    onChanged?.();
  };

  return (
    <Card className="border-sky-200 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2 text-base"><Bot className="h-4 w-4" />AI-assisted review</CardTitle>
        <Button size="sm" variant="outline" onClick={analyze} disabled={busy || locked}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Analyze photos
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="rounded-lg bg-sky-50 p-3 text-xs text-sky-900">Advisory only. AI cannot approve findings or set pricing. Original photo evidence is never modified.</p>
        {rows.length ? rows.map((row) => (
          <div key={row.id} className="rounded-xl border border-slate-200 p-3 text-sm">
            <div className="mb-2 flex items-center justify-between gap-2">
              <Badge variant="outline">{row.suggestion_type === 'report_narrative' ? 'Narrative' : 'Finding'}</Badge>
              <Badge variant="outline">{row.status}</Badge>
            </div>
            <p className="whitespace-pre-wrap text-slate-700">{suggestionText(row) || 'No suggestion text returned.'}</p>
            {row.status === 'pending' ? <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => review(row, 'accept')} disabled={busy}><Check className="mr-1 h-4 w-4" />Accept</Button>
              <Button size="sm" variant="outline" onClick={() => review(row, 'edit')} disabled={busy}><Pencil className="mr-1 h-4 w-4" />Edit</Button>
              <Button size="sm" variant="destructive" onClick={() => review(row, 'reject')} disabled={busy}><X className="mr-1 h-4 w-4" />Reject</Button>
            </div> : null}
          </div>
        )) : <p className="text-sm text-slate-500">No AI suggestions for this revision.</p>}
      </CardContent>
    </Card>
  );
}
