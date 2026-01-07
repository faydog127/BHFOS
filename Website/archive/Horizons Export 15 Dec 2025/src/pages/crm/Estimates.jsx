import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Plus, RefreshCw, Search, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

// Import the new/fixed modal
import EstimateEditorModal from '@/components/crm/estimates/EstimateEditorModal';

const Estimates = () => {
  const navigate = useNavigate();
  const [estimates, setEstimates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const fetchEstimates = async () => {
    setLoading(true);
    console.log("Fetching estimates..."); // Debug log 1
    try {
      // FIX: Explicitly specify the foreign key relationship using !estimates_lead_id_fkey
      // This is necessary because there is a circular reference (leads have estimate_id, estimates have lead_id)
      const { data, error } = await supabase
        .from('estimates')
        .select(`
          *,
          lead:leads!estimates_lead_id_fkey (
            first_name,
            last_name,
            company,
            email
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
          console.error("Supabase Error fetching estimates:", error);
          throw error;
      }
      
      console.log("Fetched Estimates Data:", data); // Debug log 2
      setEstimates(data || []);
    } catch (err) {
      console.error('Error in fetchEstimates:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEstimates();
  }, []);

  const handleRefresh = () => {
    fetchEstimates();
  };

  // Basic Filter Logic
  const filteredEstimates = estimates.filter(est => {
    const searchLower = searchTerm.toLowerCase();
    const estNum = est.estimate_number?.toLowerCase() || '';
    const leadName = `${est.lead?.first_name || ''} ${est.lead?.last_name || ''}`.toLowerCase();
    const company = est.lead?.company?.toLowerCase() || '';
    
    return estNum.includes(searchLower) || leadName.includes(searchLower) || company.includes(searchLower);
  });

  const getStatusColor = (status) => {
    switch(status?.toLowerCase()) {
      case 'draft': return 'bg-slate-500 hover:bg-slate-600';
      case 'submitted': return 'bg-blue-500 hover:bg-blue-600';
      case 'approved': return 'bg-green-500 hover:bg-green-600';
      case 'rejected': return 'bg-red-500 hover:bg-red-600';
      case 'sent': return 'bg-indigo-500 hover:bg-indigo-600';
      default: return 'bg-slate-400';
    }
  };

  const formatServices = (services) => {
    if (!services || !Array.isArray(services)) return 'No services listed';
    if (services.length === 0) return 'No services listed';
    const first = services[0].name || services[0].description || 'Service Item';
    const count = services.length - 1;
    return count > 0 ? `${first} + ${count} more` : first;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
           <h1 className="text-3xl font-bold tracking-tight text-slate-900">Estimates</h1>
           <p className="text-slate-500 mt-1">Manage all estimates and proposals in one place.</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
           <Button variant="outline" onClick={handleRefresh} disabled={loading} className="gap-2">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
           </Button>
           <Button onClick={() => setIsCreateModalOpen(true)} className="gap-2 bg-slate-900 text-white hover:bg-slate-800">
              <Plus className="w-4 h-4" />
              New Estimate
           </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {/* Toolbar */}
          <div className="p-4 border-b bg-slate-50/50 flex gap-4">
             <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input 
                  placeholder="Search by estimate #, name, or email..." 
                  className="pl-9 bg-white"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
             </div>
          </div>

          {/* Table */}
          <div className="rounded-md border-t-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 hover:bg-slate-50">
                  <TableHead className="w-[180px]">Estimate #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Services</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="w-[120px]">Status</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                   <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center">
                         <div className="flex justify-center items-center gap-2 text-slate-500">
                            <Loader2 className="h-5 w-5 animate-spin" /> Loading estimates...
                         </div>
                      </TableCell>
                   </TableRow>
                ) : filteredEstimates.length === 0 ? (
                   <TableRow>
                      <TableCell colSpan={7} className="h-32 text-center text-slate-500">
                         No estimates found. Click "New Estimate" to create one.
                      </TableCell>
                   </TableRow>
                ) : (
                  filteredEstimates.map((est) => (
                    <TableRow key={est.id} className="hover:bg-slate-50/50 group">
                      <TableCell className="font-medium">
                         <button 
                            onClick={() => navigate(`/crm/estimates/${est.id}`)}
                            className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 font-mono text-sm"
                         >
                            {est.estimate_number || 'PENDING'}
                         </button>
                      </TableCell>
                      <TableCell className="text-slate-500 text-sm">
                         {format(new Date(est.created_at), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell>
                         <div className="font-medium text-slate-900">
                            {est.lead?.first_name ? `${est.lead.first_name} ${est.lead.last_name}` : (est.lead?.company || 'Unknown Customer')}
                         </div>
                         {est.lead?.email && <div className="text-xs text-slate-400">{est.lead.email}</div>}
                      </TableCell>
                      <TableCell className="text-slate-600 text-sm max-w-[200px] truncate">
                         {formatServices(est.services)}
                      </TableCell>
                      <TableCell className="text-right font-bold text-slate-900">
                         ${Number(est.total_price).toLocaleString(undefined, { minimumFractionDigits: 0 })}
                      </TableCell>
                      <TableCell>
                         <Badge className={`${getStatusColor(est.status)} text-white border-0 capitalize`}>
                            {est.status || 'Draft'}
                         </Badge>
                      </TableCell>
                      <TableCell>
                         <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => navigate(`/crm/estimates/${est.id}`)}>
                            <ArrowRight className="w-4 h-4 text-slate-400" />
                         </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Connection to the Modal */}
      <EstimateEditorModal 
         isOpen={isCreateModalOpen}
         onClose={() => setIsCreateModalOpen(false)}
         onEstimateCreated={handleRefresh}
      />
    </div>
  );
};

export default Estimates;