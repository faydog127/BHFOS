
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { getTenantId } from '@/lib/tenantUtils'; // IMPORT TENANT UTILS
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import BulkOperations from '@/components/BulkOperations'; 
import { useTrainingMode } from '@/contexts/TrainingModeContext';
import LeadEditor from '@/components/LeadEditor'; 

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Plus, 
  RefreshCw, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  History,
  Filter,
  ArrowRight,
  Search,
  Save,
  UserPlus,
  AlertCircle,
  Ticket,
  Copy,
  Edit,
  Trash2
} from 'lucide-react';
import { format } from 'date-fns';
import { formatPhoneNumber } from '@/lib/formUtils';

const PIPELINE_STAGES = [
  { value: 'new', label: 'New' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'job_complete', label: 'Job Complete' },
  { value: 'nurture', label: 'Nurture' },
  { value: 'lost', label: 'Lost' }
];

const PERSONAS = [
  { value: 'homeowner', label: 'Homeowner' },
  { value: 'property_manager', label: 'Property Manager' },
  { value: 'realtor', label: 'Realtor' },
  { value: 'contractor', label: 'Contractor' },
  { value: 'vendor', label: 'Vendor' },
  { value: 'hoa', label: 'HOA / Condo Assoc.' },
  { value: 'government', label: 'Government / Municipal' },
  { value: 'b2b', label: 'B2B / Commercial' },
  { value: 'hvac_partner', label: 'HVAC Partner' },
  { value: 'other_partner', label: 'Other Partner' },
  { value: 'other', label: 'Other' }
];

const isPartnerPersona = (persona) => {
    if (!persona) return false;
    const normalized = persona.toLowerCase().trim();
    const partners = [
        'realtor', 
        'property_manager', 
        'contractor', 
        'vendor', 
        'hoa', 
        'government', 
        'b2b', 
        'hvac_partner',
        'other_partner'
    ];
    return partners.includes(normalized);
};

