import { supabaseAdmin } from '../_lib/supabaseAdmin.ts';
import { createMoneyLoopTask, hasEvent, logMoneyLoopEvent } from './moneyLoopUtils.ts';
import { closeFollowUpTasks } from './taskUtils.ts';
import { escapeHtml, renderEmailLayout, sendEmail } from './email.ts';
import { sendDocumentSms } from './sms.ts';
import {
  loadLeadDeliveryProfile,
  persistDocumentDeliveryPreference,
  resolveDocumentDelivery,
} from './documentDelivery.ts';

const DEFAULT_GOOGLE_REVIEW_URL = 'https://g.page/r/CQLGsjITxWS6EBM/review';
const DEFAULT_CUSTOMER_NAME = 'Customer';
const EMAIL_DELIVERY_MODE = String(Deno.env.get('EMAIL_DELIVERY_MODE') ?? '').trim().toLowerCase();

type ReceiptInvoice = {
  id: string;
  tenant_id?: string | null;
  lead_id?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  invoice_number?: string | number | null;
  paid_at?: string | null;
  public_token?: string | null;
  leads?: {
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
};

type SendReceiptInput = {
  tenantId?: string | null;
  invoice: ReceiptInvoice;
  amountPaid?: number | null;
  paidAt?: string | null;
  method?: string | null;
  paymentsMode?: string | null;
  provider?: string | null;
  transactionId?: string | null;
  paymentIntentId?: string | null;
  runId?: string | null;
  deliveryChannel?: 'email' | 'sms' | 'both' | null;
  sendSms?: boolean | null;
  allowResend?: boolean | null;
  recipientEmail?: string | null;
  recipientPhone?: string | null;
};

const formatError = (error: unknown) => (error instanceof Error ? error.message : String(error));

const getGoogleReviewUrl = () => {
  const value = String(Deno.env.get('GOOGLE_REVIEW_URL') ?? DEFAULT_GOOGLE_REVIEW_URL).trim();
  return value || DEFAULT_GOOGLE_REVIEW_URL;
};

const getPublicPayBaseUrl = () =>
  (Deno.env.get('PUBLIC_PAY_BASE_URL') ?? Deno.env.get('PUBLIC_APP_URL') ?? 'https://app.bhfos.com').replace(/\/$/, '');

const buildReceiptLink = (token: string | null) => {
  if (!token) return '';
  return `${getPublicPayBaseUrl()}/pay/${token}`;
};

const ensureInvoiceToken = async (invoice: ReceiptInvoice, tenantId?: string | null) => {
  let token = invoice.public_token ?? null;
  if (token) return token;
  if (!tenantId) return null;
  token = crypto.randomUUID();
  const { error } = await supabaseAdmin
    .from('invoices')
    .update({ public_token: token, updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('id', invoice.id);
  if (error) {
    console.error('Failed to attach public_token for receipt SMS:', error.message || error);
    return null;
  }
  return token;
};

const formatMoney = (amount: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

const buildReceiptEmailHtml = (params: {
  customerName: string;
  invoiceNumber?: string | number | null;
  amountPaid?: number | null;
  paidAt?: string | null;
  reviewUrl: string;
}) => {
  const invoiceLabel = params.invoiceNumber ? `Invoice #${escapeHtml(params.invoiceNumber)}` : 'your invoice';
  const paidAt = params.paidAt ? new Date(params.paidAt).toLocaleString() : null;
  const amountLine =
    typeof params.amountPaid === 'number' && Number.isFinite(params.amountPaid)
      ? `<p><strong>Amount paid:</strong> ${escapeHtml(formatMoney(params.amountPaid))}</p>`
      : '';
  const paidAtLine = paidAt ? `<p><strong>Paid at:</strong> ${escapeHtml(paidAt)}</p>` : '';
  const reviewUrl = escapeHtml(params.reviewUrl);

  return renderEmailLayout({
    title: 'Payment receipt',
    preheader: `Payment received for ${invoiceLabel}.`,
    bodyHtml: `
      <p>Hi ${escapeHtml(params.customerName)},</p>
      <p>Thanks — we’ve received your payment for ${invoiceLabel}.</p>
      ${amountLine}
      ${paidAtLine}
      <p>If everything feels good, we’d appreciate a quick review.</p>
      <p>
        <a
          href="${reviewUrl}"
          style="display:inline-block; background:#173861; color:#ffffff; text-decoration:none; padding:12px 18px; border-radius:6px; font-weight:bold;"
        >
          Leave a Google Review
        </a>
      </p>
      <p style="font-size:13px; color:#666;">If you have any questions, reply to this email.</p>
    `,
  });
};

const resolveReceiptContact = async (invoice: ReceiptInvoice, tenantId?: string | null) => {
  const inlineLead = invoice.leads ?? null;
  const inlineName =
    (typeof invoice.customer_name === 'string' && invoice.customer_name.trim()
      ? invoice.customer_name.trim()
      : [inlineLead?.first_name, inlineLead?.last_name].filter(Boolean).join(' ').trim()) || DEFAULT_CUSTOMER_NAME;
  const inlineEmail =
    typeof invoice.customer_email === 'string' && invoice.customer_email.trim()
      ? invoice.customer_email.trim()
      : inlineLead?.email?.trim() || null;
  const inlinePhone =
    (typeof invoice.customer_phone === 'string' && invoice.customer_phone.trim()
      ? invoice.customer_phone.trim()
      : inlineLead?.phone?.trim()) || null;

  if (inlineEmail || inlineLead) {
    return {
      customerName: inlineName,
      receiptEmail: inlineEmail,
      receiptPhone: inlinePhone,
    };
  }

  if (!invoice.lead_id || !tenantId) {
    return {
      customerName:
        typeof invoice.customer_name === 'string' && invoice.customer_name.trim()
          ? invoice.customer_name.trim()
          : DEFAULT_CUSTOMER_NAME,
      receiptEmail: typeof invoice.customer_email === 'string' && invoice.customer_email.trim() ? invoice.customer_email.trim() : null,
      receiptPhone:
        typeof invoice.customer_phone === 'string' && invoice.customer_phone.trim()
          ? invoice.customer_phone.trim()
          : null,
    };
  }

  const { data: leadRow } = await supabaseAdmin
    .from('leads')
    .select('first_name, last_name, email, phone')
    .eq('tenant_id', tenantId)
    .eq('id', invoice.lead_id)
    .maybeSingle();

  return {
    customerName:
      [leadRow?.first_name, leadRow?.last_name].filter(Boolean).join(' ').trim() || DEFAULT_CUSTOMER_NAME,
    receiptEmail: leadRow?.email?.trim() || null,
    receiptPhone: leadRow?.phone?.trim() || null,
  };
};

const sendReceiptForPaidInvoice = async (input: SendReceiptInput) => {
  const tenantId = input.tenantId ?? input.invoice.tenant_id ?? null;

  if (input.allowResend !== true) {
    const alreadySent = await hasEvent({
      entityType: 'invoice',
      entityId: input.invoice.id,
      eventType: 'ReceiptSent',
    });

    if (alreadySent) {
      return { status: 'skipped', reason: 'already_sent' } as const;
    }
  }

  const reviewUrl = getGoogleReviewUrl();
  const receiptPayload: Record<string, unknown> = {
    run_id: input.runId ?? null,
    invoice_number: input.invoice.invoice_number ?? null,
    amount: input.amountPaid ?? null,
    method: input.method ?? null,
    payments_mode: input.paymentsMode ?? null,
    provider: input.provider ?? null,
    transaction_id: input.transactionId ?? null,
    payment_intent_id: input.paymentIntentId ?? null,
    review_url: reviewUrl,
  };

  if (input.paymentsMode === 'mock') {
    await logMoneyLoopEvent({
      tenantId,
      entityType: 'invoice',
      entityId: input.invoice.id,
      eventType: 'ReceiptSent',
      actorType: 'system',
      payload: { ...receiptPayload, sent: false, reason: 'mock_mode' },
    });
    return { status: 'suppressed', reason: 'mock_mode' } as const;
  }

  const { customerName, receiptEmail: contactEmail, receiptPhone: contactPhone } = await resolveReceiptContact(input.invoice, tenantId);
  const deliveryProfile = await loadLeadDeliveryProfile({
    tenantId,
    leadId: input.invoice.lead_id ?? null,
  });
  const requestedChannel =
    input.deliveryChannel === 'sms'
      ? 'sms'
      : input.deliveryChannel === 'email'
        ? 'email'
        : null;
  const deliveryResolution = resolveDocumentDelivery({
    requestedChannel,
    email: input.recipientEmail ?? contactEmail,
    phone: input.recipientPhone ?? contactPhone,
    preferredDocumentDelivery: deliveryProfile?.preferredDocumentDelivery ?? null,
    preferredContactMethod: deliveryProfile?.preferredContactMethod ?? null,
    smsOptOut: deliveryProfile?.smsOptOut ?? false,
  });
  const receiptEmail = deliveryResolution.recipientEmail;
  const receiptPhone = deliveryResolution.recipientPhone;
  const primaryChannel = deliveryResolution.deliveryChannel;
  const wantsEmail =
    Boolean(receiptEmail) &&
    (input.deliveryChannel === 'both' || primaryChannel === 'email');
  const wantsSms =
    Boolean(receiptPhone) &&
    (input.sendSms === true ||
      input.deliveryChannel === 'both' ||
      primaryChannel === 'sms');

  const receiptToken = wantsSms ? await ensureInvoiceToken(input.invoice, tenantId) : null;
  const receiptLink = wantsSms ? buildReceiptLink(receiptToken) : '';

  if (!wantsEmail) {
    if (wantsSms) {
      if (!receiptLink) {
        if (tenantId) {
          await createMoneyLoopTask({
            tenantId,
            sourceType: 'invoice',
            sourceId: input.invoice.id,
            title: 'Send Receipt',
            leadId: input.invoice.lead_id ?? null,
            metadata: { ...receiptPayload, reason: 'missing_document_link' },
          });
        }
        return { status: 'task_created', reason: 'missing_document_link' } as const;
      }

      const alreadySmsSent = await hasEvent({
        entityType: 'invoice',
        entityId: input.invoice.id,
        eventType: 'ReceiptSmsSent',
      });

      if (alreadySmsSent) {
        return { status: 'skipped', reason: 'sms_already_sent' } as const;
      }

      const smsResult = await sendDocumentSms({
        documentType: 'receipt',
        documentUrl: receiptLink,
        to: receiptPhone as string,
        recipientName: customerName,
        referenceNumber: input.invoice.invoice_number ?? null,
      });

      if (!smsResult.success) {
        if (tenantId) {
          await createMoneyLoopTask({
            tenantId,
            sourceType: 'invoice',
            sourceId: input.invoice.id,
            title: 'Send Receipt',
            leadId: input.invoice.lead_id ?? null,
            metadata: { ...receiptPayload, reason: 'sms_send_failed', error: smsResult.error },
          });
        }
        return { status: 'task_created', reason: 'sms_send_failed', error: smsResult.error } as const;
      }

      await logMoneyLoopEvent({
        tenantId,
        entityType: 'invoice',
        entityId: input.invoice.id,
        eventType: 'ReceiptSmsSent',
        actorType: 'system',
        payload: {
          ...receiptPayload,
          sent: true,
          provider: smsResult.provider,
          sms_sid: smsResult.sid ?? null,
          recipient_phone: smsResult.to,
        },
      });

      if (tenantId) {
        await closeFollowUpTasks({
          tenantId,
          sourceType: 'invoice',
          sourceId: input.invoice.id,
        });
      }

      if (tenantId) {
        await persistDocumentDeliveryPreference({
          tenantId,
          leadId: input.invoice.lead_id ?? null,
          deliveryChannel: 'sms',
        });
      }

      return { status: 'sent_sms', receiptPhone: smsResult.to } as const;
    }

    if (tenantId) {
      await createMoneyLoopTask({
        tenantId,
        sourceType: 'invoice',
        sourceId: input.invoice.id,
        title: 'Send Receipt',
        leadId: input.invoice.lead_id ?? null,
        metadata: { ...receiptPayload, reason: 'missing_recipient' },
      });
    }
    return { status: 'task_created', reason: 'missing_recipient' } as const;
  }

  if (wantsEmail && EMAIL_DELIVERY_MODE !== 'mock' && !Deno.env.get('RESEND_API_KEY')) {
    if (tenantId) {
      await createMoneyLoopTask({
        tenantId,
        sourceType: 'invoice',
        sourceId: input.invoice.id,
        title: 'Send Receipt',
        leadId: input.invoice.lead_id ?? null,
        metadata: { ...receiptPayload, reason: 'missing_resend_api_key' },
      });
    }
    return { status: 'task_created', reason: 'missing_resend_api_key' } as const;
  }

  try {
    const html = buildReceiptEmailHtml({
      customerName,
      invoiceNumber: input.invoice.invoice_number ?? null,
      amountPaid: input.amountPaid ?? null,
      paidAt: input.paidAt ?? input.invoice.paid_at ?? null,
      reviewUrl,
    });

    const sendRes = await sendEmail({
      to: receiptEmail,
      subject: input.invoice.invoice_number ? `Receipt for Invoice #${input.invoice.invoice_number}` : 'Payment receipt',
      html,
    });

    await logMoneyLoopEvent({
      tenantId,
      entityType: 'invoice',
      entityId: input.invoice.id,
      eventType: 'ReceiptSent',
      actorType: 'system',
      payload: {
        ...receiptPayload,
        sent: true,
        provider: 'resend',
        resend_id: (sendRes as Record<string, unknown>)?.id ?? null,
      },
    });

    if (tenantId && input.deliveryChannel !== 'both') {
      await persistDocumentDeliveryPreference({
        tenantId,
        leadId: input.invoice.lead_id ?? null,
        deliveryChannel: 'email',
      });
    }

    let smsError: string | null = null;
    if (wantsSms && receiptPhone) {
      if (!receiptLink) {
        smsError = 'missing_document_link';
        if (tenantId) {
          await createMoneyLoopTask({
            tenantId,
            sourceType: 'invoice',
            sourceId: input.invoice.id,
            title: 'Send Receipt',
            leadId: input.invoice.lead_id ?? null,
            metadata: { ...receiptPayload, reason: smsError },
          });
        }
      } else {
        const alreadySmsSent = await hasEvent({
          entityType: 'invoice',
          entityId: input.invoice.id,
          eventType: 'ReceiptSmsSent',
        });

        if (!alreadySmsSent) {
          const smsResult = await sendDocumentSms({
            documentType: 'receipt',
            documentUrl: receiptLink,
            to: receiptPhone,
            recipientName: customerName,
            referenceNumber: input.invoice.invoice_number ?? null,
          });

          if (!smsResult.success) {
            smsError = smsResult.error || 'sms_send_failed';
            if (tenantId) {
              await createMoneyLoopTask({
                tenantId,
                sourceType: 'invoice',
                sourceId: input.invoice.id,
                title: 'Send Receipt',
                leadId: input.invoice.lead_id ?? null,
                metadata: { ...receiptPayload, reason: 'sms_send_failed', error: smsError },
              });
            }
          } else {
            await logMoneyLoopEvent({
              tenantId,
              entityType: 'invoice',
              entityId: input.invoice.id,
              eventType: 'ReceiptSmsSent',
              actorType: 'system',
              payload: {
                ...receiptPayload,
                sent: true,
                provider: smsResult.provider,
                sms_sid: smsResult.sid ?? null,
                recipient_phone: smsResult.to,
              },
            });

            if (tenantId && (input.deliveryChannel === 'sms' || (!wantsEmail && primaryChannel === 'sms'))) {
              await persistDocumentDeliveryPreference({
                tenantId,
                leadId: input.invoice.lead_id ?? null,
                deliveryChannel: 'sms',
              });
            }
          }
        }
      }
    }

    if (tenantId) {
      await closeFollowUpTasks({
        tenantId,
        sourceType: 'invoice',
        sourceId: input.invoice.id,
      });
    }

    return { status: 'sent', receiptEmail, smsError } as const;
  } catch (error) {
    const message = formatError(error);
    console.error('Receipt send failed:', message);

    if (tenantId) {
      await createMoneyLoopTask({
        tenantId,
        sourceType: 'invoice',
        sourceId: input.invoice.id,
        title: 'Send Receipt',
        leadId: input.invoice.lead_id ?? null,
        metadata: { ...receiptPayload, reason: 'send_failed', error: message },
      });
    }

    return { status: 'task_created', reason: 'send_failed', error: message } as const;
  }
};

export { DEFAULT_GOOGLE_REVIEW_URL, sendReceiptForPaidInvoice };
