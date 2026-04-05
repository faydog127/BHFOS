// Canonical CRM route list used for diagnostics and route governance.
// Runtime ownership remains in src/App.jsx under /:tenantId/crm/*.

const CRM_STATIC_SUBPATHS = [
  '',
  'dashboard',
  'leads',
  'pipeline',
  'jobs',
  'schedule',
  'estimates',
  'estimates/new',
  'money',
  'setup',
  'invoices',
  'invoices/new',
  'contacts',
  'call-console',
  'sms',
  'marketing',
  'reporting',
  'partners',
  'settings',
  'ops',
  'backend-test',
  'advanced-diagnostics',
];

export const canonicalCrmRoutePaths = CRM_STATIC_SUBPATHS.map((subpath) =>
  subpath ? `/crm/${subpath}` : '/crm'
);
