
import React, { useState, useEffect } from 'react';
import { 
  Phone, Search, History, MoreVertical, PlayCircle, 
  MessageSquare, CheckCircle2, Menu, RefreshCw, Users
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';

// Import Sub-Components
import AgentSessionOverlay from '@/components/crm/call-console/AgentSessionOverlay';
import CallIntentSelector from '@/components/crm/call-console/CallIntentSelector';
import AiResponseGrid from '@/components/crm/call-console/AiResponseGrid';
import UnpreparedInput from '@/components/crm/call-console/UnpreparedInput';
import StreetViewPanel from '@/components/crm/call-console/StreetViewPanel';
import CoachingPanel from '@/components/crm/call-console/CoachingPanel';
import PostCallAutomation from '@/components/crm/call-console/PostCallAutomation';

// Mock Data
const MOCK_QUEUE = [
  { id: 1, name: 'Del-Air Heating and Air', contact: 'Corporate', location: 'Sanford', score: 98, type: 'HVAC', address: '123 Main St', city: 'Sanford', state: 'FL', zip: '32771' },
  { id: 2, name: 'Mechanical One', contact: 'Sales', location: 'Sanford', score: 95, type: 'HVAC', address: '456 Oak Ave', city: 'Sanford', state: 'FL', zip: '32771' },
  { id: 3, name: 'Ferran Services', contact: 'Dispatch', location: 'Orlando', score: 92, type: 'HVAC', address: '789 Pine Rd', city: 'Orlando', state: 'FL', zip: '32801' },
];

const ActiveCallView = ({ lead }) => {
  const { toast } = useToast();
  const [intent, setIntent] = useState(null);
  const [aiOptions, setAiOptions] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [selectedScriptRisk, setSelectedScriptRisk] = useState('low');

  // Timer for coaching
  useEffect(() => {
    const timer = setInterval(() => setCallDuration(prev => prev + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleIntentSelect = async (selectedIntentId) => {
    setIntent(selectedIntentId);
    setIsGenerating(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('generate-call-options', {
        body: { 
            call_type: selectedIntentId.includes('inbound') ? 'inbound' : 'outbound',
            customer_type: lead.type === 'HVAC' ? 'partner' : 'homeowner',
            call_purpose: selectedIntentId,
            prospect_info: { name: lead.name, location: lead.location }
        }
      });

      if (error) throw error;
      setAiOptions(data.options || []);
    } catch (err) {
      console.error(err);
      toast({ title: "AI Error", description: "Failed to generate scripts.", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleScriptSelect = (option) => {
    setSelectedScriptRisk(option.risk_level);
    toast({ title: "Script Selected", description: `Using: ${option.title}` });
    // Log selection to DB for A/B testing would happen here
  };

  return (
    <div className="flex flex-col h-full bg-white md:rounded-lg shadow-sm border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="p-4 md:p-6 border-b border-slate-100 bg-slate-50/50">
        <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 leading-tight break-words">
              {lead.name}
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <Badge variant="secondary" className="bg-slate-200 text-slate-700">
                <Users className="w-3 h-3 mr-1" /> {lead.contact}
              </Badge>
              <Badge variant="outline" className="border-slate-300 text-slate-600">
                <Search className="w-3 h-3 mr-1" /> {lead.location}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-2 xl:self-start mt-2 xl:mt-0">
            <Button size="lg" className="bg-green-600 hover:bg-green-700 text-white shadow-md w-full xl:w-auto flex-1 xl:flex-none justify-center">
              <Phone className="w-4 h-4 mr-2" /> <span className="font-semibold">Dial Now</span>
            </Button>
            <Button variant="outline" size="icon" className="shrink-0"><MoreVertical className="w-4 h-4 text-slate-500" /></Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <ScrollArea className="flex-1 p-4 md:p-6 bg-white">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left: Scripting & AI */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-slate-200 shadow-sm">
                <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Call Intent</CardTitle>
                </CardHeader>
                <CardContent>
                    <CallIntentSelector selectedIntent={intent} onSelect={handleIntentSelect} />
                </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-indigo-50 to-white border-indigo-100 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                   <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                     <PlayCircle className="w-6 h-6 text-indigo-600" />
                   </div>
                   <div>
                     <CardTitle className="text-lg text-indigo-950">AI Copilot</CardTitle>
                     <CardDescription>Dynamic script generation</CardDescription>
                   </div>
                </div>
              </CardHeader>
              <CardContent>
                <AiResponseGrid 
                    options={aiOptions} 
                    isGenerating={isGenerating} 
                    onSelectResponse={handleScriptSelect} 
                />
                <CoachingPanel intent={intent} callDuration={callDuration} selectedScriptRisk={selectedScriptRisk} />
              </CardContent>
            </Card>

            <UnpreparedInput callId="temp-id" />
          </div>

          {/* Right: Intel & Actions */}
          <div className="space-y-6">
             <StreetViewPanel address={lead.address} city={lead.city} state={lead.state} zip={lead.zip} />
             
             <Card>
                <CardHeader><CardTitle className="text-sm">Post-Call Actions</CardTitle></CardHeader>
                <CardContent>
                    <PostCallAutomation leadId={lead.id} />
                </CardContent>
             </Card>

             <div className="space-y-4">
                <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-slate-400" /> Log Interaction
                </h3>
                <div className="grid gap-4">
                   <select className="flex h-10 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
                      <option>Select Outcome...</option>
                      <option>Connected</option>
                      <option>Voicemail</option>
                   </select>
                   <textarea className="flex min-h-[100px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm" placeholder="Notes..." />
                   <Button className="w-full bg-blue-600 text-white">Log Call</Button>
                </div>
             </div>
          </div>

        </div>
      </ScrollArea>
    </div>
  );
};

const SmartCallConsole = () => {
  const [sessionActive, setSessionActive] = useState(false);
  const [agentInfo, setAgentInfo] = useState(null);
  const [selectedLead, setSelectedLead] = useState(MOCK_QUEUE[0]);
  const [isQueueOpen, setIsQueueOpen] = useState(false);

  const handleSessionStart = (info) => {
    setAgentInfo(info);
    setSessionActive(true);
  };

  if (!sessionActive) {
    return <AgentSessionOverlay onSessionStart={handleSessionStart} />;
  }

  return (
    <div className="h-[calc(100vh-64px)] lg:h-screen w-full bg-slate-100 flex overflow-hidden">
      {/* Sidebar Queue */}
      <aside className="hidden xl:flex w-80 flex-col bg-white border-r border-slate-200 shrink-0 z-10">
        <QueueListContent selectedLead={selectedLead} onSelect={setSelectedLead} />
      </aside>

      <Sheet open={isQueueOpen} onOpenChange={setIsQueueOpen}>
        <SheetContent side="left" className="p-0 w-80">
          <QueueListContent selectedLead={selectedLead} onSelect={(lead) => {
            setSelectedLead(lead);
            setIsQueueOpen(false);
          }} />
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-slate-100 relative">
        <div className="xl:hidden h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 shrink-0">
           <Button variant="ghost" size="sm" className="gap-2 text-slate-600" onClick={() => setIsQueueOpen(true)}>
             <Menu className="w-5 h-5" /> <span className="font-semibold">Queue</span>
           </Button>
           <span className="font-bold text-slate-900 truncate max-w-[150px]">{selectedLead?.name}</span>
           <div className="w-8" />
        </div>

        <div className="flex-1 p-2 md:p-4 lg:p-6 overflow-hidden">
          <div className="h-full max-w-7xl mx-auto">
             <ActiveCallView lead={selectedLead} />
          </div>
        </div>
      </main>
    </div>
  );
};

const QueueListContent = ({ selectedLead, onSelect }) => (
  <div className="flex flex-col h-full">
    <div className="p-4 border-b border-slate-100">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold text-lg flex items-center gap-2">
          <Phone className="w-5 h-5 text-blue-600" /> Call Queue
        </h2>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-blue-600">
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input placeholder="Search queue..." className="pl-9 bg-slate-50 border-slate-200" />
      </div>
    </div>
    <ScrollArea className="flex-1">
      <div className="p-2 space-y-1">
        {MOCK_QUEUE.map((lead) => (
          <div 
            key={lead.id}
            onClick={() => onSelect(lead)}
            className={cn(
              "p-3 rounded-lg cursor-pointer transition-all border border-transparent",
              selectedLead?.id === lead.id 
                ? "bg-blue-50 border-blue-200 shadow-sm" 
                : "hover:bg-slate-50 hover:border-slate-100"
            )}
          >
            <div className="flex justify-between items-start mb-1">
              <span className={cn("font-semibold text-sm line-clamp-1", selectedLead?.id === lead.id ? "text-blue-700" : "text-slate-900")}>{lead.name}</span>
              <span className={cn("text-xs font-bold px-1.5 py-0.5 rounded", lead.score > 90 ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700")}>{lead.score}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Users className="w-3 h-3" /> <span>{lead.contact}</span>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  </div>
);

export default SmartCallConsole;
