/**
 * TVG Report Template Field Map (Reusable)
 * - Locks naming so future templates + Codex can't drift.
 * - Separates: UI-entered identity fields vs AI-generated narrative fields.
 * - Designed for: 2-page overlay (pg1 + pg2) + continuation pages (pg2 background).
 */

// -------------------------
// 1) Identity / Job Metadata (UI / system-owned)
// -------------------------
export const IDENTITY_FIELDS = Object.freeze({
  customerName: 'customerName',
  customerPhone: 'customerPhone',

  // Address rendered as 2 lines max (line2 optional)
  serviceAddressLine1: 'serviceAddressLine1',
  serviceAddressLine2: 'serviceAddressLine2',

  primaryConcern: 'primaryConcern',

  serviceType: 'serviceType',
  serviceDate: 'serviceDate',
  technicianName: 'technicianName',
  workOrder: 'workOrder', // optional
});

// -------------------------
// 2) Report Control / Layout Inputs
// -------------------------
export const REPORT_CONTROL = Object.freeze({
  // H1 repeated on all pages
  reportTitle: 'reportTitle',

  // background image sources (pg1 + pg2)
  // defaults used if missing; override via payload when needed
  pageBackgrounds: 'pageBackgrounds',

  // render debug outlines/labels when true
  debug: 'debug',
});

// -------------------------
// 3) AI-Generated Narrative Fields (report content)
// -------------------------
export const AI_FIELDS = Object.freeze({
  // Page 1
  execSummary: 'execSummary', // forwardable narrative + bullets
  criticalRisk: 'criticalRisk', // optional
  findingsBefore: 'findingsBefore', // optional but used for Chris report

  // Page 2
  findingsAfter: 'findingsAfter',
  rootCause: 'rootCause',
  recommendations: 'recommendations',
  technicianNotes: 'technicianNotes', // optional, short
});

// -------------------------
// 4) Photo Inputs (future-ready; continuation pages for now)
// -------------------------
export const PHOTO_FIELDS = Object.freeze({
  // Raw photo pool (tech takes many; you later select 4)
  photos: 'photos', // array of { id?, url, note?, createdAt? }

  // Selected story photos (today: manual pick or rules; future: AI pick)
  selectedEvidence: 'selectedEvidence', // array of up to 4 { url, caption, tag, label }

  // Recommended tags for later automation
  tags: Object.freeze([
    'evidence',
    'before',
    'after',
    'exhaust_path',
    'termination',
    'equipment_id',
    'problem_area',
  ]),
});

// -------------------------
// 5) HTML Field IDs (what your overlay template renders into)
// NOTE: These are DOM IDs/classes, not payload keys.
// -------------------------
export const HTML_FIELD_IDS = Object.freeze({
  // Title appears on every page (pg1/pg2/continuations)
  title: {
    p1: 'p1_title',
    p2: 'p2_title',
    cont: 'pC_title',
  },

  // Page 1 meta slabs
  meta: {
    left: 'p1_meta_left',
    right: 'p1_meta_right',
  },

  // Page 1 narrative slabs
  p1: {
    execSummary: 'p1_execSummary',
    criticalRisk: 'p1_criticalRisk', // optional: hide if empty
    findingsBefore: 'p1_findingsBefore', // optional: hide if empty
  },

  // Page 2 narrative slabs
  p2: {
    findingsAfter: 'p2_findingsAfter',
    rootCause: 'p2_rootCause',
    recommendations: 'p2_recommendations',
    technicianNotes: 'p2_technicianNotes', // optional: hide if empty
  },

  // Continuation pages (pg2 background)
  cont: {
    continuedText: 'pC_continuedText',
    photosWrap: 'pC_photos',

    // 4-slot evidence grid (A–D) on continuation pages
    photoSlots: ['pC_photoA', 'pC_photoB', 'pC_photoC', 'pC_photoD'],
  },
});

// -------------------------
// 6) Slab inventory (LOCKED for Chris report)
// -------------------------
export const REPORT_SLABS = Object.freeze({
  page1: Object.freeze([
    'TITLE',
    'META_LEFT',
    'META_RIGHT',
    'EXEC_SUMMARY',
    'CRITICAL_RISK_OPTIONAL',
    'FINDINGS_BEFORE',
  ]),
  page2: Object.freeze([
    'TITLE',
    'FINDINGS_AFTER',
    'ROOT_CAUSE',
    'RECOMMENDATIONS',
    'TECHNICIAN_NOTES_OPTIONAL',
  ]),
  continuation: Object.freeze(['TITLE', 'CONTINUED_TEXT', 'PHOTOS_OPTIONAL']),
});

// -------------------------
// 7) Layout map (ties AI_FIELDS -> HTML_FIELD_IDS)
// -------------------------
export const FIELD_BINDINGS = Object.freeze({
  // Page 1
  [AI_FIELDS.execSummary]: HTML_FIELD_IDS.p1.execSummary,
  [AI_FIELDS.criticalRisk]: HTML_FIELD_IDS.p1.criticalRisk,
  [AI_FIELDS.findingsBefore]: HTML_FIELD_IDS.p1.findingsBefore,

  // Page 2
  [AI_FIELDS.findingsAfter]: HTML_FIELD_IDS.p2.findingsAfter,
  [AI_FIELDS.rootCause]: HTML_FIELD_IDS.p2.rootCause,
  [AI_FIELDS.recommendations]: HTML_FIELD_IDS.p2.recommendations,
  [AI_FIELDS.technicianNotes]: HTML_FIELD_IDS.p2.technicianNotes,
});

// -------------------------
// 8) Recommended schema for one payload object
// (This is what your generator should accept; all optional with defaults.)
// -------------------------
export const DEFAULT_REPORT_MODEL = Object.freeze({
  // control
  [REPORT_CONTROL.reportTitle]: 'Post-Service Findings Report',
  [REPORT_CONTROL.pageBackgrounds]: [], // if empty -> generator uses defaults
  [REPORT_CONTROL.debug]: false,

  // identity
  [IDENTITY_FIELDS.customerName]: '',
  [IDENTITY_FIELDS.customerPhone]: '',
  [IDENTITY_FIELDS.serviceAddressLine1]: '',
  [IDENTITY_FIELDS.serviceAddressLine2]: '',
  [IDENTITY_FIELDS.primaryConcern]: '',
  [IDENTITY_FIELDS.serviceType]: '',
  [IDENTITY_FIELDS.serviceDate]: '',
  [IDENTITY_FIELDS.technicianName]: '',
  [IDENTITY_FIELDS.workOrder]: '',

  // AI narrative
  [AI_FIELDS.execSummary]: [],
  [AI_FIELDS.criticalRisk]: [],
  [AI_FIELDS.findingsBefore]: [],
  [AI_FIELDS.findingsAfter]: [],
  [AI_FIELDS.rootCause]: [],
  [AI_FIELDS.recommendations]: [],
  [AI_FIELDS.technicianNotes]: [],

  // photos
  [PHOTO_FIELDS.photos]: [],
  [PHOTO_FIELDS.selectedEvidence]: [], // up to 4
});

/**
 * Optional: helper to decide show/hide slabs
 */
export const slabHasContent = (value) => {
  if (!value) return false;
  if (Array.isArray(value)) return value.filter(Boolean).length > 0;
  return String(value).trim().length > 0;
};
