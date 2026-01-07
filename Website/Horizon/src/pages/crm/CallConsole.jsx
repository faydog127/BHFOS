
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { 
  Phone, Search, Menu, RefreshCw, Users, ShieldAlert,
  Layout, Zap, MessageSquare, PlayCircle, MoreVertical,
  Database, PlusCircle
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
import { getTenantId } from '@/lib/tenantUtils';
import { useTrainingMode } from '@/contexts/TrainingModeContext';

// Sub-Components
import AgentSessionOverlay from '@/components/crm/call-console/AgentSessionOverlay';
import CallIntentSelector from '@/components/crm/call-console/CallIntentSelector';
import AiResponseGrid from '@/components/crm/call-console/AiResponseGrid';
import UnpreparedInput from '@/components/crm/call-console/UnpreparedInput';
import StreetViewPanel from '@/components/crm/call-console/StreetViewPanel';
import CoachingPanel from '@/components/crm/call-console/CoachingPanel';
import PostCallAutomation from '@/components/crm/call-console/PostCallAutomation';
import SystemModeToggle from '@/components/SystemModeToggle';

const ActiveCallView = ({ lead, isTrainingMode }) => {
  const { toast } = useToast();
  const [intent, setIntent] = useState(null);
  const [aiOptions, setAiOptions] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [selectedScriptRisk, setSelectedScriptRisk] = useState('low');
  const [activeCall, setActiveCall] = useState(false);

  // Call Timer
  useEffect(() => {
    let timer;
    if (activeCall) {
      timer = setInterval(() => setCallDuration(prev => prev + 1), 1000);
    } else {
      setCallDuration(0);
    }
    return () => clearInterval(timer);
  }, [activeCall]);

  // Reset when lead changes
  useEffect(() => {
    setIntent(null);
    setAiOptions([]);
    setActiveCall(false);
    setSelectedScriptRisk('low');
  }, [lead?.id]);

  const handleIntentSelect = async (selectedIntentId) => {
    setIntent(selectedIntentId);
    setIsGenerating(true);
    
    try {
      // In training mode, we might want to simulate latency or force specific responses
      // but for now we use the real AI function as it helps test the prompt engineering
      const { data, error } = await supabase.functions.invoke('generate-call-options', {
        body: { 
            call_type: selectedIntentId.includes('inbound') ? 'inbound' : 'outbound',
            customer_type: lead.type === 'Property Manager' ? 'partner' : 'homeowner',
            call_purpose: selectedIntentId,
            prospect_info: { 
              name: `${lead.first_name} ${lead.last_name}`, 
              location: `${lead.city}, ${lead.state}` 
            }
        }
      });

      if (error) throw error;
      setAiOptions(data.options || []);
    } catch (err) {
      console.error(err);
      // Fallback data for demo/training stability if AI fails
      setAiOptions([
        { title: "Empathetic Opening", tone: "Empathetic", script: "I noticed you've been having some humidity issues in the area. How is your system holding up?", risk_level: "low" },
        { title: "Direct Value", tone: "Direct", script: "We're doing certified air checks in Melbourne today. Can I stop by for 10 minutes?", risk_level: "medium" },
        { title: "Urgency", tone: "Urgent", script: "We found a major mold issue at a neighbor's property. Just wanted to alert you.", risk_level: "high" },
        { title: "Curiosity", tone: "Curious", script: "When was the last time you actually saw inside your ductwork?", risk_level: "low" },
      ]);
      
      if (!isTrainingMode) {
         toast({ title: "AI Error", description: "Using offline script backup.", variant: "destructive" });
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleScriptSelect = async (option, index) => {
    setSelectedScriptRisk(option.risk_level);
    toast({ title: "Script Selected", description: `Using: ${option.title}` });
    
    if (isTrainingMode) {
        // In training mode, don't pollute real A/B tests
        console.log("Training Mode: Script selection logged locally only.", option);
    } else {
        await supabase.from('call_a_b_tests').insert({
            call_type: intent?.includes('inbound') ? 'inbound' : 'outbound',
            customer_type: lead.type === 'Property Manager' ? 'partner' : 'homeowner',
            call_purpose: intent || 'unknown',
            selected_option_index: index,
            response_text: option.script,
            response_tone: option.tone,
            outcome: 'selected' 
        });
    }
  };

  const toggleCall = () => {
    if (activeCall) {
      setActiveCall(false);
      toast({ title: "Call Ended", description: "Don't forget to log the outcome!" });
    } else {
      setActiveCall(true);
      toast({ title: "Dialing...", description: `Calling ${lead.phone} ${isTrainingMode ? '(Simulated)' : ''}` });
    }
  };

  if (!lead) return <div className="p-8 text-center text-slate-400">Select a lead to begin</div>;

  return (
    <div className="flex flex-col h-full bg-white md:rounded-lg shadow-sm border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className={cn("p-4 md:p-6 border-b border-slate-100 transition-colors", isTrainingMode ? "bg-amber-50/50" : "bg-slate-50/50")}>
        <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 leading-tight break-words flex items-center gap-2">
              {lead.first_name} {lead.last_name}
              {isTrainingMode && <Badge variant="outline" className="border-amber-400 text-amber-600 text-[10px]">TEST LEAD</Badge>}
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <Badge variant="secondary" className="bg-slate-200 text-slate-700">
                <Users className="w-3 h-3 mr-1" /> {lead.company || 'Residential'}
              </Badge>
              <Badge variant="outline" className="border-slate-300 text-slate-600">
                <Search className="w-3 h-3 mr-1" /> {lead.city}, {lead.state}
              </Badge>
               {activeCall && (
                  <Badge variant="destructive" className="animate-pulse">
                     ON CALL: {Math.floor(callDuration / 60)}:{(callDuration % 60).toString().padStart(2, '0')}
                  </Badge>
               )}
            </div>
          </div>
          <div className="flex items-center gap-2 xl:self-start mt-2 xl:mt-0">
            <Button 
              size="lg" 
              className={cn("shadow-md w-full xl:w-auto flex-1 xl:flex-none justify-center transition-colors", activeCall ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700")}
              onClick={toggleCall}
            >
              <Phone className="w-4 h-4 mr-2" /> <span className="font-semibold">{activeCall ? 'End Call' : 'Dial Now'}</span>
            </Button>
            <Button variant="outline" size="icon" className="shrink-0"><MoreVertical className="w-4 h-4 text-slate-500" /></Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <ScrollArea className="flex-1 bg-white">
        <div className="p-4 md:p-6 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left: Scripting & AI */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-slate-200 shadow-sm">
                <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Call Intent</CardTitle>
                    <CardDescription>Select the purpose of this call to prime the AI.</CardDescription>
                </CardHeader>
                <CardContent>
                    <CallIntentSelector selectedIntent={intent} onSelect={handleIntentSelect} />
                </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-indigo-50 to-white border-indigo-100 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                 <Zap className="w-32 h-32" />
              </div>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                   <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center shadow-sm">
                     <PlayCircle className="w-6 h-6 text-indigo-600" />
                   </div>
                   <div>
                     <CardTitle className="text-lg text-indigo-950">AI Copilot</CardTitle>
                     <CardDescription>Dynamic script generation based on {intent ? intent.replace(/_/g, ' ') : 'intent'}</CardDescription>
                   </div>
                </div>
              </CardHeader>
              <CardContent className="relative z-10">
                <AiResponseGrid 
                    options={aiOptions} 
                    isGenerating={isGenerating} 
                    onSelectResponse={handleScriptSelect} 
                />
                <CoachingPanel intent={intent} callDuration={callDuration} selectedScriptRisk={selectedScriptRisk} />
              </CardContent>
            </Card>

            <UnpreparedInput callId={activeCall ? 'active' : 'post'} />
          </div>

          {/* Right: Intel & Actions */}
          <div className="space-y-6">
             <StreetViewPanel address={lead.address1} city={lead.city} state={lead.state} zip={lead.zip} />
             
             <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm uppercase tracking-wide text-slate-500">Post-Call Automation</CardTitle></CardHeader>
                <CardContent>
                    <PostCallAutomation leadId={lead.id} />
                </CardContent>
             </Card>

             <div className="space-y-4">
                <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-slate-400" /> Log Interaction
                </h3>
                <Card className="bg-slate-50 border-slate-200">
                    <CardContent className="p-4 space-y-3">
                        <select className="flex h-10 w-full items-center justify-between rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500">
                            <option>Select Outcome...</option>
                            <option>Connected - Positive</option>
                            <option>Connected - Not Interested</option>
                            <option>Left Voicemail</option>
                            <option>Wrong Number</option>
                            <option>Booked Appointment</option>
                        </select>
                        <textarea 
                            className="flex min-h-[100px] w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" 
                            placeholder="Call notes..." 
                        />
                        <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white shadow-sm">Log & Next Lead</Button>
                    </CardContent>
                </Card>
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
  const [selectedLead, setSelectedLead] = useState(null);
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Use Training Mode Hook
  const { isTrainingMode } = useTrainingMode();
  const tenantId = getTenantId();
  const { toast } = useToast();

  useEffect(() => {
    fetchLeads();
  }, [tenantId, isTrainingMode]); // Refetch when mode toggles

  const fetchLeads = async () => {
    setLoading(true);
    try {
        let query = supabase
        .from('leads')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(20);

        // Filter based on toggle
        if (isTrainingMode) {
            query = query.eq('is_test_data', true);
        } else {
            // In live mode, we might want to hide test data, or show mixed. 
            // Usually we hide test data in live view.
            query = query.or('is_test_data.eq.false,is_test_data.is.null');
        }

        const { data, error } = await query;
        
        if (error) throw error;
        setLeads(data || []);
        
        // Auto-select first lead if none selected or if switching modes invalidates current selection
        if (data?.length > 0) {
             if (!selectedLead || (selectedLead.is_test_data !== isTrainingMode)) {
                 setSelectedLead(data[0]);
             }
        } else {
             setSelectedLead(null);
        }

    } catch (e) {
        console.error(e);
        toast({ title: "Error fetching queue", description: e.message, variant: "destructive" });
    } finally {
        setLoading(false);
    }
  };

  const seedTrainingData = async () => {
    setLoading(true);
    try {
        const { error } = await supabase.rpc('seed_training_data');
        if (error) throw error;
        toast({ title: "Success", description: "Generated training leads!", duration: 3000 });
        await fetchLeads();
    } catch (e) {
        console.error(e);
        toast({ title: "Seeding Failed", description: e.message, variant: "destructive" });
        setLoading(false);
    }
  };

  const handleSessionStart = (info) => {
    setAgentInfo(info);
    setSessionActive(true);
    toast({ title: "Session Started", description: `Logged in as ${info.agentName}` });
  };

  if (!sessionActive) {
    return <AgentSessionOverlay onSessionStart={handleSessionStart} />;
  }

  return (
    <div className="h-[calc(100vh-64px)] lg:h-screen w-full bg-slate-100 flex overflow-hidden font-sans">
      <Helmet>
        <title>Smart Console | CRM</title>
      </Helmet>

      {/* Sidebar Queue */}
      <aside className="hidden xl:flex w-80 flex-col bg-white border-r border-slate-200 shrink-0 z-10 h-full">
        <QueueListContent 
            leads={leads} 
            selectedLead={selectedLead} 
            onSelect={setSelectedLead} 
            onRefresh={fetchLeads} 
            loading={loading}
            isTrainingMode={isTrainingMode}
            onSeedData={seedTrainingData}
        />
      </aside>

      <Sheet open={isQueueOpen} onOpenChange={setIsQueueOpen}>
        <SheetContent side="left" className="p-0 w-80">
          <QueueListContent 
            leads={leads} 
            selectedLead={selectedLead} 
            onSelect={(lead) => {
                setSelectedLead(lead);
                setIsQueueOpen(false);
            }} 
            onRefresh={fetchLeads}
            loading={loading}
            isTrainingMode={isTrainingMode}
            onSeedData={seedTrainingData}
          />
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-slate-100 relative h-full">
        {/* Mobile Header */}
        <div className="xl:hidden h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 shrink-0">
           <Button variant="ghost" size="sm" className="gap-2 text-slate-600" onClick={() => setIsQueueOpen(true)}>
             <Menu className="w-5 h-5" /> <span className="font-semibold">Queue</span>
           </Button>
           <span className="font-bold text-slate-900 truncate max-w-[150px]">
             {selectedLead ? `${selectedLead.first_name} ${selectedLead.last_name}` : 'Select Lead'}
           </span>
           <div className="w-8" />
        </div>

        {/* Top Bar with Mode Toggle (Desktop) */}
        <div className="hidden xl:flex items-center justify-end px-6 py-2 bg-slate-100 border-b border-slate-200 h-12">
             <SystemModeToggle />
        </div>

        <div className="flex-1 p-2 md:p-4 lg:p-6 overflow-hidden h-full">
          <div className="h-full max-w-7xl mx-auto flex flex-col">
             <ActiveCallView lead={selectedLead} isTrainingMode={isTrainingMode} />
          </div>
        </div>
      </main>
    </div>
  );
};

const QueueListContent = ({ leads, selectedLead, onSelect, onRefresh, loading, isTrainingMode, onSeedData }) => (
  <div className={cn("flex flex-col h-full bg-white", isTrainingMode && "bg-amber-50/30")}>
    <div className="p-4 border-b border-slate-100">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold text-lg flex items-center gap-2 text-slate-800">
          <Phone className="w-5 h-5 text-blue-600" /> Call Queue
        </h2>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-blue-600" onClick={onRefresh}>
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
        </Button>
      </div>
      
      {/* Mobile Toggle inside Sheet */}
      <div className="xl:hidden mb-4">
        <SystemModeToggle className="w-full justify-between" />
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input placeholder="Search queue..." className="pl-9 bg-slate-50 border-slate-200 focus-visible:ring-blue-500" />
      </div>
    </div>
    
    <ScrollArea className="flex-1">
      <div className="p-2 space-y-1">
        {leads.length === 0 && !loading ? (
             <div className="flex flex-col items-center justify-center p-8 text-center">
                <Database className="w-10 h-10 text-slate-300 mb-2" />
                <p className="text-sm text-slate-500 mb-4">Queue is empty</p>
                {isTrainingMode && (
                    <Button onClick={onSeedData} size="sm" className="w-full bg-amber-500 hover:bg-amber-600">
                        <PlusCircle className="w-4 h-4 mr-2" /> Generate Test Data
                    </Button>
                )}
             </div>
        ) : (
            leads.map((lead) => (
            <div 
                key={lead.id}
                onClick={() => onSelect(lead)}
                className={cn(
                "p-3 rounded-lg cursor-pointer transition-all border border-transparent group",
                selectedLead?.id === lead.id 
                    ? (isTrainingMode ? "bg-amber-100 border-amber-300 shadow-sm" : "bg-blue-50 border-blue-200 shadow-sm")
                    : "hover:bg-slate-50 hover:border-slate-100"
                )}
            >
                <div className="flex justify-between items-start mb-1">
                <span className={cn("font-semibold text-sm line-clamp-1 group-hover:text-blue-700", selectedLead?.id === lead.id ? "text-blue-700" : "text-slate-900")}>
                    {lead.first_name} {lead.last_name}
                </span>
                <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded", (lead.pqi || 0) > 90 ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700")}>
                    {lead.pqi || 'N/A'}
                </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                <Users className="w-3 h-3" /> <span>{lead.company || lead.type || 'Residential'}</span>
                </div>
                <div className="flex justify-between items-center mt-2">
                    <span className="text-[10px] text-slate-400">{lead.city || 'Unknown City'}</span>
                    <span className={cn("text-[10px] px-1.5 rounded", lead.status === 'New' ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600")}>
                        {lead.status}
                    </span>
                </div>
            </div>
            ))
        )}
      </div>
    </ScrollArea>
  </div>
);

export default SmartCallConsole;
