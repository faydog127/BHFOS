
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { getTenantId } from '@/lib/tenantUtils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, FileText, Send, Check, X, Loader2, Filter, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const ProposalList = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const tenantId = getTenantId();
  
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all');
  const [processingId, setProcessingId] = useState(null);

  useEffect(() => {
    const statusParam = searchParams.get('status');
    if (statusParam !== statusFilter) {
      setStatusFilter(statusParam || 'all');
    }
  }, [searchParams]);

  const handleFilterChange = (newFilter) => {
    setStatusFilter(newFilter);
    if (newFilter === 'all') {
      searchParams.delete('status');
    } else {
      searchParams.set('status', newFilter);
    }
    setSearchParams(searchParams);
  };

  const mapFilterToStatuses = (filterInput) => {
    if (!filterInput || filterInput === 'all') return [];
    
    const rawFilters = filterInput.split(',').map(f => f.trim());
    let dbStatuses = [];
    
    rawFilters.forEach(f => {
        if (f === 'actionable') {
            dbStatuses.push('sent', 'viewed', 'pending_review', 'expired');
        } else if (f === 'waiting_approval' || f === 'waiting') {
            dbStatuses.push('sent', 'viewed', 'pending_review');
        } else {
            dbStatuses.push(f);
        }
    });
    
    return [...new Set(dbStatuses)].filter(Boolean);
  };

  const fetchProposals = async () => {
    setLoading(true);
    setError(null);
    
    const expectedStatuses = mapFilterToStatuses(statusFilter);

    try {
      let query = supabase
        .from('quotes')
        .select(`
          *, 
          leads (
            first_name, 
            last_name, 
            company,
            email
          )
        `)
        .order('created_at', { ascending: false });

      if (expectedStatuses.length > 0) {
        query = query.in('status', expectedStatuses);
      }
      
      const { data, error: err } = await query;
      
      if (err) throw err;
      
      setProposals(data || []);
      
    } catch (err) {
      console.error('Initial proposal fetch failed:', err);
      
      // Robust Fallback: Client-side filtering
      console.log('Attempting fallback fetch (client-side filtering)...');
      try {
         const { data: allData, error: fallbackError } = await supabase
            .from('quotes')
            .select(`
              *, 
              leads (
                first_name, 
                last_name, 
                company,
                email
              )
            `)
            .order('created_at', { ascending: false });

         if (fallbackError) throw fallbackError;

         const filteredData = (allData || []).filter(p => {
             if (expectedStatuses.length === 0) return true;
             return expectedStatuses.includes(p.status);
         });
         
         setProposals(filteredData);
         setError(null); 

      } catch (finalErr) {
          console.error('Fallback fetch failed:', finalErr);
          setError(err.message || 'Failed to load proposals');
          toast({ variant: 'destructive', title: 'Error', description: 'Failed to load proposals.' });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProposals();
  }, [statusFilter, tenantId]);

  const handleStatusUpdate = async (id, status, event) => {
    event.stopPropagation();
    setProcessingId(id);
    
    // Optimistic Update
    const originalProposals = [...proposals];
    setProposals(prev => prev.map(p => p.id === id ? { ...p, status } : p));

    try {
      const { error } = await supabase
        .from('quotes')
        .update({ status })
        .eq('id', id);

      if (error) throw error;

      toast({ 
        title: 'Status Updated', 
        description: `Proposal marked as ${status}. ${status === 'accepted' ? 'Work Order created.' : ''}` 
      });
      
      // If Accepted, the DB trigger creates a Work Order automatically
      
    } catch (err) {
      // Revert Optimistic
      setProposals(originalProposals);
      toast({ variant: 'destructive', title: 'Update Failed', description: err.message });
    } finally {
      setProcessingId(null);
    }
  };

  const getLeadName = (leadData) => {
    if (!leadData) return 'Unknown Customer';
    const lead = Array.isArray(leadData) ? leadData[0] : leadData;
    if (!lead) return 'Unknown Customer';
    
    const name = `${lead.first_name || ''} ${lead.last_name || ''}`.trim();
    return name || lead.company || lead.email || 'Unknown Customer';
  };

  const getCompany = (leadData) => {
    if (!leadData) return '';
    const lead = Array.isArray(leadData) ? leadData[0] : leadData;
    return lead?.company || '';
  };

  const filteredProposals = proposals.filter(p => {
    const searchLower = search.toLowerCase();
    const leadName = getLeadName(p.leads).toLowerCase();
    const company = getCompany(p.leads).toLowerCase();
    const quoteNum = p.quote_number?.toString() || '';
    
    return quoteNum.includes(searchLower) || 
           leadName.includes(searchLower) || 
           company.includes(searchLower);
  });

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'accepted': return 'bg-green-100 text-green-800 border-green-200';
      case 'rejected': return 'bg-red-100 text-red-800 border-red-200';
      case 'sent': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'viewed': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'expired': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'pending_review': return 'bg-purple-100 text-purple-800 border-purple-200';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  const getTitle = () => {
    if (statusFilter === 'all') return 'All Proposals';
    if (statusFilter === 'actionable' || statusFilter.includes('waiting')) return 'Actionable Proposals';
    if (statusFilter.includes(',')) return 'Filtered Proposals';
    return `${statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)} Proposals`;
  };

  if (error) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error Loading Proposals</AlertTitle>
          <AlertDescription className="flex flex-col gap-2 mt-2">
            <p>We encountered an issue fetching your proposals: {error}</p>
            <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={fetchProposals} className="bg-white text-red-900 border-red-200 hover:bg-red-50 w-fit">
                Retry
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleFilterChange('all')} className="bg-white text-slate-900 w-fit">
                Clear Filters & Retry
                </Button>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'accepted': return 'bg-green-100 text-green-800 border-green-200';
      case 'rejected': return 'bg-red-100 text-red-800 border-red-200';
      case 'sent': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'viewed': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'expired': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Proposals</h1>
          <p className="text-slate-500">Manage estimates and quotes</p>
        </div>
        <Button onClick={() => navigate(`/${tenantId}/crm/proposals/new`)} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" /> New Proposal
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <CardTitle>{getTitle()}</CardTitle>
            <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
                <Input 
                    placeholder="Search proposals..." 
                    className="pl-8" 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
                </div>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="icon" title="Filter Status">
                            <Filter className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleFilterChange('all')}>All Statuses</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleFilterChange('waiting_approval,expired')}>Waiting Approval / Expired</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleFilterChange('draft')}>Draft</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleFilterChange('sent')}>Sent</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleFilterChange('accepted')}>Accepted</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleFilterChange('rejected')}>Rejected</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8">Loading...</TableCell></TableRow>
              ) : filteredProposals.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No proposals found.</TableCell></TableRow>
              ) : filteredProposals.map((prop) => (
                <TableRow key={prop.id} className="cursor-pointer hover:bg-slate-50 group" onClick={() => navigate(`/${tenantId}/crm/proposals/${prop.id}`)}>
                  <TableCell className="font-medium font-mono text-xs">#{prop.quote_number}</TableCell>
                  <TableCell>
                      <div className="font-medium">{prop.leads?.first_name} {prop.leads?.last_name}</div>
                      <div className="text-xs text-slate-500">{prop.leads?.company}</div>
                  </TableCell>
                  <TableCell>{format(new Date(prop.created_at), 'MMM d, yyyy')}</TableCell>
                  <TableCell>${Number(prop.total_amount).toFixed(2)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={getStatusColor(prop.status)}>
                        {prop.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        {processingId === prop.id ? (
                            <Button size="sm" variant="ghost" disabled>
                                <Loader2 className="w-4 h-4 animate-spin" />
                            </Button>
                        ) : (
                            <>
                                {(prop.status === 'draft' || prop.status === 'pending_review') && (
                                    <Button size="sm" variant="outline" onClick={(e) => handleStatusUpdate(prop.id, 'sent', e)} title="Mark Sent">
                                        <Send className="w-4 h-4 text-blue-600" />
                                    </Button>
                                )}
                                {(prop.status === 'sent' || prop.status === 'viewed') && (
                                    <>
                                        <Button size="sm" variant="outline" className="border-green-200 hover:bg-green-50" onClick={(e) => handleStatusUpdate(prop.id, 'accepted', e)} title="Client Accepted">
                                            <Check className="w-4 h-4 text-green-600" />
                                        </Button>
                                        <Button size="sm" variant="outline" className="border-red-200 hover:bg-red-50" onClick={(e) => handleStatusUpdate(prop.id, 'rejected', e)} title="Client Rejected">
                                            <X className="w-4 h-4 text-red-600" />
                                        </Button>
                                    </>
                                )}
                                <Button variant="ghost" size="sm" onClick={() => navigate(`/${tenantId}/crm/proposals/${prop.id}`)}>
                                    <FileText className="w-4 h-4" />
                                </Button>
                            </>
                        )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProposalList;
