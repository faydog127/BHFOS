import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate, useParams } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Megaphone,
  Calendar,
  ClipboardCheck,
  FileText,
  CreditCard,
  Settings,
  BarChart,
  Hammer,
  Phone,
  MessageSquare,
  Activity,
  LogOut
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { tenantPath } from '@/lib/tenantUtils';
import TenantSwitcher from '@/components/TenantSwitcher';
import { supabase } from '@/lib/customSupabaseClient';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';

const BUILD_STAMP = import.meta.env.VITE_BUILD_STAMP || '2026-02-23-1';

const BHFSidebar = ({ onNavigate = null }) => {
  const { tenantId = 'tvg' } = useParams();
  const navigate = useNavigate();
  const [isSuperUser, setIsSuperUser] = useState(false);
  const { signOut } = useSupabaseAuth();

  useEffect(() => {
    let mounted = true;
    const withTimeout = (promise, timeoutMs = 4000) =>
      Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs)),
      ]);

    const checkSuper = async () => {
      try {
        const result = await withTimeout(supabase.rpc('check_is_superuser'));
        if (mounted && result?.data) {
          setIsSuperUser(true);
        }
      } catch (err) {
        // Non-blocking: sidebar should render even if role RPC is slow/unavailable.
        console.warn('BHFSidebar: superuser check timed out or failed.', err);
      }
    };

    checkSuper();

    return () => {
      mounted = false;
    };
  }, []);

  const navSections = [
    {
      title: 'Command',
      items: [
        { name: 'Hub', path: '/crm', icon: LayoutDashboard, end: true },
      ],
    },
    {
      title: 'Intake',
      items: [
        { name: 'Leads', path: '/crm/leads', icon: Users },
        { name: 'Call Console', path: '/crm/call-console', icon: Phone },
        { name: 'SMS Inbox', path: '/crm/sms', icon: MessageSquare },
      ],
    },
    {
      title: 'Sales',
      items: [
        { name: 'Opportunities', path: '/crm/opportunities', icon: BarChart },
        { name: 'Estimates', path: '/crm/estimates', icon: FileText },
      ],
    },
    {
      title: 'Scheduling',
      items: [
        { name: 'Calendar', path: '/crm/calendar', icon: ClipboardCheck },
      ],
    },
    {
      title: 'Operations',
      items: [
        { name: 'Work Orders', path: '/crm/jobs', icon: Hammer },
        { name: 'Dispatch', path: '/crm/dispatch', icon: Calendar },
      ],
    },
    {
      title: 'Finance',
      items: [
        { name: 'Invoices', path: '/crm/invoices', icon: CreditCard },
      ],
    },
    {
      title: 'Growth',
      items: [
        { name: 'Marketing', path: '/crm/marketing', icon: Megaphone },
        { name: 'Partners', path: '/crm/partners', icon: Users },
        { name: 'Reporting', path: '/crm/reporting', icon: BarChart },
      ],
    },
    {
      title: 'System',
      items: [
        { name: 'Ops Dashboard', path: '/crm/ops', icon: Activity },
        { name: 'Settings', path: '/crm/settings', icon: Settings },
      ],
    },
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
        <nav className="px-3 space-y-5">
          {navSections.map((section) => (
            <div key={section.title}>
              <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                {section.title}
              </div>
              <div className="space-y-1">
                {section.items.map((item) => (
                  <NavLink
                    key={item.path}
                    to={tenantPath(item.path, tenantId)}
                    end={item.end}
                    onClick={() => onNavigate?.()}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors',
                        isActive
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white',
                      )
                    }
                  >
                    <item.icon className="w-5 h-5 flex-shrink-0" />
                    {item.name}
                  </NavLink>
                ))}
              </div>
            </div>
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
        <button
          type="button"
          onClick={async () => {
            await signOut();
            navigate(`/${tenantId}/login`, { replace: true });
          }}
          className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-md border border-slate-800 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign Out
        </button>
        <div className="mt-3 text-[11px] text-slate-500 opacity-60">
          Build: {BUILD_STAMP}
        </div>
      </div>
    </div>
  );
};

export default BHFSidebar;
