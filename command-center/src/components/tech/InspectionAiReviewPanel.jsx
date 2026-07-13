import React, { useEffect, useMemo, useState } from 'react';
import { Bot, Check, CircleOff, Loader2, Pencil, RefreshCw, X } from 'lucide-react';
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
  const [findings, setFindings] = useState([]);
  const [busyPhotoId, setBusyPhotoId] = useState('');
  const [errorText, setErrorText] = useState('');
  const [selectedRecommendations, setSelectedRecommendations] = useState({});
  const photos = providedPhotos || loadedPhotos;

  const load = async () => {
    const [suggestionResult, photoResult, findingResult] = await Promise.all([
      supabase.from('inspection_ai_suggestions').select('*')
        .eq('tenant_id', tenantId).eq('inspection_id', inspectionId).eq('inspection_revision', revision)
        .order('suggestion_version').order('created_at'),
      providedPhotos ? Promise.resolve({ data: providedPhotos, error: null }) : supabase.from('inspection_photos').select('*')
        .eq('tenant_id', tenantId).eq('inspection_id', inspectionId).eq('is_voided', false).order('uploaded_at'),
      supabase.from('inspection_findings').select('id, source_ai_suggestion_id, is_customer_visible')
        .eq('tenant_id', tenantId).eq('inspection_id', inspectionId),
    ]);
    if (suggestionResult.error) throw suggestionResult.error;
    if (photoResult.error) throw photoResult.error;
    if (findingResult.error) throw findingResult.error;
    setRows(suggestionResult.data || []);
    setLoadedPhotos(photoResult.data || []);
    setFindings(findingResult.data || []);
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
    let internalOnly = false;
    if (action === 'edit') {
      const title = window.prompt('Finding title:', asText(content.title));
      if (title === null) return;
      const description = window.prompt('Observed condition:', asText(content.description));
      if (description === null) return;
      const customerCaption = window.prompt('Customer photo caption:', asText(content.customer_caption));
      if (customerCaption === null) return;
      const recommendation = window.prompt('Recommended corrective action:', reviewedContent.recommendation);
      if (recommendation === null) return;
      internalOnly = window.confirm('Keep this finding internal-only? Select Cancel to include it in the customer report.');
      reviewedContent = { title: title.trim(), description: description.trim(), customer_caption: customerCaption.trim(), recommendation: recommendation.trim() };
    }
    setBusyPhotoId(photo.id);
    const { error } = await supabase.rpc('inspection_review_ai_photo_package', {
      p_tenant_id: tenantId,
      p_photo_id: photo.id,
      p_action: action,
      p_reviewed_content: reviewedContent,
      p_internal_only: internalOnly,
    });
    setBusyPhotoId('');
    if (error) {
      setErrorText(error.message);
      return toast({ variant: 'destructive', title: 'Review failed', description: error.message });
    }
    await load();
    onChanged?.();
  };

  const setVisibility = async (finding, customerVisible) => {
    const { error } = await supabase.rpc('inspection_set_finding_visibility', {
      p_tenant_id: tenantId, p_finding_id: finding.id, p_customer_visible: customerVisible,
    });
    if (error) return toast({ variant: 'destructive', title: 'Visibility update failed', description: error.message });
    await load();
    onChanged?.();
  };

  const activePhotos = (photos || []).filter((photo) => photo?.is_voided !== true);
  const eligibleCount = activePhotos.filter((photo) => photo.upload_state === 'complete').length;

  return (
    <Card className="border-sky-200 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div><CardTitle className="flex items-center gap-2 text-base"><Bot className="h-4 w-4" />Photo review</CardTitle><p className="mt-1 text-xs text-slate-500">One technician decision approves or excludes the complete photo package.</p></div>
        <Button size="sm" variant="outline" onClick={() => analyze()} disabled={Boolean(busyPhotoId) || locked || !eligibleCount}>
          {busyPhotoId === 'all' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bot className="mr-2 h-4 w-4" />}Analyze ready photos
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="rounded-lg bg-sky-50 p-3 text-xs text-sky-900">Advisory only. Pricing and customer approval remain human-controlled.</p>
        {errorText ? <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">{errorText}</div> : null}
        {activePhotos.map((photo) => {
          const photoRows = rowsByPhoto.get(photo.id) || [];
          const version = photoRows.reduce((max, row) => Math.max(max, Number(row.suggestion_version || 1)), 0);
          const latestRows = photoRows.filter((row) => Number(row.suggestion_version || 1) === version);
          const findingSuggestion = latestRows.find((row) => row.suggestion_type === 'finding');
          const narrativeSuggestion = latestRows.find((row) => row.suggestion_type === 'report_narrative');
          const content = suggestionContent(findingSuggestion);
          const pending = latestRows.some((row) => row.status === 'pending');
          const linkedFinding = findings.find((finding) => latestRows.some((row) => row.id === finding.source_ai_suggestion_id));
          const choices = recommendationChoices(content);
          const selected = selectedRecommendations[photo.id] || choices[0] || '';
          const reviewed = latestRows.length > 0 && !pending;
          return (
            <article key={photo.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex gap-3">
                <div className="h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-slate-100">{photo.signed_url ? <img src={photo.signed_url} alt={photo.caption || 'Inspection evidence'} className="h-full w-full object-contain" /> : null}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap gap-2"><Badge>{photo.is_before === true ? 'Before' : photo.is_before === false ? 'After' : 'Unspecified'}</Badge><Badge variant="outline">{reviewed ? 'Reviewed' : version ? 'Decision needed' : 'Not analyzed'}</Badge>{version ? <Badge variant="outline">v{version}</Badge> : null}</div>
                  <h3 className="mt-2 font-semibold text-slate-900">{asText(content.title) || photo.caption || photo.file_name}</h3>
                  <p className="mt-1 text-sm text-slate-600">{asText(content.customer_caption) || 'Caption will appear after analysis.'}</p>
                  <p className="mt-1 text-xs text-slate-500">Confidence: {asText(content.confidence) || 'not stated'}</p>
                </div>
              </div>
              {photo.quality_status === 'retake_recommended' || photo.quality_status === 'kept_with_warning' ? <div className="mt-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-900">Quality warning: {(photo.quality_warnings || []).join(' ')}</div> : null}
              {findingSuggestion ? <div className="mt-3"><div className="text-xs font-semibold uppercase text-slate-500">Recommendation</div><div className="mt-2 flex flex-wrap gap-2">{choices.map((choice) => <Button key={choice} type="button" size="sm" variant={selected === choice ? 'default' : 'outline'} onClick={() => setSelectedRecommendations((current) => ({ ...current, [photo.id]: choice }))}>{choice}</Button>)}<Button type="button" size="sm" variant="outline" onClick={() => { const custom = window.prompt('Custom recommendation:', selected); if (custom) setSelectedRecommendations((current) => ({ ...current, [photo.id]: custom.trim() })); }}>Custom recommendation</Button></div></div> : null}
              <div className="mt-3 hidden grid-cols-2 gap-3 text-sm md:grid"><div><b>Observation</b><p>{asText(content.description)}</p></div><div><b>Uncertainty</b><p>{asText(content.uncertainty)}</p></div><div><b>Category</b><p>{asText(content.category)}</p></div><div><b>Evidence usability</b><p>{asText(content.evidence_usability)}</p></div><div><b>Model/version</b><p>{findingSuggestion?.model} / {findingSuggestion?.prompt_version}</p></div><div><b>Narrative</b><p>{asText(suggestionContent(narrativeSuggestion).narrative)}</p></div></div>
              <details className="mt-3 rounded-lg border p-3 text-sm md:hidden"><summary className="font-medium">View details</summary><p className="mt-2"><b>Observation:</b> {asText(content.description)}</p><p className="mt-2"><b>Uncertainty:</b> {asText(content.uncertainty)}</p><p className="mt-2"><b>Evidence:</b> {asText(content.evidence_usability)}</p></details>
              {!latestRows.length && photo.upload_state === 'complete' ? <Button className="mt-3 min-h-11" onClick={() => analyze(photo.id)} disabled={Boolean(busyPhotoId)}>Analyze photo</Button> : null}
              {pending ? <div className="mt-4 grid grid-cols-2 gap-2 sm:flex"><Button className="min-h-11" onClick={() => reviewPackage(photo, findingSuggestion, 'accept')}><Check className="mr-1 h-4 w-4" />Accept</Button><Button variant="outline" className="min-h-11" onClick={() => reviewPackage(photo, findingSuggestion, 'edit')}><Pencil className="mr-1 h-4 w-4" />Edit</Button><Button variant="destructive" className="min-h-11" onClick={() => reviewPackage(photo, findingSuggestion, 'reject')}><X className="mr-1 h-4 w-4" />Reject</Button><Button variant="outline" className="min-h-11" onClick={() => reviewPackage(photo, findingSuggestion, 'irrelevant')}><CircleOff className="mr-1 h-4 w-4" />Not relevant</Button></div> : null}
              {reviewed ? <div className="mt-3 flex flex-wrap gap-2">{linkedFinding ? <Button size="sm" variant="outline" onClick={() => setVisibility(linkedFinding, !linkedFinding.is_customer_visible)}>{linkedFinding.is_customer_visible ? 'Mark internal-only' : 'Include in customer report'}</Button> : null}<Button size="sm" variant="outline" onClick={() => analyze(photo.id, true)}><RefreshCw className="mr-1 h-4 w-4" />Retry analysis</Button></div> : null}
            </article>
          );
        })}
        {!activePhotos.length ? <p className="text-sm text-slate-500">Upload a photo to begin analysis.</p> : null}
      </CardContent>
    </Card>
  );
}
