import React, { useEffect, useState } from 'react';
import { NavLink, useParams } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Megaphone,
  Calendar,
  FileText,
  CreditCard,
  Settings,
  BarChart,
  Hammer,
  BookOpen,
  Phone,
  MessageSquare,
  Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { tenantPath } from '@/lib/tenantUtils';
import TenantSwitcher from '@/components/TenantSwitcher';
import { supabase } from '@/lib/customSupabaseClient';

const BHFSidebar = () => {
  const { tenantId = 'tvg' } = useParams();
  const [isSuperUser, setIsSuperUser] = useState(false);

  useEffect(() => {
    const checkSuper = async () => {
      const { data } = await supabase.rpc('check_is_superuser');
      if (data) setIsSuperUser(true);
    };
    checkSuper();
  }, []);

  const navItems = [
    { name: 'Hub', path: '/crm', icon: LayoutDashboard, end: true },
    { name: 'Leads', path: '/crm/leads', icon: Users },
    { name: 'Pipeline', path: '/crm/pipeline', icon: BarChart },
    { name: 'Jobs', path: '/crm/jobs', icon: Hammer },
    { name: 'Schedule', path: '/crm/schedule', icon: Calendar },
    { name: 'Call Console', path: '/crm/call-console', icon: Phone },
    { name: 'Estimates', path: '/crm/estimates', icon: FileText },
    { name: 'Invoices', path: '/crm/invoices', icon: CreditCard },
    { name: 'SMS Inbox', path: '/crm/sms', icon: MessageSquare },
    { name: 'Marketing', path: '/crm/marketing', icon: Megaphone },
    { name: 'Partners', path: '/crm/partners', icon: Users },
    { name: 'Reporting', path: '/crm/reporting', icon: BarChart },
    { name: 'Pricebook', path: '/crm/pricebook', icon: BookOpen },
    { name: 'Ops Dashboard', path: '/crm/ops', icon: Activity },
    { name: 'Settings', path: '/crm/settings', icon: Settings },
  ];

  return (
    <div className="h-full flex flex-col bg-slate-900 text-white">
      {/* Brand / Logo Area */}
      <div className="flex flex-col px-4 pt-4 pb-2 border-b border-slate-800">
        <div className="h-10 flex items-center mb-4">
            <span className="text-xl font-bold bg-gradient-to-r from-blue-400 to-blue-200 bg-clip-text text-transparent">
            {tenantId.toUpperCase()} CRM
            </span>
        </div>
        
        {/* Tenant Switcher only for Superusers */}
        {isSuperUser && <TenantSwitcher />}
      </div>

      {/* Navigation Items */}
      <div className="flex-1 overflow-y-auto py-4">
        <nav className="px-3 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={tenantPath(item.path, tenantId)}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors",
                  isActive
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                )
              }
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {item.name}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* User / Footer Area */}
      <div className="p-4 border-t border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center">
            <Users className="w-4 h-4 text-slate-300" />
          </div>
          <div className="text-xs">
            <div className="text-white font-medium">Logged In</div>
            <div className="text-slate-500">
                {isSuperUser ? 'Superuser Mode' : `Tenant: ${tenantId}`}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BHFSidebar;