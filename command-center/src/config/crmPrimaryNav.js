/**
 * UX-REFACTOR canonical CRM IA (PD-UX-01 / PD-UX-02).
 * Paths are CRM-relative (tenantPath applied at render).
 */
import {
  LayoutDashboard,
  Hammer,
  FileText,
  ClipboardList,
  BarChart,
  Settings,
  MoreHorizontal,
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

/** Mobile bottom bar (PD-UX-02 A) — More opens sidebar for secondary */
export const CRM_MOBILE_BOTTOM_NAV = [
  { name: 'Hub', path: '/crm', icon: LayoutDashboard, end: true },
  { name: 'Work Orders', path: '/crm/jobs', icon: Hammer },
  { name: 'Quotes', path: '/crm/quotes', icon: FileText },
  { name: 'Inspections', path: '/crm/inspections', icon: ClipboardList },
  { name: 'More', path: null, icon: MoreHorizontal, openSidebar: true },
];

export const CRM_PRIMARY_NAV_PATHS = CRM_PRIMARY_NAV.map((i) => i.path);
