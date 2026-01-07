import React from 'react';
import EnterpriseLayout from '@/components/crm/EnterpriseLayout';
import { BarChart3 } from 'lucide-react';

const ReportsPage = () => {
  return (
    <EnterpriseLayout>
      <div className="h-full flex flex-col">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Reports & Analytics</h1>
          <p className="text-slate-500 mt-1">Deep insights into business performance.</p>
        </div>

        <div className="flex-1 grid grid-cols-2 gap-6">
           <div className="border border-slate-200 rounded-xl bg-white p-6 flex flex-col items-center justify-center shadow-sm">
              <div className="w-full h-40 bg-slate-50 rounded-lg flex items-center justify-center mb-4 border border-slate-100">
                 <BarChart3 className="text-slate-300 w-8 h-8" />
              </div>
              <span className="text-slate-500 font-semibold text-sm">Sales Performance Chart</span>
           </div>
           <div className="border border-slate-200 rounded-xl bg-white p-6 flex flex-col items-center justify-center shadow-sm">
              <div className="w-full h-40 bg-slate-50 rounded-lg flex items-center justify-center mb-4 border border-slate-100">
                 <BarChart3 className="text-slate-300 w-8 h-8" />
              </div>
              <span className="text-slate-500 font-semibold text-sm">Lead Conversion Chart</span>
           </div>
           <div className="col-span-2 border border-slate-200 rounded-xl bg-white p-6 flex flex-col items-center justify-center h-64 shadow-sm">
              <div className="w-full h-full bg-slate-50 rounded-lg flex items-center justify-center mb-4 border border-slate-100">
                 <BarChart3 className="text-slate-300 w-12 h-12" />
              </div>
              <span className="text-slate-500 font-semibold text-sm">Revenue Forecast</span>
           </div>
        </div>
      </div>
    </EnterpriseLayout>
  );
};

export default ReportsPage;