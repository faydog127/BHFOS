import React from 'react';
import EstimateManager from '@/components/crm/estimates/EstimateManager';

const Quotes = () => {
  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
        <div>
            <h1 className="text-3xl font-bold text-slate-900">Quotes & Proposals</h1>
            <p className="text-slate-500 mt-2">Manage customer estimates and formal proposals.</p>
        </div>
        
        <EstimateManager />
        
        {/* Placeholder for list of existing quotes could go here */}
    </div>
  );
};

export default Quotes;