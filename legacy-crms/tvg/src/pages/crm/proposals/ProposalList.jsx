import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, FileText, Loader2, Check, X, Filter, Trash2, Edit2 } from 'lucide-react';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

const ProposalList = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { activeTenantId } = useSupabaseAuth(); // activeTenantId is already available here per user instruction
  
  const [loading, setLoading] = useState(true);
  const [quotes, setQuotes] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  
  // Rejection Modal State
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [selectedQuoteId, setSelectedQuoteId] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectLoading, setRejectLoading] = useState(false);

  useEffect(() => {
    if (activeTenantId) {
      fetchQuotes();
    }
  }, [activeTenantId, statusFilter]);

  const fetchQuotes = async () => {
    setLoading(true);
    try {
      console.log(`Fetching quotes for activeTenantId=${activeTenantId}`);
      
      let query = supabase
        .from('quotes')
        .select('*, leads(first_name, last_name, company)')
        .eq('tenant_id', activeTenantId) // Added tenant filter
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;

      if (error) {
        // Handle missing column gracefully if migration hasn't run
        if (error.message?.includes('column') || error.code === '42703' || error.code === 'PGRST204') {
             console.warn("quotes table missing tenant_id; retrying without filter");
             let retryQuery = supabase
                .from('quotes')
                .select('*, leads(first_name, last_name, company)')
                .order('created_at', { ascending: false });
             
             if (statusFilter !== 'all') retryQuery = retryQuery.eq('status', statusFilter);
             
             const { data: retryData, error: retryError } = await retryQuery;
             if (retryError) throw retryError;
             setQuotes(retryData || []);
             return;
        }
        throw error;
      }
      
      setQuotes(data || []);
    } catch (error) {
      console.error('Error fetching quotes:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load proposals.'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (id, newStatus, reason = null) => {
    try {
      console.log(`Updating quote ${id} status to ${newStatus} for activeTenantId=${activeTenantId}`);
      
      const updateData = { 
        status: newStatus,
        ...(newStatus === 'accepted' ? { accepted_at: new Date().toISOString() } : {}),
        ...(newStatus === 'rejected' ? { rejected_at: new Date().toISOString(), rejection_reason: reason } : {})
      };

      // Add tenant_id check to update for safety
      let query = supabase
        .from('quotes')
        .update(updateData)
        .eq('id', id)
        .eq('tenant_id', activeTenantId); // Added tenant filter

      const { error } = await query;

      if (error) {
         // Fallback for missing column
         if (error.message?.includes('column') || error.code === '42703' || error.code === 'PGRST204') {
             const { error: retryError } = await supabase
                .from('quotes')
                .update(updateData)
                .eq('id', id);
             if (retryError) throw retryError;
         } else {
             throw error;
         }
      }

      toast({
        title: 'Status Updated',
        description: `Proposal marked as ${newStatus}.`
      });
      
      fetchQuotes();
      
      if (newStatus === 'rejected') {
          setIsRejectModalOpen(false);
          setRejectionReason('');
          setSelectedQuoteId(null);
      }

    } catch (error) {
      console.error('Error updating status:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message
      });
    }
  };

  const handleDelete = async (id) => {
      if (!window.confirm('Are you sure you want to delete this proposal?')) return;
      
      try {
          const { error } = await supabase.from('quotes').delete().eq('id', id);
          if (error) throw error;
          
          toast({ title: 'Deleted', description: 'Proposal deleted successfully.' });
          setQuotes(quotes.filter(q => q.id !== id));
      } catch (err) {
          toast({ variant: 'destructive', title: 'Error', description: err.message });
      }
  };

  const filteredQuotes = quotes.filter(quote => {
    const searchLower = searchQuery.toLowerCase();
    const customerName = `${quote.leads?.first_name || ''} ${quote.leads?.last_name || ''}`.toLowerCase();
    const company = (quote.leads?.company || '').toLowerCase();
    const quoteNum = String(quote.quote_number || '');
    
    return customerName.includes(searchLower) || company.includes(searchLower) || quoteNum.includes(searchLower);
  });

  const getStatusColor = (status) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'sent': return 'bg-blue-100 text-blue-800';
      case 'viewed': return 'bg-purple-100 text-purple-800';
      case 'accepted': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Proposals</h1>
          <p className="text-slate-500 mt-1">Manage estimates and quotes</p>
        </div>
        <Button onClick={() => navigate('/crm/proposals/new')} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" /> New Proposal
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <CardTitle>Actionable Proposals</CardTitle>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <Input 
                  placeholder="Search proposals..." 
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="flex bg-slate-100 p-1 rounded-md">
                  {['all', 'draft', 'sent', 'accepted'].map(status => (
                      <button
                        key={status}
                        onClick={() => setStatusFilter(status)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-sm capitalize transition-all ${statusFilter === status ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                      >
                          {status}
                      </button>
                  ))}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : filteredQuotes.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <FileText className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <p>No proposals found matching your criteria.</p>
            </div>
          ) : (
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
                {filteredQuotes.map((quote) => (
                  <TableRow key={quote.id} className="hover:bg-slate-50 transition-colors">
                    <TableCell className="font-medium">#{quote.quote_number}</TableCell>
                    <TableCell>
                      <div className="font-medium text-slate-900">
                        {quote.leads ? `${quote.leads.first_name} ${quote.leads.last_name}` : 'Unknown'}
                      </div>
                      {quote.leads?.company && (
                        <div className="text-xs text-slate-500">{quote.leads.company}</div>
                      )}
                    </TableCell>
                    <TableCell>{format(new Date(quote.created_at), 'MMM d, yyyy')}</TableCell>
                    <TableCell className="font-bold text-slate-700">
                      ${Number(quote.total_amount).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(quote.status)}>
                        {quote.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => navigate(`/crm/proposals/${quote.id}`)}
                            title="Edit"
                        >
                            <Edit2 className="w-4 h-4 text-slate-500 hover:text-blue-600" />
                        </Button>
                        
                        {(quote.status === 'sent' || quote.status === 'viewed') && (
                            <>
                                <Button 
                                    variant="outline" 
                                    size="icon" 
                                    className="h-8 w-8 text-green-600 border-green-200 hover:bg-green-50"
                                    onClick={() => handleUpdateStatus(quote.id, 'accepted')}
                                    title="Mark Accepted"
                                >
                                    <Check className="w-4 h-4" />
                                </Button>
                                <Button 
                                    variant="outline" 
                                    size="icon" 
                                    className="h-8 w-8 text-red-600 border-red-200 hover:bg-red-50"
                                    onClick={() => {
                                        setSelectedQuoteId(quote.id);
                                        setIsRejectModalOpen(true);
                                    }}
                                    title="Mark Rejected"
                                >
                                    <X className="w-4 h-4" />
                                </Button>
                            </>
                        )}
                        
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-slate-400 hover:text-red-600"
                            onClick={() => handleDelete(quote.id)}
                            title="Delete"
                        >
                            <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isRejectModalOpen} onOpenChange={setIsRejectModalOpen}>
          <DialogContent>
              <DialogHeader>
                  <DialogTitle>Reject Proposal</DialogTitle>
                  <DialogDescription>
                      Please provide a reason for rejection. This will be logged for reporting.
                  </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                  <Input 
                    placeholder="Reason (e.g., Price too high, Competitor selected)" 
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                  />
              </div>
              <DialogFooter>
                  <Button variant="ghost" onClick={() => setIsRejectModalOpen(false)}>Cancel</Button>
                  <Button 
                    variant="destructive" 
                    onClick={() => handleUpdateStatus(selectedQuoteId, 'rejected', rejectionReason)}
                    disabled={!rejectionReason.trim()}
                  >
                      Confirm Rejection
                  </Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProposalList;