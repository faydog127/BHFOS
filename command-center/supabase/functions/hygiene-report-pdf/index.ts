import { corsHeaders } from './cors.ts';
import { getVerifiedClaims } from '../_shared/auth.ts';
import { escapeHtml } from '../_shared/email.ts';
import { renderHtmlToPdfBytes } from '../_shared/htmlToPdf.ts';
import { base64EncodeBytes } from '../_shared/pdfUtils.ts';

type JsonObject = Record<string, unknown>;

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

const parseJson = async (req: Request): Promise<JsonObject> => {
  try {
    const parsed = await req.json();
    return parsed && typeof parsed === 'object' ? (parsed as JsonObject) : {};
  } catch {
    return {};
  }
};

const asString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const asNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const asStringList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => asString(entry)).filter(Boolean).slice(0, 50);
};

const clampInt = (value: number, min: number, max: number) => Math.max(min, Math.min(max, Math.trunc(value)));

const formatDateDisplay = (value: string) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.valueOf())) return raw;
  try {
    return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(parsed);
  } catch {
    return raw;
  }
};

const stripHtmlToText = (html: string) =>
  String(html || '')
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

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

const buildFallbackPdfFromHtml = (params: { title: string; html: string }): Uint8Array => {
  const text = stripHtmlToText(params.html);
  const lines = wrapTextByChars(text, 92);
  const pages: PdfTextLine[][] = [];

  let current: PdfTextLine[] = [];
  let y = 742;

  const startPage = (continued: boolean) => {
    current = [];
    pages.push(current);
    y = 742;
    current.push({
      text: continued ? `${params.title} (continued)` : params.title,
      x: 50,
      y,
      size: 18,
      font: 'F2',
    });
    y -= 28;
  };

  startPage(false);

  for (const line of lines) {
    if (y < 70) startPage(true);
    current.push({ text: line, x: 50, y, size: 11, font: 'F1' });
    y -= 15;
  }

  return buildPdfDocument(pages);
};

