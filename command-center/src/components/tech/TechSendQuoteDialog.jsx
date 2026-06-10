import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Send, ShieldAlert } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/components/ui/use-toast';
import { sendQuoteDocument } from '@/services/documentDeliveryService';

const asText = (v) => (typeof v === 'string' ? v.trim() : '');
const asNumber = (v) => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

const normalizeStatus = (v) => asText(v).toLowerCase();

const formatMoney = (value) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(asNumber(value));

const formatDateShort = (value) => {
  const raw = asText(value);
  if (!raw) return '';
  const d = new Date(raw);
  if (Number.isNaN(d.valueOf())) return raw;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' });
};

const isExpired = (validUntil) => {
  const raw = asText(validUntil);
  if (!raw) return false;
  const d = new Date(raw);
  if (Number.isNaN(d.valueOf())) return false;
  return d.getTime() < Date.now();
};

const isSameRecipient = (a, b) => asText(a).toLowerCase() === asText(b).toLowerCase();

export default function TechSendQuoteDialog({
  open,
  onOpenChange,
  tenantId,
  quote,
  quoteItems,
  lead,
  serviceAddressFallback,
}) {
  const { toast } = useToast();
  const [step, setStep] = useState('recipient'); // recipient | confirm
  const [sending, setSending] = useState(false);
  const [channel, setChannel] = useState('email'); // email | sms
  const [recipientMode, setRecipientMode] = useState('customer'); // customer | internal_review | manual
  const [toEmail, setToEmail] = useState('');
  const [toPhone, setToPhone] = useState('');
  const [subjectPrefix, setSubjectPrefix] = useState('');
  const [attachInspectionReportPdf, setAttachInspectionReportPdf] = useState(false);

  const [checks, setChecks] = useState({
    scope: false,
    report: false,
    price: false,
    customer: false,
    address: false,
    expiration: false,
  });

  const [ackNonCustomer, setAckNonCustomer] = useState(false);
  const [ackDecisionState, setAckDecisionState] = useState(false);

  const quoteStatus = normalizeStatus(quote?.status);
  const quoteTotal = asNumber(quote?.total_amount);
  const quoteNumber = asText(quote?.quote_number) || asText(quote?.quoteNumber) || '';
  const quoteValidUntil = asText(quote?.valid_until);

  const leadEmail = asText(lead?.email);
  const leadPhone = asText(lead?.phone);
  const customerName =
    asText(lead?.company) ||
    `${asText(lead?.first_name)} ${asText(lead?.last_name)}`.trim() ||
    asText(quote?.customer_name) ||
    leadEmail ||
    'Customer';

  const serviceAddress = asText(quote?.service_address) || asText(serviceAddressFallback) || '';

  const decisionLocked = useMemo(() => {
    // "Do not allow accepted/voided/expired without warning or block."
    // We block expired/superseded/void; warn for decisions already recorded.
    return ['approved', 'accepted', 'declined', 'rejected', 'paid'].includes(quoteStatus);
  }, [quoteStatus]);

  const hardBlocked = useMemo(() => {
    if (!quote?.id) return { blocked: true, reason: 'Quote is not linked.' };
    if (['void', 'voided', 'superseded'].includes(quoteStatus)) {
      return { blocked: true, reason: `This quote is ${quoteStatus || 'not sendable'}.` };
    }
    if (quoteStatus === 'expired' || isExpired(quoteValidUntil)) {
      return { blocked: true, reason: 'This quote is expired. Ask office to issue a new revision before sending.' };
    }
    return { blocked: false, reason: '' };
  }, [quote?.id, quoteStatus, quoteValidUntil]);

  const recipientIsCustomer = useMemo(() => {
    if (channel === 'sms') {
      return Boolean(leadPhone) && isSameRecipient(toPhone, leadPhone);
    }
    return Boolean(leadEmail) && isSameRecipient(toEmail, leadEmail);
  }, [channel, leadEmail, leadPhone, toEmail, toPhone]);

  const recipientLabel = useMemo(() => {
    if (channel === 'sms') return toPhone ? `SMS ${toPhone}` : 'SMS (missing)';
    return toEmail ? `Email ${toEmail}` : 'Email (missing)';
  }, [channel, toEmail, toPhone]);

  const canProceedRecipient = useMemo(() => {
    if (hardBlocked.blocked) return false;
    if (channel === 'sms') return Boolean(asText(toPhone));
    return Boolean(asText(toEmail));
  }, [channel, hardBlocked.blocked, toEmail, toPhone]);

  const allChecksPassed = Object.values(checks).every(Boolean);

  useEffect(() => {
    if (!open) return;
    setStep('recipient');
    setSending(false);
    setChannel('email');
    setRecipientMode('customer');
    setToEmail(leadEmail || asText(quote?.customer_email) || '');
    setToPhone(leadPhone || asText(quote?.customer_phone) || '');
    setSubjectPrefix('');
    setAttachInspectionReportPdf(false);
    setChecks({
      scope: false,
      report: false,
      price: false,
      customer: false,
      address: false,
      expiration: false,
    });
    setAckNonCustomer(false);
    setAckDecisionState(false);
  }, [open, leadEmail, leadPhone, quote?.customer_email, quote?.customer_phone]);

  useEffect(() => {
    if (!open) return;
    if (recipientMode === 'customer') {
      setToEmail(leadEmail || asText(quote?.customer_email) || '');
      setToPhone(leadPhone || asText(quote?.customer_phone) || '');
      setSubjectPrefix('');
    }
  }, [leadEmail, leadPhone, open, quote?.customer_email, quote?.customer_phone, recipientMode]);

  useEffect(() => {
    if (!open) return;
    if (recipientMode === 'internal_review' && channel !== 'email') {
      setChannel('email');
    }
    if (recipientMode === 'internal_review') {
      setSubjectPrefix((prev) => (asText(prev) ? prev : 'REVIEW COPY:'));
      // Keep recipient fields user-entered; do not hardcode to a specific address.
      if (!asText(toEmail)) setToEmail('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel, open, recipientMode]);

  const toggleCheck = (key) => setChecks((prev) => ({ ...prev, [key]: !prev[key] }));

  const send = async () => {
    if (!quote?.id) return;
    if (hardBlocked.blocked) return;

    if (!allChecksPassed) {
      toast({ variant: 'destructive', title: 'Checklist incomplete', description: 'Review checklist must be completed before sending.' });
      return;
    }

    if (!recipientIsCustomer && !ackNonCustomer) {
      toast({ variant: 'destructive', title: 'Confirm recipient', description: 'For non-customer sends, acknowledge this is a review/test send.' });
      return;
    }

    if (decisionLocked && !ackDecisionState) {
      toast({ variant: 'destructive', title: 'Decision already recorded', description: 'Acknowledge quote decision state before sending.' });
      return;
    }

    const isReviewSend = !recipientIsCustomer;
    const prefix = asText(subjectPrefix);
    const defaultSubject = `${quoteNumber ? `Quote ${quoteNumber}` : 'Quote'} from The Vent Guys`;
    const subject = prefix ? `${prefix} ${defaultSubject}` : (isReviewSend ? `REVIEW COPY: ${defaultSubject}` : defaultSubject);

    const bodyLines = [];
    if (isReviewSend) {
      bodyLines.push('<p><strong>INTERNAL REVIEW COPY</strong></p>');
      bodyLines.push('<p>This was sent to a non-customer recipient for review/testing.</p>');
    }
    bodyLines.push(`<p>Hi ${customerName},</p>`);
    bodyLines.push('<p>Your quote is ready. Use the secure link below to review and approve.</p>');

    setSending(true);
    try {
      const result = await sendQuoteDocument({
        quoteId: quote.id,
        lead,
        deliveryChannel: channel,
        attachPdf: false,
        attachInspectionReportPdf: channel === 'email' ? attachInspectionReportPdf : false,
        recipientEmail: channel === 'email' ? asText(toEmail) : null,
        recipientPhone: channel === 'sms' ? asText(toPhone) : null,
        customSubject: channel === 'email' ? subject : undefined,
        customBodyHtml: channel === 'email' ? bodyLines.join('') : undefined,
        tenantId,
      });

      toast({
        title: 'Quote sent',
        description: `${recipientLabel}${isReviewSend ? ' (review copy)' : ''}`,
        className: 'bg-green-50 border-green-200',
      });

      onOpenChange(false);
      return result;
    } catch (err) {
      toast({ variant: 'destructive', title: 'Send failed', description: err?.message || 'Could not send quote.' });
      return null;
    } finally {
      setSending(false);
    }
  };

  const itemsPreview = useMemo(() => {
    const items = Array.isArray(quoteItems) ? quoteItems : [];
    return items.slice(0, 6);
  }, [quoteItems]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>Send Quote</DialogTitle>
          <DialogDescription>
            Link-only send. No PDF attachment.
          </DialogDescription>
        </DialogHeader>

        {hardBlocked.blocked ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900 flex gap-2">
            <ShieldAlert className="h-4 w-4 mt-0.5" />
            <div>
              <div className="font-semibold">Blocked</div>
              <div>{hardBlocked.reason}</div>
            </div>
          </div>
        ) : null}

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-xs text-slate-500">Quote</div>
              <div className="font-semibold">{quoteNumber || 'Quote'}</div>
              <div className="text-xs text-slate-500">Status: {quoteStatus || 'draft'}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-500">Total</div>
              <div className="font-semibold">{formatMoney(quoteTotal)}</div>
              <div className="text-xs text-slate-500">Valid thru: {quoteValidUntil ? formatDateShort(quoteValidUntil) : 'Not set'}</div>
            </div>
            <div className="col-span-2">
              <div className="text-xs text-slate-500">Customer</div>
              <div className="font-semibold truncate">{customerName}</div>
            </div>
            <div className="col-span-2">
              <div className="text-xs text-slate-500">Service address</div>
              <div className="font-semibold truncate">{serviceAddress || 'No address on file'}</div>
            </div>
          </div>
        </div>

        {step === 'recipient' ? (
          <div className="space-y-4">
            {decisionLocked ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                Warning: this quote already has a recorded decision ({quoteStatus}). Sending again may confuse the customer.
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Send via</Label>
                <RadioGroup value={channel} onValueChange={setChannel} className="grid grid-cols-2 gap-2">
                  <Label className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
                    <RadioGroupItem value="email" />
                    Email
                  </Label>
                  <Label className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
                    <RadioGroupItem value="sms" />
                    SMS
                  </Label>
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label>Recipient</Label>
                <RadioGroup value={recipientMode} onValueChange={setRecipientMode} className="grid grid-cols-3 gap-2">
                  <Label className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
                    <RadioGroupItem value="customer" />
                    Customer
                  </Label>
                  <Label className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
                    <RadioGroupItem value="internal_review" />
                    Review
                  </Label>
                  <Label className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
                    <RadioGroupItem value="manual" />
                    Manual
                  </Label>
                </RadioGroup>
              </div>
            </div>

            {channel === 'email' ? (
              <div className="space-y-2">
                <Label htmlFor="to_email">To email</Label>
                <Input
                  id="to_email"
                  value={toEmail}
                  onChange={(e) => setToEmail(e.target.value)}
                  placeholder="customer@example.com"
                />
                {recipientMode === 'internal_review' ? (
                  <div className="text-xs text-slate-600">
                    Use for internal review/testing. This will be labeled as a review copy.
                  </div>
                ) : null}
                {!recipientIsCustomer ? (
                  <div className="text-xs text-amber-700">
                    Non-customer recipient. This will be treated as a review/test send and requires extra confirmation.
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="to_phone">To phone</Label>
                <Input
                  id="to_phone"
                  value={toPhone}
                  onChange={(e) => setToPhone(e.target.value)}
                  placeholder="(555) 123-4567"
                />
                {!recipientIsCustomer ? (
                  <div className="text-xs text-amber-700">
                    Non-customer recipient. Review/test labeling is limited for SMS.
                  </div>
                ) : null}
              </div>
            )}

            {channel === 'email' ? (
              <div className="space-y-2">
                <Label htmlFor="subject_prefix">Subject prefix (optional)</Label>
                <Input
                  id="subject_prefix"
                  value={subjectPrefix}
                  onChange={(e) => setSubjectPrefix(e.target.value)}
                  placeholder="REVIEW COPY:"
                />
              </div>
            ) : null}

            {Array.isArray(itemsPreview) && itemsPreview.length ? (
              <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
                <div className="font-semibold text-slate-900">Line item preview</div>
                <ul className="mt-2 list-disc pl-5 text-slate-700">
                  {itemsPreview.map((it, idx) => (
                    <li key={`${idx}-${asText(it?.description)}`}>
                      {asText(it?.description) || 'Service'} ({asNumber(it?.quantity) || 1} @ {formatMoney(it?.unit_price)})
                    </li>
                  ))}
                </ul>
                {quoteItems && quoteItems.length > itemsPreview.length ? (
                  <div className="mt-2 text-xs text-slate-500">And {quoteItems.length - itemsPreview.length} more...</div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <div className="font-semibold">Final checkpoint</div>
              <div className="mt-1">
                You are about to send this quote to: <span className="font-semibold">{recipientLabel}</span>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
              <div className="font-semibold text-slate-900">Review checklist</div>
              <div className="mt-2 grid grid-cols-1 gap-2">
                <Label className="flex items-center gap-2">
                  <input type="checkbox" checked={checks.scope} onChange={() => toggleCheck('scope')} />
                  Scope is correct
                </Label>
                <Label className="flex items-center gap-2">
                  <input type="checkbox" checked={checks.report} onChange={() => toggleCheck('report')} />
                  Photos/report are ready (if applicable)
                </Label>
                <Label className="flex items-center gap-2">
                  <input type="checkbox" checked={checks.price} onChange={() => toggleCheck('price')} />
                  Price is correct ({formatMoney(quoteTotal)})
                </Label>
                <Label className="flex items-center gap-2">
                  <input type="checkbox" checked={checks.customer} onChange={() => toggleCheck('customer')} />
                  Customer name is correct ({customerName})
                </Label>
                <Label className="flex items-center gap-2">
                  <input type="checkbox" checked={checks.address} onChange={() => toggleCheck('address')} />
                  Property/service address is correct
                </Label>
                <Label className="flex items-center gap-2">
                  <input type="checkbox" checked={checks.expiration} onChange={() => toggleCheck('expiration')} />
                  Expiration date is correct ({quoteValidUntil ? formatDateShort(quoteValidUntil) : 'Not set'})
                </Label>
              </div>
            </div>

            {channel === 'email' ? (
              <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
                <div className="font-semibold text-slate-900">Attachments</div>
                <div className="mt-2">
                  <Label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={attachInspectionReportPdf}
                      onChange={() => setAttachInspectionReportPdf((v) => !v)}
                    />
                    Attach inspection report PDF
                  </Label>
                  <div className="mt-1 text-xs text-slate-500">
                    Generates/attaches a customer-facing inspection report PDF (includes photos embedded server-side). No photo links are exposed.
                  </div>
                </div>
              </div>
            ) : null}

            {!recipientIsCustomer ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800">
                <Label className="flex items-center gap-2">
                  <input type="checkbox" checked={ackNonCustomer} onChange={() => setAckNonCustomer((v) => !v)} />
                  This is a review/test send to a non-customer recipient.
                </Label>
              </div>
            ) : null}

            {decisionLocked ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800">
                <Label className="flex items-center gap-2">
                  <input type="checkbox" checked={ackDecisionState} onChange={() => setAckDecisionState((v) => !v)} />
                  I understand this quote already has a recorded decision ({quoteStatus}).
                </Label>
              </div>
            ) : null}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          {step === 'confirm' ? (
            <Button variant="outline" onClick={() => setStep('recipient')} disabled={sending}>
              Back
            </Button>
          ) : (
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
              Close
            </Button>
          )}

          {step === 'recipient' ? (
            <Button
              onClick={() => setStep('confirm')}
              disabled={sending || !canProceedRecipient}
              className="gap-2"
            >
              Next
            </Button>
          ) : (
            <Button
              onClick={send}
              disabled={sending || hardBlocked.blocked || !allChecksPassed || (!recipientIsCustomer && !ackNonCustomer) || (decisionLocked && !ackDecisionState)}
              className="gap-2 bg-blue-600 hover:bg-blue-700"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Confirm Send
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
