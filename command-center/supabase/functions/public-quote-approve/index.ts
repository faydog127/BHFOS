import { supabaseAdmin } from '../_lib/supabaseAdmin.ts';
import {
  buildCorsHeaders,
  getClientInfo,
  isRateLimited,
  logPublicEvent,
  readJson,
} from '../_shared/publicUtils.ts';
import {
  hasEvent,
  logMoneyLoopEvent,
} from '../_shared/moneyLoopUtils.ts';

const respondJson = (body: Record<string, unknown>, status: number, headers: Record<string, string>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });

const respondHtml = (html: string, status: number, headers: Record<string, string>) => {
  const out = new Headers(headers);
  out.set('content-type', 'text/html; charset=utf-8');
  out.set('cache-control', 'no-store');
  return new Response(html, { status, headers: out });
};

const asString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
const asTracking = (value: unknown): string => asString(value).toUpperCase();

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const asNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const parseDateValue = (value: string | null): Date | null => {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const dateOnly = new Date(`${value}T23:59:59.999Z`);
    return Number.isNaN(dateOnly.valueOf()) ? null : dateOnly;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? null : parsed;
};

const resolveQuoteExpiryAt = (validUntil: string | null, sentAt: string | null): Date | null => {
  const fromValidUntil = parseDateValue(validUntil);
  if (fromValidUntil) return fromValidUntil;
  const fromSentAt = parseDateValue(sentAt);
  if (fromSentAt) return new Date(fromSentAt.getTime() + 7 * 24 * 60 * 60 * 1000);
  return null;
};

const normalizeErrorMessage = (value: unknown) => String(value ?? '').toLowerCase();

const isMissingColumnError = (error: { code?: string; message?: string } | null | undefined) => {
  if (!error) return false;
  if (error.code === 'PGRST204' || error.code === '42703') return true;
  const msg = normalizeErrorMessage(error.message);
  return msg.includes('column') && (msg.includes('does not exist') || msg.includes('could not find'));
};

const extractAddressObject = (value: unknown): Record<string, unknown> | null => {
  if (!value) return null;
  if (Array.isArray(value)) return (value[0] as Record<string, unknown>) ?? null;
  if (typeof value === 'object') return value as Record<string, unknown>;
  return null;
};

const buildServiceAddress = (value: unknown): string | null => {
  const address = extractAddressObject(value);
  if (!address) return null;
  const parts = [
    asString(address.address1),
    asString(address.address2),
    asString(address.city),
    asString(address.state),
    asString(address.zip),
  ].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
};

const fallbackWorkOrderNumber = (tenantId: string, quoteNumber: unknown, nowIso: string) => {
  const year = new Date(nowIso).getUTCFullYear();
  const fromQuote = asString(quoteNumber).replace(/\D/g, '');
  if (fromQuote) {
    const seq = Number.parseInt(fromQuote, 10) % 10000;
    return `WO-${year}-${String(seq).padStart(4, '0')}`;
  }
  const hash = Math.abs(
    Array.from(`${tenantId}:${nowIso}`).reduce((acc, ch) => ((acc * 31) + ch.charCodeAt(0)) | 0, 7),
  ) % 10000;
  return `WO-${year}-${String(hash).padStart(4, '0')}`;
};

const allocateWorkOrderNumber = async (tenantId: string, quoteNumber: unknown, nowIso: string) => {
  const { data, error } = await supabaseAdmin.rpc('next_work_order_number', {
    p_tenant_id: tenantId,
    p_created_at: nowIso,
  });

  if (!error && typeof data === 'string' && data.trim()) {
    return data.trim().toUpperCase();
  }

  console.warn('next_work_order_number unavailable, using fallback:', error?.message || 'unknown_error');
  return fallbackWorkOrderNumber(tenantId, quoteNumber, nowIso).toUpperCase();
};

const resolveLeadServiceAddress = async (tenantId: string, leadId: string | null) => {
  if (!leadId) return null;

  const { data: lead, error } = await supabaseAdmin
    .from('leads')
    .select('address:property_id(address1,address2,city,state,zip)')
    .eq('tenant_id', tenantId)
    .eq('id', leadId)
    .maybeSingle();

  if (error) {
    console.warn('Unable to resolve lead property address:', error.message || error);
    return null;
  }

  return buildServiceAddress((lead as Record<string, unknown> | null)?.address);
};