const Leads = () => {
  const { toast } = useToast();
  const { isTrainingMode } = useTrainingMode(); 
  const [searchParams, setSearchParams] = useSearchParams();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [partners, setPartners] = useState([]);
  const [loadingPartners, setLoadingPartners] = useState(false);

  const [stageFilter, setStageFilter] = useState('all');
  const [personaFilter, setPersonaFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [addFormData, setAddFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    persona: 'homeowner',
    pipelineStage: 'new',
    consentMarketing: true,
    enrollMarketing: true,
    referrerId: 'none'
  });

  const [selectedLead, setSelectedLead] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false); // For LeadEditor modal

  // Drawer form data
  const [drawerFormData, setDrawerFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    persona: 'homeowner',
    pipelineStage: 'new',
    consentMarketing: false,
    needsAiAction: false,
    referrerId: 'none'
  });
  const [isUpdatingLead, setIsUpdatingLead] = useState(false);
  const [pipelineHistory, setPipelineHistory] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // CURRENT TENANT ID
  const tenantId = getTenantId();

  const openDrawerForLead = useCallback(async (leadId) => {
    if (!leadId) return;
    const lead = leads.find(l => l.id === leadId) || (await supabase.from('leads').select(`*, referrer:leads!referrer_id(first_name, last_name, persona)`).eq('id', leadId).single()).data;
    if (lead) {
      handleLeadClick(lead);
    }
  }, [leads]); 

  useEffect(() => {
    const leadIdFromUrl = searchParams.get('leadId');
    if (leadIdFromUrl && leads.length > 0) {
      openDrawerForLead(leadIdFromUrl);
    }
  }, [leads, searchParams, openDrawerForLead]);
  
  const fetchLeads = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('leads')
        .select(`
          *,
          referrer:leads!referrer_id(first_name, last_name, persona)
        `)
        .eq('tenant_id', tenantId) // TENANT FILTER
        .order('created_at', { ascending: false })
        .limit(200);

      if (isTrainingMode) {
          query = query.eq('is_test_data', true);
      } else {
          query = query.or('is_test_data.eq.false,is_test_data.is.null');
      }

      if (stageFilter !== 'all') {
        query = query.eq('pipeline_stage', stageFilter);
      }
      if (personaFilter !== 'all') {
        query = query.eq('persona', personaFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setLeads(data || []);
    } catch (error) {
      console.error('Error fetching leads:', error);
      setError(error.message || 'Failed to load leads');
      toast({
        title: "Error",
        description: "Could not load leads list. Please try refreshing.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [stageFilter, personaFilter, toast, isTrainingMode, tenantId]); 

  useEffect(() => {
    fetchLeads();
    fetchPartners();
  }, [fetchLeads]);

  useEffect(() => {
    if (selectedLead) {
      fetchHistory(selectedLead.id);
    } else {
      if (searchParams.get('leadId')) {
        setSearchParams({}, { replace: true });
      }
    }
  }, [selectedLead, searchParams, setSearchParams]);

  const fetchPartners = async () => {
    setLoadingPartners(true);
    try {
      const partnerPersonas = [
        'realtor', 'property_manager', 'contractor', 'vendor', 'other_partner',
        'hoa', 'government', 'b2b', 'hvac_partner'
      ];
      
      const { data, error } = await supabase
        .from('leads')
        .select('id, first_name, last_name, persona')
        .eq('tenant_id', tenantId) // TENANT FILTER
        .in('persona', partnerPersonas)
        .order('first_name', { ascending: true });

      if (error) throw error;
      setPartners(data || []);
    } catch (error) {
      console.error('Error fetching partners:', error);
    } finally {
      setLoadingPartners(false);
    }
  };

  const fetchHistory = async (leadId) => {
    setIsLoadingHistory(true);
    setPipelineHistory([]);
    try {
      const { data, error } = await supabase
        .from('lead_pipeline_events')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPipelineHistory(data || []);
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // --- Add/Update Logic ---

  const handleLeadClick = (lead) => {
    setSelectedLead(lead);
    
    let rawPersona = (lead.persona || 'homeowner').toLowerCase().trim();
    if (rawPersona === 'property manager') rawPersona = 'property_manager';
    if (rawPersona === 'other partner') rawPersona = 'other_partner';
    if (rawPersona === 'b2b / commercial') rawPersona = 'b2b'; 

    const safePersona = PERSONAS.some(p => p.value === rawPersona) 
      ? rawPersona 
      : 'homeowner';

    setDrawerFormData({
      firstName: lead.first_name || '',
      lastName: lead.last_name || '',
      email: lead.email || '',
      phone: lead.phone ? formatPhoneNumber(lead.phone) : '',
      persona: safePersona,
      pipelineStage: lead.pipeline_stage || 'new',
      consentMarketing: lead.consent_marketing || false,
      needsAiAction: lead.needs_ai_action || false,
      referrerId: lead.referrer_id || 'none'
    });
    setSearchParams({ leadId: lead.id }, { replace: true });
    setIsDrawerOpen(true);
  };

  const handleDeleteLead = async () => {
      if (!selectedLead) return;

      // 1. Check for dependencies
      const { data: jobs } = await supabase.from('jobs').select('id').eq('lead_id', selectedLead.id);
      const { data: invoices } = await supabase.from('invoices').select('id').eq('lead_id', selectedLead.id);

      if ((jobs && jobs.length > 0) || (invoices && invoices.length > 0)) {
          toast({ 
              variant: "destructive", 
              title: "Cannot Delete", 
              description: "This lead has associated Jobs or Invoices. Archive them instead." 
          });
          return;
      }

      if (window.confirm("Are you sure you want to delete this lead? This cannot be undone.")) {
          const { error } = await supabase.from('leads').delete().eq('id', selectedLead.id);
          if (error) {
              toast({ variant: "destructive", title: "Error", description: error.message });
          } else {
              toast({ title: "Deleted", description: "Lead removed successfully." });
              setIsDrawerOpen(false);
              fetchLeads();
          }
      }
  };

  const handleEditSaved = () => {
    fetchLeads();
    setIsDrawerOpen(false);
  };

  const handleAddSave = async () => {
     setIsSaving(true);
     try {
         await supabase.from('leads').insert({
             first_name: addFormData.firstName,
             last_name: addFormData.lastName,
             email: addFormData.email,
             phone: addFormData.phone,
             service: addFormData.service,
             pipeline_stage: 'new',
             is_test_data: isTrainingMode,
             tenant_id: tenantId // Explicitly setting tenant_id
         });
         toast({ title: "Success", description: "Lead created." });
         setIsAddModalOpen(false);
         fetchLeads();
     } catch(e) {
         toast({ variant: "destructive", title: "Error", description: e.message });
     } finally {
         setIsSaving(false);
     }
  };

  // --- Render ---

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <Helmet><title>Leads & Pipeline | CRM</title></Helmet>

      {/* --- Actions Bar --- */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leads & Pipeline Manager</h1>
          <p className="text-gray-500">Manage lead stages, track history, and control marketing automation.</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto items-center">
            <BulkOperations tableName="leads" label="Leads" onImportSuccess={fetchLeads} />

            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search leads..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>

            <Button variant="outline" onClick={fetchLeads} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
            </Button>
            
            {/* Add Lead Dialog */}
            <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
                <DialogTrigger asChild>
                    <Button><Plus className="h-4 w-4 mr-2" /> Add Lead</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                    <DialogTitle>Add New Lead</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2"><Label>First Name</Label><Input value={addFormData.firstName} onChange={e => setAddFormData({...addFormData, firstName: e.target.value})} /></div>
                            <div className="space-y-2"><Label>Last Name</Label><Input value={addFormData.lastName} onChange={e => setAddFormData({...addFormData, lastName: e.target.value})} /></div>
                        </div>
                        <div className="space-y-2"><Label>Email</Label><Input value={addFormData.email} onChange={e => setAddFormData({...addFormData, email: e.target.value})} /></div>
                        <div className="space-y-2"><Label>Phone</Label><Input value={addFormData.phone} onChange={e => setAddFormData({...addFormData, phone: formatPhoneNumber(e.target.value)})} /></div>
                        <div className="space-y-2">
                             <Label>Service Interest</Label>
                             <Select onValueChange={v => setAddFormData({...addFormData, service: v})}>
                                 <SelectTrigger><SelectValue placeholder="Select Service" /></SelectTrigger>
                                 <SelectContent>
                                     <SelectItem value="Dryer Vent Cleaning">Dryer Vent Cleaning</SelectItem>
                                     <SelectItem value="Duct Cleaning">Duct Cleaning</SelectItem>
                                     <SelectItem value="Indoor Air Audit">Indoor Air Audit</SelectItem>
                                     <SelectItem value="Other">Other</SelectItem>
                                 </SelectContent>
                             </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={handleAddSave} disabled={isSaving}>Save</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
      </div>

      {/* --- Table --- */}
      <div className="rounded-md border bg-white shadow-sm">
        <Table>
            <TableHeader>
                <TableRow className="bg-slate-50/50">
                    <TableHead className="w-[300px]">Lead Details</TableHead>
                    <TableHead>Service</TableHead>
                    <TableHead>Pipeline Stage</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {leads.map((lead) => (
                    <TableRow key={lead.id} className="hover:bg-slate-50/80 cursor-pointer" onClick={() => handleLeadClick(lead)}>
                        <TableCell>
                            <div className="font-medium text-gray-900">{lead.first_name} {lead.last_name}</div>
                            <div className="text-xs text-gray-500">{lead.email}</div>
                        </TableCell>
                        <TableCell><Badge variant="outline">{lead.service || 'General'}</Badge></TableCell>
                        <TableCell><Badge>{lead.pipeline_stage}</Badge></TableCell>
                        <TableCell className="text-right">
                             <Button variant="ghost" size="sm"><ArrowRight className="h-4 w-4" /></Button>
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
      </div>

      {/* --- Drawer --- */}
      <Sheet open={isDrawerOpen} onOpenChange={(open) => { if (!open) setSelectedLead(null); setIsDrawerOpen(open); }}>
        <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Lead Details</SheetTitle>
            <SheetDescription>Manage lead information.</SheetDescription>
          </SheetHeader>

          <div className="py-6 space-y-6">
            {/* Header Actions */}
            <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border">
                 <div className="text-sm font-medium">Actions</div>
                 <div className="flex gap-2">
                     <Button size="sm" variant="outline" onClick={() => setIsEditing(true)}>
                         <Edit className="w-4 h-4 mr-2" /> Edit
                     </Button>
                     <Button size="sm" variant="destructive" onClick={handleDeleteLead}>
                         <Trash2 className="w-4 h-4 mr-2" /> Delete
                     </Button>
                 </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Contact Info</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-slate-500 block">Name</span> {selectedLead?.first_name} {selectedLead?.last_name}</div>
                  <div><span className="text-slate-500 block">Phone</span> {selectedLead?.phone || '-'}</div>
                  <div className="col-span-2"><span className="text-slate-500 block">Email</span> {selectedLead?.email || '-'}</div>
                  <div className="col-span-2"><span className="text-slate-500 block">Service</span> {selectedLead?.service || '-'}</div>
              </div>
            </div>

            <div className="h-px bg-slate-100" />
            
            <div className="space-y-4">
               <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                 <History className="h-4 w-4" /> Pipeline History
               </h3>
               {pipelineHistory.map((event, idx) => (
                    <div key={idx} className="text-xs text-slate-600 border-l-2 pl-2 border-slate-200">
                        Moved to <span className="font-medium">{event.to_stage}</span> on {format(new Date(event.created_at), 'MMM d, h:mm a')}
                    </div>
               ))}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* --- Edit Modal --- */}
      {selectedLead && (
        <LeadEditor 
            open={isEditing} 
            onClose={() => setIsEditing(false)} 
            lead={selectedLead} 
            onSave={handleEditSaved} 
        />
      )}

    </div>
  );
};

export default Leads;
