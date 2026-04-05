import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { getTenantId, tenantPath } from '@/lib/tenantUtils';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '@/components/ui/command';
import { 
  Trash2, Plus, Save, Send, ArrowLeft, Loader2, Calculator, 
  AlertCircle, Search, UserPlus, Phone, Mail, Check, FileText, ChevronsUpDown,
  Wind, Flame, Sparkles, Wrench, Shield, BadgeDollarSign, Truck, Percent, Layers3, MapPin,
  ChevronRight, ChevronDown, ExternalLink, Printer
} from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import AddressAutocomplete from '@/components/AddressAutocomplete';
import { formatPhoneNumber } from '@/lib/formUtils';
import {
  getDeliveryPreferenceLabel,
  resolveLeadDelivery,
} from '@/lib/documentDelivery';
import DeliveryHistoryCard from '@/components/crm/documents/DeliveryHistoryCard';
import { openQuotePreview, openQuotePrintView } from '@/services/quotePreviewService';
import { clearBuilderDraft, loadBuilderDraft, saveBuilderDraft } from '@/lib/builderDrafts';
import {
  getQuoteRevisionMode,
  getQuoteRevisionNotice,
  isEditableQuoteStatus,
  isReleasedQuoteStatus,
  requiresSupersedeBeforeRevision,
} from '@/lib/documentSystem/releaseControl';

const PHASE1_CATEGORY_META = {
  all: { label: 'All Services', icon: Layers3 },
  dryer_vent: { label: 'Dryer Vent', icon: Flame },
  air_duct: { label: 'Air Duct', icon: Wind },
  iaq: { label: 'UV / IAQ', icon: Sparkles },
  hvac_restoration: { label: 'HVAC Restore', icon: Wrench },
  sanitization: { label: 'Sanitization', icon: Shield },
  package: { label: 'Packages', icon: Layers3 },
  modifiers: { label: 'Modifiers', icon: Wrench },
  admin: { label: 'Admin / Fees', icon: BadgeDollarSign },
  trip: { label: 'Trip / Travel', icon: Truck },
  discount: { label: 'Discounts', icon: Percent },
  odor: { label: 'Odor Control', icon: Sparkles },
  membership: { label: 'Membership', icon: Shield },
};

const PHASE1_TEMPLATE_LIBRARY = [
  { key: 'dryer_standard', label: 'Dryer Vent - Standard', codes: ['DV-STD'] },
  { key: 'dryer_two_story', label: 'Dryer Vent - 2 Story / Roof', codes: ['DV-STD', 'ACC-ROOF'] },
  { key: 'duct_one_system', label: 'Duct Cleaning - 1 System', codes: ['DUCT-SYS1'] },
  { key: 'duct_two_system', label: 'Duct Cleaning - 2 Systems', codes: ['DUCT-SYS1', 'DUCT-SYS-ADD'] },
  { key: 'realtor_refresh', label: 'Realtor Refresh Package', codes: ['PKG-REALTOR-REFRESH'] },
];

const PHASE1_QUICK_PICK_CODES = ['DV-STD', 'DUCT-SYS1', 'DUCT-SYS-ADD', 'PKG-COMP', 'PKG-REALTOR-REFRESH', 'COIL-CLEAN'];
const DEFAULT_QUOTE_TAX_RATE = 0;
const PROPOSAL_BUILDER_DRAFT_KEY = 'proposal_builder';
const DEFAULT_PROPOSAL_HEADER_TEXT = 'Thank you for considering our services. We are pleased to submit this quote for your review.';
const DEFAULT_PROPOSAL_FOOTER_TEXT = 'Please sign below to accept this quote. Work will begin upon receipt of the signed document.';

const hasMeaningfulProposalDraft = (proposal, sendChannel) => {
  const hasItems = Array.isArray(proposal?.items) && proposal.items.some((item) =>
    String(item?.description || '').trim() ||
    Number(item?.unit_price || 0) > 0 ||
    Number(item?.total_price || 0) > 0 ||
    Number(item?.quantity || 1) !== 1
  );

  return Boolean(
    String(proposal?.lead_id || '').trim() ||
    String(proposal?.service_address || '').trim() ||
    String(proposal?.customer_name || '').trim() ||
    String(proposal?.customer_email || '').trim() ||
    String(proposal?.customer_phone || '').trim() ||
    hasItems ||
    String(proposal?.header_text || '').trim() !== DEFAULT_PROPOSAL_HEADER_TEXT ||
    String(proposal?.footer_text || '').trim() !== DEFAULT_PROPOSAL_FOOTER_TEXT ||
    String(sendChannel || '').trim() !== 'email'
  );
};

const SERVICE_PLAN_LIBRARY = [
  {
    key: 'dryer_vent',
    label: 'Dryer Vent Cleaning',
    description: 'Base vent clean with conditional access modifiers.',
    icon: Flame,
  },
  {
    key: 'air_duct',
    label: 'Air Duct Cleaning',
    description: 'System-based duct cleaning with optional enhancements.',
    icon: Wind,
  },
  {
    key: 'uv_pco',
    label: 'UV / PCO Upgrade',
    description: 'IAQ equipment upgrades and optional restoration extras.',
    icon: Sparkles,
  },
];

const DEFAULT_PLAN_CONFIG = {
  dryer_vent: {
    roofAccess: false,
    transitionUpgrade: false,
    birdGuard: false,
    secondDryer: false,
  },
  air_duct: {
    systemCount: 1,
    includeCoilCleaning: false,
    includeBlowerCleaning: false,
    includeAhuHousingCleaning: false,
  },
  uv_pco: {
    packageType: 'uvc',
    includeCoilCleaning: false,
    includeBlowerCleaning: false,
  },
};

const normalizeCategory = (rawCategory) => String(rawCategory || '').trim().toLowerCase();
const normalizeAddress = (value) => String(value || '').replace(/\s+/g, ' ').trim();
const normalizeDigits = (value) => String(value || '').replace(/\D/g, '');
const isMissingColumnError = (error) =>
  error?.code === '42703' ||
  error?.code === 'PGRST204' ||
  /column .* does not exist/i.test(error?.message || '') ||
  /could not find the '.*' column/i.test(error?.message || '');
const isMissingRelationError = (error) =>
  ['42P01', 'PGRST201', 'PGRST204', 'PGRST205'].includes(String(error?.code || '')) ||
  /relation .* does not exist/i.test(String(error?.message || '')) ||
  /could not find the (table|relation) .* schema cache/i.test(String(error?.message || '')) ||
  /more than one relationship was found/i.test(String(error?.message || ''));

const getMissingColumnName = (error) => {
  const message = error?.message || '';
  const postgresMatch = message.match(/column "([^"]+)"/i);
  if (postgresMatch) return postgresMatch[1];
  const cacheMatch = message.match(/could not find the '([^']+)' column/i);
  return cacheMatch ? cacheMatch[1] : null;
};

const generateQuoteNumber = () =>
  Number(`${new Date().getFullYear()}${Math.floor(1000 + Math.random() * 9000)}`);

const insertLeadWithSchemaFallback = async (payload) => {
  let currentPayload = { ...payload };

  while (true) {
    const result = await supabase.from('leads').insert(currentPayload).select().single();
    if (!result.error) return result;

    if (!isMissingColumnError(result.error)) return result;

    const missingColumn = getMissingColumnName(result.error);
    if (!missingColumn || !Object.prototype.hasOwnProperty.call(currentPayload, missingColumn)) {
      return result;
    }

    const { [missingColumn]: _omitted, ...nextPayload } = currentPayload;
    currentPayload = nextPayload;
  }
};

const insertQuoteItemsWithSchemaFallback = async (items) => {
  let currentItems = items.map((item) => ({ ...item }));

  while (true) {
    const result = await supabase.from('quote_items').insert(currentItems);
    if (!result.error) return result;

    if (!isMissingColumnError(result.error)) return result;

    const missingColumn = getMissingColumnName(result.error);
    if (!missingColumn || !currentItems.some((item) => Object.prototype.hasOwnProperty.call(item, missingColumn))) {
      return result;
    }

    currentItems = currentItems.map((item) => {
      const { [missingColumn]: _omitted, ...nextItem } = item;
      return nextItem;
    });
  }
};

const fetchLeadsWithFallback = async (tenantId) => {
  const selectVariants = [
    '*, contact:contacts!leads_contact_id_fkey(preferred_contact_method), property:property_id(address1,address2,city,state,zip)',
    '*, property:property_id(address1,address2,city,state,zip)',
    '*',
  ];

  for (const selectClause of selectVariants) {
    const result = await supabase
      .from('leads')
      .select(selectClause)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (!result.error) {
      return result;
    }

    if (!isMissingColumnError(result.error) && !isMissingRelationError(result.error)) {
      return result;
    }
  }

  return { data: [], error: null };
};

const formatLeadServiceAddress = (lead) => {
  if (!lead) return '';
  const property = Array.isArray(lead.property) ? lead.property[0] : lead.property;
  if (!property || typeof property !== 'object') return '';
  return [
    property.address1,
    property.address2,
    property.city,
    property.state,
    property.zip,
  ]
    .map((part) => normalizeAddress(part))
    .filter(Boolean)
    .join(', ');
};

