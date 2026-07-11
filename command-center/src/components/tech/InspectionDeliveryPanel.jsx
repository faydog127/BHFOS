import React, { useEffect, useState } from 'react';
import { FileText, Loader2, Send } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { appointmentService } from '@/services/appointmentService';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';

export default function InspectionDeliveryPanel({ tenantId, inspection, quote, onChanged }) {
  const { toast } = useToast();
  const [services, setServices] = useState([]);
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState(false);
  const reviewed = Boolean(inspection?.reviewed_at && inspection?.reviewed_revision === (inspection?.revision || 1));

  useEffect(() => {
    appointmentService.fetchServices(tenantId).then(setServices).catch((error) => {
      toast({ variant: 'destructive', title: 'Price book unavailable', description: error.message });
    });
  }, [tenantId, toast]);

  const toggle = (id) => setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);

  const sendReport = async () => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('inspection-report-send', {
      body: { inspection_id: inspection.id, to_email: inspection?.lead?.email || undefined },
    });
    setBusy(false);
    if (error || data?.error) return toast({ variant: 'destructive', title: 'Report send failed', description: data?.error || error?.message });
    toast({ title: data?.skipped ? 'Report already sent' : 'Report sent', description: data?.skipped ? 'Duplicate delivery was prevented.' : 'The reviewed report was delivered.' });
  };

  const createQuote = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc('inspection_create_quote_from_price_book', {
      p_tenant_id: tenantId,
      p_inspection_id: inspection.id,
      p_expected_revision: inspection.revision || 1,
      p_price_book_ids: selected,
    });
    setBusy(false);
    if (error) return toast({ variant: 'destructive', title: 'Quote creation failed', description: error.message });
    toast({ title: quote?.id === data?.id ? 'Quote already exists' : 'Draft quote created', description: 'Open the existing Quotes module to edit and review it.' });
    onChanged?.();
  };

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader><CardTitle className="text-base">Report and quote delivery</CardTitle></CardHeader>
      <CardContent className="space-y-4 text-sm">
        <Button className="w-full gap-2" variant="outline" onClick={sendReport} disabled={busy || !reviewed || !inspection?.lead?.email}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Send reviewed report
        </Button>
        {!reviewed ? <p className="text-xs text-amber-700">The current report revision must be reviewed first.</p> : null}

        <div className="border-t border-slate-200 pt-4">
          <div className="mb-2 flex items-center gap-2 font-semibold"><FileText className="h-4 w-4" />Create Quote</div>
          <p className="mb-3 text-xs text-slate-500">Select existing price-book services. AI suggestions never set quote pricing.</p>
          <div className="max-h-52 space-y-2 overflow-y-auto rounded-lg border border-slate-200 p-3">
            {services.map((service) => (
              <label key={service.id} className="flex cursor-pointer items-start gap-2">
                <input type="checkbox" checked={selected.includes(service.id)} onChange={() => toggle(service.id)} className="mt-1" disabled={Boolean(quote?.id)} />
                <span className="flex-1"><span className="font-medium">{service.name}</span><span className="block text-xs text-slate-500">{service.code} - ${Number(service.base_price || 0).toFixed(2)}</span></span>
              </label>
            ))}
          </div>
          <Button className="mt-3 w-full" onClick={createQuote} disabled={busy || !reviewed || Boolean(quote?.id) || selected.length === 0}>
            {quote?.id ? 'Linked quote created' : 'Create Quote'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
