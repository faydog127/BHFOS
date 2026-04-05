import { corsHeaders } from '../_lib/cors.ts';
import { supabaseAdmin } from '../_lib/supabaseAdmin.ts';
import { getTenantIdFromClaims, getVerifiedClaims } from '../_shared/auth.ts';
import { getDispatchAddressValidation } from '../_shared/dispatchAddress.ts';

const JOB_STATUS_ALIAS_MAP: Record<string, string> = {
  inprogress: 'in_progress',
  'in-progress': 'in_progress',
  complete: 'completed',
  done: 'completed',
  pending: 'unscheduled',
  pendingschedule: 'pending_schedule',
  'pending-schedule': 'pending_schedule',
};

const PAYMENT_STATUS_ALIAS_MAP: Record<string, string> = {
  partial_paid: 'partial',
  partially_paid: 'partial',
};

const PAYMENT_TERMS_ALIAS_MAP: Record<string, string> = {
  'due on receipt': 'DUE_ON_RECEIPT',
  due_on_receipt: 'DUE_ON_RECEIPT',
  dueuponreceipt: 'DUE_ON_RECEIPT',
  'net 7': 'NET_7',
  net7: 'NET_7',
  'net 15': 'NET_15',
  net15: 'NET_15',
  'net 30': 'NET_30',
  net30: 'NET_30',
};

const CUSTOMER_TYPE_ALIAS_MAP: Record<string, string> = {
  residential: 'residential',
  homeowner: 'residential',
  commercial: 'commercial',
  government: 'commercial',
  property_management: 'property_management',
  'property management': 'property_management',
  propertymanager: 'property_management',
  property_manager: 'property_management',
  partner: 'property_management',
};

const STATUS_TRANSITIONS: Record<string, string[]> = {
  unscheduled: ['unscheduled', 'pending_schedule', 'scheduled', 'on_hold', 'cancelled'],
  pending_schedule: ['pending_schedule', 'unscheduled', 'scheduled', 'on_hold', 'cancelled'],
  scheduled: ['scheduled', 'pending_schedule', 'en_route', 'in_progress', 'on_hold', 'cancelled', 'completed'],
  en_route: ['en_route', 'scheduled', 'in_progress', 'on_hold', 'cancelled'],
  in_progress: ['in_progress', 'on_hold', 'completed', 'cancelled'],
  on_hold: ['on_hold', 'pending_schedule', 'scheduled', 'in_progress', 'cancelled'],
  completed: ['completed'],
  cancelled: ['cancelled'],
};

const JOB_SELECT =
  'id, status, scheduled_start, scheduled_end, service_address, technician_id, payment_status, updated_at, total_amount, work_order_number, job_number, quote_id, lead_id';

const INVOICE_SELECT =
  'id, invoice_number, status, sent_at, paid_at, amount_paid, total_amount, balance_due, payment_method, job_id, quote_id, lead_id, tenant_id, customer_email, public_token';

const DAY_MS = 24 * 60 * 60 * 1000;
const GENERATED_COLUMN_RE = /column "([^"]+)" is a generated column/i;
const COLUMN_NAME_RE = /column "([^"]+)"/i;
const MISSING_COLUMN_CACHE_RE = /Could not find the '([^']+)' column/i;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const normalize = (value: unknown) => String(value ?? '').trim().toLowerCase();

const normalizeJobStatus = (value: unknown) => {
  const normalized = normalize(value);
  return JOB_STATUS_ALIAS_MAP[normalized] || normalized;
};

const normalizePaymentStatus = (value: unknown) => {
  const normalized = normalize(value);
  return PAYMENT_STATUS_ALIAS_MAP[normalized] || normalized;
};

const normalizePaymentTerms = (value: unknown) => {
  const normalized = normalize(value);
  return PAYMENT_TERMS_ALIAS_MAP[normalized] || (String(value ?? '').trim().toUpperCase() || '');
};

const normalizeCustomerTypeSnapshot = (value: unknown) => {
  const normalized = normalize(value);
  return CUSTOMER_TYPE_ALIAS_MAP[normalized] || (normalized || 'residential');
};

