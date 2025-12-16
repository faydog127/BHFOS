
/* 
  CALL CONSOLE - WIRED TO REALTIME DATA
*/
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { 
  Phone, MapPin, User, Search, RefreshCw, ArrowRight, Play, Layout
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/components/ui/use-toast';
import AiCopilot from '@/components/crm/call-console/AiCopilot';
import CallLog from '@/components/crm/call-console/CallLog';

const CallConsole = () => {
  const [prospects, setProspects] = useState([]);
  const [selectedLeadId, setSelectedLeadId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filterText, setFilterText] = useState('');
  const [isCommitting, setIsCommitting] = useState(false);
  const { toast } = useToast();

  const selectedLead = prospects.find(p => p.id === selectedLeadId);

  // --- 1. Realtime Subscription & Fetching ---
  useEffect(() => {
    fetchProspects();

    // Subscribe to changes in 'leads' and 'calls'
    const channel = supabase.channel('call-console-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, (payload) => {
          // Refresh list if leads change (e.g. status update)
          fetchProspects(); 
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchProspects = async () => {
    setIsLoading(true);
    try {
      // Prioritize new leads or leads needing calls
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .not('status', 'in', '("converted","archived")') // Correct Supabase filter syntax
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setProspects(data || []);
      
      // Auto-select first if none selected
      if (data?.length > 0 && !selectedLeadId) {
        setSelectedLeadId(data[0].id);
      }
    } catch (err) {
      console.error('Error loading prospects:', err);
      toast({ title: 'Error', description: 'Failed to load call queue', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleNextLead = () => {
      const currentIndex = prospects.findIndex(p => p.id === selectedLeadId);
      if (currentIndex < prospects.length - 1) {
          setSelectedLeadId(prospects[currentIndex + 1].id);
      } else {
          toast({ title: "End of Queue", description: "You've reached the end of the list." });
      }
  };

  // --- 2. Action Handling (Save Call & Trigger Auto-Draft) ---
  const handleActionComplete = async ({ final_outcome, notes, draft }) => {
    if (!selectedLead) return;
    setIsCommitting(true);

    try {
      // A. Save to Call Logs (Source of Truth)
      const { data: callLog, error: logError } = await supabase
        .from('call_logs')
        .insert({
            lead_id: selectedLead.id,
            user_id: (await supabase.auth.getUser()).data.user?.id,
            outcome: final_outcome,
            notes: notes,
            created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (logError) throw logError;

      // B. Create Marketing Action (If Draft Exists)
      if (draft) {
          await supabase.from('marketing_actions').insert({
              lead_id: selectedLead.id,
              action_type: 'email',
              status: 'needs_approval',
              subject_line: draft.subject,
              body: draft.body,
              content_preview: draft.body.substring(0, 100) + '...',
              playbook_key: `manual_call_${final_outcome}`
          });
          toast({ title: "Draft Created", description: "Follow-up email queued for approval." });
      }

      // C. Update Lead Status
      const newStatus = final_outcome === 'booked' ? 'Customer' : 'Contacted';
      await supabase.from('leads').update({ 
          status: newStatus,
          last_touch_at: new Date().toISOString(),
          pipeline_stage: final_outcome === 'booked' ? 'won' : 'working'
      }).eq('id', selectedLead.id);

      toast({ 
        title: 'Call Saved', 
        description: `Logged as ${final_outcome}.`,
        className: 'bg-green-50 border-green-200' 
      });

      handleNextLead();

    } catch (err) {
      console.error('Error saving call:', err);
      toast({ title: 'Save Failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsCommitting(false);
    }
  };

  const filteredProspects = prospects.filter(p => 
    (p.first_name + ' ' + p.last_name).toLowerCase().includes(filterText.toLowerCase()) || 
    p.company?.toLowerCase().includes(filterText.toLowerCase())
  );

  return (
    <div className="h-[calc(100vh-64px)] bg-slate-50 flex overflow-hidden">
      <Helmet>
        <title>Call Console | CRM</title>
      </Helmet>

      {/* --- LEFT: LEAD LIST --- */}
      <aside className="w-80 bg-white border-r border-slate-200 flex flex-col z-20 shadow-sm">
        <div className="p-4 border-b border-slate-100">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-bold text-slate-700 flex items-center gap-2">
              <Phone className="h-4 w-4" /> Live Queue ({filteredProspects.length})
            </h2>
            <Button variant="ghost" size="icon" onClick={fetchProspects} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Search leads..." 
              className="pl-9 bg-slate-50 border-slate-200 focus-visible:ring-blue-500" 
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
            />
          </div>
        </div>
        
        <ScrollArea className="flex-1">
          <div className="divide-y divide-slate-50">
            {filteredProspects.map((lead) => (
              <div 
                key={lead.id}
                onClick={() => setSelectedLeadId(lead.id)}
                className={`p-4 cursor-pointer hover:bg-slate-50 transition-all border-l-4 group ${
                  selectedLeadId === lead.id 
                    ? 'bg-blue-50 border-blue-600' 
                    : 'border-transparent'
                }`}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className={`font-semibold text-sm truncate ${selectedLeadId === lead.id ? 'text-blue-900' : 'text-slate-800'}`}>
                    {lead.first_name} {lead.last_name}
                  </span>
                  {lead.pqi > 70 && (
                      <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-none text-[10px] px-1.5 h-5">Hot</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                  <User className="h-3 w-3 opacity-50" /> {lead.company || 'Homeowner'}
                </div>
                <div className="flex items-center justify-between mt-2">
                    <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                        {lead.status}
                    </span>
                    <ArrowRight className={`w-3 h-3 text-slate-300 group-hover:text-blue-400 transition-colors ${selectedLeadId === lead.id ? 'text-blue-500' : ''}`} />
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </aside>

      {/* --- CENTER: AI COPILOT --- */}
      <main className="flex-1 flex flex-col min-w-0 bg-white">
        {selectedLead ? (
          <>
            {/* Header */}
            <div className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center shadow-sm z-10">
                <div>
                    <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                        {selectedLead.first_name} {selectedLead.last_name}
                        {selectedLead.company && <span className="text-slate-400 font-normal text-lg">| {selectedLead.company}</span>}
                    </h1>
                    <div className="flex items-center gap-4 mt-1 text-sm text-slate-500">
                        <span className="flex items-center gap-1"><MapPin className="w-3 h-3"/> {selectedLead.city || 'Unknown Location'}</span>
                        <span className="flex items-center gap-1"><Phone className="w-3 h-3"/> {selectedLead.phone}</span>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleNextLead}>Skip</Button>
                </div>
            </div>

            {/* AI Workspace */}
            <div className="flex-1 overflow-hidden relative">
              <AiCopilot 
                lead={selectedLead} 
                onCompleteAction={handleActionComplete}
                isCommitting={isCommitting}
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-slate-50/50">
            <div className="w-16 h-16 bg-white rounded-full shadow-sm flex items-center justify-center mb-4">
                <Layout className="h-8 w-8 text-slate-300" />
            </div>
            <p className="font-medium text-lg text-slate-600">No Lead Selected</p>
            <p className="text-sm">Select a prospect from the queue to start.</p>
          </div>
        )}
      </main>

      {/* --- RIGHT: HISTORY --- */}
      {selectedLead && (
          <aside className="w-80 bg-white border-l border-slate-200 flex flex-col z-20 shadow-sm hidden xl:flex">
            <div className="p-4 border-b bg-slate-50">
              <h3 className="font-semibold text-xs text-slate-500 uppercase tracking-wider">Past Interactions</h3>
            </div>
            <div className="flex-1 overflow-hidden">
              <CallLog lead={selectedLead} />
            </div>
          </aside>
      )}
    </div>
  );
};

export default CallConsole;
