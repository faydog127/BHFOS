// Hotel-specific 2-page report template aligned to overlay coordinates
// Exports a builder and a ready-to-use Chris Adams payload.

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

const formatDate = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return escapeHtml(String(value));
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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

  const pHtml = paras
    .map((t) => `<p style="margin:0 0 10px 0;">${t}</p>`)
    .join('');
  const bHtml = bullets.length
    ? `<ul class="bullets">${bullets.map((b) => `<li>${b}</li>`).join('')}</ul>`
    : '';

  return pHtml + bHtml;
};

const renderMultiline = (text) => escapeHtml(String(text || '')).replace(/\n/g, '<br/>');

const normalizePayload = (payload = {}) => ({
  reportTitle: escapeHtml(payload.reportTitle || 'Post-Service Report'),
  customerName: escapeHtml(payload.customerName || 'Customer'),
  serviceAddress: renderMultiline(payload.serviceAddress || 'Service Address'),
  serviceType: escapeHtml(
    payload.serviceType || 'Commercial Dryer Vent Inspection & Post-Service Assessment'
  ),
  serviceDate: payload.serviceDate ? formatDate(payload.serviceDate) : escapeHtml(''),
  technicianName: escapeHtml(payload.technicianName || 'Technician'),
  primaryConcern: escapeHtml(
    payload.primaryConcern ||
      'Large-capacity commercial dryer intermittently faulting, under-drying, and experiencing airflow-related shutdowns despite clean venting.'
  ),
  summary: toLines(payload.summary),
  criticalRisk: toLines(payload.criticalRisk),
  findingsBefore: toLines(payload.findingsBefore),
  findingsAfter: toLines(payload.findingsAfter),
  improvements: toLines(payload.improvements),
  remainingConcerns: toLines(payload.remainingConcerns),
  recommendations: toLines(payload.recommendations),
  notes: toLines(payload.notes),
});

export const buildHotelReportHtml = (payload = {}, options = {}) => {
  const model = normalizePayload(payload);
  const pageBackgrounds = (options.pageBackgrounds || [
    'C:/BHFOS/Reports/Template_pg1.png',
    'C:/BHFOS/Reports/Template_pg2.png',
  ]).map(toFileUrl);

  const debug = options.debug ? 'debug' : '';

  const criticalBlock = model.criticalRisk.length
    ? `
      <div class="field pill" style="top:52%; left:7%; width:86%; height:11%;">
        <div class="label danger">Critical Risk / Code Concern</div>
        <div class="content">${renderMixed(model.criticalRisk)}</div>
      </div>
    `
    : '';

  const findingsBeforeBlock = model.findingsBefore.length
    ? `
      <div class="field" style="top:65%; left:7%; width:86%; height:18%;">
        <div class="label">Findings (Before Service)</div>
        <div class="content bullets">${renderMixed(model.findingsBefore)}</div>
      </div>
    `
    : '';

  const notesBlock = model.notes.length
    ? `
      <div class="field" style="top:78%; left:8%; width:84%; height:10%;">
        <div class="label">Technician Notes</div>
        <div class="content">${renderMixed(model.notes)}</div>
      </div>
    `
    : '';

  return `
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Commercial Dryer Vent Service Report</title>
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
    .field.title { display: flex; align-items: center; }
    .field.title .title-text {
      font-weight: 900;
      font-size: 18px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #0f172a;
    }
    .pill {
      background: rgba(181, 32, 37, 0.96);
      color: #ffffff;
      border-radius: 12px;
      padding: 10px 12px;
    }
    .pill .label { color: #ffffff; }
    .pill .content p { color: #ffffff; }
    .pill ul { color: #ffffff; }
    .bullets ul { margin: 0; padding-left: 18px; }
    .bullets li { margin-bottom: 6px; }
    p { margin: 0 0 10px 0; }
    .muted { color: #5b6470; }
    .meta-row { margin-bottom: 6px; }
    .meta-row strong { font-weight: 700; }
    .debug .field { outline: 2px dashed rgba(255, 0, 0, 0.45); background: rgba(255, 255, 0, 0.08); }
  </style>
</head>
<body class="${debug}">
  <!-- Page 1 -->
  <div class="page" style="background-image:url('${pageBackgrounds[0]}');">
    <div class="field title" style="top:8%; left:55%; width:37%; height:4%;">
      <div class="title-text">${model.reportTitle}</div>
    </div>
    <div class="field" style="top:13%; left:7%; width:40%; height:14%;">
      <div class="meta-row"><strong>Customer:</strong> ${model.customerName}</div>
      <div class="meta-row"><strong>Service Address:</strong><br/>${model.serviceAddress}</div>
      <div class="meta-row"><strong>Primary Concern:</strong> ${model.primaryConcern}</div>
    </div>
    <div class="field" style="top:13%; left:55%; width:37%; height:14%;">
      <div class="meta-row"><strong>Service Type:</strong> ${model.serviceType}</div>
      <div class="meta-row"><strong>Visit Date:</strong> ${model.serviceDate || '&nbsp;'}</div>
      <div class="meta-row"><strong>Technician:</strong> ${model.technicianName}</div>
    </div>
    <div class="field" style="top:29%; left:7%; width:86%; height:22%;">
      <div class="label">Summary</div>
      <div class="content">${renderMixed(model.summary)}</div>
    </div>
    ${criticalBlock}
    ${findingsBeforeBlock}
  </div>

  <!-- Page 2 -->
  <div class="page" style="background-image:url('${pageBackgrounds[1]}');">
    <div class="field" style="top:10%; left:8%; width:84%; height:18%;">
      <div class="label">Findings (After / Post-Visit)</div>
      <div class="content bullets">${renderMixed(model.findingsAfter)}</div>
    </div>
    <div class="field" style="top:32%; left:8%; width:84%; height:14%;">
      <div class="label">Key Improvements</div>
      <div class="content bullets">${renderMixed(model.improvements)}</div>
    </div>
    <div class="field" style="top:50%; left:8%; width:84%; height:14%;">
      <div class="label">Remaining Concerns</div>
      <div class="content">${renderMixed(model.remainingConcerns)}</div>
    </div>
    <div class="field" style="top:66%; left:8%; width:84%; height:14%;">
      <div class="label">Recommendations</div>
      <div class="content">${renderMixed(model.recommendations)}</div>
    </div>
    ${notesBlock}
  </div>
</body>
</html>
  `;
};

