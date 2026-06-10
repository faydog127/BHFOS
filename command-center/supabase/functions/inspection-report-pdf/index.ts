import { corsHeaders } from '../_lib/cors.ts';
import { supabaseAdmin } from '../_lib/supabaseAdmin.ts';
import { getTenantIdFromClaims, getVerifiedClaims } from '../_shared/auth.ts';
import { renderHtmlToPdfBytes, pdfAttachmentFromBytes } from '../_shared/htmlToPdf.ts';
import { base64EncodeBytes } from '../_shared/pdfUtils.ts';
import {
  BUSINESS_ADDRESS_LINE1,
  BUSINESS_ADDRESS_LINE2,
  BUSINESS_EMAIL,
  BUSINESS_PHONE_DISPLAY,
  LOGO_URL,
  escapeHtml,
} from '../_shared/email.ts';

type JsonObject = Record<string, unknown>;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const asString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
const asNullableString = (value: unknown) => {
  if (value === null) return null;
  const text = asString(value);
  return text ? text : null;
};

const normalize = (value: unknown) => asString(value).toLowerCase();

const formatDate = (value: unknown) => {
  const raw = asNullableString(value);
  if (!raw) return '';
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.valueOf())) return raw;
  return parsed.toLocaleString('en-US', { year: 'numeric', month: 'short', day: '2-digit' });
};

const sha256Hex = async (bytes: Uint8Array) => {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hashBytes = new Uint8Array(digest);
  return Array.from(hashBytes).map((b) => b.toString(16).padStart(2, '0')).join('');
};

const downloadStorageObjectAsDataUrl = async (bucketId: string, objectPath: string, contentTypeHint: string | null) => {
  const { data, error } = await supabaseAdmin.storage.from(bucketId).download(objectPath);
  if (error || !data) {
    throw new Error(error?.message || 'storage_download_failed');
  }

  const bytes = new Uint8Array(await data.arrayBuffer());
  const contentType = contentTypeHint || (data as Blob).type || 'application/octet-stream';
  const b64 = base64EncodeBytes(bytes);
  return `data:${contentType};base64,${b64}`;
};

