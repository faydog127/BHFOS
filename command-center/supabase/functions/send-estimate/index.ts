import { corsHeaders } from './cors.ts';
import { getTenantIdFromClaims, getVerifiedClaims } from '../_shared/auth.ts';
import { getClientInfo } from '../_shared/publicUtils.ts';
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { enqueueQuoteReminderTask, hasRecentEvent } from '../_shared/moneyLoopUtils.ts';
import { sendDocumentSms } from '../_shared/sms.ts';
import {
  BUSINESS_WEBSITE,
  BUSINESS_EMAIL,
  BUSINESS_PHONE_DISPLAY,
  BUSINESS_ADDRESS_LINE1,
  BUSINESS_ADDRESS_LINE2,
  BUSINESS_PHONE_TEL,
  LOGO_URL,
  BADGE_NADCA_URL,
  BADGE_CLEAN_AIR_URL,
  BADGE_SDVOSB_URL,
  escapeHtml,
  renderEmailLayout,
  sendEmail,
} from '../_shared/email.ts';
import { renderHtmlToPdfBytes, pdfAttachmentFromBytes } from '../_shared/htmlToPdf.ts';
import { TVG_DOC_BLOCKS, TVG_DOC_BLOCKS_HTML } from '../_shared/documentBlocks.ts';
import {
  loadLeadDeliveryProfile,
  normalizeRequestedDeliveryChannel,
  persistDocumentDeliveryPreference,
  resolveDocumentDelivery,
} from '../_shared/documentDelivery.ts';

type JsonObject = Record<string, unknown>;

type QuoteRow = {
  id: string;
  tenant_id: string | null;
  lead_id: string | null;
  estimate_id: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  quote_number: string | number | null;
  status: string | null;
  subtotal: number | string | null;
  tax_amount: number | string | null;
  total_amount: number | string | null;
  valid_until: string | null;
  created_at: string | null;
  public_token: string | null;
  line_items: unknown;
  service_address: string | null;
};

type LeadRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone?: string | null;
  address?: unknown;
  contact_id?: string | null;
  preferred_document_delivery?: string | null;
  sms_consent?: boolean | null;
  sms_opt_out?: boolean | null;
};

type QuoteItemRow = {
  description: string | null;
  quantity: number | string | null;
  unit_price: number | string | null;
  total_price: number | string | null;
};

type EstimateRow = {
  id: string;
  estimate_number: string | null;
  services: unknown;
  scope_of_work: unknown;
  property_details: unknown;
  total_price: number | string | null;
};

type CostSnapshot = {
  estimated_labor: number;
  estimated_material: number;
  estimated_equipment: number;
  total_estimated_cost: number;
  source: string;
  path: string;
};

type TierOption = {
  key: string;
  label: string;
  includes: string[];
  bestFor: string;
  price: number | null;
  optionId: string;
};

type PdfFontKey = 'F1' | 'F2';

type PdfTextLine = {
  text: string;
  x: number;
  y: number;
  size: number;
  font: PdfFontKey;
};

const POLICY_VERSION = 1;
const MIN_MARGIN_PERCENT = 20;
const MIN_OVERRIDE_REASON_LENGTH = 6;
const ADMIN_ROLES = new Set(['admin', 'super_admin']);
const ENFORCE_ESTIMATE_GUARDRAILS = false;

const respondJson = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const parseJson = async (req: Request): Promise<JsonObject> => {
  try {
    const parsed = await req.json();
    return parsed && typeof parsed === 'object' ? (parsed as JsonObject) : {};
  } catch {
    return {};
  }
};

const asString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const asNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const isMissingColumnError = (error: { code?: string; message?: string } | null | undefined) => {
  if (!error) return false;
  if (error.code === 'PGRST204' || error.code === '42703') return true;
  const msg = String(error.message || '').toLowerCase();
  return msg.includes('column') && (msg.includes('does not exist') || msg.includes('could not find'));
};

const extractAddressObject = (value: unknown): Record<string, unknown> | null => {
  if (!value) return null;
  if (Array.isArray(value)) return (value[0] as Record<string, unknown>) ?? null;
  if (typeof value === 'object') return value as Record<string, unknown>;
  return null;
};

const buildServiceAddress = (value: unknown): string => {
  const address = extractAddressObject(value);
  if (!address) return '';
  const parts = [
    asString(address.address1),
    asString(address.address2),
    asString(address.city),
    asString(address.state),
    asString(address.zip),
  ].filter(Boolean);
  return parts.join(', ');
};

const normalizeEmailList = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return Array.from(
      new Set(
        value
          .map((item) => asString(item))
          .flatMap((item) => item.split(/[;,]/g))
          .map((item) => item.trim())
          .filter((item) => item.includes('@')),
      ),
    );
  }

  if (typeof value === 'string' && value.trim() !== '') {
    return Array.from(
      new Set(
        value
          .split(/[;,]/g)
          .map((item) => item.trim())
          .filter((item) => item.includes('@')),
      ),
    );
  }

  return [];
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

const formatDate = (value: string | null | undefined) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return '';
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
};

const dateOnly = (date: Date) => date.toISOString().slice(0, 10);
const generateFallbackQuoteNumber = () =>
  Number(`${new Date().getFullYear()}${Math.floor(1000 + Math.random() * 9000)}`);

const safeUrl = (base: string, path: string) => `${base.replace(/\/$/, '')}${path}`;

const normalizeBaseUrl = (value: string | null | undefined) => asString(value).replace(/\/$/, '');

const getSupabaseFunctionBase = (requestOrigin?: string) => {
  const envBase = normalizeBaseUrl(Deno.env.get('SUPABASE_URL'));
  if (envBase) return envBase;
  const originBase = normalizeBaseUrl(requestOrigin);
  return originBase;
};

const getPublicQuoteBase = () => {
  const configured =
    normalizeBaseUrl(Deno.env.get('PUBLIC_APP_URL')) ||
    normalizeBaseUrl(Deno.env.get('PUBLIC_QUOTE_BASE_URL')) ||
    'https://app.bhfos.com';
  return configured;
};

const buildPublicQuoteUrl = (params: {
  token: string | null;
  tenantId: string | null;
  extra?: Record<string, string>;
}, requestOrigin?: string) => {
  const publicBase = getPublicQuoteBase();
  if (params.token) {
    const appUrl = new URL(`${publicBase}/quotes/${params.token}`);
    if (params.tenantId) appUrl.searchParams.set('tenant_id', params.tenantId);
    for (const [key, value] of Object.entries(params.extra ?? {})) {
      if (value && key !== 'view') appUrl.searchParams.set(key, value);
    }
    return appUrl.toString();
  }

  const base = getSupabaseFunctionBase(requestOrigin);
  if (!base) {
    return safeUrl(BUSINESS_WEBSITE, '/');
  }

  const url = new URL(`${base}/functions/v1/public-quote`);
  if (params.token) url.searchParams.set('token', params.token);
  if (params.tenantId) url.searchParams.set('tenant_id', params.tenantId);
  url.searchParams.set('view', 'html');

  for (const [key, value] of Object.entries(params.extra ?? {})) {
    if (value) url.searchParams.set(key, value);
  }

  return url.toString();
};

const buildPublicQuoteApproveUrl = (params: {
  token: string | null;
  tenantId: string | null;
  quoteId?: string | null;
  action?: 'approved' | 'declined';
  extra?: Record<string, string>;
}, requestOrigin?: string) => {
  const base = getSupabaseFunctionBase(requestOrigin);
  if (!base || !params.token) {
    return buildPublicQuoteUrl(
      {
        token: params.token,
        tenantId: params.tenantId,
        extra: {
          ...(params.extra ?? {}),
          quote_id: params.quoteId ?? '',
        },
      },
      requestOrigin,
    );
  }
  const url = new URL(`${base}/functions/v1/public-quote-approve`);
  url.searchParams.set('token', params.token);
  if (params.quoteId) url.searchParams.set('quote_id', params.quoteId);
  if (params.tenantId) url.searchParams.set('tenant_id', params.tenantId);
  url.searchParams.set('action', params.action ?? 'approved');
  for (const [key, value] of Object.entries(params.extra ?? {})) {
    if (value) url.searchParams.set(key, value);
  }
  return url.toString();
};

