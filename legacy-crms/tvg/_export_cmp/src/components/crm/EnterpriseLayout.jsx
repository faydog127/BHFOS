import React, { useState } from 'react';
import EnterpriseSidebar from './EnterpriseSidebar';
import EnterpriseHeader from './EnterpriseHeader';
import EnterpriseStatusBar from './EnterpriseStatusBar';

const EnterpriseLayout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans text-slate-900">
      {/* Sidebar */}
      <EnterpriseSidebar isOpen={sidebarOpen} toggleSidebar={toggleSidebar} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Header */}
        <EnterpriseHeader toggleSidebar={toggleSidebar} sidebarOpen={sidebarOpen} />

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-6 md:p-8 pb-14 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
          <div className="max-w-[1600px] mx-auto h-full flex flex-col animate-in fade-in duration-500">
            {children}
          </div>
        </main>

        {/* Persistent Footer Status Bar */}
        <EnterpriseStatusBar />
      </div>
    </div>
  );
};

export default EnterpriseLayout;