const buildReportHtml = (params: {
  customerName: string;
  serviceAddress: string;
  serviceDate: string;
  technicianName: string;
  findings: string[];
  nextServiceDate: string;
  loyaltyCode: string;
  loyaltyDiscount: number;
  loyaltyExpiration: string;
}) => {
  const customerName = escapeHtml(params.customerName || 'Valued Customer');
  const serviceAddress = escapeHtml(params.serviceAddress || '—');
  const serviceDate = escapeHtml(formatDateDisplay(params.serviceDate) || '—');
  const technicianName = escapeHtml(params.technicianName || 'The Vent Guys Team');
  const nextServiceDate = escapeHtml(formatDateDisplay(params.nextServiceDate) || '—');

  const findings = (params.findings || []).slice(0, 25).map((finding) => escapeHtml(finding)).filter(Boolean);
  const findingsHtml = findings.length
    ? findings.map((finding) => `<li style="margin: 0 0 8px 0;">${finding}</li>`).join('')
    : '<li style="margin: 0 0 8px 0;">Standard cleaning performed. System is operating normally.</li>';

  const loyaltyCode = escapeHtml(params.loyaltyCode || '');
  const discount = clampInt(params.loyaltyDiscount || 0, 0, 50);
  const loyaltyExpiration = escapeHtml(formatDateDisplay(params.loyaltyExpiration) || '');

  const discountSection = loyaltyCode
    ? `
      <div style="border: 2px dashed #16a34a; border-radius: 10px; padding: 18px; margin: 18px 0;">
        <div style="font-size: 16px; font-weight: 700; color: #166534; margin-bottom: 6px;">Loyalty Thank-You</div>
        <div style="color: #166534; margin-bottom: 10px;">Save ${discount}% on your next annual maintenance (or share with a neighbor).</div>
        <div style="display: inline-block; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 22px; font-weight: 700; letter-spacing: 2px; padding: 8px 14px; border: 1px solid #bbf7d0; border-radius: 8px; color: #16a34a;">${loyaltyCode}</div>
        ${loyaltyExpiration ? `<div style="margin-top: 8px; font-size: 12px; color: #166534;">Valid until ${loyaltyExpiration}</div>` : ''}
      </div>
    `
    : '';

  return `
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>System Hygiene Report</title>
      <style>
        * { box-sizing: border-box; }
        body { font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif; margin: 0; color: #0f172a; }
        .page { width: 100%; }
        .header { background: #1e3a8a; color: #fff; padding: 18px 22px; }
        .header-title { margin: 0; font-size: 22px; line-height: 1.2; }
        .header-sub { margin: 6px 0 0 0; color: #bfdbfe; font-size: 12px; }
        .section { padding: 18px 22px; }
        .box { background: #f8fafc; border-left: 4px solid #3b82f6; padding: 12px 14px; border-radius: 8px; }
        .h3 { margin: 18px 0 8px; font-size: 14px; color: #1e3a8a; padding-bottom: 6px; border-bottom: 1px solid #e2e8f0; }
        ul { margin: 8px 0 0; padding-left: 18px; }
        .footer { padding: 14px 22px; font-size: 11px; color: #475569; border-top: 1px solid #e2e8f0; }
      </style>
    </head>
    <body>
      <div class="page">
        <div class="header">
          <h1 class="header-title">System Hygiene Report</h1>
          <div class="header-sub">The Vent Guys Service Record</div>
        </div>

        <div class="section">
          <div style="margin-bottom: 10px;">Hello <strong>${customerName}</strong>,</div>
          <div style="margin-bottom: 12px;">This report confirms the completion of your recent service.</div>

          <div class="box">
            <div><strong>Service Address:</strong> ${serviceAddress}</div>
            <div><strong>Date Completed:</strong> ${serviceDate}</div>
            <div><strong>Technician:</strong> ${technicianName}</div>
          </div>

          <div class="h3">Technician Notes & Findings</div>
          <ul>
            ${findingsHtml}
          </ul>

          ${discountSection}

          <div style="margin-top: 14px;">
            Next recommended service date: <strong>${nextServiceDate}</strong>
          </div>
        </div>

        <div class="footer">
          &copy; ${new Date().getFullYear()} The Vent Guys &middot; Questions? Call (321) 360-9704
        </div>
      </div>
    </body>
  </html>
  `.trim();
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return respondJson({ success: false, error: 'Method not allowed' }, 405);
  }

  try {
    await getVerifiedClaims(req);
    const body = await parseJson(req);

    const customerName = asString(body.customerName ?? body.customer_name);
    const serviceAddress = asString(body.serviceAddress ?? body.service_address);
    const serviceDate = asString(body.serviceDate ?? body.service_date);
    const technicianName = asString(body.technicianName ?? body.technician_name);
    const findings = asStringList(body.findings);
    const nextServiceDate = asString(body.nextServiceDate ?? body.next_service_date);
    const loyaltyCode = asString(body.loyaltyCode ?? body.loyalty_code);
    const loyaltyDiscount = asNumber(body.loyaltyDiscount ?? body.loyalty_discount) ?? 0;
    const loyaltyExpiration = asString(body.loyaltyExpiration ?? body.loyalty_expiration);

    if (!serviceDate) return respondJson({ success: false, error: 'Missing serviceDate' }, 400);
    if (!serviceAddress) return respondJson({ success: false, error: 'Missing serviceAddress' }, 400);

    const html = buildReportHtml({
      customerName,
      serviceAddress,
      serviceDate,
      technicianName,
      findings,
      nextServiceDate,
      loyaltyCode,
      loyaltyDiscount,
      loyaltyExpiration,
    });

    const safeDate = serviceDate.replace(/[^\d-]/g, '').slice(0, 10) || 'service';
    const filename = `hygiene-report-${safeDate}.pdf`;

    const rendered = await renderHtmlToPdfBytes({ html, letter: true });
    if (rendered.ok) {
      return respondJson({
        success: true,
        filename,
        pdf_base64: base64EncodeBytes(rendered.bytes),
        renderer: 'pdfshift',
      });
    }

    const fallbackBytes = buildFallbackPdfFromHtml({ title: 'System Hygiene Report', html });
    return respondJson({
      success: true,
      filename,
      pdf_base64: base64EncodeBytes(fallbackBytes),
      renderer: 'fallback',
      warning: rendered.error,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return respondJson({ success: false, error: message }, 500);
  }
});
