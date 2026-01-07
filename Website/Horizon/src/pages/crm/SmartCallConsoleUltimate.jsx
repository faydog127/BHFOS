
import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { 
  Phone, Mic, Layout, Settings, History, BarChart3, 
  MessageSquare, User, Calendar, Mail, Zap, CheckCircle2,
  ChevronRight, GripVertical, Volume2, Video, Pause, Play
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

import PreCallBrief from '@/components/crm/call-console/PreCallBrief';
import AiCopilot from '@/components/crm/call-console/AiCopilot';
import CallLog from '@/components/crm/call-console/CallLog';
import LeadList from '@/components/crm/call-console/LeadList';

// -- COMPONENT: MODULAR SECTION WRAPPER --
const ModularSection = ({ title, icon: Icon, children, isEnabled = true, onToggle }) => {
  if (!isEnabled) return null;
  return (
    <Card className="h-full flex flex-col border-slate-200 shadow-sm overflow-hidden">
      <CardHeader className="py-3 px-4 bg-slate-50 border-b flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4 text-slate-500" />}
          <CardTitle className="text-sm font-semibold text-slate-800">{title}</CardTitle>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400">
           <Settings className="w-3 h-3" />
        </Button>
      </CardHeader>
      <CardContent className="p-0 flex-1 relative overflow-hidden flex flex-col">
        {children}
      </CardContent>
    </Card>
  );
};

const SmartCallConsoleUltimate = () => {
  // State for layout customization
  const [layoutConfig, setLayoutConfig] = useState({
    showQueue: true,
    showHistory: true,
    showCopilot: true,
    showBrief: true,
    showControls: true
  });

  const [activeCall, setActiveCall] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);

  // Mock toggle handler
  const toggleSection = (key) => {
    setLayoutConfig(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="h-[calc(100vh-64px)] bg-slate-100 flex flex-col overflow-hidden">
      <Helmet><title>Smart Call Console Ultimate | CRM</title></Helmet>

      {/* TOP BAR: GLOBAL CONTROLS & STATUS */}
      <div className="bg-white border-b px-4 py-3 flex justify-between items-center shrink-0 z-20 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-slate-800 font-bold text-lg">
             <Phone className="w-5 h-5 text-indigo-600" />
             <span>Smart Console <span className="text-indigo-600">Ultimate</span></span>
          </div>
          <Separator orientation="vertical" className="h-6" />
          <div className="flex items-center gap-2">
             <Badge variant={activeCall ? "destructive" : "secondary"} className="animate-pulse">
                {activeCall ? 'ON CALL' : 'READY'}
             </Badge>
             {selectedLead && (
               <span className="text-sm text-slate-600">
                 Active Lead: <strong>{selectedLead.first_name} {selectedLead.last_name}</strong>
               </span>
             )}
          </div>
        </div>

        <div className="flex items-center gap-4">
           {/* Quick Call Controls */}
           <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
              <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-500 hover:text-red-500 hover:bg-white" title="Mute">
                 <Mic className="w-4 h-4" />
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-500 hover:text-blue-500 hover:bg-white" title="Hold">
                 <Pause className="w-4 h-4" />
              </Button>
              <div className="w-24 px-2">
                 <Slider defaultValue={[75]} max={100} step={1} className="h-4" />
              </div>
              <Button 
                size="sm" 
                className={`h-8 px-4 font-bold shadow-sm transition-colors ${activeCall ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}
                onClick={() => setActiveCall(!activeCall)}
              >
                 {activeCall ? 'End Call' : 'Dial'}
              </Button>
           </div>
           
           {/* Layout Settings Trigger */}
           <Button variant="outline" size="sm" className="gap-2">
             <Layout className="w-4 h-4" /> Layout
           </Button>
        </div>
      </div>

      {/* MAIN WORKSPACE GRID */}
      <div className="flex-1 p-4 grid grid-cols-12 gap-4 min-h-0 overflow-hidden">
         
         {/* LEFT COLUMN: QUEUE & HISTORY (Resizable usually, fixed for now) */}
         <div className="col-span-12 lg:col-span-3 flex flex-col gap-4 h-full min-h-0">
            {layoutConfig.showQueue && (
               <div className="flex-1 min-h-0 flex flex-col">
                 <ModularSection title="Lead Queue" icon={User}>
                    <LeadList 
                      leads={[]} // Would pass real leads here
                      selectedLead={selectedLead}
                      onSelectLead={setSelectedLead}
                      loading={false}
                      activeTab="Hot"
                      setActiveTab={() => {}}
                      isFindingLeads={false}
                      onFindNewLeads={() => {}}
                    />
                 </ModularSection>
               </div>
            )}
            
            {layoutConfig.showHistory && (
               <div className="h-1/3 min-h-[200px]">
                 <ModularSection title="Interaction History" icon={History}>
                    <CallLog lead={selectedLead} />
                 </ModularSection>
               </div>
            )}
         </div>

         {/* MIDDLE COLUMN: CONTEXT & BRIEF */}
         <div className="col-span-12 lg:col-span-5 flex flex-col h-full min-h-0">
             {selectedLead ? (
                <ModularSection title="Active Context" icon={Layout}>
                   <div className="flex-1 overflow-hidden">
                     <PreCallBrief 
                       lead={selectedLead} 
                       onStartCall={() => setActiveCall(true)} 
                     />
                   </div>
                </ModularSection>
             ) : (
                <div className="flex-1 flex items-center justify-center border-2 border-dashed border-slate-300 rounded-lg bg-slate-50">
                   <div className="text-center text-slate-400">
                      <User className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>Select a lead to view context</p>
                   </div>
                </div>
             )}
         </div>

         {/* RIGHT COLUMN: AI & TOOLS */}
         <div className="col-span-12 lg:col-span-4 flex flex-col h-full min-h-0">
            {layoutConfig.showCopilot && (
               <ModularSection title="AI Copilot" icon={Zap}>
                  <AiCopilot activeCall={activeCall} />
               </ModularSection>
            )}
         </div>

      </div>

      {/* FOOTER: PERSISTENT METRICS */}
      <div className="bg-slate-900 text-slate-400 px-4 py-1 text-xs flex justify-between items-center shrink-0">
         <div className="flex gap-4">
            <span>Connection: <span className="text-emerald-500 font-bold">Stable (12ms)</span></span>
            <span>Microphone: <span className="text-white">Default Input</span></span>
         </div>
         <div className="flex gap-4">
            <span>Daily Calls: <span className="text-white font-bold">42</span></span>
            <span>Talk Time: <span className="text-white font-bold">3h 12m</span></span>
         </div>
      </div>
    </div>
  );
};

export default SmartCallConsoleUltimate;
