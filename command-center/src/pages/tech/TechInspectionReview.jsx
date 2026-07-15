import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react';

import { supabase } from '@/lib/customSupabaseClient';
import { getTenantId } from '@/lib/tenantUtils';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { mediaQueue } from '@/lib/offlineInspectionMediaQueue';
import TechSendQuoteDialog from '@/components/tech/TechSendQuoteDialog';
import InspectionAiReviewPanel from '@/components/tech/InspectionAiReviewPanel';
import InspectionDeliveryPanel from '@/components/tech/InspectionDeliveryPanel';
import InspectionFindingsNarrativeCard from '@/components/tech/InspectionFindingsNarrativeCard';
import ManualConditionReviewControls, { isManualCondition, manualConditionStatus } from '@/components/tech/ManualConditionReviewControls';
import InspectionPreflightBlockers from '@/components/tech/InspectionPreflightBlockers';
import InspectionFieldStepper, { stepHref } from '@/components/tech/InspectionFieldStepper';
import { LEAD_FIELD_SELECT, resolveServiceAddress } from '@/lib/inspectionFieldAddress';
import InspectionServiceRecommendationPicker from '@/components/tech/InspectionServiceRecommendationPicker';
import {
  buildPreflightBlockerModel,
  scrollToInspectionTarget,
} from '@/lib/inspectionPreflightBlockers';
import { narrativeNeedsReview } from '@/lib/inspectionFindingsNarrative';

const asText = (v) => (typeof v === 'string' ? v.trim() : '');
const statusText = (v) => asText(v).toLowerCase() || 'draft';

const activePhotoCountForFinding = (findingId, photos) =>
  (photos || []).filter((photo) => (
    photo?.finding_id === findingId &&
    photo?.is_voided !== true &&
    asText(photo?.upload_state).toLowerCase() !== 'failed'
  )).length;

