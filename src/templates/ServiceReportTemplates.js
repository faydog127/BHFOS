import { getBrandPayload, getCredentialRowHtml } from '../lib/brandConfig.js';
import { brandAssets, brandTagline } from '../lib/brandAssets.js';

// Template tokens for consistent sizing/colors (kept for future tweaks)
const tokens = {
  spacing: { s: 8, m: 16, l: 22, xl: 32 },
  radius: { card: 14, section: 10, pill: 24 },
  type: {
    h1: { size: 22, weight: 800 },
    h2: { size: 18, weight: 800 },
    h3: { size: 16, weight: 700 },
    body: { size: 14, weight: 400 },
    small: { size: 12, weight: 600 },
  },
};

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const toArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return [value];
};

const clampList = (list, maxItems = 8) => {
  const trimmed = list.slice(0, maxItems);
  const overflow = list.slice(maxItems);
  return { trimmed, overflow };
};

const normalizeText = (value) => escapeHtml((value || '').toString().trim());

const normalizeList = (value, maxItems = 8) => {
  const raw = toArray(value)
    .map((v) => normalizeText(v))
    .filter(Boolean);
  const { trimmed, overflow } = clampList(raw, maxItems);
  return { trimmed, overflow };
};

const formatDate = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return normalizeText(value);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

// Convert a local file path to a file:// URL (works for Puppeteer)
const toFileUrl = (path) => {
  if (!path) return '';
  const normalized = path.replace(/\\/g, '/');
  return `file:///${encodeURI(normalized)}`;
};

// Allowlist URL sanitizer for image/src fields
const sanitizeUrl = (value) => {
  if (!value) return '';
  const raw = String(value).trim();
  const lower = raw.toLowerCase().replace(/\s/g, '');
  const isHttp = lower.startsWith('https://') || lower.startsWith('http://');
  const isDataImage = lower.startsWith('data:image/');
  if (!isHttp && !isDataImage) return '';
  return escapeHtml(raw);
};

// Normalize payload (kept contract)
const normalizePayload = (payload = {}) => {
  const brand = {
    ...getBrandPayload(payload.brandContext),
    tagline: payload.tagline || brandTagline,
  };

  const palette = {
    primary: brand.primary_color || '#091e39',
    accent: brand.accent_color || '#b52025',
    warning: '#fcd34d',
    danger: '#b52025',
    text: brand.text_color || '#231f20',
    border: '#e2e8f0',
    muted: '#5b6470',
  };

  const summary = normalizeList(payload.summary || payload.summaryText || '', 8);
  const findingsBefore = normalizeList(payload.findingsBefore, 8);
  const findingsAfter = normalizeList(payload.findingsAfter, 8);
  const improvements = normalizeList(payload.keyImprovements, 8);
  const recommendations = normalizeList(payload.recommendations, 8);
  const remainingConcerns = normalizeList(payload.remainingConcerns, 4);
  const alerts = normalizeList(payload.criticalRisk, 3);
  const notes = normalizeList(payload.technicianNotes, 6);

  const beforePhotos = toArray(payload.beforePhotos).map(sanitizeUrl);
  const afterPhotos = toArray(payload.afterPhotos).map(sanitizeUrl);

  const photoSlots = [
    { label: 'Before', url: beforePhotos[0] },
    { label: 'After', url: afterPhotos[0] },
    { label: 'Before', url: beforePhotos[1] },
    { label: 'After', url: afterPhotos[1] },
  ];

  const disclaimer =
    payload.disclaimer ||
    'This report reflects the conditions observed at the time of service and is limited to the areas and systems described. Hidden or inaccessible conditions are outside the scope of this report.';

  return {
    brand: {
      ...brand,
      company_name: normalizeText(brand.company_name || 'The Vent Guys'),
      company_url: normalizeText(brand.company_url || 'vent-guys.com'),
      address_line: normalizeText(brand.address_line || 'Serving Florida'),
      phone: normalizeText(brand.phone || payload.phone || '(321) 360-9704'),
      tagline: normalizeText(brand.tagline || 'We clear what others miss'),
    },
    palette,
    headerLogo: sanitizeUrl(
      payload.logoUrl ||
        brand.logo_url ||
        brandAssets?.logo?.main ||
        'https://wwyxohjnyqnegzbxtuxs.supabase.co/storage/v1/object/public/vent-guys-images/Logo_noBG.png'
    ),
    customerName: normalizeText(payload.customerName || 'Customer'),
    serviceAddress: normalizeText(payload.serviceAddress || 'Service Address'),
    serviceDate: formatDate(payload.serviceDate) || formatDate(new Date()),
    technicianName: normalizeText(payload.technicianName || 'Technician'),
    workOrder: normalizeText(payload.workOrder || ''),
    primaryConcern: normalizeText(payload.primaryConcern || '—'),
    serviceType: normalizeText(payload.serviceType || 'Dryer Vent & Duct Cleaning'),
    technicianSignoff: normalizeText(
      payload.technicianSignoff ||
        'Service completed as described. Customer advised of findings and recommendations.'
    ),
    summary,
    findingsBefore,
    findingsAfter,
    improvements,
    recommendations,
    remainingConcerns,
    alerts,
    notes,
    photoSlots,
    disclaimer: normalizeText(disclaimer),
    templateVersion: '1.0.2',
    reportId: normalizeText(payload.reportId || ''),
    generatedAt: new Date().toISOString(),
  };
};