const resolveQuoteServiceAddress = async (tenantId: string, quoteId: string | null) => {
  if (!quoteId) return null;

  const { data: quote, error } = await supabaseAdmin
    .from('quotes')
    .select('service_address')
    .eq('tenant_id', tenantId)
    .eq('id', quoteId)
    .maybeSingle();

  if (error) {
    if (!isMissingColumnError(error as { code?: string; message?: string })) {
      console.warn('Unable to resolve quote service address:', error.message || error);
    }
    return null;
  }

  return asString((quote as Record<string, unknown> | null)?.service_address) || null;
};

const normalizeCustomerTypeSnapshot = (value: unknown) => {
  const normalized = asString(value).toLowerCase();
  if (['commercial', 'government'].includes(normalized)) return 'commercial';
  if (['property_management', 'property management', 'property_manager', 'property manager', 'partner'].includes(normalized)) {
    return 'property_management';
  }
  return 'residential';
};

const defaultPaymentTermsForCustomerType = (value: unknown) => {
  const customerType = normalizeCustomerTypeSnapshot(value);
  if (customerType === 'property_management') return 'NET_30';
  if (customerType === 'commercial') return 'NET_15';
  return 'NET_7';
};

const resolveLeadCustomerType = async (tenantId: string, leadId: string | null) => {
  if (!leadId) return 'residential';

  const { data, error } = await supabaseAdmin
    .from('leads')
    .select('customer_type')
    .eq('tenant_id', tenantId)
    .eq('id', leadId)
    .maybeSingle();

  if (error) {
    console.warn('Unable to resolve lead customer type:', error.message || error);
    return 'residential';
  }

  return normalizeCustomerTypeSnapshot((data as Record<string, unknown> | null)?.customer_type);
};

const getPublicQuoteResultBaseUrl = (): string => {
  const configured =
    Deno.env.get('PUBLIC_QUOTE_RESULT_URL') ||
    Deno.env.get('PUBLIC_APP_URL') ||
    Deno.env.get('PUBLIC_QUOTE_BASE_URL') ||
    'https://app.bhfos.com';
  return configured.replace(/\/$/, '');
};

const getPublicWebsiteBaseUrl = () => {
  const configured =
    Deno.env.get('BUSINESS_WEBSITE') ||
    Deno.env.get('PUBLIC_QUOTE_BASE_URL') ||
    'https://vent-guys.com';
  return configured.replace(/\/$/, '');
};

const buildQuoteResultUrl = (params: {
  approved: boolean;
  quoteId: string;
  token: string;
  tenantId: string;
  invoiceToken?: string | null;
}): string => {
  const base = getPublicQuoteResultBaseUrl();
  const url = new URL(`${base}/quote-confirmation`);
  url.searchParams.set('quote_result', params.approved ? 'approved' : 'declined');
  url.searchParams.set('quote_id', params.quoteId);
  url.searchParams.set('token', params.token);
  url.searchParams.set('tenant_id', params.tenantId);
  if (params.invoiceToken) {
    url.searchParams.set('invoice_token', params.invoiceToken);
  }
  return url.toString();
};

const buildWebsiteResultUrl = (params: {
  approved: boolean;
  quoteId: string;
  token: string;
  tenantId: string;
  invoiceId?: string | null;
}) => {
  const url = new URL(getPublicWebsiteBaseUrl());
  url.searchParams.set('quote_result', params.approved ? 'approved' : 'declined');
  url.searchParams.set('quote_id', params.quoteId);
  url.searchParams.set('token', params.token);
  url.searchParams.set('tenant_id', params.tenantId);
  if (params.invoiceId) {
    url.searchParams.set('invoice_id', params.invoiceId);
  }
  return url.toString();
};

const getFunctionBaseUrl = (requestOrigin: string) => {
  const configured = Deno.env.get('SUPABASE_URL') || requestOrigin || '';
  return configured.replace(/\/$/, '');
};

