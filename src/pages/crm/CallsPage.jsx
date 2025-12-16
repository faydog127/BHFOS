
import React from 'react';
import EnterpriseLayout from '@/components/crm/EnterpriseLayout';
import SmartCallConsoleUltimate from '@/pages/crm/SmartCallConsoleUltimate'; // Reuse the logic, wrap in layout
import { Helmet } from 'react-helmet';

const CallsPage = () => {
  return (
    <EnterpriseLayout>
      <Helmet>
        <title>Smart Call Console | CRM</title>
      </Helmet>
      
      <div className="h-full flex flex-col gap-4">
        {/* We reuse the Ultimate Console but strip its internal full-page layout constraints if necessary, 
            or just embed it. Since SmartCallConsoleUltimate has its own header, we might want to tweak it 
            or just let it sit inside. For now, direct embedding is fine as a feature view. */}
        <div className="flex-1 overflow-hidden border rounded-xl shadow-sm bg-white">
           <SmartCallConsoleUltimate />
        </div>
      </div>
    </EnterpriseLayout>
  );
};

export default CallsPage;
