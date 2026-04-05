import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LayoutDashboard, Radio, BarChart3, Megaphone } from 'lucide-react';

import SignalsMonitor from '@/components/crm/marketing/SignalsMonitor';
import DraftsBoard from '@/components/crm/marketing/DraftsBoard';
import MarketingAnalyticsV2 from '@/components/crm/marketing/MarketingAnalyticsV2';
import CampaignsManager from '@/components/crm/marketing/CampaignsManager'; // Existing component

const MarketingHub = () => {
  const [activeTab, setActiveTab] = useState('command');

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-slate-50">
      <Helmet>
        <title>Marketing Hub | AI Command Center</title>
      </Helmet>

      {/* Header */}
      <div className="flex-none bg-white border-b px-6 py-4 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Marketing Hub</h1>
          <p className="text-sm text-slate-500">AI-Driven Campaign Management & Analytics</p>
        </div>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-[400px]">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="command"><LayoutDashboard className="w-4 h-4 mr-2"/> Command</TabsTrigger>
            <TabsTrigger value="analytics"><BarChart3 className="w-4 h-4 mr-2"/> Analytics</TabsTrigger>
            <TabsTrigger value="campaigns"><Megaphone className="w-4 h-4 mr-2"/> Campaigns</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden p-6">
        
        {/* TAB: COMMAND CENTER */}
        <TabsContent value="command" className="h-full m-0 data-[state=active]:flex gap-6">
          
          {/* Left Panel: Signals (25%) */}
          <div className="w-[300px] flex-none flex flex-col gap-4">
            <div className="font-semibold text-slate-700 flex items-center gap-2">
              <Radio className="w-4 h-4" /> Market Signals
            </div>
            <div className="flex-1 bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
               <SignalsMonitor />
            </div>
          </div>

          {/* Right Panel: Drafts Board (75%) */}
          <div className="flex-1 flex flex-col gap-4 min-w-0">
             <DraftsBoard />
          </div>

        </TabsContent>

        {/* TAB: ANALYTICS */}
        <TabsContent value="analytics" className="h-full overflow-y-auto m-0">
          <div className="max-w-6xl mx-auto space-y-6">
             <MarketingAnalyticsV2 />
          </div>
        </TabsContent>

        {/* TAB: CAMPAIGNS */}
        <TabsContent value="campaigns" className="h-full overflow-y-auto m-0">
           <div className="bg-white rounded-xl border p-6 shadow-sm min-h-full">
              <CampaignsManager />
           </div>
        </TabsContent>

      </div>
    </div>
  );
};

export default MarketingHub;