export default function TechInspectionReview() {
  const tenantId = getTenantId();
  const { inspectionId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const { user } = useSupabaseAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [inspection, setInspection] = useState(null);
  const [findings, setFindings] = useState([]);
  const [recs, setRecs] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [queueItems, setQueueItems] = useState([]);
  const [quote, setQuote] = useState(null);
  const [quoteItems, setQuoteItems] = useState([]);
  const [sendQuoteOpen, setSendQuoteOpen] = useState(false);
  const [resendRequested, setResendRequested] = useState(false);
  const [preflightIssues, setPreflightIssues] = useState([]);
  const [highlightFindingId, setHighlightFindingId] = useState('');

  const load = async () => {
    if (!inspectionId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('inspections')
        .select(
          `
          id,
          tenant_id,
          status,
          revision,
          quote_id,
          technician_id,
          title,
          summary,
          summary_status,
          summary_conditions_fingerprint,
          service_address,
          lead_id,
          updated_at,
          reviewed_at,
          reviewed_revision,
          lead:leads(${LEAD_FIELD_SELECT}),
          job:jobs(work_order_number, service_address)
        `,
        )
        .eq('tenant_id', tenantId)
        .eq('id', inspectionId)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Inspection not found.');

      const normalized = {
        ...data,
        lead: Array.isArray(data.lead) ? data.lead[0] : data.lead,
        job: Array.isArray(data.job) ? data.job[0] : data.job,
      };
      setInspection(normalized);

      if (normalized.quote_id) {
        const [quoteRes, itemsRes] = await Promise.all([
          supabase
            .from('quotes')
            .select('id, quote_number, status, total_amount, valid_until, service_address, customer_name, customer_email, customer_phone, inspection_human_reviewed_at')
            .eq('tenant_id', tenantId)
            .eq('id', normalized.quote_id)
            .maybeSingle(),
          supabase
            .from('quote_items')
            .select('description, quantity, unit_price, total_price')
            .eq('tenant_id', tenantId)
            .eq('quote_id', normalized.quote_id)
            .order('created_at', { ascending: true }),
        ]);

        if (quoteRes.error) throw quoteRes.error;
        if (itemsRes.error) throw itemsRes.error;
        setQuote(quoteRes.data || null);
        setQuoteItems(itemsRes.data || []);
      } else {
        setQuote(null);
        setQuoteItems([]);
      }

      const [findingRes, recRes, photoRes, aiRes] = await Promise.all([
        supabase
          .from('inspection_findings')
          .select('id, title, description, is_customer_visible, source_ai_suggestion_id, severity, category, condition_status')
          .eq('tenant_id', tenantId)
          .eq('inspection_id', inspectionId),
        supabase
          .from('inspection_recommendations')
          .select('id, title, description, is_customer_visible, finding_id')
          .eq('tenant_id', tenantId)
          .eq('inspection_id', inspectionId),
        supabase
          .from('inspection_photos')
          .select('id, caption, is_voided, finding_id, upload_state, is_before, object_path, bucket_id, file_name, quality_status, quality_warnings')
          .eq('tenant_id', tenantId)
          .eq('inspection_id', inspectionId),
        supabase
          .from('inspection_ai_suggestions')
          .select('id, photo_id, status, suggestion_type, suggestion_version')
          .eq('tenant_id', tenantId)
          .eq('inspection_id', inspectionId),
      ]);

      if (findingRes.error) throw findingRes.error;
      if (recRes.error) throw recRes.error;
      if (photoRes.error) throw photoRes.error;
      if (aiRes.error) throw aiRes.error;

      setFindings(findingRes.data || []);
      setRecs(recRes.data || []);
      setPhotos(photoRes.data || []);
      setAiSuggestions(aiRes.data || []);

      const localQueue = await mediaQueue.list({ tenantId, inspectionId });
      setQueueItems(localQueue);
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Load failed', description: err?.message || 'Could not load review.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inspectionId, tenantId]);

  const computed = useMemo(() => {
    const unresolved = (queueItems || []).filter((q) => ['queued', 'uploading', 'failed'].includes(q.status)).length;
    const failed = (queueItems || []).filter((q) => q.status === 'failed').length;

    const customerPhotos = (photos || []).filter((p) => p && p.is_voided !== true);
    const missingCaptions = customerPhotos.filter((p) => !asText(p.caption)).length;

    const internalFindings = (findings || []).filter((f) => f?.is_customer_visible === false).length;
    const internalRecs = (recs || []).filter((r) => r?.is_customer_visible === false).length;

    const warnings = [];
    if (failed) warnings.push(`${failed} upload failed`);
    if (unresolved) warnings.push(`${unresolved} upload queued`);
    if (missingCaptions) warnings.push(`${missingCaptions} uploaded photo missing caption`);

    return {
      unresolved,
      failed,
      missingCaptions,
      internalFindings,
      internalRecs,
      warnings,
    };
  }, [findings, photos, queueItems, recs]);

  const manualFindings = useMemo(
    () => (findings || []).filter((finding) => isManualCondition(finding)),
    [findings],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading review...
      </div>
    );
  }

  if (!inspection) {
    return (
      <div className="space-y-4">
        <Button variant="outline" asChild className="gap-2">
          <Link to="../queue">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </Button>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Inspection Not Found</CardTitle>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const status = statusText(inspection.status);
  const locked = status !== 'draft';
  const isReviewed = Boolean(inspection.reviewed_at && inspection.reviewed_revision === (inspection.revision || 1));
  const serviceAddressReady = Boolean(
    resolveServiceAddress({
      property: Array.isArray(inspection?.lead?.property)
        ? inspection.lead.property[0]
        : inspection?.lead?.property,
      inspectionServiceAddress: inspection.service_address,
      jobServiceAddress: inspection?.job?.service_address,
      lead: inspection?.lead,
    }),
  );
  const customerReady = Boolean(inspection.lead_id) && serviceAddressReady;
  const photosReady = photos.some((photo) => photo && photo.is_voided !== true);
  const hasInspectionLevelRec = recs.some((row) => row?.finding_id == null && row?.is_customer_visible !== false);
  const findingsReviewed = !aiSuggestions.some((row) => row?.status === 'pending') &&
    manualFindings.every((finding) => ['approved', 'rejected', 'not_relevant', 'voided'].includes(manualConditionStatus(finding)));
  const summaryReady = Boolean(asText(inspection.summary)) && !narrativeNeedsReview(inspection.summary_status);
  const requestedStep = asText(searchParams.get('step')).toLowerCase();
  const currentStep = ['findings', 'recommendation', 'finish'].includes(requestedStep) ? requestedStep : 'findings';
  const completionByStep = {
    customer: customerReady,
    photos: photosReady,
    findings: findingsReviewed,
    recommendation: hasInspectionLevelRec,
    finish: summaryReady && hasInspectionLevelRec && isReviewed,
  };

  const localAddressIssue = (!serviceAddressReady || !inspection.lead_id)
    ? [{ code: 'SERVICE_ADDRESS_REQUIRED', message: 'A service address is required for this report.' }]
    : [];
  const combinedIssues = [...localAddressIssue, ...(preflightIssues || [])];
  const preflightContext = {
    findings,
    recommendations: recs,
    aiSuggestions,
    photos,
  };
  const preflightModel = buildPreflightBlockerModel(combinedIssues, preflightContext);
  const highlightedFindingIds = new Set([
    ...preflightModel.highlights.findingIds,
    highlightFindingId,
  ].filter(Boolean));

  const navigatePreflightGroup = (group) => {
    if (group?.step && group.step !== currentStep) {
      if (group.step === 'customer' || group.step === 'photos') {
        navigate(stepHref(inspectionId, group.step));
        return;
      }
      setSearchParams({ step: group.step }, { replace: true });
    }
    const itemId = group?.findingIds?.[0] || group?.photoIds?.[0] || group?.recommendationIds?.[0] || '';
    if (group?.findingIds?.[0]) setHighlightFindingId(group.findingIds[0]);
    window.setTimeout(() => {
      const hit = scrollToInspectionTarget(group?.target, itemId);
      if (!hit) scrollToInspectionTarget(group?.target || 'findings');
    }, 50);
  };

  const linkPhotoToFinding = async (findingId, photoId) => {
    if (!findingId || !photoId || locked) return;
    try {
      const { error } = await supabase
        .from('inspection_photos')
        .update({ finding_id: photoId === 'unlinked' ? null : findingId, updated_at: new Date().toISOString() })
        .eq('tenant_id', tenantId)
        .eq('inspection_id', inspectionId)
        .eq('id', photoId);
      if (error) throw error;
      toast({ title: 'Photo linked' });
      setHighlightFindingId('');
      await load();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Could not link photo',
        description: error?.message || 'Try again.',
      });
    }
  };

  const finalizeInspection = async () => {
    setSaving(true);
    setPreflightIssues([]);
    try {
      if (!customerReady) {
        setPreflightIssues([{ code: 'SERVICE_ADDRESS_REQUIRED', message: 'A service address is required for this report.' }]);
        setSearchParams({ step: 'finish' }, { replace: true });
        navigate(stepHref(inspectionId, 'customer'));
        return;
      }
      if (!asText(inspection.summary) || narrativeNeedsReview(inspection.summary_status)) {
        throw new Error('Review the Findings summary before generating the report.');
      }
      const preflight = await supabase.rpc('inspection_finalization_preflight', { p_tenant_id: tenantId, p_inspection_id: inspectionId });
      if (preflight.error) throw preflight.error;
      if ((preflight.data || []).length) {
        setPreflightIssues(preflight.data);
        setSearchParams({ step: 'finish' }, { replace: true });
        return;
      }
      if (statusText(inspection.status) === 'draft') {
        const submitted = await supabase.rpc('inspection_submit', {
          p_tenant_id: tenantId, p_inspection_id: inspectionId, p_expected_revision: inspection.revision || 1,
          p_validation_snapshot: { source: 'phase5_mobile_finalize', photos_count: photos.length, findings_count: findings.length, recommendations_count: recs.length },
        });
        if (submitted.error) throw submitted.error;
      }
      const { data, error } = await supabase.rpc('inspection_finalize_phase5', {
        p_tenant_id: tenantId, p_inspection_id: inspectionId, p_expected_revision: inspection.revision || 1,
      });
      if (error) throw error;
      const pdf = await supabase.functions.invoke('inspection-report-pdf', { body: { tenant_id: tenantId, inspection_id: inspectionId, store: true, return_pdf: false } });
      if (pdf.error || pdf.data?.error) throw pdf.error || new Error(pdf.data.error);
      setInspection((current) => ({ ...current, ...data }));
      toast({ title: 'Report ready', description: 'The customer PDF was generated. No email was sent.' });
    } catch (error) {
      try { if (error?.details) setPreflightIssues(JSON.parse(error.details)); } catch { /* use toast */ }
      toast({ variant: 'destructive', title: 'Report not ready', description: error.message });
    } finally {
      setSaving(false);
    }
  };

  const availablePhotos = photos.filter((photo) => photo && photo.is_voided !== true);

  return (
    <div className="space-y-4 pb-28">
      <div className="flex items-center justify-between gap-3">
        <Button variant="outline" asChild className="gap-2">
          <Link to={stepHref(inspectionId, 'photos')}>
            <ArrowLeft className="h-4 w-4" />
            Photos
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{status}</Badge>
          <Badge variant="outline">Rev {inspection.revision || 1}</Badge>
        </div>
      </div>

      <InspectionFieldStepper
        inspectionId={inspectionId}
        currentStep={currentStep}
        completionByStep={completionByStep}
      />

      {currentStep === 'findings' ? (
        <>
          <div id="inspection-findings" className="space-y-3">
            {manualFindings.length ? (
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Findings</CardTitle>
                  <p className="text-xs text-slate-500">
                    Keep, edit, or remove each observation. Linked photos are required for report-included findings.
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  {manualFindings.map((finding) => {
                    const linkedCount = activePhotoCountForFinding(finding.id, photos);
                    const needsPhoto = manualConditionStatus(finding) === 'approved' && linkedCount === 0;
                    const highlighted = highlightedFindingIds.has(finding.id) || needsPhoto;
                    return (
                      <div
                        key={finding.id}
                        id={`inspection-finding-${finding.id}`}
                        data-finding-id={finding.id}
                        className={`rounded-xl border bg-white p-4 ${highlighted ? 'border-rose-500 ring-2 ring-rose-200' : 'border-slate-200'}`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="font-semibold text-slate-900">{finding.title}</div>
                          <Badge variant="outline">{linkedCount} photo{linkedCount === 1 ? '' : 's'}</Badge>
                        </div>
                        {finding.description ? (
                          <p className="mt-1 text-sm text-slate-600 whitespace-pre-wrap">{finding.description}</p>
                        ) : null}
                        {needsPhoto ? (
                          <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-950">
                            This finding needs a photo.
                            <div className="mt-2">
                              <LabelledPhotoPicker
                                photos={availablePhotos}
                                disabled={locked || saving}
                                onSelect={(photoId) => linkPhotoToFinding(finding.id, photoId)}
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="mt-3">
                            <LabelledPhotoPicker
                              photos={availablePhotos}
                              disabled={locked || saving}
                              onSelect={(photoId) => linkPhotoToFinding(finding.id, photoId)}
                              label="Add or select photo"
                            />
                          </div>
                        )}
                        <ManualConditionReviewControls
                          tenantId={tenantId}
                          finding={finding}
                          locked={locked || saving}
                          compact
                          onChanged={load}
                        />
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            ) : null}

            <div id="inspection-ai-review">
              <InspectionAiReviewPanel
                tenantId={tenantId}
                inspectionId={inspectionId}
                revision={inspection.revision || 1}
                locked={locked}
                photos={photos}
                onChanged={load}
              />
            </div>
          </div>

          <div className="sticky bottom-0 z-10 border-t border-slate-200 bg-white/95 p-3 backdrop-blur">
            <Button asChild size="lg" className="w-full min-h-12 bg-blue-600 hover:bg-blue-700">
              <Link to={stepHref(inspectionId, 'recommendation')}>Continue to Recommendation</Link>
            </Button>
          </div>
        </>
      ) : null}

      {currentStep === 'recommendation' ? (
        <>
          <InspectionServiceRecommendationPicker
            tenantId={tenantId}
            inspectionId={inspectionId}
            recommendations={recs}
            locked={locked || saving}
            onChanged={load}
          />
          <div className="sticky bottom-0 z-10 border-t border-slate-200 bg-white/95 p-3 backdrop-blur">
            <Button asChild size="lg" className="w-full min-h-12 bg-blue-600 hover:bg-blue-700">
              <Link to={stepHref(inspectionId, 'finish')}>Continue to Review & Finish</Link>
            </Button>
          </div>
        </>
      ) : null}

      {currentStep === 'finish' ? (
        <>
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Review & Finish</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-700">
              <ul className="space-y-2">
                {[
                  { label: 'Customer and property ready', ok: customerReady, step: 'customer' },
                  { label: 'Evidence ready', ok: photosReady, step: 'photos' },
                  { label: 'Findings reviewed', ok: findingsReviewed, step: 'findings' },
                  { label: 'Recommendation selected', ok: hasInspectionLevelRec, step: 'recommendation' },
                  { label: 'Report ready', ok: summaryReady && hasInspectionLevelRec && customerReady, step: 'finish' },
                ].map((item) => (
                  <li key={item.label} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <span>{item.label}</span>
                    {item.ok ? (
                      <Badge className="bg-emerald-600">Ready</Badge>
                    ) : (
                      <Button type="button" size="sm" variant="outline" className="min-h-10" onClick={() => {
                        if (item.step === 'customer' || item.step === 'photos') navigate(stepHref(inspectionId, item.step));
                        else setSearchParams({ step: item.step }, { replace: true });
                      }}>
                        Fix
                      </Button>
                    )}
                  </li>
                ))}
              </ul>

              {computed.warnings.length ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-900">
                  <div className="flex items-center gap-2 font-semibold">
                    <AlertTriangle className="h-4 w-4" />
                    Warnings (do not always block the report)
                  </div>
                  <ul className="mt-2 list-disc pl-5 text-sm">
                    {computed.warnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {combinedIssues.length ? (
                <InspectionPreflightBlockers
                  issues={combinedIssues}
                  context={preflightContext}
                  onNavigate={navigatePreflightGroup}
                />
              ) : null}

              <div className="grid grid-cols-2 gap-2">
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full min-h-12"
                  onClick={() => toast({ title: 'Draft saved', description: 'You can leave and resume this inspection anytime.' })}
                >
                  Save Draft
                </Button>
                <Button
                  size="lg"
                  className="w-full min-h-12 bg-amber-600 hover:bg-amber-700 gap-2"
                  onClick={finalizeInspection}
                  disabled={saving || isReviewed}
                  data-testid="generate-report-button"
                >
                  {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
                  {isReviewed ? 'Report Ready' : 'Generate Report'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <InspectionFindingsNarrativeCard
            tenantId={tenantId}
            inspection={inspection}
            findings={findings}
            photos={photos}
            suggestions={aiSuggestions}
            locked={locked || saving}
            compact
            userId={user?.id || null}
            onChanged={load}
          />

          <InspectionDeliveryPanel tenantId={tenantId} inspection={inspection} quote={quote} onChanged={load}
            onSendQuote={(options) => { setResendRequested(Boolean(options?.intentionalResend)); setSendQuoteOpen(true); }} />
        </>
      ) : null}

      <TechSendQuoteDialog
        open={sendQuoteOpen}
        onOpenChange={(open) => { setSendQuoteOpen(open); if (!open) setResendRequested(false); }}
        tenantId={tenantId}
        quote={quote}
        quoteItems={quoteItems}
        lead={inspection?.lead || null}
        serviceAddressFallback={inspection?.service_address || inspection?.job?.service_address || null}
        requiresInspectionReport
        initialIntentionalResend={resendRequested}
      />
    </div>
  );
}

function LabelledPhotoPicker({ photos, onSelect, disabled, label = 'Add or select photo' }) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium text-slate-600">{label}</div>
      <Select disabled={disabled || !photos?.length} onValueChange={onSelect}>
        <SelectTrigger className="min-h-11">
          <SelectValue placeholder={photos?.length ? 'Select a photo' : 'No photos uploaded yet'} />
        </SelectTrigger>
        <SelectContent>
          {(photos || []).map((photo) => (
            <SelectItem key={photo.id} value={photo.id}>
              {asText(photo.caption) || asText(photo.file_name) || `Photo ${String(photo.id).slice(0, 8)}`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