const defaultPaymentTermsForCustomerType = (value: unknown) => {
  const customerType = normalizeCustomerTypeSnapshot(value);
  if (customerType === 'property_management') return 'NET_30';
  if (customerType === 'commercial') return 'NET_15';
  return 'NET_7';
};

const paymentTermsDueDays = (value: unknown) => {
  switch (normalizePaymentTerms(value)) {
    case 'NET_30':
      return 30;
    case 'NET_15':
      return 15;
    case 'DUE_ON_RECEIPT':
      return 0;
    default:
      return 7;
  }
};

const paymentTermsDescription = (value: unknown) => {
  switch (normalizePaymentTerms(value)) {
    case 'NET_30':
      return 'Payment is due within 30 days.';
    case 'NET_15':
      return 'Payment is due within 15 days.';
    case 'DUE_ON_RECEIPT':
      return 'Payment is due upon receipt.';
    default:
      return 'Payment is due within 7 days.';
  }
};

const asString = (value: unknown) => String(value ?? '').trim();

const asNullableString = (value: unknown) => {
  if (value === null) return null;
  const text = asString(value);
  return text || null;
};

const asNullableNumber = (value: unknown) => {
  if (value === null) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const asIsoDate = (value: unknown) => {
  if (value === null) return null;
  const raw = asString(value);
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid date value: ${raw}`);
  }
  return parsed.toISOString();
};

const getRetriableColumnName = (error: { code?: string | null; message?: string | null; details?: string | null }) => {
  const code = String(error?.code || '');
  if (code === '428C9') {
    const detailMatch = String(error?.details || '').match(GENERATED_COLUMN_RE);
    if (detailMatch?.[1]) return detailMatch[1];
  }

  if (code === '42703' || code === 'PGRST204') {
    const messageMatch = String(error?.message || '').match(COLUMN_NAME_RE);
    if (messageMatch?.[1]) return messageMatch[1];

    const cacheMatch = String(error?.message || '').match(MISSING_COLUMN_CACHE_RE);
    if (cacheMatch?.[1]) return cacheMatch[1];
  }

  return null;
};

const dateOnlyFromNow = (days = 0) => new Date(Date.now() + (days * DAY_MS)).toISOString().slice(0, 10);

const randomInvoiceNumber = () => String(Math.floor(100000 + Math.random() * 900000));

const normalizeInvoiceItems = (items: Array<Record<string, unknown>>) =>
  items
    .map((item) => {
      const quantity = asNullableNumber(item.quantity) ?? 1;
      const unitPrice = asNullableNumber(item.unit_price) ?? 0;
      const totalPrice = asNullableNumber(item.total_price) ?? (quantity * unitPrice);
      return {
        description: asNullableString(item.description) || 'Work order item',
        quantity,
        unit_price: unitPrice,
        total_price: totalPrice,
      };
    })
    .filter((item) => item.total_price > 0);

const loadJobItems = async (jobId: string) => {
  const { data, error } = await supabaseAdmin
    .from('job_items')
    .select('description, quantity, unit_price, total_price')
    .eq('job_id', jobId);

  if (error) {
    console.warn('work-order-update job_items unavailable:', error.message || error);
    return [];
  }

  return normalizeInvoiceItems(Array.isArray(data) ? (data as Array<Record<string, unknown>>) : []);
};

const loadQuoteItems = async (quoteId: string | null, tenantId: string) => {
  if (!quoteId) return [];

  const { data, error } = await supabaseAdmin
    .from('quotes')
    .select('line_items, quote_items(description, quantity, unit_price, total_price)')
    .eq('tenant_id', tenantId)
    .eq('id', quoteId)
    .maybeSingle();

  if (error) {
    console.warn('work-order-update quote item hydrate failed:', error.message || error);
    return [];
  }

  const row = (data || {}) as Record<string, unknown>;
  const relationalItems = Array.isArray(row.quote_items) ? (row.quote_items as Array<Record<string, unknown>>) : [];
  if (relationalItems.length > 0) {
    return normalizeInvoiceItems(relationalItems);
  }

  const jsonItems = Array.isArray(row.line_items) ? (row.line_items as Array<Record<string, unknown>>) : [];
  return normalizeInvoiceItems(jsonItems);
};

const loadLeadEmail = async (leadId: string | null, tenantId: string) => {
  if (!leadId) return '';

  const { data, error } = await supabaseAdmin
    .from('leads')
    .select('email')
    .eq('tenant_id', tenantId)
    .eq('id', leadId)
    .maybeSingle();

  if (error) {
    console.warn('work-order-update lead email lookup failed:', error.message || error);
    return '';
  }

  return asString((data as Record<string, unknown> | null)?.email);
};

const loadLeadCustomerType = async (leadId: string | null, tenantId: string) => {
  if (!leadId) return 'residential';

  const { data, error } = await supabaseAdmin
    .from('leads')
    .select('customer_type')
    .eq('tenant_id', tenantId)
    .eq('id', leadId)
    .maybeSingle();

  if (error) {
    console.warn('work-order-update lead customer type lookup failed:', error.message || error);
    return 'residential';
  }

  return normalizeCustomerTypeSnapshot((data as Record<string, unknown> | null)?.customer_type);
};

const validateStatusTransition = (currentStatus: unknown, nextStatus: unknown) => {
  const current = normalizeJobStatus(currentStatus);
  const next = normalizeJobStatus(nextStatus);
  const allowedNext = STATUS_TRANSITIONS[current];

  if (!current || !next) return;
  if (!allowedNext) return;
  if (!allowedNext.includes(next)) {
    throw new Error(`Invalid work order transition: ${current} -> ${next}`);
  }
};

const fetchInvoiceById = async (invoiceId: string, tenantId: string) => {
  const { data } = await supabaseAdmin
    .from('invoices')
    .select(INVOICE_SELECT)
    .eq('tenant_id', tenantId)
    .eq('id', invoiceId)
    .maybeSingle();

  return data ?? null;
};

const fetchExistingInvoice = async (jobId: string, tenantId: string) => {
  const { data, error } = await supabaseAdmin
    .from('invoices')
    .select(INVOICE_SELECT)
    .eq('tenant_id', tenantId)
    .eq('job_id', jobId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || 'Unable to load existing invoice.');
  }

  return data ?? null;
};

const insertInvoiceRow = async (patch: Record<string, unknown>) => {
  let nextPatch = { ...patch };

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data, error } = await supabaseAdmin
      .from('invoices')
      .insert(nextPatch)
      .select(INVOICE_SELECT)
      .single();

    if (!error && data) return data;
    if (!error && !data) {
      throw new Error('Invoice insert returned no row.');
    }

    const retriableColumn = getRetriableColumnName(error);
    if (!retriableColumn || !Object.prototype.hasOwnProperty.call(nextPatch, retriableColumn)) {
      throw new Error(error.message || 'Failed to create invoice.');
    }

    delete nextPatch[retriableColumn];
  }

  throw new Error('Failed to create invoice after removing incompatible columns.');
};

const updateInvoiceRow = async (invoiceId: string, tenantId: string, patch: Record<string, unknown>) => {
  let nextPatch = { ...patch };

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const { data, error } = await supabaseAdmin
      .from('invoices')
      .update(nextPatch)
      .eq('id', invoiceId)
      .eq('tenant_id', tenantId)
      .select(INVOICE_SELECT)
      .maybeSingle();

    if (!error) return { data, error: null };

    const retriableColumn = getRetriableColumnName(error);
    if (!retriableColumn || !Object.prototype.hasOwnProperty.call(nextPatch, retriableColumn)) {
      return { data: null, error };
    }

    delete nextPatch[retriableColumn];
  }

  return {
    data: null,
    error: { message: 'Failed to update invoice after removing incompatible columns.' },
  };
};

const updateJobRow = async (jobId: string, tenantId: string, patch: Record<string, unknown>) => {
  let nextPatch = { ...patch };

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const { data, error } = await supabaseAdmin
      .from('jobs')
      .update(nextPatch)
      .eq('id', jobId)
      .eq('tenant_id', tenantId)
      .select(JOB_SELECT)
      .maybeSingle();

    if (!error) return { data, error: null };

    const retriableColumn = getRetriableColumnName(error);
    if (!retriableColumn || !Object.prototype.hasOwnProperty.call(nextPatch, retriableColumn)) {
      return { data: null, error };
    }

    delete nextPatch[retriableColumn];
  }

  return {
    data: null,
    error: { message: 'Failed to update work order after removing incompatible columns.' },
  };
};

const findSchedulingConflict = async (
  jobId: string,
  tenantId: string,
  technicianId: string | null,
  scheduledStart: string | null,
  scheduledEnd: string | null,
) => {
  if (!technicianId || !scheduledStart || !scheduledEnd) {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from('jobs')
    .select('id, work_order_number, scheduled_start, scheduled_end, service_address, status')
    .eq('tenant_id', tenantId)
    .eq('technician_id', technicianId)
    .neq('id', jobId)
    .not('scheduled_start', 'is', null)
    .not('scheduled_end', 'is', null)
    .in('status', ['scheduled', 'en_route', 'in_progress', 'on_hold']);

  if (error) {
    throw error;
  }

  const nextStart = new Date(scheduledStart).getTime();
  const nextEnd = new Date(scheduledEnd).getTime();

  return (data || []).find((row) => {
    const existingStart = new Date(String(row.scheduled_start)).getTime();
    const existingEnd = new Date(String(row.scheduled_end)).getTime();
    return existingStart < nextEnd && existingEnd > nextStart;
  }) || null;
};

const createInvoiceForCompletedJob = async (job: Record<string, unknown>, tenantId: string) => {
  const leadId = asNullableString(job.lead_id);
  const quoteId = asNullableString(job.quote_id);
  const customerType =
    normalizeCustomerTypeSnapshot(job.customer_type_snapshot) ||
    await loadLeadCustomerType(leadId, tenantId);
  const paymentTerms =
    normalizePaymentTerms(job.payment_terms) ||
    defaultPaymentTermsForCustomerType(customerType);
  const dueDays = paymentTermsDueDays(paymentTerms);
  const workOrderLabel =
    asNullableString(job.work_order_number) ||
    asNullableString(job.job_number) ||
    asNullableString(job.id) ||
    'completed work order';

  const [jobItems, recipientEmail] = await Promise.all([
    loadJobItems(asString(job.id)),
    loadLeadEmail(leadId, tenantId),
  ]);

  const invoiceItems = jobItems.length > 0 ? jobItems : await loadQuoteItems(quoteId, tenantId);
  const subtotalFromItems = invoiceItems.reduce((sum, item) => sum + (item.total_price || 0), 0);
  const contractTotal = asNullableNumber(job.total_amount) ?? subtotalFromItems;
  const subtotal = subtotalFromItems > 0 ? subtotalFromItems : contractTotal;
  const taxAmount = Math.max(contractTotal - subtotal, 0);
  const totalAmount = subtotal + taxAmount;
  const nowIso = new Date().toISOString();

  const invoiceInsert: Record<string, unknown> = {
    tenant_id: tenantId,
    lead_id: leadId,
    quote_id: quoteId,
    job_id: asString(job.id),
    invoice_number: randomInvoiceNumber(),
    status: 'draft',
    subtotal,
    tax_amount: taxAmount,
    total_amount: totalAmount,
    amount_paid: 0,
    balance_due: totalAmount,
    issue_date: dateOnlyFromNow(0),
    due_date: dateOnlyFromNow(dueDays),
    notes: `Generated automatically from ${workOrderLabel}.`,
    terms: paymentTermsDescription(paymentTerms),
    customer_email: recipientEmail || null,
    created_at: nowIso,
    updated_at: nowIso,
  };

  const invoice = await insertInvoiceRow(invoiceInsert);

  if (invoiceItems.length > 0) {
    const lineRows = invoiceItems.map((item) => ({
      invoice_id: invoice.id,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: item.total_price,
    }));

    const { error: itemsError } = await supabaseAdmin.from('invoice_items').insert(lineRows);
    if (itemsError) {
      throw new Error(itemsError.message || 'Failed to create invoice line items.');
    }
  }

  return { invoice, recipientEmail };
};

const ensureInvoiceForCompletedJob = async (job: Record<string, unknown>, tenantId: string) => {
  const existingInvoice = await fetchExistingInvoice(asString(job.id), tenantId);

  if (existingInvoice?.id) {
    return {
      invoice: existingInvoice,
      created: false,
      sent: false,
      skipped: existingInvoice.sent_at ? 'already_sent' : 'draft_exists',
    };
  }

  const created = await createInvoiceForCompletedJob(job, tenantId);
  const refreshed = await fetchInvoiceById(created.invoice.id, tenantId);

  return {
    invoice: refreshed || created.invoice,
    created: true,
    sent: false,
    recipient_email: created.recipientEmail || null,
    skipped: 'draft_created',
  };
};

const syncInvoiceForPayment = async (params: {
  job: Record<string, unknown>;
  tenantId: string;
  requestedPaymentStatus?: string | null;
  amountPaid?: number | null;
  paymentMethod?: string | null;
}) => {
  let invoice = await fetchExistingInvoice(asString(params.job.id), params.tenantId);
  let created = false;

  if (!invoice?.id) {
    const ensured = await ensureInvoiceForCompletedJob(params.job, params.tenantId);
    invoice = ensured.invoice ?? null;
    created = Boolean(ensured.created);
  }

  if (!invoice?.id) {
    throw new Error('Could not create or load invoice for payment sync.');
  }

  const normalizedRequestedStatus = normalizePaymentStatus(params.requestedPaymentStatus);
  const invoiceTotal =
    asNullableNumber((invoice as Record<string, unknown>).total_amount) ??
    asNullableNumber(params.job.total_amount) ??
    0;
  const existingAmountPaid = asNullableNumber((invoice as Record<string, unknown>).amount_paid) ?? 0;
  const resolvedAmountPaid = params.amountPaid ?? existingAmountPaid;
  const hasPositivePayment = resolvedAmountPaid > 0;
  const isFullPayment =
    normalizedRequestedStatus === 'paid' &&
    !hasPositivePayment
      ? true
      : hasPositivePayment && (invoiceTotal <= 0 || resolvedAmountPaid >= invoiceTotal - 0.009);

  let nextInvoiceStatus = asString((invoice as Record<string, unknown>).status).toLowerCase() || 'draft';
  if (isFullPayment) {
    nextInvoiceStatus = 'paid';
  } else if (hasPositivePayment || normalizedRequestedStatus === 'partial') {
    nextInvoiceStatus = 'partial';
  }

  const nowIso = new Date().toISOString();
  // Some production guardrails block draft -> paid directly. Move through sent first.
  const currentInvoiceStatus = asString((invoice as Record<string, unknown>).status).toLowerCase() || 'draft';
  if (currentInvoiceStatus === 'draft' && (nextInvoiceStatus === 'paid' || nextInvoiceStatus === 'partial')) {
    const sentPatch: Record<string, unknown> = {
      status: 'sent',
      sent_at: asNullableString((invoice as Record<string, unknown>).sent_at) || nowIso,
      release_approved: true,
      release_approved_at: nowIso,
      release_approved_by: null,
      updated_at: nowIso,
    };

    const sentResult = await updateInvoiceRow(asString(invoice.id), params.tenantId, sentPatch);
    if (sentResult.error) {
      throw new Error(sentResult.error?.message || 'Failed to move invoice to sent before payment.');
    }
    if (sentResult.data) {
      invoice = sentResult.data;
    }
  }
  const invoicePatch: Record<string, unknown> = {
    status: nextInvoiceStatus,
    amount_paid: isFullPayment && !hasPositivePayment ? invoiceTotal : resolvedAmountPaid,
    updated_at: nowIso,
  };

  if (params.paymentMethod) {
    invoicePatch.payment_method = params.paymentMethod;
  }

  if (nextInvoiceStatus === 'paid') {
    invoicePatch.paid_at = asNullableString((invoice as Record<string, unknown>).paid_at) || nowIso;
    invoicePatch.balance_due = 0;
  } else if (resolvedAmountPaid > 0) {
    invoicePatch.balance_due = Math.max(invoiceTotal - resolvedAmountPaid, 0);
  }

  const { data, error } = await updateInvoiceRow(asString(invoice.id), params.tenantId, invoicePatch);

  if (error || !data) {
    throw new Error(error?.message || 'Failed to sync invoice payment state.');
  }

  return {
    invoice: data,
    created,
    sent: false,
    skipped: nextInvoiceStatus === 'paid' ? 'payment_recorded' : 'partial_payment_recorded',
  };
};

const buildPatch = (input: Record<string, unknown>) => {
  const patch: Record<string, unknown> = {};

  // Payment writes are invoice-owned. Blocking these fields prevents competing money-state writers.
  if (
    Object.prototype.hasOwnProperty.call(input, 'payment_status') ||
    Object.prototype.hasOwnProperty.call(input, 'amount_paid') ||
    Object.prototype.hasOwnProperty.call(input, 'payment_method')
  ) {
    throw new Error('Payment updates must be recorded on the invoice (use invoice-update-status with payment_amount).');
  }

  if ('status' in input) {
    const status = normalizeJobStatus(input.status);
    if (!status) throw new Error('Status cannot be empty.');
    patch.status = status;
    if (status === 'completed' && !('completed_at' in input)) {
      patch.completed_at = new Date().toISOString();
    }
  }

  if ('scheduled_start' in input) patch.scheduled_start = asIsoDate(input.scheduled_start);
  if ('scheduled_end' in input) patch.scheduled_end = asIsoDate(input.scheduled_end);
  if ('completed_at' in input) patch.completed_at = asIsoDate(input.completed_at);
  if ('updated_at' in input) patch.updated_at = asIsoDate(input.updated_at) || new Date().toISOString();

  if ('service_address' in input) patch.service_address = asNullableString(input.service_address);
  if ('technician_id' in input) patch.technician_id = asNullableString(input.technician_id);
  if ('technician_notes' in input) patch.technician_notes = asNullableString(input.technician_notes);
  if ('signature_url' in input) patch.signature_url = asNullableString(input.signature_url);
  if ('payment_terms' in input) {
    const paymentTerms = normalizePaymentTerms(input.payment_terms);
    if (!paymentTerms) throw new Error('Payment terms cannot be empty.');
    patch.payment_terms = paymentTerms;
  }
  if ('customer_type_snapshot' in input) {
    patch.customer_type_snapshot = normalizeCustomerTypeSnapshot(input.customer_type_snapshot);
  }

  if ('satisfaction_rating' in input) patch.satisfaction_rating = asNullableNumber(input.satisfaction_rating);

  if ('photos_json' in input) patch.photos_json = input.photos_json ?? null;

  if (!('updated_at' in patch)) {
    patch.updated_at = new Date().toISOString();
  }

  if (Object.keys(patch).length === 0) {
    throw new Error('No supported work order fields were provided.');
  }

  return patch;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    const { claims } = await getVerifiedClaims(req);
    const jwtTenantId = getTenantIdFromClaims(claims);
    if (!jwtTenantId) {
      return json({ error: 'Unauthorized: missing tenant claim' }, 403);
    }

    const body = await req.json();
    const jobId = asString(body?.job_id);
    const requestedTenantId = asString(body?.tenant_id);
    const patchInput = body?.patch;

    if (!jobId) {
      return json({ error: 'Missing job_id' }, 400);
    }
    if (!requestedTenantId) {
      return json({ error: 'Missing tenant_id' }, 400);
    }
    if (requestedTenantId !== jwtTenantId) {
      return json({ error: 'Tenant mismatch' }, 403);
    }
    if (!patchInput || typeof patchInput !== 'object' || Array.isArray(patchInput)) {
      return json({ error: 'Invalid patch payload' }, 400);
    }

    const requestedPaymentStatus = Object.prototype.hasOwnProperty.call(patchInput, 'payment_status')
      ? normalizePaymentStatus((patchInput as Record<string, unknown>).payment_status)
      : null;
    const requestedAmountPaid = Object.prototype.hasOwnProperty.call(patchInput, 'amount_paid')
      ? asNullableNumber((patchInput as Record<string, unknown>).amount_paid)
      : null;
    const requestedPaymentMethod = Object.prototype.hasOwnProperty.call(patchInput, 'payment_method')
      ? asNullableString((patchInput as Record<string, unknown>).payment_method)
      : null;

    const { data: existingJob, error: existingJobError } = await supabaseAdmin
      .from('jobs')
      .select('id, status, lead_id, quote_id, total_amount, work_order_number, job_number, scheduled_start, scheduled_end, service_address, technician_id')
      .eq('id', jobId)
      .eq('tenant_id', jwtTenantId)
      .maybeSingle();

    if (existingJobError) {
      console.error('work-order-update prefetch failed:', existingJobError);
      return json({ error: existingJobError.message }, 500);
    }

    if (!existingJob) {
      return json({ error: 'Work order not found' }, 404);
    }

    const patch = buildPatch(patchInput as Record<string, unknown>);
    const mergedJob = { ...existingJob, ...patch };
    const nextStatus = normalizeJobStatus((patch as Record<string, unknown>).status || existingJob.status);

    validateStatusTransition(existingJob.status, nextStatus);

    if (nextStatus === 'scheduled' || nextStatus === 'en_route' || nextStatus === 'in_progress') {
      if (!asNullableString(mergedJob.scheduled_start)) {
        return json({ error: 'Scheduled start is required before dispatching this work order.' }, 400);
      }
      const addressValidation = getDispatchAddressValidation(mergedJob.service_address);
      if (!addressValidation.hasDispatchableAddress) {
        return json({ error: 'Service address must include street, city, and state before dispatching this work order.' }, 400);
      }
    }

    const schedulingConflict = await findSchedulingConflict(
      jobId,
      jwtTenantId,
      asNullableString(mergedJob.technician_id),
      asNullableString(mergedJob.scheduled_start),
      asNullableString(mergedJob.scheduled_end),
    );

    if (schedulingConflict) {
      return json({
        error: `Scheduling conflict with ${asString(schedulingConflict.work_order_number) || 'another work order'} (${asString(schedulingConflict.status) || 'scheduled'}).`,
        conflict: schedulingConflict,
      }, 409);
    }

    if (!asNullableString(mergedJob.customer_type_snapshot)) {
      patch.customer_type_snapshot = await loadLeadCustomerType(asNullableString(existingJob.lead_id), jwtTenantId);
    }

    if (!asNullableString(mergedJob.payment_terms)) {
      patch.payment_terms = defaultPaymentTermsForCustomerType(
        (patch as Record<string, unknown>).customer_type_snapshot || existingJob.customer_type_snapshot,
      );
    }

    const { data, error } = await updateJobRow(jobId, jwtTenantId, patch);

    if (error) {
      console.error('work-order-update failed:', error);
      return json({ error: error.message }, 500);
    }

    if (!data) {
      return json({ error: 'Work order not found' }, 404);
    }

    let invoiceResult: Record<string, unknown> | null = null;
    const jobForInvoice = { ...existingJob, ...data, tenant_id: jwtTenantId };

    if (nextStatus === 'completed') {
      try {
        invoiceResult = await ensureInvoiceForCompletedJob(
          jobForInvoice,
          jwtTenantId,
        );
      } catch (invoiceError) {
        console.error('work-order-update invoice flow failed:', invoiceError);
        invoiceResult = {
          error: invoiceError instanceof Error ? invoiceError.message : 'Invoice flow failed.',
        };
      }
    }

    if (requestedPaymentStatus || requestedAmountPaid !== null) {
      try {
        const paymentInvoiceResult = await syncInvoiceForPayment({
          job: jobForInvoice,
          tenantId: jwtTenantId,
          requestedPaymentStatus,
          amountPaid: requestedAmountPaid,
          paymentMethod: requestedPaymentMethod,
        });

        invoiceResult = {
          ...(invoiceResult || {}),
          ...paymentInvoiceResult,
          invoice: paymentInvoiceResult.invoice,
        };
      } catch (invoiceError) {
        console.error('work-order-update payment invoice sync failed:', invoiceError);
        invoiceResult = {
          ...(invoiceResult || {}),
          error: invoiceError instanceof Error ? invoiceError.message : 'Payment invoice sync failed.',
        };
      }
    }

    return json({
      job: data,
      invoice: invoiceResult?.invoice ?? null,
      invoice_result: invoiceResult,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return json({ error: message }, 500);
  }
});

