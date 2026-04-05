import { supabaseAdmin } from '../_lib/supabaseAdmin.ts';
import {
  buildCorsHeaders,
  getClientInfo,
  isRateLimited,
  logPublicEvent,
  readJson,
} from '../_shared/publicUtils.ts';
import { renderHtmlToPdfBytes, pdfAttachmentFromBytes } from '../_shared/htmlToPdf.ts';
import {
  BUSINESS_ADDRESS_LINE1,
  BUSINESS_ADDRESS_LINE2,
  BUSINESS_EMAIL,
  BUSINESS_PHONE_DISPLAY,
  BUSINESS_PHONE_TEL,
  LOGO_URL,
  BADGE_NADCA_URL,
  BADGE_CLEAN_AIR_URL,
  BADGE_SDVOSB_URL,
} from '../_shared/email.ts';
import { TVG_DOC_BLOCKS, TVG_DOC_BLOCKS_HTML } from '../_shared/documentBlocks.ts';
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

const escapeHtml = (value: unknown) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const asCurrency = (value: unknown) => {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return '$0.00';
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
};

const buildInvoiceHtml = (params: {
  invoiceNumber: string;
  billTo: string;
  issueDate: string;
  dueDate: string;
  serviceAddress: string;
  items: Array<Record<string, unknown>>;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  payLink: string;
}) => {
  const rows = (params.items || []).map((item) => {
    const desc = escapeHtml(item.description ?? '');
    const qty = escapeHtml(item.quantity ?? '');
    const unit = escapeHtml(asCurrency(item.unit_price ?? 0));
    const total = escapeHtml(asCurrency(item.total_price ?? 0));
    return `
      <tr>
        <td class="desc">${desc}</td>
        <td class="num">${qty}</td>
        <td class="money">${unit}</td>
        <td class="money">${total}</td>
      </tr>
    `;
  }).join('');

  const badges = [BADGE_NADCA_URL, BADGE_SDVOSB_URL, BADGE_CLEAN_AIR_URL].filter(Boolean);
  const badgeHtml = badges.length
    ? `<div class="badges">${badges.map((src) => `<img src="${src}" alt="badge" />`).join('')}</div>`
    : '';

  const usesProcessingFee = Math.abs(Number(params.taxRate || 0) - 0.03) < 0.0005;
  const taxLabel = usesProcessingFee
    ? `Card Processing (${Math.round(Math.max(Number(params.taxRate || 0), 0) * 100)}%)`
    : `Sales Tax (${Math.round(Math.max(Number(params.taxRate || 0), 0) * 100)}%)`;

  const blocks = `
    <div class="blocks">
      <div class="block">
        <div class="blockTitle">${escapeHtml(TVG_DOC_BLOCKS_HTML.positioning_title)}</div>
        <div class="blockBody">${escapeHtml(TVG_DOC_BLOCKS_HTML.positioning_body)}</div>
      </div>
      <div class="block">
        <div class="blockTitle">Trust and Authority</div>
        <ul class="bullets">${TVG_DOC_BLOCKS_HTML.trust_bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join('')}</ul>
      </div>
      <div class="block">
        <div class="blockTitle">${escapeHtml(TVG_DOC_BLOCKS_HTML.referral_title)}</div>
        <ul class="bullets">${TVG_DOC_BLOCKS_HTML.referral_bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join('')}</ul>
        <div class="signature">${TVG_DOC_BLOCKS_HTML.signature_line}</div>
      </div>
    </div>
  `;

  const invNo = escapeHtml(params.invoiceNumber || 'Invoice');

  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Invoice #${invNo}</title>
      <style>
        @page { size: Letter; margin: 0.45in; }
        html, body { font-family: Arial, Helvetica, sans-serif; color: #0f172a; }
        .shell { border: 1px solid #e2e8f0; border-radius: 18px; overflow: hidden; }
        .header { background: linear-gradient(90deg, #091e39, #173861); color: #fff; padding: 18px 20px; }
        .headerRow { display:flex; align-items:center; justify-content:space-between; gap: 16px; }
        .logo { height: 44px; width: auto; }
        .contact { font-size: 12px; line-height: 1.35; text-align: right; }
        .contact a { color:#fff; text-decoration:none; }
        .bar { height: 4px; background: #b52025; }
        .content { padding: 16px 18px 14px 18px; }
        .title { font-size: 22px; font-weight: 800; margin: 0 0 6px 0; }
        .meta { font-size: 12px; color:#475569; margin-bottom: 10px; }
        .meta strong { color:#0f172a; }
        table { width: 100%; border-collapse: collapse; }
        th { text-align:left; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color:#64748b; padding: 10px 10px; border-bottom: 1px solid #e2e8f0; }
        td { padding: 10px 10px; border-bottom: 1px solid #f1f5f9; font-size: 13px; vertical-align: top; }
        td.num { text-align: center; width: 56px; }
        td.money { text-align: right; width: 110px; white-space: nowrap; }
        td.desc { width: auto; }
        .totals { margin-top: 12px; display:flex; justify-content:flex-end; }
        .totalsBox { width: 280px; border: 1px solid #e2e8f0; border-radius: 16px; padding: 12px 14px; background: #f8fafc; }
        .totRow { display:flex; justify-content:space-between; font-size: 13px; color:#334155; margin: 6px 0; }
        .totFinal { display:flex; justify-content:space-between; margin-top: 10px; padding-top: 10px; border-top: 1px solid #e2e8f0; font-size: 16px; font-weight: 900; }
        .pay { margin-top: 12px; padding: 12px; border-radius: 16px; background: #0b1f3a; color: #fff; display:flex; align-items:center; justify-content:center; }
        .payBtn { display:inline-block; background:#ffffff; color:#0b1f3a; text-decoration:none; font-weight: 900; letter-spacing: 0.02em; padding: 10px 14px; border-radius: 999px; }
        /* PDF/print rendering: some engines append link URLs after anchor text. */
        @media print { a[href]::after { content: "" !important; } }
        .footer { padding: 14px 20px 18px 20px; background:#fafafa; border-top: 1px solid #e2e8f0; }
        .footRow { display:flex; justify-content:space-between; gap: 16px; align-items:flex-end; }
        .footLeft { font-size: 12px; color:#475569; line-height: 1.45; }
        .footLeft .name { font-weight: 900; text-transform: uppercase; letter-spacing: 0.12em; color:#0f172a; font-size: 11px; }
        .badges img { height: 34px; width: auto; margin-left: 10px; opacity: 0.92; }
        .blocks { margin-top: 12px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .block { border: 1px solid #e2e8f0; border-radius: 12px; padding: 8px 10px; background: #ffffff; }
        .blockTitle { font-size: 10px; font-weight: 900; letter-spacing: 0.12em; text-transform: uppercase; color:#0f172a; margin-bottom: 5px; }
        .blockBody { font-size: 11px; line-height: 1.35; color:#334155; }
        .bullets { margin: 0; padding-left: 16px; font-size: 11px; line-height: 1.35; color:#334155; }
        .bullets li { margin: 3px 0; }
        .signature { margin-top: 6px; font-size: 11px; font-weight: 900; color:#0f172a; }
      </style>
    </head>
    <body>
      <div class="shell">
        <div class="header">
          <div class="headerRow">
            <div>
              ${LOGO_URL ? `<img class="logo" src="${LOGO_URL}" alt="The Vent Guys" />` : `<div style="font-weight:900;">The Vent Guys</div>`}
            </div>
            <div class="contact">
              <div>${escapeHtml(BUSINESS_ADDRESS_LINE1)}<br/>${escapeHtml(BUSINESS_ADDRESS_LINE2)}</div>
              <div><a href="tel:${escapeHtml(BUSINESS_PHONE_TEL)}">${escapeHtml(BUSINESS_PHONE_DISPLAY)}</a></div>
              <div><a href="mailto:${escapeHtml(BUSINESS_EMAIL)}">${escapeHtml(BUSINESS_EMAIL)}</a></div>
            </div>
          </div>
        </div>
        <div class="bar"></div>
        <div class="content">
          <div class="title">Invoice #${invNo}</div>
          <div class="meta">
            <div><strong>Bill to:</strong> ${escapeHtml(params.billTo)}</div>
            ${params.issueDate ? `<div><strong>Issue date:</strong> ${escapeHtml(params.issueDate)}</div>` : ''}
            ${params.dueDate ? `<div><strong>Due date:</strong> ${escapeHtml(params.dueDate)}</div>` : ''}
            ${params.serviceAddress ? `<div><strong>Service address:</strong> ${escapeHtml(params.serviceAddress)}</div>` : ''}
          </div>

          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th style="text-align:center;">Qty</th>
                <th style="text-align:right;">Unit</th>
                <th style="text-align:right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${rows || '<tr><td colspan="4" style="color:#64748b;">No line items.</td></tr>'}
            </tbody>
          </table>

          <div class="totals">
              <div class="totalsBox">
                <div class="totRow"><span>Subtotal</span><strong>${escapeHtml(asCurrency(params.subtotal))}</strong></div>
              <div class="totRow"><span>${escapeHtml(taxLabel)}</span><strong>${escapeHtml(asCurrency(params.taxAmount))}</strong></div>
                <div class="totFinal"><span>Total</span><span>${escapeHtml(asCurrency(params.totalAmount))}</span></div>
                <div class="totRow"><span>Amount paid</span><strong>${escapeHtml(asCurrency(params.amountPaid))}</strong></div>
                <div class="totRow"><span>Balance due</span><strong>${escapeHtml(asCurrency(params.balanceDue))}</strong></div>
              </div>
            </div>

          ${blocks}

          <div class="pay">
            <a class="payBtn" href="${escapeHtml(params.payLink)}">Pay online</a>
          </div>
        </div>
        <div class="footer">
          <div class="footRow">
            <div class="footLeft">
              <div class="name">The Vent Guys</div>
              <div>${escapeHtml(BUSINESS_ADDRESS_LINE1)}, ${escapeHtml(BUSINESS_ADDRESS_LINE2)}</div>
              <div>${escapeHtml(BUSINESS_EMAIL)} | vent-guys.com</div>
            </div>
            ${badgeHtml}
          </div>
        </div>
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
  const rateKey = `public-invoice:${ip}`;

  if (isRateLimited(rateKey)) {
    await logPublicEvent({
      kind: 'public_invoice_view',
      status: 'rate_limited',
      ip,
      userAgent,
    });
    return respondJson({ error: 'Rate limit exceeded' }, 429, cors.headers);
  }

  const params = new URL(req.url).searchParams;
  const body = req.method === 'POST' ? await readJson(req) : null;
  const token = params.get('token') || body?.token || null;
  const requestedTenantId = params.get('tenant_id') || body?.tenant_id || null;
  const runId = params.get('run_id') || body?.run_id || null;
  const returnPdf = params.get('return_pdf') === '1' || body?.return_pdf === true;
  const pdfRenderer = params.get('pdf_renderer') || body?.pdf_renderer || 'html';

  if (!token) {
    await logPublicEvent({
      kind: 'public_invoice_view',
      tenantId: null,
      status: 'not_found',
      ip,
      userAgent,
      metadata: { run_id: runId },
    });
    return respondJson({ error: 'Not found' }, 404, cors.headers);
  }

  const { data, error } = await supabaseAdmin
    .from('invoices')
    .select(`
      id,
      lead_id,
      status,
      paid_at,
      invoice_number,
      issue_date,
      due_date,
      notes,
      terms,
      customer_name,
      customer_email,
      customer_phone,
      subtotal,
      tax_rate,
      tax_amount,
      total_amount,
      amount_paid,
      balance_due,
      public_token,
      tenant_id,
      invoice_items (
        id,
        description,
        quantity,
        unit_price,
        total_price
      ),
      jobs (
        service_address,
        scheduled_start
      ),
      leads (
        first_name,
        last_name,
        company,
        email,
        phone
      )
    `)
    .eq('public_token', token)
    .limit(2);

  const rows = Array.isArray(data) ? data : (data ? [data] : []);

  if (error || rows.length === 0) {
    await logPublicEvent({
      kind: 'public_invoice_view',
      tenantId: requestedTenantId,
      token,
      status: 'not_found',
      ip,
      userAgent,
      metadata: { run_id: runId, error: error?.message || 'not_found' },
    });
    return respondJson({ error: 'Not found' }, 404, cors.headers);
  }

  if (rows.length > 1) {
    await logPublicEvent({
      kind: 'public_invoice_view',
      tenantId: requestedTenantId,
      token,
      status: 'token_ambiguous',
      ip,
      userAgent,
      metadata: { run_id: runId },
    });
    return respondJson({ error: 'Token is not unique' }, 409, cors.headers);
  }

  const invoice = rows[0] as Record<string, unknown>;
  const derivedTenantId = String(invoice.tenant_id ?? '').trim();
  if (!derivedTenantId) {
    await logPublicEvent({
      kind: 'public_invoice_view',
      tenantId: requestedTenantId,
      invoiceId: String(invoice.id ?? '').trim() || null,
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
      kind: 'public_invoice_view',
      tenantId: requestedTenantId,
      invoiceId: String(invoice.id ?? '').trim() || null,
      token,
      status: 'tenant_mismatch',
      ip,
      userAgent,
      metadata: { run_id: runId, derived_tenant_id: derivedTenantId },
    });
    return respondJson({ error: 'Tenant mismatch' }, 403, cors.headers);
  }

  const jobRecord = Array.isArray((data as Record<string, unknown>).jobs)
    ? ((data as Record<string, unknown>).jobs as Array<Record<string, unknown>>)[0] ?? null
    : ((data as Record<string, unknown>).jobs as Record<string, unknown> | null);

  if (jobRecord?.service_address) {
    (data as Record<string, unknown>).service_address = jobRecord.service_address;
  }

  if (jobRecord?.scheduled_start) {
    (data as Record<string, unknown>).service_date = jobRecord.scheduled_start;
  }

  await logPublicEvent({
    kind: 'public_invoice_view',
    tenantId: derivedTenantId,
    invoiceId: String(invoice.id ?? '').trim(),
    token,
    status: 'ok',
    ip,
    userAgent,
    metadata: { run_id: runId },
  });

  const invoiceId = String(invoice.id ?? '').trim();
  const leadId = invoice.lead_id ?? null;
  const actorType = 'public';
  const isPaidInvoice =
    String(invoice.status ?? '').toLowerCase() === 'paid' ||
    Boolean(invoice.paid_at) ||
    Number(invoice.balance_due ?? Number.POSITIVE_INFINITY) <= 0;

  if (isPaidInvoice) {
    if (!returnPdf) {
      return respondJson({ invoice: data }, 200, cors.headers);
    }
  }

  if (returnPdf) {
    const invoiceNumber = String(data.invoice_number ?? '').trim() || 'pending';
    const lead = Array.isArray((data as Record<string, unknown>).leads)
      ? ((data as Record<string, unknown>).leads as Array<Record<string, unknown>>)[0] ?? null
      : ((data as Record<string, unknown>).leads as Record<string, unknown> | null);
    const billTo =
      String((data as Record<string, unknown>).customer_name ?? '').trim() ||
      String(lead?.company ?? '').trim() ||
      `${String(lead?.first_name ?? '').trim()} ${String(lead?.last_name ?? '').trim()}`.trim() ||
      'Customer';
    const serviceAddress = String((data as Record<string, unknown>).service_address ?? '').trim();
    const items = Array.isArray((data as Record<string, unknown>).invoice_items)
      ? ((data as Record<string, unknown>).invoice_items as Array<Record<string, unknown>>)
      : [];
    const subtotal = Number((data as Record<string, unknown>).subtotal ?? 0) || 0;
    const taxRate = Number((data as Record<string, unknown>).tax_rate ?? 0) || 0;
    const taxAmount = Number((data as Record<string, unknown>).tax_amount ?? 0) || 0;
    const totalAmount = Number((data as Record<string, unknown>).total_amount ?? 0) || 0;
    const amountPaid = Number((data as Record<string, unknown>).amount_paid ?? 0) || 0;
    const balanceDue = Number((data as Record<string, unknown>).balance_due ?? 0) || 0;
    const issueDate = String((data as Record<string, unknown>).issue_date ?? '').trim();
    const dueDate = String((data as Record<string, unknown>).due_date ?? '').trim();
    const publicToken = String((data as Record<string, unknown>).public_token ?? token).trim();
    const payLink = `https://app.bhfos.com/pay/${encodeURIComponent(publicToken)}`;

    const wantsHtml = String(pdfRenderer || '').toLowerCase() !== 'text';
    let pdf: Record<string, unknown> | null = null;
    let pdfRendererUsed: 'pdfshift' | 'text' = 'text';
    let pdfRendererError: string | null = null;
    let pdfRendererStatus: number | null = null;
    let pdfRendererDetails: unknown = null;

    if (wantsHtml) {
      const htmlDoc = buildInvoiceHtml({
        invoiceNumber,
        billTo,
        issueDate,
        dueDate,
        serviceAddress,
        items,
        subtotal,
        taxRate,
        taxAmount,
        totalAmount,
        amountPaid,
        balanceDue,
        payLink,
      });

      const rendered = await renderHtmlToPdfBytes({ html: htmlDoc, letter: true });
      if (rendered.ok) {
        pdfRendererUsed = 'pdfshift';
        pdf = pdfAttachmentFromBytes({
          filename: `invoice-${invoiceNumber}.pdf`,
          bytes: rendered.bytes,
        });
      } else {
        pdfRendererError = rendered.error;
        pdfRendererStatus = rendered.status ?? null;
        pdfRendererDetails = rendered.details ?? null;
      }
    }

    if (!pdf) {
      pdfRendererUsed = 'text';
      pdfRendererError = pdfRendererError || 'HTML renderer unavailable; falling back to text PDF is not implemented in public-invoice.';
      return respondJson(
        {
          error: 'PDF generation unavailable',
          pdf_renderer_used: pdfRendererUsed,
          pdf_renderer_error: pdfRendererError,
          pdf_renderer_status: pdfRendererStatus,
          pdf_renderer_details: pdfRendererDetails,
        },
        501,
        cors.headers,
      );
    }

    return respondJson(
      {
        invoice: data,
        pdf,
        pdf_renderer_used: pdfRendererUsed,
        pdf_renderer_error: pdfRendererError,
      },
      200,
      cors.headers,
    );
  }

  if (
    !(await hasRecentEvent({
      entityType: 'invoice',
      entityId: invoiceId,
      eventType: 'InvoiceViewed',
    }))
  ) {
    await logMoneyLoopEvent({
      tenantId: derivedTenantId,
      entityType: 'invoice',
      entityId: invoiceId,
      eventType: 'InvoiceViewed',
      actorType,
      payload: { run_id: runId },
    });
  }

  if (
    !(await hasRecentEvent({
      entityType: 'invoice',
      entityId: invoiceId,
      eventType: 'HumanSignalReceived',
      windowMinutes: 10,
    }))
  ) {
    // Gap 4: Normalized HumanSignalReceived payload
    await logMoneyLoopEvent({
      tenantId: derivedTenantId,
      entityType: 'invoice',
      entityId: invoiceId,
      eventType: 'HumanSignalReceived',
      actorType: 'external_customer',
      payload: { signal_type: 'invoice_view', source: 'public_link', run_id: runId },
    });
  }

  // Gap 5: Use ensureSuspension to conditionally emit AutomationSuspended
  await ensureSuspension({
    tenantId: derivedTenantId,
    entityType: 'invoice',
    entityId: invoiceId,
    reason: 'invoice_viewed',
  });

  // Gap 7: Null-safe lead linkage - suspend lead if exists, update timestamp
  if (leadId) {
    await ensureSuspension({
      tenantId: derivedTenantId,
      entityType: 'lead',
      entityId: leadId,
      reason: 'invoice_viewed',
    });

    await supabaseAdmin
      .from('leads')
      .update({ last_human_signal_at: new Date().toISOString() })
      .eq('id', leadId);
  }

  await createMoneyLoopTask({
    tenantId: derivedTenantId,
    sourceType: 'invoice',
    sourceId: invoiceId,
    title: 'Invoice Viewed – Follow Up',
    leadId,
    metadata: { run_id: runId },
  });

  return respondJson({ invoice: data }, 200, cors.headers);
});
