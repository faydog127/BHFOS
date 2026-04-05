import { supabase } from '@/lib/customSupabaseClient';
import { getTenantId } from '@/lib/tenantUtils';
import { quoteService } from '@/services/quoteService';

const invokeDocumentFunction = async (functionName, body) => {
  const { data, error } = await supabase.functions.invoke(functionName, { body });
  if (error) {
    throw new Error(error.message || `${functionName} invocation failed.`);
  }
  if (data?.error) {
    throw new Error(data.error);
  }
  return data || {};
};

const getLeadPayload = ({ lead, recipientEmail, recipientPhone }) => ({
  lead_id: lead?.id || null,
  email: recipientEmail || lead?.email || null,
  to_phone: recipientPhone || lead?.phone || null,
});

const findOrCreateQuoteForEstimate = async (estimateId, tenantId) => {
  const { data: existingQuotes, error: lookupError } = await supabase
    .from('quotes')
    .select('id')
    .eq('estimate_id', estimateId)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(1);

  if (lookupError) {
    throw lookupError;
  }

  const existingQuoteId = existingQuotes?.[0]?.id;
  if (existingQuoteId) {
    return existingQuoteId;
  }

  const created = await quoteService.createQuoteFromEstimate(estimateId);
  if (!created?.success || !created?.quote?.id) {
    throw new Error(created?.error || 'Could not create a proposal from this estimate.');
  }

  return created.quote.id;
};

export const sendQuoteDocument = async ({
  quoteId,
  lead,
  deliveryChannel,
  customSubject,
  customBodyHtml,
  attachPdf = true,
  recipientEmail,
  recipientPhone,
  tenantId = getTenantId(),
}) => invokeDocumentFunction('send-estimate', {
  quote_id: quoteId,
  tenant_id: tenantId,
  delivery_channel: deliveryChannel,
  attach_pdf: attachPdf,
  custom_subject: customSubject || undefined,
  custom_body_html: customBodyHtml || undefined,
  ...getLeadPayload({ lead, recipientEmail, recipientPhone }),
});

export const sendEstimateDocument = async ({
  estimateId,
  lead,
  deliveryChannel,
  customSubject,
  customBodyHtml,
  attachPdf = true,
  recipientEmail,
  recipientPhone,
  tenantId = getTenantId(),
}) => {
  const quoteId = await findOrCreateQuoteForEstimate(estimateId, tenantId);
  const result = await sendQuoteDocument({
    quoteId,
    lead,
    deliveryChannel,
    customSubject,
    customBodyHtml,
    attachPdf,
    recipientEmail,
    recipientPhone,
    tenantId,
  });

  return {
    ...result,
    quote_id: result?.quote_id || quoteId,
  };
};

export const sendInvoiceDocument = async ({
  invoiceId,
  lead,
  deliveryChannel,
  recipientEmail,
  recipientPhone,
  tenantId = getTenantId(),
}) => invokeDocumentFunction('send-invoice', {
  invoice_id: invoiceId,
  tenant_id: tenantId,
  delivery_channel: deliveryChannel,
  ...getLeadPayload({ lead, recipientEmail, recipientPhone }),
});

export const sendReceiptDocument = async ({
  invoiceId,
  jobId,
  lead,
  deliveryChannel,
  recipientEmail,
  recipientPhone,
  tenantId = getTenantId(),
}) => invokeDocumentFunction('send-receipt', {
  invoice_id: invoiceId || undefined,
  job_id: jobId || undefined,
  tenant_id: tenantId,
  delivery_channel: deliveryChannel,
  ...getLeadPayload({ lead, recipientEmail, recipientPhone }),
});
