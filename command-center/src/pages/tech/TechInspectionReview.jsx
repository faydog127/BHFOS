import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react';

import { supabase } from '@/lib/customSupabaseClient';
import { getTenantId } from '@/lib/tenantUtils';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { mediaQueue } from '@/lib/offlineInspectionMediaQueue';
import { v4 as uuidv4 } from 'uuid';
import TechSendQuoteDialog from '@/components/tech/TechSendQuoteDialog';

const asText = (v) => (typeof v === 'string' ? v.trim() : '');
const statusText = (v) => asText(v).toLowerCase() || 'draft';

export default function TechInspectionReview() {
  const tenantId = getTenantId();
  const { inspectionId } = useParams();
  const navigate = useNavigate();
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
          updated_at,
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
            .select('id, quote_number, status, total_amount, valid_until, service_address, customer_name, customer_email, customer_phone')
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

  const persistQueueEvidenceRows = async () => {
    if (!inspection?.id) return { persisted: 0 };
    if (!navigator.onLine) return { persisted: 0 };
    if (statusText(inspection.status) !== 'draft') return { persisted: 0 };

    const local = await mediaQueue.list({ tenantId, inspectionId });
    const needsPersist = (local || []).filter((q) => !q.photo_row_id && q.file);
    if (needsPersist.length === 0) return { persisted: 0 };

    let persisted = 0;
    for (const q of needsPersist) {
      const photoRowId = uuidv4();
      const objectPath = `${tenantId}/inspections/${inspectionId}/revision-${inspection.revision || 1}/photos/${photoRowId}.jpg`;
      const nowIso = new Date().toISOString();

      // eslint-disable-next-line no-await-in-loop
      const { error } = await supabase
        .from('inspection_photos')
        .insert({
          id: photoRowId,
          tenant_id: tenantId,
          inspection_id: inspectionId,
          finding_id: q.finding_id || null,
          technician_id: inspection.technician_id || null,
          created_by_user_id: user?.id || null,
          bucket_id: 'inspection-photos',
          object_path: objectPath,
          file_name: q.file_name || null,
          content_type: 'image/jpeg',
          byte_size: null,
          caption: asText(q.caption) || null,
          category: asText(q.category) || null,
          is_before: typeof q.is_before === 'boolean' ? q.is_before : null,
          taken_at: q.taken_at || null,
          upload_state: 'pending',
          storage_error: null,
          storage_uploaded_at: null,
          uploaded_at: nowIso,
          created_at: nowIso,
          updated_at: nowIso,
        });

      if (!error) {
        // eslint-disable-next-line no-await-in-loop
        await mediaQueue.patch(q.id, { photo_row_id: photoRowId, object_path: objectPath });
        persisted += 1;
      }
    }

    const updatedLocal = await mediaQueue.list({ tenantId, inspectionId });
    setQueueItems(updatedLocal);
    return { persisted };
  };

  const submit = async () => {
    if (!inspection?.id) return;
    if (!navigator.onLine) {
      toast({ variant: 'destructive', title: 'Offline', description: 'Submission requires connectivity.' });
      return;
    }

    setSaving(true);
    try {
      // Persist evidence records first (upload can still resolve later).
      await persistQueueEvidenceRows();

      const refreshedQueue = await mediaQueue.list({ tenantId, inspectionId });
      const unresolvedQueue = (refreshedQueue || []).filter((q) => ['queued', 'uploading', 'failed'].includes(q.status)).length;
      const failedQueue = (refreshedQueue || []).filter((q) => q.status === 'failed').length;

      const pendingDb = await supabase
        .from('inspection_photos')
        .select('id, upload_state, is_voided')
        .eq('tenant_id', tenantId)
        .eq('inspection_id', inspectionId)
        .neq('upload_state', 'complete');

      const pendingDbCount = (pendingDb.data || []).filter((p) => p && p.is_voided !== true).length;

      const snapshot = {
        status: statusText(inspection.status),
        findings_count: findings.length,
        recommendations_count: recs.length,
        photos_count: photos.filter((p) => p && p.is_voided !== true).length,
        unresolved_upload_count: unresolvedQueue,
        failed_upload_count: failedQueue,
        pending_db_upload_count: pendingDbCount,
        warnings: computed.warnings,
      };

      const { data, error } = await supabase.rpc('inspection_submit', {
        p_tenant_id: tenantId,
        p_inspection_id: inspection.id,
        p_expected_revision: inspection.revision || 1,
        p_validation_snapshot: snapshot,
      });
      if (error) throw error;
      if (!data?.id) throw new Error('Submit failed.');

      toast({ title: 'Submitted', description: 'Inspection is now locked for office QA.' });
      navigate('../queue', { replace: true });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Submit failed', description: err?.message || 'Could not submit inspection.' });
    } finally {
      setSaving(false);
    }
  };

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
          <CardTitle className="text-base">Submit For Review</CardTitle>
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
              Ready to submit. No blocking warnings detected.
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

          <div className="grid grid-cols-2 gap-2">
            <Button asChild size="lg" variant="outline" className="w-full">
              <Link to={`../inspections/${inspectionId}`}>Continue Capture</Link>
            </Button>
            <Button
              size="lg"
              className="w-full bg-amber-600 hover:bg-amber-700 gap-2"
              onClick={submit}
              disabled={saving || locked}
            >
              {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
              Submit
            </Button>
          </div>

          {locked ? (
            <div className="text-xs text-slate-500">
              This inspection is already submitted or completed.
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Send Quote</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-700">
          {quote?.id ? (
            <>
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs text-slate-500">Quote</div>
                    <div className="font-semibold">{quote.quote_number || 'Quote'}</div>
                    <div className="text-xs text-slate-500">Status: {String(quote.status || 'draft')}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-500">Total</div>
                    <div className="font-semibold">${Number(quote.total_amount || 0).toFixed(2)}</div>
                    <div className="text-xs text-slate-500">Valid thru: {quote.valid_until ? String(quote.valid_until).slice(0, 10) : 'Not set'}</div>
                  </div>
                </div>
              </div>

              <Button
                size="lg"
                className="w-full gap-2 bg-blue-600 hover:bg-blue-700"
                onClick={() => setSendQuoteOpen(true)}
                disabled={!navigator.onLine}
              >
                Send Quote
              </Button>
              {!navigator.onLine ? (
                <div className="text-xs text-slate-500">Sending requires connectivity.</div>
              ) : null}
            </>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-600">
              No quote is linked to this inspection yet.
            </div>
          )}
        </CardContent>
      </Card>

      <TechSendQuoteDialog
        open={sendQuoteOpen}
        onOpenChange={setSendQuoteOpen}
        tenantId={tenantId}
        quote={quote}
        quoteItems={quoteItems}
        lead={inspection?.lead || null}
        serviceAddressFallback={inspection?.job?.service_address || null}
      />
    </div>
  );
}
