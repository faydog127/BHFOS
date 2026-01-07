import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { getTenantId } from '@/lib/tenantUtils';
import { 
  Activity, Mail, RefreshCw, AlertTriangle,
  Clock, Lock, PlayCircle, Shield 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import { formatDistanceToNow } from 'date-fns';

const OpsDashboard = () => {
  const [activeTab, setActiveTab] = useState('jobs');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSuperUser, setIsSuperUser] = useState(false);
  const { toast } = useToast();
  const currentTenantId = getTenantId();

  useEffect(() => {
    // Check if superuser to determine if we show ALL or just TENANT
    const checkSuper = async () => {
      const { data } = await supabase.rpc('check_is_superuser');
      if (data) setIsSuperUser(true);
    };
    checkSuper();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const table = activeTab === 'jobs' ? 'event_jobs' : 'messages';
    
    let query = supabase
      .from(table)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
      
    // If NOT superuser, filter by tenant explicitly (though RLS enforces it too)
    if (!isSuperUser) {
        query = query.eq('tenant_id', currentTenantId);
    }
    // If superuser, we view ALL by default (Ops view)

    const { data, error } = await query;

    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } else {
      setItems(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); 
    return () => clearInterval(interval);
  }, [activeTab, isSuperUser]); // Refetch if superuser status determines scope

  const handleRetry = async (item) => {
    const allowedTypes = ['create_work_order', 'create_invoice', 'send_review_request'];
    if (activeTab === 'jobs' && !allowedTypes.includes(item.type)) {
       toast({ variant: 'destructive', title: 'Retry Denied', description: 'Type not whitelisted.' });
       return;
    }

    const table = activeTab === 'jobs' ? 'event_jobs' : 'messages';
    const field = activeTab === 'jobs' ? 'run_at' : 'scheduled_at';
    
    const { error } = await supabase
      .from(table)
      .update({ 
        status: 'queued', 
        attempts: 0, 
        last_error: null,
        [field]: new Date().toISOString()
      })
      .eq('id', item.id);

    if (error) {
       toast({ variant: 'destructive', title: 'Retry Failed', description: error.message });
    } else {
       toast({ title: 'Retrying', description: 'Item queued.' });
       fetchData();
    }
  };

  const triggerWorker = async () => {
     const func = activeTab === 'jobs' ? 'process-event-jobs' : 'process-messages';
     try {
        const { data, error } = await supabase.functions.invoke(func, {});
        if (error) throw error;
        toast({ title: 'Worker Run Complete', description: `Processed: ${data?.processed || 0}` });
        fetchData();
     } catch (e) {
        toast({ variant: 'destructive', title: 'Worker Error', description: e.message });
     }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'queued': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'running': return 'bg-blue-100 text-blue-800 border-blue-200 animate-pulse';
      case 'success': case 'sent': return 'bg-green-100 text-green-800 border-green-200';
      case 'failed': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'dead': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  const queued = items.filter(i => i.status === 'queued').length;
  const failed = items.filter(i => i.status === 'failed' || i.status === 'dead').length;
  const stuck = items.filter(i => i.status === 'running' && new Date(i.locked_at) < new Date(Date.now() - 5 * 60000)).length;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold text-slate-900">Ops Visibility</h1>
            {isSuperUser && <Badge variant="secondary" className="gap-1"><Shield className="w-3 h-3"/> Global View</Badge>}
          </div>
          <p className="text-slate-500">Event processing and message delivery queues.</p>
        </div>
        <div className="flex gap-2">
            <Button variant="outline" onClick={fetchData}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
            <Button onClick={triggerWorker}>
               <PlayCircle className="w-4 h-4 mr-2" /> Run Worker
            </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-slate-50 border-slate-200">
           <CardContent className="p-4 flex items-center justify-between">
              <div>
                 <p className="text-sm font-medium text-slate-500">Queued</p>
                 <p className="text-2xl font-bold text-slate-900">{queued}</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-500 opacity-20" />
           </CardContent>
        </Card>
        <Card className="bg-slate-50 border-slate-200">
           <CardContent className="p-4 flex items-center justify-between">
              <div>
                 <p className="text-sm font-medium text-slate-500">Failed / Dead</p>
                 <p className="text-2xl font-bold text-red-600">{failed}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-500 opacity-20" />
           </CardContent>
        </Card>
        <Card className="bg-slate-50 border-slate-200">
           <CardContent className="p-4 flex items-center justify-between">
              <div>
                 <p className="text-sm font-medium text-slate-500">Stuck (Running)</p>
                 <p className="text-2xl font-bold text-orange-600">{stuck}</p>
              </div>
              <Lock className="w-8 h-8 text-orange-500 opacity-20" />
           </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="jobs" onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="jobs" className="flex items-center gap-2"><Activity className="w-4 h-4" /> Event Jobs</TabsTrigger>
          <TabsTrigger value="messages" className="flex items-center gap-2"><Mail className="w-4 h-4" /> Messages</TabsTrigger>
        </TabsList>

        <Card className="mt-4">
          <CardHeader>
             <CardTitle>{activeTab === 'jobs' ? 'Job Queue' : 'Message Outbox'}</CardTitle>
             <CardDescription>
                {isSuperUser ? 'Showing items across ALL tenants.' : `Tenant: ${currentTenantId}`}
             </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  {isSuperUser && <TableHead>Tenant</TableHead>}
                  <TableHead>Type/Channel</TableHead>
                  <TableHead>Key / Recipient</TableHead>
                  <TableHead>Attempts</TableHead>
                  <TableHead>Time Info</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                 {items.length === 0 ? (
                    <TableRow><TableCell colSpan={isSuperUser ? 8 : 7} className="text-center py-8 text-slate-500">No items found.</TableCell></TableRow>
                 ) : (
                    items.map(item => (
                       <TableRow key={item.id}>
                          <TableCell>
                             <Badge variant="outline" className={getStatusColor(item.status)}>{item.status}</Badge>
                          </TableCell>
                          {isSuperUser && (
                              <TableCell className="font-mono text-xs text-slate-500">{item.tenant_id}</TableCell>
                          )}
                          <TableCell className="font-mono text-xs font-semibold">
                             {item.type || item.channel}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate text-xs font-mono text-slate-500" title={item.idempotency_key}>
                             {activeTab === 'messages' ? (item.recipient || item.idempotency_key) : item.idempotency_key}
                          </TableCell>
                          <TableCell className="text-xs">
                             {item.attempts} / {item.max_attempts}
                          </TableCell>
                          <TableCell className="text-xs text-slate-500">
                             {item.run_at ? formatDistanceToNow(new Date(item.run_at), { addSuffix: true }) : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                             {(item.status === 'failed' || item.status === 'dead') && (
                                <Button size="sm" variant="ghost" onClick={() => handleRetry(item)} className="h-6">
                                   Retry
                                </Button>
                             )}
                          </TableCell>
                       </TableRow>
                    ))
                 )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </Tabs>
    </div>
  );
};

export default OpsDashboard;