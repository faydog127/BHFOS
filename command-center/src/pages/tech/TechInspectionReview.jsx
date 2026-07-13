import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react';

import { supabase } from '@/lib/customSupabaseClient';
import { getTenantId } from '@/lib/tenantUtils';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { mediaQueue } from '@/lib/offlineInspectionMediaQueue';
import TechSendQuoteDialog from '@/components/tech/TechSendQuoteDialog';
import InspectionAiReviewPanel from '@/components/tech/InspectionAiReviewPanel';
import InspectionDeliveryPanel from '@/components/tech/InspectionDeliveryPanel';

const asText = (v) => (typeof v === 'string' ? v.trim() : '');
const statusText = (v) => asText(v).toLowerCase() || 'draft';

export default function TechInspectionReview() {
  const tenantId = getTenantId();
  const { inspectionId } = useParams();
  const { toast } = useToast();
  const { user } = useSupabaseAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [inspection, setInspection] = useState(null);
  const [findings, setFindings] = useState([]);
  const [recs, setRecs] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [queueItems, setQueueItems] = useState([]);
  const [quote, setQuote] = useState(null);
  const [quoteItems, setQuoteItems] = useState([]);
  const [sendQuoteOpen, setSendQuoteOpen] = useState(false);
  const [resendRequested, setResendRequested] = useState(false);
  const [preflightIssues, setPreflightIssues] = useState([]);

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
          updated_at,
          reviewed_at,
          reviewed_revision,
          lead:leads(first_name,last_name,company,email,phone),
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

      const [findingRes, recRes, photoRes] = await Promise.all([
        supabase
          .from('inspection_findings')
          .select('id, title, is_customer_visible')
          .eq('tenant_id', tenantId)
          .eq('inspection_id', inspectionId),
        supabase
          .from('inspection_recommendations')
          .select('id, title, is_customer_visible')
          .eq('tenant_id', tenantId)
          .eq('inspection_id', inspectionId),
        supabase
          .from('inspection_photos')
          .select('id, caption, is_voided')
          .eq('tenant_id', tenantId)
          .eq('inspection_id', inspectionId),
      ]);

      if (findingRes.error) throw findingRes.error;
      if (recRes.error) throw recRes.error;
      if (photoRes.error) throw photoRes.error;

      setFindings(findingRes.data || []);
      setRecs(recRes.data || []);
      setPhotos(photoRes.data || []);

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

  const finalizeInspection = async () => {
    setSaving(true);
    setPreflightIssues([]);
    try {
      const visibleFindings = findings.filter((finding) => finding.is_customer_visible !== false);
      const visibleRecs = recs.filter((recommendation) => recommendation.is_customer_visible !== false);
      const generatedSummary = inspection.summary || [
        visibleFindings.length ? `The inspection documented ${visibleFindings.length} technician-approved condition${visibleFindings.length === 1 ? '' : 's'}: ${visibleFindings.map((finding) => finding.title).join('; ')}.` : '',
        visibleRecs.length ? `Recommended next steps include ${visibleRecs.map((recommendation) => recommendation.title).join('; ')}.` : '',
      ].filter(Boolean).join(' ');
      if (generatedSummary && !inspection.summary) {
        const update = await supabase.from('inspections').update({
          summary: generatedSummary, summary_status: 'accepted', summary_source_revision: inspection.revision || 1,
          summary_reviewed_at: new Date().toISOString(), summary_reviewed_by: user?.id || null,
        }).eq('tenant_id', tenantId).eq('id', inspectionId);
        if (update.error) throw update.error;
      }
      const preflight = await supabase.rpc('inspection_finalization_preflight', { p_tenant_id: tenantId, p_inspection_id: inspectionId });
      if (preflight.error) throw preflight.error;
      if ((preflight.data || []).length) { setPreflightIssues(preflight.data); return; }
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
      toast({ title: 'Inspection finalized', description: 'The customer PDF is ready. No email was sent.' });
    } catch (error) {
      try { if (error?.details) setPreflightIssues(JSON.parse(error.details)); } catch { /* use toast */ }
      toast({ variant: 'destructive', title: 'Finalization incomplete', description: error.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Button variant="outline" asChild className="gap-2">
          <Link to={`../inspections/${inspectionId}`}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{status}</Badge>
          <Badge variant="outline">Rev {inspection.revision || 1}</Badge>
        </div>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Review & Finalize</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-700">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="text-xs text-slate-500">Findings</div>
              <div className="text-2xl font-bold text-slate-900">{findings.length}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="text-xs text-slate-500">Photos</div>
              <div className="text-2xl font-bold text-slate-900">{photos.filter((p) => p && p.is_voided !== true).length}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="text-xs text-slate-500">Queued</div>
              <div className="text-2xl font-bold text-slate-900">{computed.unresolved}</div>
            </div>
          </div>

          {computed.warnings.length ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-900">
              <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="h-4 w-4" />
                Warnings (snapshotted on submit)
              </div>
              <ul className="mt-2 list-disc pl-5 text-sm">
                {computed.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-900">
              Capture checks passed. Final coherence preflight still runs before finalization.
            </div>
          )}

          {(computed.internalFindings || computed.internalRecs) ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-700">
              Internal-only items:
              <div className="text-xs text-slate-500 mt-1">
                {computed.internalFindings} findings - {computed.internalRecs} recommendations
              </div>
            </div>
          ) : null}

          {preflightIssues.length ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-3"><div className="font-semibold">Resolve before finalizing</div>{preflightIssues.map((issue) => <div key={issue.code} className="mt-2"><div>{issue.message}</div><div className="text-xs font-medium">Action: {issue.action}</div></div>)}</div> : null}
          <div className="grid grid-cols-2 gap-2">
            <Button asChild size="lg" variant="outline" className="w-full">
              <Link to={`../inspections/${inspectionId}`}>Continue Capture</Link>
            </Button>
            <Button
              size="lg"
              className="w-full bg-amber-600 hover:bg-amber-700 gap-2"
              onClick={finalizeInspection}
              disabled={saving || isReviewed}
            >
              {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
              {isReviewed ? 'Finalized' : 'Finalize'}
            </Button>
          </div>

        </CardContent>
      </Card>

      <InspectionAiReviewPanel
        tenantId={tenantId}
        inspectionId={inspectionId}
        revision={inspection.revision || 1}
        locked={locked}
        onChanged={load}
      />

      <Button variant="outline" asChild className="w-full"><Link to={`/${tenantId}/crm/inspections/${inspectionId}/report`}>Open full report preview</Link></Button>

      <InspectionDeliveryPanel tenantId={tenantId} inspection={inspection} quote={quote} onChanged={load}
        onSendQuote={(options) => { setResendRequested(Boolean(options?.intentionalResend)); setSendQuoteOpen(true); }} />

      <TechSendQuoteDialog
        open={sendQuoteOpen}
        onOpenChange={(open) => { setSendQuoteOpen(open); if (!open) setResendRequested(false); }}
        tenantId={tenantId}
        quote={quote}
        quoteItems={quoteItems}
        lead={inspection?.lead || null}
        serviceAddressFallback={inspection?.job?.service_address || null}
        requiresInspectionReport
        initialIntentionalResend={resendRequested}
      />
    </div>
  );
}
