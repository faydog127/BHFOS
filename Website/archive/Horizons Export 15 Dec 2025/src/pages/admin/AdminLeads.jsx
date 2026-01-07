import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Download, ArrowLeft, RefreshCcw, Loader2, ChevronDown, ChevronRight, Phone, Mail, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const AdminLeads = () => {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  const [expandedRows, setExpandedRows] = useState({});
  const { toast } = useToast();

  const fetchLeads = async () => {
    setLoading(true);
    try {
      // Fetch leads joined with contacts
      let query = supabase
        .from('klaire_leads')
        .select(`
          *,
          klaire_contacts (
            phone_number,
            name
          )
        `)
        .order('created_at', { ascending: false });

      if (filter !== 'All') {
        query = query.eq('status', filter.toLowerCase());
      }

      const { data, error } = await query;

      if (error) throw error;
      setLeads(data || []);
    } catch (error) {
      console.error('Error fetching leads:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not fetch leads. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, [filter]);

  const toggleRow = (id) => {
    setExpandedRows(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleStatusUpdate = async (leadId, newStatus) => {
    try {
        const { error } = await supabase
            .from('klaire_leads')
            .update({ 
                status: newStatus,
                updated_at: new Date().toISOString()
            })
            .eq('id', leadId);

        if (error) throw error;
        
        setLeads(prev => prev.map(lead => 
            lead.id === leadId ? { ...lead, status: newStatus } : lead
        ));

        toast({ title: "Success", description: "Status updated." });
    } catch (error) {
        toast({ variant: "destructive", title: "Error", description: "Failed to update status." });
    }
  };

  const handleExportCSV = () => {
    if (leads.length === 0) {
      toast({ title: 'No data', description: 'No leads to export.' });
      return;
    }

    const headers = ['ID', 'Created At', 'Phone', 'Name', 'Intent', 'Status'];
    const csvContent = [
      headers.join(','),
      ...leads.map(lead => 
        [
          lead.id,
          `"${new Date(lead.created_at).toLocaleString()}"`,
          `"${lead.klaire_contacts?.phone_number || ''}"`,
          `"${lead.klaire_contacts?.name || ''}"`,
          `"${lead.intent || ''}"`,
          `"${lead.status}"`
        ].join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `klaire_leads_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusBadgeColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'new': return 'bg-blue-500';
      case 'contacted': return 'bg-yellow-500';
      case 'qualified': return 'bg-purple-500';
      case 'scheduled': return 'bg-emerald-500';
      case 'converted': return 'bg-green-600';
      case 'lost': return 'bg-red-500';
      case 'junk': return 'bg-gray-500';
      default: return 'bg-gray-400';
    }
  };

  return (
    <div className="container mx-auto py-10 px-4">
      <div className="flex flex-col space-y-6">
        <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
                <Link to="/admin">
                    <Button variant="outline" size="icon">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <h1 className="text-3xl font-bold text-[#1B263B]">Klaire Leads</h1>
            </div>
            <Button onClick={handleExportCSV} className="bg-[#1B263B] text-white hover:bg-[#2a3f5f]">
                <Download className="mr-2 h-4 w-4" /> Export CSV
            </Button>
        </div>

        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle>Recent Leads ({leads.length})</CardTitle>
                    <div className="flex items-center space-x-2">
                        {['All', 'New', 'Contacted', 'Scheduled', 'Converted'].map((status) => (
                            <Button
                                key={status}
                                variant={filter === status ? "default" : "outline"}
                                size="sm"
                                onClick={() => setFilter(status)}
                                className={filter === status ? "bg-[#1B263B] text-white" : ""}
                            >
                                {status}
                            </Button>
                        ))}
                        <Button variant="ghost" size="icon" onClick={fetchLeads}>
                            <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="flex justify-center py-10">
                        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                    </div>
                ) : (
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[50px]"></TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Name / Phone</TableHead>
                                    <TableHead>Intent</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {leads.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-10 text-gray-500">
                                            No leads found.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    leads.map((lead) => (
                                        <React.Fragment key={lead.id}>
                                            <TableRow className="cursor-pointer hover:bg-slate-50" onClick={() => toggleRow(lead.id)}>
                                                <TableCell>
                                                    {expandedRows[lead.id] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                                </TableCell>
                                                <TableCell className="whitespace-nowrap">
                                                    {format(new Date(lead.created_at), 'MMM d, h:mm a')}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="font-medium">{lead.klaire_contacts?.name || 'Unknown'}</div>
                                                    <div className="text-xs text-gray-500">{lead.klaire_contacts?.phone_number}</div>
                                                </TableCell>
                                                <TableCell>{lead.intent}</TableCell>
                                                <TableCell onClick={(e) => e.stopPropagation()}>
                                                     <Select 
                                                        defaultValue={lead.status} 
                                                        onValueChange={(val) => handleStatusUpdate(lead.id, val)}
                                                     >
                                                        <SelectTrigger className={`w-[130px] h-8 text-white border-none ${getStatusBadgeColor(lead.status)}`}>
                                                            <SelectValue placeholder="Status" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {['new', 'contacted', 'qualified', 'scheduled', 'converted', 'lost', 'junk'].map(s => (
                                                                <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </TableCell>
                                            </TableRow>
                                            {expandedRows[lead.id] && (
                                                <TableRow className="bg-slate-50 hover:bg-slate-50">
                                                    <TableCell colSpan={5} className="p-4">
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                            <div>
                                                                <h4 className="font-semibold mb-2 text-sm text-slate-600">Transcript</h4>
                                                                <div className="bg-white border rounded-md p-3 h-[200px] overflow-y-auto space-y-2">
                                                                    {Array.isArray(lead.full_transcript) ? lead.full_transcript.map((msg, idx) => (
                                                                        <div key={idx} className={`text-sm p-2 rounded ${msg.role === 'user' ? 'bg-blue-50 ml-4' : 'bg-gray-100 mr-4'}`}>
                                                                            <span className="font-bold text-xs block mb-1 opacity-70">{msg.role === 'user' ? 'Customer' : 'Klaire'}</span>
                                                                            {msg.content}
                                                                        </div>
                                                                    )) : <span className="text-sm text-gray-400">No transcript available.</span>}
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <h4 className="font-semibold mb-2 text-sm text-slate-600">Actions</h4>
                                                                <div className="flex flex-wrap gap-2">
                                                                    <Button size="sm" className="gap-2" variant="outline">
                                                                        <Phone className="h-3 w-3" /> Call
                                                                    </Button>
                                                                    <Button size="sm" className="gap-2" variant="outline">
                                                                        <Mail className="h-3 w-3" /> Email
                                                                    </Button>
                                                                    <Button 
                                                                        size="sm" 
                                                                        className="gap-2 bg-green-600 hover:bg-green-700 text-white"
                                                                        onClick={() => handleStatusUpdate(lead.id, 'converted')}
                                                                    >
                                                                        <CheckCircle className="h-3 w-3" /> Mark Converted
                                                                    </Button>
                                                                </div>
                                                                <div className="mt-4">
                                                                    <h5 className="text-xs font-semibold text-slate-500 mb-1">Lead ID</h5>
                                                                    <code className="text-xs bg-slate-100 p-1 rounded">{lead.id}</code>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </React.Fragment>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminLeads;