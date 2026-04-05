import Stripe from 'https://esm.sh/stripe@14.25.0?target=deno';
import { corsHeaders } from './cors.ts';
import { getTenantIdFromClaims, getVerifiedClaims } from '../_shared/auth.ts';
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { enqueueInvoiceReminderLadder, logMoneyLoopEvent, hasRecentEvent } from '../_shared/moneyLoopUtils.ts';
import { sendDocumentSms } from '../_shared/sms.ts';
import {
  BUSINESS_WEBSITE,
  BUSINESS_EMAIL,
  BUSINESS_PHONE_DISPLAY,
  BUSINESS_PHONE_TEL,
  BUSINESS_ADDRESS_LINE1,
  BUSINESS_ADDRESS_LINE2,
  LOGO_URL,
  BADGE_NADCA_URL,
  BADGE_CLEAN_AIR_URL,
  BADGE_SDVOSB_URL,
  escapeHtml,
  renderEmailLayout,
  sendEmail,
} from '../_shared/email.ts';
import { renderHtmlToPdfBytes, pdfAttachmentFromBytes } from '../_shared/htmlToPdf.ts';
import { base64EncodeBytes } from '../_shared/pdfUtils.ts';
import { TVG_DOC_BLOCKS, TVG_DOC_BLOCKS_HTML } from '../_shared/documentBlocks.ts';
import {
  loadLeadDeliveryProfile,
  normalizeRequestedDeliveryChannel,
  persistDocumentDeliveryPreference,
  resolveDocumentDelivery,
} from '../_shared/documentDelivery.ts';

type InvoiceItemRow = {
  description: string | null;
  quantity: number | string | null;
  unit_price: number | string | null;
  total_price: number | string | null;
};

type LeadRow = {
  id?: string | null;
  contact_id?: string | null;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  email: string | null;
  phone?: string | null;
  preferred_document_delivery?: string | null;
  sms_consent?: boolean | null;
  sms_opt_out?: boolean | null;
};

type InvoiceRow = {
  id: string;
  tenant_id: string | null;
  invoice_number: string | number | null;
  status: string | null;
  subtotal: number | string | null;
  tax_amount: number | string | null;
  total_amount: number | string | null;
  amount_paid: number | string | null;
  balance_due: number | string | null;
  due_date: string | null;
  issue_date: string | null;
  notes: string | null;
  terms: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  public_token: string | null;
  sent_at: string | null;
  lead_id: string | null;
  invoice_items: InvoiceItemRow[] | null;
  leads: LeadRow | LeadRow[] | null;
};

type AttachmentInput =
  | string
  | {
      filename?: string;
      path?: string;
      url?: string;
      content?: string;
      content_base64?: string;
      contentType?: string;
      content_type?: string;
    };

type ResendAttachment = {
  filename?: string;
  path?: string;
  content?: string;
  content_type?: string;
};

type RecipientList = string[];

type PdfFontKey = 'F1' | 'F2';

type PdfTextLine = {
  text: string;
  x: number;
  y: number;
  size: number;
  font: PdfFontKey;
};

const respondJson = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const parseJson = async (req: Request): Promise<Record<string, unknown>> => {
  try {
    const parsed = await req.json();
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
};

const asString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const asNumber = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
};

const normalizeRecipientList = (value: unknown): RecipientList => {
  const source = Array.isArray(value) ? value : [value];
  return Array.from(
    new Set(
      source
        .flatMap((entry) => (typeof entry === 'string' ? entry.split(/[;,]/g) : []))
        .map((entry) => entry.trim())
        .filter((entry) => entry.includes('@')),
    ),
  );
};

const normalizeBase64 = (value: string): string => {
  const trimmed = value.trim();
  const marker = 'base64,';
  const idx = trimmed.indexOf(marker);
  return idx >= 0 ? trimmed.slice(idx + marker.length) : trimmed;
};

const wrapTextByChars = (text: string, maxChars: number): string[] => {
  const cleaned = String(text || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return [''];
  const words = cleaned.split(' ');
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    if (!current) {
      current = word;
      continue;
    }
    if ((current.length + 1 + word.length) <= maxChars) {
      current += ` ${word}`;
      continue;
    }
    lines.push(current);
    current = word;
  }
  if (current) lines.push(current);
  return lines.length ? lines : [''];
};

const normalizePdfText = (value: string) =>
  String(value ?? '')
    .replaceAll('\r', ' ')
    .replaceAll('\n', ' ')
    .replaceAll('\t', ' ')
    .replace(/\s+/g, ' ')
    .trim();

const escapePdfText = (value: string) =>
  normalizePdfText(value)
    .replaceAll('\\', '\\\\')
    .replaceAll('(', '\\(')
    .replaceAll(')', '\\)');

