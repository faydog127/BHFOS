import {
  AI_FIELDS,
  DEFAULT_REPORT_MODEL,
  HTML_FIELD_IDS,
  IDENTITY_FIELDS,
  PHOTO_FIELDS,
  REPORT_CONTROL,
  slabHasContent,
} from './ReportSchema.js';

const DEFAULT_BACKGROUNDS = [
  'C:/BHFOS/Reports/Template_pg1.png',
  'C:/BHFOS/Reports/Template_pg2.png',
];

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const toArray = (value) => {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) return value;
  return [value];
};

const toLines = (value) =>
  toArray(value)
    .map((v) => String(v || '').trim())
    .filter(Boolean);

const toFileUrl = (path) => {
  if (!path) return '';
  const normalized = path.replace(/\\/g, '/');
  if (
    normalized.startsWith('file://') ||
    normalized.startsWith('http') ||
    normalized.startsWith('data:')
  ) {
    return normalized;
  }
  return `file:///${normalized}`;
};

const sanitizeUrl = (value) => {
  if (!value) return '';
  const raw = String(value).trim();
  const lower = raw.toLowerCase();
  if (
    lower.startsWith('http://') ||
    lower.startsWith('https://') ||
    lower.startsWith('data:image/') ||
    lower.startsWith('file://')
  ) {
    return raw;
  }
  return '';
};

const renderMixed = (items) => {
  const lines = toLines(items);
  if (!lines.length) return '<p class="muted">None recorded.</p>';

  const bullets = [];
  const paras = [];

  lines.forEach((line) => {
    const s = line.trim();
    if (s.startsWith('- ') || s.startsWith('• ')) {
      bullets.push(escapeHtml(s.replace(/^(- |• )/, '')));
    } else {
      paras.push(escapeHtml(s));
    }
  });

  const pHtml = paras.map((t) => `<p style="margin:0 0 10px 0;">${t}</p>`).join('');
  const bHtml = bullets.length
    ? `<ul class="bullets">${bullets.map((b) => `<li>${b}</li>`).join('')}</ul>`
    : '';

  return pHtml + bHtml;
};

const renderAddress = (line1, line2) => {
  const l1 = escapeHtml(line1 || '');
  const l2 = String(line2 || '').trim();
  if (l2) {
    return `${l1}<br/>${escapeHtml(l2)}`;
  }
  return l1;
};

const normalizeModel = (payload = {}) => {
  const model = { ...DEFAULT_REPORT_MODEL, ...payload };

  const backgrounds = model[REPORT_CONTROL.pageBackgrounds];
  const bgList =
    Array.isArray(backgrounds) && backgrounds.length >= 2 ? backgrounds : DEFAULT_BACKGROUNDS;

  const continuedText = toLines(payload.continuedText || payload.pC_continuedText || []);

  // photos: prefer selectedEvidence then photos
  const photos = toArray(model[PHOTO_FIELDS.selectedEvidence]).filter(Boolean);
  const fallbacks = toArray(model[PHOTO_FIELDS.photos]).filter(Boolean);
  const photoPool = photos.length ? photos : fallbacks;
  const photoSlots = Array.from({ length: 4 }).map((_, idx) => {
    const item = photoPool[idx] || {};
    return {
      url: sanitizeUrl(item.url || item.path || ''),
      caption: escapeHtml(item.caption || item.note || ''),
      tag: escapeHtml(item.tag || item.label || ''),
    };
  });

  return {
    reportTitle: escapeHtml(model[REPORT_CONTROL.reportTitle] || 'Post-Service Findings Report'),
    debug: Boolean(model[REPORT_CONTROL.debug]),
    pageBackgrounds: bgList.map(toFileUrl),

    identity: {
      customerName: escapeHtml(model[IDENTITY_FIELDS.customerName] || ''),
      customerPhone: escapeHtml(model[IDENTITY_FIELDS.customerPhone] || ''),
      serviceAddressLine1: escapeHtml(model[IDENTITY_FIELDS.serviceAddressLine1] || ''),
      serviceAddressLine2: escapeHtml(model[IDENTITY_FIELDS.serviceAddressLine2] || ''),
      primaryConcern: escapeHtml(model[IDENTITY_FIELDS.primaryConcern] || ''),
      serviceType: escapeHtml(model[IDENTITY_FIELDS.serviceType] || ''),
      serviceDate: escapeHtml(model[IDENTITY_FIELDS.serviceDate] || ''),
      technicianName: escapeHtml(model[IDENTITY_FIELDS.technicianName] || ''),
      workOrder: escapeHtml(model[IDENTITY_FIELDS.workOrder] || ''),
    },

    narrative: {
      execSummary: toLines(model[AI_FIELDS.execSummary]),
      criticalRisk: toLines(model[AI_FIELDS.criticalRisk]),
      findingsBefore: toLines(model[AI_FIELDS.findingsBefore]),
      findingsAfter: toLines(model[AI_FIELDS.findingsAfter]),
      rootCause: toLines(model[AI_FIELDS.rootCause]),
      recommendations: toLines(model[AI_FIELDS.recommendations]),
      technicianNotes: toLines(model[AI_FIELDS.technicianNotes]),
    },

    continuedText,
    photoSlots,
  };
};