const pickFirstNumber = (source: JsonObject, keys: string[]): number | null => {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const value = asNumber(source[key]);
      if (value !== null) return value;
    }
  }
  return null;
};

const extractSnapshotFromRoot = (root: unknown, source: string): CostSnapshot | null => {
  if (!root) return null;

  const queue: Array<{ node: unknown; path: string }> = [{ node: root, path: '$' }];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;

    const { node, path } = current;

    if (Array.isArray(node)) {
      node.forEach((entry, idx) => {
        if (entry && typeof entry === 'object') {
          queue.push({ node: entry, path: `${path}[${idx}]` });
        }
      });
      continue;
    }

    if (!node || typeof node !== 'object') continue;

    const objectNode = node as JsonObject;

    const labor = pickFirstNumber(objectNode, ['estimated_labor', 'labor_cost']);
    const material = pickFirstNumber(objectNode, ['estimated_material', 'material_cost']);
    const equipment = pickFirstNumber(objectNode, ['estimated_equipment', 'equipment_cost']);

    const hasAllCostComponents = labor !== null && material !== null && equipment !== null;
    if (hasAllCostComponents) {
      const total =
        pickFirstNumber(objectNode, ['total_estimated_cost', 'estimated_total_cost', 'snapshot_total_cost']) ??
        labor + material + equipment;

      return {
        estimated_labor: labor,
        estimated_material: material,
        estimated_equipment: equipment,
        total_estimated_cost: total,
        source,
        path,
      };
    }

    const priorityNested = ['cost_snapshot', 'pricing_snapshot', 'cost_model_snapshot'];
    for (const key of priorityNested) {
      const nested = objectNode[key];
      if (nested && typeof nested === 'object') {
        queue.unshift({ node: nested, path: `${path}.${key}` });
      }
    }

    for (const [key, value] of Object.entries(objectNode)) {
      if (!value || typeof value !== 'object') continue;
      if (priorityNested.includes(key)) continue;
      queue.push({ node: value, path: `${path}.${key}` });
    }
  }

  return null;
};

const extractTierOptions = (estimate: EstimateRow | null): TierOption[] => {
  if (!estimate) return [];

  const candidates: unknown[] = [estimate.services, estimate.scope_of_work];

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object') continue;

    const container = candidate as JsonObject;

    const objectTiers = (container.tiers ?? container.options ?? null) as unknown;
    if (objectTiers && typeof objectTiers === 'object' && !Array.isArray(objectTiers)) {
      const entries = Object.entries(objectTiers as JsonObject)
        .filter(([key, value]) => value && typeof value === 'object' && ['good', 'better', 'best'].includes(key.toLowerCase()))
        .map(([key, value]) => {
          const tierObj = value as JsonObject;
          const includes = Array.isArray(tierObj.includes)
            ? tierObj.includes.map((item) => asString(item)).filter(Boolean)
            : [];
          return {
            key: key.toLowerCase(),
            label: asString(tierObj.label) || asString(tierObj.title) || key,
            includes,
            bestFor: asString(tierObj.best_for) || asString(tierObj.bestFor),
            price: asNumber(tierObj.price),
            optionId: asString(tierObj.option_id) || asString(tierObj.id) || key.toLowerCase(),
          } as TierOption;
        });

      if (entries.length) return entries;
    }

    const arrayTiers = (container.tiers ?? container.options ?? null) as unknown;
    if (Array.isArray(arrayTiers)) {
      const parsed = arrayTiers
        .filter((entry) => entry && typeof entry === 'object')
        .map((entry) => entry as JsonObject)
        .filter((entry) => {
          const key = asString(entry.key || entry.tier || entry.id).toLowerCase();
          return ['good', 'better', 'best'].includes(key);
        })
        .map((entry) => {
          const key = asString(entry.key || entry.tier || entry.id).toLowerCase();
          const includes = Array.isArray(entry.includes)
            ? entry.includes.map((item) => asString(item)).filter(Boolean)
            : [];
          return {
            key,
            label: asString(entry.label) || asString(entry.title) || key,
            includes,
            bestFor: asString(entry.best_for) || asString(entry.bestFor),
            price: asNumber(entry.price),
            optionId: asString(entry.option_id) || asString(entry.id) || key,
          } as TierOption;
        });

      if (parsed.length) return parsed;
    }
  }

  return [];
};

const sha256Hex = async (text: string): Promise<string> => {
  const encoded = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

const normalizeLineItems = (quoteItems: QuoteItemRow[], lineItemsFallback: unknown): QuoteItemRow[] => {
  if (quoteItems.length > 0) {
    return quoteItems;
  }

  if (!Array.isArray(lineItemsFallback)) return [];

  return lineItemsFallback
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry) => entry as JsonObject)
    .map((entry) => ({
      description: asString(entry.description) || null,
      quantity: asNumber(entry.quantity),
      unit_price: asNumber(entry.unit_price),
      total_price: asNumber(entry.total_price),
    }));
};

const buildLineItemsTable = (lineItems: QuoteItemRow[]) => {
  const rows = lineItems
    .map((item) => {
      const quantity = asNumber(item.quantity) ?? 0;
      const unitPrice = asNumber(item.unit_price) ?? 0;
      const lineTotal = asNumber(item.total_price) ?? quantity * unitPrice;

      return `
        <tr>
          <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;">${escapeHtml(item.description || 'Service')}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:center;">${quantity}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:right;">${formatCurrency(unitPrice)}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:right;">${formatCurrency(lineTotal)}</td>
        </tr>
      `;
    })
    .join('');

  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:8px;">
      <thead>
        <tr style="background:#f8fafc;">
          <th style="padding:10px;text-align:left;border-bottom:1px solid #d1d5db;">Description</th>
          <th style="padding:10px;text-align:center;border-bottom:1px solid #d1d5db;">Qty</th>
          <th style="padding:10px;text-align:right;border-bottom:1px solid #d1d5db;">Unit</th>
          <th style="padding:10px;text-align:right;border-bottom:1px solid #d1d5db;">Line Total</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
};

const sanitizeFilenamePart = (value: string) =>
  value
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'estimate';

const normalizePdfText = (value: string) =>
  value
    .normalize('NFKD')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const escapePdfText = (value: string) =>
  normalizePdfText(value)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');

const wrapTextByChars = (value: string, maxChars: number): string[] => {
  const normalized = normalizePdfText(value);
  if (!normalized) return [''];

  const lines: string[] = [];
  let current = '';
  const words = normalized.split(' ');

  const splitLongWord = (word: string) => {
    const chunks: string[] = [];
    let remaining = word;
    while (remaining.length > maxChars) {
      chunks.push(`${remaining.slice(0, Math.max(1, maxChars - 1))}-`);
      remaining = remaining.slice(Math.max(1, maxChars - 1));
    }
    if (remaining) chunks.push(remaining);
    return chunks;
  };

  for (const rawWord of words) {
    const pieces = rawWord.length > maxChars ? splitLongWord(rawWord) : [rawWord];
    for (const word of pieces) {
      const candidate = current ? `${current} ${word}` : word;
      if (candidate.length <= maxChars) {
        current = candidate;
      } else {
        if (current) lines.push(current);
        current = word;
      }
    }
  }

  if (current) lines.push(current);
  return lines;
};

