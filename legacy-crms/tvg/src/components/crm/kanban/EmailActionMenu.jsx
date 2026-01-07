import React, { useState } from 'react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Mail, FileText, Receipt, Send, Loader2, History } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { sendDocumentEmail } from '@/services/emailService';
import { supabase } from '@/lib/customSupabaseClient';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { format } from 'date-fns';

const EmailActionMenu = ({ card, type, onEmailSent }) => {
    const { toast } = useToast();
    const [sending, setSending] = useState(false);
    const [historyOpen, setHistoryOpen] = useState(false);
    const [emailHistory, setEmailHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    // Identify IDs based on card type or relations
    const leadId = card.lead_id || (type === 'lead' ? card.id : null);
    const jobId = card.id && type === 'job' ? card.id : (card.related_job_id || null);
    const estimateId = card.estimate_id;
    const quoteId = card.quote_id; // Assuming quote_id might be on the card or resolved
    const invoiceId = card.invoice_id; // Assuming invoice_id might be on the card or resolved
    
    // Fallback email resolution
    const recipientEmail = card.customer_email || card.email || (card.subtitle && card.subtitle.includes('@') ? card.subtitle : null);

    const handleSend = async (docType) => {
        if (!recipientEmail) {
            toast({ variant: 'destructive', title: 'Missing Email', description: 'No email address found for this record.' });
            return;
        }

        setSending(true);
        try {
            // Determine the specific ID for the document type if not explicitly on card
            let specificId = null;
            if (docType === 'estimate') specificId = estimateId;
            else if (docType === 'quote') specificId = quoteId;
            else if (docType === 'invoice') specificId = invoiceId;
            else if (docType === 'job') specificId = jobId; // For receipts mostly

            // If we don't have the ID, try to find it (simplified for this context)
            if (!specificId && docType === 'estimate' && leadId) {
                const { data } = await supabase.from('estimates').select('id').eq('lead_id', leadId).order('created_at', {ascending: false}).limit(1).single();
                if (data) specificId = data.id;
            }
            if (!specificId && docType === 'invoice' && leadId) {
                const { data } = await supabase.from('invoices').select('id').eq('lead_id', leadId).order('created_at', {ascending: false}).limit(1).single();
                if (data) specificId = data.id;
            }

            if (!specificId && docType !== 'receipt') { // Receipt might just need job/lead context
                 toast({ variant: 'destructive', title: 'Document Not Found', description: `No ${docType} found linked to this card.` });
                 setSending(false);
                 return;
            }

            const result = await sendDocumentEmail({
                type: docType,
                recipientEmail,
                leadId,
                jobId,
                estimateId: docType === 'estimate' ? specificId : null,
                quoteId: docType === 'quote' ? specificId : null,
                invoiceId: docType === 'invoice' ? specificId : null,
                metadata: {
                    source: 'kanban_board',
                    card_title: card.title
                }
            });

            if (result.success) {
                toast({ title: 'Email Sent', description: `${docType.charAt(0).toUpperCase() + docType.slice(1)} sent to ${recipientEmail}` });
                if (onEmailSent) onEmailSent();
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('Email send error:', error);
            toast({ variant: 'destructive', title: 'Send Failed', description: error.message || 'Could not send email.' });
        } finally {
            setSending(false);
        }
    };

    const fetchHistory = async () => {
        setHistoryOpen(true);
        setLoadingHistory(true);
        try {
            let query = supabase.from('email_logs').select('*').order('sent_at', { ascending: false });
            
            // Build OR query for related IDs
            const conditions = [];
            if (leadId) conditions.push(`lead_id.eq.${leadId}`);
            if (jobId) conditions.push(`job_id.eq.${jobId}`);
            if (estimateId) conditions.push(`estimate_id.eq.${estimateId}`);
            
            if (conditions.length > 0) {
                query = query.or(conditions.join(','));
                const { data, error } = await query;
                if (error) throw error;
                setEmailHistory(data || []);
            } else {
                setEmailHistory([]);
            }
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not load email history.' });
        } finally {
            setLoadingHistory(false);
        }
    };

    const handleResend = (log) => {
        setHistoryOpen(false);
        handleSend(log.email_type);
    };

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-slate-200 rounded-full">
                        {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Mail className="h-3 w-3 text-slate-500" />}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleSend('estimate')} disabled={!estimateId}>
                        <FileText className="mr-2 h-4 w-4" /> Send Estimate
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleSend('quote')} disabled={!quoteId}>
                        <FileText className="mr-2 h-4 w-4" /> Send Quote
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleSend('invoice')} disabled={!invoiceId}>
                        <FileText className="mr-2 h-4 w-4" /> Send Invoice
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleSend('receipt')} disabled={type !== 'job' && !jobId}>
                        <Receipt className="mr-2 h-4 w-4" /> Send Receipt
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={fetchHistory}>
                        <History className="mr-2 h-4 w-4" /> View Email History
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Email History</DialogTitle>
                        <DialogDescription>Recent communications sent for this record.</DialogDescription>
                    </DialogHeader>
                    <div className="max-h-[300px] overflow-y-auto space-y-4">
                        {loadingHistory ? (
                            <div className="flex justify-center p-4"><Loader2 className="animate-spin text-slate-400" /></div>
                        ) : emailHistory.length === 0 ? (
                            <p className="text-sm text-slate-500 text-center py-4">No emails sent yet.</p>
                        ) : (
                            emailHistory.map((log) => (
                                <div key={log.id} className="flex items-center justify-between p-3 border rounded-lg bg-slate-50">
                                    <div>
                                        <div className="font-medium capitalize text-sm">{log.email_type}</div>
                                        <div className="text-xs text-slate-500">{format(new Date(log.sent_at), 'MMM d, h:mm a')}</div>
                                        <div className="text-xs text-slate-400 truncate max-w-[180px]">{log.recipient_email}</div>
                                    </div>
                                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleResend(log)}>
                                        <Send className="w-3 h-3 mr-1" /> Resend
                                    </Button>
                                </div>
                            ))
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