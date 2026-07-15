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

const inspectionScopeLanguage = (inspection: Record<string, unknown>) => {
  const signals = [
    asString(inspection.inspection_type),
    asString(inspection.title),
    asString(inspection.summary),
  ].join(' ').toLowerCase();

  // Dryer-vent must win before generic "duct" matching.
  if (signals.includes('dryer')) {
    return {
      scope: 'Visible and readily accessible portions of the dryer-vent system documented during the scheduled inspection.',
      exclusions: 'Concealed duct sections, inaccessible terminations, destructive access, appliance diagnosis, and airflow testing not expressly recorded are outside this report.',
    };
  }
  if (signals.includes('air_duct') || signals.includes('air duct') || signals.includes('hvac') || signals.includes('coil') || signals.includes('blower') || signals.includes('duct')) {
    return {
      scope: 'Visible and readily accessible HVAC and air-distribution components documented during the scheduled inspection.',
      exclusions: 'Concealed ductwork, sealed equipment, destructive access, engineering analysis, code compliance, and performance testing not expressly recorded are outside this report.',
    };
  }
  return {
    scope: 'Visible and readily accessible conditions within the agreed inspection scope on the date shown.',
    exclusions: 'Concealed, inaccessible, obstructed, unsafe, or uninspected areas and destructive testing are outside this report.',
  };
};

/** Customer-safe evidence: non-voided, successfully uploaded photos only. */
const isEligibleReportPhoto = (row: Record<string, unknown>) => {
  if ((row as any)?.is_voided === true) return false;
  const uploadState = normalize((row as any)?.upload_state);
  if (uploadState === 'failed' || uploadState === 'pending') return false;
  // Empty upload_state kept for older/local records.
  return !uploadState || uploadState === 'complete';
};

/**
 * Phase E: exactly one inspection-level Service Recommendation
 * (finding_id null + customer-visible). First match only - no duplicates.
 */
const selectServiceRecommendation = (recommendations: Array<Record<string, unknown>>) => {
  const matches = (recommendations || []).filter((row) => {
    if ((row as any)?.is_customer_visible !== true) return false;
    const findingId = (row as any)?.finding_id;
    return findingId === null || findingId === undefined || findingId === '';
  });
  return matches[0] || null;
};

const photoTimingLabel = (photo: Record<string, unknown>) => {
  if (photo.is_before === true) return 'Before';
  if (photo.is_before === false) return 'After';
  return '';
};

const customerEvidenceCaption = (value: unknown) => {
  let caption = asString(value).replace(/^.*?\bevidence\s+\d+\s*:\s*/i, '').trim();
  if (!caption) return 'Inspection evidence';
  // Drop common speculative AI boilerplate from customer-facing captions only.
  caption = caption
    .replace(/\b(possibly|likely|appears to be|appears|uncertain|confidence[:\s]+\w+)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  const words = caption.split(/\s+/).filter(Boolean);
  if (words.length > 12) caption = `${words.slice(0, 12).join(' ')}`;
  if (!caption) return 'Inspection evidence';
  return caption.charAt(0).toUpperCase() + caption.slice(1);
};

const leadAddress = (lead: Record<string, unknown>) => {
  const direct = asString(lead.address) || asString(lead.service_address);
  if (direct) return direct;
  const cityLine = [asString(lead.city), asString(lead.state), asString(lead.zip)].filter(Boolean).join(' ');
  return [asString(lead.address1), asString(lead.address2), cityLine].filter(Boolean).join(', ');
};

const resolveServiceAddress = (
  inspection: Record<string, unknown>,
  job: Record<string, unknown> | null | undefined,
  lead: Record<string, unknown> | null | undefined,
) => (
  asString((inspection as any).service_address) ||
  asString(job?.service_address) ||
  leadAddress(lead || {}) ||
  asString((job as any)?.address) ||
  ''
);

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

const isLocalUrl = (url: string) => /127\.0\.0\.1|localhost/i.test(url);

/** Embed logo as data URL so PDFShift (remote) can render it even when LOGO_URL is local-only. */
const resolveReportLogoSrc = async () => {
  const publicFallback =
    asString(Deno.env.get('EMAIL_LOGO_URL')) ||
    // Same public brand asset used by the app header on dark backgrounds.
    'https://wwyxohjnyqnegzbxtuxs.supabase.co/storage/v1/object/public/vent-guys-images/logo_blackBG.png';

  const storageCandidates = ['logo_blackBG.png', 'Logo_noBG.png', 'Version-02.png'];
  for (const objectPath of storageCandidates) {
    try {
      return await downloadStorageObjectAsDataUrl('vent-guys-images', objectPath, 'image/png');
    } catch {
      // Local bucket may be empty; keep trying public/env URLs.
    }
  }

  const remoteCandidates = [publicFallback, LOGO_URL].filter((url, index, all) => {
    const value = asString(url);
    return Boolean(value) && !isLocalUrl(value) && all.indexOf(url) === index;
  });

  for (const url of remoteCandidates) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (!bytes.length) continue;
      const contentType = res.headers.get('content-type') || 'image/png';
      return `data:${contentType};base64,${base64EncodeBytes(bytes)}`;
    } catch {
      // Try next candidate.
    }
  }

  return '';
};

