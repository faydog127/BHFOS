
import React from 'react';
import { Helmet } from 'react-helmet';
import AnalyticsDashboard from '@/pages/crm/AnalyticsDashboard';
import { getTenantConfig } from '@/lib/tenantUtils';

const Reporting = () => {
  const config = getTenantConfig();
  
  return (
    <div className="h-full flex flex-col bg-slate-50">
        <Helmet>
            <title>Reports & Analytics | {config.name}</title>
        </Helmet>
        <div className="p-6">
            <AnalyticsDashboard />
        </div>
    </div>
  );
};

export default Reporting;
