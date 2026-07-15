import React, { useEffect, useMemo, useState } from 'react';
import { Bot, Check, Loader2, Pencil, RefreshCw, X } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';

const asText = (value) => typeof value === 'string' ? value.trim() : '';
const suggestionContent = (row) => row?.reviewed_content || row?.content || {};

const recommendationChoices = (content) => {
  const category = asText(content.category).toLowerCase();
  const choices = [asText(content.recommended_action)].filter(Boolean);
  if (category.includes('dryer') || category.includes('lint')) choices.push('Complete dryer vent cleaning', 'Inspect exterior termination and airflow');
  else if (category.includes('airflow') || category.includes('duct')) choices.push('Complete duct cleaning', 'Inspect the connected duct run');
  else if (category.includes('clean')) choices.push('Clean the affected component', 'Verify airflow after cleaning');
  else choices.push('Inspect and correct the documented condition', 'Schedule qualified service evaluation');
  return [...new Set(choices)].slice(0, 3);
};

export default function InspectionAiReviewPanel({ tenantId, inspectionId, revision, locked, photos: providedPhotos, onChanged }) {
  const { toast } = useToast();
  const [rows, setRows] = useState([]);
  const [loadedPhotos, setLoadedPhotos] = useState([]);
  const [busyPhotoId, setBusyPhotoId] = useState('');
  const [errorText, setErrorText] = useState('');
  const [selectedRecommendations, setSelectedRecommendations] = useState({});
  const photos = providedPhotos || loadedPhotos;

  const load = async () => {
    const [suggestionResult, photoResult] = await Promise.all([
      supabase.from('inspection_ai_suggestions').select('*')
        .eq('tenant_id', tenantId).eq('inspection_id', inspectionId).eq('inspection_revision', revision)
        .order('suggestion_version').order('created_at'),
      providedPhotos ? Promise.resolve({ data: providedPhotos, error: null }) : supabase.from('inspection_photos').select('*')
        .eq('tenant_id', tenantId).eq('inspection_id', inspectionId).eq('is_voided', false).order('uploaded_at'),
    ]);
    if (suggestionResult.error) throw suggestionResult.error;
    if (photoResult.error) throw photoResult.error;
    setRows(suggestionResult.data || []);
    setLoadedPhotos(photoResult.data || []);
  };

  useEffect(() => {
    load().catch((error) => setErrorText(error.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inspectionId, revision, tenantId, providedPhotos]);

  const rowsByPhoto = useMemo(() => {
    const grouped = new Map();
    rows.forEach((row) => grouped.set(row.photo_id, [...(grouped.get(row.photo_id) || []), row]));
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

  const reviewPackage = async (photo, findingSuggestion, action) => {
    const content = suggestionContent(findingSuggestion);
    let reviewedContent = {
      recommendation: selectedRecommendations[photo.id] || asText(content.recommended_action),
    };
    if (action === 'edit') {
      const title = window.prompt('Condition title:', asText(content.title));
      if (title === null) return;
      const description = window.prompt('Observed condition:', asText(content.description));
      if (description === null) return;
      const customerCaption = window.prompt('Customer photo caption:', asText(content.customer_caption));
      if (customerCaption === null) return;
      const recommendation = window.prompt('Internal corrective guidance:', reviewedContent.recommendation);
      if (recommendation === null) return;
      reviewedContent = { title: title.trim(), description: description.trim(), customer_caption: customerCaption.trim(), recommendation: recommendation.trim() };
    }
    setBusyPhotoId(photo.id);
    // Phase A: AI accept/edit always stores an internal structured condition.
    // p_internal_only kept for RPC compatibility; server forces non-customer-visible.
    const { error } = await supabase.rpc('inspection_review_ai_photo_package', {
      p_tenant_id: tenantId,
      p_photo_id: photo.id,
      p_action: action,
      p_reviewed_content: reviewedContent,
      p_internal_only: true,
    });
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
        <div><CardTitle className="flex items-center gap-2 text-base"><Bot className="h-4 w-4" />Findings from photos</CardTitle><p className="mt-1 text-xs text-slate-500">Keep, edit, or remove each suggested observation. Photo quality Retake/Keep stays separate.</p></div>
        <Button size="sm" variant="outline" onClick={() => analyze()} disabled={Boolean(busyPhotoId) || locked || !eligibleCount}>
          {busyPhotoId === 'all' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bot className="mr-2 h-4 w-4" />}Analyze ready photos
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="rounded-lg bg-sky-50 p-3 text-xs text-sky-900">Advisory only. Keep or Edit stores an internal observation linked to this photo for the Findings summary. Pricing stays in Estimates.</p>
        {errorText ? <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">{errorText}</div> : null}
        {activePhotos.map((photo) => {
          const photoRows = rowsByPhoto.get(photo.id) || [];
          const version = photoRows.reduce((max, row) => Math.max(max, Number(row.suggestion_version || 1)), 0);
          const latestRows = photoRows.filter((row) => Number(row.suggestion_version || 1) === version);
          const findingSuggestion = latestRows.find((row) => row.suggestion_type === 'finding');
          const narrativeSuggestion = latestRows.find((row) => row.suggestion_type === 'report_narrative');
          const content = suggestionContent(findingSuggestion);
          const pending = latestRows.some((row) => row.status === 'pending');
          const choices = recommendationChoices(content);
          const selected = selectedRecommendations[photo.id] || choices[0] || '';
          const reviewed = latestRows.length > 0 && !pending;
          const decisionStatus = asText(findingSuggestion?.status).toLowerCase() || 'pending';
          return (
            <article
              key={photo.id}
              id={`inspection-photo-${photo.id}`}
              data-photo-id={photo.id}
              className="rounded-xl border border-slate-200 bg-white p-4"
            >
              <div className="flex gap-3">
                <div className="h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-slate-100">{photo.signed_url ? <img src={photo.signed_url} alt={photo.caption || 'Inspection evidence'} className="h-full w-full object-contain" /> : null}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap gap-2"><Badge>{photo.is_before === true ? 'Before' : photo.is_before === false ? 'After' : 'Observed'}</Badge><Badge variant="outline">{reviewed ? 'Reviewed' : version ? 'Needs decision' : 'Not analyzed'}</Badge></div>
                  <h3 className="mt-2 font-semibold text-slate-900">{asText(content.title) || photo.caption || photo.file_name}</h3>
                  <p className="mt-1 text-sm text-slate-600">{asText(content.customer_caption) || 'Caption will appear after analysis.'}</p>
                  <p className="mt-1 text-xs text-slate-500">Confidence: {asText(content.confidence) || 'not stated'}</p>
                </div>
              </div>
              {photo.quality_status === 'retake_recommended' || photo.quality_status === 'kept_with_warning' ? <div className="mt-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-900">Quality warning: {(photo.quality_warnings || []).join(' ')}</div> : null}
              {findingSuggestion ? <div className="mt-3"><div className="text-xs font-semibold uppercase text-slate-500">Internal corrective guidance</div><div className="mt-2 flex flex-wrap gap-2">{choices.map((choice) => <Button key={choice} type="button" size="sm" variant={selected === choice ? 'default' : 'outline'} onClick={() => setSelectedRecommendations((current) => ({ ...current, [photo.id]: choice }))}>{choice}</Button>)}<Button type="button" size="sm" variant="outline" onClick={() => { const custom = window.prompt('Custom internal corrective guidance:', selected); if (custom) setSelectedRecommendations((current) => ({ ...current, [photo.id]: custom.trim() })); }}>Custom guidance</Button></div></div> : null}
              <div className="mt-3 hidden grid-cols-2 gap-3 text-sm md:grid"><div><b>Observation</b><p>{asText(content.description)}</p></div><div><b>Uncertainty</b><p>{asText(content.uncertainty)}</p></div><div><b>Category</b><p>{asText(content.category)}</p></div><div><b>Evidence usability</b><p>{asText(content.evidence_usability)}</p></div><div><b>Model/version</b><p>{findingSuggestion?.model} / {findingSuggestion?.prompt_version}</p></div><div><b>Narrative</b><p>{asText(suggestionContent(narrativeSuggestion).narrative)}</p></div></div>
              <details className="mt-3 rounded-lg border p-3 text-sm md:hidden"><summary className="font-medium">View details</summary><p className="mt-2"><b>Observation:</b> {asText(content.description)}</p><p className="mt-2"><b>Uncertainty:</b> {asText(content.uncertainty)}</p><p className="mt-2"><b>Evidence:</b> {asText(content.evidence_usability)}</p></details>
              {!latestRows.length && photo.upload_state === 'complete' ? <Button className="mt-3 min-h-11" onClick={() => analyze(photo.id)} disabled={Boolean(busyPhotoId)}>Analyze photo</Button> : null}
              {findingSuggestion && !locked ? (
                <div className="mt-4 space-y-2" data-testid="ai-finding-decision-controls" data-suggestion-id={findingSuggestion.id} data-decision-status={decisionStatus}>
                  {reviewed ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="text-[11px]">
                        {decisionStatus === 'rejected' || decisionStatus === 'irrelevant'
                          ? 'Removed'
                          : decisionStatus === 'edited'
                            ? 'Edited'
                            : 'Kept'}
                      </Badge>
                      <Badge variant="outline" className="text-[11px]">Internal condition</Badge>
                    </div>
                  ) : null}
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      className="min-h-11"
                      variant={decisionStatus === 'accepted' ? 'default' : 'outline'}
                      onClick={() => reviewPackage(photo, findingSuggestion, 'accept')}
                      disabled={Boolean(busyPhotoId)}
                      data-testid="finding-keep"
                    >
                      <Check className="mr-1 h-4 w-4" />Keep
                    </Button>
                    <Button
                      variant="outline"
                      className="min-h-11"
                      onClick={() => reviewPackage(photo, findingSuggestion, 'edit')}
                      disabled={Boolean(busyPhotoId)}
                      data-testid="finding-edit"
                    >
                      <Pencil className="mr-1 h-4 w-4" />Edit
                    </Button>
                    <Button
                      variant={decisionStatus === 'rejected' || decisionStatus === 'irrelevant' ? 'destructive' : 'outline'}
                      className="min-h-11"
                      onClick={() => reviewPackage(photo, findingSuggestion, 'reject')}
                      disabled={Boolean(busyPhotoId)}
                      data-testid="finding-remove"
                    >
                      <X className="mr-1 h-4 w-4" />Remove
                    </Button>
                  </div>
                </div>
              ) : null}
              {reviewed ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => analyze(photo.id, true)} disabled={Boolean(busyPhotoId) || locked}>
                    <RefreshCw className="mr-1 h-4 w-4" />Retry analysis
                  </Button>
                </div>
              ) : null}
            </article>
          );
        })}
        {!activePhotos.length ? <p className="text-sm text-slate-500">Upload a photo to begin analysis.</p> : null}
      </CardContent>
    </Card>
  );
}