const buildPdfDocument = (pages: PdfTextLine[][]): Uint8Array => {
  // Dependency-free minimal PDF writer (ASCII-only Type1 fonts).
  // Mirrors the proven implementation used by send-estimate.
  const encoder = new TextEncoder();
  const objects: string[] = [];
  const pageObjectIds: number[] = [];
  let nextObjectId = 5;

  // 1=catalog, 2=pages, 3/4=fonts
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  objects[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>';

  for (const page of pages) {
    const contentStream = page
      .map((line) => `BT /${line.font} ${line.size} Tf 1 0 0 1 ${line.x} ${line.y} Tm (${escapePdfText(line.text)}) Tj ET`)
      .join('\n');

    const contentObjectId = nextObjectId++;
    const pageObjectId = nextObjectId++;
    const contentLength = encoder.encode(contentStream).length;

    objects[contentObjectId] = `<< /Length ${contentLength} >>\nstream\n${contentStream}\nendstream`;
    objects[pageObjectId] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ` +
      `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObjectId} 0 R >>`;

    pageObjectIds.push(pageObjectId);
  }

  objects[2] = `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageObjectIds.length} >>`;

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];

  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = encoder.encode(pdf).length;
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }

  const startXref = encoder.encode(pdf).length;
  pdf += `xref\n0 ${objects.length}\n`;
  pdf += '0000000000 65535 f \n';
  for (let id = 1; id < objects.length; id += 1) {
    pdf += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF`;

  return encoder.encode(pdf);
};

const sanitizeFilenamePart = (value: string) =>
  String(value || '')
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);

const buildInvoicePdfAttachment = (params: {
  invoiceNumberText: string;
  recipientName: string;
  issueDateText: string;
  dueDateText: string;
  lineItems: InvoiceItemRow[];
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  amountDue: number;
  payLink: string;
}) => {
  const pages: PdfTextLine[][] = [];
  let currentPage: PdfTextLine[] = [];
  let cursorY = 742;

  const startPage = (continued = false) => {
    currentPage = [];
    pages.push(currentPage);
    cursorY = 742;

    currentPage.push({
      text: continued
        ? `Invoice #${params.invoiceNumberText} (continued)`
        : `Invoice #${params.invoiceNumberText}`,
      x: 50,
      y: cursorY,
      size: 18,
      font: 'F2',
    });
    cursorY -= 24;

    currentPage.push({ text: 'The Vent Guys', x: 50, y: cursorY, size: 11, font: 'F2' });
    cursorY -= 16;
    currentPage.push({
      text: `${BUSINESS_ADDRESS_LINE1} | ${BUSINESS_ADDRESS_LINE2}`,
      x: 50,
      y: cursorY,
      size: 9,
      font: 'F1',
    });
    cursorY -= 14;
    currentPage.push({
      text: `${BUSINESS_PHONE_DISPLAY} | vent-guys.com | ${BUSINESS_EMAIL}`,
      x: 50,
      y: cursorY,
      size: 9,
      font: 'F1',
    });
    cursorY -= 20;
  };

  const ensureSpace = (heightNeeded: number) => {
    if (cursorY - heightNeeded < 60) startPage(true);
  };

  const addWrappedText = (text: string, opts?: { x?: number; size?: number; font?: PdfFontKey; maxChars?: number; gapAfter?: number }) => {
    const x = opts?.x ?? 50;
    const size = opts?.size ?? 12;
    const font = opts?.font ?? 'F1';
    const maxChars = opts?.maxChars ?? 86;
    const gapAfter = opts?.gapAfter ?? 4;
    const lines = wrapTextByChars(text, maxChars);
    const lineHeight = size + 4;
    ensureSpace(lines.length * lineHeight + gapAfter);
    for (const line of lines) {
      currentPage.push({ text: line, x, y: cursorY, size, font });
      cursorY -= lineHeight;
    }
    cursorY -= gapAfter;
  };

  startPage(false);
  addWrappedText(`Billed to: ${params.recipientName || 'Customer'}`, { size: 12, font: 'F1', maxChars: 90 });
  addWrappedText(`Issue Date: ${params.issueDateText}${params.dueDateText ? ` | Due Date: ${params.dueDateText}` : ''}`, {
    size: 11,
    font: 'F1',
    maxChars: 100,
    gapAfter: 10,
  });

  addWrappedText('Line Items', { size: 14, font: 'F2', gapAfter: 4 });
  ensureSpace(20);
  currentPage.push({ text: 'Description', x: 50, y: cursorY, size: 11, font: 'F2' });
  currentPage.push({ text: 'Qty', x: 375, y: cursorY, size: 11, font: 'F2' });
  currentPage.push({ text: 'Unit', x: 430, y: cursorY, size: 11, font: 'F2' });
  currentPage.push({ text: 'Total', x: 505, y: cursorY, size: 11, font: 'F2' });
  cursorY -= 18;

  for (const item of params.lineItems) {
    const quantity = Math.max(1, Math.round(asNumber(item.quantity) || 1));
    const unitPrice = Math.max(0, asNumber(item.unit_price));
    const lineTotal = Math.max(0, asNumber(item.total_price) || quantity * unitPrice);
    const descriptionLines = wrapTextByChars(item.description || 'Service', 46);
    const rowHeight = descriptionLines.length * 14 + 4;
    ensureSpace(rowHeight + 8);

    descriptionLines.forEach((line, index) => {
      currentPage.push({ text: line, x: index === 0 ? 50 : 62, y: cursorY, size: 10, font: 'F1' });
      if (index === 0) {
        currentPage.push({ text: String(quantity), x: 378, y: cursorY, size: 10, font: 'F1' });
        currentPage.push({ text: formatCurrency(unitPrice), x: 430, y: cursorY, size: 10, font: 'F1' });
        currentPage.push({ text: formatCurrency(lineTotal), x: 505, y: cursorY, size: 10, font: 'F1' });
      }
      cursorY -= 14;
    });
    cursorY -= 4;
  }

  addWrappedText(`Subtotal: ${formatCurrency(params.subtotal)}`, { size: 11, font: 'F1', x: 360, maxChars: 30, gapAfter: 0 });
  if (params.taxAmount > 0) {
    addWrappedText(`Fee: ${formatCurrency(params.taxAmount)}`, { size: 11, font: 'F1', x: 360, maxChars: 30, gapAfter: 0 });
  }
  addWrappedText(`Total: ${formatCurrency(params.totalAmount)}`, { size: 12, font: 'F2', x: 360, maxChars: 30, gapAfter: 2 });
  addWrappedText(`Amount Due: ${formatCurrency(params.amountDue)}`, { size: 12, font: 'F2', x: 360, maxChars: 30, gapAfter: 12 });

  addWrappedText('Pay Online', { size: 14, font: 'F2', gapAfter: 3 });
  addWrappedText('Use the secure payment link below:', { size: 11, font: 'F1', maxChars: 92, gapAfter: 2 });
  addWrappedText(params.payLink, { size: 10, font: 'F1', maxChars: 88, gapAfter: 8 });

  addWrappedText('Questions? Reply to the invoice email or call The Vent Guys.', { size: 10, font: 'F1', maxChars: 92, gapAfter: 0 });

  const pdfBytes = buildPdfDocument(pages);
  const filename = `${sanitizeFilenamePart(`invoice-${params.invoiceNumberText || 'pending'}`)}.pdf`;
  return { filename, content: base64EncodeBytes(pdfBytes), content_type: 'application/pdf' };
};

