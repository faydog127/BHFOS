import React, { useEffect, useState } from 'react';
import { AlertCircle, FileText, Loader2, RefreshCw, Send } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';

const formatTime = (value) => value ? new Date(value).toLocaleString() : 'Not sent';

export default function InspectionDeliveryPanel({ tenantId, inspection, quote, onChanged }) {
  const { toast } = useToast();
  const [deliveries, setDeliveries] = useState([]);
  const [busy, setBusy] = useState(false);
  const reviewed = Boolean(inspection?.reviewed_at && inspection?.reviewed_revision === (inspection?.revision || 1));
  const recipientEmail = inspection?.lead?.email?.trim();
  const lastDelivery = deliveries[0];
  const sendBlocker = !reviewed
    ? 'Review and finalize this inspection revision before sending.'
    : !recipientEmail
      ? 'Add a customer email address before sending.'
      : '';

  const load = async () => {
    const { data, error } = await supabase
      .from('inspection_report_deliveries')
      .select('id, delivery_kind, status, recipient, sent_at, created_at, error_message')
      .eq('tenant_id', tenantId)
      .eq('inspection_id', inspection.id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    setDeliveries(data || []);
  };

  useEffect(() => {
    load().catch((error) => toast({ variant: 'destructive', title: 'Delivery status unavailable', description: error.message }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, inspection?.id]);

  const sendReport = async (intentionalResend = false) => {
    const resendReason = intentionalResend ? window.prompt('Reason for intentional resend:')?.trim() : '';
    if (intentionalResend && !resendReason) return;
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('inspection-report-send', {
      body: {
        inspection_id: inspection.id,
        to_email: recipientEmail || undefined,
        intentional_resend: intentionalResend,
        resend_reason: resendReason || undefined,
      },
    });
    setBusy(false);
    if (error || data?.error) {
      return toast({
        variant: 'destructive',
        title: 'Report send failed',
        description: data?.error || error?.message || 'The customer report could not be sent. Review the report status and try again.',
      });
    }
    toast({ title: data?.skipped ? 'Duplicate prevented' : intentionalResend ? 'Report resent' : 'Report sent' });
    await load();
    onChanged?.();
  };

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">Customer report delivery</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5 text-sm">
        <div className={`rounded-lg border p-4 ${reviewed ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
          <div className="font-semibold">{reviewed ? 'Report finalized' : 'Technician review required'}</div>
          <div className="mt-1 text-xs">
            {reviewed ? 'This revision is eligible for PDF generation and customer delivery.' : 'Resolve findings and finalize the current revision before delivery.'}
          </div>
        </div>

        <Button asChild variant="outline" className="w-full gap-2">
          <Link to={`/${tenantId}/tech/inspections/${inspection.id}/review`}>
            <FileText className="h-4 w-4" />
            {reviewed ? 'Review Finalized Report' : 'Review & Finalize'}
          </Link>
        </Button>

        <Button
          className="w-full gap-2 bg-blue-600 hover:bg-blue-700"
          onClick={() => sendReport(false)}
          disabled={busy || Boolean(sendBlocker)}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Send Report to Customer
        </Button>

        {sendBlocker ? (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{sendBlocker}</span>
          </div>
        ) : (
          <p className="text-xs text-slate-500">The authoritative inspection PDF will be sent to {recipientEmail}. No estimate is required or attached.</p>
        )}

        <div className="border-t border-slate-200 pt-4">
          <div className="mb-1 font-semibold">Estimate</div>
          <p className="mb-3 text-xs text-slate-500">Pricing, price-book selection, approval, and estimate delivery are managed in Estimates.</p>
          {quote?.id ? (
            <Button asChild variant="outline" className="w-full">
              <Link to={`/${tenantId}/crm/estimates/${quote.id}`}>Open Linked Estimate</Link>
            </Button>
          ) : (
            <Button asChild variant="outline" className="w-full">
              <Link to={`/${tenantId}/crm/estimates/new?inspection_id=${inspection.id}`}>Create Estimate</Link>
            </Button>
          )}
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
          <div className="font-semibold">Delivery status: {lastDelivery?.status || 'Not sent'}</div>
          <div>Last sent: {formatTime(lastDelivery?.sent_at)}</div>
          <div>{lastDelivery ? 'Report only' : 'No delivery result'}</div>
          {lastDelivery?.error_message ? <div className="text-rose-700">{lastDelivery.error_message}</div> : null}
          {lastDelivery?.status === 'sent' && lastDelivery?.delivery_kind === 'report_only' ? (
            <Button size="sm" variant="ghost" className="mt-2 gap-2" onClick={() => sendReport(true)}>
              <RefreshCw className="h-3 w-3" />Intentional resend
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