// Helpers for rendering text (no fabricated claims)
const renderParagraphs = (items) => {
  if (!items || items.length === 0) return '<p style="margin:0;color:#5b6470;">None recorded.</p>';
  return items.map((line) => `<p style="margin:0 0 12px 0;">${line}</p>`).join('');
};

const renderBullets = (items) => {
  if (!items || items.length === 0) return '<p style="margin:0;color:#5b6470;">None recorded.</p>';
  return `<ul class="bullets">${items.map((item) => `<li>${item}</li>`).join('')}</ul>`;
};

// Minimal helper used by letter template
const renderList = (items, color = '#0f172a') => {
  const arr = toArray(items);
  if (arr.length === 0) return '';
  return `
    <ul style="margin:0;padding-left:18px;color:${color};font-size:${tokens.type.body.size}px;line-height:1.6;">
      ${arr.map((item) => `<li style="margin-bottom:8px;">${escapeHtml(item)}</li>`).join('')}
    </ul>
  `;
};

export const generateServiceReportHtml = (payload = {}) => {
  const model = normalizePayload(payload);
  const { palette, brand } = model;
  const summaryOverflow = model.summary.overflow || [];

  const hasCriticalRisk = model.alerts.trimmed.length > 0;
  const hasFindingsBefore = model.findingsBefore.trimmed.length > 0;
  const hasRemainingConcerns = model.remainingConcerns.trimmed.length > 0;
  const hasTechnicianNotes = model.notes.trimmed.length > 0;

  const needsPageBreak1 = hasCriticalRisk || hasFindingsBefore;
  const needsPageBreak2 = hasTechnicianNotes || model.photoSlots.some((s) => s.url);

  const criticalRiskBlock = hasCriticalRisk
    ? `
    <section class="section avoid-break">
      <div class="pill danger">
        <div class="pill-title">Critical Risk / Code</div>
        <div class="pill-body">${renderParagraphs(model.alerts.trimmed)}</div>
      </div>
      <div class="divider"></div>
    </section>`
    : '';

  const findingsBeforeBlock = hasFindingsBefore
    ? `
    <section class="section">
      <div class="section-title">Findings (Before)</div>
      <div class="section-body">${renderBullets(model.findingsBefore.trimmed)}</div>
    </section>`
    : '';

  const remainingConcernsBlock = hasRemainingConcerns
    ? `
    <section class="section avoid-break">
      <div class="pill warning">
        <div class="pill-title">Remaining Concerns</div>
        <div class="pill-body">${renderBullets(model.remainingConcerns.trimmed)}</div>
      </div>
      <div class="divider"></div>
    </section>`
    : '';

  const technicianNotesBlock = hasTechnicianNotes
    ? `
    <section class="section">
      <div class="section-title">Technician Notes</div>
      <div class="section-body">${renderParagraphs(model.notes.trimmed)}</div>
    </section>`
    : '';

  const hasOverflow =
    summaryOverflow.length ||
    model.findingsAfter.overflow.length ||
    model.findingsBefore.overflow.length ||
    model.improvements.overflow.length ||
    model.recommendations.overflow.length ||
    model.remainingConcerns.overflow.length ||
    model.alerts.overflow.length ||
    model.notes.overflow.length;

  const additionalNotesBlock = hasOverflow
    ? `
    <section class="section">
      <div class="section-title">Additional Notes</div>
      <div class="section-body">${renderParagraphs([
        ...summaryOverflow,
        ...model.findingsAfter.overflow,
        ...model.findingsBefore.overflow,
        ...model.improvements.overflow,
        ...model.recommendations.overflow,
        ...model.remainingConcerns.overflow,
        ...model.alerts.overflow,
        ...model.notes.overflow,
      ])}</div>
    </section>`
    : '';

  const photoGridHtml = model.photoSlots
    .map((slot, idx) => {
      const imgTag = slot.url
        ? `<img class="photo-img" src="${slot.url}" alt="${normalizeText(slot.label)} photo ${idx + 1}" loading="eager" />`
        : '';
      const placeholderTag = `<div class="photo-placeholder">No photo provided</div>`;
      return `
      <div class="photo-card">
        <div class="photo-badge">${normalizeText(slot.label)}</div>
        ${placeholderTag}
        ${imgTag}
      </div>`;
    })
    .join('');

  // Background assets (default to provided Canva PNGs)
  const pageBackgrounds =
    payload.pageBackgrounds && payload.pageBackgrounds.length >= 2
      ? payload.pageBackgrounds.map((p) => sanitizeUrl(p))
      : [
          toFileUrl('C:/BHFOS/TVG-Report Template_pg1.png'),
          toFileUrl('C:/BHFOS/TVG-Report Template_pg2.png'),
        ];

  return `
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${model.serviceType} Service Report</title>
  <style>
    @page { size: Letter; margin: 0; }
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; box-sizing: border-box; }
    body { margin: 0; padding: 0; background: #fff; font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif; }
    .page {
      position: relative;
      width: 8.5in;
      height: 11in;
      margin: 0 auto;
      background-size: cover;
      background-position: top center;
      page-break-after: always;
      overflow: hidden;
    }
    .page:last-child { page-break-after: auto; }
    .field {
      position: absolute;
      color: #0f172a;
      font-size: 15px;
      line-height: 1.6;
      white-space: pre-wrap;
    }
    .field.bullets ul { margin: 0; padding-left: 18px; }
    .field.bullets li { margin-bottom: 6px; }
    .pill-text { color: #0f172a; }
    .pill-text.danger { color: #fff; }
    .field.continuation { white-space: pre-wrap; }
    /* Photo overlays */
    .photo-slot {
      position: absolute;
      overflow: hidden;
      border-radius: 18px;
    }
    .photo-slot img {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
      z-index: 1;
    }
    .photo-slot .placeholder {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: flex-end;
      justify-content: center;
      padding: 12px;
      color: rgba(255,255,255,0.88);
      font-weight: 800;
      font-size: 12px;
      text-align: center;
      background: linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.25) 100%);
      z-index: 0;
    }
  </style>
</head>
<body>
  ${(() => {
    // Page 1 (anchor/meta): summary + critical risk + optional findingsBefore
    const page1Html = `
      <div class="page" style="background-image:url('${pageBackgrounds[0]}');">
        <div class="field" style="top:20%; left:8%; width:40%;">
          <div><strong>Customer:</strong> ${model.customerName}</div>
          <div><strong>Address:</strong> ${model.serviceAddress}</div>
          <div><strong>Primary Concern:</strong> ${model.primaryConcern}</div>
        </div>
        <div class="field" style="top:20%; left:55%; width:37%;">
          <div><strong>Service:</strong> ${model.serviceType}</div>
          <div><strong>Visit Date:</strong> ${model.serviceDate}</div>
          <div><strong>Technician:</strong> ${model.technicianName}</div>
          ${model.workOrder ? `<div><strong>Work Order #:</strong> ${model.workOrder}</div>` : ''}
        </div>

        <div class="field" style="top:42%; left:8%; width:84%;">${renderParagraphs(model.summary.trimmed)}</div>
        ${
          model.alerts.trimmed.length
            ? `<div class="field pill-text danger" style="top:56%; left:8%; width:84%;">${renderParagraphs(model.alerts.trimmed)}</div>`
            : ``
        }
        ${
          model.findingsBefore.trimmed.length
            ? `<div class="field" style="top:68%; left:8%; width:84%;">${renderParagraphs(model.findingsBefore.trimmed)}</div>`
            : ``
        }
      </div>
    `;

    // Page 2 base (after/improvements/concerns/recs/notes)
    const page2Html = `
      <div class="page" style="background-image:url('${pageBackgrounds[1]}');">
        <div class="field" style="top:18%; left:8%; width:84%;">${renderParagraphs(model.findingsAfter.trimmed)}</div>
        <div class="field" style="top:40%; left:8%; width:84%;">${renderParagraphs(model.improvements.trimmed)}</div>
        <div class="field" style="top:58%; left:8%; width:84%; color:#231f20;">${renderParagraphs(model.remainingConcerns.trimmed)}</div>
        <div class="field" style="top:74%; left:8%; width:84%;">${renderParagraphs(model.recommendations.trimmed)}</div>
        ${
          model.notes.trimmed.length
            ? `<div class="field" style="top:86%; left:8%; width:84%;">${renderParagraphs(model.notes.trimmed)}</div>`
            : ``
        }
      </div>
    `;

    // Overflow routing into continuation pg2 pages (simple combine)
    const remainingBlocks = [];
    if (model.summary.overflow.length)
      remainingBlocks.push({ title: 'Summary (Continued)', lines: model.summary.overflow });
    if (model.findingsBefore.overflow.length)
      remainingBlocks.push({ title: 'Findings (Before)', lines: model.findingsBefore.overflow });
    if (model.findingsAfter.overflow.length)
      remainingBlocks.push({ title: 'Findings (After / Post-Visit)', lines: model.findingsAfter.overflow });
    if (model.improvements.overflow.length)
      remainingBlocks.push({ title: 'Key Improvements', lines: model.improvements.overflow });
    if (model.remainingConcerns.overflow.length)
      remainingBlocks.push({ title: 'Remaining Concerns', lines: model.remainingConcerns.overflow });
    if (model.recommendations.overflow.length)
      remainingBlocks.push({ title: 'Recommendations', lines: model.recommendations.overflow });
    if (model.notes.overflow.length)
      remainingBlocks.push({ title: 'Technician Notes', lines: model.notes.overflow });

    const chunkText = (blocks, maxChars = 1400) => {
      const chunks = [];
      let buf = '';
      for (const b of blocks) {
        const section = `${b.title}\n${b.lines.join('\n')}\n\n`;
        if (buf.length && (buf + section).length > maxChars) {
          chunks.push(buf.trim());
          buf = section;
        } else {
          buf += section;
        }
      }
      if (buf.trim()) chunks.push(buf.trim());
      return chunks;
    };

    const renderContinuationText = (text) => `
      <div class="page" style="background-image:url('${pageBackgrounds[1]}');">
        <div class="field continuation" style="top:18%; left:8%; width:84%;">${escapeHtml(text)}</div>
      </div>
    `;

    const pages = [page1Html, page2Html];
    if (remainingBlocks.length) {
      const chunks = chunkText(remainingBlocks, 1400);
      chunks.forEach((chunk) => pages.push(renderContinuationText(chunk)));
    }

    return pages.join('');
  })()}
</body>
</html>
  `;
};

