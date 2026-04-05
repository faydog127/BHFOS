import { supabase } from '@/lib/customSupabaseClient';
import { getTenantId } from '@/lib/tenantUtils';

const generatePublicToken = () => {
  const c = typeof crypto !== 'undefined' ? crypto : null;
  if (c?.randomUUID) return c.randomUUID();

  return `quote-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const buildQuotePreviewUrl = ({ token, tenantId, quoteId, print = false }) => {
  const url = new URL(`/quotes/${token}`, window.location.origin);

  if (tenantId) {
    url.searchParams.set('tenant_id', tenantId);
  }

  if (quoteId) {
    url.searchParams.set('quote_id', quoteId);
  }

  if (print) {
    url.searchParams.set('print', '1');
  }

  return url.toString();
};

export const ensureQuotePreviewUrl = async ({
  quoteId,
  tenantId = getTenantId(),
  print = false,
}) => {
  if (!quoteId) {
    throw new Error('Missing quote id.');
  }

  let query = supabase
    .from('quotes')
    .select('id, public_token')
    .eq('id', quoteId)
    .limit(1)
    .maybeSingle();

  if (tenantId) {
    query = query.eq('tenant_id', tenantId);
  }

  const { data: quote, error } = await query;
  if (error) throw error;
  if (!quote?.id) {
    throw new Error('Estimate not found.');
  }

  let token = String(quote.public_token || '').trim();

  if (!token) {
    token = generatePublicToken();

    let updateQuery = supabase
      .from('quotes')
      .update({
        public_token: token,
        updated_at: new Date().toISOString(),
      })
      .eq('id', quoteId);

    if (tenantId) {
      updateQuery = updateQuery.eq('tenant_id', tenantId);
    }

    const { error: updateError } = await updateQuery;
    if (updateError) throw updateError;
  }

  return buildQuotePreviewUrl({
    token,
    tenantId,
    quoteId,
    print,
  });
};

export const openQuotePreview = async (options) => {
  const url = await ensureQuotePreviewUrl(options);
  window.open(url, '_blank', 'noopener,noreferrer');
  return url;
};

export const openQuotePrintView = async (options) => {
  const url = await ensureQuotePreviewUrl({ ...options, print: true });
  window.open(url, '_blank', 'noopener,noreferrer');
  return url;
};
