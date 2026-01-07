import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useSearchParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, RefreshCw, Filter, Mail, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

const LeadsList = () => {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const initialRange = searchParams.get('range') || '30';
  
  const [leads, setLeads] = useState([]);
  const [actions, setActions] = useState({}); // Map of lead_id -> actions[]
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [serviceFilter, setServiceFilter] = useState('all');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Leads
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - parseInt(initialRange));

      const { data: leadsData, error: leadsError } = await supabase
        .from('leads')
        .select('*')
        .gte('created_at', cutoff.toISOString())
        .order('created_at', { ascending: false });

      if (leadsError) throw leadsError;
      
      setLeads(leadsData || []);

      // 2. Fetch Actions for these leads (if any leads exist)
      if (leadsData && leadsData.length > 0) {
        const leadIds = leadsData.map(l => l.id);
        const { data: actionsData, error: actionsError } = await supabase
            .from('marketing_actions')
            .select('*')
            .in('lead_id', leadIds)
            .order('created_at', { ascending: false });
            
        if (actionsError) throw actionsError;

        // Group actions by lead_id
        const actionMap = {};
        actionsData.forEach(action => {
            if (!actionMap[action.lead_id]) {
                actionMap[action.lead_id] = [];
            }
            actionMap[action.lead_id].push(action);
        });
        setActions(actionMap);
      }

    } catch (error) {
      console.error('Error fetching leads list:', error);
      toast({ 
          title: "Error", 
          description: "Could not load leads data.", 
          variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredLeads = leads.filter(lead => {
    const matchesStatus = statusFilter === 'all' || (lead.status || '').toLowerCase() === statusFilter.toLowerCase();
    const matchesService = serviceFilter === 'all' || (lead.service || '').includes(serviceFilter);
    return matchesStatus && matchesService;
  });

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <Helmet>
        <title>Leads List | CRM</title>
      </Helmet>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" asChild>
            <Link to="/crm/marketing">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Recent Leads ({initialRange} Days)</h1>
            <p className="text-gray-500">Detailed view of lead activity and automated actions.</p>
          </div>
        </div>
        <Button variant="outline" onClick={fetchData} disabled={loading}>
           <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5 text-slate-400" /> 
                Filters
            </CardTitle>
            <div className="flex gap-4">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="new">New</SelectItem>
                        <SelectItem value="contacted">Contacted</SelectItem>
                        <SelectItem value="scheduled">Scheduled</SelectItem>
                    </SelectContent>
                </Select>
                
                <Select value={serviceFilter} onValueChange={setServiceFilter}>
                    <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Service" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Services</SelectItem>
                        <SelectItem value="Free Air Check">Free Air Check</SelectItem>
                        <SelectItem value="Dryer Vent">Dryer Vent</SelectItem>
                        <SelectItem value="Duct Cleaning">Duct Cleaning</SelectItem>
                    </SelectContent>
                </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Marketing Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8">Loading leads...</TableCell></TableRow>
                ) : filteredLeads.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No leads found matching criteria.</TableCell></TableRow>
                ) : (
                    filteredLeads.map(lead => {
                        const leadActions = actions[lead.id] || [];
                        return (
                            <TableRow key={lead.id} className="hover:bg-slate-50">
                                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                                    {format(new Date(lead.created_at), 'MMM d, h:mm a')}
                                </TableCell>
                                <TableCell>
                                    <div className="font-medium">{lead.first_name} {lead.last_name}</div>
                                    <div className="text-xs text-muted-foreground">{lead.email}</div>
                                </TableCell>
                                <TableCell>
                                    <Badge variant="outline" className="bg-slate-100 font-normal">
                                        {lead.service || 'General'}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    <Badge className={
                                        lead.status === 'New' ? 'bg-blue-100 text-blue-800 hover:bg-blue-100' : 
                                        'bg-slate-100 text-slate-800 hover:bg-slate-100'
                                    }>
                                        {lead.status}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-sm">
                                    {lead.marketing_source_detail || lead.source_kind || 'Direct'}
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-wrap gap-2">
                                        {leadActions.length === 0 ? (
                                            <span className="text-xs text-slate-400 italic">None</span>
                                        ) : (
                                            leadActions.map(action => (
                                                <div key={action.id} className="flex items-center gap-1 text-xs border rounded px-2 py-1 bg-white" title={action.content_preview}>
                                                    <Mail className="h-3 w-3 text-slate-400" />
                                                    <span className={
                                                        action.status === 'sent' ? 'text-green-600 font-medium' :
                                                        action.status === 'needs_approval' ? 'text-amber-600 font-medium' :
                                                        'text-slate-600'
                                                    }>
                                                        {action.playbook_key?.replace(/_/g, ' ')}
                                                    </span>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </TableCell>
                            </TableRow>
                        );
                    })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LeadsList;