import React, { useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useParams } from 'react-router-dom';
import BHFSidebar from '@/components/BHFSidebar';
import { cn } from '@/lib/utils';
import { CreditCard, ClipboardCheck, FileText, LayoutDashboard, Menu, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DEFAULT_TENANT_ID } from '@/config/tenantDefaults';
import { tenantPath } from '@/lib/tenantUtils';

const BHFCrmLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { tenantId = DEFAULT_TENANT_ID } = useParams();
  const TENANT_ID = DEFAULT_TENANT_ID;
  
  const isDemo = TENANT_ID === 'demo';
  const isInstallWorxs = TENANT_ID === 'installworxs';

  // THEME CONFIGURATION
  let mainWrapperClass = "bg-slate-50 min-h-screen overflow-x-hidden text-slate-900";
  let contentAreaClass = "relative z-0 mx-auto max-w-[1920px] px-3 py-4 pb-24 sm:px-4 lg:ml-64 lg:p-8 lg:pb-8";
  let mobileHeaderClass = "sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-3 backdrop-blur md:px-4 lg:hidden";
  let sidebarWrapperClass = "fixed inset-y-0 left-0 z-50 w-[18rem] max-w-[85vw] transform transition-transform duration-200 ease-in-out lg:w-64 lg:max-w-none lg:translate-x-0";

  if (isDemo) {
    // Farm/Factory Dark Theme
    mainWrapperClass = "bg-[#1c1917] min-h-screen overflow-x-hidden font-sans text-[#e7e5e4] selection:bg-[#65a30d]/30";
    contentAreaClass = "relative z-0 mx-auto max-w-[1920px] px-3 py-4 pb-24 text-[#e7e5e4] sm:px-4 lg:ml-64 lg:p-8 lg:pb-8";
    mobileHeaderClass = "lg:hidden sticky top-0 z-30 px-4 h-16 flex items-center justify-between border-b bg-[#1c1917]/90 border-[#44403c] backdrop-blur-md";
    sidebarWrapperClass += " border-r border-[#44403c] shadow-[4px_0_24px_-12px_rgba(0,0,0,0.5)]";
  } else if (isInstallWorxs) {
    // Vibrant Install Worxs Theme
    mainWrapperClass = "bg-slate-50 min-h-screen overflow-x-hidden text-slate-900 selection:bg-orange-200";
    contentAreaClass = "relative z-0 mx-auto max-w-[1920px] px-3 py-4 pb-24 sm:px-4 lg:ml-64 lg:p-8 lg:pb-8";
    mobileHeaderClass = "lg:hidden sticky top-0 z-30 px-4 h-16 flex items-center justify-between border-b bg-white/80 backdrop-blur-md border-orange-100";
    sidebarWrapperClass += " border-r border-orange-100 shadow-xl shadow-orange-500/5";
  }

  const mobileNavItems = [
    { name: 'Hub', path: '/crm', icon: LayoutDashboard, end: true },
    { name: 'Leads', path: '/crm/leads', icon: Users },
    { name: 'Estimates', path: '/crm/estimates', icon: FileText },
    { name: 'Calendar', path: '/crm/calendar', icon: ClipboardCheck },
    { name: 'Invoices', path: '/crm/invoices', icon: CreditCard },
  ];

  const currentPageLabel = useMemo(() => {
    const path = location.pathname.toLowerCase();
    if (path.includes('/crm/estimates')) return 'Estimates';
    if (path.includes('/crm/invoices')) return 'Invoices';
    if (path.includes('/crm/leads')) return 'Leads';
    if (path.includes('/crm/calendar')) return 'Calendar';
    if (path.includes('/crm/jobs')) return 'Work Orders';
    if (path.includes('/crm/dispatch')) return 'Dispatch';
    if (path.includes('/crm/settings')) return 'Settings';
    return 'Hub';
  }, [location.pathname]);

  return (
    <div className={mainWrapperClass}>
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar Wrapper */}
      <div className={cn(
        sidebarWrapperClass,
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <BHFSidebar onNavigate={() => setSidebarOpen(false)} />
      </div>

      {/* Mobile Header */}
      <div className={mobileHeaderClass}>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
            <Menu className={cn("w-6 h-6", isDemo ? "text-[#a8a29e]" : "text-slate-600")} />
          </Button>
          <div className="min-w-0">
            <div className={cn("truncate text-sm font-semibold", isDemo ? "text-[#e7e5e4]" : "text-slate-900")}>
              {isDemo ? "Farm OS" : (isInstallWorxs ? "Install Worxs" : "BHF CRM")}
            </div>
            <div className={cn("truncate text-xs", isDemo ? "text-[#a8a29e]" : "text-slate-500")}>
              {currentPageLabel}
            </div>
          </div>
        </div>
        <div className={cn("text-xs font-medium", isDemo ? "text-[#a8a29e]" : "text-slate-500")}>
          {tenantId.toUpperCase()}
        </div>
      </div>

      {/* Main Content */}
      <main className={contentAreaClass}>
        {isDemo && (
          /* Subtle Ambient Background for Demo */
          <div className="fixed inset-0 pointer-events-none z-[-1]">
             <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#65a30d]/5 rounded-full blur-[100px]" />
             <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-[#854d0e]/5 rounded-full blur-[100px]" />
             <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')] opacity-10"></div>
          </div>
        )}
        {isInstallWorxs && (
             /* Subtle Ambient Background for Install Worxs */
            <div className="fixed inset-0 pointer-events-none z-[-1] overflow-hidden">
                <div className="absolute top-[-10%] right-[-10%] w-[600px] h-[600px] bg-orange-200/20 rounded-full blur-[100px]" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-lime-200/20 rounded-full blur-[100px]" />
            </div>
        )}
        <Outlet />
      </main>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur lg:hidden">
        <nav className="mx-auto grid max-w-md grid-cols-5 gap-1 px-2 py-2">
          {mobileNavItems.map((item) => (
            <NavLink
              key={item.path}
              to={tenantPath(item.path, tenantId)}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex min-h-[3.5rem] flex-col items-center justify-center rounded-xl px-1 text-[11px] font-medium transition-colors',
                  isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-100',
                )
              }
            >
              <item.icon className="mb-1 h-4 w-4" />
              <span className="truncate">{item.name}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
};

export default BHFCrmLayout;