const buildInspectionHtml = async (params: {
  tenantId: string;
  inspection: Record<string, unknown>;
  lead: Record<string, unknown> | null;
  job: Record<string, unknown> | null;
  quote: Record<string, unknown> | null;
  technician: Record<string, unknown> | null;
  findings: Array<Record<string, unknown>>;
  recommendations: Array<Record<string, unknown>>;
  photos: Array<Record<string, unknown>>;
}) => {
  const inspection = params.inspection;
  const lead = params.lead || {};
  const job = params.job || {};
  const quote = params.quote || {};
  const technician = params.technician || {};
  const findings = (params.findings || []).filter((row) => (row as any)?.is_customer_visible !== false);
  const recommendations = (params.recommendations || []).filter((row) => (row as any)?.is_customer_visible !== false);
  // Only include non-voided photos that are fully uploaded.
  // Allow empty upload_state for backwards compatibility in older/local environments.
  const photos = (params.photos || []).filter((row) => {
    if ((row as any)?.is_voided === true) return false;
    const uploadState = normalize((row as any)?.upload_state);
    return !uploadState || uploadState === 'complete';
  });

  const customerName =
    asString(lead.company) ||
    [asString(lead.first_name), asString(lead.last_name)].filter(Boolean).join(' ') ||
    asString(lead.email) ||
    'Customer';

  const workOrder = asString(job.work_order_number) || asString(job.job_number) || '';
  const serviceAddress = asString(job.service_address) || asString((inspection as any).service_address) || '';
  const inspectedOn = formatDate(inspection.completed_at || inspection.started_at || inspection.created_at);
  const techName = asString(technician.full_name) || 'The Vent Guys Technician';
  const quoteNumber = asString(quote.quote_number) || '';
  const quoteTotal = typeof quote.total_amount === 'number' ? quote.total_amount : Number(quote.total_amount || 0);
  const quoteDisplay =
    quoteNumber && Number.isFinite(quoteTotal) && quoteTotal > 0
      ? `#${quoteNumber} ($${quoteTotal.toFixed(2)})`
      : quoteNumber
        ? `#${quoteNumber}`
        : '';
  const summary = asString(inspection.summary);
  const disclaimer = asString(inspection.disclaimer_text) ||
    'This report reflects visible conditions at the time of inspection. Hidden conditions may exist.';

  const photosByFinding = new Map<string, Array<Record<string, unknown>>>();
  photos.forEach((photo) => {
    const findingId = asNullableString(photo.finding_id);
    if (!findingId) return;
    const existing = photosByFinding.get(findingId) || [];
    existing.push(photo);
    photosByFinding.set(findingId, existing);
  });

  // Embed a limited number of photos to avoid huge PDFs.
  const MAX_PHOTOS = 24;
  const photosToEmbed = photos.slice(0, MAX_PHOTOS);
  const embeddedMap = new Map<string, string>();
  for (const photo of photosToEmbed) {
    const bucketId = asString(photo.bucket_id) || 'inspection-photos';
    const objectPath = asString(photo.object_path);
    if (!objectPath) continue;
    try {
      const dataUrl = await downloadStorageObjectAsDataUrl(bucketId, objectPath, asNullableString(photo.content_type));
      embeddedMap.set(asString(photo.id), dataUrl);
    } catch {
      // Skip broken images but still include the record in text.
    }
  }

  const renderPhotoGrid = (rows: Array<Record<string, unknown>>) => {
    if (!rows.length) return '';
    const cards = rows.map((photo) => {
      const caption = escapeHtml(asString(photo.caption) || asString(photo.file_name) || 'Photo');
      const flag = photo.is_before === true ? 'Before' : photo.is_before === false ? 'After' : '';
      const flagHtml = flag ? `<div class="flag">${escapeHtml(flag)}</div>` : '';
      const imgSrc = embeddedMap.get(asString(photo.id));
      const imgHtml = imgSrc
        ? `<img src="${imgSrc}" alt="${caption}" />`
        : `<div class="imgFallback">Image unavailable</div>`;

      return `
        <div class="photoCard">
          <div class="imgShell">
            ${flagHtml}
            ${imgHtml}
          </div>
          <div class="photoCaption">${caption}</div>
        </div>
      `;
    }).join('');

    return `<div class="photoGrid">${cards}</div>`;
  };

  const findingsHtml = findings.map((finding, idx) => {
    const id = asString(finding.id);
    const title = escapeHtml(asString(finding.title) || `Finding ${idx + 1}`);
    const severity = escapeHtml(asString(finding.severity));
    const category = escapeHtml(asString(finding.category).replaceAll('_', ' '));
    const description = escapeHtml(asString(finding.description));
    const recommended = escapeHtml(asString(finding.recommended_action));

    const metaBits = [severity && `Severity: ${severity}`, category && `Category: ${category}`].filter(Boolean);
  const metaHtml = metaBits.length ? `<div class="meta">${metaBits.join(' - ')}</div>` : '';
    const descHtml = description ? `<div class="body">${description}</div>` : '';
    const recHtml = recommended ? `<div class="rec"><strong>Recommended:</strong> ${recommended}</div>` : '';
    const photoRows = photosByFinding.get(id) || [];
    const photoHtml = photoRows.length ? `<div class="sectionTitle">Photo Evidence</div>${renderPhotoGrid(photoRows)}` : '';

    return `
      <div class="finding">
        <div class="findingTitle">${title}</div>
        ${metaHtml}
        ${descHtml}
        ${recHtml}
        ${photoHtml}
      </div>
    `;
  }).join('');

  const recsHtml = recommendations.length
    ? recommendations.map((r) => {
        const title = escapeHtml(asString(r.title) || 'Recommendation');
        const priority = escapeHtml(asString(r.priority) || 'normal');
        const desc = escapeHtml(asString(r.description));
        const qty = r.suggested_quantity != null ? Number(r.suggested_quantity) : null;
        const price = r.suggested_unit_price != null ? Number(r.suggested_unit_price) : null;
        const line = [
          Number.isFinite(qty) ? `Qty ${qty}` : null,
          Number.isFinite(price) ? `$${price.toFixed(2)}` : null,
        ].filter(Boolean).join(' - ');

        return `
          <div class="recItem">
            <div class="recTitle">${title}</div>
            <div class="meta">Priority: ${priority}${line ? ` - ${escapeHtml(line)}` : ''}</div>
            ${desc ? `<div class="body">${desc}</div>` : ''}
          </div>
        `;
      }).join('')
    : `<div class="muted">No recommendations recorded.</div>`;

  const logoHtml = LOGO_URL ? `<img class="logo" src="${escapeHtml(LOGO_URL)}" alt="logo" />` : '';

  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Inspection Report</title>
      <style>
        @page { size: Letter; margin: 0.45in; }
        html, body { font-family: Arial, Helvetica, sans-serif; color: #0f172a; }
        .shell { border: 1px solid #e2e8f0; border-radius: 18px; overflow: hidden; }
        .header { background: linear-gradient(90deg, #091e39, #173861); color: #fff; padding: 18px 20px; }
        .headerRow { display:flex; align-items:center; justify-content:space-between; gap: 16px; }
        .logo { height: 44px; width: auto; }
        .title { font-size: 20px; font-weight: 900; margin: 0; }
        .sub { font-size: 12px; opacity: 0.9; margin-top: 4px; line-height: 1.35; }
        .bar { height: 4px; background: #b52025; }
        .content { padding: 16px 18px 14px 18px; }
        .grid { display:grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .card { border: 1px solid #e2e8f0; border-radius: 16px; padding: 12px 14px; background: #fff; }
        .label { font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: #64748b; }
        .value { margin-top: 5px; font-size: 13px; color: #0f172a; }
        .section { margin-top: 14px; }
        .sectionTitle { font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: #0f172a; font-weight: 800; margin: 0 0 8px 0; }
        .finding { border: 1px solid #e2e8f0; border-radius: 16px; padding: 12px 14px; margin-bottom: 10px; }
        .findingTitle { font-size: 14px; font-weight: 900; margin: 0 0 6px 0; }
        .meta { font-size: 12px; color: #475569; margin-bottom: 6px; }
        .body { font-size: 13px; color: #0f172a; white-space: pre-wrap; margin-bottom: 6px; }
        .rec { font-size: 13px; color: #0f172a; white-space: pre-wrap; margin-top: 6px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 10px 10px; }
        .photoGrid { display:grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 8px; }
        .photoCard { border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; }
        .imgShell { position: relative; background: #f1f5f9; height: 160px; display:flex; align-items:center; justify-content:center; }
        .imgShell img { width: 100%; height: 100%; object-fit: cover; display:block; }
        .imgFallback { font-size: 12px; color: #64748b; }
        .flag { position:absolute; left: 10px; top: 10px; background: rgba(15,23,42,0.85); color:#fff; padding: 4px 8px; border-radius: 999px; font-size: 11px; }
        .photoCaption { padding: 10px 10px; font-size: 12px; color: #0f172a; }
        .muted { font-size: 13px; color: #64748b; }
        .footer { margin-top: 14px; border-top: 1px solid #e2e8f0; padding-top: 10px; font-size: 11px; color: #64748b; white-space: pre-wrap; }
      </style>
    </head>
    <body>
      <div class="shell">
        <div class="header">
          <div class="headerRow">
            <div>
              <div class="title">Inspection Report</div>
              <div class="sub">${escapeHtml(BUSINESS_ADDRESS_LINE1)} | ${escapeHtml(BUSINESS_ADDRESS_LINE2)}<br />
                ${escapeHtml(BUSINESS_PHONE_DISPLAY)} | ${escapeHtml(BUSINESS_EMAIL)}
              </div>
            </div>
            <div>${logoHtml}</div>
          </div>
        </div>
        <div class="bar"></div>
        <div class="content">
          <div class="grid">
            <div class="card">
              <div class="label">Customer</div>
              <div class="value">${escapeHtml(customerName)}</div>
            </div>
            <div class="card">
              <div class="label">Technician</div>
              <div class="value">${escapeHtml(techName)}</div>
            </div>
            <div class="card">
              <div class="label">Inspected On</div>
              <div class="value">${escapeHtml(inspectedOn || '')}</div>
            </div>
            <div class="card">
              <div class="label">Quote</div>
              <div class="value">${escapeHtml(quoteDisplay || 'Unlinked')}</div>
            </div>
            <div class="card">
              <div class="label">Work Order</div>
              <div class="value">${escapeHtml(workOrder || 'Unlinked')}</div>
            </div>
            <div class="card" style="grid-column: 1 / -1;">
              <div class="label">Service Address</div>
              <div class="value">${escapeHtml(serviceAddress || 'Not recorded')}</div>
            </div>
          </div>

          ${summary ? `<div class="section"><div class="sectionTitle">Summary</div><div class="card"><div class="body">${escapeHtml(summary)}</div></div></div>` : ''}

          <div class="section">
            <div class="sectionTitle">Findings</div>
            ${findingsHtml || `<div class="muted">No findings recorded.</div>`}
          </div>

          <div class="section">
            <div class="sectionTitle">Recommendations</div>
            ${recsHtml}
          </div>

          <div class="footer">
            <strong>Disclaimer:</strong> ${escapeHtml(disclaimer)}
          </div>
        </div>
      </div>
    </body>
  </html>`;
};

// Text-only PDF fallback (no images). This is used when PDFShift is not configured.
type PdfFontKey = 'F1' | 'F2';
type PdfTextLine = { text: string; x: number; y: number; size: number; font: PdfFontKey };

const escapePdfText = (text: string) =>
  text
    .replaceAll('\\', '\\\\')
    .replaceAll('(', '\\(')
    .replaceAll(')', '\\)')
    .replaceAll('\r', '')
    .replaceAll('\n', ' ');

const wrapText = (text: string, maxChars: number) => {
  const normalized = String(text || '').trim().replace(/\s+/g, ' ');
  if (!normalized) return [];
  if (normalized.length <= maxChars) return [normalized];
  const lines: string[] = [];
  let current = '';
  for (const word of normalized.split(' ')) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
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

const buildTextOnlyInspectionPdf = (params: {
  customerName: string;
  inspectedOn: string;
  technicianName: string;
  serviceAddress: string;
  workOrder: string;
  summary: string;
  findings: Array<Record<string, unknown>>;
  recommendations: Array<Record<string, unknown>>;
  disclaimer: string;
}) => {
  const pages: PdfTextLine[][] = [];
  let current: PdfTextLine[] = [];
  let y = 742;

  const startPage = (continued = false) => {
    current = [];
    pages.push(current);
    y = 742;

    current.push({ text: continued ? 'Inspection Report (continued)' : 'Inspection Report', x: 50, y, size: 18, font: 'F2' });
    y -= 24;

    current.push({ text: 'The Vent Guys', x: 50, y, size: 11, font: 'F2' });
    y -= 16;
    current.push({ text: `${BUSINESS_ADDRESS_LINE1} | ${BUSINESS_ADDRESS_LINE2}`, x: 50, y, size: 9, font: 'F1' });
    y -= 12;
    current.push({ text: `${BUSINESS_PHONE_DISPLAY} | ${BUSINESS_EMAIL}`, x: 50, y, size: 9, font: 'F1' });
    y -= 18;
  };

  const pushLine = (text: string, font: PdfFontKey = 'F1', size = 10, indent = 0) => {
    const minY = 60;
    if (y < minY) startPage(true);
    current.push({ text, x: 50 + indent, y, size, font });
    y -= size + 4;
  };

  startPage(false);
  pushLine(`Customer: ${params.customerName}`, 'F2', 11);
  pushLine(`Technician: ${params.technicianName}`, 'F1', 10);
  pushLine(`Inspected On: ${params.inspectedOn}`, 'F1', 10);
  pushLine(`Work Order: ${params.workOrder || 'Unlinked'}`, 'F1', 10);
  if (params.serviceAddress) pushLine(`Address: ${params.serviceAddress}`, 'F1', 10);
  y -= 6;

  if (params.summary) {
    pushLine('Summary', 'F2', 12);
    wrapText(params.summary, 92).forEach((line) => pushLine(line, 'F1', 10));
    y -= 6;
  }

  pushLine('Findings', 'F2', 12);
  if (!params.findings.length) {
    pushLine('No findings recorded.', 'F1', 10);
  } else {
    params.findings.forEach((finding, idx) => {
      const title = asString(finding.title) || `Finding ${idx + 1}`;
      const severity = asString(finding.severity);
      const category = asString(finding.category);
      pushLine(`- ${title}${severity ? ` [${severity}]` : ''}${category ? ` (${category})` : ''}`, 'F2', 10);
      const desc = asString(finding.description);
      wrapText(desc, 92).slice(0, 6).forEach((line) => pushLine(line, 'F1', 10, 14));
      const rec = asString(finding.recommended_action);
      if (rec) {
        pushLine('Recommended:', 'F1', 10, 14);
        wrapText(rec, 92).slice(0, 6).forEach((line) => pushLine(line, 'F1', 10, 14));
      }
      y -= 4;
    });
  }

  y -= 6;
  pushLine('Recommendations', 'F2', 12);
  if (!params.recommendations.length) {
    pushLine('No recommendations recorded.', 'F1', 10);
  } else {
    params.recommendations.forEach((rec) => {
      const title = asString(rec.title) || 'Recommendation';
      pushLine(`- ${title}`, 'F2', 10);
      const desc = asString(rec.description);
      wrapText(desc, 92).slice(0, 6).forEach((line) => pushLine(line, 'F1', 10, 14));
    });
  }

  y -= 6;
  pushLine('Disclaimer', 'F2', 12);
  wrapText(params.disclaimer || '', 92).slice(0, 8).forEach((line) => pushLine(line, 'F1', 10));

  return buildPdfDocument(pages);
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const { claims } = await getVerifiedClaims(req);
    const body = (await req.json().catch(() => ({}))) as JsonObject;
    const requestedTenantId = asNullableString(body.tenant_id);
    const inspectionId = asNullableString(body.inspection_id);
    const storeArtifact = body.store === true || body.store === '1' || body.store === 1;
    const returnPdf = body.return_pdf !== false;

    if (!requestedTenantId) return json({ error: 'Missing tenant_id' }, 400);
    if (!inspectionId) return json({ error: 'Missing inspection_id' }, 400);

    const role = normalize((claims as any)?.role);
    const jwtTenantId = getTenantIdFromClaims(claims);

    if (role !== 'service_role') {
      if (!jwtTenantId) return json({ error: 'Unauthorized: missing tenant claim' }, 403);
      if (requestedTenantId !== jwtTenantId) return json({ error: 'Tenant mismatch' }, 403);
    }

    const tenantId = requestedTenantId;

    const { data: inspection, error: inspectionError } = await supabaseAdmin
      .from('inspections')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', inspectionId)
      .maybeSingle();

    if (inspectionError) return json({ error: inspectionError.message }, 500);
    if (!inspection) return json({ error: 'Inspection not found' }, 404);

    const [leadRes, jobRes, quoteRes, techRes, findingsRes, recRes, photosRes] = await Promise.all([
      inspection.lead_id
        ? supabaseAdmin.from('leads').select('*').eq('tenant_id', tenantId).eq('id', inspection.lead_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      inspection.job_id
        ? supabaseAdmin.from('jobs').select('*').eq('tenant_id', tenantId).eq('id', inspection.job_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      inspection.quote_id
        ? supabaseAdmin.from('quotes').select('id, quote_number, status, total_amount').eq('tenant_id', tenantId).eq('id', inspection.quote_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      inspection.technician_id
        ? supabaseAdmin.from('technicians').select('*').eq('id', inspection.technician_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      supabaseAdmin
        .from('inspection_findings')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('inspection_id', inspectionId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true }),
      supabaseAdmin
        .from('inspection_recommendations')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('inspection_id', inspectionId)
        .order('created_at', { ascending: true }),
      supabaseAdmin
        .from('inspection_photos')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('inspection_id', inspectionId)
        .order('uploaded_at', { ascending: true }),
    ]);

    const lead = leadRes.data as Record<string, unknown> | null;
    const job = jobRes.data as Record<string, unknown> | null;
    const quote = quoteRes.data as Record<string, unknown> | null;
    const technician = techRes.data as Record<string, unknown> | null;
    const findings = (findingsRes.data || []) as Array<Record<string, unknown>>;
    const recommendations = (recRes.data || []) as Array<Record<string, unknown>>;
    const photos = (photosRes.data || []) as Array<Record<string, unknown>>;

    let rendererUsed: 'pdfshift' | 'text' = 'text';
    let pdfBytes: Uint8Array;
    let rendererError: string | null = null;

    try {
      const html = await buildInspectionHtml({
        tenantId,
        inspection,
        lead,
        job,
        quote,
        technician,
        findings,
        recommendations,
        photos,
      });

      const pdfRes = await renderHtmlToPdfBytes({ html, filename: `inspection-${inspectionId}.pdf`, letter: true });
      if (!pdfRes.ok) {
        throw new Error(pdfRes.error);
      }
      rendererUsed = 'pdfshift';
      pdfBytes = pdfRes.bytes;
    } catch (err) {
      rendererError = err instanceof Error ? err.message : 'pdf_render_failed';
      // Local/dev fallback: generate a text-only PDF without images.
      const customerName =
        asString(lead?.company) ||
        [asString(lead?.first_name), asString(lead?.last_name)].filter(Boolean).join(' ') ||
        asString(lead?.email) ||
        'Customer';
      const workOrder = asString(job?.work_order_number) || asString(job?.job_number) || '';
      const serviceAddress = asString(job?.service_address) || '';
      const inspectedOn = formatDate((inspection as any).completed_at || (inspection as any).started_at || (inspection as any).created_at);
      const techName = asString(technician?.full_name) || 'The Vent Guys Technician';
      const summary = asString((inspection as any).summary);
      const disclaimer = asString((inspection as any).disclaimer_text) ||
        'This report reflects visible conditions at the time of inspection. Hidden conditions may exist.';

      pdfBytes = buildTextOnlyInspectionPdf({
        customerName,
        inspectedOn,
        technicianName: techName,
        serviceAddress,
        workOrder,
        summary,
        findings,
        recommendations,
        disclaimer,
      });
    }

    const filename = `inspection-${inspectionId}.pdf`;

    let reportRow: Record<string, unknown> | null = null;
    let storedFilePath: string | null = null;
    let storedFileHash: string | null = null;

    if (storeArtifact) {
      const rawRevision = (inspection as any)?.revision;
      const inspectionRevision = Number.isFinite(Number(rawRevision)) ? Number(rawRevision) : 1;

      const { data: lastReport } = await supabaseAdmin
        .from('inspection_reports')
        .select('report_version')
        .eq('tenant_id', tenantId)
        .eq('inspection_id', inspectionId)
        .eq('inspection_revision', inspectionRevision)
        .order('report_version', { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextVersion = Number(lastReport?.report_version || 0) + 1;
      storedFilePath = `${tenantId}/inspections/${inspectionId}/revision-${inspectionRevision}/reports/report-v${nextVersion}.pdf`;
      storedFileHash = await sha256Hex(pdfBytes);

      const uploadRes = await supabaseAdmin.storage
        .from('inspection-reports')
        .upload(storedFilePath, new Blob([pdfBytes], { type: 'application/pdf' }), {
          contentType: 'application/pdf',
          upsert: false,
        });

      if (uploadRes.error) {
        throw new Error(`report_storage_upload_failed: ${uploadRes.error.message}`);
      }

      const { data: inserted, error: insertError } = await supabaseAdmin
        .from('inspection_reports')
        .insert({
          tenant_id: tenantId,
          inspection_id: inspectionId,
          inspection_revision: inspectionRevision,
          report_version: nextVersion,
          status: 'generated',
          generated_at: new Date().toISOString(),
          generated_by: claims?.sub || null,
          file_path: storedFilePath,
          file_hash: storedFileHash,
          metadata: {
            renderer_used: rendererUsed,
            renderer_error: rendererError,
            photos_count: photos.length,
            findings_count: findings.length,
            recommendations_count: recommendations.length,
          },
        })
        .select('*')
        .single();

      if (insertError) {
        throw new Error(`report_row_insert_failed: ${insertError.message}`);
      }

      reportRow = inserted as Record<string, unknown>;

      // Canonical audit log (best effort).
      await supabaseAdmin
        .from('inspection_events')
        .insert({
          tenant_id: tenantId,
          inspection_id: inspectionId,
          event_type: 'report_generated',
          actor_user_id: claims?.sub || null,
          inspection_revision: inspectionRevision,
          metadata: {
            report_id: (reportRow as any)?.id || null,
            file_path: storedFilePath,
            file_hash: storedFileHash,
            renderer_used: rendererUsed,
            renderer_error: rendererError,
          },
        })
        .then(() => null)
        .catch(() => null);
    }

    const pdf = returnPdf ? pdfAttachmentFromBytes({ filename, bytes: pdfBytes }) : null;

    return json({
      ok: true,
      pdf,
      report: reportRow,
      meta: {
        tenant_id: tenantId,
        inspection_id: inspectionId,
        renderer_used: rendererUsed,
        renderer_error: rendererError,
        findings_count: findings.length,
        photos_count: photos.length,
        recommendations_count: recommendations.length,
        stored_file_path: storedFilePath,
        stored_file_hash: storedFileHash,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return json({ error: message }, 500);
  }
});
