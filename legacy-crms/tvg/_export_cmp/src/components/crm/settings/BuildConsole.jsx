import React from 'react';
import { Helmet } from 'react-helmet';
import SystemDoctorConsole from '@/components/SystemDoctorConsole';

const BuildConsole = () => {
  return (
    // Enforce dark background on the page wrapper to prevent white flashes
    // or gaps if the inner component has margins.
    <div className="min-h-screen bg-slate-950 text-slate-200 w-full">
      <Helmet>
        <title>System Doctor Console | Admin Settings</title>
        <meta name="description" content="Advanced system diagnostics, automated repair, and infrastructure health monitoring." />
      </Helmet>
      
      {/* 
        The SystemDoctorConsole component is self-contained with its own 
        dark theme styling (bg-slate-950, emerald accents, etc.) 
      */}
      <SystemDoctorConsole />
    </div>
  );
};

export default BuildConsole;