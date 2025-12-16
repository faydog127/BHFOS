
import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Users, LayoutDashboard, BarChart3, Settings, Briefcase, Calendar, FileText, Phone, MessageSquare, Megaphone, Book, HeartHandshake as Handshake, Building, HardHat, Wallet, Activity, Rocket } from 'lucide-react';

const BHFSidebar = () => {
  const TENANT_ID = import.meta.env.VITE_TENANT_ID || 'default';
  
  const navItems = [
    { label: 'Dashboard', path: '/bhf/crm', icon: LayoutDashboard, flag: null },
    { label: 'Leads', path: '/bhf/crm/leads', icon: Users, flag: 'enableLeads' },
    { label: 'Pipeline', path: '/bhf/crm/pipeline', icon: BarChart3, flag: 'enablePipeline' },
    { label: 'Jobs', path: '/bhf/crm/jobs', icon: HardHat, flag: 'enableJobs' },
    { label: 'Schedule', path: '/bhf/crm/schedule', icon: Calendar, flag: 'enableSchedule' },
    { label: 'Estimates', path: '/bhf/crm/estimates', icon: FileText, flag: 'enableEstimates' },
    { label: 'Invoices', path: '/bhf/crm/invoices', icon: Wallet, flag: 'enableInvoicing' },
    { label: 'Contacts', path: '/bhf/crm/contacts', icon: Briefcase, flag: 'enableContacts' },
    { label: 'Call Console', path: '/bhf/crm/call-console', icon: Phone, flag: 'enableCallConsole' },
    { label: 'Inbox', path: '/bhf/crm/sms', icon: MessageSquare, flag: 'enableSMS' },
    { label: 'Marketing', path: '/bhf/crm/marketing', icon: Megaphone, flag: 'enableMarketing' },
    { label: 'Reporting', path: '/bhf/crm/reporting', icon: BarChart3, flag: 'enableReporting' },
    { label: 'Pricebook', path: '/bhf/crm/pricebook', icon: Book, flag: 'enablePricebook' },
    { label: 'Partners', path: '/bhf/crm/partners', icon: Handshake, flag: 'enablePartners' },
    { label: 'Settings', path: '/bhf/crm/settings', icon: Settings, flag: 'enableSettings' },
  ];

  // Admin-only items (Factory OS / Default Tenant only)
  const adminItems = [
    { label: 'Tenant Manager', path: '/bhf/tenant-management', icon: Building, flag: null, adminOnly: true },
    { label: 'Onboard Tenant', path: '/bhf/tenant-onboarding', icon: Rocket, flag: null, adminOnly: true },
    { label: 'System Doctor', path: '/system-doctor', icon: Activity, flag: null, adminOnly: true },
  ];

  const fullNav = TENANT_ID === 'default' ? [...navItems, ...adminItems] : navItems;

  // Theme Configuration based on Tenant
  const isFactoryHost = TENANT_ID === 'default';
  const isDemo = TENANT_ID === 'demo';
  const isInstallWorxs = TENANT_ID === 'installworxs';

  let sidebarClass = "h-full flex flex-col border-r transition-colors duration-300";
  let headerClass = "h-16 flex items-center px-6 border-b transition-colors duration-300";
  let textClass = "font-bold text-xl tracking-tight transition-colors duration-300";
  
  if (isFactoryHost) {
    sidebarClass += " bg-[#0f172a] border-[#1e293b]"; // Charcoal / Slate 900
    headerClass += " border-[#1e293b] bg-[#020617]";
    textClass += " text-[#fbbf24]"; // Amber-400 (Gold-ish)
  } else if (isDemo) {
    sidebarClass += " bg-[#1c1917] border-[#44403c]";
    headerClass += " border-[#44403c]";
    textClass += " text-[#e7e5e4]";
  } else if (isInstallWorxs) {
    sidebarClass += " bg-white border-orange-100";
    headerClass += " border-orange-100";
    textClass += " text-slate-900";
  } else {
    // Default / TVG
    sidebarClass += " bg-white border-slate-200";
    headerClass += " border-slate-200";
    textClass += " text-slate-900";
  }

  return (
    <div className={sidebarClass}>
      {/* Header / Logo Area */}
      <div className={headerClass}>
        {isFactoryHost && (
          <div className="mr-3 p-1.5 rounded-lg bg-[#fbbf24]/10 border border-[#fbbf24]/20">
             <Building className="w-5 h-5 text-[#fbbf24]" />
          </div>
        )}
        <span className={textClass}>
          {isFactoryHost ? 'BLACK HORSE' : 
           isDemo ? 'Black Horse OS' : 
           isInstallWorxs ? 'Install Worxs' : 'The Vent Guys'}
        </span>
      </div>

      {/* Scrollable Nav Area */}
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {fullNav.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
              // Factory Host (Dark/Gold)
              isFactoryHost && (
                isActive 
                  ? "bg-[#fbbf24]/10 text-[#fbbf24] border border-[#fbbf24]/20 shadow-[0_0_15px_-3px_rgba(251,191,36,0.2)]" 
                  : "text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-transparent"
              ),
              // Demo Dark Mode Styling
              isDemo && (
                isActive
                  ? "bg-[#65a30d]/20 text-[#84cc16]"
                  : "text-[#a8a29e] hover:bg-[#292524] hover:text-[#e7e5e4]"
              ),
              // Install Worxs Vibrant Styling
              isInstallWorxs && (
                isActive
                  ? "bg-orange-50 text-orange-700"
                  : "text-slate-600 hover:bg-orange-50/50 hover:text-slate-900"
              ),
              // Default/TVG Styling
              !isFactoryHost && !isDemo && !isInstallWorxs && (
                isActive 
                  ? "bg-blue-50 text-blue-700" 
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )
            )}
          >
            {({ isActive }) => (
              <>
                <item.icon className={cn(
                  "w-5 h-5 transition-transform duration-300",
                  isActive && "scale-110",
                  isActive && isDemo && "animate-pulse"
                )} />
                {item.label}
              </>
            )}
          </NavLink>
        ))}
      </div>

      {/* Footer / User Area */}
      <div className={cn(
        "p-4 border-t",
        isFactoryHost ? "border-[#1e293b] bg-[#020617]" : 
        isDemo ? "border-[#44403c]" : 
        "border-slate-200"
      )}>
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ring-2 ring-offset-2 ring-offset-[#0f172a]",
            isFactoryHost ? "bg-[#fbbf24] text-black ring-[#fbbf24]/50" : 
            isDemo ? "bg-[#292524] text-[#a8a29e] ring-transparent" : 
            "bg-slate-100 text-slate-600 ring-transparent"
          )}>
            U
          </div>
          <div className="flex-1 min-w-0">
            <p className={cn(
              "text-sm font-medium truncate",
              isFactoryHost ? "text-slate-200" :
              isDemo ? "text-[#e7e5e4]" : "text-slate-900"
            )}>Admin User</p>
            <p className={cn(
              "text-xs truncate",
              isFactoryHost ? "text-[#fbbf24]" : "text-slate-500"
            )}>System Administrator</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BHFSidebar;
