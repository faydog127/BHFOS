import React, { useEffect, useState } from 'react';
import { CheckCircle2, FileText, Loader2, RefreshCw, Send } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { appointmentService } from '@/services/appointmentService';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';

const formatTime = (value) => value ? new Date(value).toLocaleString() : 'Not sent';

export default function InspectionDeliveryPanel({ tenantId, inspection, quote, onChanged, onSendQuote }) {
  const { toast } = useToast();
  const [services, setServices] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState(false);
  const reviewed = Boolean(inspection?.reviewed_at && inspection?.reviewed_revision === (inspection?.revision || 1));
  const pricingReviewed = Boolean(quote?.inspection_human_reviewed_at);
  const lastDelivery = deliveries[0];

  const load = async () => {
    const [loadedServices, suggestionResult, deliveryResult] = await Promise.all([
      appointmentService.fetchServices(tenantId),
      supabase.rpc('inspection_suggest_price_book_items', { p_tenant_id: tenantId, p_inspection_id: inspection.id }),
      supabase.from('inspection_report_deliveries').select('id, delivery_kind, status, recipient, sent_at, created_at, error_message')
        .eq('tenant_id', tenantId).eq('inspection_id', inspection.id).order('created_at', { ascending: false }),
    ]);
    if (suggestionResult.error) throw suggestionResult.error;
    if (deliveryResult.error) throw deliveryResult.error;
    setServices(loadedServices);
    setSuggestions(suggestionResult.data || []);
    setDeliveries(deliveryResult.data || []);
    if (!quote?.id) {
      const confident = (suggestionResult.data || [])
        .filter((item) => item.confidence === 'high' && Number(item.candidate_count) === 1)
        .map((item) => item.price_book_id);
      setSelected([...new Set(confident)]);
    }
  };

  useEffect(() => {
    load().catch((error) => toast({ variant: 'destructive', title: 'Completion workflow unavailable', description: error.message }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, inspection?.id, quote?.id]);

  const toggle = (id) => setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);

  const sendReport = async (intentionalResend = false) => {
    const resendReason = intentionalResend ? window.prompt('Reason for intentional resend:')?.trim() : '';
    if (intentionalResend && !resendReason) return;
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('inspection-report-send', {
      body: { inspection_id: inspection.id, to_email: inspection?.lead?.email || undefined, intentional_resend: intentionalResend, resend_reason: resendReason || undefined },
    });
    setBusy(false);
    if (error || data?.error) return toast({ variant: 'destructive', title: 'Report send failed', description: data?.error || error?.message });
    toast({ title: data?.skipped ? 'Duplicate prevented' : intentionalResend ? 'Report resent' : 'Report sent' });
    await load();
  };

  const createQuote = async () => {
    setBusy(true);
    const { error } = await supabase.rpc('inspection_create_quote_from_price_book', {
      p_tenant_id: tenantId, p_inspection_id: inspection.id,
      p_expected_revision: inspection.revision || 1, p_price_book_ids: selected,
    });
    setBusy(false);
    if (error) return toast({ variant: 'destructive', title: 'Quote creation failed', description: error.message });
    toast({ title: 'Draft quote ready', description: selected.length ? 'Suggested items use current price-book prices.' : 'No confident match. Add items manually in Quotes.' });
    onChanged?.();
  };

  const confirmPricing = async () => {
    setBusy(true);
    const { error } = await supabase.rpc('inspection_confirm_quote_pricing', { p_tenant_id: tenantId, p_inspection_id: inspection.id, p_quote_id: quote.id });
    setBusy(false);
    if (error) return toast({ variant: 'destructive', title: 'Pricing review failed', description: error.message });
    toast({ title: 'Pricing confirmed', description: 'The quote is ready for the final send checklist.' });
    onChanged?.();
  };

  const suggestedIds = new Set(suggestions.map((item) => item.price_book_id));

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader><CardTitle className="text-base">Onsite completion</CardTitle></CardHeader>
      <CardContent className="space-y-5 text-sm">
        <div className="grid grid-cols-2 gap-2">
          <div className={`rounded-lg border p-3 ${reviewed ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
            <div className="font-semibold">Report</div><div className="text-xs">{reviewed ? 'Reviewed and ready' : 'Review required'}</div>
          </div>
          <div className={`rounded-lg border p-3 ${pricingReviewed ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
            <div className="font-semibold">Quote</div><div className="text-xs">{!quote?.id ? 'Not created' : pricingReviewed ? 'Pricing reviewed' : 'Human pricing review required'}</div>
          </div>
        </div>

        <Button asChild variant="outline" className="w-full"><Link to={`/${tenantId}/crm/inspections/${inspection.id}/report`}>Review Report</Link></Button>
        <Button className="w-full gap-2" variant="outline" onClick={() => sendReport(false)} disabled={busy || !reviewed || !inspection?.lead?.email}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Send Report Only
        </Button>

        <div className="border-t border-slate-200 pt-4">
          <div className="mb-1 flex items-center gap-2 font-semibold"><FileText className="h-4 w-4" />Smart quote prefill</div>
          <p className="mb-3 text-xs text-slate-500">Only approved findings are matched. Prices come from the active price book and require human confirmation.</p>
          {suggestions.some((item) => Number(item.candidate_count) > 1) ? <p className="mb-2 text-xs text-amber-700">Some findings have multiple eligible choices. Select the correct onsite scope.</p> : null}
          {!suggestions.length ? <p className="mb-2 text-xs text-amber-700">No confident match. A blank linked draft can be created for manual selection.</p> : null}
          <div className="max-h-56 space-y-2 overflow-y-auto rounded-lg border border-slate-200 p-3">
            {services.map((service) => (
              <label key={service.id} className="flex cursor-pointer items-start gap-2">
                <input type="checkbox" checked={selected.includes(service.id)} onChange={() => toggle(service.id)} className="mt-1" disabled={Boolean(quote?.id)} />
                <span className="flex-1"><span className="font-medium">{service.name}</span>{suggestedIds.has(service.id) ? <span className="ml-2 rounded bg-sky-100 px-1.5 py-0.5 text-[10px] text-sky-800">Suggested</span> : null}<span className="block text-xs text-slate-500">{service.code} - ${Number(service.base_price || 0).toFixed(2)}</span></span>
              </label>
            ))}
          </div>
          <Button className="mt-3 w-full" onClick={createQuote} disabled={busy || !reviewed || Boolean(quote?.id)}>{quote?.id ? 'Linked quote created' : 'Create Quote'}</Button>
          {quote?.id ? <Button asChild variant="outline" className="mt-2 w-full"><Link to={`/${tenantId}/crm/estimates/${quote.id}`}>Open Quote Editor</Link></Button> : null}
          {quote?.id && !pricingReviewed ? <Button className="mt-2 w-full gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={confirmPricing} disabled={busy}><CheckCircle2 className="h-4 w-4" />Confirm scope and pricing reviewed</Button> : null}
          <Button className="mt-2 w-full gap-2 bg-blue-600 hover:bg-blue-700" onClick={onSendQuote} disabled={busy || !reviewed || !quote?.id || !pricingReviewed}><Send className="h-4 w-4" />Send Report + Quote</Button>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
          <div className="font-semibold">Delivery status: {lastDelivery?.status || 'Not sent'}</div>
          <div>Last sent: {formatTime(lastDelivery?.sent_at)}</div>
          <div>{lastDelivery?.delivery_kind === 'quote_with_report' ? 'Report + quote' : lastDelivery ? 'Report only' : 'No delivery result'}</div>
          {lastDelivery?.error_message ? <div className="text-rose-700">{lastDelivery.error_message}</div> : null}
          {lastDelivery?.status === 'sent' ? <Button size="sm" variant="ghost" className="mt-2 gap-2" onClick={() => lastDelivery.delivery_kind === 'report_only' ? sendReport(true) : onSendQuote?.({ intentionalResend: true })}><RefreshCw className="h-3 w-3" />Intentional resend</Button> : null}
        </div>
      </CardContent>
    </Card>
  );
}
