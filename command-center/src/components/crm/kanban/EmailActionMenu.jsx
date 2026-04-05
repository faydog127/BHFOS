import React, { useState } from 'react';
import { format } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { resolveLeadDelivery } from '@/lib/documentDelivery';
import {
  sendEstimateDocument,
  sendInvoiceDocument,
  sendQuoteDocument,
  sendReceiptDocument,
} from '@/services/documentDeliveryService';
import { FileText, History, Loader2, Mail, MessageSquare, Receipt, Send } from 'lucide-react';

const HISTORY_EVENT_TYPES = [
  'QuoteSent',
  'EstimateSmsSent',
  'estimate.send_previewed',
  'estimate.sent',
  'InvoiceSent',
  'InvoiceSmsSent',
  'ReceiptSent',
  'ReceiptSmsSent',
];

const formatDocTypeLabel = (docType) => {
  switch (docType) {
    case 'estimate':
      return 'Estimate';
    case 'quote':
      return 'Quote';
    case 'invoice':
      return 'Invoice';
    case 'receipt':
      return 'Receipt';
    default:
      return 'Document';
  }
};

const resolveHistoryDocType = (event) => {
  if (event.entity_type === 'quote') return 'quote';
  if (event.event_type?.startsWith('Receipt')) return 'receipt';
  if (event.entity_type === 'invoice') return 'invoice';
  return 'quote';
};

const resolveHistoryChannel = (event) => {
  const payload = event.payload || {};
  if (payload.delivery_channel) return payload.delivery_channel;
  if (String(event.event_type || '').toLowerCase().includes('sms')) return 'sms';
  return 'email';
};

const resolveHistoryRecipient = (event) => {
  const payload = event.payload || {};
  return payload.recipient_email || payload.recipient_phone || null;
};

