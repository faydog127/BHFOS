
import React from 'react';
import EnterpriseLayout from '@/components/crm/EnterpriseLayout';
import { Card } from '@/components/ui/card';
import { Kanban } from 'lucide-react';

const DealsPage = () => {
  return (
    <EnterpriseLayout>
      <div className="h-full flex flex-col">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Deals Pipeline</h1>
          <p className="text-slate-500 mt-1">Manage deal stages and forecast revenue.</p>
        </div>

        <div className="flex-1 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 flex flex-col items-center justify-center text-slate-400">
           <div className="bg-white p-6 rounded-full shadow-sm mb-4">
              <Kanban className="w-12 h-12 text-indigo-200" />
           </div>
           <h3 className="text-xl font-bold text-slate-700">Pipeline View Placeholder</h3>
           <p className="max-w-md text-center mt-2 text-sm text-slate-500">
             This module will feature a drag-and-drop Kanban board for managing deal stages.
           </p>
        </div>
      </div>
    </EnterpriseLayout>
  );
};

export default DealsPage;
