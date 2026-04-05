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
import { Textarea } from '@/components/ui/textarea';

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
  UserPlus,
  AlertCircle,
  Ticket,
  Copy,
  Trash2
} from 'lucide-react';
import { format } from 'date-fns';
import { formatPhoneNumber } from '@/lib/formUtils';

const PIPELINE_STAGES = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'job_complete', label: 'Work Order Complete' },
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

const normalizePreferredDocumentDelivery = (value) => {
  const normalized = String(value || '').toLowerCase().trim();
  if (normalized === 'email') return 'email';
  if (normalized === 'sms') return 'sms';
  return 'auto';
};

const mapDocumentDeliveryToContactMethod = (value) => {
  const normalized = normalizePreferredDocumentDelivery(value);
  if (normalized === 'email') return 'email';
  if (normalized === 'sms') return 'phone';
  return null;
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
    service: '',
    persona: 'homeowner',
    pipelineStage: 'new',
    preferredDocumentDelivery: 'auto',
    smsConsent: false,
    smsOptOut: false,
    consentMarketing: true,
    enrollMarketing: true,
    referrerId: 'none'
  });

  const [selectedLead, setSelectedLead] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Drawer form data
  const [drawerFormData, setDrawerFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    service: '',
    notes: '',
    persona: 'homeowner',
    pipelineStage: 'new',
    preferredDocumentDelivery: 'auto',
    smsConsent: false,
    smsOptOut: false,
    consentMarketing: false,
    needsAiAction: false,
    referrerId: 'none'
  });
  const [isUpdatingLead, setIsUpdatingLead] = useState(false);
  const [pipelineHistory, setPipelineHistory] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // CURRENT TENANT ID
  const tenantId = getTenantId();
  const debugPersonaCounts = tenantId === 'tvg' && searchParams.get('debugPersonaCounts') === '1';

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
        .or(`persona.in.(${partnerPersonas.join(',')}),persona.is.null,persona.eq.homeowner`)
        .order('first_name', { ascending: true });

      if (error) throw error;
      setPartners(data || []);

      if (debugPersonaCounts) {
        const { data: personaRows, error: personaError } = await supabase
          .from('leads')
          .select('persona')
          .eq('tenant_id', tenantId);

        if (personaError) {
          console.warn('[Leads] Debug persona counts failed:', personaError.message || personaError);
        } else {
          const counts = (personaRows || []).reduce((acc, row) => {
            const key = row?.persona || 'unknown';
            acc[key] = (acc[key] || 0) + 1;
            return acc;
          }, {});
          console.log('[Leads] Persona counts (tenant tvg):', counts);
        }
      }
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
  const isMissingColumnError = (error) => {
    if (!error) return false;
    if (error.code === 'PGRST204' || error.code === '42703') return true;
    const msg = String(error.message || '').toLowerCase();
    return msg.includes('column') && (msg.includes('does not exist') || msg.includes('could not find'));
  };

  const getMissingColumnName = (error) => {
    const message = String(error?.message || '');
    const postgresMatch = message.match(/column "([^"]+)"/i);
    if (postgresMatch) return postgresMatch[1];
    const cacheMatch = message.match(/could not find the '([^']+)' column/i);
    return cacheMatch ? cacheMatch[1] : null;
  };

  const NOTES_FALLBACK_FIELD = 'message';
  const STAGE_TO_STATUS_MAP = {
    new: 'new',
    contacted: 'contacted',
    qualified: 'qualified',
    scheduled: 'scheduled',
    job_complete: 'converted',
    nurture: 'contacted',
    lost: 'lost',
  };

  const STAGE_SYNONYMS = {
    completed: 'job_complete',
    complete: 'job_complete',
    won: 'job_complete',
  };

  const STATUS_TO_STAGE_MAP = {
    new: 'new',
    contacted: 'contacted',
    working: 'contacted',
    attempted_contact: 'contacted',
    attempting: 'contacted',
    dormant: 'contacted',
    qualified: 'qualified',
    scheduled: 'scheduled',
    converted: 'job_complete',
    completed: 'job_complete',
    lost: 'lost',
    junk: 'lost',
    archived: 'lost',
  };

  const PIPELINE_STATUS_SET = new Set(Object.keys(STATUS_TO_STAGE_MAP));

  const resolveLeadNotes = (lead) => lead?.notes ?? lead?.[NOTES_FALLBACK_FIELD] ?? '';

  const normalizeStageValue = (value) => String(value ?? '').toLowerCase().trim();

  const buildPipelineWarnContext = (context = {}) => ({
    lead_id: context.lead_id ?? null,
    pipeline_stage: context.pipeline_stage ?? null,
    status: context.status ?? null,
  });

  const normalizeStage = (value, context) => {
    const normalized = normalizeStageValue(value);
    if (!normalized) return null;
    if (STAGE_SYNONYMS[normalized]) return STAGE_SYNONYMS[normalized];
    if (STAGE_TO_STATUS_MAP[normalized]) return normalized;
    console.warn('[Leads] Unknown pipeline stage value:', {
      ...buildPipelineWarnContext(context),
      raw: value,
      normalized,
    });
    return null;
  };

  const resolvePipelineStage = (lead) => {
    const stageCandidate = normalizeStage(lead?.pipeline_stage || lead?.stage, {
      lead_id: lead?.id,
      pipeline_stage: lead?.pipeline_stage ?? lead?.stage ?? null,
      status: lead?.status ?? null,
    });
    if (stageCandidate) return stageCandidate;

    const status = normalizeStageValue(lead?.status);
    if (!status) return 'new';
    if (STATUS_TO_STAGE_MAP[status]) return STATUS_TO_STAGE_MAP[status];
    console.warn('[Leads] Pipeline stage fallback to default:', {
      ...buildPipelineWarnContext({
        lead_id: lead?.id,
        pipeline_stage: lead?.pipeline_stage ?? lead?.stage ?? null,
        status: lead?.status ?? null,
      }),
    });
    return 'new';
  };

  const mapStageToStatus = (stageRaw) => {
    const stage = normalizeStage(stageRaw, { pipeline_stage: stageRaw });
    if (!stage) return 'new';
    return STAGE_TO_STATUS_MAP[stage] || 'new';
  };

  const computeStatusForSave = (lead, stageValue) => {
    const normalizedCurrent = normalizeStageValue(lead?.status);
    const currentStage = resolvePipelineStage(lead);
    const nextStage = normalizeStageValue(stageValue) || currentStage || 'new';
    const mappedStatus = mapStageToStatus(nextStage);

    const shouldSyncStatus =
      !normalizedCurrent ||
      PIPELINE_STATUS_SET.has(normalizedCurrent) ||
      normalizeStageValue(currentStage) !== normalizeStageValue(nextStage);

    return shouldSyncStatus ? mappedStatus : lead?.status || mappedStatus;
  };

  const buildLeadPayloadFromForm = (nowIso) => ({
    first_name: drawerFormData.firstName,
    last_name: drawerFormData.lastName,
    email: drawerFormData.email || null,
    phone: drawerFormData.phone || null,
    service: drawerFormData.service || null,
    pipeline_stage: normalizeStageValue(drawerFormData.pipelineStage) || 'new',
    status: computeStatusForSave(selectedLead, drawerFormData.pipelineStage),
    preferred_document_delivery:
      normalizePreferredDocumentDelivery(drawerFormData.preferredDocumentDelivery) === 'auto'
        ? null
        : normalizePreferredDocumentDelivery(drawerFormData.preferredDocumentDelivery),
    sms_consent: drawerFormData.smsConsent === true,
    sms_opt_out: drawerFormData.smsOptOut === true,
    notes: drawerFormData.notes || null,
    updated_at: nowIso,
  });

  const buildLeadPayloadFromLead = (lead, nowIso) => ({
    first_name: lead?.first_name || '',
    last_name: lead?.last_name || '',
    email: lead?.email || null,
    phone: lead?.phone || null,
    service: lead?.service || null,
    pipeline_stage: resolvePipelineStage(lead),
    status: lead?.status || null,
    preferred_document_delivery:
      normalizePreferredDocumentDelivery(lead?.preferred_document_delivery) === 'auto'
        ? null
        : normalizePreferredDocumentDelivery(lead?.preferred_document_delivery),
    sms_consent: lead?.sms_consent === true,
    sms_opt_out: lead?.sms_opt_out === true,
    notes: resolveLeadNotes(lead) || null,
    updated_at: nowIso,
  });

  const updateLeadWithFallback = async (leadId, payloadBase) => {
    let payload = { ...payloadBase };
    let { error } = await supabase
      .from('leads')
      .update(payload)
      .eq('id', leadId);

    if (error && isMissingColumnError(error)) {
      const missingColumn = getMissingColumnName(error);
      payload = { ...payloadBase };

      if (missingColumn === 'pipeline_stage') {
        payload.stage = payload.pipeline_stage;
        delete payload.pipeline_stage;
      }

      if (missingColumn === 'status') {
        delete payload.status;
      }

      if (missingColumn === 'notes') {
        // Notes column may not exist in some schemas. Fall back to legacy `message`.
        payload[NOTES_FALLBACK_FIELD] = payload.notes;
        delete payload.notes;
      }

      if (missingColumn === 'preferred_document_delivery') {
        delete payload.preferred_document_delivery;
      }

      if (missingColumn === 'sms_consent') {
        delete payload.sms_consent;
      }

      if (missingColumn === 'sms_opt_out') {
        delete payload.sms_opt_out;
      }

      const retry = await supabase
        .from('leads')
        .update(payload)
        .eq('id', leadId);
      if (retry.error) throw retry.error;
      return;
    }

    if (error) {
      throw error;
    }
  };

  const createContactForLead = async (payload, nowIso) => {
    const basePayload = {
      tenant_id: tenantId,
      first_name: payload.first_name || null,
      last_name: payload.last_name || null,
      email: payload.email || null,
      phone: payload.phone || null,
      preferred_contact_method: mapDocumentDeliveryToContactMethod(payload.preferred_document_delivery),
      created_at: nowIso,
      updated_at: nowIso,
    };

    let { data, error } = await supabase
      .from('contacts')
      .insert(basePayload)
      .select('id')
      .single();

    if (error && isMissingColumnError(error) && getMissingColumnName(error) === 'tenant_id') {
      const fallbackPayload = { ...basePayload };
      delete fallbackPayload.tenant_id;
      const retry = await supabase
        .from('contacts')
        .insert(fallbackPayload)
        .select('id')
        .single();
      data = retry.data;
      error = retry.error;
    }

    if (error && isMissingColumnError(error) && getMissingColumnName(error) === 'preferred_contact_method') {
      const fallbackPayload = { ...basePayload };
      delete fallbackPayload.preferred_contact_method;
      const retry = await supabase
        .from('contacts')
        .insert(fallbackPayload)
        .select('id')
        .single();
      data = retry.data;
      error = retry.error;
    }

    if (error) throw error;
    return data;
  };

  const resetDrawerFormFromLead = (lead) => {
    if (!lead) return;
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
      service: lead.service || '',
      notes: resolveLeadNotes(lead),
      persona: safePersona,
      pipelineStage: resolvePipelineStage(lead),
      preferredDocumentDelivery: normalizePreferredDocumentDelivery(lead.preferred_document_delivery),
      smsConsent: lead.sms_consent || false,
      smsOptOut: lead.sms_opt_out || false,
      consentMarketing: lead.consent_marketing || false,
      needsAiAction: lead.needs_ai_action || false,
      referrerId: lead.referrer_id || 'none'
    });
  };

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
      service: lead.service || '',
      notes: lead.notes || lead.message || '',
      persona: safePersona,
      pipelineStage: resolvePipelineStage(lead),
      preferredDocumentDelivery: normalizePreferredDocumentDelivery(lead.preferred_document_delivery),
      smsConsent: lead.sms_consent || false,
      smsOptOut: lead.sms_opt_out || false,
      consentMarketing: lead.consent_marketing || false,
      needsAiAction: lead.needs_ai_action || false,
      referrerId: lead.referrer_id || 'none'
    });
    setSearchParams({ leadId: lead.id }, { replace: true });
    setIsDrawerOpen(true);
  };

  const handleUpdateLead = async () => {
    if (!selectedLead) return;
    setIsUpdatingLead(true);

    const nowIso = new Date().toISOString();
    const previousLead = selectedLead;
    const leadPayloadBase = buildLeadPayloadFromForm(nowIso);

    try {
      await updateLeadWithFallback(selectedLead.id, leadPayloadBase);

      let effectiveContactId = selectedLead.contact_id || null;

      if (!effectiveContactId) {
        try {
          const createdContact = await createContactForLead(leadPayloadBase, nowIso);
          effectiveContactId = createdContact?.id || null;
          if (!effectiveContactId) {
            throw new Error('Contact was created but no id was returned.');
          }

          const { error: linkError } = await supabase
            .from('leads')
            .update({ contact_id: effectiveContactId, updated_at: nowIso })
            .eq('id', selectedLead.id);

          if (linkError) {
            throw linkError;
          }
        } catch (contactCreateError) {
          console.error("Contact creation failed:", contactCreateError);
          let rollbackFailed = false;
          try {
            const rollbackPayload = buildLeadPayloadFromLead(previousLead, nowIso);
            await updateLeadWithFallback(selectedLead.id, rollbackPayload);
          } catch (rollbackError) {
            rollbackFailed = true;
            console.error("Lead rollback failed after contact create error:", rollbackError);
          }

          setSelectedLead(previousLead);
          setLeads((prev) =>
            prev.map((lead) => (lead.id === previousLead.id ? { ...lead, ...previousLead } : lead))
          );
          resetDrawerFormFromLead(previousLead);

          toast({
            variant: "destructive",
            title: "Update failed",
            description: rollbackFailed
              ? "Contact creation failed and lead rollback did not complete. Please refresh and retry."
              : "Contact creation failed. Lead changes were rolled back.",
          });
          return;
        }
      }

      if (effectiveContactId) {
        let contactPayload = {
          first_name: drawerFormData.firstName || null,
          last_name: drawerFormData.lastName || null,
          email: drawerFormData.email || null,
          phone: drawerFormData.phone || null,
          preferred_contact_method: mapDocumentDeliveryToContactMethod(drawerFormData.preferredDocumentDelivery),
          updated_at: nowIso,
        };

        let { error: contactError } = await supabase
          .from('contacts')
          .update(contactPayload)
          .eq('id', effectiveContactId);

        if (contactError && isMissingColumnError(contactError) && getMissingColumnName(contactError) === 'preferred_contact_method') {
          contactPayload = { ...contactPayload };
          delete contactPayload.preferred_contact_method;
          const retry = await supabase
            .from('contacts')
            .update(contactPayload)
            .eq('id', effectiveContactId);
          contactError = retry.error;
        }

        if (contactError) {
          console.error("Contact update failed:", contactError);
            let rollbackFailed = false;
            try {
              const rollbackPayload = buildLeadPayloadFromLead(previousLead, nowIso);
              await updateLeadWithFallback(selectedLead.id, rollbackPayload);
            } catch (rollbackError) {
              rollbackFailed = true;
              console.error("Lead rollback failed after contact update error:", rollbackError);
            }

            setSelectedLead(previousLead);
            setLeads((prev) =>
              prev.map((lead) => (lead.id === previousLead.id ? { ...lead, ...previousLead } : lead))
            );
            resetDrawerFormFromLead(previousLead);

            toast({
              variant: "destructive",
              title: "Update failed",
              description: rollbackFailed
                ? "Contact update failed and lead rollback did not complete. Please refresh and retry."
                : "Contact update failed. Lead changes were rolled back.",
            });
            return;
          }
        }

      const updatedLead = {
        ...selectedLead,
        ...leadPayloadBase,
        contact_id: effectiveContactId ?? selectedLead.contact_id ?? null,
      };

      setSelectedLead(updatedLead);
      setLeads((prev) => prev.map((lead) => (lead.id === updatedLead.id ? { ...lead, ...updatedLead } : lead)));

      toast({ title: "Lead Updated", description: "Changes saved successfully." });
    } catch (error) {
      console.error("Error updating lead:", error);
      toast({ variant: "destructive", title: "Update Failed", description: error.message || "Unable to save lead." });
    } finally {
      setIsUpdatingLead(false);
    }
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
              description: "This lead has associated work orders or invoices. Archive them instead." 
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

  const handleAddSave = async () => {
     setIsSaving(true);
     try {
         const nowIso = new Date().toISOString();
         const pipelineStage = normalizeStageValue(addFormData.pipelineStage || 'new') || 'new';
         let payload = {
             first_name: addFormData.firstName,
             last_name: addFormData.lastName,
             email: addFormData.email,
             phone: addFormData.phone,
             service: addFormData.service,
             pipeline_stage: pipelineStage,
             status: mapStageToStatus(pipelineStage),
             preferred_document_delivery:
               normalizePreferredDocumentDelivery(addFormData.preferredDocumentDelivery) === 'auto'
                 ? null
                 : normalizePreferredDocumentDelivery(addFormData.preferredDocumentDelivery),
             sms_consent: addFormData.smsConsent === true,
             sms_opt_out: addFormData.smsOptOut === true,
             updated_at: nowIso,
             created_at: nowIso,
             is_test_data: isTrainingMode,
             tenant_id: tenantId // Explicitly setting tenant_id
         };

         let { error } = await supabase.from('leads').insert(payload);
         if (error && isMissingColumnError(error)) {
           payload = { ...payload };
           const missingColumn = getMissingColumnName(error);
           if (missingColumn === 'preferred_document_delivery') delete payload.preferred_document_delivery;
           if (missingColumn === 'sms_consent') delete payload.sms_consent;
           if (missingColumn === 'sms_opt_out') delete payload.sms_opt_out;
           if (missingColumn === 'pipeline_stage') {
             payload.stage = payload.pipeline_stage;
             delete payload.pipeline_stage;
           }
           if (missingColumn === 'tenant_id') {
             delete payload.tenant_id;
           }
           const retry = await supabase.from('leads').insert(payload);
           error = retry.error;
         }
         if (error) throw error;
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
      <Helmet><title>Leads | CRM</title></Helmet>

      {/* --- Actions Bar --- */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
          <p className="text-gray-500">Capture and qualify new conversations before they become opportunities.</p>
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
                             <Label>Document Delivery</Label>
                             <Select value={addFormData.preferredDocumentDelivery} onValueChange={(v) => setAddFormData({...addFormData, preferredDocumentDelivery: v})}>
                                 <SelectTrigger><SelectValue /></SelectTrigger>
                                 <SelectContent>
                                     <SelectItem value="auto">Auto</SelectItem>
                                     <SelectItem value="email">Email</SelectItem>
                                     <SelectItem value="sms">SMS</SelectItem>
                                 </SelectContent>
                             </Select>
                        </div>
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
                        <div className="col-span-2 flex flex-wrap gap-4 rounded-md border border-slate-200 p-3 text-sm">
                          <label className="flex items-center gap-2">
                            <Checkbox
                              checked={addFormData.smsConsent}
                              onCheckedChange={(checked) => setAddFormData({ ...addFormData, smsConsent: Boolean(checked) })}
                            />
                            SMS updates okay
                          </label>
                          <label className="flex items-center gap-2">
                            <Checkbox
                              checked={addFormData.smsOptOut}
                              onCheckedChange={(checked) => setAddFormData({ ...addFormData, smsOptOut: Boolean(checked) })}
                            />
                            Do not text
                          </label>
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
                    <TableHead>Lead Stage</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {leads.map((lead) => (
                    <TableRow
                      key={lead.id}
                      className="hover:bg-slate-50/80 cursor-pointer"
                      onClick={() => handleLeadClick(lead)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          handleLeadClick(lead);
                        }
                      }}
                    >
                        <TableCell>
                            <div className="font-medium text-gray-900">{lead.first_name} {lead.last_name}</div>
                            <div className="text-xs text-gray-500">{lead.email}</div>
                            <div className="mt-1 flex flex-wrap gap-1">
                              <Badge variant="outline" className="capitalize">
                                {normalizePreferredDocumentDelivery(lead.preferred_document_delivery)}
                              </Badge>
                              {lead.sms_opt_out && <Badge variant="destructive">No SMS</Badge>}
                            </div>
                        </TableCell>
                        <TableCell><Badge variant="outline">{lead.service || 'General'}</Badge></TableCell>
                        <TableCell><Badge>{resolvePipelineStage(lead)}</Badge></TableCell>
                        <TableCell className="text-right">
                             <Button
                               variant="ghost"
                               size="sm"
                               onClick={(event) => {
                                 event.stopPropagation();
                                 handleLeadClick(lead);
                               }}
                             >
                               <ArrowRight className="h-4 w-4" />
                             </Button>
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
                     <Button size="sm" variant="outline" onClick={handleUpdateLead} disabled={isUpdatingLead}>
                         {isUpdatingLead && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                         Save
                     </Button>
                     <Button size="sm" variant="destructive" onClick={handleDeleteLead}>
                         <Trash2 className="w-4 h-4 mr-2" /> Delete
                     </Button>
                 </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Contact Info</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="space-y-2">
                    <Label>First Name</Label>
                    <Input value={drawerFormData.firstName} onChange={(e) => setDrawerFormData({ ...drawerFormData, firstName: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Last Name</Label>
                    <Input value={drawerFormData.lastName} onChange={(e) => setDrawerFormData({ ...drawerFormData, lastName: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input value={drawerFormData.phone} onChange={(e) => setDrawerFormData({ ...drawerFormData, phone: formatPhoneNumber(e.target.value) })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input value={drawerFormData.email} onChange={(e) => setDrawerFormData({ ...drawerFormData, email: e.target.value })} />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label>Service Type</Label>
                    <Input value={drawerFormData.service} onChange={(e) => setDrawerFormData({ ...drawerFormData, service: e.target.value })} />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label>Pipeline Stage</Label>
                    <Select
                      value={drawerFormData.pipelineStage}
                      onValueChange={(value) => setDrawerFormData({ ...drawerFormData, pipelineStage: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select stage" />
                      </SelectTrigger>
                      <SelectContent>
                        {PIPELINE_STAGES.map((stage) => (
                          <SelectItem key={stage.value} value={stage.value}>
                            {stage.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label>Notes</Label>
                    <Textarea
                      value={drawerFormData.notes}
                      onChange={(e) => setDrawerFormData({ ...drawerFormData, notes: e.target.value })}
                      rows={4}
                      placeholder="Add internal notes about this lead."
                    />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label>Document Delivery Preference</Label>
                    <Select
                      value={drawerFormData.preferredDocumentDelivery}
                      onValueChange={(value) => setDrawerFormData({ ...drawerFormData, preferredDocumentDelivery: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">Auto</SelectItem>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="sms">SMS</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 flex flex-wrap gap-4 rounded-md border border-slate-200 p-3 text-sm">
                    <label className="flex items-center gap-2">
                      <Checkbox
                        checked={drawerFormData.smsConsent}
                        onCheckedChange={(checked) => setDrawerFormData({ ...drawerFormData, smsConsent: Boolean(checked) })}
                      />
                      SMS updates okay
                    </label>
                    <label className="flex items-center gap-2">
                      <Checkbox
                        checked={drawerFormData.smsOptOut}
                        onCheckedChange={(checked) => setDrawerFormData({ ...drawerFormData, smsOptOut: Boolean(checked) })}
                      />
                      Do not text
                    </label>
                  </div>
              </div>
            </div>

            <div className="h-px bg-slate-100" />
            
            <div className="space-y-4">
               <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                 <History className="h-4 w-4" /> Stage History
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

    </div>
  );
};

export default Leads;
