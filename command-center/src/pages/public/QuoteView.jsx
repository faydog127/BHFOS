import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ChevronLeft, Loader2, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import QuoteDocument from '@/components/documents/QuoteDocument';
import { buildQuoteDocumentModel } from '@/lib/documentSystem';
import { fetchPublicQuoteByToken, getPublicTenantContext } from '@/lib/publicDocumentApi';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

export default function QuoteView() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [quote, setQuote] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);
  const [fulfillmentMode, setFulfillmentMode] = useState('same_visit');

  useEffect(() => {
    if (loading || !quote || searchParams.get('print') !== '1') return;

    const timer = window.setTimeout(() => {
      window.print();
    }, 250);

    return () => window.clearTimeout(timer);
  }, [loading, quote, searchParams]);

  useEffect(() => {
    if (!quote) return;

    const model = buildQuoteDocumentModel(quote, items);
    if (import.meta.env.DEV && !model.validation.valid) {
      console.warn('Quote document validation issues:', model.validation);
    }
  }, [quote, items]);

  const fetchQuote = useCallback(async () => {
    try {
      if (import.meta.env.DEV && token === '1') {
        setQuote({
          id: '1',
          quote_number: 'Q-2026-0147',
          status: 'pending_review',
          property_name: 'Harbor Ridge Apartments',
          service_address: '123 Mock Lane, Melbourne, FL 32940',
          company_name: 'Coastal Property Group',
          po_required: true,
          po_number: 'PO-44789',
          unit_reference: 'Units 201-212',
          batch_reference: 'Turn Batch 02',
          accounting_contact: 'ap@coastalproperty.example.com',
          rep_name: 'TVG Project Desk',
          rep_title: 'Scheduling & Quote Support',
          rep_email: 'info@vent-guys.com',
          rep_phone: '321-360-9704',
          assumptions_text:
            'Pricing assumes standard vacant-unit access, normal dryer vent routing, and no concealed conditions requiring demolition, specialty lifts, or after-hours access.',
          exclusions_text:
            'Hidden damage, inaccessible routing, code corrections, replacement parts, roof or wall repair, and any field condition that materially changes scope require a formal change order.',
          payment_terms:
            'Net 15 from invoice date. Approve this quote to lock unit pricing and release scheduling for the listed batch.',
          included_items: [
            'Dryer vent path cleaning',
            'Exterior termination cleaning',
            'Airflow verification',
            'Completion-ready documentation',
          ],
          excluded_items: [
            'Dryer repair or replacement',
            'Roof or drywall repair',
            'Replacement parts not listed in this quote',
          ],
          leads: {
            first_name: 'Ana',
            last_name: 'Valle',
            email: 'ana.valle@example.com',
            phone: '(321) 555-0147',
            address: { address1: '123 Mock Lane', city: 'Melbourne', state: 'FL', zip: '32940' },
          },
          valid_until: new Date(Date.now() + 86400000 * 7).toISOString(),
          tax_rate: 0.07,
          fulfillment_mode: 'same_visit',
          header_text: 'Apartment turn pricing prepared for approval, scheduling, and AP forwarding.',
        });
        setItems([
          { description: 'Dryer vent cleaning - units 201-206', quantity: 6, unit_price: 110, total_price: 660 },
          { description: 'Dryer vent cleaning - units 207-212', quantity: 6, unit_price: 110, total_price: 660 },
          { description: 'Roof termination cleanup', quantity: 2, unit_price: 75, total_price: 150 },
          { description: 'Exterior termination reset allowance', quantity: 4, unit_price: 42, total_price: 168 },
          { description: 'Pre/post photo package and airflow verification', quantity: 1, unit_price: 95, total_price: 95 },
        ]);
        setLoading(false);
        return;
      }

      const payload = await fetchPublicQuoteByToken(token);
      const quoteData = payload.quote;
      const itemsData = payload.items || [];

      setQuote(quoteData);
      setItems(itemsData);

      if (quoteData.fulfillment_mode) {
        setFulfillmentMode(quoteData.fulfillment_mode);
      }
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not load quote.' });
    } finally {
      setLoading(false);
    }
  }, [token, toast]);

  useEffect(() => {
    fetchQuote();
  }, [fetchQuote]);

  const handleAction = async (action) => {
    setApproving(true);
    try {
      if (quote.id === '1') {
        setQuote((prev) => ({
          ...prev,
          status: action === 'approve' ? 'approved' : 'declined',
          accepted_at: action === 'approve' ? new Date().toISOString() : null,
          fulfillment_mode: fulfillmentMode,
        }));
        toast({
          title: action === 'approve' ? 'Demo Quote Accepted' : 'Demo Quote Declined',
          description: 'This is a simulation.',
        });
        setApprovalModalOpen(false);
        setApproving(false);
        return;
      }

      const { supabaseUrl, anonKey } = getPublicTenantContext();

      if (action === 'approve') {
        const res = await fetch(`${supabaseUrl}/functions/v1/public-quote-approve`, {
          method: 'POST',
          headers: {
            apikey: anonKey,
            authorization: `Bearer ${anonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            quote_id: quote?.id || null,
            token,
            action: 'approved',
            fulfillment_mode: fulfillmentMode,
          }),
        });

        if (!res.ok) {
          throw new Error('Could not approve quote.');
        }

        const payload = await res.json();

        toast({
          title: 'Quote Accepted',
          description:
            fulfillmentMode === 'same_visit'
              ? 'Work authorized. Technician notified to start.'
              : 'Thank you. Our team will contact you to schedule.',
          className: 'bg-green-50 border-green-200',
        });

        setApprovalModalOpen(false);
        const qs = new URLSearchParams({
          quote_result: 'approved',
          quote_id: quote?.id || '',
          token: token || '',
        });
        if (payload?.invoice_token) {
          qs.set('invoice_token', String(payload.invoice_token));
        }
        navigate(`/quote-confirmation?${qs.toString()}`);
      } else if (action === 'decline') {
        const res = await fetch(`${supabaseUrl}/functions/v1/public-quote-approve`, {
          method: 'POST',
          headers: {
            apikey: anonKey,
            authorization: `Bearer ${anonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            quote_id: quote?.id || null,
            token,
            action: 'declined',
          }),
        });

        if (!res.ok) {
          throw new Error('Could not decline quote.');
        }
        await res.json();

        toast({ title: 'Quote Declined', description: "We've recorded your response." });
        const qs = new URLSearchParams({
          quote_result: 'declined',
          quote_id: quote?.id || '',
          token: token || '',
        });
        navigate(`/quote-confirmation?${qs.toString()}`);
      }
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setApproving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <Loader2 className="h-8 w-8 animate-spin text-slate-900" />
      </div>
    );
  }

  if (!quote) {
    return <div className="flex min-h-screen items-center justify-center text-slate-500">Quote not found or link expired.</div>;
  }

  const documentModel = buildQuoteDocumentModel(quote, items);
  const status = String(quote.status || '').toLowerCase();
  const isFinal = ['approved', 'accepted', 'declined', 'rejected', 'expired', 'superseded', 'void'].includes(status);
  const showControls = searchParams.get('print') !== '1';
  const debugLayout = searchParams.get('debug') === 'layout';
  const isSuperseded = status === 'superseded';

  return (
    <div className="min-h-screen bg-slate-100">
      {showControls ? (
        <div className="quote-doc-controls sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-[8.5in] items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <Button variant="ghost" onClick={() => navigate(-1)}>
                <ChevronLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <div className="hidden text-sm text-slate-500 sm:block">
                {documentModel.display.documentTypeLabel} {documentModel.payload.document_number}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="hidden text-right text-sm text-slate-500 sm:block">
                <div className="font-semibold text-slate-900">{documentModel.display.statusLabel}</div>
                {documentModel.display.acceptedAtLabel ? <div>Approved {documentModel.display.acceptedAtLabel}</div> : null}
              </div>
              <Button variant="outline" onClick={() => window.print()}>
                <Printer className="mr-2 h-4 w-4" />
                Print
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {showControls && isSuperseded ? (
        <div className="mx-auto max-w-[8.5in] px-4 pt-4">
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
            This quote has been superseded by a newer revision. The approval link on this version is no longer active.
          </div>
        </div>
      ) : null}

      <QuoteDocument
        documentModel={documentModel}
        isFinal={isFinal}
        approving={approving}
        onOpenApproval={() => setApprovalModalOpen(true)}
        onDecline={() => handleAction('decline')}
        printMode={searchParams.get('print') === '1'}
        debugLayout={debugLayout}
      />

      <Dialog open={approvalModalOpen} onOpenChange={setApprovalModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Approve Quote</DialogTitle>
            <DialogDescription>How would you like this approved work to move forward?</DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <RadioGroup value={fulfillmentMode} onValueChange={setFulfillmentMode} className="gap-4">
              <div className={`flex items-start space-x-3 rounded-lg border-2 p-4 transition-all ${fulfillmentMode === 'same_visit' ? 'border-slate-950 bg-slate-50' : 'border-slate-200 hover:border-slate-300'}`}>
                <RadioGroupItem value="same_visit" id="approval-same-visit" className="mt-1" />
                <div className="grid gap-1.5" onClick={() => setFulfillmentMode('same_visit')}>
                  <Label htmlFor="approval-same-visit" className="cursor-pointer font-bold text-slate-900">Approve and Start Now</Label>
                  <p className="text-sm text-slate-500">
                    I am ready for the technician to begin this work during the current visit.
                  </p>
                </div>
              </div>

              <div className={`flex items-start space-x-3 rounded-lg border-2 p-4 transition-all ${fulfillmentMode === 'schedule_later' ? 'border-slate-950 bg-slate-50' : 'border-slate-200 hover:border-slate-300'}`}>
                <RadioGroupItem value="schedule_later" id="approval-schedule-later" className="mt-1" />
                <div className="grid gap-1.5" onClick={() => setFulfillmentMode('schedule_later')}>
                  <Label htmlFor="approval-schedule-later" className="cursor-pointer font-bold text-slate-900">Approve for Later Scheduling</Label>
                  <p className="text-sm text-slate-500">
                    I accept the quoted pricing and scope, but want the office to schedule the service for a different day.
                  </p>
                </div>
              </div>
            </RadioGroup>

            <div className="mt-6 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
              By confirming, you approve the quote version shown in this document and authorize The Vent Guys to proceed based on the selected timeline.
            </div>
          </div>

          <DialogFooter className="sm:justify-between gap-2">
            <Button variant="ghost" onClick={() => setApprovalModalOpen(false)}>Cancel</Button>
            <Button onClick={() => handleAction('approve')} disabled={approving} className="bg-slate-950 hover:bg-slate-800">
              {approving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirm Approval
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