const buildInspectionHtml = async (params: {
  tenantId: string;
  inspection: Record<string, unknown>;
  lead: Record<string, unknown> | null;
  job: Record<string, unknown> | null;
  technician: Record<string, unknown> | null;
  serviceRecommendation: Record<string, unknown> | null;
  photos: Array<Record<string, unknown>>;
  reportVersion: number;
}) => {
  const inspection = params.inspection;
  const lead = params.lead || {};
  const job = params.job || {};
  const technician = params.technician || {};
  const serviceRecommendation = params.serviceRecommendation;
  // Eligible customer evidence only (voided/failed/pending excluded upstream and here).
  const photos = (params.photos || []).filter(isEligibleReportPhoto);

  const customerName =
    asString(lead.company) ||
    [asString(lead.first_name), asString(lead.last_name)].filter(Boolean).join(' ') ||
    asString(lead.email) ||
    'Customer';

  const workOrder = asString(job.work_order_number) || asString(job.job_number) || '';
  const serviceAddress = resolveServiceAddress(inspection, job, lead);
  const inspectedOn = formatDate(inspection.completed_at || inspection.started_at || inspection.created_at);
  const techName = asString(technician.full_name) || 'The Vent Guys Technician';
  const summary = asString(inspection.summary);
  const reportIdentifier = `INS-${asString(inspection.id).slice(0, 8).toUpperCase()}-R${Number((inspection as any).revision || 1)}`;
  const reviewedAt = formatDate((inspection as any).reviewed_at);
  const customDisclaimer = asString(inspection.disclaimer_text);
  const scopeLanguage = inspectionScopeLanguage(inspection);

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
      // Skip broken images but still include the caption row.
    }
  }

  const evidenceHtml = (() => {
    if (!photosToEmbed.length) return '';
    const cards = photosToEmbed.map((photo) => {
      const caption = escapeHtml(customerEvidenceCaption(photo.caption));
      const flag = photoTimingLabel(photo);
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
  })();

  const findingsHtml = summary
    ? `<div class="findingsNarrative"><div class="body">${escapeHtml(summary)}</div></div>`
    : ''; // Historical records without summary: omit section body rather than listing internal findings.

  const recHtml = serviceRecommendation ? (() => {
    const title = escapeHtml(asString(serviceRecommendation.title) || 'Service Recommendation');
    const desc = escapeHtml(asString(serviceRecommendation.description));
    return `
      <div class="recItem">
        <div class="recTitle">${title}</div>
        ${desc ? `<div class="body">${desc}</div>` : ''}
      </div>
    `;
  })() : '';

  const logoSrc = await resolveReportLogoSrc();
  const logoHtml = logoSrc
    ? `<img class="logo" src="${logoSrc}" alt="The Vent Guys" />`
    : '';

  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Inspection Report</title>
      <style>
        :root { --navy-dark:#091e39; --navy:#173861; --red:#b52025; --ink:#231f20; --muted:#475569; --border:#e2e8f0; --bg:#f8fafc; }
        * { box-sizing: border-box; }
        @page {
          size: Letter;
          margin: 0.48in 0.52in 0.7in;
          @bottom-left { content: "The Vent Guys | ${escapeHtml(reportIdentifier)} | v${params.reportVersion}"; color:#64748b; font-size:8px; }
          @bottom-right { content: "Page " counter(page) " of " counter(pages); color:#64748b; font-size:8px; }
        }
        html, body { font-family: Arial, Helvetica, sans-serif; color: var(--ink); margin:0; }
        .shell { max-width: 980px; margin: 0 auto; }
        .header { background: linear-gradient(135deg, var(--navy-dark), var(--navy)); color: #fff; padding: 18px 20px; border-radius: 14px; position:relative; overflow:hidden; }
        .header:before { content:""; position:absolute; left:-46px; top:-58px; width:170px; height:230px; background:rgba(181,32,37,.82); transform:rotate(18deg); }
        .headerRow { display:flex; align-items:center; justify-content:space-between; gap: 16px; }
        .headerRow > * { position:relative; z-index:1; }
        .logo { height: 64px; width: auto; max-width: 170px; object-fit: contain; display:block; }
        .brand { font-size: 28px; font-weight: 900; letter-spacing: 0.04em; text-transform: uppercase; margin: 0 0 6px; color: #fff; line-height: 1.05; }
        .title { font-size: 15px; font-weight: 700; margin: 0; color: #dbeafe; }
        .sub { font-size: 12px; opacity: 0.9; margin-top: 6px; line-height: 1.35; color:#e2e8f0; }
        .content { padding: 13px 0 0; }
        .documentBar { display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:9px; font-size:10px; color:#475569; }
        .customerCopy { padding:3px 8px; border:1px solid var(--border); border-radius:999px; font-weight:800; color:#0b1b4a; }
        .grid { display:grid; grid-template-columns: 1.15fr 1.6fr 1fr; gap: 8px; }
        .card { border: 1px solid var(--border); border-radius: 11px; padding: 9px 11px; background: #fff; break-inside:avoid; page-break-inside:avoid; min-height:57px; }
        .card.address { grid-column:span 2; }
        .label { font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: #64748b; }
        .value { margin-top: 5px; font-size: 13px; color: #0f172a; }
        .section { margin-top: 15px; }
        .sectionTitle { font-size: 15px; color: #0b1b4a; font-weight: 800; margin: 0 0 8px; padding-bottom:6px; border-bottom:1px solid var(--border); break-after:avoid-page; }
        .findingsNarrative { border: 1px solid var(--border); border-left:4px solid var(--red); border-radius: 11px; padding: 12px 14px; background:#fff; }
        .body { font-size: 13px; color: #0f172a; white-space: pre-wrap; line-height:1.45; }
        .recItem { border:1px solid var(--border); border-left:5px solid #3b82f6; background:var(--bg); border-radius:12px; padding:14px 16px; break-inside:avoid; }
        .recTitle { font-size: 15px; font-weight: 900; color:#0b1b4a; margin:0 0 8px; }
        .photoGrid { display:grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .photoCard { border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; break-inside:avoid; page-break-inside:avoid; }
        .imgShell { position: relative; background: #f1f5f9; height: 155px; display:flex; align-items:center; justify-content:center; }
        .imgShell img { width: 100%; height: 100%; object-fit: contain; display:block; }
        .imgFallback { font-size: 12px; color: #64748b; }
        .flag { position:absolute; left: 10px; top: 10px; background: rgba(15,23,42,0.85); color:#fff; padding: 4px 8px; border-radius: 999px; font-size: 11px; }
        .photoCaption { padding: 7px 8px; font-size: 10px; color: #334155; line-height:1.35; }
        .limits { border:1px solid var(--border); border-radius:11px; padding:11px 13px; color:var(--muted); font-size:10px; line-height:1.45; background:#f8fafc; }
        .limits p { margin:0 0 6px; }
        .limits p:last-child { margin-bottom:0; }
        .footer { margin-top: 15px; border-top: 1px solid var(--border); padding-top: 9px; font-size: 9px; color: #64748b; line-height:1.45; display:flex; justify-content:space-between; gap:16px; }
        @media screen and (max-width:720px) { .grid,.photoGrid { grid-template-columns:1fr; } }
        @media print { html,body{-webkit-print-color-adjust:exact;print-color-adjust:exact;} .findingsNarrative,.photoCard,.card,.limits,.recItem{break-inside:avoid;page-break-inside:avoid;} }
      </style>
    </head>
    <body>
      <div class="shell">
        <div class="header">
          <div class="headerRow">
            <div>
              <div class="brand">The Vent Guys</div>
              <div class="title">Customer Inspection Report</div>
              <div class="sub">${escapeHtml(BUSINESS_ADDRESS_LINE1)} | ${escapeHtml(BUSINESS_ADDRESS_LINE2)}<br />
                ${escapeHtml(BUSINESS_PHONE_DISPLAY)} | ${escapeHtml(BUSINESS_EMAIL)}
              </div>
            </div>
            <div class="logoWrap">${logoHtml}</div>
          </div>
        </div>
        <div class="content">
          <div class="documentBar"><div class="customerCopy">Customer Copy</div><div>${escapeHtml(reportIdentifier)} &nbsp;|&nbsp; Version ${params.reportVersion}</div></div>
          <div class="grid">
            <div class="card">
              <div class="label">Customer</div>
              <div class="value">${escapeHtml(customerName)}</div>
            </div>
            <div class="card">
              <div class="label">Inspection Date</div>
              <div class="value">${escapeHtml(inspectedOn || 'Not recorded')}</div>
            </div>
            <div class="card address">
              <div class="label">Service Address</div>
              <div class="value">${escapeHtml(serviceAddress || 'Address not provided')}</div>
            </div>
            <div class="card">
              <div class="label">Technician</div>
              <div class="value">${escapeHtml(techName)}</div>
            </div>
            <div class="card">
              <div class="label">Reviewed</div>
              <div class="value">${reviewedAt ? escapeHtml(reviewedAt) : 'Not recorded'}</div>
            </div>
            ${workOrder ? `<div class="card"><div class="label">Work Order</div><div class="value">${escapeHtml(workOrder)}</div></div>` : ''}
          </div>

          ${summary ? `<div class="section">
            <div class="sectionTitle">Findings</div>
            ${findingsHtml}
          </div>` : ''}

          ${evidenceHtml ? `<div class="section">
            <div class="sectionTitle">Supporting Evidence</div>
            ${evidenceHtml}
          </div>` : ''}

          ${serviceRecommendation ? `<div class="section">
            <div class="sectionTitle">Service Recommendation</div>
            ${recHtml}
          </div>` : ''}

          <div class="section"><div class="sectionTitle">Important Notes</div><div class="limits">
            <p><strong>Inspection scope.</strong> ${escapeHtml(scopeLanguage.scope)}</p>
            <p><strong>Limitations.</strong> ${escapeHtml(scopeLanguage.exclusions)} Conditions may exist that were not visible or reasonably discoverable at the time of inspection.</p>
            <p><strong>Report purpose.</strong> This is a point-in-time, non-invasive informational report. It is not a warranty, guarantee, insurance policy, engineering analysis, code-compliance certification, or environmental assessment. Photographs are representative and may not show every observed area.</p>
            <p><strong>Separate estimate.</strong> This Service Recommendation does not authorize work or establish final pricing. Proposed scope, authoritative pricing, and customer authorization are provided only in a separate estimate.</p>
            ${customDisclaimer ? `<p><strong>Additional inspection note.</strong> ${escapeHtml(customDisclaimer)}</p>` : ''}
          </div></div>
          <div class="footer"><div><strong>The Vent Guys</strong><br />${escapeHtml(BUSINESS_ADDRESS_LINE1)}, ${escapeHtml(BUSINESS_ADDRESS_LINE2)}</div><div>${escapeHtml(BUSINESS_PHONE_DISPLAY)}<br />${escapeHtml(BUSINESS_EMAIL)}</div></div>
        </div>
      </div>
    </body>
  </html>`;
};

// Local PDF fallback. This is used when PDFShift is not configured or unavailable.
type PdfFontKey = 'F1' | 'F2';
type PdfTextLine = { text: string; x: number; y: number; size: number; font: PdfFontKey };
type PdfImage = { bytes: Uint8Array; width: number; height: number; caption: string };
type PdfImagePlacement = PdfImage & { x: number; y: number; boxWidth: number; boxHeight: number };
type PdfPage = { lines: PdfTextLine[]; images: PdfImagePlacement[] };

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

const concatBytes = (chunks: Uint8Array[]) => {
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(length);
  let offset = 0;
  chunks.forEach((chunk) => {
    result.set(chunk, offset);
    offset += chunk.length;
  });
  return result;
};

const jpegDimensions = (bytes: Uint8Array) => {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  const startOfFrameMarkers = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
  let offset = 2;
  while (offset + 8 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1];
    offset += 2;
    if (marker === 0xd8 || marker === 0xd9) continue;
    if (offset + 1 >= bytes.length) break;
    const segmentLength = (bytes[offset] << 8) | bytes[offset + 1];
    if (segmentLength < 2 || offset + segmentLength > bytes.length) break;
    if (startOfFrameMarkers.has(marker) && segmentLength >= 7) {
      const height = (bytes[offset + 3] << 8) | bytes[offset + 4];
      const width = (bytes[offset + 5] << 8) | bytes[offset + 6];
      return width > 0 && height > 0 ? { width, height } : null;
    }
    offset += segmentLength;
  }
  return null;
};

const loadFallbackPdfImages = async (photos: Array<Record<string, unknown>>): Promise<{
  images: PdfImage[];
  captions: string[];
}> => {
  const eligible = photos.filter(isEligibleReportPhoto).slice(0, 24);
  const captions: string[] = [];
  const images: PdfImage[] = [];

  for (const photo of eligible) {
    const timing = photoTimingLabel(photo);
    const baseCaption = customerEvidenceCaption(photo.caption);
    const caption = timing ? `${timing}: ${baseCaption}` : baseCaption;
    captions.push(caption);

    const bucketId = asString(photo.bucket_id) || 'inspection-photos';
    const objectPath = asString(photo.object_path);
    if (!objectPath) continue;
    try {
      const { data, error } = await supabaseAdmin.storage.from(bucketId).download(objectPath);
      if (error || !data) continue;
      const bytes = new Uint8Array(await data.arrayBuffer());
      const dimensions = jpegDimensions(bytes);
      if (!dimensions) continue;
      images.push({
        bytes,
        width: dimensions.width,
        height: dimensions.height,
        caption,
      });
    } catch {
      // Caption still included even when the local image cannot be decoded.
    }
  }
  return { images, captions };
};

const buildPdfDocument = (pages: PdfPage[]): Uint8Array => {
  const encoder = new TextEncoder();
  const objects: Array<string | Uint8Array> = [];
  const pageObjectIds: number[] = [];
  let nextObjectId = 5;

  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  objects[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>';

  for (const page of pages) {
    const imageResources: string[] = [];
    const imageCommands: string[] = [];
    page.images.forEach((image, index) => {
      const imageName = `Im${index + 1}`;
      const imageObjectId = nextObjectId++;
      imageResources.push(`/${imageName} ${imageObjectId} 0 R`);

      const dictionary = encoder.encode(
        `<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} ` +
        `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.bytes.length} >>\nstream\n`,
      );
      objects[imageObjectId] = concatBytes([dictionary, image.bytes, encoder.encode('\nendstream')]);

      const scale = Math.min(image.boxWidth / image.width, image.boxHeight / image.height);
      const drawWidth = image.width * scale;
      const drawHeight = image.height * scale;
      const drawX = image.x + ((image.boxWidth - drawWidth) / 2);
      const drawY = image.y + ((image.boxHeight - drawHeight) / 2);
      imageCommands.push(
        `0.85 G ${image.x.toFixed(2)} ${image.y.toFixed(2)} ${image.boxWidth.toFixed(2)} ${image.boxHeight.toFixed(2)} re S`,
        `q ${drawWidth.toFixed(2)} 0 0 ${drawHeight.toFixed(2)} ${drawX.toFixed(2)} ${drawY.toFixed(2)} cm /${imageName} Do Q`,
      );
    });

    const textCommands = page.lines
      .map((line) => `BT /${line.font} ${line.size} Tf 1 0 0 1 ${line.x} ${line.y} Tm (${escapePdfText(line.text)}) Tj ET`)
      .join('\n');
    const contentStream = [textCommands, ...imageCommands].filter(Boolean).join('\n');

    const contentObjectId = nextObjectId++;
    const pageObjectId = nextObjectId++;
    const contentLength = encoder.encode(contentStream).length;

    objects[contentObjectId] = `<< /Length ${contentLength} >>\nstream\n${contentStream}\nendstream`;
    objects[pageObjectId] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ` +
      `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> ` +
      `${imageResources.length ? `/XObject << ${imageResources.join(' ')} >> ` : ''}>> ` +
      `/Contents ${contentObjectId} 0 R >>`;

    pageObjectIds.push(pageObjectId);
  }

  objects[2] = `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageObjectIds.length} >>`;

  const chunks: Uint8Array[] = [encoder.encode('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n')];
  const offsets: number[] = [0];
  let byteLength = chunks[0].length;

  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = byteLength;
    const body = typeof objects[id] === 'string' ? encoder.encode(objects[id] as string) : objects[id] as Uint8Array;
    const chunk = concatBytes([encoder.encode(`${id} 0 obj\n`), body, encoder.encode('\nendobj\n')]);
    chunks.push(chunk);
    byteLength += chunk.length;
  }

  const startXref = byteLength;
  let trailer = `xref\n0 ${objects.length}\n`;
  trailer += '0000000000 65535 f \n';
  for (let id = 1; id < objects.length; id += 1) {
    trailer += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  }
  trailer += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF`;
  chunks.push(encoder.encode(trailer));

  return concatBytes(chunks);
};

const buildLocalInspectionPdf = (params: {
  customerName: string;
  inspectedOn: string;
  technicianName: string;
  serviceAddress: string;
  workOrder: string;
  summary: string;
  serviceRecommendation: Record<string, unknown> | null;
  photos: PdfImage[];
  evidenceCaptions: string[];
  disclaimer: string;
  reportIdentifier: string;
  reportVersion: number;
  reviewedAt: string;
}) => {
  const pages: PdfPage[] = [];
  let current: PdfPage = { lines: [], images: [] };
  let y = 742;

  const startPage = (continued = false) => {
    current = { lines: [], images: [] };
    pages.push(current);
    y = 742;

    current.lines.push({ text: continued ? 'Customer Inspection Report (continued)' : 'Customer Inspection Report', x: 50, y, size: 18, font: 'F2' });
    y -= 24;

    current.lines.push({ text: 'The Vent Guys', x: 50, y, size: 11, font: 'F2' });
    y -= 16;
    current.lines.push({ text: `${BUSINESS_ADDRESS_LINE1} | ${BUSINESS_ADDRESS_LINE2}`, x: 50, y, size: 9, font: 'F1' });
    y -= 12;
    current.lines.push({ text: `${BUSINESS_PHONE_DISPLAY} | ${BUSINESS_EMAIL}`, x: 50, y, size: 9, font: 'F1' });
    y -= 18;
  };

  const pushLine = (text: string, font: PdfFontKey = 'F1', size = 10, indent = 0) => {
    const minY = 60;
    if (y < minY) startPage(true);
    current.lines.push({ text, x: 50 + indent, y, size, font });
    y -= size + 4;
  };

  startPage(false);
  pushLine(`Customer: ${params.customerName}`, 'F2', 11);
  pushLine(`Technician: ${params.technicianName}`, 'F1', 10);
  pushLine(`Inspected On: ${params.inspectedOn}`, 'F1', 10);
  if (params.workOrder) pushLine(`Work Order: ${params.workOrder}`, 'F1', 10);
  if (params.serviceAddress) pushLine(`Address: ${params.serviceAddress}`, 'F1', 10);
  pushLine(`Report: ${params.reportIdentifier} | Version ${params.reportVersion}`, 'F1', 10);
  if (params.reviewedAt) pushLine(`Reviewed: ${params.reviewedAt}`, 'F1', 10);
  y -= 6;

  if (params.summary) {
    pushLine('Findings', 'F2', 12);
    wrapText(params.summary, 92).forEach((line) => pushLine(line, 'F1', 10));
    y -= 6;
  }

  if (params.evidenceCaptions.length || params.photos.length) {
    if (y < 120) startPage(true);
    pushLine('Supporting Evidence', 'F2', 12);
    // Always list captions so evidence remains present even when JPEG decode fails locally.
    params.evidenceCaptions.forEach((caption) => {
      wrapText(`- ${caption}`, 92).forEach((line) => pushLine(line, 'F1', 10));
    });
    y -= 4;
  }

  if (params.serviceRecommendation) {
    if (y < 120) startPage(true);
    pushLine('Service Recommendation', 'F2', 12);
    const title = asString(params.serviceRecommendation.title) || 'Service Recommendation';
    const desc = asString(params.serviceRecommendation.description);
    pushLine(title, 'F2', 10);
    wrapText(desc, 92).slice(0, 10).forEach((line) => pushLine(line, 'F1', 10, 14));
    y -= 6;
  }

  if (y < 140) startPage(true);
  pushLine('Important Notes', 'F2', 12);
  wrapText(
    params.disclaimer ||
      'This Service Recommendation does not authorize work or establish final pricing. Proposed scope, authoritative pricing, and customer authorization are provided only in a separate estimate.',
    92,
  ).slice(0, 10).forEach((line) => pushLine(line, 'F1', 10));

  if (params.photos.length) {
    y -= 10;
    const firstPagePhotos = y >= 300 ? params.photos.slice(0, 2) : [];
    if (firstPagePhotos.length) {
      const boxWidth = 246;
      const boxHeight = 170;
      const imageY = y - boxHeight;
      firstPagePhotos.forEach((photo, index) => {
        const x = index === 0 ? 50 : 316;
        current.images.push({ ...photo, x, y: imageY, boxWidth, boxHeight });
        current.lines.push({ text: photo.caption.slice(0, 42), x, y: imageY - 16, size: 9, font: 'F1' });
      });
    }

    const remaining = params.photos.slice(firstPagePhotos.length);
    for (let offset = 0; offset < remaining.length; offset += 6) {
      current = { lines: [], images: [] };
      pages.push(current);
      current.lines.push({ text: 'Customer Inspection Report - Supporting Evidence', x: 50, y: 742, size: 16, font: 'F2' });
      current.lines.push({ text: 'The Vent Guys', x: 50, y: 718, size: 11, font: 'F2' });
      const pagePhotos = remaining.slice(offset, offset + 6);
      pagePhotos.forEach((photo, index) => {
        const column = index % 2;
        const row = Math.floor(index / 2);
        const x = column === 0 ? 50 : 316;
        const imageY = 518 - (row * 220);
        current.images.push({ ...photo, x, y: imageY, boxWidth: 246, boxHeight: 170 });
        current.lines.push({ text: photo.caption.slice(0, 42), x, y: imageY - 16, size: 9, font: 'F1' });
      });
    }
  }

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

    const [leadRes, jobRes, techRes, recRes, photosRes] = await Promise.all([
      inspection.lead_id
        ? supabaseAdmin.from('leads').select('*').eq('tenant_id', tenantId).eq('id', inspection.lead_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      inspection.job_id
        ? supabaseAdmin.from('jobs').select('*').eq('tenant_id', tenantId).eq('id', inspection.job_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      inspection.technician_id
        ? supabaseAdmin.from('technicians').select('*').eq('id', inspection.technician_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      supabaseAdmin
        .from('inspection_recommendations')
        .select('id, title, description, finding_id, is_customer_visible, created_at')
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
    const technician = techRes.data as Record<string, unknown> | null;
    const recommendations = (recRes.data || []) as Array<Record<string, unknown>>;
    const photos = (photosRes.data || []) as Array<Record<string, unknown>>;
    const serviceRecommendation = selectServiceRecommendation(recommendations);
    const eligiblePhotos = photos.filter(isEligibleReportPhoto);
    const inspectionRevision = Number.isFinite(Number((inspection as any).revision)) ? Number((inspection as any).revision) : 1;
    const { data: lastReport } = await supabaseAdmin.from('inspection_reports').select('report_version')
      .eq('tenant_id', tenantId).eq('inspection_id', inspectionId).eq('inspection_revision', inspectionRevision)
      .order('report_version', { ascending: false }).limit(1).maybeSingle();
    const nextVersion = Number(lastReport?.report_version || 0) + 1;
    const reportIdentifier = `INS-${inspectionId.slice(0, 8).toUpperCase()}-R${inspectionRevision}`;

    let rendererUsed: 'pdfshift' | 'local_pdf' = 'local_pdf';
    let pdfBytes: Uint8Array;
    let rendererError: string | null = null;

    try {
      const html = await buildInspectionHtml({
        tenantId,
        inspection,
        lead,
        job,
        technician,
        serviceRecommendation,
        photos: eligiblePhotos,
        reportVersion: nextVersion,
      });

      const pdfRes = await renderHtmlToPdfBytes({ html, filename: `inspection-${inspectionId}.pdf`, letter: true });
      if (!pdfRes.ok) {
        throw new Error(pdfRes.error);
      }
      rendererUsed = 'pdfshift';
      pdfBytes = pdfRes.bytes;
    } catch (err) {
      rendererError = err instanceof Error ? err.message : 'pdf_render_failed';
      // Local/dev fallback: generate a self-contained PDF with normalized JPEG evidence.
      const customerName =
        asString(lead?.company) ||
        [asString(lead?.first_name), asString(lead?.last_name)].filter(Boolean).join(' ') ||
        asString(lead?.email) ||
        'Customer';
      const workOrder = asString(job?.work_order_number) || asString(job?.job_number) || '';
      const serviceAddress = resolveServiceAddress(
        inspection as Record<string, unknown>,
        job as Record<string, unknown> | null,
        lead as Record<string, unknown> | null,
      );
      const inspectedOn = formatDate((inspection as any).completed_at || (inspection as any).started_at || (inspection as any).created_at);
      const techName = asString(technician?.full_name) || 'The Vent Guys Technician';
      const summary = asString((inspection as any).summary);
      const scopeLanguage = inspectionScopeLanguage(inspection as Record<string, unknown>);
      const disclaimer = asString((inspection as any).disclaimer_text) ||
        `${scopeLanguage.scope} ${scopeLanguage.exclusions} This Service Recommendation does not authorize work or establish final pricing. Proposed scope, authoritative pricing, and customer authorization are provided only in a separate estimate.`;

      const fallbackEvidence = await loadFallbackPdfImages(eligiblePhotos);
      pdfBytes = buildLocalInspectionPdf({
        customerName,
        inspectedOn,
        technicianName: techName,
        serviceAddress,
        workOrder,
        summary,
        serviceRecommendation,
        photos: fallbackEvidence.images,
        evidenceCaptions: fallbackEvidence.captions,
        disclaimer,
        reportIdentifier,
        reportVersion: nextVersion,
        reviewedAt: formatDate((inspection as any).reviewed_at),
      });
    }

    const filename = `inspection-${inspectionId}.pdf`;

    let reportRow: Record<string, unknown> | null = null;
    let storedFilePath: string | null = null;
    let storedFileHash: string | null = null;

    if (storeArtifact) {
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
            photos_count: eligiblePhotos.length,
            findings_narrative: Boolean(asString((inspection as any).summary)),
            service_recommendation_count: serviceRecommendation ? 1 : 0,
            premium_reference: '730-scott-before-condition-report',
            report_contract: 'phase_e_findings_plus_one_service_recommendation',
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
        findings_narrative: Boolean(asString((inspection as any).summary)),
        photos_count: eligiblePhotos.length,
        service_recommendation_count: serviceRecommendation ? 1 : 0,
        stored_file_path: storedFilePath,
        stored_file_hash: storedFileHash,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const code = message.startsWith('report_storage_upload_failed')
      ? 'REPORT_STORAGE_UPLOAD_FAILED'
      : message.startsWith('report_row_insert_failed')
        ? 'REPORT_RECORD_CREATE_FAILED'
        : 'REPORT_PDF_GENERATION_FAILED';
    return json({ error: message, code }, 500);
  }
});
