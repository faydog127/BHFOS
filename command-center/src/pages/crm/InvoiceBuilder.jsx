import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { getTenantId } from '@/lib/tenantUtils';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Trash2, Plus, Save, Send, ArrowLeft, Loader2, Calculator, Link as LinkIcon, DollarSign, Ban, CheckCircle, Download } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  getDeliveryPreferenceLabel,
  resolveLeadDelivery,
} from '@/lib/documentDelivery';
import DeliveryHistoryCard from '@/components/crm/documents/DeliveryHistoryCard';
import { sendReceiptDocument } from '@/services/documentDeliveryService';
import { clearBuilderDraft, loadBuilderDraft, saveBuilderDraft } from '@/lib/builderDrafts';

const PROCESSING_RATE = 0.03;
const INVOICE_BUILDER_DRAFT_KEY = 'invoice_builder';
const PARTS_MATERIALS_KEYWORDS = /\b(part|parts|material|materials|media filter|filter cabinet|uv|coil|capacitor|motor|board|line set|drain pan|plenum box|grille)\b/i;
const isPartsOrMaterialsItem = (description = '') => PARTS_MATERIALS_KEYWORDS.test(String(description));
const isMissingColumnError = (error) =>
  String(error?.code || '') === '42703' ||
  /column .* does not exist/i.test(String(error?.message || '')) ||
  /could not find the '.*' column/i.test(String(error?.message || ''));
const isMissingRelationError = (error) =>
  ['42P01', 'PGRST204', 'PGRST205'].includes(String(error?.code || '')) ||
  /relation .* does not exist/i.test(String(error?.message || '')) ||
  /could not find the (table|relation) .* schema cache/i.test(String(error?.message || ''));
const GENERATED_COLUMN_RE = /column "([^"]+)" is a generated column/i;
const COLUMN_NAME_RE = /column "([^"]+)"/i;

const getGeneratedColumnName = (error) => {
  if (String(error?.code || '') !== '428C9') return null;
  const detailMatch = String(error?.details || '').match(GENERATED_COLUMN_RE);
  if (detailMatch?.[1]) return detailMatch[1];

  const messageMatch = String(error?.message || '').match(COLUMN_NAME_RE);
  return messageMatch?.[1] || null;
};

const hasMeaningfulInvoiceDraft = (invoice, sendChannel) =>
  Boolean(
    String(invoice?.lead_id || '').trim() ||
    String(invoice?.job_id || '').trim() ||
    String(invoice?.customer_name || '').trim() ||
    String(invoice?.customer_email || '').trim() ||
    String(invoice?.customer_phone || '').trim() ||
    String(invoice?.notes || '').trim() ||
    String(invoice?.terms || '').trim() ||
    Number(invoice?.discount_amount || 0) > 0 ||
    (Array.isArray(invoice?.items) && invoice.items.some((item) =>
      String(item?.description || '').trim() ||
      Number(item?.unit_price || 0) > 0 ||
      Number(item?.total_price || 0) > 0 ||
      Number(item?.quantity || 1) !== 1
    )) ||
    String(sendChannel || '').trim() !== 'email'
  );

async function fetchJobItemsWithFallback(jobId, tenantId) {
  const selectVariants = [
    'id, description, quantity, unit_price, total_price, service_id, service_code',
    'id, description, quantity, unit_price, service_id, service_code',
    'id, description, quantity, unit_price, service_id',
    '*',
  ];

  for (const selectClause of selectVariants) {
    const { data, error } = await supabase
      .from('job_items')
      .select(selectClause)
      .eq('tenant_id', tenantId)
      .eq('job_id', jobId);

    if (!error) {
      return Array.isArray(data) ? data : [];
    }

    if (!isMissingColumnError(error)) {
      throw error;
    }
  }

  return [];
}

async function fetchLeadsWithFallback(tenantId) {
  const selectVariants = [
    'id, first_name, last_name, company, email, phone, sms_opt_out, preferred_document_delivery, contact:contacts!leads_contact_id_fkey(preferred_contact_method)',
    'id, first_name, last_name, company, email, phone, sms_opt_out, preferred_document_delivery',
    'id, first_name, last_name, company, email, phone',
  ];

  for (const selectClause of selectVariants) {
    const { data, error } = await supabase
      .from('leads')
      .select(selectClause)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (!error) {
      return Array.isArray(data) ? data : [];
    }

    if (!isMissingColumnError(error) && !isMissingRelationError(error)) {
      throw error;
    }
  }

  return [];
}

