import { supabaseAdmin } from '../_lib/supabaseAdmin.ts';
import { getTenantIdFromClaims, getVerifiedClaims } from '../_shared/auth.ts';
import { buildCorsHeaders, readJson } from '../_shared/publicUtils.ts';

type KanbanItem = {
  tenant_id: string;
  entity_type: 'lead' | 'quote' | 'job' | 'invoice';
  entity_id: string;
  column_key: string;
  status: string | null;
  title: string;
  subtitle?: string | null;
  amount?: number | null;
  sort_ts: string;
  created_at: string | null;
  updated_at: string | null;
  related: {
    lead_id?: string | null;
    quote_id?: string | null;
    job_id?: string | null;
    invoice_id?: string | null;
  };
};

const respondJson = (body: Record<string, unknown>, status: number, headers: Record<string, string>) => {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
};

const normalizeStatus = (value: unknown) => String(value ?? '').toLowerCase().trim();

const leadColumnKey = (statusRaw: unknown) => {
  const status = normalizeStatus(statusRaw);

  if (!status || status === 'new') return 'lead_new';
  if (['contacted', 'working', 'attempted_contact'].includes(status)) return 'lead_contacted';
  if (['qualified', 'scheduled'].includes(status)) return 'lead_qualified';
  if (['converted', 'archived', 'lost', 'junk'].includes(status)) return null;
  return 'lead_new';
};

const quoteColumnKey = (statusRaw: unknown) => {
  const status = normalizeStatus(statusRaw);

  if (!status || status === 'draft') return 'quote_draft';
  if (['sent', 'quote_sending', 'quote_send_failed', 'sending', 'send_failed'].includes(status)) return 'quote_sent';
  if (status === 'viewed') return 'quote_viewed';
  if (['accepted', 'approved'].includes(status)) return 'quote_accepted';
  if (['converted', 'archived'].includes(status)) return null;
  if (['rejected', 'declined'].includes(status)) return null;
  return 'quote_draft';
};

const jobColumnKey = (statusRaw: unknown) => {
  const status = normalizeStatus(statusRaw);

  if (!status || ['scheduled', 'in_progress', 'pending'].includes(status)) return 'job_scheduled';
  if (status === 'completed') return 'job_completed';
  if (['invoiced', 'archived'].includes(status)) return null;
  return 'job_scheduled';
};

const invoiceColumnKey = (statusRaw: unknown) => {
  const status = normalizeStatus(statusRaw);

  if (status === 'paid') return 'invoice_paid';
  return 'invoice_open';
};

const toIso = (value: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
};

const pickSortTs = (...values: Array<string | null | undefined>) => {
  for (const value of values) {
    const iso = toIso(value ?? null);
    if (iso) return iso;
  }
  return new Date().toISOString();
};

const formatTracking = (value: unknown) => {
  const raw = String(value ?? '').trim();
  return raw ? raw.toUpperCase() : null;
};

const buildLeadTitle = (lead: Record<string, unknown>) => {
  const company = String(lead.company ?? '').trim();
  const first = String(lead.first_name ?? '').trim();
  const last = String(lead.last_name ?? '').trim();
  const fullName = [first, last].filter(Boolean).join(' ').trim();
  return company || fullName || 'Unnamed Lead';
};