const buildPublicQuoteHtmlUrl = (params: {
  quoteId: string;
  token: string | null;
  tenantId: string;
  requestOrigin: string;
}) => {
  if (params.token) {
    const appUrl = new URL(`${getPublicQuoteResultBaseUrl()}/quotes/${params.token}`);
    appUrl.searchParams.set('quote_id', params.quoteId);
    appUrl.searchParams.set('tenant_id', params.tenantId);
    return appUrl.toString();
  }

  const functionBase = getFunctionBaseUrl(params.requestOrigin);
  if (functionBase) {
    const fallback = new URL(`${functionBase}/functions/v1/public-quote`);
    fallback.searchParams.set('quote_id', params.quoteId);
    fallback.searchParams.set('tenant_id', params.tenantId);
    fallback.searchParams.set('view', 'json');
    return fallback.toString();
  }

  if (params.token) {
    const fallback = new URL(`${getPublicQuoteResultBaseUrl()}/quotes/${params.token}`);
    fallback.searchParams.set('quote_id', params.quoteId);
    fallback.searchParams.set('tenant_id', params.tenantId);
    return fallback.toString();
  }

  const fallback = new URL(getPublicWebsiteBaseUrl());
  fallback.searchParams.set('quote_id', params.quoteId);
  fallback.searchParams.set('tenant_id', params.tenantId);
  return fallback.toString();
};