const renderTitle = (id, text) => `
  <div class="field title" id="${id}" style="top:3.2%; left:55%; width:37%; height:6%;">
    <div class="title-text">${text}</div>
  </div>
`;

const renderMetaBlock = (model) => {
  const addrHtml = renderAddress(model.identity.serviceAddressLine1, model.identity.serviceAddressLine2);
  const orDash = (value) => (value ? value : '—');

  const left = `
    <div class="field meta" id="${HTML_FIELD_IDS.meta.left}" style="top:13%; left:7%; width:40%; height:18%;">
      <div class="meta-row" id="p1_customerName"><strong>Customer:</strong> ${model.identity.customerName}</div>
      <div class="meta-row" id="p1_customerPhone"><strong>Phone:</strong> ${orDash(model.identity.customerPhone)}</div>
      <div class="meta-row" id="p1_serviceAddress"><strong>Service Address:</strong><br/>${addrHtml}</div>
      <div class="meta-row" id="p1_primaryConcern"><strong>Primary Concern:</strong> ${orDash(model.identity.primaryConcern)}</div>
    </div>
  `;

  const workOrderRow = model.identity.workOrder
    ? `<div class="meta-row" id="p1_workOrder"><strong>Work Order #:</strong> ${model.identity.workOrder}</div>`
    : '';

  const right = `
    <div class="field meta" id="${HTML_FIELD_IDS.meta.right}" style="top:13%; left:55%; width:37%; height:18%;">
      <div class="meta-row" id="p1_serviceType"><strong>Service:</strong> ${model.identity.serviceType}</div>
      <div class="meta-row" id="p1_serviceDate"><strong>Visit Date:</strong> ${orDash(model.identity.serviceDate)}</div>
      <div class="meta-row" id="p1_technicianName"><strong>Technician:</strong> ${orDash(model.identity.technicianName)}</div>
      ${workOrderRow}
    </div>
  `;

  return left + right;
};

const renderSlab = ({ id, label, content, style = '', optional = false, pill = false }) => {
  if (optional && !slabHasContent(content)) return '';

  const pillClass = pill ? ' pill' : '';
  return `
    <div class="field section${pillClass}" id="${id}" style="${style}">
      <div class="label">${label}</div>
      <div class="content">${renderMixed(content)}</div>
    </div>
  `;
};

const defaultPhotoCaptions = [
  'Shared exhaust wye connection (cross-flow point)',
  'Rigid metal exhaust run (clean, short run)',
  'Dryer branch / damper (no obstruction observed)',
  'Termination / exterior area (clear airflow path)',
];

