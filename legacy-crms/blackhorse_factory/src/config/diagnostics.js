
export const FRONTEND_MODULES = [
  { id: 'dashboard', name: 'Dashboard', path: '/crm' },
  { id: 'pipeline', name: 'Pipeline', path: '/crm/pipeline' },
  { id: 'leads', name: 'Leads', path: '/crm/leads' },
  { id: 'jobs', name: 'Jobs', path: '/crm/jobs' },
  { id: 'estimates', name: 'Estimates', path: '/crm/estimates' },
  { id: 'proposals', name: 'Proposals', path: '/crm/proposals' },
  { id: 'smart_console', name: 'Smart Call Console', path: '/crm/calls' },
  { id: 'inbox', name: 'Inbox', path: '/crm/inbox' },
  { id: 'schedule', name: 'Schedule', path: '/crm/schedule' },
  { id: 'customers', name: 'Customers', path: '/crm/customers' },
  { id: 'money', name: 'My Money', path: '/crm/my-money' },
  { id: 'payroll', name: 'Payroll', path: '/crm/payroll' },
  { id: 'reporting', name: 'Reporting', path: '/crm/reporting' },
  { id: 'marketing', name: 'Marketing', path: '/crm/marketing' },
  { id: 'action_hub', name: 'Action Hub', path: '/crm/action-hub' },
  { id: 'partners', name: 'Partners', path: '/crm/partners' },
  { id: 'partner_subs', name: 'Partner Submissions', path: '/crm/partner-submissions' },
  { id: 'admin', name: 'Admin Panel', path: '/crm/admin' },
  { id: 'audit', name: 'Audit Log', path: '/crm/settings/audit-log' },
  { id: 'brand_review', name: 'Brand Review', path: '/crm/brand-review' },
  { id: 'brand_brain', name: 'Brand Brain Loader', path: '/crm/brand-brain' },
  { id: 'health', name: 'System Health', path: '/crm/system-health' },
  { id: 'data', name: 'Data Tools', path: '/crm/data-tools' },
  { id: 'chat_settings', name: 'Chat Widget Settings', path: '/crm/chat-settings' },
  { id: 'settings', name: 'Settings', path: '/crm/settings' },
  { id: 'diagnostics', name: 'Backend Diagnostics', path: '/crm/backend-test' },
];

export const SCORING_WEIGHTS = {
  OK: 10,
  WARNING: -5,
  ERROR: -15,
  CRITICAL: -30
};

export const SEVERITY_LEVELS = {
  CRITICAL: 'Critical',
  ERROR: 'Error',
  WARNING: 'Warning',
  INFO: 'Info'
};