const renderDecisionHtml = (params: {
  approved: boolean;
  quoteNumber: string;
  quoteId: string;
  detailUrl: string;
  homeUrl: string;
}) => {
  const title = params.approved ? 'Quote Approved' : 'Quote Declined';
  const cardBg = params.approved ? '#ecfdf5' : '#fef2f2';
  const cardColor = params.approved ? '#065f46' : '#991b1b';
  const message = params.approved
    ? 'Thank you. Your approval was recorded successfully. Our team will contact you within 1 business day.'
    : 'This quote was marked as declined. If this was accidental, contact our office and we can reopen it.';

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)} - The Vent Guys</title>
  <style>
    body{font-family:Arial,sans-serif;background:#f6f8fb;margin:0;padding:24px;color:#0f172a;}
    .wrap{max-width:720px;margin:0 auto;background:#fff;border:1px solid #dbe3ef;border-radius:12px;padding:22px;}
    .badge{display:inline-block;padding:7px 10px;border-radius:8px;background:${cardBg};color:${cardColor};font-weight:700;margin-bottom:12px;}
    .muted{color:#475569;font-size:14px;}
    .actions{margin-top:18px;display:flex;gap:10px;flex-wrap:wrap;}
    a.btn{display:inline-block;text-decoration:none;padding:10px 14px;border-radius:8px;font-weight:700;}
    a.primary{background:#173861;color:#fff;}
    a.secondary{background:#fff;color:#173861;border:1px solid #173861;}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="badge">${escapeHtml(title)}</div>
    <h2 style="margin:0 0 10px 0;">Service Proposal #${escapeHtml(params.quoteNumber || 'N/A')}</h2>
    <p style="margin:0 0 8px 0;">${escapeHtml(message)}</p>
    <p class="muted" style="margin:0;">Reference ID: ${escapeHtml(params.quoteId.toUpperCase())}</p>
    <div class="actions">
      <a class="btn primary" href="${escapeHtml(params.detailUrl)}">View Quote Details</a>
      <a class="btn secondary" href="${escapeHtml(params.homeUrl)}">Return to Website</a>
    </div>
  </div>
</body>
</html>`;
};

const renderExpiredHtml = (params: {
  quoteNumber: string;
  quoteId: string;
  detailUrl: string;
  homeUrl: string;
}) => `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Quote Expired - The Vent Guys</title>
  <style>
    body{font-family:Arial,sans-serif;background:#f6f8fb;margin:0;padding:24px;color:#0f172a;}
    .wrap{max-width:720px;margin:0 auto;background:#fff;border:1px solid #dbe3ef;border-radius:12px;padding:22px;}
    .badge{display:inline-block;padding:7px 10px;border-radius:8px;background:#ffedd5;color:#9a3412;font-weight:700;margin-bottom:12px;}
    .muted{color:#475569;font-size:14px;}
    .actions{margin-top:18px;display:flex;gap:10px;flex-wrap:wrap;}
    a.btn{display:inline-block;text-decoration:none;padding:10px 14px;border-radius:8px;font-weight:700;}
    a.primary{background:#173861;color:#fff;}
    a.secondary{background:#fff;color:#173861;border:1px solid #173861;}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="badge">Quote Expired</div>
    <h2 style="margin:0 0 10px 0;">Service Proposal #${escapeHtml(params.quoteNumber || 'N/A')}</h2>
    <p style="margin:0 0 8px 0;">This quote is outside its acceptance window and can no longer be approved online. Please contact our office to refresh pricing and scheduling availability.</p>
    <p class="muted" style="margin:0;">Reference ID: ${escapeHtml(params.quoteId.toUpperCase())}</p>
    <div class="actions">
      <a class="btn primary" href="${escapeHtml(params.detailUrl)}">View Quote Details</a>
      <a class="btn secondary" href="${escapeHtml(params.homeUrl)}">Return to Website</a>
    </div>
  </div>
</body>
</html>`;

const renderSupersededHtml = (params: {
  quoteNumber: string;
  quoteId: string;
  detailUrl: string;
  homeUrl: string;
}) => `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Quote Superseded - The Vent Guys</title>
  <style>
    body{font-family:Arial,sans-serif;background:#f6f8fb;margin:0;padding:24px;color:#0f172a;}
    .wrap{max-width:720px;margin:0 auto;background:#fff;border:1px solid #dbe3ef;border-radius:12px;padding:22px;}
    .badge{display:inline-block;padding:7px 10px;border-radius:8px;background:#fee2e2;color:#991b1b;font-weight:700;margin-bottom:12px;}
    .muted{color:#475569;font-size:14px;}
    .actions{margin-top:18px;display:flex;gap:10px;flex-wrap:wrap;}
    a.btn{display:inline-block;text-decoration:none;padding:10px 14px;border-radius:8px;font-weight:700;}
    a.primary{background:#173861;color:#fff;}
    a.secondary{background:#fff;color:#173861;border:1px solid #173861;}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="badge">Quote Superseded</div>
    <h2 style="margin:0 0 10px 0;">Service Proposal #${escapeHtml(params.quoteNumber || 'N/A')}</h2>
    <p style="margin:0 0 8px 0;">This quote has been replaced by a newer revision and can no longer be approved.</p>
    <p class="muted" style="margin:0;">Reference ID: ${escapeHtml(params.quoteId.toUpperCase())}</p>
    <div class="actions">
      <a class="btn primary" href="${escapeHtml(params.detailUrl)}">View Quote Details</a>
      <a class="btn secondary" href="${escapeHtml(params.homeUrl)}">Return to Website</a>
    </div>
  </div>
</body>
</html>`;

const parseBody = async (req: Request): Promise<Record<string, unknown>> => {
  const contentType = (req.headers.get('content-type') || '').toLowerCase();
  if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
    const form = await req.formData();
    const out: Record<string, unknown> = {};
    for (const [key, value] of form.entries()) {
      out[key] = typeof value === 'string' ? value : '';
    }
    return out;
  }
  return await readJson(req);
};

Deno.serve(async (req) => {
  const requestOrigin = new URL(req.url).origin;
  const origin = req.headers.get('origin');
  const cors = buildCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors.headers });
  }

  if (!cors.allowed && origin) {
    return respondJson({ error: 'Origin not allowed' }, 403, cors.headers);
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    return respondJson({ error: 'Method not allowed' }, 405, cors.headers);
  }

  const { ip, userAgent } = getClientInfo(req);
  const rateKey = `public-quote-approve:${ip}`;

  if (isRateLimited(rateKey, 12)) {
    await logPublicEvent({
      kind: 'public_quote_approve',
      status: 'rate_limited',
      ip,
      userAgent,
    });
    return respondJson({ error: 'Rate limit exceeded' }, 429, cors.headers);
  }

  const url = new URL(req.url);
  const body = req.method === 'POST' ? await parseBody(req) : {};
  const token =
    asString(body?.token) ||
    asString(url.searchParams.get('token')) ||
    null;
  const quoteId =
    asString(body?.quote_id) ||
    asString(url.searchParams.get('quote_id')) ||
    null;
  const requestedTenantId =
    asString(body?.tenant_id) ||
    asString(url.searchParams.get('tenant_id')) ||
    null;
  const action =
    asString(body?.action || body?.status) ||
    asString(url.searchParams.get('action')) ||
    'approved';
  const fulfillmentMode =
    asString(body?.fulfillment_mode) ||
    asString(url.searchParams.get('fulfillment_mode')) ||
    null;
  const runId =
    asString(body?.run_id) ||
    asString(url.searchParams.get('run_id')) ||
    null;

  if (!token) {
    await logPublicEvent({
      kind: 'public_quote_approve',
      tenantId: requestedTenantId,
      quoteId,
      status: 'not_found',
      ip,
      userAgent,
      metadata: { run_id: runId },
    });
    return respondJson({ error: 'Not found' }, 404, cors.headers);
  }

  const isDecline = ['decline', 'declined', 'reject', 'rejected'].includes(
    String(action).toLowerCase()
  );

  // ML-P1 S2: Money-State reject vocabulary; approve uses approved→accepted normalize.
  const patch: Record<string, unknown> = {
    status: isDecline ? 'rejected' : 'approved',
  };

  let resolvedInvoiceId: string | null = null;
  let resolvedInvoiceToken: string | null = null;

  if (isDecline) {
    patch.rejected_at = new Date().toISOString();
  } else {
    patch.accepted_at = new Date().toISOString();
    patch.approval_method = 'public_token';
  }

  let fetchQuery = supabaseAdmin
    .from('quotes')
    .select(`
      id,
      lead_id,
      quote_number,
      status,
      subtotal,
      tax_rate,
      tax_amount,
      total_amount,
      valid_until,
      sent_at,
      customer_name,
      customer_email,
      customer_phone,
      estimate_id,
      accepted_at,
      rejected_at,
      tenant_id
    `)
    .eq('public_token', token)
    .limit(2);

  if (quoteId) {
    fetchQuery = fetchQuery.eq('id', quoteId);
  }

  const { data: fetchData, error: existingQuoteError } = await fetchQuery;
  const quoteRows = Array.isArray(fetchData) ? fetchData : (fetchData ? [fetchData] : []);

  if (existingQuoteError || quoteRows.length === 0) {
    await logPublicEvent({
      kind: 'public_quote_approve',
      tenantId: requestedTenantId,
      quoteId,
      token,
      status: 'not_found',
      ip,
      userAgent,
      metadata: { run_id: runId, error: existingQuoteError?.message || 'not_found' },
    });
    return respondJson({ error: 'Not found' }, 404, cors.headers);
  }

  if (quoteRows.length > 1) {
    await logPublicEvent({
      kind: 'public_quote_approve',
      tenantId: requestedTenantId,
      quoteId,
      token,
      status: 'token_ambiguous',
      ip,
      userAgent,
      metadata: { run_id: runId },
    });
    return respondJson({ error: 'Token is not unique' }, 409, cors.headers);
  }

  const existingQuote = quoteRows[0] as Record<string, unknown>;
  const derivedTenantId = asString(existingQuote.tenant_id);
  if (!derivedTenantId) {
    await logPublicEvent({
      kind: 'public_quote_approve',
      tenantId: requestedTenantId,
      quoteId: asString(existingQuote.id) || quoteId,
      token,
      status: 'tenant_missing',
      ip,
      userAgent,
      metadata: { run_id: runId },
    });
    return respondJson({ error: 'Tenant context missing' }, 500, cors.headers);
  }

  if (requestedTenantId && requestedTenantId !== derivedTenantId) {
    await logPublicEvent({
      kind: 'public_quote_approve',
      tenantId: requestedTenantId,
      quoteId: asString(existingQuote.id) || quoteId,
      token,
      status: 'tenant_mismatch',
      ip,
      userAgent,
      metadata: { run_id: runId, derived_tenant_id: derivedTenantId },
    });
    return respondJson({ error: 'Tenant mismatch' }, 403, cors.headers);
  }

  const tenantId = derivedTenantId;

  const existingStatus = asString(existingQuote.status).toLowerCase();
  const expiryAt = resolveQuoteExpiryAt(
    asString(existingQuote.valid_until) || null,
    asString(existingQuote.sent_at) || null,
  );
  const isSuperseded = existingStatus === 'superseded';
  const isExpiredForApproval =
    !isDecline &&
    Boolean(expiryAt && new Date() > expiryAt && !['approved', 'accepted', 'paid', 'declined', 'rejected'].includes(existingStatus));

  if (isSuperseded) {
    await logPublicEvent({
      kind: 'public_quote_approve',
      tenantId,
      quoteId: existingQuote.id,
      token,
      status: 'superseded',
      ip,
      userAgent,
      metadata: { run_id: runId },
    });

    const detailUrl = buildPublicQuoteHtmlUrl({
      quoteId: existingQuote.id,
      token,
      tenantId,
      requestOrigin,
    });
    const homeUrl = getPublicWebsiteBaseUrl();

    if (req.method === 'GET') {
      return respondHtml(
        renderSupersededHtml({
          quoteNumber: asTracking(existingQuote.quote_number),
          quoteId: existingQuote.id,
          detailUrl,
          homeUrl,
        }),
        409,
        cors.headers,
      );
    }

    return respondJson(
      {
        error: 'Quote has been replaced by a newer revision.',
        code: 'QUOTE_SUPERSEDED',
      },
      409,
      cors.headers,
    );
  }

  if (isExpiredForApproval) {
    await logPublicEvent({
      kind: 'public_quote_approve',
      tenantId,
      quoteId: existingQuote.id,
      token,
      status: 'expired',
      ip,
      userAgent,
      metadata: { run_id: runId },
    });

    const acceptHeader = (req.headers.get('accept') || '').toLowerCase();
    if (req.method === 'GET' || acceptHeader.includes('text/html')) {
      const detailUrl = buildPublicQuoteHtmlUrl({
        quoteId: existingQuote.id,
        token,
        tenantId,
        requestOrigin,
      });
      return Response.redirect(detailUrl, 302);
    }

    return respondJson(
      {
        error: 'Quote has expired. Please contact our office to refresh pricing and scheduling availability.',
        code: 'QUOTE_EXPIRED',
        quote_id: existingQuote.id,
      },
      410,
      cors.headers,
    );
  }

  // ML-P1 S3: prefer server RPC for approve (role/transition/idempotency + canonical job).
  // Gate-off precheck retired — writer is mandatory inside approve RPC.
  if (!isDecline) {
    // Prefer SECURITY DEFINER RPC when migration applied (service_role / anon path).
    const rpcAttempt = await supabaseAdmin.rpc('ml_p1_s2_quote_approve_public', {
      p_public_token: token,
      p_correlation_id: runId,
      p_approval_method: 'public_token',
    });

    if (!rpcAttempt.error && rpcAttempt.data) {
      const rpcPayload = rpcAttempt.data as Record<string, unknown>;
      const rpcQuote = (rpcPayload.quote || {}) as Record<string, unknown>;
      const rpcJobId = (rpcPayload.jobId ?? rpcPayload.job_id ?? null) as string | null;
      const rpcJobCreated = Boolean(rpcPayload.jobCreated ?? rpcPayload.job_created);
      await logPublicEvent({
        kind: 'public_quote_approve',
        tenantId,
        quoteId: rpcQuote.id || existingQuote.id,
        token,
        status: 'approved',
        ip,
        userAgent,
        metadata: {
          run_id: runId,
          via: 'ml_p1_s2_quote_approve_public',
          idempotent: Boolean(rpcPayload.idempotent),
          job_id: rpcJobId,
          job_created: rpcJobCreated,
          slice: 'ml-p1-s3',
        },
      });

      if (
        !(await hasEvent({
          entityType: 'quote',
          entityId: String(rpcQuote.id || existingQuote.id),
          eventType: 'QuoteAccepted',
        }))
      ) {
        await logMoneyLoopEvent({
          tenantId,
          entityType: 'quote',
          entityId: String(rpcQuote.id || existingQuote.id),
          eventType: 'QuoteAccepted',
          actorType: 'public',
          payload: {
            run_id: runId,
            job_created: rpcJobCreated,
            job_id: rpcJobId,
            slice: 'ml-p1-s3',
          },
        });
      }

      const acceptHeaderRpc = (req.headers.get('accept') || '').toLowerCase();
      if (req.method === 'GET' || acceptHeaderRpc.includes('text/html')) {
        const resultUrl = buildQuoteResultUrl({
          approved: true,
          quoteId: String(rpcQuote.id || existingQuote.id),
          token,
          tenantId,
          invoiceToken: null,
        });
        return Response.redirect(resultUrl, 302);
      }

      return respondJson(
        {
          quote: rpcQuote,
          quote_result: 'approved',
          invoice_id: null,
          invoice_token: null,
          job_created: rpcJobCreated,
          job_id: rpcJobId,
          idempotent: Boolean(rpcPayload.idempotent),
        },
        200,
        cors.headers,
      );
    }

    // If RPC missing (pre-A3), continue with direct update — still no job create.
    const rpcMissing = /Could not find the function|function .* does not exist|PGRST202/i.test(
      String(rpcAttempt.error?.message || ''),
    );
    if (!rpcMissing) {
      await logPublicEvent({
        kind: 'public_quote_approve',
        tenantId,
        quoteId: existingQuote.id,
        token,
        status: 'rpc_error',
        ip,
        userAgent,
        metadata: { run_id: runId, error: rpcAttempt.error?.message },
      });
      return respondJson(
        {
          error: rpcAttempt.error?.message || 'Approve failed',
          code: 'ML_P1_S2_APPROVE_FAILED',
          job_created: false,
        },
        409,
        cors.headers,
      );
    }
  }

  if (!isDecline) {
    const amount = asNumber(existingQuote.total_amount);
    patch.approved_amount = amount;
    patch.approved_by_actor_id = null;
  }

  let updateQuery = supabaseAdmin
    .from('quotes')
    .update(patch)
    .eq('id', existingQuote.id)
    .eq('tenant_id', tenantId)
    .eq('public_token', token);

  // Concurrent-safe approve: only transition from issued.
  if (!isDecline) {
    updateQuery = updateQuery.eq('status', 'issued');
  }

  const { data, error } = await updateQuery
    .select(`
      id,
      lead_id,
      quote_number,
      status,
      subtotal,
      tax_rate,
      tax_amount,
      total_amount,
      valid_until,
      sent_at,
      customer_name,
      customer_email,
      customer_phone,
      estimate_id,
      accepted_at,
      rejected_at,
      tenant_id,
      approved_amount,
      approval_method,
      quote_version
    `)
    .maybeSingle();

  if (error || !data) {
    // Idempotent approve replay
    if (!isDecline) {
      const { data: again } = await supabaseAdmin
        .from('quotes')
        .select('*')
        .eq('id', existingQuote.id)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      const againStatus = asString(again?.status).toLowerCase();
      if (again && ['approved', 'accepted'].includes(againStatus)) {
        return respondJson(
          {
            quote: again,
            quote_result: 'approved',
            invoice_id: null,
            invoice_token: null,
            job_created: false,
            idempotent: true,
          },
          200,
          cors.headers,
        );
      }
    }
    await logPublicEvent({
      kind: 'public_quote_approve',
      tenantId,
      quoteId,
      token,
      status: 'not_found',
      ip,
      userAgent,
      metadata: { run_id: runId, error: error?.message || 'not_found' },
    });
    return respondJson({ error: 'Not found', job_created: false }, 404, cors.headers);
  }

  await logPublicEvent({
    kind: 'public_quote_approve',
    tenantId,
    quoteId: data.id,
    token,
    status: isDecline ? 'rejected' : 'approved',
    ip,
    userAgent,
    metadata: { run_id: runId },
  });

  const actorType = 'public';

  if (isDecline) {
    if (
      !(await hasEvent({
        entityType: 'quote',
        entityId: data.id,
        eventType: 'QuoteDeclined',
      }))
    ) {
      await logMoneyLoopEvent({
        tenantId,
        entityType: 'quote',
        entityId: data.id,
        eventType: 'QuoteDeclined',
        actorType,
        payload: { run_id: runId },
      });
    }
  } else {
    if (
      !(await hasEvent({
        entityType: 'quote',
        entityId: data.id,
        eventType: 'QuoteAccepted',
      }))
    ) {
      await logMoneyLoopEvent({
        tenantId,
        entityType: 'quote',
        entityId: data.id,
        eventType: 'QuoteAccepted',
        actorType,
        payload: { run_id: runId, job_created: false, slice: 'ml-p1-s2' },
      });
    }

    // ML-P1 S2 hard stop: NO job creation, NO schedule-job task, NO invoice.
    // Accept→job remains Slice 3.
  }

  resolvedInvoiceId = null;
  resolvedInvoiceToken = null;

  const acceptHeader = (req.headers.get('accept') || '').toLowerCase();
  if (req.method === 'GET' || acceptHeader.includes('text/html')) {
    const resultParams = {
      approved: !isDecline,
      quoteId: data.id,
      token,
      tenantId,
      invoiceToken: resolvedInvoiceToken,
    };

    const resultUrl = buildQuoteResultUrl(resultParams);
    return Response.redirect(resultUrl, 302);
  }

  return respondJson(
    {
      quote: data,
      quote_result: isDecline ? 'rejected' : 'approved',
      invoice_id: resolvedInvoiceId,
      invoice_token: resolvedInvoiceToken,
      job_created: false,
    },
    200,
    cors.headers,
  );
});