const buildInvoiceHtmlDocument = (params: {
  invoiceNumberText: string;
  recipientName: string;
  issueDateText: string;
  dueDateText: string;
  lineItems: InvoiceItemRow[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
  amountDue: number;
  payLink: string;
}) => {
  const rows = (params.lineItems || []).map((item) => {
    const desc = escapeHtml(item.description || '');
    const qty = escapeHtml(String(item.quantity ?? ''));
    const unit = escapeHtml(formatCurrency(asNumber(item.unit_price)));
    const total = escapeHtml(formatCurrency(asNumber(item.total_price)));
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

  const positioning = `
    <div class="block">
      <div class="blockTitle">${escapeHtml(TVG_DOC_BLOCKS_HTML.positioning_title)}</div>
      <div class="blockBody">${escapeHtml(TVG_DOC_BLOCKS_HTML.positioning_body)}</div>
    </div>
  `;

  const trust = `
    <div class="block">
      <div class="blockTitle">Trust and Authority</div>
      <ul class="bullets">
        ${TVG_DOC_BLOCKS_HTML.trust_bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join('')}
      </ul>
    </div>
  `;

  const referral = `
    <div class="block">
      <div class="blockTitle">${escapeHtml(TVG_DOC_BLOCKS_HTML.referral_title)}</div>
      <ul class="bullets">
        ${TVG_DOC_BLOCKS_HTML.referral_bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join('')}
      </ul>
    </div>
  `;

  const signature = `<div class="signature">${TVG_DOC_BLOCKS_HTML.signature_line}</div>`;

  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Invoice #${escapeHtml(params.invoiceNumberText)}</title>
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
        .totRow strong { color:#0f172a; }
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
          <div class="title">Invoice #${escapeHtml(params.invoiceNumberText)}</div>
          <div class="meta">
            <div><strong>Bill to:</strong> ${escapeHtml(params.recipientName)}</div>
            ${params.issueDateText ? `<div><strong>Issue date:</strong> ${escapeHtml(params.issueDateText)}</div>` : ''}
            ${params.dueDateText ? `<div><strong>Due date:</strong> ${escapeHtml(params.dueDateText)}</div>` : ''}
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
              <div class="totRow"><span>Subtotal</span><strong>${escapeHtml(formatCurrency(params.subtotal))}</strong></div>
              <div class="totRow"><span>${escapeHtml(taxLabel)}</span><strong>${escapeHtml(formatCurrency(params.taxAmount))}</strong></div>
              <div class="totFinal"><span>Total</span><span>${escapeHtml(formatCurrency(params.totalAmount))}</span></div>
              <div class="totRow"><span>Balance due</span><strong>${escapeHtml(formatCurrency(params.amountDue))}</strong></div>
            </div>
          </div>

          <div class="blocks">
            ${positioning}
            ${trust}
            ${referral}
            ${signature}
          </div>

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

const deriveFilenameFromPath = (path: string, index: number): string => {
  try {
    const url = new URL(path);
    const last = url.pathname.split('/').filter(Boolean).pop();
    if (last) return decodeURIComponent(last);
  } catch {
    const normalized = path.replace(/\\/g, '/');
    const last = normalized.split('/').filter(Boolean).pop();
    if (last) return last;
  }
  return `attachment-${index + 1}.pdf`;
};

const normalizeAttachment = (input: AttachmentInput, index: number): ResendAttachment | null => {
  if (typeof input === 'string') {
    const path = input.trim();
    if (!path) return null;
    return { path, filename: deriveFilenameFromPath(path, index) };
  }

  if (!input || typeof input !== 'object') return null;

  const path = asString(input.path) || asString(input.url);
  const content = asString(input.content_base64) || asString(input.content);
  const filename = asString(input.filename);
  const contentType = asString(input.content_type) || asString(input.contentType);

  if (path) {
    return {
      path,
      filename: filename || deriveFilenameFromPath(path, index),
    };
  }

  if (content) {
    return {
      filename: filename || `attachment-${index + 1}.pdf`,
      content: normalizeBase64(content),
      content_type: contentType || 'application/pdf',
    };
  }

  return null;
};

const normalizeAttachments = (
  attachmentsInput: unknown,
  documentUrlsInput: unknown,
): ResendAttachment[] => {
  const rawAttachments = Array.isArray(attachmentsInput) ? attachmentsInput : [];
  const rawUrls = Array.isArray(documentUrlsInput) ? documentUrlsInput : [];

  const merged: AttachmentInput[] = [
    ...rawAttachments,
    ...rawUrls.filter((entry) => typeof entry === 'string'),
  ];

  const dedupe = new Set<string>();
  const out: ResendAttachment[] = [];

  merged.forEach((entry, index) => {
    const normalized = normalizeAttachment(entry, index);
    if (!normalized) return;

    const key = `${normalized.filename || ''}|${normalized.path || ''}|${normalized.content?.slice(0, 24) || ''}`;
    if (dedupe.has(key)) return;
    dedupe.add(key);
    out.push(normalized);
  });

  return out;
};

const normalizeLead = (lead: LeadRow | LeadRow[] | null | undefined): LeadRow | null => {
  if (!lead) return null;
  if (Array.isArray(lead)) return lead[0] ?? null;
  return lead;
};

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

const formatDate = (value: string | null | undefined): string => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return '';
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
};

const normalizeInvoiceNumber = (value: string | number | null | undefined): string => {
  const asText = `${value ?? ''}`.trim();
  return asText || 'Pending';
};

const getPayBaseUrl = (): string => {
  // Payment links must never inherit the quote domain automatically.
  // Quotes may live on a marketing domain while payments live on the app domain.
  const configured = Deno.env.get('PUBLIC_PAY_BASE_URL') || 'https://app.bhfos.com';
  return configured.replace(/\/$/, '');
};

const buildFallbackPayLink = (publicToken: string): string =>
  `${getPayBaseUrl()}/pay/${publicToken}`;

const computeDaysUntilDue = (dueDate: string | null | undefined): number | null => {
  if (!dueDate) return null;
  const target = new Date(`${dueDate}T00:00:00Z`);
  if (Number.isNaN(target.valueOf())) return null;
  const now = new Date();
  const diffMs = target.getTime() - now.getTime();
  const days = Math.ceil(diffMs / 86_400_000);
  if (!Number.isFinite(days) || days < 1) return null;
  return Math.min(days, 365);
};

const createOrReuseStripeCustomer = async (
  stripe: Stripe,
  email: string,
  name: string,
  tenantId: string | null,
) => {
  const existing = await stripe.customers.list({ email, limit: 1 });
  if (existing.data[0]) return existing.data[0];
  return await stripe.customers.create({
    email,
    name: name || undefined,
    metadata: tenantId ? { tenant_id: tenantId } : undefined,
  });
};

const createStripeHostedInvoice = async (
  stripe: Stripe,
  invoice: InvoiceRow,
  recipientEmail: string,
  recipientName: string,
) => {
  const customer = await createOrReuseStripeCustomer(
    stripe,
    recipientEmail,
    recipientName,
    invoice.tenant_id,
  );

  const daysUntilDue = computeDaysUntilDue(invoice.due_date) ?? 14;
  const localInvoiceId = invoice.id;
  const localInvoiceNumber = normalizeInvoiceNumber(invoice.invoice_number);

  const stripeInvoice = await stripe.invoices.create({
    customer: customer.id,
    collection_method: 'send_invoice',
    days_until_due: daysUntilDue,
    auto_advance: false,
    description: `The Vent Guys Invoice #${localInvoiceNumber}`,
    metadata: {
      local_invoice_id: localInvoiceId,
      local_invoice_number: localInvoiceNumber,
      tenant_id: invoice.tenant_id ?? '',
    },
  });

  const itemRows = Array.isArray(invoice.invoice_items) ? invoice.invoice_items : [];
  const normalizedRows = itemRows.filter((row) => asNumber(row.total_price) > 0);

  if (normalizedRows.length > 0) {
    for (const row of normalizedRows) {
      const amountCents = Math.round(asNumber(row.total_price) * 100);
      if (amountCents <= 0) continue;
      const quantity = Math.max(1, Math.round(asNumber(row.quantity) || 1));
      const baseDescription = asString(row.description) || 'Service line item';
      const description = quantity > 1 ? `${baseDescription} (Qty ${quantity})` : baseDescription;
      await stripe.invoiceItems.create({
        customer: customer.id,
        invoice: stripeInvoice.id,
        amount: amountCents,
        currency: 'usd',
        description,
      });
    }
  } else {
    const fallbackAmount = Math.round(
      Math.max(asNumber(invoice.balance_due), asNumber(invoice.total_amount), 0) * 100,
    );
    if (fallbackAmount > 0) {
      await stripe.invoiceItems.create({
        customer: customer.id,
        invoice: stripeInvoice.id,
        amount: fallbackAmount,
        currency: 'usd',
        description: `Invoice #${localInvoiceNumber}`,
      });
    }
  }

  const taxAmount = asNumber(invoice.tax_amount);
  if (taxAmount > 0) {
    await stripe.invoiceItems.create({
      customer: customer.id,
      invoice: stripeInvoice.id,
      amount: Math.round(taxAmount * 100),
      currency: 'usd',
      description: 'Card processing fee',
    });
  }

  const finalized = await stripe.invoices.finalizeInvoice(stripeInvoice.id);

  return {
    stripeInvoiceId: finalized.id,
    stripeCustomerId: customer.id,
    hostedInvoiceUrl: finalized.hosted_invoice_url || null,
    invoicePdfUrl: finalized.invoice_pdf || null,
  };
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return respondJson({ error: 'Method not allowed' }, 405);
  }

  try {
    const body = await parseJson(req);
    const invoiceId = asString(body.invoice_id);
    if (!invoiceId) {
      return respondJson({ error: 'invoice_id is required' }, 400);
    }

    let claimsTenantId: string | null = null;
    let actorId: string | null = null;
    try {
      const verified = await getVerifiedClaims(req);
      claimsTenantId = getTenantIdFromClaims(verified.claims);
      actorId = typeof verified.claims.sub === 'string' ? verified.claims.sub : null;
    } catch {
      // Request can still proceed for system/service invocations.
    }

    const bodyTenantId = asString(body.tenant_id);

    const { data: invoiceRaw, error: invoiceError } = await supabaseAdmin
      .from('invoices')
      .select(
        `
        id,
        tenant_id,
        invoice_number,
        status,
        subtotal,
        tax_amount,
        total_amount,
        amount_paid,
        balance_due,
        due_date,
        issue_date,
        notes,
        terms,
        customer_name,
        customer_email,
        customer_phone,
        public_token,
        sent_at,
        lead_id,
        invoice_items (
          description,
          quantity,
          unit_price,
          total_price
        ),
        leads (
          first_name,
          last_name,
          company,
          email,
          phone
        )
      `,
      )
      .eq('id', invoiceId)
      .maybeSingle();

    if (invoiceError || !invoiceRaw) {
      return respondJson({ error: 'Invoice not found' }, 404);
    }

    const invoice = invoiceRaw as InvoiceRow;

    if (claimsTenantId && invoice.tenant_id && claimsTenantId !== invoice.tenant_id) {
      return respondJson({ error: 'Forbidden' }, 403);
    }

    if (bodyTenantId && invoice.tenant_id && bodyTenantId !== invoice.tenant_id) {
      return respondJson({ error: 'Tenant mismatch' }, 403);
    }

    let publicToken = asString(invoice.public_token);
    if (!publicToken) {
      publicToken = crypto.randomUUID();
      await supabaseAdmin
        .from('invoices')
        .update({ public_token: publicToken, updated_at: new Date().toISOString() })
        .eq('id', invoice.id);
    }

    // Allow the CRM to fetch a branded invoice PDF without sending an email/SMS.
    // This is intentionally independent of delivery resolution so ops can download even
    // when the customer contact info is incomplete.
    if (body.return_pdf === true) {
      const invoiceNumber = normalizeInvoiceNumber(invoice.invoice_number);
      const amountDue = Math.max(asNumber(invoice.balance_due), 0);
      const totalAmount = Math.max(asNumber(invoice.total_amount), 0);
      const issueDateText = formatDate(invoice.issue_date);
      const dueDateText = formatDate(invoice.due_date);
      const lead = normalizeLead(invoice.leads);
      const leadName = [asString(lead?.first_name), asString(lead?.last_name)].filter(Boolean).join(' ');
      const recipientName = asString(invoice.customer_name) || asString(lead?.company) || leadName || 'Customer';
      const payLink = buildFallbackPayLink(publicToken);
      const lineItems = Array.isArray(invoice.invoice_items) ? invoice.invoice_items : [];
      const subtotal = Math.max(asNumber(invoice.subtotal), 0);
      const taxAmount = Math.max(asNumber(invoice.tax_amount), 0);

      const wantsHtml = String(body.pdf_renderer || '').toLowerCase() !== 'text';
      let pdf = null as null | Record<string, unknown>;
      let rendererUsed: 'pdfshift' | 'text' = 'text';
      let rendererError: string | null = null;

       if (wantsHtml) {
         const htmlDoc = buildInvoiceHtmlDocument({
           invoiceNumberText: invoiceNumber,
           recipientName,
           issueDateText,
           dueDateText,
           lineItems,
           subtotal,
           taxRate: Math.max(asNumber(invoice.tax_rate), 0),
           taxAmount,
           totalAmount,
           amountDue,
           payLink,
         });
        const rendered = await renderHtmlToPdfBytes({ html: htmlDoc, letter: true });
        if (rendered.ok) {
          rendererUsed = 'pdfshift';
          pdf = pdfAttachmentFromBytes({
            filename: `${sanitizeFilenamePart(`invoice-${invoiceNumber || 'pending'}`)}.pdf`,
            bytes: rendered.bytes,
          });
        } else {
          rendererError = rendered.error;
        }
      }

      if (!pdf) {
        rendererUsed = 'text';
        pdf = buildInvoicePdfAttachment({
          invoiceNumberText: invoiceNumber,
          recipientName,
          issueDateText,
          dueDateText,
          lineItems,
          subtotal,
          taxAmount,
          totalAmount,
          amountDue,
          payLink,
        });
      }

      return respondJson({
        success: true,
        invoice_id: invoice.id,
        fallback_pay_url: payLink,
        pdf,
        pdf_renderer_used: rendererUsed,
        pdf_renderer_error: rendererError,
      });
    }

    const lead = normalizeLead(invoice.leads);
    const deliveryProfile = await loadLeadDeliveryProfile({
      tenantId: invoice.tenant_id || bodyTenantId || claimsTenantId || null,
      leadId: invoice.lead_id,
    });
    const requestedDeliveryChannel = normalizeRequestedDeliveryChannel(
      body.delivery_channel ?? body.send_via ?? body.channel,
    );
    const deliveryResolution = resolveDocumentDelivery({
      requestedChannel: requestedDeliveryChannel,
      email:
        asString(body.to_email) ||
        asString(body.email) ||
        asString(invoice.customer_email) ||
        asString(lead?.email) ||
        deliveryProfile?.email ||
        null,
      phone:
        asString(body.to_phone) ||
        asString(body.phone) ||
        asString(invoice.customer_phone) ||
        asString(lead?.phone) ||
        deliveryProfile?.phone ||
        null,
      preferredDocumentDelivery:
        deliveryProfile?.preferredDocumentDelivery ??
        (asString(lead?.preferred_document_delivery) || null),
      preferredContactMethod: deliveryProfile?.preferredContactMethod || null,
      smsOptOut:
        deliveryProfile?.smsOptOut ?? lead?.sms_opt_out === true,
    });
    const toEmail = deliveryResolution.recipientEmail ?? '';
    const recipientPhone = deliveryResolution.recipientPhone ?? '';
    const deliveryChannel = deliveryResolution.deliveryChannel;

    if (!deliveryChannel) {
      return respondJson(
        {
          error: 'No deliverable customer contact found for invoice',
          code: 'NO_DELIVERABLE_CONTACT',
          missing_fields: deliveryResolution.missingFields,
          requested_delivery_channel: requestedDeliveryChannel,
          delivery_resolution_reason: deliveryResolution.resolutionReason,
        },
        400,
      );
    }

    const cc = normalizeRecipientList(body.cc);
    const bcc = normalizeRecipientList(body.bcc);
    const attachPdf = deliveryChannel === 'email' && body.attach_pdf !== false;
    const baseAttachments = normalizeAttachments(body.attachments, body.document_urls);
    const dryRun = body.dry_run === true;

    const invoiceNumber = normalizeInvoiceNumber(invoice.invoice_number);
    const amountDue = Math.max(asNumber(invoice.balance_due), 0);
    const totalAmount = Math.max(asNumber(invoice.total_amount), 0);
    const issueDateText = formatDate(invoice.issue_date);
    const dueDateText = formatDate(invoice.due_date);
    const leadName = [asString(lead?.first_name), asString(lead?.last_name)].filter(Boolean).join(' ');
    const recipientName = asString(invoice.customer_name) || asString(lead?.company) || leadName || 'Customer';

    // Customer-facing invoice emails must always route through the CRM pay page.
    // Stripe-hosted invoice artifacts remain optional internal diagnostics only.
    const includeStripeInvoice = body.include_stripe_invoice === true;
    let stripeHostedInvoiceUrl: string | null = null;
    let stripeInvoicePdfUrl: string | null = null;
    let stripeInvoiceId: string | null = null;
    let stripeCustomerId: string | null = null;
    let stripeError: string | null = null;

    if (includeStripeInvoice && amountDue > 0) {
      const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
      if (stripeSecret) {
        try {
          const stripe = new Stripe(stripeSecret, { apiVersion: '2024-06-20' });
          const stripePayload = await createStripeHostedInvoice(
            stripe,
            invoice,
            toEmail,
            recipientName,
          );
          stripeHostedInvoiceUrl = stripePayload.hostedInvoiceUrl;
          stripeInvoicePdfUrl = stripePayload.invoicePdfUrl;
          stripeInvoiceId = stripePayload.stripeInvoiceId;
          stripeCustomerId = stripePayload.stripeCustomerId;
        } catch (err) {
          stripeError = err instanceof Error ? err.message : 'stripe_invoice_creation_failed';
        }
      } else {
        stripeError = 'missing_stripe_secret_key';
      }
    }

    const payLink = buildFallbackPayLink(publicToken);
    let pdfAttachment: Record<string, unknown> | null = null;
    if (attachPdf) {
      const lineItems = Array.isArray(invoice.invoice_items) ? invoice.invoice_items : [];
      const subtotal = Math.max(asNumber(invoice.subtotal), 0);
      const taxAmount = Math.max(asNumber(invoice.tax_amount), 0);
      const wantsHtml = String(body.pdf_renderer || '').toLowerCase() !== 'text';

      if (wantsHtml) {
        const htmlDoc = buildInvoiceHtmlDocument({
          invoiceNumberText: invoiceNumber,
          recipientName,
          issueDateText,
          dueDateText,
          lineItems,
          subtotal,
          taxRate: Math.max(asNumber(invoice.tax_rate), 0),
          taxAmount,
          totalAmount,
          amountDue,
          payLink,
        });
        const rendered = await renderHtmlToPdfBytes({ html: htmlDoc, letter: true });
        if (rendered.ok) {
          pdfAttachment = pdfAttachmentFromBytes({
            filename: `${sanitizeFilenamePart(`invoice-${invoiceNumber || 'pending'}`)}.pdf`,
            bytes: rendered.bytes,
          });
        }
      }

      if (!pdfAttachment) {
        pdfAttachment = buildInvoicePdfAttachment({
          invoiceNumberText: invoiceNumber,
          recipientName,
          issueDateText,
          dueDateText,
          lineItems,
          subtotal,
          taxAmount,
          totalAmount,
          amountDue,
          payLink,
        });
      }
    }

    const attachments = pdfAttachment ? [...baseAttachments, pdfAttachment] : baseAttachments;

    const attachmentSummary =
      attachments.length > 0
        ? `<p><strong>Attached documents:</strong> ${escapeHtml(String(attachments.length))} file(s) included with this email.</p>`
        : '<p><strong>Attached documents:</strong> None included.</p>';

    const bodyHtml = `
      <p>Hi ${escapeHtml(recipientName)},</p>
      <p>Your invoice from The Vent Guys is ready.</p>
      <p><strong>Invoice #:</strong> ${escapeHtml(invoiceNumber)}</p>
      <p><strong>Total:</strong> ${escapeHtml(formatCurrency(totalAmount))}</p>
      <p><strong>Balance due:</strong> ${escapeHtml(formatCurrency(amountDue))}</p>
      ${issueDateText ? `<p><strong>Issue date:</strong> ${escapeHtml(issueDateText)}</p>` : ''}
      ${dueDateText ? `<p><strong>Due date:</strong> ${escapeHtml(dueDateText)}</p>` : ''}
      <p style="margin:18px 0 10px 0;"><strong>To pay online, use the button below.</strong></p>
      <p style="margin:0 0 18px 0;">
        <a
          href="${payLink}"
          style="display:inline-block; background:#173861; color:#ffffff; text-decoration:none; font-weight:700; padding:14px 24px; border-radius:10px;"
        >Pay Invoice</a>
      </p>
      <p style="color:#555; font-size:13px;">Secure payment is handled through The Vent Guys billing portal.</p>
      ${attachmentSummary}
      <p>If you have any questions, reply to this email and we will help right away.</p>
    `;

    const html = renderEmailLayout({
      preheader: `Invoice #${invoiceNumber} from The Vent Guys`,
      title: `Invoice #${invoiceNumber}`,
      bodyHtml,
    });

    const subject = `Invoice #${invoiceNumber} - ${formatCurrency(Math.max(amountDue, totalAmount))}`;

    if (dryRun) {
      if (deliveryChannel === 'sms') {
        const smsPreview = await sendDocumentSms({
          documentType: 'invoice',
          documentUrl: payLink,
          to: recipientPhone,
          recipientName,
          referenceNumber: invoiceNumber,
          dryRun: true,
        });
        return respondJson({
          dry_run: true,
          delivery_channel: 'sms',
          requested_delivery_channel: requestedDeliveryChannel,
          delivery_resolution_reason: deliveryResolution.resolutionReason,
          invoice_id: invoice.id,
          sms_preview: {
            to: smsPreview.to,
            body: smsPreview.body,
            document_url: payLink,
          },
          fallback_pay_url: payLink,
        });
      }

      return respondJson({
        dry_run: true,
        delivery_channel: 'email',
        requested_delivery_channel: requestedDeliveryChannel,
        delivery_resolution_reason: deliveryResolution.resolutionReason,
        invoice_id: invoice.id,
        to: [toEmail],
        cc,
        bcc,
        subject,
        stripe_invoice_url: stripeHostedInvoiceUrl,
        stripe_invoice_pdf_url: stripeInvoicePdfUrl,
        stripe_invoice_id: stripeInvoiceId,
        stripe_customer_id: stripeCustomerId,
        stripe_error: stripeError,
        fallback_pay_url: payLink,
        attachments_count: attachments.length,
      });
    }

    let providerId: string | null = null;
    let smsResult: Awaited<ReturnType<typeof sendDocumentSms>> | null = null;

    if (deliveryChannel === 'sms') {
      const duplicateSms = await hasRecentEvent({
        entityType: 'invoice',
        entityId: invoice.id,
        eventType: 'InvoiceSmsSent',
        windowMinutes: 10,
      });

      if (duplicateSms) {
        return respondJson({
          success: true,
          invoice_id: invoice.id,
          delivery_channel: 'sms',
          skipped: true,
          reason: 'duplicate_recent_send',
        });
      }

      smsResult = await sendDocumentSms({
        documentType: 'invoice',
        documentUrl: payLink,
        to: recipientPhone,
        recipientName,
        referenceNumber: invoiceNumber,
      });

      if (!smsResult.success) {
        return respondJson(
          {
            error: smsResult.error || 'SMS send failed',
            code: smsResult.code || 'SMS_SEND_FAILED',
            delivery_channel: 'sms',
            details: smsResult.details ?? null,
          },
          400,
        );
      }

      await logMoneyLoopEvent({
        tenantId: invoice.tenant_id || bodyTenantId || null,
        entityType: 'invoice',
        entityId: invoice.id,
        eventType: 'InvoiceSmsSent',
        actorType: actorId ? 'user' : 'system',
        actorId,
        payload: {
          invoice_number: invoiceNumber,
          recipient_phone: smsResult.to,
          sms_sid: smsResult.sid ?? null,
          delivery_channel: 'sms',
          requested_delivery_channel: requestedDeliveryChannel,
          delivery_resolution_reason: deliveryResolution.resolutionReason,
        },
      });
    } else {
      const provider = await sendEmail({
        from: 'The Vent Guys <info@vent-guys.com>',
        to: [toEmail],
        cc: cc.length ? cc : undefined,
        bcc: bcc.length ? bcc : undefined,
        subject,
        html,
        attachments: attachments.length ? attachments : undefined,
      });
      providerId = (provider as Record<string, unknown>)?.id
        ? String((provider as Record<string, unknown>).id)
        : null;
    }

    const nowIso = new Date().toISOString();
    const draftInvoice = asString(invoice.status).toLowerCase() === 'draft';
    const invoiceUpdate: Record<string, unknown> = {
      updated_at: nowIso,
      sent_at: invoice.sent_at ?? nowIso,
    };

    if (draftInvoice) {
      invoiceUpdate.status = 'sent';
      invoiceUpdate.release_approved = true;
      invoiceUpdate.release_approved_at = nowIso;
    }

    const { error: updateError } = await supabaseAdmin
      .from('invoices')
      .update(invoiceUpdate)
      .eq('id', invoice.id);

    if (updateError) {
      console.error('send-invoice status update failed:', updateError);
      return respondJson({ error: updateError.message || 'Invoice email sent but status update failed.' }, 500);
    }

    await enqueueInvoiceReminderLadder({
      tenantId: invoice.tenant_id || bodyTenantId || 'tvg',
      invoiceId: invoice.id,
      leadId: invoice.lead_id,
      invoiceNumber,
      sentAt: invoiceUpdate.sent_at as string,
    });

    await persistDocumentDeliveryPreference({
      tenantId: invoice.tenant_id || bodyTenantId || claimsTenantId || null,
      leadId: invoice.lead_id,
      deliveryChannel,
    });

    await logMoneyLoopEvent({
      tenantId: invoice.tenant_id || bodyTenantId || null,
      entityType: 'invoice',
      entityId: invoice.id,
      eventType: 'InvoiceSent',
      actorType: actorId ? 'user' : 'system',
      actorId,
      payload: {
        invoice_number: invoiceNumber,
        recipient_email: deliveryChannel === 'sms' ? null : toEmail,
        recipient_phone: deliveryChannel === 'sms' ? recipientPhone : null,
        delivery_channel: deliveryChannel,
        sms_sid: smsResult?.sid ?? null,
        requested_delivery_channel: requestedDeliveryChannel,
        delivery_resolution_reason: deliveryResolution.resolutionReason,
        balance_due: amountDue,
      },
    });

    return respondJson({
      success: true,
      id: providerId,
      invoice_id: invoice.id,
      to: deliveryChannel === 'sms' ? smsResult?.to ?? null : toEmail,
      delivery_channel: deliveryChannel,
      requested_delivery_channel: requestedDeliveryChannel,
      delivery_resolution_reason: deliveryResolution.resolutionReason,
      stripe_invoice_url: stripeHostedInvoiceUrl,
      stripe_invoice_pdf_url: stripeInvoicePdfUrl,
      stripe_invoice_id: stripeInvoiceId,
      stripe_customer_id: stripeCustomerId,
      stripe_error: stripeError,
      fallback_pay_url: payLink,
      attachments_count: attachments.length,
      sms: deliveryChannel === 'sms'
        ? {
            to: smsResult?.to ?? null,
            sid: smsResult?.sid ?? null,
            status: smsResult?.status ?? null,
            body: smsResult?.body ?? null,
          }
        : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal error';
    console.error('send-invoice failed:', error);
    return respondJson({ error: message }, 500);
  }
});
