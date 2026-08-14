/**
 * CRM IA — UX-REFACTOR primary + UXV2 mobile money parity (PD-UXV2-05).
 * Paths are CRM-relative (tenantPath applied at render).
 * Media Intelligence is not a CRM nav item — source of record is mil.bhfos.com.
 */
import {
  LayoutDashboard,
  Hammer,
  FileText,
  ClipboardList,
  BarChart,
  Settings,
  MoreHorizontal,
  Receipt,
} from 'lucide-react';

/** Primary desktop nav — above divider */
export const CRM_PRIMARY_NAV = [
  { name: 'Hub', path: '/crm', icon: LayoutDashboard, end: true },
  { name: 'Work Orders', path: '/crm/jobs', icon: Hammer },
  { name: 'Quotes', path: '/crm/quotes', icon: FileText },
  { name: 'Inspections', path: '/crm/inspections', icon: ClipboardList },
  { name: 'Analytics', path: '/crm/reporting', icon: BarChart },
  { name: 'Settings', path: '/crm/settings', icon: Settings },
];

/**
 * Mobile bottom bar — money-critical one-tap (Invoices replaces Inspections).
 * Inspections remains in desktop primary + More/sidebar.
 */
export const CRM_MOBILE_BOTTOM_NAV = [
  { name: 'Hub', path: '/crm', icon: LayoutDashboard, end: true },
  { name: 'Work Orders', path: '/crm/jobs', icon: Hammer },
  { name: 'Quotes', path: '/crm/quotes', icon: FileText },
  { name: 'Invoices', path: '/crm/invoices', icon: Receipt },
  { name: 'More', path: null, icon: MoreHorizontal, openSidebar: true },
];

export const CRM_PRIMARY_NAV_PATHS = CRM_PRIMARY_NAV.map((i) => i.path);
