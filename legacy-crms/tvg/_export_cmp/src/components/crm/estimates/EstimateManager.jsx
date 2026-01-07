import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, FileText, Send, Check, X, ArrowRightLeft } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';
import EstimateEditorModal from './EstimateEditorModal';
import SendEstimateModal from './SendEstimateModal';
import { quoteService } from '@/services/quoteService';
import { useNavigate } from 'react-router-dom';

const EstimateManager = ({ leadId = null, compact = false }) => {
  const [estimates, setEstimates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [selectedEstimate, setSelectedEstimate] = useState(null);
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [convertingId, setConvertingId] = useState(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchEstimates();
  }, [leadId]);

  const fetchEstimates = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('estimates')
        .select(`
            *,
            lead:leads!estimates_lead_id_fkey (
                first_name, 
                last_name, 
                email,
                phone,
                company
            )
        `)
        .order('created_at', { ascending: false });

      if (leadId) {
        query = query.eq('lead_id', leadId);
      }

      const { data, error } = await query;
      
      if (error) {
          console.error("Supabase Estimate Fetch Error:", error);
          throw error;
      }
      
      setEstimates(data || []);
    } catch (error) {
      console.error('Error fetching estimates:', error);
      setEstimates([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setSelectedEstimate(null);
    setIsEditorOpen(true);
  };

  const handleEdit = (est) => {
    setSelectedEstimate(est);
    setIsEditorOpen(true);
  };

  const handleSend = (est) => {
      setSelectedEstimate(est);
      setIsSendModalOpen(true);
  };

  const handleConvertToQuote = async (est) => {
      setConvertingId(est.id);
      const result = await quoteService.createQuoteFromEstimate(est.id);
      
      if (result.success) {
          toast({ title: "Quote Created", description: `Converted Estimate #${est.estimate_number} to Quote #${result.quote.quote_number}` });
          navigate(`/crm/quotes/${result.quote.id}`); // Navigate to quote editor/view
      } else {
          toast({ variant: "destructive", title: "Conversion Failed", description: result.error });
      }
      setConvertingId(null);
  };

  const handleStatusChange = async (id, newStatus) => {
      try {
          const { error } = await supabase
            .from('estimates')
            .update({ status: newStatus })
            .eq('id', id);
            
          if (error) throw error;
          
          toast({ title: "Updated", description: `Estimate marked as ${newStatus}` });
          fetchEstimates();
      } catch(e) {
          toast({ variant: "destructive", title: "Update Failed", description: e.message });
      }
  };

  if (loading && !compact) {
    return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-slate-400" /></div>;
  }

  return (
    <div className={`space-y-4 ${compact ? 'p-0' : 'p-6'}`}>
      {!compact && (
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">Estimates</h2>
          <Button onClick={handleCreate}>
            <Plus className="w-4 h-4 mr-2" /> New Estimate
          </Button>
        </div>
      )}

      {compact && (
        <div className="flex justify-end mb-2">
             <Button size="sm" variant="outline" onClick={handleCreate}>
                <Plus className="w-3 h-3 mr-1" /> Add Estimate
             </Button>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                {!leadId && <TableHead>Customer</TableHead>}
                <TableHead>Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {estimates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                    {loading ? 'Loading...' : 'No estimates found.'}
                  </TableCell>
                </TableRow>
              ) : (
                estimates.map((est) => (
                  <TableRow key={est.id}>
                    <TableCell className="font-medium">{est.estimate_number || '---'}</TableCell>
                    {!leadId && (
                        <TableCell>
                            {est.lead ? (
                                <span>{est.lead.first_name} {est.lead.last_name}</span>
                            ) : (
                                <span className="text-slate-400 italic">No Lead</span>
                            )}
                        </TableCell>
                    )}
                    <TableCell>{est.created_at ? format(new Date(est.created_at), 'MMM d, yyyy') : '-'}</TableCell>
                    <TableCell>${Number(est.total_price || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell>
                      <Badge variant={
                        est.status === 'accepted' ? 'success' : 
                        est.status === 'sent' ? 'secondary' : 
                        est.status === 'rejected' ? 'destructive' : 'outline'
                      }>
                        {est.status || 'draft'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                        {est.status === 'draft' && (
                             <Button size="sm" variant="ghost" onClick={() => handleSend(est)} title="Send to Customer">
                                <Send className="w-4 h-4 text-blue-600" />
                             </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => handleEdit(est)}>
                            <FileText className="w-4 h-4" />
                        </Button>
                        
                        {/* Convert to Quote Action */}
                        <Button 
                            size="sm" 
                            variant="ghost" 
                            onClick={() => handleConvertToQuote(est)} 
                            disabled={convertingId === est.id}
                            title="Convert to Proposal"
                        >
                            {convertingId === est.id ? <Loader2 className="w-4 h-4 animate-spin"/> : <ArrowRightLeft className="w-4 h-4 text-orange-600" />}
                        </Button>

                        {est.status === 'sent' && (
                            <>
                                <Button size="sm" variant="ghost" onClick={() => handleStatusChange(est.id, 'accepted')} title="Mark Accepted">
                                    <Check className="w-4 h-4 text-green-600" />
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => handleStatusChange(est.id, 'rejected')} title="Mark Rejected">
                                    <X className="w-4 h-4 text-red-600" />
                                </Button>
                            </>
                        )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <EstimateEditorModal 
        isOpen={isEditorOpen} 
        onClose={() => setIsEditorOpen(false)} 
        estimate={selectedEstimate}
        leadId={leadId}
        onEstimateCreated={fetchEstimates}
        onEstimateUpdated={fetchEstimates}
      />
      
      <SendEstimateModal
         open={isSendModalOpen} 
         onOpenChange={setIsSendModalOpen}
         estimate={selectedEstimate}
         lead={selectedEstimate?.lead}
         onSent={fetchEstimates}
      />
    </div>
  );
};

export default EstimateManager;