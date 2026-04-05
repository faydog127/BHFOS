import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Play, Settings2, GitBranch, Star, UserCheck, CheckCircle2, XCircle, Clock, RefreshCw, Pencil, History, Zap, Bug, Beaker } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { format } from 'date-fns';

const PlaybookCard = ({ title, description, icon: Icon, active, triggers, onTest, onSimulate }) => (
  <Card className={`flex flex-col h-full transition-all border-2 ${active ? 'border-primary/10 bg-primary/5' : 'border-dashed border-slate-200'}`}>
    <CardHeader className="pb-4">
      <div className="flex justify-between items-start">
        <div className={`p-2 rounded-lg ${active ? 'bg-primary text-primary-foreground' : 'bg-slate-100 text-slate-500'}`}>
          <Icon className="w-6 h-6" />
        </div>
        <Badge variant={active ? "default" : "secondary"} className="text-xs">
          {active ? "Active" : "Inactive"}
        </Badge>
      </div>
      <CardTitle className="text-lg mt-4">{title}</CardTitle>
      <CardDescription className="text-sm line-clamp-2">{description}</CardDescription>
    </CardHeader>
    <CardContent className="flex-1">
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Triggers</p>
        <ul className="text-sm space-y-1">
          {triggers.map((t, i) => (
            <li key={i} className="flex items-center gap-2 text-slate-700 text-xs">
              <GitBranch className="w-3 h-3 text-slate-400" /> {t}
            </li>
          ))}
        </ul>
      </div>
    </CardContent>
    <CardFooter className="pt-4 border-t bg-white/50 gap-2 flex-col">
      <div className="flex w-full gap-2">
        <Button variant="outline" size="sm" className="flex-1 text-xs" disabled={!active}>
            <Settings2 className="w-3 h-3 mr-1" /> Config
        </Button>
        <Button variant="ghost" size="sm" className="text-xs" onClick={onTest}>
            <Play className="w-3 h-3 mr-1" /> Mock
        </Button>
      </div>
      {onSimulate && (
        <Button variant="secondary" size="sm" className="w-full text-xs mt-2" onClick={onSimulate}>
            <Beaker className="w-3 h-3 mr-1" /> Simulate Real Lead
        </Button>
      )}
    </CardFooter>
  </Card>
);

const ActionRow = ({ action, onApprove, onReject, onEdit }) => (
  <TableRow className="group">
    <TableCell>
      <div className="flex flex-col">
        <span className="font-medium text-sm text-slate-900">{action.playbook_key}</span>
        <span className="text-xs text-muted-foreground">{format(new Date(action.created_at), 'MMM d, h:mm a')}</span>
      </div>
    </TableCell>
    <TableCell>
      <Badge variant="outline" className="capitalize text-xs font-normal">{action.type}</Badge>
    </TableCell>
    <TableCell>
      <div className="max-w-[300px] text-sm text-slate-600 truncate" title={action.content_preview}>
        {action.content_preview}
      </div>
    </TableCell>
    <TableCell>
      <div className="text-xs space-y-0.5">
        <div className="font-medium text-slate-900">{action.target_details?.name || 'Unknown'}</div>
        <div className="text-muted-foreground">{action.target_details?.email || action.target_details?.phone}</div>
      </div>
    </TableCell>
    <TableCell>
       <div className="flex items-center gap-2">
          <Badge className={
            action.status === 'needs_approval' ? 'bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200' :
            action.status === 'approved' ? 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200' :
            action.status === 'sent' ? 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200' : 
            'bg-slate-100 text-slate-700 border-slate-200'
          }>
            {action.status}
          </Badge>
       </div>
    </TableCell>
    <TableCell className="text-right">
      {action.status === 'needs_approval' && (
        <div className="flex justify-end gap-2 opacity-100 transition-opacity">
          <Button size="sm" variant="outline" className="h-8 px-2 text-slate-600" onClick={() => onEdit(action)} title="Edit">
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <Button size="sm" variant="outline" className="h-8 px-2 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200" onClick={() => onReject(action.id)} title="Reject">
            <XCircle className="w-3.5 h-3.5" />
          </Button>
          <Button size="sm" className="h-8 px-3 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm" onClick={() => onApprove(action.id)}>
            <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Approve
          </Button>
        </div>
      )}
      {action.status === 'approved' && (
         <Button size="sm" variant="ghost" className="h-8 text-xs text-muted-foreground cursor-default hover:bg-transparent" disabled>
           <Clock className="w-3 h-3 mr-1" /> Queued for sending
         </Button>
      )}
      {action.status === 'sent' && (
         <span className="text-xs text-muted-foreground italic">Sent {action.sent_at ? format(new Date(action.sent_at), 'h:mm a') : ''}</span>
      )}
    </TableCell>
  </TableRow>
);

