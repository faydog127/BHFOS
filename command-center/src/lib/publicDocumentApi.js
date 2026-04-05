export const getPublicTenantContext = () => {
  return {
    supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  };
};

const fetchPublicDocument = async (functionName, params) => {
  const { supabaseUrl, anonKey } = getPublicTenantContext();
  const query = new URLSearchParams({
    ...Object.fromEntries(
      Object.entries({
        ...params,
      }).filter(([, value]) => value !== undefined && value !== null && value !== '')
    ),
  });

  const res = await fetch(`${supabaseUrl}/functions/v1/${functionName}?${query.toString()}`, {
    headers: {
      apikey: anonKey,
      authorization: `Bearer ${anonKey}`,
    },
  });

  if (!res.ok) {
    throw new Error(`${functionName} request failed.`);
  }

  return res.json();
};

export const fetchPublicQuoteByToken = async (token) => {
  const payload = await fetchPublicDocument('public-quote', { token });
  return {
    quote: payload?.quote || null,
    items: payload?.items || payload?.quote?.quote_items || [],
  };
};

export const fetchPublicInvoiceByToken = async (token) => {
  const payload = await fetchPublicDocument('public-invoice', { token });
  return payload?.invoice || null;
};

export const fetchPublicInvoicePdfByToken = async (token, opts = {}) => {
  const payload = await fetchPublicDocument('public-invoice', {
    token,
    return_pdf: '1',
    pdf_renderer: opts?.pdf_renderer || 'html',
  });
  return payload;
};
