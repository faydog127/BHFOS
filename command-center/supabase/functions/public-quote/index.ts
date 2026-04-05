import { supabaseAdmin } from '../_lib/supabaseAdmin.ts';
import {
  buildCorsHeaders,
  getClientInfo,
  isRateLimited,
  logPublicEvent,
  readJson,
} from '../_shared/publicUtils.ts';
import {
  createMoneyLoopTask,
  ensureSuspension,
  hasRecentEvent,
  logMoneyLoopEvent,
  upsertAutomationSuspension,
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

const asNumber = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
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

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const getPublicQuoteBaseUrl = () => {
  const configured =
    Deno.env.get('PUBLIC_APP_URL') ||
    Deno.env.get('PUBLIC_QUOTE_BASE_URL') ||
    'https://app.bhfos.com';
  return configured.replace(/\/$/, '');
};

const buildPublicQuoteAppUrl = (params: { token: string; tenantId: string; quoteId?: string | null }) => {
  const url = new URL(`${getPublicQuoteBaseUrl()}/quotes/${params.token}`);
  if (params.tenantId) url.searchParams.set('tenant_id', params.tenantId);
  if (params.quoteId) url.searchParams.set('quote_id', params.quoteId);
  return url.toString();
};

const renderPublicQuoteHtml = (params: {
  quote: Record<string, unknown>;
  items: Array<Record<string, unknown>>;
  token: string;
  tenantId: string;
  result?: string;
}) => {
  const quote = params.quote;
  const items = params.items;
  const lead = (quote.leads ?? {}) as Record<string, unknown>;
  const fullName =
    asString(quote.customer_name) ||
    [asString(lead.first_name), asString(lead.last_name)].filter(Boolean).join(' ') ||
    'Customer';
  const quoteNumber = asTracking(quote.quote_number) || 'N/A';
  const quoteStatus = asString(quote.status).toLowerCase();
  const validUntil = asString(quote.valid_until);
  const sentAt = asString(quote.sent_at);
  const subtotal = asNumber(quote.subtotal);
  const taxAmount = asNumber(quote.tax_amount);
  const total = asNumber(quote.total_amount);
  const expiryAt = resolveQuoteExpiryAt(validUntil || null, sentAt || null);
  const isDecisionLocked = ['approved', 'accepted', 'paid', 'declined', 'rejected', 'superseded', 'void'].includes(quoteStatus);
  const isExpiredForDecision = Boolean(expiryAt && new Date() > expiryAt && !isDecisionLocked);

  const rowsHtml = items
    .map((item) => {
      const description = escapeHtml(asString(item.description) || 'Service');
      const quantity = asNumber(item.quantity);
      const unitPrice = asNumber(item.unit_price);
      const lineTotal = asNumber(item.total_price) || quantity * unitPrice;
      return `<tr>
        <td>${description}</td>
        <td class="num">${quantity}</td>
        <td class="num">${formatCurrency(unitPrice)}</td>
        <td class="num">${formatCurrency(lineTotal)}</td>
      </tr>`;
    })
    .join('');

  const normalizedResult = (params.result || '').toLowerCase();
  const resultBanner =
    normalizedResult === 'approved'
      ? '<div style="background:#dcfce7;color:#166534;padding:10px 12px;border-radius:8px;margin:0 0 12px 0;font-weight:600;">Quote approved successfully. Our team will contact you within 1 business day.</div>'
      : normalizedResult === 'declined'
        ? '<div style="background:#fee2e2;color:#991b1b;padding:10px 12px;border-radius:8px;margin:0 0 12px 0;font-weight:600;">Quote marked as declined.</div>'
        : '';
  const expiryBanner = isExpiredForDecision
    ? '<div style="background:#ffedd5;color:#9a3412;padding:10px 12px;border-radius:8px;margin:0 0 12px 0;font-weight:600;">This quote has expired and is no longer available for online approval. Please contact our office to refresh pricing and scheduling.</div>'
    : '';
  const supersededBanner = quoteStatus === 'superseded'
    ? '<div style="background:#fee2e2;color:#991b1b;padding:10px 12px;border-radius:8px;margin:0 0 12px 0;font-weight:600;">This quote has been replaced by a newer revision and is no longer available for approval.</div>'
    : '';
  const actionsHtml = !isDecisionLocked && !isExpiredForDecision
    ? `<div class="actions">
      <form method="POST" action="/functions/v1/public-quote-approve">
        <input type="hidden" name="token" value="${escapeHtml(params.token)}" />
        <input type="hidden" name="quote_id" value="${escapeHtml(asString(quote.id))}" />
        <input type="hidden" name="tenant_id" value="${escapeHtml(params.tenantId)}" />
        <input type="hidden" name="action" value="approved" />
        <button class="approve" type="submit">Approve Quote</button>
      </form>
      <form method="POST" action="/functions/v1/public-quote-approve">
        <input type="hidden" name="token" value="${escapeHtml(params.token)}" />
        <input type="hidden" name="quote_id" value="${escapeHtml(asString(quote.id))}" />
        <input type="hidden" name="tenant_id" value="${escapeHtml(params.tenantId)}" />
        <input type="hidden" name="action" value="declined" />
        <button class="decline" type="submit">Decline Quote</button>
      </form>
    </div>`
    : `<div class="muted" style="margin-top:16px;">${
      quoteStatus === 'superseded'
        ? 'This quote has been replaced by a newer revision.'
        : isExpiredForDecision
        ? 'Online approval is unavailable because this quote expired.'
        : 'This quote decision has already been recorded.'
    }</div>`;

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Quote #${escapeHtml(quoteNumber)} - The Vent Guys</title>
  <style>
    body { font-family: Arial, sans-serif; background: #f6f8fb; color: #0f172a; margin: 0; padding: 24px; }
    .card { max-width: 760px; margin: 0 auto; background: #fff; border: 1px solid #dbe3ef; border-radius: 12px; padding: 20px; }
    .muted { color: #475569; font-size: 14px; margin-top: 4px; }
    .total { font-size: 32px; font-weight: 800; margin: 12px 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th, td { border-bottom: 1px solid #e2e8f0; padding: 10px; text-align: left; }
    .num { text-align: right; }
    .actions { display: flex; gap: 10px; margin-top: 18px; }
    button { border: 0; border-radius: 8px; padding: 11px 16px; color: #fff; font-weight: 700; cursor: pointer; }
    .approve { background: #0f766e; }
    .decline { background: #b91c1c; }
  </style>
</head>
<body>
  <div class="card">
    <h2 style="margin:0;">Service Proposal</h2>
    ${resultBanner}
    ${expiryBanner}
    ${supersededBanner}
    <div class="muted">Hi ${escapeHtml(fullName)}, this is your quote from The Vent Guys.</div>
    <div class="muted">Quote #${escapeHtml(quoteNumber)}${validUntil ? ` | Valid Through: ${escapeHtml(validUntil)}` : ''}</div>
    <div class="total">${formatCurrency(total)}</div>

    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th class="num">Qty</th>
          <th class="num">Unit</th>
          <th class="num">Line Total</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>

    <table>
      <tbody>
        <tr><td>Subtotal</td><td class="num">${formatCurrency(subtotal)}</td></tr>
        ${taxAmount > 0 ? `<tr><td>Tax</td><td class="num">${formatCurrency(taxAmount)}</td></tr>` : ''}
        <tr><td><strong>Total</strong></td><td class="num"><strong>${formatCurrency(total)}</strong></td></tr>
      </tbody>
    </table>

    ${actionsHtml}
  </div>
</body>
</html>`;
};

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const cors = buildCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors.headers });
  }

  if (!cors.allowed && origin) {
    return respondJson({ error: 'Origin not allowed' }, 403, cors.headers);
  }

  const { ip, userAgent } = getClientInfo(req);
  const rateKey = `public-quote:${ip}`;

  if (isRateLimited(rateKey)) {
    await logPublicEvent({
      kind: 'public_quote_view',
      status: 'rate_limited',
      ip,
      userAgent,
    });
    return respondJson({ error: 'Rate limit exceeded' }, 429, cors.headers);
  }

  const params = new URL(req.url).searchParams;
  const body = req.method === 'POST' ? await readJson(req) : null;
  const token = params.get('token') || body?.token || null;
  const requestedQuoteId = params.get('quote_id') || body?.quote_id || null;
  const requestedTenantId = params.get('tenant_id') || body?.tenant_id || null;
  const runId = params.get('run_id') || body?.run_id || null;
  const result = params.get('result') || body?.result || null;
  const view = params.get('view') || 'json';

  if (!token) {
    await logPublicEvent({
      kind: 'public_quote_view',
      tenantId: null,
      status: 'not_found',
      ip,
      userAgent,
      metadata: { run_id: runId },
    });
    return respondJson({ error: 'Not found' }, 404, cors.headers);
  }

  let query = supabaseAdmin
    .from('quotes')
    .select(`
      id,
      lead_id,
      status,
      quote_number,
      valid_until,
      sent_at,
      customer_name,
      customer_email,
      customer_phone,
      header_text,
      footer_text,
      tax_rate,
      tax_amount,
      subtotal,
      total_amount,
      fulfillment_mode,
      accepted_at,
      rejected_at,
      tenant_id,
      public_token,
      leads (
        first_name,
        last_name,
        email,
        phone,
        address:property_id(address1, city, state, zip)
      ),
      quote_items (
        id,
        description,
        quantity,
        unit_price,
        total_price
      )
    `)
    .eq('public_token', token)
    .limit(2);

  if (requestedQuoteId) {
    query = query.eq('id', requestedQuoteId);
  }

  const { data: fetchData, error } = await query;
  const rows = Array.isArray(fetchData) ? fetchData : (fetchData ? [fetchData] : []);

  if (error || rows.length === 0) {
    await logPublicEvent({
      kind: 'public_quote_view',
      tenantId: requestedTenantId,
      quoteId: requestedQuoteId,
      token,
      status: 'not_found',
      ip,
      userAgent,
      metadata: {
        run_id: runId,
        error: error?.message || 'not_found',
      },
    });
    return respondJson({ error: 'Not found' }, 404, cors.headers);
  }

  if (rows.length > 1) {
    await logPublicEvent({
      kind: 'public_quote_view',
      tenantId: requestedTenantId,
      quoteId: requestedQuoteId,
      token,
      status: 'token_ambiguous',
      ip,
      userAgent,
      metadata: { run_id: runId },
    });
    return respondJson({ error: 'Token is not unique' }, 409, cors.headers);
  }

  const data = rows[0] as Record<string, unknown>;
  const derivedTenantId = asString((data as Record<string, unknown>).tenant_id);
  if (!derivedTenantId) {
    await logPublicEvent({
      kind: 'public_quote_view',
      tenantId: requestedTenantId,
      quoteId: asString((data as Record<string, unknown>).id) || requestedQuoteId,
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
      kind: 'public_quote_view',
      tenantId: requestedTenantId,
      quoteId: asString((data as Record<string, unknown>).id) || requestedQuoteId,
      token,
      status: 'tenant_mismatch',
      ip,
      userAgent,
      metadata: { run_id: runId, derived_tenant_id: derivedTenantId },
    });
    return respondJson({ error: 'Tenant mismatch' }, 403, cors.headers);
  }

  await logPublicEvent({
    kind: 'public_quote_view',
    tenantId: derivedTenantId,
    quoteId: asString((data as Record<string, unknown>).id),
    token,
    status: 'ok',
    ip,
    userAgent,
    metadata: { run_id: runId },
  });

  const quoteId = asString((data as Record<string, unknown>).id);
  const leadId = (data as Record<string, unknown>).lead_id ?? null;
  const actorType = 'public';

  if (
    !(await hasRecentEvent({
      entityType: 'quote',
      entityId: quoteId,
      eventType: 'QuoteViewed',
    }))
  ) {
    await logMoneyLoopEvent({
      tenantId: derivedTenantId,
      entityType: 'quote',
      entityId: quoteId,
      eventType: 'QuoteViewed',
      actorType,
      payload: { run_id: runId },
    });
  }

  if (
    !(await hasRecentEvent({
      entityType: 'quote',
      entityId: quoteId,
      eventType: 'HumanSignalReceived',
    }))
  ) {
    // Gap 4: Normalized HumanSignalReceived payload
    await logMoneyLoopEvent({
      tenantId: derivedTenantId,
      entityType: 'quote',
      entityId: quoteId,
      eventType: 'HumanSignalReceived',
      actorType: 'external_customer',
      payload: { signal_type: 'quote_view', source: 'public_link', run_id: runId },
    });
  }

  // Gap 5: Use ensureSuspension to conditionally emit AutomationSuspended
  await ensureSuspension({
    tenantId: derivedTenantId,
    entityType: 'quote',
    entityId: quoteId,
    reason: 'quote_viewed',
  });

  // Gap 7: Null-safe lead linkage - suspend lead if exists, update timestamp
  if (leadId) {
    await ensureSuspension({
      tenantId: derivedTenantId,
      entityType: 'lead',
      entityId: leadId,
      reason: 'quote_viewed',
    });

    await supabaseAdmin
      .from('leads')
      .update({ last_human_signal_at: new Date().toISOString() })
      .eq('id', leadId);
  }

  await createMoneyLoopTask({
    tenantId: derivedTenantId,
    sourceType: 'quote',
    sourceId: quoteId,
    title: 'Quote Viewed – Follow Up',
    leadId,
    metadata: { run_id: runId },
  });

  if (view === 'app' || view === 'html') {
    const redirectUrl = buildPublicQuoteAppUrl({
      token,
      tenantId: derivedTenantId,
      quoteId: requestedQuoteId,
    });
    return Response.redirect(redirectUrl, 302);
  }

  if (view === 'raw_html') {
    const html = renderPublicQuoteHtml({
      quote: data as unknown as Record<string, unknown>,
      items: ((data as Record<string, unknown>).quote_items ?? []) as Array<Record<string, unknown>>,
      token,
      tenantId: derivedTenantId,
      result: asString(result),
    });
    return respondHtml(html, 200, cors.headers);
  }

  return respondJson({ quote: data, items: (data as Record<string, unknown>).quote_items || [] }, 200, cors.headers);
});
