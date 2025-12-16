
import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { getTenantId } from '@/lib/tenantUtils'; // IMPORT TENANT UTILS
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Search, DollarSign, MapPin, User, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { format } from 'date-fns';

const COLUMNS = [
  { id: 'New', title: 'New Leads', color: 'bg-blue-500' },
  { id: 'Working', title: 'Working', color: 'bg-yellow-500' },
  { id: 'Scheduled', title: 'Scheduled', color: 'bg-purple-500' },
  { id: 'Closed', title: 'Closed', color: 'bg-green-500' },
  { id: 'Lost', title: 'Lost', color: 'bg-red-500' }
];

const Pipeline = () => {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();
  const tenantId = getTenantId();

  useEffect(() => {
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('leads')
        .select(`
          id,
          status,
          first_name,
          last_name,
          company,
          created_at,
          jobs (
            total_amount,
            technician_id
          ),
          estimates!estimates_lead_id_fkey (
            total_price
          )
        `)
        .eq('tenant_id', tenantId); // TENANT FILTER

      if (error) throw error;
      setLeads(data || []);
    } catch (error) {
      console.error('Error fetching leads:', error);
      toast({
        variant: "destructive",
        title: "Error fetching leads",
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDragEnd = async (result) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const newStatus = destination.droppableId;
    
    // Optimistic update
    const updatedLeads = leads.map(lead => 
      lead.id === draggableId ? { ...lead, status: newStatus } : lead
    );
    setLeads(updatedLeads);

    try {
      const { error } = await supabase
        .from('leads')
        .update({ status: newStatus })
        .eq('id', draggableId)
        .eq('tenant_id', tenantId); // TENANT CHECK

      if (error) throw error;
      
      toast({
        title: "Status Updated",
        description: `Lead moved to ${newStatus}`
      });
    } catch (error) {
      console.error('Error updating status:', error);
      toast({
        variant: "destructive",
        title: "Update failed",
        description: "Could not update lead status."
      });
      fetchLeads(); // Revert on error
    }
  };

  const filteredLeads = leads.filter(lead => {
    const searchString = searchTerm.toLowerCase();
    const fullName = `${lead.first_name || ''} ${lead.last_name || ''}`.toLowerCase();
    const company = (lead.company || '').toLowerCase();
    return fullName.includes(searchString) || company.includes(searchString);
  });

  const getColumnLeads = (status) => {
    return filteredLeads.filter(lead => {
        const leadStatus = (lead.status || 'New').toLowerCase();
        const colId = status.toLowerCase();
        
        if (colId === 'new' && leadStatus === 'new') return true;
        if (colId === 'working' && (leadStatus === 'working' || leadStatus === 'contacted')) return true;
        if (colId === 'scheduled' && leadStatus === 'scheduled') return true;
        if (colId === 'closed' && (leadStatus === 'closed' || leadStatus === 'won' || leadStatus === 'customer')) return true;
        if (colId === 'lost' && (leadStatus === 'lost' || leadStatus === 'archived')) return true;
        if (status === 'New' && !['new','working','contacted','scheduled','closed','won','customer','lost','archived'].includes(leadStatus)) return true;
        return false;
    });
  };

  if (loading) {
    return (
        <div className="flex items-center justify-center h-full min-h-[500px]">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pipeline</h1>
          <p className="text-muted-foreground">Manage your opportunities and lead flow.</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Search leads..."
                    className="pl-8"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
          <Button onClick={() => toast({ title: "Use 'New Lead' form in Lead Console" })}>
            <Plus className="mr-2 h-4 w-4" /> New Lead
          </Button>
        </div>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex-1 overflow-x-auto pb-4">
            <div className="flex h-full space-x-4 min-w-[1000px]">
                {COLUMNS.map(column => (
                    <div key={column.id} className="flex flex-col w-80 bg-slate-50/50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-800">
                        <div className={`p-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between rounded-t-lg ${column.color} bg-opacity-10`}>
                            <h3 className="font-semibold text-sm flex items-center">
                                <span className={`w-3 h-3 rounded-full mr-2 ${column.color}`}></span>
                                {column.title}
                            </h3>
                            <Badge variant="secondary" className="text-xs font-mono">
                                {getColumnLeads(column.id).length}
                            </Badge>
                        </div>
                        
                        <Droppable droppableId={column.id}>
                            {(provided, snapshot) => (
                                <div
                                    {...provided.droppableProps}
                                    ref={provided.innerRef}
                                    className={`flex-1 p-2 space-y-2 overflow-y-auto min-h-[150px] transition-colors ${
                                        snapshot.isDraggingOver ? 'bg-slate-100 dark:bg-slate-800/80' : ''
                                    }`}
                                >
                                    {getColumnLeads(column.id).map((lead, index) => (
                                        <Draggable key={lead.id} draggableId={lead.id} index={index}>
                                            {(provided, snapshot) => (
                                                <Card
                                                    ref={provided.innerRef}
                                                    {...provided.draggableProps}
                                                    {...provided.dragHandleProps}
                                                    className={`cursor-grab active:cursor-grabbing hover:shadow-md transition-all border-l-4 ${
                                                        snapshot.isDragging ? 'shadow-xl rotate-2 scale-105 opacity-90' : ''
                                                    } ${column.color.replace('bg-', 'border-')}`}
                                                >
                                                    <CardContent className="p-3 space-y-2">
                                                        <div className="flex justify-between items-start">
                                                            <div className="flex-1 min-w-0">
                                                                <h4 className="font-semibold text-sm truncate text-slate-900 dark:text-slate-100">
                                                                    {lead.company || `${lead.first_name || ''} ${lead.last_name || ''}` || 'Unnamed Lead'}
                                                                </h4>
                                                                {(lead.company && (lead.first_name || lead.last_name)) && (
                                                                    <p className="text-xs text-muted-foreground flex items-center mt-1 truncate">
                                                                        <User className="w-3 h-3 mr-1 shrink-0" />
                                                                        {lead.first_name} {lead.last_name}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {lead.properties && lead.properties.address1 && (
                                                            <div className="text-xs text-muted-foreground flex items-center truncate" title={lead.properties.address1}>
                                                                <MapPin className="w-3 h-3 mr-1 shrink-0" />
                                                                <span className="truncate">{lead.properties.address1}</span>
                                                            </div>
                                                        )}

                                                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                                                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                                                                {lead.created_at && format(new Date(lead.created_at), 'MMM d')}
                                                            </span>
                                                            {lead.jobs && lead.jobs.length > 0 && lead.jobs[0].total_amount > 0 && (
                                                                <Badge variant="outline" className="text-[10px] px-1.5 h-5 border-green-200 text-green-700 bg-green-50 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800">
                                                                    <DollarSign className="w-2.5 h-2.5 mr-0.5" />
                                                                    {lead.jobs[0].total_amount}
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            )}
                                        </Draggable>
                                    ))}
                                    {provided.placeholder}
                                </div>
                            )}
                        </Droppable>
                    </div>
                ))}
            </div>
        </div>
      </DragDropContext>
    </div>
  );
};

export default Pipeline;