const renderPhotoGrid = (photoSlots) => {
  const hasPhotos = photoSlots.some((p) => p.url);
  if (!hasPhotos) return '';

  const slots = photoSlots
    .map((p, idx) => {
      const caption = p.caption || defaultPhotoCaptions[idx] || '';
      const tagText = p.tag ? ` • ${p.tag}` : '';
      return `
        <div class="photo-slot" id="${HTML_FIELD_IDS.cont.photoSlots[idx]}">
          ${
            p.url
              ? `<img src="${p.url}" alt="${caption || 'Photo'}" />`
              : '<div class="placeholder">Photo</div>'
          }
          ${
            caption || tagText
              ? `<div class="photo-caption">${escapeHtml(caption)}${escapeHtml(tagText)}</div>`
              : ''
          }
        </div>
      `;
    })
    .join('');

  return `
    <div class="field photos inline" style="top:82%; left:8%; width:84%; height:14%;">
      <div class="photos-grid">
        ${slots}
      </div>
    </div>
  `;
};

const renderContinuation = (model) => {
  const hasText = slabHasContent(model.continuedText);
  if (!hasText) return '';

  const photos = model.photoSlots
    .map(
      (p, idx) => `
        <div class="photo-slot" id="${HTML_FIELD_IDS.cont.photoSlots[idx]}">
          ${
            p.url
              ? `<img src="${p.url}" alt="${p.caption || 'Photo'}" />`
              : '<div class="placeholder">Photo</div>'
          }
          ${
            p.caption || p.tag
              ? `<div class="photo-caption">${p.caption || ''}${p.tag ? ` • ${p.tag}` : ''}</div>`
              : ''
          }
        </div>
      `
    )
    .join('');

  return `
    <div class="page" style="background-image:url('${model.pageBackgrounds[1]}');">
      ${renderTitle(HTML_FIELD_IDS.title.cont, model.reportTitle)}
      <div class="field" id="${HTML_FIELD_IDS.cont.continuedText}" style="top:18%; left:8%; width:84%; height:42%;">
        ${renderMixed(model.continuedText)}
      </div>
    </div>
  `;
};