const EmailActionMenu = ({ card, type, onEmailSent }) => {
  const { toast } = useToast();
  const [sending, setSending] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [deliveryHistory, setDeliveryHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const leadId = card.lead_id || (type === 'lead' ? card.id : null);
  const jobId = card.id && type === 'job' ? card.id : (card.related_job_id || null);
  const estimateId = card.estimate_id || null;
  const quoteId = card.quote_id || null;
  const invoiceId = card.invoice_id || null;

  const resolveLeadRecord = async () => {
    if (!leadId) {
      return {
        id: null,
        first_name: card.first_name || '',
        last_name: card.last_name || '',
        email: card.customer_email || card.email || '',
        phone: card.phone || '',
      };
    }

    const { data, error } = await supabase
      .from('leads')
      .select('id, first_name, last_name, email, phone, sms_opt_out, preferred_document_delivery, contact:contacts!leads_contact_id_fkey(preferred_contact_method)')
      .eq('id', leadId)
      .maybeSingle();

    if (error) throw error;
    return data || null;
  };

  const resolveDocumentId = async (docType) => {
    if (docType === 'estimate') {
      if (estimateId) return estimateId;
      if (!leadId) return null;
      const { data, error } = await supabase
        .from('estimates')
        .select('id')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data?.id || null;
    }

    if (docType === 'quote') {
      if (quoteId) return quoteId;
      if (!leadId) return null;
      const { data, error } = await supabase
        .from('quotes')
        .select('id')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data?.id || null;
    }

    if (docType === 'invoice') {
      if (invoiceId) return invoiceId;
      if (!leadId) return null;
      const { data, error } = await supabase
        .from('invoices')
        .select('id')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data?.id || null;
    }

    if (docType === 'receipt') {
      if (invoiceId) return invoiceId;
      if (jobId) return jobId;
      if (!leadId) return null;
      const { data, error } = await supabase
        .from('invoices')
        .select('id')
        .eq('lead_id', leadId)
        .eq('status', 'paid')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data?.id || null;
    }

    return null;
  };

  const sendDocument = async ({ docType, requestedChannel }) => {
    setSending(true);
    try {
      const lead = await resolveLeadRecord();
      const deliveryPlan = resolveLeadDelivery({ lead, requestedChannel });
      if (!deliveryPlan.channel) {
        toast({
          variant: 'destructive',
          title: 'Missing Contact',
          description: 'This customer needs a valid email address or a textable phone number.',
        });
        return;
      }

      const resolvedId = await resolveDocumentId(docType);
      if (!resolvedId && docType !== 'receipt') {
        toast({
          variant: 'destructive',
          title: 'Document Not Found',
          description: `No ${formatDocTypeLabel(docType).toLowerCase()} is linked to this card yet.`,
        });
        return;
      }

      let result;
      if (docType === 'estimate') {
        result = await sendEstimateDocument({
          estimateId: resolvedId,
          lead,
          deliveryChannel: requestedChannel,
        });
      } else if (docType === 'quote') {
        result = await sendQuoteDocument({
          quoteId: resolvedId,
          lead,
          deliveryChannel: requestedChannel,
        });
      } else if (docType === 'invoice') {
        result = await sendInvoiceDocument({
          invoiceId: resolvedId,
          lead,
          deliveryChannel: requestedChannel,
        });
      } else {
        result = await sendReceiptDocument({
          invoiceId: invoiceId || resolvedId,
          jobId: invoiceId ? null : jobId,
          lead,
          deliveryChannel: requestedChannel,
        });
      }

      const deliveryChannel = result?.delivery_channel || deliveryPlan.channel;
      const requested = result?.requested_delivery_channel || requestedChannel;
      const usedFallback = requested !== 'both' && requested !== deliveryChannel;

      toast({
        title: `${formatDocTypeLabel(docType)} Sent`,
        description:
          deliveryChannel === 'sms'
            ? (usedFallback
              ? `Email was unavailable, so the ${formatDocTypeLabel(docType).toLowerCase()} was texted instead.`
              : `${formatDocTypeLabel(docType)} texted successfully.`)
            : (usedFallback
              ? `SMS was unavailable, so the ${formatDocTypeLabel(docType).toLowerCase()} was emailed instead.`
              : `${formatDocTypeLabel(docType)} emailed successfully.`),
      });

      if (onEmailSent) onEmailSent();
    } catch (error) {
      console.error('Document send error:', error);
      toast({
        variant: 'destructive',
        title: 'Send Failed',
        description: error.message || 'Could not send the document.',
      });
    } finally {
      setSending(false);
    }
  };

  const fetchHistory = async () => {
    setHistoryOpen(true);
    setLoadingHistory(true);
    try {
      const historyRows = [];

      if (quoteId) {
        const { data, error } = await supabase
          .from('events')
          .select('id, entity_type, entity_id, event_type, payload, created_at')
          .eq('entity_type', 'quote')
          .eq('entity_id', quoteId)
          .in('event_type', HISTORY_EVENT_TYPES)
          .order('created_at', { ascending: false })
          .limit(10);
        if (error) throw error;
        historyRows.push(...(data || []));
      }

      if (invoiceId) {
        const { data, error } = await supabase
          .from('events')
          .select('id, entity_type, entity_id, event_type, payload, created_at')
          .eq('entity_type', 'invoice')
          .eq('entity_id', invoiceId)
          .in('event_type', HISTORY_EVENT_TYPES)
          .order('created_at', { ascending: false })
          .limit(10);
        if (error) throw error;
        historyRows.push(...(data || []));
      }

      setDeliveryHistory(
        historyRows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
      );
    } catch (error) {
      console.error('History load failed:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not load delivery history.' });
      setDeliveryHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleResend = (event) => {
    setHistoryOpen(false);
    sendDocument({
      docType: resolveHistoryDocType(event),
      requestedChannel: resolveHistoryChannel(event),
    });
  };

  const canAttemptEstimate = Boolean(estimateId || leadId);
  const canAttemptQuote = Boolean(quoteId || leadId);
  const canAttemptInvoice = Boolean(invoiceId || leadId);
  const canAttemptReceipt = Boolean(invoiceId || jobId || leadId);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-6 w-6 rounded-full p-0 hover:bg-slate-200">
            {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Mail className="h-3 w-3 text-slate-500" />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => sendDocument({ docType: 'estimate', requestedChannel: 'email' })} disabled={!canAttemptEstimate}>
            <FileText className="mr-2 h-4 w-4" /> Estimate via Email
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => sendDocument({ docType: 'estimate', requestedChannel: 'sms' })} disabled={!canAttemptEstimate}>
            <MessageSquare className="mr-2 h-4 w-4" /> Estimate via SMS
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => sendDocument({ docType: 'quote', requestedChannel: 'email' })} disabled={!canAttemptQuote}>
            <FileText className="mr-2 h-4 w-4" /> Quote via Email
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => sendDocument({ docType: 'quote', requestedChannel: 'sms' })} disabled={!canAttemptQuote}>
            <MessageSquare className="mr-2 h-4 w-4" /> Quote via SMS
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => sendDocument({ docType: 'invoice', requestedChannel: 'email' })} disabled={!canAttemptInvoice}>
            <Mail className="mr-2 h-4 w-4" /> Invoice via Email
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => sendDocument({ docType: 'invoice', requestedChannel: 'sms' })} disabled={!canAttemptInvoice}>
            <MessageSquare className="mr-2 h-4 w-4" /> Invoice via SMS
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => sendDocument({ docType: 'receipt', requestedChannel: 'email' })} disabled={!canAttemptReceipt}>
            <Receipt className="mr-2 h-4 w-4" /> Receipt via Email
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => sendDocument({ docType: 'receipt', requestedChannel: 'sms' })} disabled={!canAttemptReceipt}>
            <MessageSquare className="mr-2 h-4 w-4" /> Receipt via SMS
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={fetchHistory}>
            <History className="mr-2 h-4 w-4" /> View Delivery History
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delivery History</DialogTitle>
            <DialogDescription>Recent email and SMS activity for this card.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[320px] space-y-4 overflow-y-auto">
            {loadingHistory ? (
              <div className="flex justify-center p-4"><Loader2 className="animate-spin text-slate-400" /></div>
            ) : deliveryHistory.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-500">No delivery history yet.</p>
            ) : (
              deliveryHistory.map((event) => {
                const channel = resolveHistoryChannel(event);
                const recipient = resolveHistoryRecipient(event);
                return (
                  <div key={event.id} className="flex items-center justify-between rounded-lg border bg-slate-50 p-3">
                    <div>
                      <div className="text-sm font-medium">
                        {formatDocTypeLabel(resolveHistoryDocType(event))} via {channel.toUpperCase()}
                      </div>
                      <div className="text-xs text-slate-500">{format(new Date(event.created_at), 'MMM d, h:mm a')}</div>
                      {recipient && <div className="max-w-[180px] truncate text-xs text-slate-400">{recipient}</div>}
                    </div>
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleResend(event)}>
                      <Send className="mr-1 h-3 w-3" /> Resend
                    </Button>
                  </div>
                );
              })
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setHistoryOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default EmailActionMenu;
