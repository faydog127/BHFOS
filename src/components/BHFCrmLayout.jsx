
import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import BHFSidebar from '@/components/BHFSidebar';
import { cn } from '@/lib/utils';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';

const BHFCrmLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const TENANT_ID = import.meta.env.VITE_TENANT_ID || 'default';
  
  const isDemo = TENANT_ID === 'demo';
  const isInstallWorxs = TENANT_ID === 'installworxs';

  // THEME CONFIGURATION
  let mainWrapperClass = "bg-slate-50 min-h-screen text-slate-900";
  let contentAreaClass = "p-4 lg:p-8 max-w-[1920px] mx-auto transition-all duration-200 ease-in-out lg:ml-64 relative z-0";
  let mobileHeaderClass = "lg:hidden sticky top-0 z-30 px-4 h-16 flex items-center justify-between border-b bg-white border-slate-200";
  let sidebarWrapperClass = "fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-200 ease-in-out lg:translate-x-0";

  if (isDemo) {
    // Farm/Factory Dark Theme
    mainWrapperClass = "bg-[#1c1917] text-[#e7e5e4] min-h-screen selection:bg-[#65a30d]/30 font-sans";
    contentAreaClass = "p-4 lg:p-8 max-w-[1920px] mx-auto transition-all duration-200 ease-in-out lg:ml-64 relative z-0 text-[#e7e5e4]";
    mobileHeaderClass = "lg:hidden sticky top-0 z-30 px-4 h-16 flex items-center justify-between border-b bg-[#1c1917]/90 border-[#44403c] backdrop-blur-md";
    sidebarWrapperClass += " border-r border-[#44403c] shadow-[4px_0_24px_-12px_rgba(0,0,0,0.5)]";
  } else if (isInstallWorxs) {
    // Vibrant Install Worxs Theme
    mainWrapperClass = "bg-slate-50 min-h-screen text-slate-900 selection:bg-orange-200";
    contentAreaClass = "p-4 lg:p-8 max-w-[1920px] mx-auto transition-all duration-200 ease-in-out lg:ml-64 relative z-0";
    mobileHeaderClass = "lg:hidden sticky top-0 z-30 px-4 h-16 flex items-center justify-between border-b bg-white/80 backdrop-blur-md border-orange-100";
    sidebarWrapperClass += " border-r border-orange-100 shadow-xl shadow-orange-500/5";
  }

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
        <BHFSidebar />
      </div>

      {/* Mobile Header */}
      <div className={mobileHeaderClass}>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
            <Menu className={cn("w-6 h-6", isDemo ? "text-[#a8a29e]" : "text-slate-600")} />
          </Button>
          <span className={cn("font-bold", isDemo ? "text-[#e7e5e4]" : "text-slate-900")}>
            {isDemo ? "Farm OS" : (isInstallWorxs ? "Install Worxs" : "BHF CRM")}
          </span>
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
    </div>
  );
};

export default BHFCrmLayout;
