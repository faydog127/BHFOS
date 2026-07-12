import React, { useEffect, useMemo, useState } from 'react';
import { Bot, Check, CircleOff, Loader2, Pencil, RefreshCw, X } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';

const asText = (value) => typeof value === 'string' ? value.trim() : '';
const suggestionContent = (row) => row.reviewed_content || row.content || {};
const suggestionLabel = (row) => row.suggestion_type === 'report_narrative' ? 'Report narrative' : 'Photo finding';

export default function InspectionAiReviewPanel({ tenantId, inspectionId, revision, locked, photos: providedPhotos, onChanged }) {
  const { toast } = useToast();
  const [rows, setRows] = useState([]);
  const [loadedPhotos, setLoadedPhotos] = useState([]);
  const [busyPhotoId, setBusyPhotoId] = useState('');
  const [errorText, setErrorText] = useState('');
  const photos = providedPhotos || loadedPhotos;

  const load = async () => {
    const [suggestionResult, photoResult] = await Promise.all([
      supabase.from('inspection_ai_suggestions').select('*')
        .eq('tenant_id', tenantId).eq('inspection_id', inspectionId).eq('inspection_revision', revision)
        .order('suggestion_version').order('created_at'),
      providedPhotos
        ? Promise.resolve({ data: providedPhotos, error: null })
        : supabase.from('inspection_photos').select('*')
          .eq('tenant_id', tenantId).eq('inspection_id', inspectionId).eq('is_voided', false).order('uploaded_at'),
    ]);
    if (suggestionResult.error) throw suggestionResult.error;
    if (photoResult.error) throw photoResult.error;
    setRows(suggestionResult.data || []);
    setLoadedPhotos(photoResult.data || []);
  };

  useEffect(() => {
    load().catch((error) => setErrorText(error.message));
    // load is intentionally scoped to the current inspection inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inspectionId, revision, tenantId, providedPhotos]);

  const rowsByPhoto = useMemo(() => {
    const grouped = new Map();
    rows.forEach((row) => {
      const current = grouped.get(row.photo_id) || [];
      current.push(row);
      grouped.set(row.photo_id, current);
    });
    return grouped;
  }, [rows]);

  const analyze = async (photoId = '', retry = false) => {
    setBusyPhotoId(photoId || 'all');
    setErrorText('');
    const { data, error } = await supabase.functions.invoke('inspection-ai-analyze', {
      body: { inspection_id: inspectionId, photo_id: photoId || undefined, retry },
    });
    setBusyPhotoId('');
    if (error || data?.error) {
      const message = data?.error || error?.message || 'Photo analysis failed.';
      setErrorText(message);
      return toast({ variant: 'destructive', title: 'Analysis failed', description: message });
    }
    await load();
    toast({ title: 'Advisory analysis ready', description: `${data.created} suggestion(s) created for technician review.` });
  };

  const review = async (row, action) => {
    let reviewedContent = null;
    const content = suggestionContent(row);
    if (action === 'edit') {
      if (row.suggestion_type === 'report_narrative') {
        const narrative = window.prompt('Edit the advisory report narrative:', asText(content.narrative));
        if (narrative === null) return;
        reviewedContent = { ...content, narrative: narrative.trim() };
      } else {
        const description = window.prompt('Edit the advisory finding description:', asText(content.description));
        if (description === null) return;
        const customerCaption = window.prompt('Edit the customer-facing photo caption:', asText(content.customer_caption));
        if (customerCaption === null) return;
        reviewedContent = { ...content, description: description.trim(), customer_caption: customerCaption.trim() };
      }
    }

    setBusyPhotoId(row.photo_id || row.id);
    setErrorText('');
    const { error } = await supabase.rpc('inspection_review_ai_suggestion', {
      p_tenant_id: tenantId,
      p_suggestion_id: row.id,
      p_action: action,
      p_reviewed_content: reviewedContent,
    });
    if (!error && ['accept', 'edit'].includes(action) && row.suggestion_type === 'finding') {
      const caption = asText((reviewedContent || content).customer_caption);
      if (caption) {
        await supabase.from('inspection_photos').update({ caption, updated_at: new Date().toISOString() })
          .eq('tenant_id', tenantId).eq('inspection_id', inspectionId).eq('id', row.photo_id);
      }
    }
    setBusyPhotoId('');
    if (error) {
      setErrorText(error.message);
      return toast({ variant: 'destructive', title: 'Review failed', description: error.message });
    }
    await load();
    onChanged?.();
  };

  const activePhotos = (photos || []).filter((photo) => photo?.is_voided !== true);
  const eligibleCount = activePhotos.filter((photo) => photo.upload_state === 'complete').length;

  return (
    <Card className="border-sky-200 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base"><Bot className="h-4 w-4" />AI photo analysis</CardTitle>
          <p className="mt-1 text-xs text-slate-500">Analyze ready photos, then accept, edit, reject, or mark each advisory result not relevant.</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => analyze()} disabled={Boolean(busyPhotoId) || locked || !eligibleCount}>
          {busyPhotoId === 'all' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bot className="mr-2 h-4 w-4" />}
          Analyze ready photos
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="rounded-lg bg-sky-50 p-3 text-xs text-sky-900">Advisory only. AI cannot approve customer findings, set pricing, or modify original evidence.</p>
        {errorText ? <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">{errorText}</div> : null}

        {activePhotos.map((photo) => {
          const photoRows = rowsByPhoto.get(photo.id) || [];
          const latestVersion = photoRows.reduce((max, row) => Math.max(max, Number(row.suggestion_version || 1)), 0);
          const latestRows = photoRows.filter((row) => Number(row.suggestion_version || 1) === latestVersion);
          const finding = latestRows.find((row) => row.suggestion_type === 'finding');
          const content = finding ? suggestionContent(finding) : {};
          const isReady = photo.upload_state === 'complete';
          const hasPending = latestRows.some((row) => row.status === 'pending');
          const isBusy = busyPhotoId === photo.id;
          const state = !isReady ? photo.upload_state || 'waiting' : !latestRows.length ? 'not analyzed' : hasPending ? 'technician review required' : 'reviewed';

          return (
            <div key={photo.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-semibold text-slate-900">{photo.caption || photo.file_name || 'Inspection photo'}</div>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <Badge variant="outline" className="capitalize">Upload: {isReady ? 'ready' : photo.upload_state || 'waiting'}</Badge>
                    <Badge variant="outline" className="capitalize">AI: {state}</Badge>
                    {latestVersion ? <Badge variant="outline">Analysis v{latestVersion}</Badge> : null}
                  </div>
                </div>
                {isReady && !latestRows.length ? (
                  <Button size="sm" variant="outline" onClick={() => analyze(photo.id)} disabled={Boolean(busyPhotoId) || locked}>
                    {isBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bot className="mr-2 h-4 w-4" />}Analyze photo
                  </Button>
                ) : null}
                {isReady && latestRows.length && !hasPending ? (
                  <Button size="sm" variant="outline" onClick={() => analyze(photo.id, true)} disabled={Boolean(busyPhotoId) || locked}>
                    {isBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}Retry analysis
                  </Button>
                ) : null}
              </div>

              {finding ? (
                <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                  <div><div className="text-xs font-semibold uppercase text-slate-500">Suggested description</div><p className="mt-1 text-slate-700">{asText(content.description) || 'No description returned.'}</p></div>
                  <div><div className="text-xs font-semibold uppercase text-slate-500">Customer caption</div><p className="mt-1 text-slate-700">{asText(content.customer_caption) || 'No caption returned.'}</p></div>
                  <div><div className="text-xs font-semibold uppercase text-slate-500">Confidence / uncertainty</div><p className="mt-1 text-slate-700">{asText(content.confidence) || 'Not stated'}{asText(content.uncertainty) ? ` - ${content.uncertainty}` : ''}</p></div>
                  <div><div className="text-xs font-semibold uppercase text-slate-500">Category / evidence usability</div><p className="mt-1 text-slate-700">{asText(content.category) || 'Uncategorized'} - {asText(content.evidence_usability) || 'Not stated'}</p></div>
                </div>
              ) : null}

              <div className="mt-3 space-y-2">
                {latestRows.map((row) => {
                  const rowContent = suggestionContent(row);
                  return (
                    <div key={row.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                      <div className="flex items-center justify-between gap-2"><span className="font-medium">{suggestionLabel(row)}</span><Badge variant="outline" className="capitalize">{row.status}</Badge></div>
                      {row.suggestion_type === 'report_narrative' ? <p className="mt-2 text-slate-700">{asText(rowContent.narrative) || 'No narrative returned.'}</p> : null}
                      {row.status === 'pending' ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button size="sm" onClick={() => review(row, 'accept')} disabled={Boolean(busyPhotoId)}><Check className="mr-1 h-4 w-4" />Accept</Button>
                          <Button size="sm" variant="outline" onClick={() => review(row, 'edit')} disabled={Boolean(busyPhotoId)}><Pencil className="mr-1 h-4 w-4" />Edit</Button>
                          <Button size="sm" variant="destructive" onClick={() => review(row, 'reject')} disabled={Boolean(busyPhotoId)}><X className="mr-1 h-4 w-4" />Reject</Button>
                          <Button size="sm" variant="outline" onClick={() => review(row, 'irrelevant')} disabled={Boolean(busyPhotoId)}><CircleOff className="mr-1 h-4 w-4" />Not relevant</Button>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        {!activePhotos.length ? <p className="text-sm text-slate-500">Upload a photo to begin analysis.</p> : null}
      </CardContent>
    </Card>
  );
}