const buildPdfDocument = (pages: PdfTextLine[][]): Uint8Array => {
  const encoder = new TextEncoder();
  const objects: string[] = [];
  const pageObjectIds: number[] = [];
  let nextObjectId = 5;

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

const base64EncodeBytes = (bytes: Uint8Array): string => {
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
};

export const buildEstimatePdfAttachment = (params: {
  firstName: string;
  quoteNumberText: string;
  quoteDateText: string;
  validThroughText: string;
  serviceAddress: string;
  lineItems: QuoteItemRow[];
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  quotePublicUrl: string;
  tierOptions: TierOption[];
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
        ? `Service Quote #${params.quoteNumberText} (continued)`
        : `Service Quote #${params.quoteNumberText}`,
      x: 50,
      y: cursorY,
      size: 18,
      font: 'F2',
    });
    cursorY -= 24;

    currentPage.push({
      text: 'The Vent Guys',
      x: 50,
      y: cursorY,
      size: 11,
      font: 'F2',
    });
    cursorY -= 20;

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
    cursorY -= 18;
  };

  const ensureSpace = (heightNeeded: number) => {
    if (cursorY - heightNeeded < 60) {
      startPage(true);
    }
  };

  const addWrappedText = (text: string, opts?: {
    x?: number;
    size?: number;
    font?: PdfFontKey;
    maxChars?: number;
    gapAfter?: number;
  }) => {
    const x = opts?.x ?? 50;
    const size = opts?.size ?? 12;
    const font = opts?.font ?? 'F1';
    const maxChars = opts?.maxChars ?? 78;
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
  addWrappedText(`Prepared for ${params.firstName || 'Customer'}`, { size: 12, font: 'F1', maxChars: 70 });
  addWrappedText(
    `Quote Date: ${params.quoteDateText}${params.validThroughText ? ` | Valid Through: ${params.validThroughText}` : ''}`,
    { size: 11, font: 'F1', maxChars: 90, gapAfter: 2 },
  );
  addWrappedText(`Service Address: ${params.serviceAddress || 'Not provided'}`, {
    size: 11,
    font: 'F1',
    maxChars: 90,
    gapAfter: 10,
  });

  addWrappedText('Scope Summary', { size: 14, font: 'F2', gapAfter: 2 });
  addWrappedText(
    'This quote includes the services listed below and is structured to improve airflow efficiency, reduce dust circulation, and support healthier indoor air.',
    { size: 11, font: 'F1', maxChars: 92, gapAfter: 10 },
  );

  addWrappedText('Line Items', { size: 14, font: 'F2', gapAfter: 4 });
  ensureSpace(20);
  currentPage.push({ text: 'Description', x: 50, y: cursorY, size: 11, font: 'F2' });
  currentPage.push({ text: 'Qty', x: 375, y: cursorY, size: 11, font: 'F2' });
  currentPage.push({ text: 'Unit', x: 430, y: cursorY, size: 11, font: 'F2' });
  currentPage.push({ text: 'Total', x: 505, y: cursorY, size: 11, font: 'F2' });
  cursorY -= 18;

  for (const item of params.lineItems) {
    const quantity = asNumber(item.quantity) ?? 0;
    const unitPrice = asNumber(item.unit_price) ?? 0;
    const lineTotal = asNumber(item.total_price) ?? quantity * unitPrice;
    const descriptionLines = wrapTextByChars(item.description || 'Service', 46);
    const rowHeight = descriptionLines.length * 14 + 4;

    ensureSpace(rowHeight + 8);
    descriptionLines.forEach((line, index) => {
      currentPage.push({
        text: line,
        x: index === 0 ? 50 : 62,
        y: cursorY,
        size: 10,
        font: 'F1',
      });
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
    addWrappedText(`Tax: ${formatCurrency(params.taxAmount)}`, { size: 11, font: 'F1', x: 360, maxChars: 30, gapAfter: 0 });
  }
  addWrappedText(`Total Investment: ${formatCurrency(params.totalAmount)}`, {
    size: 12,
    font: 'F2',
    x: 360,
    maxChars: 30,
    gapAfter: 12,
  });

  if (params.tierOptions.length > 0) {
    addWrappedText('Service Options', { size: 14, font: 'F2', gapAfter: 4 });
    params.tierOptions.forEach((tier) => {
      const tierPrice = tier.price ?? params.totalAmount;
      addWrappedText(`${tier.label} - ${formatCurrency(tierPrice)}`, {
        size: 11,
        font: 'F2',
        maxChars: 86,
        gapAfter: 1,
      });
      if (tier.bestFor) {
        addWrappedText(`Best for: ${tier.bestFor}`, { size: 10, font: 'F1', x: 62, maxChars: 84, gapAfter: 1 });
      }
      if (tier.includes.length > 0) {
        addWrappedText(`Includes: ${tier.includes.slice(0, 5).join(', ')}`, {
          size: 10,
          font: 'F1',
          x: 62,
          maxChars: 84,
          gapAfter: 4,
        });
      }
    });
  }

  addWrappedText('Review Online', { size: 14, font: 'F2', gapAfter: 3 });
  addWrappedText('Approve or decline this quote using the secure link below:', {
    size: 11,
    font: 'F1',
    maxChars: 92,
    gapAfter: 2,
  });
  addWrappedText(params.quotePublicUrl, { size: 10, font: 'F1', maxChars: 88, gapAfter: 8 });

  addWrappedText('Questions? Reply to the quote email or call The Vent Guys for help with scope, scheduling, or pricing.', {
    size: 10,
    font: 'F1',
    maxChars: 92,
    gapAfter: 0,
  });

  const pdfBytes = buildPdfDocument(pages);
  const filename = `${sanitizeFilenamePart(`quote-${params.quoteNumberText || 'pending'}`)}.pdf`;

  return {
    filename,
    content: base64EncodeBytes(pdfBytes),
    content_type: 'application/pdf',
  };
};

const buildEstimateHtmlDocument = (params: {
  quoteNumberText: string;
  quoteDateText: string;
  validThroughText: string;
  recipientName: string;
  serviceAddress: string;
  lineItems: QuoteItemRow[];
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  quotePublicUrl: string;
  tierOptions: TierOption[];
}) => {
  const rows = (params.lineItems || []).map((item) => {
    const desc = escapeHtml(item.description || '');
    const qty = escapeHtml(String(item.quantity ?? ''));
    const unit = escapeHtml(formatCurrency(asNumber(item.unit_price) ?? 0));
    const total = escapeHtml(formatCurrency(asNumber(item.total_price) ?? 0));
    return `
      <tr>
        <td class="desc">${desc}</td>
        <td class="num">${qty}</td>
        <td class="money">${unit}</td>
        <td class="money">${total}</td>
      </tr>
    `;
  }).join('');

  const tierCards = (params.tierOptions || [])
    .filter((t) => t && t.label)
    .map((tier) => {
      const priceText = tier.price != null ? escapeHtml(formatCurrency(Number(tier.price))) : 'Call for pricing';
      const includes = (tier.includes || []).slice(0, 8).map((x) => `<li>${escapeHtml(x)}</li>`).join('');
      return `
        <div class="tier">
          <div class="tierTop">
            <div class="tierLabel">${escapeHtml(tier.label)}</div>
            <div class="tierPrice">${priceText}</div>
          </div>
          <div class="tierBody">
            ${tier.bestFor ? `<div class="tierBestFor"><strong>Best for:</strong> ${escapeHtml(tier.bestFor)}</div>` : ''}
            ${includes ? `<ul class="tierList">${includes}</ul>` : ''}
          </div>
        </div>
      `;
    })
    .join('');

  const badges = [BADGE_NADCA_URL, BADGE_SDVOSB_URL, BADGE_CLEAN_AIR_URL].filter(Boolean);
  const badgeHtml = badges.length
    ? `<div class="badges">${badges.map((src) => `<img src="${src}" alt="badge" />`).join('')}</div>`
    : '';

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
      <title>Service Quote #${escapeHtml(params.quoteNumberText)}</title>
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
        .content { padding: 18px 20px 16px 20px; }
        .title { font-size: 22px; font-weight: 800; margin: 0 0 6px 0; }
        .meta { font-size: 12px; color:#475569; margin-bottom: 14px; }
        .meta strong { color:#0f172a; }
        .addr { margin-top: 6px; color:#334155; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; }
        th { text-align:left; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color:#64748b; padding: 10px 10px; border-bottom: 1px solid #e2e8f0; }
        td { padding: 10px 10px; border-bottom: 1px solid #f1f5f9; font-size: 13px; vertical-align: top; }
        td.num { text-align: center; width: 56px; }
        td.money { text-align: right; width: 110px; white-space: nowrap; }
        .tiers { margin-top: 14px; }
        .tiersTitle { font-size: 14px; font-weight: 800; margin: 0 0 8px 0; }
        .tier { border: 1px solid #e2e8f0; border-radius: 16px; padding: 12px 12px; margin-bottom: 10px; background:#f8fafc; }
        .tierTop { display:flex; justify-content:space-between; align-items:baseline; gap: 10px; }
        .tierLabel { font-weight: 900; letter-spacing: 0.12em; text-transform: uppercase; font-size: 11px; color:#0f172a; }
        .tierPrice { font-size: 16px; font-weight: 900; }
        .tierBody { margin-top: 8px; font-size: 12px; color:#334155; }
        .tierList { margin: 8px 0 0 18px; padding: 0; }
        .totals { margin-top: 14px; display:flex; justify-content:flex-end; }
        .totalsBox { width: 280px; border: 1px solid #e2e8f0; border-radius: 16px; padding: 12px 14px; background: #f8fafc; }
        .totRow { display:flex; justify-content:space-between; font-size: 13px; color:#334155; margin: 6px 0; }
        .totFinal { display:flex; justify-content:space-between; margin-top: 10px; padding-top: 10px; border-top: 1px solid #e2e8f0; font-size: 16px; font-weight: 900; }
        .cta { margin-top: 14px; padding: 14px; border-radius: 16px; background: #0b1f3a; color: #fff; }
        .cta a { color: #fff; text-decoration: none; font-weight: 900; }
        .footer { padding: 14px 20px 18px 20px; background:#fafafa; border-top: 1px solid #e2e8f0; }
        .footRow { display:flex; justify-content:space-between; gap: 16px; align-items:flex-end; }
        .footLeft { font-size: 12px; color:#475569; line-height: 1.45; }
        .footLeft .name { font-weight: 900; text-transform: uppercase; letter-spacing: 0.12em; color:#0f172a; font-size: 11px; }
        .badges img { height: 34px; width: auto; margin-left: 10px; opacity: 0.92; }
        .blocks { margin-top: 14px; display: grid; grid-template-columns: 1fr; gap: 10px; }
        .block { border: 1px solid #e2e8f0; border-radius: 14px; padding: 10px 12px; background: #ffffff; }
        .blockTitle { font-size: 11px; font-weight: 900; letter-spacing: 0.12em; text-transform: uppercase; color:#0f172a; margin-bottom: 6px; }
        .blockBody { font-size: 12px; line-height: 1.45; color:#334155; }
        .bullets { margin: 0; padding-left: 18px; font-size: 12px; line-height: 1.45; color:#334155; }
        .bullets li { margin: 3px 0; }
        .signature { margin-top: 10px; font-size: 12px; font-weight: 900; color:#0f172a; }
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
          <div class="title">Service Quote #${escapeHtml(params.quoteNumberText)}</div>
          <div class="meta">
            <div><strong>Prepared for:</strong> ${escapeHtml(params.recipientName)}</div>
            ${params.quoteDateText ? `<div><strong>Quote date:</strong> ${escapeHtml(params.quoteDateText)}</div>` : ''}
            ${params.validThroughText ? `<div><strong>Valid through:</strong> ${escapeHtml(params.validThroughText)}</div>` : ''}
            ${params.serviceAddress ? `<div class="addr"><strong>Service address:</strong> ${escapeHtml(params.serviceAddress)}</div>` : ''}
          </div>

          ${tierCards ? `<div class="tiers"><div class="tiersTitle">Good / Better / Best Options</div>${tierCards}</div>` : ''}

          <div class="blocks">
            ${positioning}
            ${trust}
            ${referral}
            ${signature}
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
              <div class="totRow"><span>Tax</span><strong>${escapeHtml(formatCurrency(params.taxAmount))}</strong></div>
              <div class="totFinal"><span>Total</span><span>${escapeHtml(formatCurrency(params.totalAmount))}</span></div>
            </div>
          </div>

          <div class="cta">
            Review and approve online: <a href="${escapeHtml(params.quotePublicUrl)}">${escapeHtml(params.quotePublicUrl)}</a>
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

const logEvent = async (params: {
  tenantId: string | null;
  entityType: string;
  entityId: string;
  eventType: string;
  actorType: string;
  actorId?: string | null;
  payload?: JsonObject;
}) => {
  const { error } = await supabaseAdmin.from('events').insert({
    tenant_id: params.tenantId,
    entity_type: params.entityType,
    entity_id: params.entityId,
    event_type: params.eventType,
    actor_type: params.actorType,
    actor_id: params.actorId ?? null,
    payload: params.payload ?? {},
    created_at: new Date().toISOString(),
  });

  if (error) {
    console.error('events insert failed:', error.message);
  }
};

const handleTierSelectionRedirect = async (req: Request) => {
  const url = new URL(req.url);
  const token = asString(url.searchParams.get('token'));
  const quoteId = asString(url.searchParams.get('quote_id'));
  const tier = asString(url.searchParams.get('tier')).toLowerCase();
  const optionId = asString(url.searchParams.get('option_id'));
  const pricingHash = asString(url.searchParams.get('pricing_hash'));
  const subtotalCents = asNumber(url.searchParams.get('subtotal_cents'));
  const taxCents = asNumber(url.searchParams.get('tax_cents'));
  const totalCents = asNumber(url.searchParams.get('total_cents'));

  if (!tier || (!token && !quoteId)) {
    return respondJson({ error: 'Missing tier selection parameters.' }, 400);
  }

  let query = supabaseAdmin
    .from('quotes')
    .select('id,tenant_id,estimate_id,public_token')
    .limit(1);

  if (quoteId) query = query.eq('id', quoteId);
  if (token) query = query.eq('public_token', token);

  const { data: quote, error } = await query.maybeSingle();
  if (error || !quote?.id || !quote?.public_token) {
    return respondJson({ error: 'Quote not found.' }, 404);
  }

  const client = getClientInfo(req);

  await logEvent({
    tenantId: quote.tenant_id,
    entityType: 'quote',
    entityId: quote.id,
    eventType: 'quote.tier_selected',
    actorType: 'external_customer',
    payload: {
      quote_id: quote.id,
      estimate_id: quote.estimate_id,
      selected_tier: tier,
      selected_option_id: optionId || null,
      pricing_hash: pricingHash || null,
      totals_shown: {
        subtotal_cents: subtotalCents,
        tax_cents: taxCents,
        total_cents: totalCents,
      },
      source: 'estimate_link',
      policy_version: POLICY_VERSION,
      ip: client.ip,
      user_agent: client.userAgent,
    },
  });

  const redirectUrl = new URL(
    buildPublicQuoteApproveUrl({
      token: quote.public_token,
      tenantId: quote.tenant_id,
      quoteId: quote.id,
      action: 'approved',
      extra: {
        tier,
        option_id: optionId,
        pricing_hash: pricingHash,
      },
    }),
  );

  return Response.redirect(redirectUrl.toString(), 302);
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const url = new URL(req.url);
  if (req.method === 'GET' && url.searchParams.get('action') === 'tier-select') {
    return await handleTierSelectionRedirect(req);
  }

  if (req.method !== 'POST') {
    return respondJson({ error: 'Method not allowed.' }, 405);
  }

  try {
    const body = await parseJson(req);
    const requestOrigin = new URL(req.url).origin;
    const quoteId = asString(body.quote_id);
    const bodyTenantId = asString(body.tenant_id);
    const dryRun = body.dry_run === true;
    const overrideAcknowledged = body.override_acknowledged === true;
    const overrideReason = asString(body.override_reason);

    if (!quoteId) {
      return respondJson({ error: 'Missing quote_id.' }, 400);
    }

    let claims: Record<string, unknown> | null = null;
    let verifiedClaims = false;
    try {
      const verified = await getVerifiedClaims(req);
      claims = verified.claims as Record<string, unknown>;
      verifiedClaims = true;
    } catch (err) {
      console.warn('send-estimate proceeding without verified JWT:', err instanceof Error ? err.message : String(err));
    }

    const jwtTenantId = claims ? getTenantIdFromClaims(claims) : null;
    const effectiveTenantId = jwtTenantId || bodyTenantId;

    if (!effectiveTenantId) {
      return respondJson({ error: 'Missing tenant_id.' }, 400);
    }

    if (jwtTenantId && bodyTenantId && bodyTenantId !== jwtTenantId) {
      return respondJson({ error: 'Tenant mismatch.' }, 403);
    }

    const actorId = claims ? asString(claims.sub) || null : null;

    let quoteResult = await supabaseAdmin
      .from('quotes')
      .select('id,tenant_id,lead_id,estimate_id,customer_name,customer_email,customer_phone,quote_number,status,subtotal,tax_amount,total_amount,valid_until,created_at,public_token,line_items,service_address')
      .eq('id', quoteId)
      .eq('tenant_id', effectiveTenantId)
      .maybeSingle<QuoteRow>();

    if (quoteResult.error && isMissingColumnError(quoteResult.error)) {
      const fallbackResult = await supabaseAdmin
        .from('quotes')
        .select('id,tenant_id,lead_id,estimate_id,customer_email,quote_number,status,subtotal,tax_amount,total_amount,valid_until,created_at,public_token,line_items')
        .eq('id', quoteId)
        .eq('tenant_id', effectiveTenantId)
        .maybeSingle<QuoteRow>();
      quoteResult = {
        data: fallbackResult.data
          ? {
              ...fallbackResult.data,
              customer_name: null,
              customer_phone: null,
              service_address: null,
            }
          : null,
        error: fallbackResult.error,
        count: fallbackResult.count,
        status: fallbackResult.status,
        statusText: fallbackResult.statusText,
      };
    }

    const { data: quote, error: quoteError } = quoteResult;

    if (quoteError || !quote) {
      return respondJson({ error: 'Quote not found.' }, 404);
    }

    let publicToken = asString(quote.public_token);
    if (!publicToken) {
      publicToken = crypto.randomUUID();
      await supabaseAdmin
        .from('quotes')
        .update({ public_token: publicToken, updated_at: new Date().toISOString() })
        .eq('id', quote.id);
    }

    if (!quote.quote_number) {
      const fallbackQuoteNumber = generateFallbackQuoteNumber();
      const { error: quoteNumberError } = await supabaseAdmin
        .from('quotes')
        .update({ quote_number: fallbackQuoteNumber, updated_at: new Date().toISOString() })
        .eq('id', quote.id)
        .eq('tenant_id', effectiveTenantId);

      if (quoteNumberError) {
        console.warn('send-estimate could not backfill quote_number:', quoteNumberError.message);
      } else {
        quote.quote_number = fallbackQuoteNumber;
      }
    }

    const { data: lead } = await supabaseAdmin
      .from('leads')
      .select('*,address:property_id(address1,address2,city,state,zip)')
      .eq('id', quote.lead_id)
      .maybeSingle<LeadRow>();

    const { data: quoteItemsData } = await supabaseAdmin
      .from('quote_items')
      .select('description,quantity,unit_price,total_price')
      .eq('quote_id', quote.id)
      .order('id', { ascending: true });

    const lineItems = normalizeLineItems(quoteItemsData ?? [], quote.line_items);

    let estimate: EstimateRow | null = null;
    if (quote.estimate_id) {
      const { data: estimateData } = await supabaseAdmin
        .from('estimates')
        .select('id,estimate_number,services,scope_of_work,property_details,total_price')
        .eq('id', quote.estimate_id)
        .maybeSingle<EstimateRow>();
      estimate = estimateData ?? null;
    }

    const totalAmount = asNumber(quote.total_amount) ?? 0;
    const subtotal = asNumber(quote.subtotal) ?? lineItems.reduce((sum, item) => {
      const quantity = asNumber(item.quantity) ?? 0;
      const unitPrice = asNumber(item.unit_price) ?? 0;
      const lineTotal = asNumber(item.total_price) ?? quantity * unitPrice;
      return sum + lineTotal;
    }, 0);
    const taxAmount = asNumber(quote.tax_amount) ?? Math.max(totalAmount - subtotal, 0);
    const serviceAddress = asString(quote.service_address) || buildServiceAddress(lead?.address);
    const requestedDeliveryChannel = normalizeRequestedDeliveryChannel(
      body.delivery_channel ?? body.send_via ?? body.channel,
    );
    const deliveryProfile = await loadLeadDeliveryProfile({
      tenantId: quote.tenant_id ?? effectiveTenantId,
      leadId: quote.lead_id,
    });
    const deliveryResolution = resolveDocumentDelivery({
      requestedChannel: requestedDeliveryChannel,
      email:
        asString(body.to_email) ||
        asString(body.email) ||
        asString(quote.customer_email) ||
        asString(lead?.email) ||
        deliveryProfile?.email ||
        null,
      phone:
        asString(body.to_phone) ||
        asString(body.phone) ||
        asString(quote.customer_phone) ||
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
    const deliveryChannel = deliveryResolution.deliveryChannel;
    const recipientEmail = deliveryResolution.recipientEmail ?? '';
    const recipientPhone = deliveryResolution.recipientPhone ?? '';
    const customSubject = asString(body.custom_subject) || asString(body.subject);
    const customBodyHtml = asString(body.custom_body_html) || asString(body.body_html);
    const customTitle = asString(body.custom_title);
    const customPreheader = asString(body.custom_preheader);
    const ccRecipients = normalizeEmailList(body.cc);
    const bccRecipients = normalizeEmailList(body.bcc);
    const attachPdf = deliveryChannel === 'email' && body.attach_pdf !== false;

    const requiredFieldErrors: string[] = [];
    if (!quote.quote_number) requiredFieldErrors.push('quote_number');
    if (!deliveryChannel) {
      requiredFieldErrors.push(...deliveryResolution.missingFields);
    } else if (deliveryChannel === 'sms') {
      if (!recipientPhone) requiredFieldErrors.push('lead_phone');
    } else if (!recipientEmail) {
      requiredFieldErrors.push('lead_email');
    }
    if (!serviceAddress) requiredFieldErrors.push('service_address');
    if (lineItems.length === 0) requiredFieldErrors.push('line_items');
    if (totalAmount <= 0) requiredFieldErrors.push('total_amount');

    if (requiredFieldErrors.length > 0) {
      await logEvent({
        tenantId: quote.tenant_id,
        entityType: 'quote',
        entityId: quote.id,
        eventType: 'estimate.send_requested',
        actorType: 'user',
        actorId,
        payload: {
          guardrail_result: 'block',
          block_reason: 'missing_required_fields',
          missing_fields: requiredFieldErrors,
          requested_delivery_channel: requestedDeliveryChannel,
          resolved_delivery_channel: deliveryChannel,
          delivery_resolution_reason: deliveryResolution.resolutionReason,
          preferred_contact_method: deliveryResolution.preferredContactMethod,
          preferred_document_delivery: deliveryResolution.preferredDocumentDelivery,
          sms_opt_out: deliveryResolution.smsOptOut,
          policy_version: POLICY_VERSION,
        },
      });

      return respondJson({
        error: `Cannot send estimate: missing required fields (${requiredFieldErrors.join(', ')}).`,
        code: 'MISSING_REQUIRED_FIELDS',
        missing_fields: requiredFieldErrors,
      }, 400);
    }

    const estimateSnapshot = estimate
      ? extractSnapshotFromRoot(
          {
            services: estimate.services,
            scope_of_work: estimate.scope_of_work,
            property_details: estimate.property_details,
          },
          'estimate',
        )
      : null;
    const lineItemsSnapshot = extractSnapshotFromRoot(quote.line_items, 'quote.line_items');
    const snapshot = estimateSnapshot ?? lineItemsSnapshot;
    const hasCostSnapshot = Boolean(snapshot);

    let isAdmin = false;
    if (actorId) {
      const { data: roleRows } = await supabaseAdmin
        .from('app_user_roles')
        .select('role')
        .eq('user_id', actorId);
      isAdmin = (roleRows ?? []).some((row: { role: string | null }) => ADMIN_ROLES.has(asString(row.role).toLowerCase()));
    }

    let guardrailResult: 'pass' | 'override' | 'block' = 'pass';
    let marginPayload: JsonObject = {};
    if (ENFORCE_ESTIMATE_GUARDRAILS) {
      if (!hasCostSnapshot) {
        const missing = ['estimated_labor', 'estimated_material', 'estimated_equipment', 'cost_snapshot'];

        if (!overrideAcknowledged || overrideReason.length < MIN_OVERRIDE_REASON_LENGTH) {
          return respondJson({
            error: 'Cost snapshot missing. Admin override requires acknowledgement and reason.',
            code: 'MISSING_COST_SNAPSHOT_ADMIN_OVERRIDE_REQUIRED',
            requires_override: true,
            override_allowed: true,
            actor_is_admin: isAdmin,
            verified_claims: verifiedClaims,
          }, 400);
        }

        if (verifiedClaims && !isAdmin) {
          guardrailResult = 'block';

          await logEvent({
            tenantId: quote.tenant_id,
            entityType: 'quote',
            entityId: quote.id,
            eventType: 'estimate.send_blocked_missing_cost_snapshot',
            actorType: 'user',
            actorId,
            payload: {
              quote_id: quote.id,
              missing,
              override_allowed: true,
              actor_is_admin: false,
              verified_claims: true,
              block_reason: 'admin_required_for_override',
              policy_version: POLICY_VERSION,
            },
          });

          return respondJson({
            error: 'Admin override required to send without cost snapshot.',
            code: 'ADMIN_OVERRIDE_REQUIRED',
            requires_override: true,
            override_allowed: true,
            actor_is_admin: false,
            verified_claims: true,
          }, 403);
        }

        guardrailResult = 'override';

        await logEvent({
          tenantId: quote.tenant_id,
          entityType: 'quote',
          entityId: quote.id,
          eventType: 'estimate.send_override_missing_cost_snapshot',
          actorType: 'user',
          actorId,
          payload: {
            quote_id: quote.id,
            estimate_id: quote.estimate_id,
            missing,
            override_reason: overrideReason,
            verified_claims: verifiedClaims,
            policy_version: POLICY_VERSION,
          },
        });
      } else {
        const revenue = totalAmount;
        const estimatedCost = snapshot.total_estimated_cost;
        const grossMarginDollars = revenue - estimatedCost;
        const grossMarginPercent = revenue > 0 ? (grossMarginDollars / revenue) * 100 : -100;

        marginPayload = {
          snapshot_source: snapshot.source,
          snapshot_path: snapshot.path,
          estimated_labor_cost: snapshot.estimated_labor,
          estimated_material_cost: snapshot.estimated_material,
          estimated_equipment_cost: snapshot.estimated_equipment,
          estimated_total_cost: snapshot.total_estimated_cost,
          gross_margin_dollars: grossMarginDollars,
          gross_margin_percent: Number(grossMarginPercent.toFixed(2)),
        };

        if (grossMarginPercent < MIN_MARGIN_PERCENT) {
          guardrailResult = 'block';

          await logEvent({
            tenantId: quote.tenant_id,
            entityType: 'quote',
            entityId: quote.id,
            eventType: 'estimate.send_blocked_margin_guardrail',
            actorType: 'user',
            actorId,
            payload: {
              quote_id: quote.id,
              min_margin_percent: MIN_MARGIN_PERCENT,
              ...marginPayload,
              policy_version: POLICY_VERSION,
            },
          });

          await logEvent({
            tenantId: quote.tenant_id,
            entityType: 'quote',
            entityId: quote.id,
            eventType: 'estimate.send_requested',
            actorType: 'user',
            actorId,
            payload: {
              guardrail_result: guardrailResult,
              block_reason: 'margin_guardrail',
              min_margin_percent: MIN_MARGIN_PERCENT,
              ...marginPayload,
              policy_version: POLICY_VERSION,
            },
          });

          return respondJson({
            error: `Cannot send estimate: margin ${Number(grossMarginPercent.toFixed(2))}% is below the ${MIN_MARGIN_PERCENT}% minimum guardrail.`,
            code: 'MARGIN_GUARDRAIL_BLOCKED',
            min_margin_percent: MIN_MARGIN_PERCENT,
            gross_margin_percent: Number(grossMarginPercent.toFixed(2)),
          }, 400);
        }
      }
    }

    await logEvent({
      tenantId: quote.tenant_id,
      entityType: 'quote',
      entityId: quote.id,
      eventType: 'estimate.send_requested',
      actorType: 'user',
      actorId,
      payload: {
        guardrail_result: guardrailResult,
        has_cost_snapshot: hasCostSnapshot,
        requested_delivery_channel: requestedDeliveryChannel,
        resolved_delivery_channel: deliveryChannel,
        delivery_resolution_reason: deliveryResolution.resolutionReason,
        preferred_contact_method: deliveryResolution.preferredContactMethod,
        preferred_document_delivery: deliveryResolution.preferredDocumentDelivery,
        sms_opt_out: deliveryResolution.smsOptOut,
        policy_version: POLICY_VERSION,
      },
    });

    const recipientName =
      asString(quote.customer_name) ||
      [asString(lead?.first_name), asString(lead?.last_name)].filter(Boolean).join(' ') ||
      'Customer';
    const firstName = recipientName.split(/\s+/)[0] || 'Customer';
    const quoteNumberText = String(quote.quote_number ?? '').trim().toUpperCase();
    const quoteDateText = formatDate(quote.created_at);
    const now = new Date();
    const policyValidUntil = dateOnly(new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000));
    const validThroughText = formatDate(policyValidUntil);
    const quotePublicUrl = buildPublicQuoteUrl(
      {
        token: publicToken,
        tenantId: quote.tenant_id,
        extra: {
          quote_id: quote.id,
        },
      },
      requestOrigin,
    );

    const primaryServiceLabel = lineItems
      .map((item) => {
        const quantity = asNumber(item.quantity) ?? 0;
        const unitPrice = asNumber(item.unit_price) ?? 0;
        const total = asNumber(item.total_price) ?? quantity * unitPrice;
        return {
          label: asString(item.description) || 'Service Estimate',
          total,
        };
      })
      .sort((a, b) => b.total - a.total)[0]?.label || 'Service Estimate';

    const tierOptions = quote.estimate_id ? extractTierOptions(estimate) : [];
    const hasTierCards = tierOptions.length > 0;

    let tierCardsHtml = '';
    if (hasTierCards) {
      const trackerBase = safeUrl(getSupabaseFunctionBase(requestOrigin) || requestOrigin, '/functions/v1/send-estimate');
      const cards: string[] = [];

      for (const tier of tierOptions) {
        const hashPayload = JSON.stringify({
          quote_id: quote.id,
          estimate_id: quote.estimate_id,
          tier_key: tier.key,
          option_id: tier.optionId,
          total_amount: tier.price ?? totalAmount,
          generated_at: quote.created_at,
        });
        const pricingHash = await sha256Hex(hashPayload);

        const tierParams = new URLSearchParams({
          action: 'tier-select',
          quote_id: quote.id,
          token: quote.public_token || '',
          tier: tier.key,
          option_id: tier.optionId,
          pricing_hash: pricingHash,
          subtotal_cents: String(Math.round(subtotal * 100)),
          tax_cents: String(Math.round(taxAmount * 100)),
          total_cents: String(Math.round((tier.price ?? totalAmount) * 100)),
        });

        const tierHref = `${trackerBase}?${tierParams.toString()}`;
        const includesHtml = tier.includes.slice(0, 5).map((item) => `<li>${escapeHtml(item)}</li>`).join('');

        cards.push(`
          <div style="border:1px solid #d1d5db;border-radius:10px;padding:14px;margin:12px 0;background:#ffffff;">
            <div style="font-size:16px;font-weight:700;color:#111827;">${escapeHtml(tier.label)}</div>
            ${tier.bestFor ? `<div style="font-size:13px;color:#374151;margin-top:4px;">Best For: ${escapeHtml(tier.bestFor)}</div>` : ''}
            ${includesHtml ? `<ul style="margin:10px 0 12px 18px;padding:0;color:#374151;">${includesHtml}</ul>` : ''}
            <div style="font-size:18px;font-weight:700;color:#0f172a;margin:8px 0;">${formatCurrency(tier.price ?? totalAmount)}</div>
            <a href="${tierHref}" style="display:inline-block;padding:10px 14px;background:#173861;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;">
              Approve ${escapeHtml(tier.label)}
            </a>
          </div>
        `);
      }

      tierCardsHtml = `
        <h3 style="margin:20px 0 8px 0;font-size:18px;color:#111827;">Your Service Options</h3>
        ${cards.join('')}
      `;
    }

    const lineItemsTableHtml = buildLineItemsTable(lineItems);

    const bodyHtml = `
      <p style="margin:0 0 12px 0;">Hi ${escapeHtml(firstName)},</p>
      <p style="margin:0 0 16px 0;">Thank you for the opportunity to review your project. Below is your detailed service quote based on the information provided.</p>

      <div style="background:#f8fafc;border:1px solid #d1d5db;border-radius:10px;padding:14px 16px;margin:0 0 16px 0;">
        <div style="font-size:14px;color:#374151;">Quote #${escapeHtml(quoteNumberText)}</div>
        <div style="font-size:13px;color:#6b7280;margin-top:4px;">Quote Date: ${escapeHtml(quoteDateText)}${validThroughText ? ` | Valid Through: ${escapeHtml(validThroughText)}` : ''}</div>
        <div style="font-size:13px;color:#6b7280;margin-top:4px;">Service Address: ${escapeHtml(serviceAddress)}</div>
        <div style="font-size:30px;line-height:1.2;font-weight:800;color:#0f172a;margin-top:10px;">Total Investment: ${formatCurrency(totalAmount)}</div>
      </div>

      ${tierCardsHtml}

      <h3 style="margin:18px 0 8px 0;font-size:18px;color:#111827;">Scope Summary</h3>
      <p style="margin:0 0 10px 0;color:#374151;">This quote includes the services listed below and is structured to improve airflow efficiency, reduce dust circulation, and support healthier indoor air. The quoted price includes cleaning of the coil, blower, and AHU housing.</p>

      <h3 style="margin:18px 0 8px 0;font-size:18px;color:#111827;">Line Items</h3>
      ${lineItemsTableHtml}

      <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;border-collapse:collapse;">
        <tr><td style="padding:4px 0;color:#374151;">Subtotal</td><td style="padding:4px 0;text-align:right;color:#111827;">${formatCurrency(subtotal)}</td></tr>
        ${taxAmount > 0 ? `<tr><td style="padding:4px 0;color:#374151;">Tax</td><td style="padding:4px 0;text-align:right;color:#111827;">${formatCurrency(taxAmount)}</td></tr>` : ''}
        <tr><td style="padding:8px 0;font-weight:700;color:#111827;border-top:1px solid #d1d5db;">Total</td><td style="padding:8px 0;text-align:right;font-weight:700;color:#111827;border-top:1px solid #d1d5db;">${formatCurrency(totalAmount)}</td></tr>
      </table>

      ${!hasTierCards ? `
      <div style="margin:18px 0;">
        <a href="${quotePublicUrl}" style="display:inline-block;padding:12px 16px;background:#173861;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:700;">Review & Approve Quote</a>
      </div>
      <p style="margin:8px 0 0 0;color:#6b7280;font-size:13px;">Open the secure quote page to approve or decline online: <a href="${quotePublicUrl}" style="color:#173861;">View quote details</a></p>
      ` : ''}

      <h3 style="margin:18px 0 8px 0;font-size:18px;color:#111827;">Trust & Quality</h3>
      <ul style="margin:0 0 14px 18px;padding:0;color:#374151;">
        <li>Licensed & Fully Insured</li>
        <li>Background-Checked Technicians (No Subcontractors)</li>
        <li>Professional-Grade Equipment</li>
        <li>Satisfaction Guarantee on All Services</li>
      </ul>

      <h3 style="margin:18px 0 8px 0;font-size:18px;color:#111827;">Scheduling & Payment</h3>
      <p style="margin:0 0 12px 0;color:#374151;">
        No payment is required to approve this quote.<br/>
        Preferred scheduling priority is held for 72 hours after this quote is sent.<br/>
        Once approved, your accepted pricing is honored for 30 days while we schedule your service.<br/>
        Our team will contact you within 1 business day to confirm scheduling.<br/>
        Payment is due upon completion. We accept all major credit cards.
      </p>

      <p style="margin:14px 0 0 0;color:#374151;">If you have any questions about the scope or pricing, simply reply to this email.</p>
    `;

    const defaultSubject = `Quote #${quoteNumberText} - ${formatCurrency(totalAmount)} - ${primaryServiceLabel}`;
    const subject = customSubject || defaultSubject;
    const html = renderEmailLayout({
      preheader: customPreheader || `Quote #${quoteNumberText} for ${formatCurrency(totalAmount)}`,
      title: customTitle || `Service Quote #${quoteNumberText}`,
      bodyHtml: customBodyHtml || bodyHtml,
    });
    const wantsHtml = String(body.pdf_renderer || '').toLowerCase() !== 'text';
    let attachments: Array<Record<string, unknown>> = [];
    if (attachPdf) {
      let pdfAttachment: Record<string, unknown> | null = null;
      let rendererUsed: 'pdfshift' | 'text' = 'text';
      let rendererError: string | null = null;

      if (wantsHtml) {
        const htmlDoc = buildEstimateHtmlDocument({
          quoteNumberText,
          quoteDateText,
          validThroughText,
          recipientName,
          serviceAddress,
          lineItems,
          subtotal,
          taxAmount,
          totalAmount,
          quotePublicUrl,
          tierOptions,
        });

        const rendered = await renderHtmlToPdfBytes({ html: htmlDoc, letter: true });
        if (rendered.ok) {
          rendererUsed = 'pdfshift';
          pdfAttachment = pdfAttachmentFromBytes({
            filename: `quote-${String(quoteNumberText || 'pending').replace(/[^\w.-]+/g, '-')}.pdf`,
            bytes: rendered.bytes,
          });
        } else {
          rendererError = rendered.error;
        }
      }

      if (!pdfAttachment) {
        rendererUsed = 'text';
        pdfAttachment = buildEstimatePdfAttachment({
          firstName,
          quoteNumberText,
          quoteDateText,
          validThroughText,
          serviceAddress,
          lineItems,
          subtotal,
          taxAmount,
          totalAmount,
          quotePublicUrl,
          tierOptions,
        });
      }

      attachments = [pdfAttachment];
    }

    if (asString(quote.status).toLowerCase() === 'superseded') {
      return respondJson(
        {
          error: 'Quote has been superseded by a newer revision and cannot be sent.',
          code: 'QUOTE_SUPERSEDED',
        },
        409,
      );
    }

    if (dryRun) {
      if (deliveryChannel === 'sms') {
        const smsPreview = await sendDocumentSms({
          documentType: 'estimate',
          documentUrl: quotePublicUrl,
          to: recipientPhone,
          recipientName,
          referenceNumber: quoteNumberText,
          dryRun: true,
        });

        await logEvent({
          tenantId: quote.tenant_id,
          entityType: 'quote',
          entityId: quote.id,
          eventType: 'estimate.send_previewed',
          actorType: 'user',
          actorId,
          payload: {
            quote_id: quote.id,
            estimate_id: quote.estimate_id,
            quote_number: quote.quote_number,
            recipient_phone: smsPreview.to,
            guardrail_result: guardrailResult,
            verified_claims: verifiedClaims,
            policy_version: POLICY_VERSION,
            delivery_channel: 'sms',
            requested_delivery_channel: requestedDeliveryChannel,
            delivery_resolution_reason: deliveryResolution.resolutionReason,
          },
        });

        return respondJson({
          dry_run: true,
          quote_id: quote.id,
          guardrail_result: guardrailResult,
          delivery_channel: 'sms',
          requested_delivery_channel: requestedDeliveryChannel,
          delivery_resolution_reason: deliveryResolution.resolutionReason,
          sms_preview: {
            to: smsPreview.to,
            body: smsPreview.body,
            document_url: quotePublicUrl,
          },
        });
      }

      await logEvent({
        tenantId: quote.tenant_id,
        entityType: 'quote',
        entityId: quote.id,
        eventType: 'estimate.send_previewed',
        actorType: 'user',
        actorId,
          payload: {
            quote_id: quote.id,
            estimate_id: quote.estimate_id,
            quote_number: quote.quote_number,
            recipient_email: recipientEmail,
            cc: ccRecipients,
          bcc: bccRecipients,
          attachments_count: attachments.length,
          guardrail_result: guardrailResult,
          verified_claims: verifiedClaims,
          policy_version: POLICY_VERSION,
          delivery_channel: 'email',
          requested_delivery_channel: requestedDeliveryChannel,
          delivery_resolution_reason: deliveryResolution.resolutionReason,
        },
      });

      return respondJson({
        dry_run: true,
        quote_id: quote.id,
        guardrail_result: guardrailResult,
        delivery_channel: 'email',
        requested_delivery_channel: requestedDeliveryChannel,
        delivery_resolution_reason: deliveryResolution.resolutionReason,
        attachments_count: attachments.length,
        email_preview: {
          from: 'The Vent Guys Quotes <quotes@vent-guys.com>',
          to: [recipientEmail],
          cc: ccRecipients,
          bcc: bccRecipients,
          subject,
          html,
          attachments: attachments.map((attachment) => ({
            filename: attachment.filename,
            content_type: attachment.content_type,
          })),
        },
      });
    }

    let providerId: string | null = null;
    let smsResult: Awaited<ReturnType<typeof sendDocumentSms>> | null = null;

    if (deliveryChannel === 'sms') {
      const duplicateSms = await hasRecentEvent({
        entityType: 'quote',
        entityId: quote.id,
        eventType: 'EstimateSmsSent',
        windowMinutes: 10,
      });

      if (duplicateSms) {
        return respondJson({
          success: true,
          quote_id: quote.id,
          guardrail_result: guardrailResult,
          delivery_channel: 'sms',
          skipped: true,
          reason: 'duplicate_recent_send',
        });
      }

      smsResult = await sendDocumentSms({
        documentType: 'estimate',
        documentUrl: quotePublicUrl,
        to: recipientPhone,
        recipientName,
        referenceNumber: quoteNumberText,
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

      await logEvent({
        tenantId: quote.tenant_id,
        entityType: 'quote',
        entityId: quote.id,
        eventType: 'EstimateSmsSent',
        actorType: 'user',
        actorId,
        payload: {
          quote_id: quote.id,
          estimate_id: quote.estimate_id,
          quote_number: quote.quote_number,
          recipient_phone: smsResult.to,
          sms_sid: smsResult.sid ?? null,
          delivery_channel: 'sms',
          requested_delivery_channel: requestedDeliveryChannel,
          delivery_resolution_reason: deliveryResolution.resolutionReason,
        },
      });
    } else {
      const provider = await sendEmail({
        from: 'The Vent Guys Quotes <quotes@vent-guys.com>',
        to: [recipientEmail],
        cc: ccRecipients.length ? ccRecipients : undefined,
        bcc: bccRecipients.length ? bccRecipients : undefined,
        subject,
        html,
        attachments: attachments.length ? attachments : undefined,
        tags: [
          { name: 'quote_id', value: quote.id },
          { name: 'tenant_id', value: effectiveTenantId },
        ],
      });
      providerId = (provider as Record<string, unknown>)?.id
        ? String((provider as Record<string, unknown>).id)
        : null;
    }

    const currentQuoteStatus = asString(quote.status).toLowerCase();
    const nextQuoteStatus = ['viewed', 'accepted', 'approved', 'paid', 'declined', 'rejected'].includes(currentQuoteStatus)
      ? currentQuoteStatus
      : 'sent';

    await supabaseAdmin
      .from('quotes')
      .update({
        status: nextQuoteStatus,
        sent_at: now.toISOString(),
        valid_until: policyValidUntil,
        updated_at: now.toISOString(),
      })
      .eq('id', quote.id);

    await enqueueQuoteReminderTask({
      tenantId: quote.tenant_id || effectiveTenantId || 'tvg',
      quoteId: quote.id,
      leadId: quote.lead_id,
      quoteNumber: quoteNumberText || null,
      sentAt: now.toISOString(),
    });

    await persistDocumentDeliveryPreference({
      tenantId: quote.tenant_id ?? effectiveTenantId ?? null,
      leadId: quote.lead_id,
      deliveryChannel,
    });

    await logEvent({
      tenantId: quote.tenant_id,
      entityType: 'quote',
      entityId: quote.id,
      eventType: 'QuoteSent',
      actorType: 'user',
      actorId,
      payload: {
        quote_id: quote.id,
        estimate_id: quote.estimate_id,
        quote_number: quote.quote_number,
        recipient_email: deliveryChannel === 'sms' ? null : recipientEmail,
        recipient_phone: deliveryChannel === 'sms' ? recipientPhone : null,
        sms_sid: smsResult?.sid ?? null,
        delivery_channel: deliveryChannel,
        requested_delivery_channel: requestedDeliveryChannel,
        delivery_resolution_reason: deliveryResolution.resolutionReason,
        attachments_count: attachments.length,
        sent_timestamp: now.toISOString(),
      },
    });

    await logEvent({
      tenantId: quote.tenant_id,
      entityType: 'quote',
      entityId: quote.id,
      eventType: 'estimate.sent',
      actorType: 'user',
      actorId,
      payload: {
        quote_id: quote.id,
        estimate_id: quote.estimate_id,
        quote_number: quote.quote_number,
        tier_name: hasTierCards ? 'tiered' : 'single',
        total_revenue: totalAmount,
        gross_margin_dollars: marginPayload.gross_margin_dollars ?? null,
        gross_margin_percent: marginPayload.gross_margin_percent ?? null,
        estimated_labor_cost: marginPayload.estimated_labor_cost ?? null,
        estimated_material_cost: marginPayload.estimated_material_cost ?? null,
        estimated_equipment_cost: marginPayload.estimated_equipment_cost ?? null,
        sent_timestamp: new Date().toISOString(),
        sender_user_id: actorId,
        guardrail_result: guardrailResult,
        verified_claims: verifiedClaims,
        policy_version: POLICY_VERSION,
        delivery_channel: deliveryChannel,
        requested_delivery_channel: requestedDeliveryChannel,
        delivery_resolution_reason: deliveryResolution.resolutionReason,
        attachments_count: attachments.length,
      },
    });

    return respondJson({
      id: providerId,
      quote_id: quote.id,
      guardrail_result: guardrailResult,
      delivery_channel: deliveryChannel,
      requested_delivery_channel: requestedDeliveryChannel,
      delivery_resolution_reason: deliveryResolution.resolutionReason,
      attachments_count: attachments.length,
      success: deliveryChannel === 'sms' ? true : undefined,
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
    console.error('send-estimate failed:', error);
    const message = error instanceof Error ? error.message : 'Internal error';
    return respondJson({ error: message }, 500);
  }
});
