import { supabase } from '@/lib/customSupabaseClient';
import { getTenantId } from '@/lib/tenantUtils';

const generatePublicToken = () => {
  const c = typeof crypto !== 'undefined' ? crypto : null;
  if (c?.randomUUID) return c.randomUUID();

  return `invoice-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const buildInvoicePreviewUrl = ({ token, tenantId }) => {
  const url = new URL(`/invoices/${token}`, window.location.origin);

  if (tenantId) {
    url.searchParams.set('tenant_id', tenantId);
  }

  return url.toString();
};

export const ensureInvoicePreviewUrl = async ({
  invoiceId,
  tenantId = getTenantId(),
}) => {
  if (!invoiceId) {
    throw new Error('Missing invoice id.');
  }

  let query = supabase
    .from('invoices')
    .select('id, public_token')
    .eq('id', invoiceId)
    .limit(1)
    .maybeSingle();

  if (tenantId) {
    query = query.eq('tenant_id', tenantId);
  }

  const { data: invoice, error } = await query;
  if (error) throw error;
  if (!invoice?.id) {
    throw new Error('Invoice not found.');
  }

  let token = String(invoice.public_token || '').trim();
  if (!token) {
    token = generatePublicToken();

    let updateQuery = supabase
      .from('invoices')
      .update({
        public_token: token,
        updated_at: new Date().toISOString(),
      })
      .eq('id', invoiceId);

    if (tenantId) {
      updateQuery = updateQuery.eq('tenant_id', tenantId);
    }

    const { error: updateError } = await updateQuery;
    if (updateError) throw updateError;
  }

  return buildInvoicePreviewUrl({ token, tenantId });
};

export const openInvoicePreview = async (options) => {
  const url = await ensureInvoicePreviewUrl(options);
  window.open(url, '_blank', 'noopener,noreferrer');
  return url;
};