const AutomationPlaybooks = () => {
  const { toast } = useToast();
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActions();
    
    // Set up real-time subscription for new actions
    const channel = supabase
      .channel('marketing_actions_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'marketing_actions' }, (payload) => {
        console.log('🔔 Realtime update received for marketing_actions:', payload);
        fetchActions();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchActions = async () => {
    console.group('🔍 AutomationPlaybooks Query Debug');
    try {
      setLoading(true);
      
      const { data: { session } } = await supabase.auth.getSession();
      console.log('👤 Auth Status:', session ? 'Authenticated' : 'Guest/Anon');
      
      console.log('📡 Fetching [marketing_actions] (limit 100)...');
      
      const { data, error } = await supabase
        .from('marketing_actions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        console.error('❌ Fetch Error:', error.message);
        throw error;
      }

      console.log(`✅ Success! Retrieved ${data?.length || 0} total rows from DB.`);

      if (data && data.length > 0) {
          const statusCounts = data.reduce((acc, curr) => {
              acc[curr.status] = (acc[curr.status] || 0) + 1;
              return acc;
          }, {});
          console.log('📊 Row Status Distribution:', statusCounts);
          
          const pendingCount = data.filter(a => a.status === 'needs_approval').length;
          console.log(`🔎 Found ${pendingCount} rows with status 'needs_approval'`);
      } else {
          console.warn('⚠️ Query returned 0 rows. If data exists in DB, check RLS policies.');
      }

      setActions(data || []);
    } catch (error) {
      console.error('Execution failed:', error);
      toast({ title: "Connection Error", description: "Could not load automation queue.", variant: "destructive" });
    } finally {
      setLoading(false);
      console.groupEnd();
    }
  };

  const handleApprove = async (id) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // 1. Mark as approved
      const { error: approveError } = await supabase
        .from('marketing_actions')
        .update({ 
          status: 'approved',
          approved_by: user?.id,
          approved_at: new Date().toISOString()
        })
        .eq('id', id);

      if (approveError) throw approveError;

      // The realtime subscription will trigger fetchActions.
      // We no longer need to simulate the 'sent' status or manually refetch.
      
      toast({ title: "Approved", description: "Action approved and queued for sending." });
      
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Could not approve action.", variant: "destructive" });
    }
  };

  const handleReject = async (id) => {
    try {
      const { error } = await supabase
        .from('marketing_actions')
        .update({ status: 'rejected' })
        .eq('id', id);

      if (error) throw error;
      toast({ title: "Rejected", description: "Action has been rejected." });
      fetchActions();
    } catch (error) {
      toast({ title: "Error", description: "Could not reject action.", variant: "destructive" });
    }
  };

  const handleEdit = (action) => {
    toast({ 
        title: "Edit Action", 
        description: "This feature is coming soon! You will be able to edit the content before approving.",
    });
  };

  const handleMockTrigger = async (type) => {
    try {
        const payload = {
            playbook_key: type,
            type: type === 'partner_referral_alert' ? 'sms' : 'email',
            channel: 'Mock',
            status: 'needs_approval',
            content_preview: type === 'partner_referral_alert' 
                ? 'MOCK: Partner referral received! Code: TEST-123' 
                : 'MOCK: Welcome to your Free Air Check. Schedule now?',
            target_details: { name: 'Mock User', email: 'mock@example.com', phone: '555-0123' },
            scheduled_at: new Date().toISOString()
        };

        const { error } = await supabase.from('marketing_actions').insert([payload]);
        if (error) throw error;
        
        toast({ title: "Mock Action Created", description: "Created a fake action to test the UI." });
        fetchActions();
    } catch (e) {
        toast({ title: "Error", description: `Failed: ${e.message}`, variant: "destructive" });
    }
  };

  const handleSimulateLead = async () => {
    setLoading(true);
    console.group('🧪 Simulation Start');
    try {
        console.log('1. Inspecting Schema via Select...');
        
        const { data: rows, error: fetchError } = await supabase
            .from('leads')
            .select('*')
            .limit(1);
            
        if (fetchError) {
            console.error("Schema check failed:", fetchError);
        }

        const template = rows && rows.length > 0 ? rows[0] : null;
        const validColumns = template ? Object.keys(template) : [];
        
        console.log('   -> Valid columns detected:', validColumns.length > 0 ? validColumns.join(', ') : 'None (Empty Table?)');

        // 2. Define Payload
        let payload = {
            first_name: 'Simulated',
            last_name: 'Lead',
            email: `test.automation.${Date.now()}@vent-guys.com`,
            phone: '555-0123',
            created_at: new Date().toISOString(),
            pqi: 10,
            utm_source: 'simulation_button', 
            
            // TRIGGER KEY:
            service: 'Free Air Check', 
            source_kind: 'Simulation',
            marketing_source_detail: 'CRM Button',
        };

        // 3. Apply Constraints
        const applyField = (key, defaultValue) => {
            const columnExists = validColumns.length === 0 || validColumns.includes(key);
            if (columnExists) {
                payload[key] = (template && template[key]) ? template[key] : defaultValue;
            }
        };

        applyField('persona', 'homeowner');
        applyField('status', 'New');
        applyField('pipeline_stage', 'New Lead'); 
        applyField('customer_type', 'residential');

        // 4. Sanitization
        if (validColumns.length > 0) {
            Object.keys(payload).forEach(key => {
                if (!validColumns.includes(key)) {
                    console.warn(`⚠️ Dropping field '${key}' - it does not exist in the leads table schema.`);
                    delete payload[key];
                }
            });
        }

        // 5. Critical Check
        if (validColumns.length > 0 && !payload.service) {
            console.error("🚨 CRITICAL: 'service' field was dropped! The trigger will NOT fire.");
            toast({ title: "Configuration Error", description: "'service' column missing in DB. Trigger won't fire.", variant: "destructive" });
            return;
        }

        console.log('2. Inserting Payload:', payload);

        const { data, error } = await supabase
            .from('leads')
            .insert([payload])
            .select();

        if (error) {
            console.error("❌ INSERT ERROR:", error);
            throw error;
        }

        console.log("✅ Insert Successful. Lead ID:", data[0].id);
        console.log("   -> Expecting Trigger 'on_lead_created_playbooks' to fire now.");
        console.log("   -> Expecting 2 entries in 'marketing_actions' (Welcome + Followup).");

        toast({ 
            title: "Lead Simulated", 
            description: "Lead inserted. Refreshing list to check for triggered actions..." 
        });
        
        // Delay refresh to allow trigger to complete
        setTimeout(fetchActions, 2000);

    } catch (e) {
        console.error("Simulation Failed:", e);
        toast({ 
            title: "Simulation Failed", 
            description: `Database Error: ${e.message}`, 
            variant: "destructive" 
        });
    } finally {
        setLoading(false);
        console.groupEnd();
    }
  };

  const pendingActions = actions.filter(a => a.status === 'needs_approval');
  const historyActions = actions.filter(a => a.status !== 'needs_approval');

  return (
    <div className="space-y-8">
      {/* SECTION 1: PENDING APPROVALS */}
      <div className="relative">
        <Card className={`border-2 ${pendingActions.length > 0 ? 'border-amber-200 bg-amber-50/30' : 'border-slate-200'}`}>
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <CardTitle className="flex items-center gap-2 text-xl">
                            <Zap className={`w-5 h-5 ${pendingActions.length > 0 ? 'text-amber-500' : 'text-slate-400'}`} />
                            Pending Approvals
                            {pendingActions.length > 0 && (
                                <Badge variant="default" className="bg-amber-500 hover:bg-amber-600 ml-2 text-white">
                                    {pendingActions.length} Waiting
                                </Badge>
                            )}
                        </CardTitle>
                        <CardDescription>
                            Review and approve automated actions before they are sent.
                        </CardDescription>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={fetchActions} disabled={loading}>
                            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <Table>
                    <TableHeader>
                        <TableRow className="hover:bg-transparent">
                            <TableHead className="pl-6">Playbook / Time</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Preview</TableHead>
                            <TableHead>Target</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right pr-6">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                                    <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin opacity-50" />
                                    Loading queue...
                                </TableCell>
                            </TableRow>
                        ) : pendingActions.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-12 bg-white/50">
                                    <div className="flex flex-col items-center justify-center space-y-3">
                                        <CheckCircle2 className="w-12 h-12 text-green-500/20" />
                                        <div className="text-center">
                                            <p className="font-medium text-slate-900">All caught up!</p>
                                            <p className="text-sm text-muted-foreground mb-4">No actions pending approval.</p>
                                            <div className="flex gap-2 justify-center">
                                                <Button variant="outline" size="sm" onClick={() => handleMockTrigger('free_air_check_welcome')}>
                                                    <Bug className="w-4 h-4 mr-2" /> Mock Action
                                                </Button>
                                                <Button variant="secondary" size="sm" onClick={handleSimulateLead}>
                                                    <Beaker className="w-4 h-4 mr-2" /> Simulate Real Lead
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            pendingActions.map(action => (
                                <ActionRow 
                                    key={action.id} 
                                    action={action} 
                                    onApprove={handleApprove} 
                                    onReject={handleReject}
                                    onEdit={handleEdit}
                                />
                            ))
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
      </div>

      {/* SECTION 2: PLAYBOOKS CONFIGURATION */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-slate-500" /> 
            Active Playbooks
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <PlaybookCard 
            title="Free Air Check Sequence"
            description="Day 0 Welcome & Day 3 Follow-up for new air check leads."
            icon={Play}
            active={true}
            triggers={["New Lead (Service='Free Air Check')", "Wait 3 Days -> Follow-up"]}
            onTest={() => handleMockTrigger('free_air_check_welcome')}
            onSimulate={handleSimulateLead}
            />
            
            <PlaybookCard 
            title="Partner Referral Alert"
            description="Instant SMS to partners when their code is used."
            icon={UserCheck}
            active={true}
            triggers={["New Lead (is_partner=true)", "Send SMS"]}
            onTest={() => handleMockTrigger('partner_referral_alert')}
            />
            
            <PlaybookCard 
            title="Review Request"
            description="Ask for a Google Review 2 hours after job completion."
            icon={Star}
            active={true}
            triggers={["Pipeline Stage -> Completed", "Wait 2 Hours", "Send SMS/Email"]}
            onTest={() => handleMockTrigger('review_request')}
            />
        </div>
      </div>

      {/* SECTION 3: HISTORY LOG */}
      <div className="space-y-4 pt-8 border-t">
        <h3 className="text-lg font-medium flex items-center gap-2">
            <History className="w-5 h-5 text-slate-500" /> 
            Execution History
        </h3>
        <Card className="bg-slate-50/50">
            <CardContent className="p-0">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="pl-6">Playbook / Time</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Preview</TableHead>
                            <TableHead>Target</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right pr-6"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {historyActions.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                    No history available yet.
                                </TableCell>
                            </TableRow>
                        ) : (
                            historyActions.map(action => (
                                <ActionRow 
                                    key={action.id} 
                                    action={action} 
                                    onApprove={handleApprove} 
                                    onReject={handleReject} 
                                    onEdit={handleEdit}
                                />
                            ))
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AutomationPlaybooks;