async function saveInvoiceRecord(invoicePayload, invoiceId = null) {
  const { data, error } = await supabase.functions.invoke('invoice-save', {
    body: {
      invoice_id: invoiceId,
      tenant_id: getTenantId(),
      invoice: invoicePayload,
      items: invoicePayload.items || [],
    },
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  if (!data?.invoice) throw new Error('Invoice save returned no row.');

  return { data: data.invoice };
}

const InvoiceBuilder = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const jobIdParam = searchParams.get('job_id');
  const quoteIdParam = searchParams.get('quote_id');
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useSupabaseAuth();
  const tenantId = getTenantId();
  
  const [loading, setLoading] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [leads, setLeads] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [priceBook, setPriceBook] = useState([]);
  const [billingGuard, setBillingGuard] = useState({
    contractTotal: 0,
    previouslyBilled: 0,
    remainingBefore: 0,
    allowedStatuses: ['open', 'scheduled', 'in_progress', 'ready_to_invoice', 'completed', 'closed'],
    jobStatus: '',
  });
  
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState(''); 
  
  const [paymentReference, setPaymentReference] = useState('');
  const [processingPayment, setProcessingPayment] = useState(false);
  const [sendChannel, setSendChannel] = useState('email');
  const restoredDraftRef = useRef(false);
  const draftReadyRef = useRef(false);
  const autoOpenedPaymentRef = useRef(false);

  const [invoice, setInvoice] = useState({
    lead_id: '',
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    status: 'draft',
    job_id: '',
    invoice_type: 'final',
    release_approved: false,
    release_approved_at: null,
    release_approved_by: null,
    issue_date: format(new Date(), 'yyyy-MM-dd'),
    due_date: format(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
    notes: 'Thank you for your business.',
    terms: 'Payment is due within 14 days.',
    items: [],
    invoice_number: '',
    public_token: '',
    discount_amount: 0,
    amount_paid: 0,
    quote_id: null
  });

  function getRandomInvoiceNumber() {
    return Math.floor(100000 + Math.random() * 900000);
  }

  function mapQuoteLikeItemsToInvoiceItems(sourceItems = []) {
    return sourceItems.map((item) => ({
      description: item.description || item.item_name || 'Service item',
      quantity: Number(item.quantity || 1),
      unit_price: Number(item.unit_price ?? item.price ?? 0),
      total_price: Number(item.total_price ?? (Number(item.quantity || 1) * Number(item.unit_price ?? item.price ?? 0))),
      service_id: item.service_id || null,
      is_taxable: isPartsOrMaterialsItem(item.description || item.item_name || ''),
    }));
  }

  function mapJobItemsToInvoiceItems(jobItems = []) {
    return jobItems.map((item) => ({
      description: item.description || item.service_code || 'Work order item',
      quantity: Number(item.quantity || 1),
      unit_price: Number(item.unit_price ?? 0),
      total_price: Number(item.total_price ?? (Number(item.quantity || 1) * Number(item.unit_price ?? 0))),
      service_id: item.service_id || null,
      is_taxable: isPartsOrMaterialsItem(item.description || item.service_code || ''),
    }));
  }

  async function fetchWorkOrderSource(jobId, fallbackQuoteId = null) {
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select(`
        id,
        status,
        total_amount,
        quote_id,
        lead_id,
        work_order_number,
        job_number,
        service_address
      `)
      .eq('tenant_id', tenantId)
      .eq('id', jobId)
      .maybeSingle();

    if (jobError || !job) {
      throw jobError || new Error('Work order not found.');
    }

    const resolvedQuoteId = job.quote_id || fallbackQuoteId || null;
    let quote = null;

    if (resolvedQuoteId) {
      const { data: quoteData } = await supabase
        .from('quotes')
        .select('*, quote_items(*)')
        .eq('tenant_id', tenantId)
        .eq('id', resolvedQuoteId)
        .maybeSingle();
      quote = quoteData || null;
    }

    const jobItems = await fetchJobItemsWithFallback(job.id, tenantId);
    const quoteItems =
      Array.isArray(quote?.quote_items) && quote.quote_items.length > 0
        ? quote.quote_items
        : Array.isArray(quote?.line_items)
          ? quote.line_items
          : [];

    const items = jobItems.length > 0
      ? mapJobItemsToInvoiceItems(jobItems)
      : mapQuoteLikeItemsToInvoiceItems(quoteItems);

    return { job, quote, items };
  }

  async function hydrateInvoiceFromWorkOrder(jobId, fallbackQuoteId = null) {
    const { job, quote, items } = await fetchWorkOrderSource(jobId, fallbackQuoteId);
    const workOrderLabel = String(job.work_order_number || job.job_number || job.id || '').trim().toUpperCase();

    setInvoice((prev) => ({
      ...prev,
      lead_id: job.lead_id || quote?.lead_id || prev.lead_id || '',
      customer_name: quote?.customer_name || prev.customer_name || '',
      customer_email: quote?.customer_email || prev.customer_email || '',
      customer_phone: quote?.customer_phone || prev.customer_phone || '',
      quote_id: job.quote_id || quote?.id || prev.quote_id || null,
      job_id: job.id,
      invoice_number: prev.invoice_number || getRandomInvoiceNumber(),
      items,
      notes: quote?.quote_number
        ? `Generated from ${workOrderLabel} / Quote #${quote.quote_number}`
        : `Generated from ${workOrderLabel}`,
    }));

    await refreshBillingGuard(job.id, id || null);
    return job;
  }

  useEffect(() => {
    fetchInitialData();
  }, [id, jobIdParam, quoteIdParam]);

  useEffect(() => {
    restoredDraftRef.current = false;
    draftReadyRef.current = false;
  }, [id, jobIdParam, quoteIdParam, tenantId]);

  useEffect(() => {
    const lead = leads.find((item) => item.id === invoice.lead_id);
    if (!lead) return;
    const delivery = resolveLeadDelivery({
      lead: {
        ...lead,
        email: invoice.customer_email || lead.email,
        phone: invoice.customer_phone || lead.phone,
      },
    });
    if (delivery.channel) {
      setSendChannel(delivery.channel);
    }
  }, [invoice.customer_email, invoice.customer_phone, invoice.lead_id, leads]);

  useEffect(() => {
    if (sendChannel !== 'sms') return;
    const lead = leads.find((item) => item.id === invoice.lead_id);
    const delivery = resolveLeadDelivery({
      lead: lead
        ? {
            ...lead,
            email: invoice.customer_email || lead.email,
            phone: invoice.customer_phone || lead.phone,
          }
        : lead,
      requestedChannel: 'sms',
    });
    if (delivery.channel !== 'sms') {
      setSendChannel('email');
    }
  }, [sendChannel, leads, invoice.customer_email, invoice.customer_phone, invoice.lead_id]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [leadsData, jobsRes, priceBookRes] = await Promise.all([
          fetchLeadsWithFallback(tenantId),
          supabase
            .from('jobs')
            .select('id, status, total_amount, quote_id, lead_id, work_order_number, job_number, service_address, leads(first_name,last_name)')
            .eq('tenant_id', tenantId)
            .neq('status', 'cancelled')
            .order('created_at', { ascending: false }),
          supabase.from('price_book').select('*').eq('active', true).in('tenant_id', [tenantId || 'default', 'default']).order('name')
      ]);
      
      setLeads(leadsData || []);
      if (jobsRes.data) setJobs(jobsRes.data);
      if (priceBookRes.data) {
        const sorted = [...priceBookRes.data].sort((a, b) => {
          const aRank = a.tenant_id === tenantId ? 0 : 1;
          const bRank = b.tenant_id === tenantId ? 0 : 1;
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
          const { data: inv, error } = await supabase
              .from('invoices')
              .select('*, invoice_items(*)')
              .eq('id', id)
              .eq('tenant_id', tenantId) // TENANT FILTER
              .single();
              
          if (inv && !error) {
            const invSubtotal = Number(inv?.subtotal) || 0;
            const invTax = Number(inv?.tax_amount) || 0;
            const legacyAllItemsTaxed =
              invSubtotal > 0 &&
              invTax > 0 &&
              Math.abs(invTax - invSubtotal * PROCESSING_RATE) < 0.05;

            setInvoice({
              ...inv,
              items: (inv.invoice_items || []).map((row) => ({
                ...row,
                // Legacy invoices stored a 3% processing fee as tax_amount without per-line taxable flags.
                // For those cases, treat all items as taxable so the UI totals match the stored invoice.
                is_taxable: legacyAllItemsTaxed ? true : Boolean(row?.is_taxable) || isPartsOrMaterialsItem(row?.description || ''),
              }))
            });
            if (inv?.job_id) {
              await refreshBillingGuard(inv.job_id, inv.id);
            }
          }
      } else if (jobIdParam || quoteIdParam) {
          if (jobIdParam) {
            await hydrateInvoiceFromWorkOrder(jobIdParam, quoteIdParam);
          } else {
            const { data: linkedJob } = await supabase
              .from('jobs')
              .select('id')
              .eq('tenant_id', tenantId)
              .eq('quote_id', quoteIdParam)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (!linkedJob?.id) {
              setInvoice((prev) => ({
                ...prev,
                invoice_number: prev.invoice_number || getRandomInvoiceNumber(),
              }));
              toast({
                variant: 'destructive',
                title: 'Work order required',
                description: 'Accept the quote and use the generated work order before creating an invoice.',
              });
            } else {
              await hydrateInvoiceFromWorkOrder(linkedJob.id, quoteIdParam);
            }
          }
      } else {
        setInvoice(prev => ({ ...prev, invoice_number: getRandomInvoiceNumber() }));
      }
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      draftReadyRef.current = true;
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!draftReadyRef.current || loading || !tenantId || restoredDraftRef.current) return;

    const storedDraft = loadBuilderDraft(INVOICE_BUILDER_DRAFT_KEY, tenantId, id || 'new');
    restoredDraftRef.current = true;
    if (!storedDraft?.invoice) return;

    setInvoice((prev) => ({
      ...prev,
      ...storedDraft.invoice,
      items: Array.isArray(storedDraft.invoice.items) ? storedDraft.invoice.items : prev.items,
    }));
    if (typeof storedDraft.sendChannel === 'string' && storedDraft.sendChannel.trim()) {
      setSendChannel(storedDraft.sendChannel);
    }

    toast({
      title: 'Draft restored',
      description: 'Your in-progress invoice was restored after leaving the page.',
    });
  }, [id, loading, tenantId, toast]);

  useEffect(() => {
    if (!draftReadyRef.current || loading || !tenantId) return;

    if (!hasMeaningfulInvoiceDraft(invoice, sendChannel)) {
      clearBuilderDraft(INVOICE_BUILDER_DRAFT_KEY, tenantId, id || 'new');
      return;
    }

    saveBuilderDraft(INVOICE_BUILDER_DRAFT_KEY, tenantId, id || 'new', {
      invoice,
      sendChannel,
    });
  }, [id, invoice, loading, sendChannel, tenantId]);

  useEffect(() => {
    if (!hasMeaningfulInvoiceDraft(invoice, sendChannel)) return undefined;

    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [invoice, sendChannel]);

  const normalizeStatus = (value) => String(value || '').toLowerCase();

  const getWorkOrderLabel = (job) => {
    const tracking = String(job?.work_order_number || job?.job_number || '').trim().toUpperCase();
    if (tracking) return tracking;
    return `WO-LEGACY-${String(job?.id || '').slice(0, 8).toUpperCase()}`;
  };

  const refreshBillingGuard = async (jobId, currentInvoiceId = null) => {
    if (!jobId) {
      setBillingGuard((prev) => ({
        ...prev,
        contractTotal: 0,
        previouslyBilled: 0,
        remainingBefore: 0,
        jobStatus: '',
      }));
      return;
    }

    const [{ data: job }, { data: siblingInvoices }] = await Promise.all([
      supabase
        .from('jobs')
        .select('id, status, total_amount')
        .eq('tenant_id', tenantId)
        .eq('id', jobId)
        .maybeSingle(),
      supabase
        .from('invoices')
        .select('id, status, total_amount')
        .eq('tenant_id', tenantId)
        .eq('job_id', jobId),
    ]);

    const siblings = (siblingInvoices || []).filter((row) => row.id !== currentInvoiceId);
    const previouslyBilled = siblings
      .filter((row) => normalizeStatus(row.status) !== 'void')
      .reduce((sum, row) => sum + (Number(row.total_amount) || 0), 0);
    const contractTotal = Number(job?.total_amount) || 0;
    const remainingBefore = Math.max(contractTotal - previouslyBilled, 0);

    setBillingGuard((prev) => ({
      ...prev,
      contractTotal,
      previouslyBilled,
      remainingBefore,
      jobStatus: normalizeStatus(job?.status),
    }));
  };

  const addItem = () => {
    setInvoice(prev => ({
        ...prev,
        items: [...prev.items, { description: '', quantity: 1, unit_price: 0, total_price: 0, service_id: null, is_taxable: false }]
    }));
  };

  const updateItem = (index, field, value) => {
    const newItems = [...invoice.items];
    newItems[index][field] = value;
    if (field === 'quantity' || field === 'unit_price') {
        const q = field === 'quantity' ? value : newItems[index].quantity;
        const p = field === 'unit_price' ? value : newItems[index].unit_price;
        newItems[index].total_price = Number(q) * Number(p);
    }
    setInvoice(prev => ({ ...prev, items: newItems }));
  };

  const removeItem = (index) => {
    const newItems = invoice.items.filter((_, i) => i !== index);
    setInvoice(prev => ({ ...prev, items: newItems }));
  };

  const handlePriceBookSelect = (index, code) => {
      const item = priceBook.find(p => p.code === code);
      if (item) {
          const newItems = [...invoice.items];
          newItems[index] = {
              ...newItems[index],
              description: item.name,
              unit_price: item.base_price,
              service_id: item.id,
              total_price: Number(newItems[index].quantity) * Number(item.base_price),
              is_taxable: isPartsOrMaterialsItem(item.name)
          };
          setInvoice(prev => ({ ...prev, items: newItems }));
      }
  };

  const calculateTotals = () => {
    const status = String(invoice?.status || '').toLowerCase();
    const isFinalized = status && status !== 'draft';

    const computedSubtotal = invoice.items.reduce((sum, item) => sum + (Number(item.total_price) || 0), 0);
    const computedTaxableSubtotal = invoice.items
      .filter((i) => Boolean(i.is_taxable))
      .reduce((sum, item) => sum + (Number(item.total_price) || 0), 0);

    const discount = Number(invoice.discount_amount) || 0;

    const storedSubtotal = Number(invoice.subtotal);
    const storedTaxAmount = Number(invoice.tax_amount);
    const storedTotal = Number(invoice.total_amount);
    const storedTaxRate = Number(invoice.tax_rate);
    const storedBalanceDue = Number(invoice.balance_due);

    const subtotal =
      isFinalized && Number.isFinite(storedSubtotal) && storedSubtotal > 0 ? storedSubtotal : computedSubtotal;

    const taxRateFromAmounts =
      Number.isFinite(storedTaxAmount) && storedTaxAmount > 0 && subtotal > 0
        ? storedTaxAmount / subtotal
        : 0;

    const taxRate =
      isFinalized && Number.isFinite(storedTaxRate) && storedTaxRate > 0
        ? storedTaxRate
        : isFinalized && taxRateFromAmounts > 0
          ? taxRateFromAmounts
          : PROCESSING_RATE;

    const taxableSubtotal = taxRate === PROCESSING_RATE ? computedTaxableSubtotal : subtotal;

    const computedTaxAmount = taxableSubtotal * taxRate;
    const taxAmount =
      isFinalized && Number.isFinite(storedTaxAmount) && storedTaxAmount >= 0 ? storedTaxAmount : computedTaxAmount;

    const computedTotal = subtotal + taxAmount - discount;
    const total = isFinalized && Number.isFinite(storedTotal) && storedTotal > 0 ? storedTotal : computedTotal;

    const amountPaid = Number(invoice.amount_paid) || 0;
    const computedBalance = total - amountPaid;
    const balance =
      Number.isFinite(storedBalanceDue) && storedBalanceDue >= 0 ? storedBalanceDue : computedBalance;

    return { subtotal, taxableSubtotal, taxRate, taxAmount, total, balance, isFinalized };
  };

  
  const openRecordPayment = () => {
    const { total, balance } = calculateTotals();
    const suggested = Math.max(Number(balance || 0), 0);
    setPaymentAmount(suggested > 0 ? suggested.toFixed(2) : (Number(total || 0) > 0 ? Number(total || 0).toFixed(2) : ''));
    setPaymentMethod(paymentMethod || 'cash');
    setPaymentReference('');
    setIsPayModalOpen(true);
  };

  useEffect(() => {
    if (autoOpenedPaymentRef.current) return;
    if (loading) return;
    if (searchParams.get('record_payment') !== '1') return;
    if (!invoice?.id) return;
    if (String(invoice.status || '').toLowerCase() === 'paid' || Number(invoice.balance_due || 0) <= 0) return;
    autoOpenedPaymentRef.current = true;
    openRecordPayment();
  }, [invoice?.id, invoice?.status, invoice?.balance_due, loading, searchParams]);

  const handleRecordPayment = async () => {
    const invoiceId = id || invoice.id;
    if (!invoiceId) {
      toast({
        variant: 'destructive',
        title: 'Save invoice first',
        description: 'Save the invoice before recording a payment.',
      });
      return;
    }

    if (!invoice.job_id) {
      toast({
        variant: 'destructive',
        title: 'Work order required',
        description: 'This invoice must be linked to a work order before recording payment.',
      });
      return;
    }

    const amount = Number(String(paymentAmount || '').replace(/[^0-9.]/g, ''));
    if (!Number.isFinite(amount) || amount <= 0) {
      toast({ variant: 'destructive', title: 'Invalid amount', description: 'Enter a payment amount greater than $0.' });
      return;
    }

    const { total } = calculateTotals();
    const existingPaid = Number(invoice.amount_paid || 0);
    const nextPaid = existingPaid + amount;
    const isFullPayment = (Number(total || 0) <= 0) || nextPaid >= Number(total || 0) - 0.009;
    const normalizedMethod = String(paymentMethod || '').trim() || 'offline';
    const methodWithRef =
      paymentReference && normalizedMethod.toLowerCase() === 'check'
        ? `check:${String(paymentReference).trim()}`
        : normalizedMethod;

    setProcessingPayment(true);
    try {
      const { data, error } = await supabase.functions.invoke('invoice-update-status', {
        body: {
          tenant_id: tenantId,
          invoice_id: invoiceId,
          payment_amount: amount,
          payment_method: normalizedMethod,
          payment_reference: paymentReference ? String(paymentReference).trim() : null,
          source_screen: 'invoice',
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const syncedInvoice = data?.invoice || null;
      if (syncedInvoice?.id) {
        setInvoice((prev) => ({ ...prev, ...syncedInvoice, items: prev.items }));
      }

      toast({
        title: 'Payment recorded',
        description: isFullPayment ? 'Invoice marked paid.' : 'Partial payment recorded.',
      });
      setIsPayModalOpen(false);
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Payment update failed',
        description: err?.message || 'Could not record payment.',
      });
    } finally {
      setProcessingPayment(false);
    }
  };const handleSave = async (newStatus = null) => {
    if (!invoice.lead_id) {
        toast({ variant: 'destructive', title: 'Error', description: 'Please select a customer.' });
        return;
    }

    if (!invoice.job_id) {
      toast({ variant: 'destructive', title: 'Work order required', description: 'Select a work order before saving this invoice.' });
      return;
    }

    setLoading(true);
    const { subtotal, taxAmount, total, taxRate } = calculateTotals();
    const statusToSave = newStatus || invoice.status;
    const normalizedStatusToSave = normalizeStatus(statusToSave);
    const normalizedJobStatus = normalizeStatus(billingGuard.jobStatus);
    const selectedLead = leads.find((lead) => lead.id === invoice.lead_id);
    const recipientLead = selectedLead
      ? {
          ...selectedLead,
          company: invoice.customer_name || selectedLead.company,
          email: invoice.customer_email || selectedLead.email,
          phone: invoice.customer_phone || selectedLead.phone,
        }
      : null;

    if (!normalizedJobStatus) {
      setLoading(false);
      toast({
        variant: 'destructive',
        title: 'Work order status missing',
        description: 'Reload work order details before creating this invoice.',
      });
      return;
    }

    if (normalizedJobStatus === 'cancelled') {
      setLoading(false);
      toast({
        variant: 'destructive',
        title: 'Cancelled work order',
        description: 'Invoices cannot be created for cancelled work orders.',
      });
      return;
    }

    if (!invoice.invoice_type) {
      setLoading(false);
      toast({ variant: 'destructive', title: 'Invoice type required', description: 'Choose Deposit, Progress, or Final.' });
      return;
    }

    if (normalizedStatusToSave === 'sent') {
      const deliveryPlan = resolveLeadDelivery({ lead: recipientLead, requestedChannel: sendChannel });
      if (!recipientLead || !deliveryPlan.channel) {
        setLoading(false);
        toast({
          variant: 'destructive',
          title: 'Deliverable contact required',
          description: 'This customer needs either a valid email address or a textable phone number before you can send an invoice.',
        });
        return;
      }
    }

    if (normalizedStatusToSave === 'sent' && !invoice.release_approved) {
      setLoading(false);
      toast({ variant: 'destructive', title: 'Release approval required', description: 'Partner approval is required before sending.' });
      return;
    }

    const remainingBefore = Number(billingGuard.remainingBefore) || 0;
    if (!id && remainingBefore > 0 && total - remainingBefore > 0.009) {
      setLoading(false);
      toast({
        variant: 'destructive',
        title: 'Invoice exceeds remaining balance',
        description: `Remaining contract balance is $${remainingBefore.toFixed(2)}. Reduce invoice total or split billing.`,
      });
      return;
    }

    let publicToken = invoice.public_token;
    if (!publicToken) {
       publicToken = typeof crypto?.randomUUID === 'function'
         ? crypto.randomUUID()
         : (() => {
           const array = new Uint8Array(16);
           crypto.getRandomValues(array);
           return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
         })();
    }

        const invoiceData = {
        lead_id: invoice.lead_id,
        quote_id: invoice.quote_id,
        job_id: invoice.job_id,
        status: statusToSave,
        invoice_type: invoice.invoice_type,
        release_approved: Boolean(invoice.release_approved),
        release_approved_at: invoice.release_approved ? (invoice.release_approved_at || new Date().toISOString()) : null,
        release_approved_by: invoice.release_approved ? (invoice.release_approved_by || user?.id || null) : null,
        issue_date: invoice.issue_date,
        due_date: invoice.due_date,
        notes: invoice.notes,
        terms: invoice.terms,
        customer_name: invoice.customer_name,
        customer_email: invoice.customer_email,
        customer_phone: invoice.customer_phone,
        subtotal,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        discount_amount: invoice.discount_amount,
        total_amount: total,
        amount_paid: invoice.amount_paid || 0,
        // `balance_due` is a generated column in prod; never attempt to write it.
        invoice_number: invoice.invoice_number,
        public_token: publicToken,
        sent_at: statusToSave === 'sent' && invoice.status !== 'sent' ? new Date() : invoice.sent_at,
        tenant_id: tenantId, // Explicit insert
        items: invoice.items.map(item => ({
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_price,
          service_id: item.service_id,
          is_taxable: item.is_taxable,
        })),
    };

    try {
        let invoiceId = id;
        
        const { data: persistedInvoice } = await saveInvoiceRecord(invoiceData, id);
        if (!id) {
          invoiceId = persistedInvoice.id;
        }

        if (statusToSave === 'sent') {
            const { data: sendData, error: sendError } = await supabase.functions.invoke('send-invoice', {
                body: {
                  invoice_id: invoiceId,
                  delivery_channel: sendChannel,
                  email: recipientLead?.email,
                  to_phone: recipientLead?.phone,
                }
            });
            if (sendError) throw sendError;
            const deliveryChannel = sendData?.delivery_channel || sendChannel;
            const requestedChannel = sendData?.requested_delivery_channel || sendChannel;
            const usedFallback = requestedChannel !== deliveryChannel;
            if (deliveryChannel === 'sms') {
                toast({
                    title: 'Invoice Sent',
                    description: sendData?.skipped
                      ? 'SMS already sent recently.'
                      : usedFallback
                        ? 'Email was unavailable, so the customer was texted a secure payment link.'
                        : 'Customer has been texted a secure payment link.',
                });
            } else if (sendData?.stripe_error) {
                toast({
                    variant: 'destructive',
                    title: 'Invoice Sent With Fallback Link',
                    description: `Stripe hosted invoice was unavailable: ${sendData.stripe_error}`
                });
            } else {
                toast({
                  title: 'Invoice Sent',
                  description: usedFallback
                    ? 'SMS was unavailable, so the customer was emailed a working payment link.'
                    : 'Customer has been emailed with a working payment link.',
                });
            }
        } else {
            toast({ title: 'Success', description: 'Invoice saved successfully.' });
        }

        clearBuilderDraft(INVOICE_BUILDER_DRAFT_KEY, tenantId, id || 'new');

        if (!id) navigate(`/${tenantId}/crm/invoices/${invoiceId}`);
        else setInvoice(prev => ({
          ...prev,
          ...persistedInvoice,
          items: prev.items,
          public_token: persistedInvoice.public_token || publicToken,
        }));

        await refreshBillingGuard(invoice.job_id, invoiceId);

    } catch (error) {
      console.error('Save error:', error);
        toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
        setLoading(false);
    }
  };

  const downloadPdfFromBase64 = (payload) => {
    const base64 = String(payload?.content_base64 || payload?.content || '').trim();
    if (!base64) throw new Error('PDF was not returned from the server.');

    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);

    const blob = new Blob([bytes], { type: payload?.content_type || payload?.contentType || 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = payload?.filename || `invoice-${invoice?.invoice_number || id || 'download'}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleDownloadPdf = async () => {
    const invoiceId = id || invoice.id;
    if (!invoiceId) {
      toast({ variant: 'destructive', title: 'Missing invoice', description: 'Save the invoice before downloading a PDF.' });
      return;
    }

    setDownloadingPdf(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-invoice', {
        body: {
          invoice_id: invoiceId,
          return_pdf: true,
          pdf_renderer: 'html',
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.pdf) throw new Error('PDF response was empty.');

      downloadPdfFromBase64(data.pdf);
      toast({ title: 'PDF ready', description: 'Invoice PDF downloaded.' });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'PDF download failed',
        description: err?.message || 'Could not download invoice PDF.',
      });
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleSendReceipt = async () => {
    const invoiceId = id || invoice.id;
    const selectedLead = leads.find((lead) => lead.id === invoice.lead_id);
    const recipientLead = selectedLead
      ? {
          ...selectedLead,
          company: invoice.customer_name || selectedLead.company,
          email: invoice.customer_email || selectedLead.email,
          phone: invoice.customer_phone || selectedLead.phone,
        }
      : null;
    const deliveryPlan = resolveLeadDelivery({ lead: recipientLead, requestedChannel: sendChannel });

    if (!invoiceId) {
      toast({
        variant: 'destructive',
        title: 'Save invoice first',
        description: 'The invoice needs to be saved before you can send a receipt.',
      });
      return;
    }

    if ((String(invoice.status || '').toLowerCase() !== 'paid') && Number(invoice.amount_paid || 0) <= 0) {
      toast({
        variant: 'destructive',
        title: 'Invoice not paid',
        description: 'Receipts can only be sent for paid invoices.',
      });
      return;
    }

    if (!recipientLead || !deliveryPlan.channel) {
      toast({
        variant: 'destructive',
        title: 'Deliverable contact required',
        description: 'This customer needs either a valid email address or a textable phone number before you can send a receipt.',
      });
      return;
    }

    setLoading(true);
    try {
      const sendData = await sendReceiptDocument({
        invoiceId,
        lead: recipientLead,
        deliveryChannel: sendChannel,
        tenantId,
      });
      const deliveryChannel = sendData?.delivery_channel || sendChannel;
      const requestedChannel = sendData?.requested_delivery_channel || sendChannel;
      const usedFallback = requestedChannel !== deliveryChannel && requestedChannel !== 'both';

      toast({
        title: 'Receipt Sent',
        description:
          deliveryChannel === 'sms'
            ? (usedFallback
              ? 'Email was unavailable, so the receipt was texted to the customer.'
              : 'Receipt texted to the customer successfully.')
            : (usedFallback
              ? 'SMS was unavailable, so the receipt was emailed to the customer.'
              : 'Receipt emailed to the customer successfully.'),
      });
    } catch (error) {
      console.error('Receipt send failed:', error);
      toast({
        variant: 'destructive',
        title: 'Receipt Failed',
        description: error.message || 'Could not send receipt.',
      });
    } finally {
      setLoading(false);
    }
  };

  const { subtotal, taxableSubtotal, taxRate, taxAmount, total, balance } = calculateTotals();
  const usesProcessingFee = Math.abs(Number(taxRate || 0) - PROCESSING_RATE) < 0.0005;
  const taxLabel = usesProcessingFee
    ? `Card Processing (${Math.round(PROCESSING_RATE * 100)}%)`
    : `Tax (${Math.round(Math.max(Number(taxRate || 0), 0) * 100)}%)`;
  const selectedLead = leads.find((lead) => lead.id === invoice.lead_id);
  const effectiveRecipient = selectedLead
    ? {
        ...selectedLead,
        company: invoice.customer_name || selectedLead.company,
        email: invoice.customer_email || selectedLead.email,
        phone: invoice.customer_phone || selectedLead.phone,
      }
    : null;
  const deliveryPlan = resolveLeadDelivery({ lead: effectiveRecipient, requestedChannel: sendChannel });
  const canSendEmail = deliveryPlan.canEmail;
  const canSendSms = deliveryPlan.canSms;
  const deliveryPreferenceLabel = getDeliveryPreferenceLabel(selectedLead);

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-24 lg:pb-20">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
         <div className="flex items-start gap-3 sm:gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(`/${tenantId}/crm/invoices`)} className="mt-1 shrink-0"><ArrowLeft className="w-5 h-5" /></Button>
            <div className="min-w-0">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                   <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">{id ? `Invoice #${invoice.invoice_number}` : 'New Invoice'}</h1>
                   <Badge variant={invoice.status === 'paid' ? 'default' : 'secondary'} className="w-fit capitalize px-3">
                       {invoice.status}
                   </Badge>
                </div>
            </div>
         </div>
         <div className="w-full rounded-xl border bg-white p-4 shadow-sm lg:w-auto lg:min-w-[23rem]">
            <div className="space-y-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
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
              <p className="text-[11px] text-slate-500">
                {selectedLead
                  ? `${deliveryPreferenceLabel}. ${deliveryPlan.channel === 'sms' && sendChannel === 'email'
                    ? 'Email is unavailable, so sends will fall back to SMS.'
                    : deliveryPlan.channel === 'email' && sendChannel === 'sms'
                      ? 'SMS is unavailable, so sends will fall back to email.'
                      : 'Saved preference is used when available.'}`
                  : 'Select a customer to enable document delivery.'}
              </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <Button variant="outline" onClick={() => handleSave()} disabled={loading} className="w-full sm:w-auto">
                    <Save className="w-4 h-4 mr-2" /> Save Draft
                </Button>
                <Button className="w-full bg-blue-600 sm:w-auto" onClick={() => handleSave('sent')} disabled={loading}>
                    <Send className="w-4 h-4 mr-2" /> Save & Send
                </Button>
                {(id || invoice.id) && (
                  <Button variant="outline" onClick={handleDownloadPdf} disabled={loading || downloadingPdf} className="w-full sm:w-auto">
                    {downloadingPdf ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                    Download PDF
                  </Button>
                )}
                {String(invoice.status || '').toLowerCase() !== 'paid' && (
                  <Button variant="outline" onClick={openRecordPayment} disabled={loading} className="w-full sm:w-auto">
                    <DollarSign className="w-4 h-4 mr-2" /> Record Payment
                  </Button>
                )}
                {(String(invoice.status || '').toLowerCase() === 'paid' || Number(invoice.amount_paid || 0) > 0) && (
                  <Button variant="outline" onClick={handleSendReceipt} disabled={loading} className="w-full sm:w-auto">
                    <CheckCircle className="w-4 h-4 mr-2" /> Send Receipt
                  </Button>
                )}
              </div>
            </div>
         </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8">
        <div className="lg:col-span-2 space-y-6">
            <Card>
                <CardHeader><CardTitle>Details</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                        <Label>Customer</Label>
                        <Select value={invoice.lead_id} onValueChange={v => setInvoice({...invoice, lead_id: v})} disabled={Boolean(invoice.job_id || jobIdParam || quoteIdParam)}>
                            <SelectTrigger><SelectValue placeholder="Select Customer" /></SelectTrigger>
                            <SelectContent>
                                {leads.map(l => (
                                    <SelectItem key={l.id} value={l.id}>{l.first_name} {l.last_name} {l.company ? `(${l.company})` : ''}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Work Order</Label>
                        <Select
                          value={invoice.job_id || ''}
                          onValueChange={async (v) => {
                            if (id) {
                              const selectedJob = jobs.find((job) => job.id === v);
                              setInvoice((prev) => ({
                                ...prev,
                                job_id: v,
                                lead_id: prev.lead_id || selectedJob?.lead_id || '',
                                quote_id: prev.quote_id || selectedJob?.quote_id || null,
                              }));
                              await refreshBillingGuard(v, id || null);
                              return;
                            }

                            try {
                              await hydrateInvoiceFromWorkOrder(v);
                            } catch (error) {
                              toast({
                                variant: 'destructive',
                                title: 'Work order load failed',
                                description: error.message || 'Could not load work order details.',
                              });
                            }
                          }}
                        >
                            <SelectTrigger><SelectValue placeholder="Select Work Order" /></SelectTrigger>
                            <SelectContent>
                                {jobs.map((job) => (
                                  <SelectItem key={job.id} value={job.id}>
                                    {getWorkOrderLabel(job)} - {job.leads?.first_name || ''} {job.leads?.last_name || ''} ({normalizeStatus(job.status)})
                                  </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Invoice Type</Label>
                        <Select
                          value={invoice.invoice_type || 'final'}
                          onValueChange={(v) => setInvoice((prev) => ({ ...prev, invoice_type: v }))}
                        >
                            <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="deposit">Deposit</SelectItem>
                                <SelectItem value="progress">Progress</SelectItem>
                                <SelectItem value="final">Final</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                          <Label>Issue Date</Label>
                          <Input type="date" value={invoice.issue_date} onChange={e => setInvoice({...invoice, issue_date: e.target.value})} />
                      </div>
                      <div className="space-y-2">
                          <Label>Due Date</Label>
                          <Input type="date" value={invoice.due_date} onChange={e => setInvoice({...invoice, due_date: e.target.value})} />
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-4 sm:col-span-2">
                      <div>
                        <Label className="text-sm font-semibold text-slate-900">Responsible Party / Bill To</Label>
                        <p className="mt-1 text-xs text-slate-500">
                          Use this when the lead contact arranged the work but a different homeowner or payor is responsible for the invoice.
                        </p>
                      </div>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Name</Label>
                          <Input
                            value={invoice.customer_name || ''}
                            onChange={e => setInvoice((prev) => ({ ...prev, customer_name: e.target.value }))}
                            placeholder="Homeowner or responsible party"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Email</Label>
                          <Input
                            value={invoice.customer_email || ''}
                            onChange={e => setInvoice((prev) => ({ ...prev, customer_email: e.target.value }))}
                            placeholder="billing@example.com"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Phone</Label>
                        <Input
                          value={invoice.customer_phone || ''}
                          onChange={e => setInvoice((prev) => ({ ...prev, customer_phone: e.target.value }))}
                          placeholder="(321) 555-1234"
                        />
                      </div>
                    </div>
                    <div className="rounded-md border bg-slate-50 p-3 text-xs text-slate-600 space-y-1 sm:col-span-2">
                      <div className="flex justify-between"><span>Work order status</span><span className="font-medium">{billingGuard.jobStatus || 'n/a'}</span></div>
                      <div className="flex justify-between"><span>Contract total</span><span className="font-medium">${Number(billingGuard.contractTotal || 0).toFixed(2)}</span></div>
                      <div className="flex justify-between"><span>Previously billed</span><span className="font-medium">${Number(billingGuard.previouslyBilled || 0).toFixed(2)}</span></div>
                      <div className="flex justify-between"><span>Remaining before this invoice</span><span className="font-semibold">${Number(billingGuard.remainingBefore || 0).toFixed(2)}</span></div>
                    </div>
                    <div className="flex items-center space-x-2 rounded-md border bg-slate-50 p-3 sm:col-span-2">
                      <Checkbox
                        id="release-approval"
                        checked={Boolean(invoice.release_approved)}
                        onCheckedChange={(checked) =>
                          setInvoice((prev) => ({
                            ...prev,
                            release_approved: Boolean(checked),
                            release_approved_at: checked ? (prev.release_approved_at || new Date().toISOString()) : null,
                            release_approved_by: checked ? (prev.release_approved_by || user?.id || null) : null,
                          }))
                        }
                      />
                      <Label htmlFor="release-approval" className="text-sm cursor-pointer">
                        Partner approval recorded for invoice release
                      </Label>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <CardTitle>Items</CardTitle>
                    <Button size="sm" variant="outline" onClick={addItem} className="w-full sm:w-auto"><Plus className="w-4 h-4 mr-2" /> Add Item</Button>
                </CardHeader>
                <CardContent className="space-y-4 p-4 md:p-0">
                    <div className="space-y-4 md:hidden">
                        {invoice.items.length === 0 ? (
                          <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-slate-500">
                            No invoice items yet.
                          </div>
                        ) : (
                          invoice.items.map((item, idx) => (
                            <div key={idx} className="rounded-xl border bg-white p-4 shadow-sm">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="text-sm font-semibold text-slate-900">Item {idx + 1}</div>
                                  <div className="text-xs text-slate-500">Line item details</div>
                                </div>
                                <Button size="icon" variant="ghost" onClick={() => removeItem(idx)} className="text-red-500 hover:text-red-700">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>

                              <div className="mt-4 space-y-3">
                                <div className="space-y-2">
                                  <Label>Price Book</Label>
                                  <Select onValueChange={(val) => handlePriceBookSelect(idx, val)}>
                                    <SelectTrigger className="bg-slate-50 border-slate-200">
                                      <SelectValue placeholder="Select from Price Book" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {priceBook.map(pb => (
                                        <SelectItem key={pb.id} value={pb.code}>
                                          {pb.name} (${Number(pb.base_price).toFixed(2)})
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-2">
                                  <Label>Description</Label>
                                  <Input
                                    value={item.description}
                                    onChange={e => updateItem(idx, 'description', e.target.value)}
                                    placeholder="Description"
                                  />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="space-y-2">
                                    <Label>Qty</Label>
                                    <Input type="number" min="1" value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Price ($)</Label>
                                    <Input type="number" min="0" value={item.unit_price} onChange={e => updateItem(idx, 'unit_price', e.target.value)} />
                                  </div>
                                </div>
                                <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                                  <span className="text-sm text-slate-500">Line Total</span>
                                  <span className="font-semibold text-slate-900">${Number(item.total_price).toFixed(2)}</span>
                                </div>
                                <label className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                                  <span>Parts / Materials</span>
                                  <Checkbox
                                    checked={Boolean(item.is_taxable)}
                                    onCheckedChange={(checked) => updateItem(idx, 'is_taxable', Boolean(checked))}
                                    aria-label="Parts or materials item"
                                  />
                                </label>
                              </div>
                            </div>
                          ))
                        )}
                    </div>

                    <div className="hidden md:block">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[36%]">Service</TableHead>
                                <TableHead className="w-[12%]">Qty</TableHead>
                                <TableHead className="w-[18%]">Price ($)</TableHead>
                                <TableHead className="w-[18%]">Total ($)</TableHead>
                                <TableHead className="w-[10%] text-center">P/M</TableHead>
                                <TableHead className="w-[5%]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {invoice.items.map((item, idx) => (
                                <TableRow key={idx}>
                                    <TableCell>
                                        <div className="space-y-2">
                                            <Select onValueChange={(val) => handlePriceBookSelect(idx, val)}>
                                               <SelectTrigger className="h-8 text-xs bg-slate-50 border-slate-200">
                                                   <SelectValue placeholder="Select from Price Book" />
                                               </SelectTrigger>
                                               <SelectContent>
                                                  {priceBook.map(pb => (
                                                      <SelectItem key={pb.id} value={pb.code}>
                                                          {pb.name} (${Number(pb.base_price).toFixed(2)})
                                                      </SelectItem>
                                                  ))}
                                               </SelectContent>
                                            </Select>
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
                                    <TableCell className="align-top pt-5 text-center">
                                        <Checkbox
                                          checked={Boolean(item.is_taxable)}
                                          onCheckedChange={(checked) => updateItem(idx, 'is_taxable', Boolean(checked))}
                                          aria-label="Parts or materials item"
                                        />
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
        </div>

        <div className="space-y-6">
            <Card className="bg-slate-900 text-white border-none shadow-xl lg:sticky lg:top-24">
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
                    {usesProcessingFee && (
                      <div className="flex justify-between text-slate-300">
                        <span>Parts/Materials Base</span>
                        <span>${taxableSubtotal.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-slate-300">
                        <span>{taxLabel}</span>
                        <span>${taxAmount.toFixed(2)}</span>
                    </div>
                    <Separator className="bg-slate-700" />
                    <div className="flex justify-between text-lg font-bold text-white">
                        <span>Total</span>
                        <span>${total.toFixed(2)}</span>
                    </div>
                </CardContent>
            </Card>
            {id && (
              <DeliveryHistoryCard entityType="invoice" entityId={id} tenantId={tenantId} />
            )}
        </div>
      </div>
      <Dialog open={isPayModalOpen} onOpenChange={(open) => !processingPayment && setIsPayModalOpen(open)}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Record Offline Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Amount</Label>
                <Input
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  inputMode="decimal"
                  placeholder="0.00"
                  disabled={processingPayment}
                />
              </div>
              <div className="space-y-2">
                <Label>Method</Label>
                <Select value={paymentMethod || "cash"} onValueChange={setPaymentMethod} disabled={processingPayment}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="check">Check</SelectItem>
                    <SelectItem value="card">Card (manual)</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {String(paymentMethod || "").toLowerCase() === "check" && (
              <div className="space-y-2">
                <Label>Check number (optional)</Label>
                <Input
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  placeholder="e.g. 1023"
                  disabled={processingPayment}
                />
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsPayModalOpen(false)} disabled={processingPayment}>
              Cancel
            </Button>
            <Button onClick={handleRecordPayment} disabled={processingPayment}>
              {processingPayment ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <DollarSign className="mr-2 h-4 w-4" />}
              Record Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default InvoiceBuilder;


