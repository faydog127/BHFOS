import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { ArrowLeft, Loader2, MapPin, Phone, PlayCircle } from 'lucide-react';

import { supabase } from '@/lib/customSupabaseClient';
import { getTenantId } from '@/lib/tenantUtils';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import TechSendQuoteDialog from '@/components/tech/TechSendQuoteDialog';

const asText = (v) => (typeof v === 'string' ? v.trim() : '');

const phoneHref = (value) => {
  const digits = String(value || '').replace(/[^\d]/g, '');
  return digits ? `tel:${digits}` : null;
};

const formatSchedule = (job) => {
  const start = job?.scheduled_start ? new Date(job.scheduled_start) : null;
  const end = job?.scheduled_end ? new Date(job.scheduled_end) : null;
  if (!start || Number.isNaN(start.valueOf())) return 'Unscheduled';
  if (!end || Number.isNaN(end.valueOf())) return format(start, 'EEE, MMM d - h:mm a');
  return `${format(start, 'EEE, MMM d - h:mm a')} - ${format(end, 'h:mm a')}`;
};

export default function TechJobDetail() {
  const tenantId = getTenantId();
  const { jobId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useSupabaseAuth();

  const [loading, setLoading] = useState(true);
  const [job, setJob] = useState(null);
  const [technician, setTechnician] = useState(null);
  const [latestDraft, setLatestDraft] = useState(null);
  const [quote, setQuote] = useState(null);
  const [quoteItems, setQuoteItems] = useState([]);
  const [sendQuoteOpen, setSendQuoteOpen] = useState(false);

  const customer = useMemo(() => {
    const lead = job?.lead || {};
    return asText(lead?.company) || `${asText(lead?.first_name)} ${asText(lead?.last_name)}`.trim() || asText(lead?.email) || 'Customer';
  }, [job]);

  const load = async () => {
    if (!jobId) return;
    setLoading(true);
    try {
      const { data: techData, error: techError } = await supabase
        .from('technicians')
        .select('id, user_id, full_name')
        .eq('user_id', user?.id || '')
        .maybeSingle();
      if (techError) throw techError;
      setTechnician(techData || null);

      const { data, error } = await supabase
        .from('jobs')
        .select(
          `
          id,
          tenant_id,
          status,
          quote_id,
          scheduled_start,
          scheduled_end,
          service_address,
          work_order_number,
          lead:leads(id, first_name, last_name, company, email, phone)
        `,
        )
        .eq('tenant_id', tenantId)
        .eq('id', jobId)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Job not found.');

      const normalized = {
        ...data,
        lead: Array.isArray(data.lead) ? data.lead[0] : data.lead,
      };
      setJob(normalized);

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

      if (techData?.id) {
        const { data: insp, error: inspError } = await supabase
          .from('inspections')
          .select('id, status, revision, updated_at')
          .eq('tenant_id', tenantId)
          .eq('job_id', jobId)
          .eq('technician_id', techData.id)
          .eq('status', 'draft')
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (inspError) throw inspError;
        setLatestDraft(insp || null);
      } else {
        setLatestDraft(null);
      }
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Job load failed', description: err?.message || 'Could not load job.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, tenantId, user?.id]);

  const startInspection = async () => {
    if (!job?.id || !technician?.id) return;
    setLoading(true);
    try {
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from('inspections')
        .insert({
          tenant_id: tenantId,
          job_id: job.id,
          lead_id: job?.lead?.id || null,
          technician_id: technician.id,
          created_by_user_id: user?.id || null,
          status: 'draft',
          title: `Inspection - ${customer}`,
          started_at: nowIso,
          created_at: nowIso,
          updated_at: nowIso,
        })
        .select('id')
        .single();
      if (error) throw error;
      if (!data?.id) throw new Error('Inspection create failed.');

      navigate(`../inspections/${data.id}`, { replace: true });
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Start failed', description: err?.message || 'Could not start inspection.' });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading job...
      </div>
    );
  }

  if (!job) {
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
            <CardTitle className="text-base">Job Not Found</CardTitle>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const phone = asText(job?.lead?.phone);
  const phoneLink = phoneHref(phone);

  return (
    <div className="space-y-4">
      <Button variant="outline" asChild className="gap-2">
        <Link to="../queue">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
      </Button>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg flex items-start justify-between gap-3">
            <span className="truncate">{customer}</span>
            {job.work_order_number ? <Badge variant="outline">{job.work_order_number}</Badge> : null}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-700">
          <div className="flex items-start gap-2">
            <MapPin className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
            <span className="truncate">{asText(job.service_address) || 'No address on file'}</span>
          </div>
          <div className="text-slate-500">{formatSchedule(job)}</div>
          {phone ? (
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-slate-400" />
              {phoneLink ? (
                <a href={phoneLink} className="underline decoration-slate-300">
                  {phone}
                </a>
              ) : (
                <span>{phone}</span>
              )}
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
              No quote is linked to this job.
            </div>
          )}
        </CardContent>
      </Card>

      {latestDraft?.id ? (
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Draft Inspection Found</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-slate-600">
              Resume your draft inspection session for this job.
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button asChild variant="outline" size="lg">
                <Link to={`../inspections/${latestDraft.id}`}>Open Draft</Link>
              </Button>
              <Button asChild size="lg" className="bg-blue-600 hover:bg-blue-700">
                <Link to={`../inspections/${latestDraft.id}/review`}>Review</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Button size="lg" className="w-full bg-blue-600 hover:bg-blue-700 gap-2" onClick={startInspection} disabled={!technician?.id}>
          <PlayCircle className="h-5 w-5" />
          Start Inspection
        </Button>
      )}

      <TechSendQuoteDialog
        open={sendQuoteOpen}
        onOpenChange={setSendQuoteOpen}
        tenantId={tenantId}
        quote={quote}
        quoteItems={quoteItems}
        lead={job?.lead || null}
        serviceAddressFallback={job?.service_address || null}
      />
    </div>
  );
}