// Branded letter (unchanged except using helpers here)
export const generateBrandedLetterHtml = (payload = {}) => {
  const brand = {
    ...getBrandPayload(payload.brandContext),
    tagline: payload.tagline || brandTagline,
  };

  const palette = {
    primary: brand.primary_color || '#1f2937',
    accent: brand.accent_color || '#fbbf24',
    text: brand.text_color || '#0f172a',
    muted: '#475569',
    border: '#e2e8f0',
  };

  const headerLogo =
    payload.logoUrl ||
    brand.logo_url ||
    brandAssets?.logo?.main ||
    'https://wwyxohjnyqnegzbxtuxs.supabase.co/storage/v1/object/public/vent-guys-images/Logo_noBG.png';

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${payload.subject || 'Correspondence'}</title>
      </head>
      <body style="margin:0;padding:0;font-family:'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;background:#f4f6fb;">
        <div style="max-width:720px;margin:20px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 16px 32px rgba(0,0,0,0.05);">
          <div style="padding:22px 24px;border-bottom:4px solid ${palette.primary};display:flex;align-items:center;gap:14px;flex-wrap:wrap;">
            <div style="width:110px;min-width:110px;">
              <img src="${escapeHtml(headerLogo)}" alt="${escapeHtml(brand.company_name || '')}" style="max-width:100%;height:auto;display:block;" />
            </div>
            <div>
              <div style="font-size:20px;color:${palette.primary};font-weight:800;">${escapeHtml(brand.company_name || 'The Vent Guys')}</div>
              <div style="color:${palette.accent};font-weight:600;margin-top:4px;font-size:14px;">${escapeHtml(brand.tagline || '')}</div>
            </div>
          </div>

          <div style="padding:26px 24px;color:${palette.text};">
            <div style="font-size:14px;color:${palette.muted};margin-bottom:18px;">${escapeHtml(payload.date || new Date().toLocaleDateString())}</div>
            <div style="font-size:15px;line-height:1.7;">
              <p style="margin:0 0 14px 0;">${escapeHtml(payload.salutation || 'Hello')}</p>
              ${renderParagraphs(toArray(payload.body).map(escapeHtml))}
              ${renderList(payload.bullets, palette.text)}
              <p style="margin:18px 0 0 0;">${escapeHtml(payload.closing || 'Thank you,')}</p>
              <p style="margin:6px 0 0 0;font-weight:700;">${escapeHtml(payload.signatureName || brand.company_name || 'The Vent Guys Team')}</p>
            </div>

            ${payload.ctaText && payload.ctaLink ? `
              <div style="margin-top:24px;">
                <a href="${escapeHtml(payload.ctaLink)}" style="background:${palette.primary};color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:700;display:inline-block;">${escapeHtml(payload.ctaText)}</a>
              </div>` : ''}
          </div>

          ${getCredentialRowHtml(brand)}
        </div>
      </body>
    </html>
  `;
};