export const buildSchemaReportHtml = (payload = {}) => {
  const model = normalizeModel(payload);
  const debug = model.debug ? 'debug' : '';

  const page1 = `
    <div class="page" style="background-image:url('${model.pageBackgrounds[0]}');">
      ${renderTitle(HTML_FIELD_IDS.title.p1, model.reportTitle)}
      ${renderMetaBlock(model)}
      ${renderSlab({
        id: HTML_FIELD_IDS.p1.execSummary,
        label: 'Executive Summary',
        content: model.narrative.execSummary,
        style: 'top:29%; left:7%; width:86%; height:22%;',
      })}
      ${renderSlab({
        id: HTML_FIELD_IDS.p1.criticalRisk,
        label: 'Critical Risk / Code Concern',
        content: model.narrative.criticalRisk,
        style: 'top:52%; left:7%; width:86%; height:11%;',
        optional: true,
        pill: true,
      })}
      ${renderSlab({
        id: HTML_FIELD_IDS.p1.findingsBefore,
        label: 'Findings (Before Service)',
        content: model.narrative.findingsBefore,
        style: 'top:65%; left:7%; width:86%; height:18%;',
        optional: true,
      })}
    </div>
  `;

  const page2 = `
    <div class="page" style="background-image:url('${model.pageBackgrounds[1]}');">
      ${renderTitle(HTML_FIELD_IDS.title.p2, model.reportTitle)}
      ${renderSlab({
        id: HTML_FIELD_IDS.p2.findingsAfter,
        label: 'Findings (After / Post-Visit)',
        content: model.narrative.findingsAfter,
        style: 'top:12%; left:8%; width:84%; height:18%;',
      })}
      ${renderSlab({
        id: HTML_FIELD_IDS.p2.rootCause,
        label: 'Root Cause',
        content: model.narrative.rootCause,
        style: 'top:34%; left:8%; width:84%; height:14%;',
      })}
      ${renderSlab({
        id: HTML_FIELD_IDS.p2.recommendations,
        label: 'Recommendations',
        content: model.narrative.recommendations,
        style: 'top:52%; left:8%; width:84%; height:14%;',
      })}
      ${renderSlab({
        id: HTML_FIELD_IDS.p2.technicianNotes,
        label: 'Technician Notes',
        content: model.narrative.technicianNotes,
        style: 'top:68%; left:8%; width:84%; height:12%;',
        optional: true,
      })}
      ${renderPhotoGrid(model.photoSlots)}
    </div>
  `;

  const continuation = renderContinuation(model);

  return `
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${model.reportTitle}</title>
  <style>
    @page { size: 8.5in 11in; margin: 0; }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
      color: #0f172a;
    }
    .page {
      position: relative;
      width: 8.5in;
      height: 11in;
      margin: 0 auto;
      background-repeat: no-repeat;
      background-position: top left;
      background-size: 100% 100%;
      page-break-after: always;
      overflow: hidden;
    }
    .page:last-child { page-break-after: auto; }
    .field {
      position: absolute;
      padding: 6px 8px;
      font-size: 14px;
      line-height: 1.55;
      overflow: hidden;
      white-space: pre-wrap;
    }
    .field .label {
      font-weight: 800;
      font-size: 15px;
      margin-bottom: 6px;
      letter-spacing: 0.01em;
      color: #0f172a;
    }
    .field .content { font-size: 14px; }
    .field.title { display: flex; align-items: center; text-align: right; justify-content: flex-end; }
    .field.title .title-text {
      font-weight: 900;
      font-size: 26px;
      line-height: 1.05;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #0f172a;
    }
    .section.pill {
      background: rgba(181, 32, 37, 0.96);
      color: #ffffff;
      border-radius: 12px;
      padding: 10px 12px;
    }
    .section.pill .label { color: #ffffff; }
    .section.pill .content p,
    .section.pill ul { color: #ffffff; }
    .bullets ul { margin: 0; padding-left: 18px; }
    .bullets li { margin-bottom: 6px; }
    p { margin: 0 0 10px 0; }
    .muted { color: #5b6470; }
    .meta { line-height: 1.35; padding: 6px 8px 4px 8px; }
    .meta-row { margin-bottom: 6px; }
    .meta-row strong { font-weight: 700; }
    .debug .field { outline: 2px dashed rgba(255, 0, 0, 0.45); background: rgba(255, 255, 0, 0.08); }
    /* Photos */
    .photos { padding: 0; }
    .photos.inline { padding: 0; }
    .photos-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      grid-auto-rows: 1fr;
      gap: 10px;
      width: 100%;
      height: 100%;
    }
    .photo-slot {
      position: relative;
      border-radius: 12px;
      overflow: hidden;
      background: #f1f5f9;
      border: 1px dashed #cbd5e1;
    }
    .photo-slot img {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .photo-slot .placeholder {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      color: #94a3b8;
    }
    .photo-caption {
      position: absolute;
      inset: auto 0 0 0;
      padding: 8px 10px;
      background: linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.55) 100%);
      color: #ffffff;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.01em;
    }
  </style>
</head>
<body class="${debug}">
  ${page1}
  ${page2}
  ${continuation}
</body>
</html>
  `;
};