const buildLeadSubtitle = (lead: Record<string, unknown>) => {
  const company = String(lead.company ?? '').trim();
  const first = String(lead.first_name ?? '').trim();
  const last = String(lead.last_name ?? '').trim();
  const fullName = [first, last].filter(Boolean).join(' ').trim();
  const email = String(lead.email ?? '').trim();
  const phone = String(lead.phone ?? '').trim();

  if (company && fullName) return fullName;
  return email || phone || company || fullName || null;
};

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const cors = buildCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors.headers });
  }

  if (req.method !== 'POST') {
    return respondJson({ error: 'Method not allowed' }, 405, cors.headers);
  }

  let claims;
  try {
    ({ claims } = await getVerifiedClaims(req));
  } catch (error) {
    return respondJson({ error: String(error?.message ?? error) }, 401, cors.headers);
  }

  const body = await readJson(req);
  const bodyTenantId = body?.tenant_id ?? null;
  const jwtTenantId = getTenantIdFromClaims(claims);

  if (!jwtTenantId) {
    return respondJson({ error: 'Unauthorized: missing tenant claim' }, 403, cors.headers);
  }

  if (bodyTenantId && bodyTenantId !== jwtTenantId) {
    return respondJson({ error: 'Tenant mismatch' }, 403, cors.headers);
  }

  const [leadsRes, quotesRes, jobsRes, invoicesRes] = await Promise.all([
    supabaseAdmin
      .from('leads')
      .select('id, tenant_id, status, pipeline_stage, first_name, last_name, company, email, phone, created_at')
      .eq('tenant_id', jwtTenantId),
    supabaseAdmin
      .from('quotes')
      .select(
        'id, tenant_id, status, lead_id, quote_number, total_amount, public_token, sent_at, updated_at, created_at, leads(first_name, last_name, company)'
      )
      .eq('tenant_id', jwtTenantId),
    supabaseAdmin
      .from('jobs')
      .select(
        'id, tenant_id, status, lead_id, quote_id, job_number, total_amount, scheduled_start, updated_at, created_at, leads(first_name, last_name, company)'
      )
      .eq('tenant_id', jwtTenantId),
    supabaseAdmin
      .from('invoices')
      .select(
        'id, tenant_id, status, lead_id, quote_id, job_id, invoice_number, total_amount, paid_at, sent_at, updated_at, created_at, leads(first_name, last_name, company)'
      )
      .eq('tenant_id', jwtTenantId),
  ]);

  const errors = [leadsRes.error, quotesRes.error, jobsRes.error, invoicesRes.error].filter(Boolean);
  if (errors.length) {
    return respondJson({ error: errors[0]?.message || 'Failed to load board data' }, 500, cors.headers);
  }

  const items: KanbanItem[] = [];
  const quotedLeadIds = new Set((quotesRes.data ?? []).map((quote) => quote.lead_id).filter(Boolean));
  const jobLeadIds = new Set((jobsRes.data ?? []).map((job) => job.lead_id).filter(Boolean));
  const invoiceLeadIds = new Set((invoicesRes.data ?? []).map((invoice) => invoice.lead_id).filter(Boolean));

  for (const lead of leadsRes.data ?? []) {
    if (quotedLeadIds.has(lead.id) || jobLeadIds.has(lead.id) || invoiceLeadIds.has(lead.id)) {
      continue;
    }

    const leadStage = lead.pipeline_stage ?? lead.status;
    const columnKey = leadColumnKey(leadStage);
    if (!columnKey) continue;

    items.push({
      tenant_id: lead.tenant_id,
      entity_type: 'lead',
      entity_id: lead.id,
      column_key: columnKey,
      status: leadStage ?? null,
      title: buildLeadTitle(lead),
      subtitle: buildLeadSubtitle(lead),
      amount: null,
      sort_ts: pickSortTs(lead.created_at),
      created_at: lead.created_at ?? null,
      updated_at: lead.created_at ?? null,
      related: { lead_id: lead.id },
    });
  }

  for (const quote of quotesRes.data ?? []) {
    const columnKey = quoteColumnKey(quote.status);
    if (!columnKey) continue;

    const leadInfo = quote.leads ?? {};
    const title = buildLeadTitle(leadInfo);
    const quoteNumber = formatTracking(quote.quote_number);
    const subtitle = quoteNumber ? `Quote #${quoteNumber}` : null;

    items.push({
      tenant_id: quote.tenant_id,
      entity_type: 'quote',
      entity_id: quote.id,
      column_key: columnKey,
      status: quote.status ?? null,
      title,
      subtitle,
      amount: typeof quote.total_amount === 'number' ? quote.total_amount : null,
      sort_ts: pickSortTs(quote.sent_at, quote.updated_at, quote.created_at),
      created_at: quote.created_at ?? null,
      updated_at: quote.updated_at ?? quote.created_at ?? null,
      related: { lead_id: quote.lead_id ?? null, quote_id: quote.id },
    });
  }

  for (const job of jobsRes.data ?? []) {
    const columnKey = jobColumnKey(job.status);
    if (!columnKey) continue;

    const leadInfo = job.leads ?? {};
    const title = buildLeadTitle(leadInfo);
    const jobNumber = formatTracking(job.job_number);
    const subtitle = jobNumber ? `Job #${jobNumber}` : null;

    items.push({
      tenant_id: job.tenant_id,
      entity_type: 'job',
      entity_id: job.id,
      column_key: columnKey,
      status: job.status ?? null,
      title,
      subtitle,
      amount: typeof job.total_amount === 'number' ? job.total_amount : null,
      sort_ts: pickSortTs(job.scheduled_start, job.updated_at, job.created_at),
      created_at: job.created_at ?? null,
      updated_at: job.updated_at ?? job.created_at ?? null,
      related: { lead_id: job.lead_id ?? null, quote_id: job.quote_id ?? null, job_id: job.id },
    });
  }

  for (const invoice of invoicesRes.data ?? []) {
    const columnKey = invoiceColumnKey(invoice.status);
    if (!columnKey) continue;

    const leadInfo = invoice.leads ?? {};
    const title = buildLeadTitle(leadInfo);
    const invoiceNumber = formatTracking(invoice.invoice_number);
    const subtitle = invoiceNumber ? `Invoice #${invoiceNumber}` : null;

    items.push({
      tenant_id: invoice.tenant_id,
      entity_type: 'invoice',
      entity_id: invoice.id,
      column_key: columnKey,
      status: invoice.status ?? null,
      title,
      subtitle,
      amount: typeof invoice.total_amount === 'number' ? invoice.total_amount : null,
      sort_ts: pickSortTs(invoice.paid_at, invoice.sent_at, invoice.updated_at, invoice.created_at),
      created_at: invoice.created_at ?? null,
      updated_at: invoice.updated_at ?? invoice.created_at ?? null,
      related: {
        lead_id: invoice.lead_id ?? null,
        quote_id: invoice.quote_id ?? null,
        job_id: invoice.job_id ?? null,
        invoice_id: invoice.id,
      },
    });
  }

  return respondJson({ items }, 200, cors.headers);
});
