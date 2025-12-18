
import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, Phone, Users, Target, Briefcase, 
  BarChart3, Settings, HelpCircle, ChevronLeft 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import brandConfig from '@/config/bhf.config.json';

const EnterpriseSidebar = ({ isOpen, toggleSidebar }) => {
  const location = useLocation();
  const TENANT_ID = import.meta.env.VITE_TENANT_ID || 'default';
  
  // Resolve Tenant Config
  const tenantConfig = brandConfig.tenants[TENANT_ID] || brandConfig.tenants.default;
  const brandName = tenantConfig.name;
  const primaryColor = tenantConfig.branding.primary_color || '#4f46e5';

  const navItems = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/bhf/crm', exact: true },
    { name: 'Calls', icon: Phone, path: '/bhf/crm/call-console' },
    { name: 'Contacts', icon: Users, path: '/bhf/crm/contacts' },
    { name: 'Leads', icon: Target, path: '/bhf/crm/leads' },
    { name: 'Deals', icon: Briefcase, path: '/bhf/crm/pipeline' },
    { name: 'Reports', icon: BarChart3, path: '/bhf/crm/reporting' },
    { name: 'Settings', icon: Settings, path: '/bhf/crm/settings' },
  ];

  return (
    <aside 
      className={cn(
        "bg-slate-900 text-slate-300 flex flex-col transition-all duration-300 ease-in-out border-r border-slate-800 relative z-30 h-full",
        isOpen ? "w-[260px]" : "w-[70px]"
      )}
    >
      {/* Brand Logo Area */}
      <div className="h-16 flex items-center px-4 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-3 overflow-hidden">
          <div 
            className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 shadow-lg"
            style={{ backgroundColor: primaryColor }}
          >
            <span className="text-white font-bold text-lg">{brandName.charAt(0)}</span>
          </div>
          <span className={cn("font-bold text-lg text-white whitespace-nowrap transition-opacity duration-300", !isOpen && "opacity-0 w-0")}>
            {brandName}
          </span>
        </div>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 py-4">
        <nav className="space-y-1 px-3">
          {navItems.map((item) => {
            const isActive = item.exact 
              ? location.pathname === item.path 
              : location.pathname.startsWith(item.path);
            
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md transition-all duration-200 group relative",
                  isActive 
                    ? "text-white shadow-md font-medium" 
                    : "hover:bg-slate-800 hover:text-white text-slate-400"
                )}
                style={isActive ? { backgroundColor: primaryColor } : {}}
                title={!isOpen ? item.name : undefined}
              >
                <item.icon className={cn("h-5 w-5 shrink-0 transition-colors", isActive ? "text-white" : "group-hover:text-white")} />
                <span className={cn("whitespace-nowrap overflow-hidden transition-all duration-300", !isOpen && "w-0 opacity-0")}>
                  {item.name}
                </span>
                
                {/* Active Indicator Strip for Collapsed State */}
                {!isOpen && isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-1 rounded-r-full bg-white" />
                )}
              </NavLink>
            );
          })}
        </nav>
      </ScrollArea>

      {/* Bottom Actions */}
      <div className="p-4 border-t border-slate-800 shrink-0">
        <div className="mt-4 flex justify-end">
           <Button 
             variant="ghost" 
             size="sm" 
             onClick={toggleSidebar} 
             className="text-slate-500 hover:text-white hover:bg-slate-800 w-full"
           >
             {isOpen ? <div className="flex items-center gap-2"><ChevronLeft className="h-4 w-4" /> <span>Collapse</span></div> : <ChevronLeft className="h-4 w-4 rotate-180" />}
           </Button>
        </div>
      </div>
    </aside>
  );
};

export default EnterpriseSidebar;
