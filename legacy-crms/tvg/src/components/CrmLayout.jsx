import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { 
  Home, 
  Users, 
  Briefcase, 
  Mail, 
  Calendar, 
  DollarSign, 
  ClipboardList, 
  BarChart2, 
  Megaphone, 
  Phone, 
  Settings, 
  LayoutGrid, 
  ClipboardCheck, 
  HardHat, 
  HeartHandshake as Handshake, 
  Box, 
  Brain, 
  Shield, 
  FileText, 
  Search, 
  AlertCircle as Activity,
  Database
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const CrmLayout = () => {
  const crmNavigation = [
    { name: 'Dashboard', href: '/crm/dashboard', icon: Home },
    { name: 'Pipeline', href: '/crm/pipeline', icon: LayoutGrid },
    { name: 'Leads', href: '/crm/leads', icon: Users },
    { name: 'Jobs', href: '/crm/jobs', icon: Briefcase },
    { name: 'Estimates', href: '/crm/estimates', icon: ClipboardCheck },
    { name: 'Proposals', href: '/crm/proposals', icon: FileText },
    { name: 'Smart Call Console', href: '/crm/call-console', icon: Phone },
    { name: 'Inbox', href: '/crm/inbox', icon: Mail },
    { name: 'Schedule', href: '/crm/schedule', icon: Calendar },
    { name: 'Customers', href: '/crm/customers', icon: Users },
  ];

  const adminNavigation = [
    { name: 'My Money', href: '/crm/money', icon: DollarSign },
    { name: 'Payroll', href: '/crm/payroll', icon: ClipboardList },
    { name: 'Reporting', href: '/crm/reporting', icon: BarChart2 },
    { name: 'Marketing', href: '/crm/marketing', icon: Megaphone },
    { name: 'Action Hub', href: '/crm/action-hub', icon: HardHat },
    { name: 'Partners', href: '/crm/partners', icon: Handshake },
    { name: 'Partner Submissions', href: '/crm/submissions', icon: Box },
    { name: 'Admin Panel', href: '/crm/admin', icon: Shield },
    { name: 'Audit Log', href: '/crm/audit-log', icon: Search },
    { name: 'Brand Review', href: '/crm/brand-review', icon: Brain },
    { name: 'Brand Brain Loader', href: '/crm/brand-brain', icon: Brain },
    { name: 'System Health', href: '/crm/system-health', icon: Activity },
    { name: 'Data Tools', href: '/crm/data-tools', icon: Database },
    { name: 'Chat Widget Settings', href: '/crm/chat-settings', icon: Settings },
    { name: 'Settings', href: '/crm/settings', icon: Settings },
    { name: 'Backend Diagnostics', href: '/crm/backend-test', icon: Activity },
  ];

  return (
    <div className="flex min-h-screen bg-gray-100 dark:bg-gray-900 font-sans">
      {/* Sidebar */}
      <aside className="hidden lg:flex w-64 flex-col bg-white dark:bg-gray-800 border-r dark:border-gray-700 shadow-lg">
        <div className="flex items-center justify-between h-16 px-4 border-b dark:border-gray-700">
          <span className="text-2xl font-bold text-gray-900 dark:text-white">CRM</span>
        </div>
        <ScrollArea className="flex-1 py-4 px-3">
          <nav className="space-y-1">
            {crmNavigation.map((item) => (
              <NavLink
                key={item.name}
                to={item.href}
                className={({ isActive }) =>
                  `flex items-center p-3 rounded-lg transition-colors duration-200 ${
                    isActive
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-700 dark:text-white'
                      : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700'
                  }`
                }
              >
                <item.icon className="h-5 w-5 mr-3" />
                <span className="font-medium text-sm">{item.name}</span>
              </NavLink>
            ))}
            <Separator className="my-4 dark:bg-gray-700" />
            <h3 className="px-3 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Admin Tools</h3>
            {adminNavigation.map((item) => (
              <NavLink
                key={item.name}
                to={item.href}
                className={({ isActive }) =>
                  `flex items-center p-3 rounded-lg transition-colors duration-200 ${
                    isActive
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-700 dark:text-white'
                      : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700'
                  }`
                }
              >
                <item.icon className="h-5 w-5 mr-3" />
                <span className="font-medium text-sm">{item.name}</span>
              </NavLink>
            ))}
          </nav>
        </ScrollArea>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
};

export default CrmLayout;