const formatSelectedAddress = (addressData) => {
  if (!addressData || typeof addressData !== 'object') return '';
  const street = normalizeAddress(addressData.street);
  const city = normalizeAddress(addressData.city);
  const state = normalizeAddress(addressData.state);
  const zip = normalizeAddress(addressData.zip);
  const composed = [street, [city, state, zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  return normalizeAddress(composed || addressData.formatted_address || '');
};

const searchableTokens = (item) =>
  [item?.code, item?.name, item?.category, item?.description].filter(Boolean).join(' ').toLowerCase();

const resolvePostSendQuoteStatus = (status) => {
  const normalized = String(status || '').trim().toLowerCase();

  if (['viewed', 'accepted', 'approved', 'paid', 'declined', 'rejected'].includes(normalized)) {
    return normalized;
  }

  return 'sent';
};

const ProposalBuilder = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  // 1. Get activeTenantId from context
  const { user, activeTenantId, isAdmin } = useSupabaseAuth();
  
  const [loading, setLoading] = useState(false);
  const tenantId = getTenantId();
  const resolvedTenantId = activeTenantId || tenantId;
  const [leads, setLeads] = useState([]);
  const [priceBook, setPriceBook] = useState([]);
  const [pricesUpdated, setPricesUpdated] = useState(false);
  const [existingActiveQuote, setExistingActiveQuote] = useState(null);
  const [overrideDialogOpen, setOverrideDialogOpen] = useState(false);
  const [overrideAcknowledged, setOverrideAcknowledged] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [pendingOverridePayload, setPendingOverridePayload] = useState(null);
  const [sendChannel, setSendChannel] = useState('email');
  const [catalogCategory, setCatalogCategory] = useState('all');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [openPickerRow, setOpenPickerRow] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [showAdvancedCatalog, setShowAdvancedCatalog] = useState(false);
  const [servicePlanDialogOpen, setServicePlanDialogOpen] = useState(false);
  const [selectedServicePlan, setSelectedServicePlan] = useState('dryer_vent');
  const [servicePlanConfig, setServicePlanConfig] = useState(() =>
    JSON.parse(JSON.stringify(DEFAULT_PLAN_CONFIG))
  );
  const restoredDraftRef = useRef(false);
  const proposalLoadedRef = useRef(false);
  
  // Customer Selection State
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerView, setCustomerView] = useState('search'); 
  const [createLoading, setCreateLoading] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    service: 'Duct Cleaning',
    temperature: 'Warm'
  });

  // Proposal State
  const [proposal, setProposal] = useState({
    lead_id: '',
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    status: 'Draft',
    valid_until: format(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
    service_address: '',
    header_text: DEFAULT_PROPOSAL_HEADER_TEXT,
    footer_text: DEFAULT_PROPOSAL_FOOTER_TEXT,
    items: []
  });

  useEffect(() => {
    restoredDraftRef.current = false;
    proposalLoadedRef.current = false;
  }, [id, activeTenantId]);

  const handleServiceAddressSelect = (addressData) => {
    const selected = formatSelectedAddress(addressData);
    if (!selected) return;
    setProposal((prev) => ({ ...prev, service_address: selected }));
  };

  useEffect(() => {
    if (activeTenantId) {
      fetchInitialData();
    }
  }, [id, activeTenantId]);

  useEffect(() => {
    if (!activeTenantId || restoredDraftRef.current || !proposalLoadedRef.current || loading) return;

    restoredDraftRef.current = true;
    const storedDraft = loadBuilderDraft(PROPOSAL_BUILDER_DRAFT_KEY, activeTenantId, id || 'new');
    if (!storedDraft?.proposal) return;

    setProposal((prev) => ({
      ...prev,
      ...storedDraft.proposal,
      items: Array.isArray(storedDraft.proposal.items) ? storedDraft.proposal.items : prev.items,
    }));

    if (typeof storedDraft.sendChannel === 'string' && storedDraft.sendChannel.trim()) {
      setSendChannel(storedDraft.sendChannel);
    }

    toast({
      title: 'Draft restored',
      description: 'Your in-progress quote was restored after leaving the page.',
    });
  }, [id, activeTenantId, loading, toast]);

  useEffect(() => {
    if (!activeTenantId || !proposalLoadedRef.current || loading) return;

    if (!hasMeaningfulProposalDraft(proposal, sendChannel)) {
      clearBuilderDraft(PROPOSAL_BUILDER_DRAFT_KEY, activeTenantId, id || 'new');
      return;
    }

    saveBuilderDraft(PROPOSAL_BUILDER_DRAFT_KEY, activeTenantId, id || 'new', {
      proposal,
      sendChannel,
    });
  }, [id, activeTenantId, loading, proposal, sendChannel]);

  useEffect(() => {
    if (!hasMeaningfulProposalDraft(proposal, sendChannel)) return undefined;

    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [proposal, sendChannel]);

  useEffect(() => {
    const lead = leads.find((item) => item.id === proposal.lead_id);
    if (!lead) return;
    const delivery = resolveLeadDelivery({
      lead: {
        ...lead,
        company: proposal.customer_name || lead.company,
        email: proposal.customer_email || lead.email,
        phone: proposal.customer_phone || lead.phone,
      },
    });
    if (delivery.channel) {
      setSendChannel(delivery.channel);
    }
  }, [proposal.customer_email, proposal.customer_name, proposal.customer_phone, proposal.lead_id, leads]);

  useEffect(() => {
    if (sendChannel !== 'sms') return;
    const lead = leads.find((item) => item.id === proposal.lead_id);
    const delivery = resolveLeadDelivery({
      lead: lead
        ? {
            ...lead,
            company: proposal.customer_name || lead.company,
            email: proposal.customer_email || lead.email,
            phone: proposal.customer_phone || lead.phone,
          }
        : lead,
      requestedChannel: 'sms',
    });
    if (delivery.channel !== 'sms') {
      setSendChannel('email');
    }
  }, [proposal.customer_email, proposal.customer_name, proposal.customer_phone, sendChannel, leads, proposal.lead_id]);

  useEffect(() => {
    const detectExistingActiveQuote = async () => {
      if (id || !proposal.lead_id || !activeTenantId) {
        setExistingActiveQuote(null);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('quotes')
          .select('id,quote_number,status,updated_at')
          .eq('lead_id', proposal.lead_id)
          .eq('tenant_id', activeTenantId)
          .order('updated_at', { ascending: false });

        if (error) throw error;

        const active = (data || []).find((q) => {
          const status = String(q?.status || 'draft').toLowerCase();
          return ['draft', 'pending_review', 'sent', 'viewed'].includes(status);
        });

        setExistingActiveQuote(active || null);
      } catch (err) {
        console.warn('Could not detect existing active quote:', err?.message || err);
        setExistingActiveQuote(null);
      }
    };

    detectExistingActiveQuote();
  }, [id, proposal.lead_id, activeTenantId]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      console.log(`Fetching leads for activeTenantId=${activeTenantId}`);
      console.log(`Fetching price_book for activeTenantId=${activeTenantId}`);

      const [leadsRes, priceBookRes] = await Promise.all([
          fetchLeadsWithFallback(activeTenantId),
          supabase.from('price_book')
            .select('*')
            .eq('active', true)
            .in('tenant_id', [activeTenantId || 'default', 'default'])
            .order('name')
      ]);

      if (leadsRes.error) throw leadsRes.error;
      if (priceBookRes.error) throw priceBookRes.error;

      if (leadsRes.data) setLeads(leadsRes.data);
      if (priceBookRes.data) {
        const sorted = [...priceBookRes.data].sort((a, b) => {
          const aRank = a.tenant_id === activeTenantId ? 0 : 1;
          const bRank = b.tenant_id === activeTenantId ? 0 : 1;
          if (aRank !== bRank) return aRank - bRank;
          return (a.name || '').localeCompare(b.name || '');
        });

        const deduped = [];
        const seenCodes = new Set();
        for (const row of sorted) {
          const key = row.code || row.id;
          if (seenCodes.has(key)) continue;
          seenCodes.add(key);
          deduped.push(row);
        }
        setPriceBook(deduped);
      }

      if (id) {
          console.log(`Fetching quotes for activeTenantId=${activeTenantId}`);
          const { data: prop, error } = await supabase
              .from('quotes')
              .select('*, quote_items(*)')
              .eq('id', id)
              .eq('tenant_id', activeTenantId) // Added tenant filter
              .maybeSingle();
              
          if (error) throw error;
          if (!prop) {
              toast({ variant: 'destructive', title: 'Not Found', description: 'Quote not found.' });
              return;
          }
          if (prop) {
              let items = prop.quote_items || [];
              let updated = false;
              const leadForQuote = (leadsRes.data || []).find((lead) => lead.id === prop.lead_id);
              const leadAddress = formatLeadServiceAddress(leadForQuote);

              if (['Draft', 'pending_review'].includes(prop.status)) {
                  items = items.map(item => {
                      if (item.price_book_code) {
                          const currentPriceItem = priceBookRes.data?.find(pb => pb.code === item.price_book_code);
                          if (currentPriceItem && Number(currentPriceItem.base_price) !== Number(item.unit_price)) {
                              updated = true;
                              return {
                                  ...item,
                                  unit_price: currentPriceItem.base_price,
                                  total_price: Number(item.quantity) * Number(currentPriceItem.base_price)
                              };
                          }
                      }
                      return item;
                  });
              }

              if (updated) {
                  setPricesUpdated(true);
                  toast({
                    title: "Prices Updated",
                    description: "Line item prices have been updated to match the current Pricing Guide.",
                    className: "bg-blue-50 border-blue-200"
                  });
              }

              setProposal({
                ...prop,
                customer_name: prop.customer_name || '',
                customer_email: prop.customer_email || '',
                customer_phone: prop.customer_phone || '',
                service_address: normalizeAddress(prop.service_address) || leadAddress || '',
                items,
              });
          }
      }
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      proposalLoadedRef.current = true;
      setLoading(false);
    }
  };

  const filteredLeads = useMemo(() => {
    const search = customerSearch.trim().toLowerCase();
    const searchDigits = normalizeDigits(customerSearch);

    return leads.filter((lead) => {
      if (!search) return true;

      const textFields = [
        `${lead.first_name || ''} ${lead.last_name || ''}`,
        `${lead.last_name || ''}, ${lead.first_name || ''}`,
        lead.first_name || '',
        lead.last_name || '',
        lead.full_name || '',
        lead.customer_name || '',
        lead.email || '',
        lead.company || '',
        lead.service || '',
      ]
        .join(' ')
        .toLowerCase();

      if (textFields.includes(search)) return true;

      if (!searchDigits) return false;

      return normalizeDigits(lead.phone).includes(searchDigits);
    });
  }, [leads, customerSearch]);

  const availableCategories = useMemo(() => {
    const counts = priceBook.reduce((acc, item) => {
      const categoryKey = normalizeCategory(item.category) || 'uncategorized';
      acc[categoryKey] = (acc[categoryKey] || 0) + 1;
      return acc;
    }, {});

    const options = Object.entries(counts)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([value, count]) => ({
        value,
        label: PHASE1_CATEGORY_META[value]?.label || value.replace(/_/g, ' '),
        count,
      }));

    return [{ value: 'all', label: PHASE1_CATEGORY_META.all.label, count: priceBook.length }, ...options];
  }, [priceBook]);

  const filteredPriceBook = useMemo(() => {
    const search = catalogSearch.trim().toLowerCase();
    return priceBook.filter((item) => {
      const inCategory =
        catalogCategory === 'all' || normalizeCategory(item.category) === normalizeCategory(catalogCategory);
      if (!inCategory) return false;
      if (!search) return true;
      return searchableTokens(item).includes(search);
    });
  }, [priceBook, catalogCategory, catalogSearch]);

  const groupedFilteredPriceBook = useMemo(() => {
    return filteredPriceBook.reduce((acc, row) => {
      const categoryKey = normalizeCategory(row.category) || 'uncategorized';
      if (!acc[categoryKey]) acc[categoryKey] = [];
      acc[categoryKey].push(row);
      return acc;
    }, {});
  }, [filteredPriceBook]);

  const quickPickItems = useMemo(() => {
    const byCode = new Map(priceBook.map((row) => [row.code, row]));
    return PHASE1_QUICK_PICK_CODES.map((code) => byCode.get(code)).filter(Boolean);
  }, [priceBook]);

  const updateServicePlanField = (planKey, field, value) => {
    setServicePlanConfig((prev) => ({
      ...prev,
      [planKey]: {
        ...prev[planKey],
        [field]: value,
      },
    }));
  };

  const resolvePriceBookItem = ({ codes = [], nameMatchers = [] }) => {
    for (const code of codes) {
      const hitByCode = priceBook.find((row) => String(row.code || '').toUpperCase() === String(code).toUpperCase());
      if (hitByCode) return hitByCode;
    }

    for (const matcher of nameMatchers) {
      const hitByName = priceBook.find((row) =>
        matcher.test(`${row?.name || ''} ${row?.description || ''}`)
      );
      if (hitByName) return hitByName;
    }

    return null;
  };

  const asLineItem = (row, quantity = 1) => {
    const qty = Math.max(1, Number(quantity) || 1);
    const price = Number(row?.base_price) || 0;
    return {
      description: row?.name || 'Service Item',
      quantity: qty,
      unit_price: price,
      total_price: qty * price,
      price_book_code: row?.code || null,
    };
  };

  const appendServicePlanItems = () => {
    const config = servicePlanConfig[selectedServicePlan];
    const plannedItems = [];
    const missingItems = [];

    const tryAdd = (label, resolver, quantity = 1) => {
      const resolved = resolver();
      if (!resolved) {
        missingItems.push(label);
        return;
      }
      plannedItems.push(asLineItem(resolved, quantity));
    };

    if (selectedServicePlan === 'dryer_vent') {
      tryAdd(
        'Dryer Vent base clean',
        () =>
          resolvePriceBookItem({
            codes: ['DV-STD'],
            nameMatchers: [/dryer vent.*(clean|safety)/i],
          }),
        1
      );

      if (config.secondDryer) {
        tryAdd(
          'Second dryer vent',
          () =>
            resolvePriceBookItem({
              codes: ['DV-2ND'],
              nameMatchers: [/second dryer vent/i],
            }),
          1
        );
      }
      if (config.roofAccess) {
        tryAdd(
          'Roof access modifier',
          () =>
            resolvePriceBookItem({
              codes: ['ACC-ROOF'],
              nameMatchers: [/roof access/i],
            }),
          1
        );
      }
      if (config.transitionUpgrade) {
        tryAdd(
          'Transition upgrade',
          () =>
            resolvePriceBookItem({
              codes: ['ACC-TRANSITION'],
              nameMatchers: [/transition upgrade/i],
            }),
          1
        );
      }
      if (config.birdGuard) {
        tryAdd(
          'Bird guard / vent hood replacement',
          () =>
            resolvePriceBookItem({
              codes: ['BIRD-GUARD'],
              nameMatchers: [/bird guard/i, /vent hood replacement/i],
            }),
          1
        );
      }
    }

    if (selectedServicePlan === 'air_duct') {
      const systemCount = Math.max(1, Number(config.systemCount) || 1);
      const baseSystem = resolvePriceBookItem({
        codes: ['DUCT-SYS1'],
        nameMatchers: [/duct cleaning.*system 1/i, /whole home.*duct/i],
      });

      if (!baseSystem) {
        missingItems.push('Air duct base system');
      } else if (systemCount === 1) {
        plannedItems.push(asLineItem(baseSystem, 1));
      } else {
        plannedItems.push(asLineItem(baseSystem, 1));
        const additionalSystem = resolvePriceBookItem({
          codes: ['DUCT-SYS-ADD'],
          nameMatchers: [/additional hvac system/i, /additional system/i],
        });
        if (additionalSystem) {
          plannedItems.push(asLineItem(additionalSystem, systemCount - 1));
        } else {
          // Fallback: use base system as quantity when add-system SKU is unavailable.
          plannedItems[0] = asLineItem(baseSystem, systemCount);
          missingItems.push('Additional system SKU (using base system fallback)');
        }
      }

      if (config.includeCoilCleaning) {
        tryAdd(
          'Coil cleaning',
          () =>
            resolvePriceBookItem({
              codes: ['COIL-CLEAN'],
              nameMatchers: [/coil cleaning/i, /evaporator coil/i],
            }),
          1
        );
      }
      if (config.includeBlowerCleaning) {
        tryAdd(
          'Blower cleaning',
          () =>
            resolvePriceBookItem({
              codes: ['BLOWER-CLEAN'],
              nameMatchers: [/blower.*clean/i],
            }),
          1
        );
      }
      if (config.includeAhuHousingCleaning) {
        tryAdd(
          'AHU housing cleaning',
          () =>
            resolvePriceBookItem({
              codes: ['AHU-HOUSING-CLEAN'],
              nameMatchers: [/ahu housing/i, /air handling unit housing/i],
            }),
          1
        );
      }
    }

    if (selectedServicePlan === 'uv_pco') {
      const packageRow =
        config.packageType === 'pco'
          ? resolvePriceBookItem({
              codes: ['PCO-WHOLEHOME', 'PCO-SYS'],
              nameMatchers: [/whole[- ]home pco system/i, /pco system/i],
            })
          : resolvePriceBookItem({
              codes: ['UV-C-INSTALLED', 'UV-C'],
              nameMatchers: [/uv[- ]c light system/i],
            });

      if (!packageRow) {
        missingItems.push(config.packageType === 'pco' ? 'PCO package' : 'UV-C package');
      } else {
        plannedItems.push(asLineItem(packageRow, 1));
      }

      if (config.includeCoilCleaning) {
        tryAdd(
          'Coil cleaning',
          () =>
            resolvePriceBookItem({
              codes: ['COIL-CLEAN'],
              nameMatchers: [/coil cleaning/i, /evaporator coil/i],
            }),
          1
        );
      }
      if (config.includeBlowerCleaning) {
        tryAdd(
          'Blower cleaning',
          () =>
            resolvePriceBookItem({
              codes: ['BLOWER-CLEAN'],
              nameMatchers: [/blower.*clean/i],
            }),
          1
        );
      }
    }

    if (!plannedItems.length) {
      toast({
        variant: 'destructive',
        title: 'Plan unavailable',
        description: 'No matching price book items were found for this service plan.',
      });
      return;
    }

    setProposal((prev) => ({
      ...prev,
      items: [...prev.items, ...plannedItems],
    }));

    if (missingItems.length) {
      toast({
        title: 'Plan added with gaps',
        description: `Added ${plannedItems.length} item(s). Missing: ${missingItems.slice(0, 2).join(', ')}${missingItems.length > 2 ? '...' : ''}.`,
      });
    } else {
      toast({
        title: 'Service plan added',
        description: `Added ${plannedItems.length} line item(s) from ${SERVICE_PLAN_LIBRARY.find((entry) => entry.key === selectedServicePlan)?.label || 'plan'}.`,
      });
    }

    setServicePlanDialogOpen(false);
  };

  const handleCreateCustomer = async () => {
      if (!newCustomer.firstName || !newCustomer.phone) {
          toast({ variant: 'destructive', title: 'Required Fields', description: 'Name and Phone are required.' });
          return;
      }
      
      setCreateLoading(true);
      try {
          const { data, error } = await insertLeadWithSchemaFallback({
              first_name: newCustomer.firstName,
              last_name: newCustomer.lastName,
              email: newCustomer.email,
              phone: formatPhoneNumber(newCustomer.phone),
              service: newCustomer.service,
              status: 'new',
              stage: 'new',
              pipeline_stage: 'new',
              source: 'proposal_builder',
              notes: `Lead Temperature: ${newCustomer.temperature}`,
              tenant_id: activeTenantId // Ensuring insert has tenant_id
          });

          if (error) throw error;

          setLeads((prev) => [data, ...prev.filter((lead) => lead.id !== data.id)]);
          setProposal(prev => ({ ...prev, lead_id: data.id, service_address: '' }));
          setIsCustomerModalOpen(false);
          setCustomerView('search');
          toast({ title: "Success", description: "Customer created and selected." });
      } catch (err) {
          const isRlsError =
            err?.code === '42501' ||
            /row-level security/i.test(String(err?.message || ''));
          const description = isRlsError
            ? 'Permission denied creating customer. Leads INSERT policy is missing for your tenant.'
            : (err?.message || 'Failed to create customer.');
          toast({ variant: "destructive", title: "Error", description });
      } finally {
          setCreateLoading(false);
      }
  };

  const addItem = () => {
    setProposal(prev => ({
        ...prev,
        items: [...prev.items, { description: '', quantity: 1, unit_price: 0, total_price: 0, price_book_code: null }]
    }));
  };

  const updateItem = (index, field, value) => {
    const newItems = [...proposal.items];
    newItems[index][field] = value;
    if (field === 'quantity' || field === 'unit_price') {
        const q = field === 'quantity' ? value : newItems[index].quantity;
        const p = field === 'unit_price' ? value : newItems[index].unit_price;
        newItems[index].total_price = Number(q) * Number(p);
    }
    setProposal(prev => ({ ...prev, items: newItems }));
  };

  const removeItem = (index) => {
    const newItems = proposal.items.filter((_, i) => i !== index);
    setProposal(prev => ({ ...prev, items: newItems }));
  };

  const handlePriceBookSelect = (index, code) => {
      const item = priceBook.find(p => p.code === code);
      if (item) {
          const newItems = [...proposal.items];
          newItems[index] = {
              ...newItems[index],
              description: item.name,
              unit_price: item.base_price,
              price_book_code: item.code,
              total_price: Number(newItems[index].quantity) * Number(item.base_price)
          };
          setProposal(prev => ({ ...prev, items: newItems }));
      }
  };

  const appendPriceBookItem = (item) => {
    if (!item) return;
    setProposal((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          description: item.name,
          quantity: 1,
          unit_price: Number(item.base_price) || 0,
          total_price: Number(item.base_price) || 0,
          price_book_code: item.code,
        },
      ],
    }));
  };

  const applyTemplate = () => {
    const template = PHASE1_TEMPLATE_LIBRARY.find((entry) => entry.key === selectedTemplate);
    if (!template) {
      toast({
        variant: 'destructive',
        title: 'Template not selected',
        description: 'Choose a template before applying.',
      });
      return;
    }

    const byCode = new Map(priceBook.map((row) => [row.code, row]));
    const resolvedItems = template.codes
      .map((code) => byCode.get(code))
      .filter(Boolean)
      .map((item) => ({
        description: item.name,
        quantity: 1,
        unit_price: Number(item.base_price) || 0,
        total_price: Number(item.base_price) || 0,
        price_book_code: item.code,
      }));

    if (!resolvedItems.length) {
      toast({
        variant: 'destructive',
        title: 'Template unavailable',
        description: 'Template items were not found in your current price book.',
      });
      return;
    }

    setProposal((prev) => ({ ...prev, items: resolvedItems }));
    toast({
      title: 'Template applied',
      description: `${template.label} loaded with ${resolvedItems.length} line item(s).`,
    });
  };

  const calculateTotals = () => {
    const subtotal = proposal.items.reduce((sum, item) => sum + (Number(item.total_price) || 0), 0);
    const taxRate = DEFAULT_QUOTE_TAX_RATE;
    const taxAmount = subtotal * taxRate;
    const total = subtotal + taxAmount;
    return { subtotal, taxAmount, total };
  };

  const invokeSendEstimate = async (payload) => {
    const { data, error } = await supabase.functions.invoke('send-estimate', {
      body: payload,
    });

    if (error) {
      throw new Error(error?.message || 'send-estimate invocation failed.');
    }

    if (data?.error) {
      throw new Error(data.error);
    }

    return data || {};
  };

  const handleOverrideSend = async () => {
    if (!pendingOverridePayload) return;
    if (!overrideAcknowledged) {
      toast({
        variant: 'destructive',
        title: 'Acknowledgement Required',
        description: 'Please acknowledge the missing cost snapshot warning before sending.'
      });
      return;
    }
    if (overrideReason.trim().length <= 5) {
      toast({
        variant: 'destructive',
        title: 'Reason Required',
        description: 'Please provide a short reason (minimum 6 characters).'
      });
      return;
    }

    setLoading(true);
    try {
      const data = await invokeSendEstimate({
        ...pendingOverridePayload,
        override_acknowledged: true,
        override_reason: overrideReason.trim(),
      });

      if (data?.error) {
        throw new Error(data.error);
      }
      const deliveryChannel = data?.delivery_channel || sendChannel;
      const requestedChannel = data?.requested_delivery_channel || sendChannel;
      const usedFallback = requestedChannel !== deliveryChannel;
      if (deliveryChannel === 'sms') {
        if (!data?.success && !data?.skipped) {
          throw new Error(data?.error || 'SMS delivery failed.');
        }
      } else if (!data?.id) {
        throw new Error('Email provider did not return a message id.');
      }

      await supabase
        .from('leads')
        .update({
          last_contact_at: new Date().toISOString(),
          status: 'Estimate Sent'
        })
        .eq('id', pendingOverridePayload.lead_id);

      setProposal(prev => ({ ...prev, status: resolvePostSendQuoteStatus(prev?.status) }));
      setOverrideDialogOpen(false);
      setOverrideReason('');
      setOverrideAcknowledged(false);
      setPendingOverridePayload(null);
      clearBuilderDraft(PROPOSAL_BUILDER_DRAFT_KEY, activeTenantId, id || 'new');

      toast({
        title: 'Sent',
        description:
          (deliveryChannel === 'sms'
            ? (usedFallback
              ? 'Email was unavailable, so the quote was texted to the client with admin override.'
              : 'Quote texted to client with admin override.')
            : (usedFallback
              ? 'SMS was unavailable, so the quote was emailed to the client with PDF attached.'
              : 'Quote emailed to client with PDF attached.')),
      });
    } catch (err) {
      const errMsg = err?.message || JSON.stringify(err);
      toast({
        variant: 'destructive',
        title: 'Email Failed',
        description: `Override send failed: ${errMsg}`
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (newStatus = null) => {
    if (!proposal.lead_id) {
        toast({ variant: 'destructive', title: 'Missing Customer', description: 'Please select a customer.' });
        return;
    }

    const normalizedServiceAddress = normalizeAddress(proposal.service_address);
    if (!normalizedServiceAddress) {
      toast({
        variant: 'destructive',
        title: 'Missing Service Address',
        description: 'Service address is required on the quote before saving or sending.',
      });
      return;
    }

    const selectedLead = leads.find(l => l.id === proposal.lead_id);
    const recipientLead = selectedLead
      ? {
          ...selectedLead,
          company: proposal.customer_name || selectedLead.company,
          email: proposal.customer_email || selectedLead.email,
          phone: proposal.customer_phone || selectedLead.phone,
        }
      : null;
    
    if (newStatus === 'sent') {
      const deliveryPlan = resolveLeadDelivery({ lead: recipientLead, requestedChannel: sendChannel });
      if (!recipientLead || !deliveryPlan.channel) {
        toast({
          variant: 'destructive',
          title: 'Cannot Send',
          description: 'This customer needs either a valid email address or a textable phone number before you can send documents.',
        });
        return;
      }
    }

    setLoading(true);
    const { subtotal, taxAmount, total } = calculateTotals();
    const isSendAttempt = newStatus === 'sent';
    const normalizedCurrentStatus = String(proposal.status || 'draft').trim().toLowerCase() || 'draft';
    const normalizedStatusToSave = String(newStatus || proposal.status || 'draft').trim().toLowerCase() || 'draft';
    const isReleasedEdit = Boolean(id) && isReleasedQuoteStatus(normalizedCurrentStatus);
    const statusToPersist = isSendAttempt ? 'draft' : (isReleasedEdit ? 'draft' : normalizedStatusToSave);
    
    // 3. Use activeTenantId from context
    console.log(`Saving proposal with activeTenantId=${activeTenantId}`);

    const quoteNumber = isReleasedEdit ? generateQuoteNumber() : (proposal.quote_number || generateQuoteNumber());
    const baseQuoteData = {
        lead_id: proposal.lead_id,
        user_id: user?.id,
        status: statusToPersist,
        valid_until: proposal.valid_until,
        service_address: normalizedServiceAddress,
        header_text: proposal.header_text,
        footer_text: proposal.footer_text,
        customer_name: proposal.customer_name || null,
        customer_email: proposal.customer_email || null,
        customer_phone: proposal.customer_phone || null,
        subtotal,
        tax_rate: DEFAULT_QUOTE_TAX_RATE,
        tax_amount: taxAmount,
        total_amount: total,
        quote_number: quoteNumber,
    };

    // 4. Include tenant_id: activeTenantId in payload
    const quoteDataWithTenant = { ...baseQuoteData, tenant_id: activeTenantId };

    try {
        let quoteId = id;
        const editableQuoteStatuses = new Set(['draft', 'pending_review']);

        const updateQuoteStatus = async (quoteIdToUpdate, nextStatus, useTenantScope = true) => {
            let statusQuery = supabase
              .from('quotes')
              .update({ status: nextStatus, updated_at: new Date().toISOString() })
              .eq('id', quoteIdToUpdate);

            if (useTenantScope && activeTenantId) {
              statusQuery = statusQuery.eq('tenant_id', activeTenantId);
            }

            const result = await statusQuery;
            if (!result.error) return result;

            if (
              result.error.message?.includes('column') ||
              result.error.message?.includes('does not exist') ||
              result.error.code === '42703' ||
              result.error.code === 'PGRST204'
            ) {
              return await supabase
                .from('quotes')
                .update({ status: nextStatus, updated_at: new Date().toISOString() })
                .eq('id', quoteIdToUpdate);
            }

            return result;
        };

        const reuseExistingEditableQuote = async (useTenantPayload = true) => {
            const quotesQuery = supabase
              .from('quotes')
              .select('id,status,updated_at,tenant_id,quote_number')
              .eq('lead_id', proposal.lead_id)
              .order('updated_at', { ascending: false });

            if (activeTenantId) quotesQuery.eq('tenant_id', activeTenantId);

            const { data: candidateQuotes, error: findError } = await quotesQuery;
            if (findError) throw findError;

            const existingActive = (candidateQuotes || []).find((q) =>
              editableQuoteStatuses.has(String(q?.status || 'draft').toLowerCase())
            );
            if (!existingActive) return null;

            const payload = {
              ...(useTenantPayload ? quoteDataWithTenant : baseQuoteData),
              quote_number: existingActive.quote_number || quoteNumber,
            };
            let updateQuery = supabase
              .from('quotes')
              .update(payload)
              .eq('id', existingActive.id);

            if (useTenantPayload && activeTenantId) {
              updateQuery = updateQuery.eq('tenant_id', activeTenantId);
            }

            const { error: updateError } = await updateQuery;
            if (updateError) throw updateError;

            return { id: existingActive.id, reusedExistingQuote: true, quote_number: payload.quote_number };
        };

        const retireReleasedQuote = async (quoteIdToRetire, currentStatus, useTenantScope = true) => {
            if (!requiresSupersedeBeforeRevision(currentStatus)) {
              return false;
            }

            const { error: retireError } = await updateQuoteStatus(quoteIdToRetire, 'superseded', useTenantScope);
            if (retireError) throw retireError;
            return true;
        };

        const retireExistingReleasedQuoteForLead = async (useTenantScope = true) => {
            const quotesQuery = supabase
              .from('quotes')
              .select('id,status,updated_at,tenant_id')
              .eq('lead_id', proposal.lead_id)
              .order('updated_at', { ascending: false });

            if (activeTenantId) quotesQuery.eq('tenant_id', activeTenantId);

            const { data: candidateQuotes, error: findError } = await quotesQuery;
            if (findError) throw findError;

            const existingReleased = (candidateQuotes || []).find((q) =>
              requiresSupersedeBeforeRevision(String(q?.status || 'draft').toLowerCase())
            );

            if (!existingReleased?.id) return null;

            await retireReleasedQuote(existingReleased.id, existingReleased.status, useTenantScope);
            return existingReleased.id;
        };
        
        // Helper to execute DB operation with fallback for tenant_id column missing
        const executeDbOp = async () => {
            if (id && !isReleasedEdit) {
                // UPDATE OPERATION
                try {
                    const { error } = await supabase
                        .from('quotes')
                        .update(quoteDataWithTenant)
                        .eq('id', id)
                        .eq('tenant_id', activeTenantId); // Added safety filter
                    if (error) throw error;
                    return { id };
                } catch (err) {
                    // Check for column missing error
                    if (err.message?.includes('column') || err.message?.includes('does not exist') || err.code === '42703' || err.code === 'PGRST204') {
                         console.warn("quotes table missing tenant_id; skipping tenant_id in payload");
                         const { error: retryError } = await supabase
                            .from('quotes')
                            .update(baseQuoteData)
                            .eq('id', id);
                         if (retryError) throw retryError;
                         return { id };
                    }
                    throw err;
                }
            } else {
                // INSERT OPERATION
                try {
                     const { data, error } = await supabase
                        .from('quotes')
                        .insert([quoteDataWithTenant])
                        .select()
                        .single();
                     if (error) throw error;
                     return data;
                } catch (err) {
                     if (
                       String(err?.message || '').includes('quotes_tenant_lead_active_unique') ||
                       String(err?.details || '').includes('quotes_tenant_lead_active_unique')
                     ) {
                         const reused = await reuseExistingEditableQuote(true);
                         if (reused) return reused;
                         const retired = await retireExistingReleasedQuoteForLead(true);
                         if (retired) {
                           const { data: retryData, error: retryError } = await supabase
                             .from('quotes')
                             .insert([quoteDataWithTenant])
                             .select()
                             .single();
                           if (retryError) throw retryError;
                           return { ...retryData, createdRevision: true, retiredQuoteId: retired };
                         }
                     }

                     if (err.message?.includes('column') || err.message?.includes('does not exist') || err.code === '42703' || err.code === 'PGRST204') {
                         console.warn("quotes table missing tenant_id; skipping tenant_id in payload");
                         try {
                            const { data: retryData, error: retryError } = await supabase
                               .from('quotes')
                               .insert([baseQuoteData])
                               .select()
                               .single();
                            if (retryError) throw retryError;
                            return retryData;
                         } catch (retryErr) {
                            if (
                              String(retryErr?.message || '').includes('quotes_tenant_lead_active_unique') ||
                              String(retryErr?.details || '').includes('quotes_tenant_lead_active_unique')
                            ) {
                                const reused = await reuseExistingEditableQuote(false);
                                if (reused) return reused;
                                const retired = await retireExistingReleasedQuoteForLead(false);
                                if (retired) {
                                  const { data: insertAfterRetire, error: insertAfterRetireError } = await supabase
                                    .from('quotes')
                                    .insert([baseQuoteData])
                                    .select()
                                    .single();
                                  if (insertAfterRetireError) throw insertAfterRetireError;
                                  return { ...insertAfterRetire, createdRevision: true, retiredQuoteId: retired };
                                }
                            }
                            throw retryErr;
                         }
                     }
                     throw err;
                }
            }
        };

        if (isReleasedEdit) {
            await retireReleasedQuote(id, normalizedCurrentStatus, true);
            quoteId = null;
        }

        const result = await executeDbOp();
        quoteId = result.id;
        const persistedQuoteNumber = result?.quote_number || quoteNumber;
        const shouldReplaceItems = Boolean(id) && !isReleasedEdit || Boolean(result?.reusedExistingQuote);

        // Replace Items
        if (shouldReplaceItems) {
            console.log(`Fetching quote_items for activeTenantId=${activeTenantId}`);
            // Note: quote_items does not have a tenant_id directly. RLS on quote_items ensures proper access.
            // Filtering by quote_id is sufficient here, as quote_id itself is tenant-isolated by the quotes table.
            const { error: deleteItemsError } = await supabase
              .from('quote_items')
              .delete()
              .eq('quote_id', quoteId);
            if (deleteItemsError) throw deleteItemsError;
        }
        
        console.log(`Fetching quote_items for activeTenantId=${activeTenantId}`);
        const itemsToInsert = proposal.items.map(item => ({
            quote_id: quoteId,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_price: item.total_price,
            price_book_code: item.price_book_code
        }));
        
        if (itemsToInsert.length > 0) {
            // Note: quote_items does not have a tenant_id directly. RLS on quote_items ensures proper access.
            const { error: insertItemsError } = await insertQuoteItemsWithSchemaFallback(itemsToInsert);
            if (insertItemsError) throw insertItemsError;
        }

        if (!id && result?.reusedExistingQuote) {
            toast({
              title: 'Updated existing draft quote',
              description: 'This lead already had an editable draft, so it was updated instead of creating a duplicate.'
            });
        }

        if (isReleasedEdit || result?.createdRevision) {
            toast({
              title: 'Revision draft created',
              description: requiresSupersedeBeforeRevision(normalizedCurrentStatus)
                ? 'The prior customer-facing quote was retired and a new revision draft was created.'
                : 'A new draft revision was created so the released quote stays immutable.',
            });
        }

        let finalStatus = statusToPersist;

        if (isSendAttempt) {
             try {
                 const edgeFunctionPayload = {
                    quote_id: quoteId,
                    email: recipientLead?.email || null,
                    to_phone: recipientLead?.phone || null,
                    delivery_channel: sendChannel,
                    lead_id: selectedLead?.id,
                    tenant_id: activeTenantId
                 };

                 const data = await invokeSendEstimate(edgeFunctionPayload);

                 if (data?.requires_override) {
                     if (!isAdmin) {
                         throw new Error(data.error || 'Missing cost snapshot requires admin override.');
                     }
                     setPendingOverridePayload(edgeFunctionPayload);
                     setOverrideAcknowledged(false);
                     setOverrideReason('');
                     setOverrideDialogOpen(true);
                     toast({
                       variant: 'destructive',
                       title: 'Guardrail Override Required',
                       description: data.error || 'Cost snapshot missing. Admin acknowledgement and reason are required.'
                     });
                     if (!id) {
                       navigate(tenantPath(`/crm/estimates/${quoteId}`, resolvedTenantId));
                     }
                     return;
                 }

                 if (data && data.error) throw new Error(data.error);
                 const deliveryChannel = data?.delivery_channel || sendChannel;
                 const requestedChannel = data?.requested_delivery_channel || sendChannel;
                 const usedFallback = requestedChannel !== deliveryChannel;
                 if (deliveryChannel === 'sms') {
                   if (!data?.success && !data?.skipped) {
                     throw new Error(data?.error || 'SMS delivery failed.');
                   }
                 } else if (!data?.id) {
                   throw new Error('Email provider did not return a message id.');
                 }

                 finalStatus = resolvePostSendQuoteStatus(proposal.status || statusToPersist);

                 toast({
                   title: 'Sent',
                   description:
                      deliveryChannel === 'sms'
                        ? (data?.skipped
                           ? 'SMS already sent recently.'
                           : usedFallback
                            ? 'Email was unavailable, so the quote was texted to the client.'
                            : 'Quote texted to client successfully.')
                        : (usedFallback
                           ? 'SMS was unavailable, so the quote was emailed to the client with PDF attached.'
                           : 'Quote emailed to client with PDF attached.'),
                  });
                 
                 // Update lead status
                 await supabase.from('leads').update({
                     last_contact_at: new Date().toISOString(),
                     status: 'Estimate Sent'
                 }).eq('id', proposal.lead_id);
                 
             } catch (err) {
                 console.error("Email Sending Failed:", err);
                 // Extract clean error message
                 const errMsg = err.message || JSON.stringify(err);
                 toast({ 
                     variant: 'destructive', 
                     title: 'Email Failed', 
                     description: `Quote saved as ${statusToPersist}, but delivery failed: ${errMsg}` 
                 });
             }
        } else {
             toast({ title: 'Success', description: 'Quote saved successfully.' });
        }

        clearBuilderDraft(PROPOSAL_BUILDER_DRAFT_KEY, activeTenantId, id || 'new');

        if (!id || isReleasedEdit || quoteId !== id) {
          navigate(tenantPath(`/crm/estimates/${quoteId}`, resolvedTenantId));
        } else {
          setProposal(prev => ({ ...prev, status: finalStatus, quote_number: persistedQuoteNumber }));
        }
        setPricesUpdated(false);

    } catch (error) {
        console.error('Save error:', error);
        toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
        setLoading(false);
    }
  };
  
  const handleConvertToInvoice = async () => {
      if (!id) return;

      try {
        const { data: linkedJob, error } = await supabase
          .from('jobs')
          .select('id, status, work_order_number')
          .eq('tenant_id', tenantId)
          .eq('quote_id', id)
          .neq('status', 'cancelled')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) throw error;

        if (!linkedJob?.id) {
          toast({
            variant: 'destructive',
            title: 'Work order required',
            description: 'Accept the quote to generate a work order before creating an invoice.',
          });
          return;
        }

        navigate(`/${tenantId}/crm/invoices/new?job_id=${linkedJob.id}`);
      } catch (error) {
        toast({
          variant: 'destructive',
          title: 'Could not open invoice flow',
          description: error.message || 'Work order lookup failed.',
        });
      }
  };

  const handlePreviewEstimate = async ({ print = false } = {}) => {
    if (!id) return;

    try {
      if (print) {
        await openQuotePrintView({ quoteId: id, tenantId: resolvedTenantId });
      } else {
        await openQuotePreview({ quoteId: id, tenantId: resolvedTenantId });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: print ? 'Print unavailable' : 'Preview unavailable',
        description: error?.message || 'Could not open the public quote view.',
      });
    }
  };

  const { subtotal, taxAmount, total } = calculateTotals();
  const selectedLead = leads.find(l => l.id === proposal.lead_id);
  const effectiveRecipient = selectedLead
    ? {
        ...selectedLead,
        company: proposal.customer_name || selectedLead.company,
        email: proposal.customer_email || selectedLead.email,
        phone: proposal.customer_phone || selectedLead.phone,
      }
    : null;
  const deliveryPlan = resolveLeadDelivery({ lead: effectiveRecipient, requestedChannel: sendChannel });
  const canSendEmail = deliveryPlan.canEmail;
  const canSendSms = deliveryPlan.canSms;
  const deliveryPreferenceLabel = getDeliveryPreferenceLabel(selectedLead);
  const canResendEstimate = Boolean(id) && ['sent', 'viewed', 'accepted', 'approved'].includes(String(proposal.status || '').toLowerCase());
  const quoteRevisionMode = id ? getQuoteRevisionMode(proposal.status) : 'edit_in_place';
  const quoteRevisionNotice = id ? getQuoteRevisionNotice(proposal.status) : '';

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-24 lg:pb-20">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
         <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
            <Button variant="ghost" className="self-start" onClick={() => navigate(tenantPath('/crm/estimates', resolvedTenantId))}><ArrowLeft className="w-5 h-5" /></Button>
            <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                   <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">{id ? `Edit Quote #${proposal.quote_number}` : 'New Quote'}</h1>
                   <Badge variant={proposal.status === 'sent' ? 'default' : 'secondary'}>{proposal.status}</Badge>
                   {pricesUpdated && <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50">Prices Synced</Badge>}
                </div>
            </div>
         </div>
         <div className="flex w-full flex-col gap-3 lg:w-auto lg:min-w-[24rem]">
            {id && (proposal.status === 'sent' || proposal.status === 'accepted') && (
                <Button variant="outline" className="w-full border-green-600 text-green-700 hover:bg-green-50 lg:w-auto" onClick={handleConvertToInvoice}>
                    <FileText className="w-4 h-4 mr-2" /> Create Invoice from Work Order
                </Button>
            )}
            <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Label className="text-xs text-slate-500">Send via</Label>
                <Select value={sendChannel} onValueChange={setSendChannel}>
                  <SelectTrigger className="h-9 w-full sm:w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email" disabled={!canSendEmail}>Email</SelectItem>
                    <SelectItem value="sms" disabled={!canSendSms}>SMS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="mt-2 text-[11px] text-slate-500">
                {selectedLead
                  ? `${deliveryPreferenceLabel}. ${deliveryPlan.channel === 'sms' && sendChannel === 'email'
                    ? 'Email is unavailable, so this will fall back to SMS.'
                    : deliveryPlan.channel === 'email' && sendChannel === 'sms'
                      ? 'SMS is unavailable, so this will fall back to email.'
                      : 'Saved preference is used when available.'}`
                  : 'Select a customer to enable document delivery.'}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => handlePreviewEstimate()}
                disabled={!id || loading}
              >
                <ExternalLink className="w-4 h-4 mr-2" /> Preview
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => handlePreviewEstimate({ print: true })}
                disabled={!id || loading}
              >
                <Printer className="w-4 h-4 mr-2" /> Print / Save PDF
              </Button>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="outline" className="w-full sm:flex-1" onClick={() => handleSave(proposal.status)} disabled={loading}>
                  <Save className="w-4 h-4 mr-2" /> Save
              </Button>
              <Button className="w-full bg-blue-600 sm:flex-1" onClick={() => handleSave('sent')} disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                  {canResendEstimate ? 'Save & Resend' : 'Save & Send'}
              </Button>
            </div>
         </div>
      </div>

      {quoteRevisionMode === 'create_revision' ? (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-4 w-4 text-amber-700" />
              <div className="text-sm text-amber-900">
                <p className="font-medium">Released quote protection is active.</p>
                <p className="mt-1 text-amber-800">{quoteRevisionNotice}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8">
        <div className="lg:col-span-2 space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <span>Customer Information</span>
                        <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => setIsCustomerModalOpen(true)}>
                            {proposal.lead_id ? 'Change Customer' : 'Select Customer'}
                        </Button>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {!selectedLead ? (
                        <div className="text-center py-8 bg-slate-50 border-2 border-dashed border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => setIsCustomerModalOpen(true)}>
                            <UserPlus className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                            <p className="text-slate-500 font-medium">No Customer Selected</p>
                            <p className="text-xs text-slate-400">Click to select or create a new customer</p>
                        </div>
                    ) : (
                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <h3 className="font-bold text-lg text-slate-900">{selectedLead.first_name} {selectedLead.last_name}</h3>
                                {selectedLead.company && <p className="text-sm text-slate-600 font-medium">{selectedLead.company}</p>}
                                <div className="mt-2 flex flex-wrap gap-2">
                                  <Badge variant="outline">{deliveryPreferenceLabel}</Badge>
                                  {selectedLead.sms_opt_out && <Badge variant="destructive">SMS opted out</Badge>}
                                </div>
                                <div className="mt-3 space-y-1">
                                    <div className="flex items-center gap-2 text-sm text-slate-600">
                                        <Mail className="w-3.5 h-3.5" /> {selectedLead.email || 'No email'}
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-slate-600">
                                        <Phone className="w-3.5 h-3.5" /> {selectedLead.phone ? formatPhoneNumber(selectedLead.phone) : 'No phone'}
                                    </div>
                                    <div className="flex items-start gap-2 text-sm text-slate-600">
                                        <MapPin className="w-3.5 h-3.5 mt-0.5" />
                                        <span>{proposal.service_address || 'No service address set'}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="sm:border-l sm:pl-4 space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-slate-500">Service:</span>
                                    <Badge variant="outline" className="bg-white">{selectedLead.service || 'N/A'}</Badge>
                                </div>
                                <div className="flex items-center justify-between text-sm pt-2">
                                     <span className="text-slate-500">Quote Date:</span>
                                     <span className="font-medium">{format(new Date(), 'MMM d, yyyy')}</span>
                                </div>
                            </div>
                        </div>
                    )}
                    
                     <div className="mt-4">
                         <Label className="text-xs uppercase text-slate-400 font-bold tracking-wider mb-1.5 block">Quote Valid Until</Label>
                         <Input type="date" value={proposal.valid_until} onChange={e => setProposal({...proposal, valid_until: e.target.value})} className="max-w-[200px]" />
                     </div>
                     <div className="mt-4 space-y-2">
                         <Label className="text-xs uppercase text-slate-400 font-bold tracking-wider">Service Address (Required)</Label>
                         <AddressAutocomplete
                           name="service_address"
                           value={proposal.service_address || ''}
                           onChange={(e) => setProposal((prev) => ({ ...prev, service_address: e.target.value }))}
                           onAddressSelect={handleServiceAddressSelect}
                           placeholder="Street, City, State ZIP"
                         />
                     </div>
                     <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-4">
                         <div>
                           <Label className="text-sm font-semibold text-slate-900">Responsible Party / Bill To</Label>
                           <p className="mt-1 text-xs text-slate-500">
                             Use this when the scheduling contact is different from the homeowner or the person responsible for payment.
                           </p>
                         </div>
                         <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                           <div className="space-y-2">
                             <Label>Name</Label>
                             <Input
                               value={proposal.customer_name || ''}
                               onChange={(e) => setProposal((prev) => ({ ...prev, customer_name: e.target.value }))}
                               placeholder="Homeowner or responsible party"
                             />
                           </div>
                           <div className="space-y-2">
                             <Label>Email</Label>
                             <Input
                               value={proposal.customer_email || ''}
                               onChange={(e) => setProposal((prev) => ({ ...prev, customer_email: e.target.value }))}
                               placeholder="billing@example.com"
                             />
                           </div>
                         </div>
                         <div className="space-y-2">
                           <Label>Phone</Label>
                           <Input
                             value={proposal.customer_phone || ''}
                             onChange={(e) => setProposal((prev) => ({ ...prev, customer_phone: e.target.value }))}
                             placeholder="(321) 555-1234"
                           />
                         </div>
                     </div>
                </CardContent>
            </Card>

            {!id && existingActiveQuote && (
              <Card className="border-amber-200 bg-amber-50">
                <CardContent className="pt-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-4 h-4 mt-0.5 text-amber-700" />
                    <div className="text-sm text-amber-900">
                      <p className="font-medium">
                        {isEditableQuoteStatus(existingActiveQuote.status)
                          ? 'Active quote draft already exists for this lead'
                          : 'Released quote already exists for this lead'}
                        {existingActiveQuote.quote_number ? ` (#${existingActiveQuote.quote_number})` : ''}.
                      </p>
                      <p className="mt-1 text-amber-800">
                        {isEditableQuoteStatus(existingActiveQuote.status)
                          ? 'Saving will update that active draft instead of creating a duplicate.'
                          : 'Saving will create a revised draft and retire the current public approval link.'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
                <CardHeader className="space-y-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <CardTitle>Line Items</CardTitle>
                        <div className="flex flex-wrap items-center gap-2">
                            <Button size="sm" className="w-full sm:w-auto" onClick={() => setServicePlanDialogOpen(true)}>
                                <Sparkles className="w-4 h-4 mr-2" /> Add Service Plan
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full sm:w-auto"
                              onClick={() => setShowAdvancedCatalog((prev) => !prev)}
                            >
                              {showAdvancedCatalog ? (
                                <ChevronDown className="w-4 h-4 mr-2" />
                              ) : (
                                <ChevronRight className="w-4 h-4 mr-2" />
                              )}
                              Advanced Catalog
                            </Button>
                            <Button size="sm" variant="outline" className="w-full sm:w-auto" onClick={addItem}>
                              <Plus className="w-4 h-4 mr-2" /> Add Item
                            </Button>
                        </div>
                    </div>

                    {!showAdvancedCatalog && (
                      <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                        Guided mode is active. Start with <span className="font-semibold">Add Service Plan</span> for Dryer Vent, Air Duct, or UV/PCO. Open Advanced Catalog only when you need manual browsing.
                      </div>
                    )}

                    {showAdvancedCatalog && (
                    <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                            {availableCategories.map((category) => (
                                <Button
                                    key={category.value}
                                    variant={catalogCategory === category.value ? 'default' : 'outline'}
                                    onClick={() => setCatalogCategory(category.value)}
                                    className="h-auto justify-start gap-2 px-3 py-2 text-left"
                                >
                                    {React.createElement(
                                      PHASE1_CATEGORY_META[category.value]?.icon || Layers3,
                                      { className: 'h-4 w-4 shrink-0' }
                                    )}
                                    <span className="min-w-0">
                                      <span className="block truncate text-xs font-semibold">{category.label}</span>
                                      <span className="block text-[11px] opacity-80">{category.count} item(s)</span>
                                    </span>
                                </Button>
                            ))}
                        </div>

                        <p className="text-xs text-slate-500">
                          Pick a category first, then search and add from the filtered catalog below.
                        </p>

                        <div className="flex flex-col gap-2 sm:flex-row">
                            <Input
                                value={catalogSearch}
                                onChange={(event) => setCatalogSearch(event.target.value)}
                                placeholder="Search price book (code, name, category)..."
                                className="sm:flex-1"
                            />
                            <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                                <SelectTrigger className="w-full sm:w-[280px]">
                                    <SelectValue placeholder="Quick Build Template" />
                                </SelectTrigger>
                                <SelectContent>
                                    {PHASE1_TEMPLATE_LIBRARY.map((template) => (
                                        <SelectItem key={template.key} value={template.key}>
                                            {template.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Button variant="secondary" onClick={applyTemplate} disabled={!selectedTemplate}>
                                Apply Template
                            </Button>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {quickPickItems.map((quickItem) => (
                                <Button
                                    key={quickItem.id}
                                    size="sm"
                                    variant="outline"
                                    onClick={() => appendPriceBookItem(quickItem)}
                                    className="h-8"
                                >
                                    + {quickItem.name} (${Number(quickItem.base_price).toFixed(2)})
                                </Button>
                            ))}
                        </div>

                        <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
                            <p className="mb-2 text-xs font-semibold text-slate-600">
                                Filtered Catalog ({filteredPriceBook.length})
                            </p>
                            <div className="max-h-44 space-y-1 overflow-y-auto pr-1">
                                {filteredPriceBook.slice(0, 20).map((row) => (
                                    <div
                                      key={row.id}
                                      className="flex items-center justify-between rounded border border-slate-200 bg-white px-2 py-1.5"
                                    >
                                      <div className="min-w-0">
                                        <p className="truncate text-xs font-medium text-slate-800">{row.name}</p>
                                        <p className="truncate text-[11px] text-slate-500">
                                          {row.code} · {PHASE1_CATEGORY_META[normalizeCategory(row.category)]?.label || row.category || 'Uncategorized'}
                                        </p>
                                      </div>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="ml-2 h-7 px-2 text-[11px]"
                                        onClick={() => appendPriceBookItem(row)}
                                      >
                                        Add ${Number(row.base_price).toFixed(2)}
                                      </Button>
                                    </div>
                                ))}
                                {filteredPriceBook.length > 20 && (
                                  <p className="text-center text-[11px] text-slate-500">
                                    Showing first 20 matches. Use row picker search for the full filtered set.
                                  </p>
                                )}
                            </div>
                        </div>
                    </div>
                    )}
                </CardHeader>
                <CardContent className="p-4 md:p-0">
                    <div className="space-y-4 md:hidden">
                        {proposal.items.map((item, idx) => (
                            <div key={idx} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Item {idx + 1}</p>
                                        <p className="truncate text-xs text-slate-500">
                                          {item.price_book_code ? item.price_book_code : 'Custom item'}
                                        </p>
                                    </div>
                                    <Button size="icon" variant="ghost" onClick={() => removeItem(idx)} className="text-red-500 hover:text-red-700">
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>

                                <div className="mt-3 space-y-3">
                                    <Popover
                                      open={openPickerRow === idx}
                                      onOpenChange={(open) => setOpenPickerRow(open ? idx : null)}
                                    >
                                      <PopoverTrigger asChild>
                                        <Button
                                          variant="outline"
                                          role="combobox"
                                          className="h-10 w-full justify-between bg-slate-50 px-3 text-xs border-slate-200"
                                        >
                                          <span className="truncate text-left">
                                            {item.price_book_code
                                              ? `${item.description || 'Selected item'} (${item.price_book_code})`
                                              : 'Select from Price Book'}
                                          </span>
                                          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-60" />
                                        </Button>
                                      </PopoverTrigger>
                                      <PopoverContent align="start" className="w-[min(460px,calc(100vw-2rem))] p-0">
                                        <Command>
                                          <CommandInput placeholder="Search by name, code, category..." />
                                          <CommandList className="max-h-[360px]">
                                            <CommandEmpty>No matches for current category/filter.</CommandEmpty>
                                            <CommandGroup heading="Manual">
                                              <CommandItem
                                                value="custom item manual entry"
                                                onSelect={() => {
                                                  updateItem(idx, 'price_book_code', null);
                                                  setOpenPickerRow(null);
                                                }}
                                              >
                                                <span className="text-xs">Use custom item (manual description/price)</span>
                                              </CommandItem>
                                            </CommandGroup>
                                            {Object.entries(groupedFilteredPriceBook)
                                              .sort((a, b) => a[0].localeCompare(b[0]))
                                              .map(([categoryKey, rows]) => (
                                                <CommandGroup
                                                  key={categoryKey}
                                                  heading={`${PHASE1_CATEGORY_META[categoryKey]?.label || categoryKey.replace(/_/g, ' ')} (${rows.length})`}
                                                >
                                                  {rows.map((pb) => (
                                                    <CommandItem
                                                      key={pb.id}
                                                      value={`${pb.code} ${pb.name} ${pb.category || ''} ${pb.description || ''}`}
                                                      onSelect={() => {
                                                        handlePriceBookSelect(idx, pb.code);
                                                        setOpenPickerRow(null);
                                                      }}
                                                    >
                                                      <div className="flex w-full items-start justify-between gap-3">
                                                        <div className="min-w-0">
                                                          <p className="truncate text-xs font-medium">{pb.name}</p>
                                                          <p className="truncate text-[11px] text-slate-500">{pb.code}</p>
                                                        </div>
                                                        <CommandShortcut>${Number(pb.base_price).toFixed(2)}</CommandShortcut>
                                                      </div>
                                                    </CommandItem>
                                                  ))}
                                                </CommandGroup>
                                              ))}
                                          </CommandList>
                                        </Command>
                                      </PopoverContent>
                                    </Popover>

                                    <div className="space-y-2">
                                        <Label className="text-xs uppercase tracking-wider text-slate-500">Description</Label>
                                        <Input
                                            value={item.description}
                                            onChange={e => updateItem(idx, 'description', e.target.value)}
                                            placeholder="Description"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-2">
                                            <Label className="text-xs uppercase tracking-wider text-slate-500">Qty</Label>
                                            <Input type="number" min="1" value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-xs uppercase tracking-wider text-slate-500">Price ($)</Label>
                                            <Input type="number" min="0" value={item.unit_price} onChange={e => updateItem(idx, 'unit_price', e.target.value)} />
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2">
                                        <span className="text-sm text-slate-500">Total</span>
                                        <span className="font-semibold text-slate-900">${Number(item.total_price).toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="hidden md:block">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[40%]">Service / Product</TableHead>
                                <TableHead className="w-[15%]">Qty</TableHead>
                                <TableHead className="w-[20%]">Price ($)</TableHead>
                                <TableHead className="w-[20%]">Total ($)</TableHead>
                                <TableHead className="w-[5%]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {proposal.items.map((item, idx) => (
                                <TableRow key={idx}>
                                    <TableCell>
                                        <div className="space-y-2">
                                            <Popover
                                              open={openPickerRow === idx}
                                              onOpenChange={(open) => setOpenPickerRow(open ? idx : null)}
                                            >
                                              <PopoverTrigger asChild>
                                                <Button
                                                  variant="outline"
                                                  role="combobox"
                                                  className="h-8 w-full justify-between bg-slate-50 px-2 text-xs border-slate-200"
                                                >
                                                  <span className="truncate text-left">
                                                    {item.price_book_code
                                                      ? `${item.description || 'Selected item'} (${item.price_book_code})`
                                                      : 'Select from Price Book'}
                                                  </span>
                                                  <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-60" />
                                                </Button>
                                              </PopoverTrigger>
                                              <PopoverContent align="start" className="w-[min(460px,calc(100vw-2rem))] p-0">
                                                <Command>
                                                  <CommandInput placeholder="Search by name, code, category..." />
                                                  <CommandList className="max-h-[360px]">
                                                    <CommandEmpty>No matches for current category/filter.</CommandEmpty>
                                                    <CommandGroup heading="Manual">
                                                      <CommandItem
                                                        value="custom item manual entry"
                                                        onSelect={() => {
                                                          updateItem(idx, 'price_book_code', null);
                                                          setOpenPickerRow(null);
                                                        }}
                                                      >
                                                        <span className="text-xs">Use custom item (manual description/price)</span>
                                                      </CommandItem>
                                                    </CommandGroup>
                                                    {Object.entries(groupedFilteredPriceBook)
                                                      .sort((a, b) => a[0].localeCompare(b[0]))
                                                      .map(([categoryKey, rows]) => (
                                                        <CommandGroup
                                                          key={categoryKey}
                                                          heading={`${PHASE1_CATEGORY_META[categoryKey]?.label || categoryKey.replace(/_/g, ' ')} (${rows.length})`}
                                                        >
                                                          {rows.map((pb) => (
                                                            <CommandItem
                                                              key={pb.id}
                                                              value={`${pb.code} ${pb.name} ${pb.category || ''} ${pb.description || ''}`}
                                                              onSelect={() => {
                                                                handlePriceBookSelect(idx, pb.code);
                                                                setOpenPickerRow(null);
                                                              }}
                                                            >
                                                              <div className="flex w-full items-start justify-between gap-3">
                                                                <div className="min-w-0">
                                                                  <p className="truncate text-xs font-medium">{pb.name}</p>
                                                                  <p className="truncate text-[11px] text-slate-500">{pb.code}</p>
                                                                </div>
                                                                <CommandShortcut>${Number(pb.base_price).toFixed(2)}</CommandShortcut>
                                                              </div>
                                                            </CommandItem>
                                                          ))}
                                                        </CommandGroup>
                                                      ))}
                                                  </CommandList>
                                                </Command>
                                              </PopoverContent>
                                            </Popover>
                                            <Input
                                                value={item.description}
                                                onChange={e => updateItem(idx, 'description', e.target.value)}
                                                placeholder="Description"
                                            />
                                        </div>
                                    </TableCell>
                                    <TableCell className="align-top pt-4">
                                        <Input type="number" min="1" value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} />
                                    </TableCell>
                                    <TableCell className="align-top pt-4">
                                        <Input type="number" min="0" value={item.unit_price} onChange={e => updateItem(idx, 'unit_price', e.target.value)} />
                                    </TableCell>
                                    <TableCell className="align-top pt-6">
                                        <div className="pl-3 font-medium">${Number(item.total_price).toFixed(2)}</div>
                                    </TableCell>
                                    <TableCell className="align-top pt-4">
                                        <Button size="icon" variant="ghost" onClick={() => removeItem(idx)} className="text-red-500 hover:text-red-700">
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader><CardTitle>Terms & Notes</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>Introduction / Header</Label>
                        <Textarea value={proposal.header_text} onChange={e => setProposal({...proposal, header_text: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                        <Label>Footer / Terms</Label>
                        <Textarea value={proposal.footer_text} onChange={e => setProposal({...proposal, footer_text: e.target.value})} />
                    </div>
                </CardContent>
            </Card>
        </div>

        <div className="space-y-6">
            <Card className="border-none bg-slate-900 text-white shadow-xl lg:sticky lg:top-24">
                <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                        <Calculator className="w-5 h-5 text-blue-400" /> Summary
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex justify-between text-slate-300">
                        <span>Subtotal</span>
                        <span>${subtotal.toFixed(2)}</span>
                    </div>
                    {taxAmount > 0 ? (
                      <div className="flex justify-between text-slate-300">
                          <span>Tax</span>
                          <span>${taxAmount.toFixed(2)}</span>
                      </div>
                    ) : null}
                    <Separator className="bg-slate-700" />
                    <div className="flex justify-between text-xl font-bold text-white">
                        <span>Total</span>
                        <span>${total.toFixed(2)}</span>
                    </div>
                </CardContent>
            </Card>
            {id && (
              <DeliveryHistoryCard entityType="quote" entityId={id} tenantId={activeTenantId} />
            )}
        </div>
      </div>

      <Dialog open={servicePlanDialogOpen} onOpenChange={setServicePlanDialogOpen}>
        <DialogContent className="sm:max-w-[760px]">
          <DialogHeader>
            <DialogTitle>Add Service Plan</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid gap-2 sm:grid-cols-3">
              {SERVICE_PLAN_LIBRARY.map((plan) => (
                <Button
                  key={plan.key}
                  type="button"
                  variant={selectedServicePlan === plan.key ? 'default' : 'outline'}
                  className="h-auto items-start justify-start gap-2 p-3 text-left"
                  onClick={() => setSelectedServicePlan(plan.key)}
                >
                  {React.createElement(plan.icon, { className: 'mt-0.5 h-4 w-4 shrink-0' })}
                  <span>
                    <span className="block text-sm font-semibold">{plan.label}</span>
                    <span className="block text-xs opacity-80">{plan.description}</span>
                  </span>
                </Button>
              ))}
            </div>

            {selectedServicePlan === 'dryer_vent' && (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={servicePlanConfig.dryer_vent.roofAccess}
                    onCheckedChange={(value) => updateServicePlanField('dryer_vent', 'roofAccess', Boolean(value))}
                  />
                  Roof access modifier
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={servicePlanConfig.dryer_vent.secondDryer}
                    onCheckedChange={(value) => updateServicePlanField('dryer_vent', 'secondDryer', Boolean(value))}
                  />
                  Second dryer vent (same visit)
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={servicePlanConfig.dryer_vent.transitionUpgrade}
                    onCheckedChange={(value) => updateServicePlanField('dryer_vent', 'transitionUpgrade', Boolean(value))}
                  />
                  Metal transition upgrade
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={servicePlanConfig.dryer_vent.birdGuard}
                    onCheckedChange={(value) => updateServicePlanField('dryer_vent', 'birdGuard', Boolean(value))}
                  />
                  Bird guard / vent hood replacement
                </label>
              </div>
            )}

            {selectedServicePlan === 'air_duct' && (
              <div className="space-y-3">
                <div className="max-w-[220px]">
                  <Label className="text-xs uppercase tracking-wider text-slate-500">System Count</Label>
                  <Input
                    type="number"
                    min="1"
                    max="6"
                    value={servicePlanConfig.air_duct.systemCount}
                    onChange={(event) =>
                      updateServicePlanField(
                        'air_duct',
                        'systemCount',
                        Math.max(1, Number(event.target.value) || 1)
                      )
                    }
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={servicePlanConfig.air_duct.includeCoilCleaning}
                      onCheckedChange={(value) => updateServicePlanField('air_duct', 'includeCoilCleaning', Boolean(value))}
                    />
                    Include coil cleaning
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={servicePlanConfig.air_duct.includeBlowerCleaning}
                      onCheckedChange={(value) => updateServicePlanField('air_duct', 'includeBlowerCleaning', Boolean(value))}
                    />
                    Include blower cleaning
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={servicePlanConfig.air_duct.includeAhuHousingCleaning}
                      onCheckedChange={(value) => updateServicePlanField('air_duct', 'includeAhuHousingCleaning', Boolean(value))}
                    />
                    Include AHU housing cleaning
                  </label>
                </div>
              </div>
            )}

            {selectedServicePlan === 'uv_pco' && (
              <div className="space-y-3">
                <div className="max-w-[260px]">
                  <Label className="text-xs uppercase tracking-wider text-slate-500">Package</Label>
                  <Select
                    value={servicePlanConfig.uv_pco.packageType}
                    onValueChange={(value) => updateServicePlanField('uv_pco', 'packageType', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="uvc">UV-C Light System</SelectItem>
                      <SelectItem value="pco">Whole-Home PCO System</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={servicePlanConfig.uv_pco.includeCoilCleaning}
                      onCheckedChange={(value) => updateServicePlanField('uv_pco', 'includeCoilCleaning', Boolean(value))}
                    />
                    Include coil cleaning
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={servicePlanConfig.uv_pco.includeBlowerCleaning}
                      onCheckedChange={(value) => updateServicePlanField('uv_pco', 'includeBlowerCleaning', Boolean(value))}
                    />
                    Include blower cleaning
                  </label>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setServicePlanDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={appendServicePlanItems}>
              Add Plan to Quote
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isCustomerModalOpen}
        onOpenChange={(open) => {
          setIsCustomerModalOpen(open);
          if (open) {
            setCustomerView('search');
            setCustomerSearch('');
          }
        }}
      >
         <DialogContent className="sm:max-w-[600px] w-[95vw] max-h-[85vh] flex flex-col overflow-hidden">
             <DialogHeader>
                 <DialogTitle>{customerView === 'search' ? 'Select Customer' : 'Create New Customer'}</DialogTitle>
             </DialogHeader>

             {customerView === 'search' ? (
                 <div className="space-y-4 flex-1 min-h-0 overflow-y-auto p-1">
                     <div className="flex flex-col gap-2 sm:flex-row">
                         <div className="relative flex-1">
                             <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                             <Input 
                                placeholder="Search by name, phone, or company..." 
                                className="pl-9"
                                value={customerSearch}
                                onChange={(e) => setCustomerSearch(e.target.value)}
                             />
                         </div>
                         <Button onClick={() => setCustomerView('create')}>
                             <UserPlus className="w-4 h-4 mr-2" /> New
                         </Button>
                     </div>
                     <div className="space-y-2 mt-4">
                         {filteredLeads.map(lead => (
                                 <div 
                                key={lead.id} 
                                className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
                                onClick={() => {
                                    const leadAddress = formatLeadServiceAddress(lead);
                                    setProposal(prev => ({
                                      ...prev,
                                      lead_id: lead.id,
                                      service_address: leadAddress || '',
                                    }));
                                    setIsCustomerModalOpen(false);
                                }}
                             >
                                 <div>
                                     <div className="font-bold text-slate-900">{lead.first_name} {lead.last_name}</div>
                                     <div className="text-xs text-slate-500 flex gap-3">
                                         <span>{lead.email}</span>
                                         {lead.phone && <span>• {formatPhoneNumber(lead.phone)}</span>}
                                     </div>
                                 </div>
                                 {lead.id === proposal.lead_id && <Check className="w-5 h-5 text-blue-600" />}
                             </div>
                         ))}
                         {filteredLeads.length === 0 && (
                             <div className="rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                                 No customers matched that search. Try name, email, company, or phone.
                             </div>
                         )}
                     </div>
                 </div>
             ) : (
                 <div className="space-y-4 py-2 flex-1 min-h-0 overflow-y-auto pr-1">
                     <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                         <div className="space-y-2">
                             <Label>First Name</Label>
                             <Input 
                                value={newCustomer.firstName} 
                                onChange={e => setNewCustomer({...newCustomer, firstName: e.target.value})}
                                placeholder="Jane"
                             />
                         </div>
                         <div className="space-y-2">
                             <Label>Last Name</Label>
                             <Input 
                                value={newCustomer.lastName} 
                                onChange={e => setNewCustomer({...newCustomer, lastName: e.target.value})}
                                placeholder="Doe"
                             />
                         </div>
                     </div>
                     <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                         <div className="space-y-2">
                             <Label>Email</Label>
                             <Input 
                                value={newCustomer.email} 
                                onChange={e => setNewCustomer({...newCustomer, email: e.target.value})}
                                placeholder="email@example.com"
                             />
                         </div>
                         <div className="space-y-2">
                             <Label>Phone</Label>
                             <Input 
                                value={newCustomer.phone} 
                                onChange={e => setNewCustomer({...newCustomer, phone: formatPhoneNumber(e.target.value)})}
                                placeholder="(555) 123-4567"
                                maxLength={14}
                             />
                         </div>
                     </div>
                     
                     <div className="space-y-2">
                         <Label>Service Interest</Label>
                         <Select value={newCustomer.service} onValueChange={v => setNewCustomer({...newCustomer, service: v})}>
                             <SelectTrigger>
                                 <SelectValue />
                             </SelectTrigger>
                             <SelectContent>
                                 <SelectItem value="Duct Cleaning">Duct Cleaning</SelectItem>
                                 <SelectItem value="Dryer Vent Cleaning">Dryer Vent Cleaning</SelectItem>
                                 <SelectItem value="HVAC Repair">HVAC Repair</SelectItem>
                                 <SelectItem value="New Install">New Install</SelectItem>
                             </SelectContent>
                         </Select>
                     </div>

                     <div className="space-y-2">
                         <Label>Lead Temperature</Label>
                         <div className="grid grid-cols-3 gap-2">
                             {['Cold', 'Warm', 'Hot'].map(temp => (
                                 <div 
                                    key={temp}
                                    className={`
                                        cursor-pointer text-center p-2 rounded-md border text-sm font-medium transition-colors
                                        ${newCustomer.temperature === temp 
                                            ? 'bg-blue-50 border-blue-500 text-blue-700' 
                                            : 'hover:bg-slate-50 border-slate-200 text-slate-600'
                                        }
                                    `}
                                    onClick={() => setNewCustomer({...newCustomer, temperature: temp})}
                                 >
                                     {temp}
                                 </div>
                             ))}
                         </div>
                     </div>

                     <DialogFooter className="mt-6">
                         <Button variant="ghost" onClick={() => setCustomerView('search')}>Back to Search</Button>
                         <Button onClick={handleCreateCustomer} disabled={createLoading}>
                             {createLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                             Create Customer
                         </Button>
                     </DialogFooter>
                 </div>
             )}
         </DialogContent>
      </Dialog>

      <Dialog
        open={overrideDialogOpen}
        onOpenChange={(open) => {
          if (!loading) setOverrideDialogOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Admin Override Required</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm text-slate-700">
            <p>
              Cost snapshot missing. Sending this quote may violate the margin guardrail.
            </p>
            <div className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-3">
              <Checkbox
                id="override_acknowledge"
                checked={overrideAcknowledged}
                onCheckedChange={(checked) => setOverrideAcknowledged(Boolean(checked))}
                className="mt-0.5"
              />
              <Label htmlFor="override_acknowledge" className="cursor-pointer font-normal text-slate-700">
                Cost snapshot missing - sending may violate margin guardrail.
              </Label>
            </div>
            <div className="space-y-2">
              <Label htmlFor="override_reason">Reason for override</Label>
              <Textarea
                id="override_reason"
                value={overrideReason}
                onChange={(event) => setOverrideReason(event.target.value)}
                placeholder="Explain why this send is approved without a cost snapshot."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={loading}
              onClick={() => {
                setOverrideDialogOpen(false);
                setPendingOverridePayload(null);
                setOverrideReason('');
                setOverrideAcknowledged(false);
              }}
            >
              Cancel
            </Button>
            <Button
              className="bg-blue-600"
              disabled={loading || !overrideAcknowledged || overrideReason.trim().length <= 5}
              onClick={handleOverrideSend}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Send with Override
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProposalBuilder;