// Sample payload for Chris (schema-friendly)
export const getChrisSampleSchemaPayload = () => ({
  [REPORT_CONTROL.reportTitle]: 'Post-Service Report',
  [IDENTITY_FIELDS.customerName]: 'Chris Adams',
  [IDENTITY_FIELDS.customerPhone]: '(336) 557-6150',
  [IDENTITY_FIELDS.serviceAddressLine1]: 'SPRINGHILL SUITES WEST MELBOURNE',
  [IDENTITY_FIELDS.serviceAddressLine2]: '4446 Hollywood Blvd, Melbourne FL 32904',
  [IDENTITY_FIELDS.primaryConcern]:
    'Large-capacity commercial dryer intermittently faulting, under-drying, and experiencing airflow-related shutdowns despite clean venting.',
  [IDENTITY_FIELDS.serviceType]: 'Commercial Dryer Vent Inspection & Post-Service Assessment',
  [IDENTITY_FIELDS.serviceDate]: 'Dec 30, 2025',
  [IDENTITY_FIELDS.technicianName]: 'Erron Fayson',
  [IDENTITY_FIELDS.workOrder]: '',

  [AI_FIELDS.execSummary]: [
    'Performed a post-service site inspection after repeated airflow-related faults and poor drying on the large-capacity commercial dryer. Venting is rigid metal, clean, and has a short overall run with no obstructions observed at termination or in accessible sections.',
    'Both dryers discharge into a shared exhaust via a wye fitting. During operation this layout allows pressure from one unit to push into the other branch, creating backpressure and cross-flow that interferes with exhaust performance—most noticeably on the higher-capacity unit.',
    'Observed behavior matches an exhaust design fault, not a maintenance or mechanical failure. Documented findings to prevent repeat service calls aimed at “cleaning” an exhaust that is already clear.',
  ],
  [AI_FIELDS.criticalRisk]: [
    'Two commercial dryers are connected to a shared exhaust system using a wye fitting. This configuration allows cross-flow and pressure instability and is not compatible with high-capacity commercial dryers.',
    'Shared exhaust systems can cause dryers to recirculate exhaust air into adjacent branches, leading to safety shutdowns, overheating risks, inefficient drying, and long-term equipment stress. Manufacturer guidance and best practices require dedicated exhaust runs per dryer to ensure safe and stable operation.',
  ],
  [AI_FIELDS.findingsBefore]: [
    '- Repeated airflow-related faults reported on large-capacity dryer',
    '- Dryer under-drying loads and intermittently limiting heat output',
    '- No visible lint blockage at termination or within accessible duct sections',
    '- Venting appeared clean at time of inspection',
  ],
  [AI_FIELDS.findingsAfter]: [
    '- Exhaust ducting verified clean and unobstructed',
    '- Rigid metal duct used throughout with short overall run length',
    '- Internal airflow damper observed operating as designed',
    '- No mechanical failure identified within the dryer itself',
    'The larger dryer continues to experience airflow instability when operating due to interaction with the shared exhaust system. Exhaust air from the larger unit is capable of pressurizing the shared duct and flowing toward the adjacent dryer branch, creating unstable pressure conditions that trigger dryer safety logic. This is consistent with the design fault, not a cleanliness or mechanical issue.',
  ],
  [AI_FIELDS.rootCause]: [
    'Both dryers are tied into a shared exhaust with a wye, which creates backpressure and cross-flow between branches. The larger unit pressurizes the common duct and pushes exhaust toward the smaller branch, triggering airflow instability and safety logic. This is a design fault, not a cleanliness or mechanical failure.',
    'Manufacturer and industry guidance require dedicated exhaust runs per commercial dryer to prevent pressure interactions and to maintain predictable airflow. Shared wye connections undermine proper exhaust velocity and allow exhaust to recirculate into the adjacent branch.',
  ],
  [AI_FIELDS.recommendations]: [
    'Primary Recommendation (Manufacturer-Safe): Each commercial dryer should be vented through a fully independent exhaust system, from dryer connection to exterior termination.',
    'Secondary Mitigation (Not Guaranteed): If full separation is not immediately possible, install commercial-grade backdraft dampers rated for dryer exhaust temperatures on each dryer branch. This may reduce cross-flow but is not a guaranteed solution.',
    'Additional vent cleaning or dryer component replacement is not recommended at this time, as the issue is related to exhaust design rather than cleanliness or mechanical failure.',
  ],
  [AI_FIELDS.technicianNotes]: [
    'Exhaust system design identified as primary cause of airflow instability. Findings discussed on-site. Photo documentation captured showing shared exhaust configuration and wye connection.',
  ],
});