export const getChrisSamplePayload = () => ({
  reportTitle: 'Post-Service Report',
  customerName: 'Chris Adams',
  serviceAddress: 'SpringHill Suites West Melbourne\n4446 Hollywood Blvd\nWest Melbourne, FL 32904',
  serviceType: 'Commercial Dryer Vent Inspection & Post-Service Assessment',
  serviceDate: '', // Fill in actual service date when known
  technicianName: 'Technician Name',
  primaryConcern:
    'Large-capacity commercial dryer intermittently faulting, under-drying, and experiencing airflow-related shutdowns despite clean venting.',
  summary: [
    'An on-site post-service inspection was performed following repeated airflow-related faults and performance issues on a large-capacity commercial dryer. Venting was found to be clean, unobstructed, and constructed of rigid metal with a short overall run.',
    'Despite these conditions, both dryers are connected to a shared exhaust system via a wye fitting, which creates unstable pressure conditions during operation. This configuration causes backpressure and cross-flow that directly interferes with proper dryer exhaust performance, particularly on the higher-capacity unit.',
    'The observed behavior is consistent with an exhaust system design issue, not a maintenance or cleaning deficiency.',
  ],
  criticalRisk: [
    'Two commercial dryers are connected to a shared exhaust system using a wye fitting. This configuration allows cross-flow and pressure instability and is not compatible with high-capacity commercial dryers.',
    'Shared exhaust systems can cause dryers to recirculate exhaust air into adjacent branches, leading to safety shutdowns, overheating risks, inefficient drying, and long-term equipment stress. Manufacturer guidance and best practices require dedicated exhaust runs per dryer to ensure safe and stable operation.',
  ],
  findingsBefore: [
    '- Repeated airflow-related faults reported on large-capacity dryer',
    '- Dryer under-drying loads and intermittently limiting heat output',
    '- No visible lint blockage at termination or within accessible duct sections',
    '- Venting appeared clean at time of inspection',
  ],
  findingsAfter: [
    '- Exhaust ducting verified clean and unobstructed',
    '- Rigid metal duct used throughout with short overall run length',
    '- Internal airflow damper observed operating as designed',
    '- No mechanical failure identified within the dryer itself',
    'The larger dryer continues to experience airflow instability when operating due to interaction with the shared exhaust system. Exhaust air from the larger unit is capable of pressurizing the shared duct and flowing toward the adjacent dryer branch, creating unstable pressure conditions that trigger dryer safety logic.',
  ],
  improvements: [
    '- Confirmed vent cleanliness and eliminated lint blockage as a cause',
    '- Identified root-cause exhaust design issue',
    '- Provided documentation to prevent unnecessary repeat service calls',
    '- Clarified that dryer behavior is a response to unsafe exhaust conditions, not equipment failure',
  ],
  remainingConcerns: [
    'The shared exhaust configuration will continue to cause intermittent faults, inefficient drying, and service disruptions until corrected. Continued operation under these conditions may lead to increased maintenance costs and ongoing downtime.',
  ],
  recommendations: [
    'Primary Recommendation (Manufacturer-Safe): Each commercial dryer should be vented through a fully independent exhaust system, from dryer connection to exterior termination.',
    'Secondary Mitigation (Not Guaranteed): If full separation is not immediately possible, install commercial-grade backdraft dampers rated for dryer exhaust temperatures on each dryer branch. This may reduce cross-flow but is not a guaranteed solution.',
    'Additional vent cleaning or dryer component replacement is not recommended at this time, as the issue is related to exhaust design rather than cleanliness or mechanical failure.',
  ],
  notes: [
    'Exhaust system design identified as primary cause of airflow instability. Findings discussed on-site. Photo documentation captured showing shared exhaust configuration and wye connection.',
  ],
});
