function parseEnv(content: string) {
  const out: Record<string, string> = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    out[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
  }
  return out;
}

async function maybeRead(path: string) {
  try {
    return await Deno.readTextFile(path);
  } catch {
    return '';
  }
}

const env = {
  ...parseEnv(await maybeRead('.env')),
  ...parseEnv(await maybeRead('.env.local')),
};

for (const [key, value] of Object.entries(env)) {
  if (value) Deno.env.set(key, value);
}

Deno.env.set('EMAIL_DELIVERY_MODE', 'mock');
Deno.env.set('SMS_DELIVERY_MODE', 'mock');
if (!Deno.env.get('RESEND_API_KEY')) {
  Deno.env.set('RESEND_API_KEY', 'mock-resend-key');
}

const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const TENANT_ID = 'tvg';

if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const authHeaders = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

const restHeaders = {
  ...authHeaders,
  Prefer: 'return=representation',
};

const fetchJson = async (input: string, init: RequestInit) => {
  const response = await fetch(input, init);
  const json = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${JSON.stringify(json)}`);
  }
  return json;
};

const extractMissingColumn = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  const singleQuoteMatch = message.match(/'([a-zA-Z0-9_]+)' column/);
  if (singleQuoteMatch?.[1]) return singleQuoteMatch[1];
  const doubleQuoteMatch = message.match(/column "([^"]+)"/i);
  if (doubleQuoteMatch?.[1]) return doubleQuoteMatch[1];
  return null;
};

const insertRowWithFallback = async (table: string, payload: Record<string, unknown>) => {
  const nextPayload = { ...payload };

  while (true) {
    try {
      return await fetchJson(`${SUPABASE_URL}/rest/v1/${table}?select=id`, {
        method: 'POST',
        headers: restHeaders,
        body: JSON.stringify(nextPayload),
      });
    } catch (error) {
      const missingColumn = extractMissingColumn(error);
      if (!missingColumn || !Object.prototype.hasOwnProperty.call(nextPayload, missingColumn)) {
        throw error;
      }
      delete nextPayload[missingColumn];
    }
  }
};

const createdLeadIds: string[] = [];
const createdQuoteIds: string[] = [];
const createdJobIds: string[] = [];
const createdInvoiceIds: string[] = [];

const SUBTOTAL = 199;
const TAX_AMOUNT = 13.93;
const TOTAL_AMOUNT = 212.93;
const SERVICE_ADDRESS = '123 Test St, Orlando, FL 32801';

const createLead = async (params: { email?: string | null; phone?: string | null }) => {
  const rows = await insertRowWithFallback('leads', {
    tenant_id: TENANT_ID,
    first_name: 'Matrix',
    last_name: crypto.randomUUID().slice(0, 8),
    email: params.email ?? null,
    phone: params.phone ?? null,
    service: 'Dryer Vent Cleaning',
    status: 'qualified',
    stage: 'proposal',
  });
  const leadId = rows?.[0]?.id;
  if (!leadId) throw new Error('Failed to create lead');
  createdLeadIds.push(leadId);
  return leadId;
};

const createQuote = async (leadId: string) => {
  const quoteRows = await insertRowWithFallback('quotes', {
    tenant_id: TENANT_ID,
    lead_id: leadId,
    quote_number: Math.floor(Date.now() / 1000) + Math.floor(Math.random() * 1000),
    status: 'draft',
    subtotal: SUBTOTAL,
    tax_amount: TAX_AMOUNT,
    total_amount: TOTAL_AMOUNT,
    valid_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    public_token: crypto.randomUUID(),
    service_address: SERVICE_ADDRESS,
    line_items: [
      {
        description: 'Dryer Vent Cleaning',
        quantity: 1,
        unit_price: SUBTOTAL,
        total_price: SUBTOTAL,
        estimated_labor: 80,
        estimated_material: 20,
        estimated_equipment: 10,
        total_estimated_cost: 110,
      },
    ],
  });
  const quoteId = quoteRows?.[0]?.id;
  if (!quoteId) throw new Error('Failed to create quote');
  createdQuoteIds.push(quoteId);

  await fetchJson(`${SUPABASE_URL}/rest/v1/quote_items?select=id`, {
    method: 'POST',
    headers: restHeaders,
    body: JSON.stringify({
      quote_id: quoteId,
      description: 'Dryer Vent Cleaning',
      quantity: 1,
      unit_price: SUBTOTAL,
      total_price: SUBTOTAL,
    }),
  });

  return quoteId;
};

const createJob = async (leadId: string, quoteId: string) => {
  const rows = await insertRowWithFallback('jobs', {
    tenant_id: TENANT_ID,
    lead_id: leadId,
    quote_id: quoteId,
    status: 'completed',
    payment_status: 'unpaid',
    customer_type_snapshot: 'residential',
    payment_terms: 'DUE_ON_RECEIPT',
    service_address: SERVICE_ADDRESS,
    total_amount: TOTAL_AMOUNT,
    work_order_number: `WO-MATRIX-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
    job_number: `JOB-MATRIX-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
  });
  const jobId = rows?.[0]?.id;
  if (!jobId) throw new Error('Failed to create job');
  createdJobIds.push(jobId);
  return jobId;
};

const createInvoice = async (leadId: string, jobId: string) => {
  const rows = await insertRowWithFallback('invoices', {
    tenant_id: TENANT_ID,
    lead_id: leadId,
    job_id: jobId,
    invoice_number: Math.floor(Date.now() / 1000) + Math.floor(Math.random() * 1000),
    invoice_type: 'final',
    status: 'paid',
    subtotal: SUBTOTAL,
    tax_amount: TAX_AMOUNT,
    total_amount: TOTAL_AMOUNT,
    amount_paid: TOTAL_AMOUNT,
    balance_due: 0,
    paid_at: new Date().toISOString(),
    issue_date: new Date().toISOString().slice(0, 10),
    due_date: new Date().toISOString().slice(0, 10),
    notes: 'Matrix paid invoice',
    terms: 'Due on receipt',
  });
  const invoiceId = rows?.[0]?.id;
  if (!invoiceId) throw new Error('Failed to create invoice');
  createdInvoiceIds.push(invoiceId);

  await fetchJson(`${SUPABASE_URL}/rest/v1/invoice_items?select=id`, {
    method: 'POST',
    headers: restHeaders,
    body: JSON.stringify({
      invoice_id: invoiceId,
      description: 'Dryer Vent Cleaning',
      quantity: 1,
      unit_price: SUBTOTAL,
      total_price: SUBTOTAL,
    }),
  });

  return invoiceId;
};

const handlers: Record<string, (req: Request) => Promise<Response>> = {};

{
  const originalServe = Deno.serve;
  Object.defineProperty(Deno, 'serve', {
    value: (...args: unknown[]) => {
      const handler = typeof args[0] === 'function' ? args[0] : args[1];
      const url = String((new Error().stack || '').split('\n')[2] || '');
      if (url.includes('send-estimate')) handlers['send-estimate'] = handler as (req: Request) => Promise<Response>;
      if (url.includes('send-invoice')) handlers['send-invoice'] = handler as (req: Request) => Promise<Response>;
      if (url.includes('send-receipt')) handlers['send-receipt'] = handler as (req: Request) => Promise<Response>;
      return { finished: Promise.resolve(), shutdown() {} };
    },
    configurable: true,
  });

  try {
    for (const mod of [
      'supabase/functions/send-estimate/index.ts',
      'supabase/functions/send-invoice/index.ts',
      'supabase/functions/send-receipt/index.ts',
    ]) {
      const url = `file:///${Deno.cwd().replaceAll('\\', '/')}/${mod}?ts=${Date.now()}-${Math.random()}`;
      await import(url);
    }
  } finally {
    Object.defineProperty(Deno, 'serve', { value: originalServe, configurable: true });
  }
}

const callHandler = async (name: string, body: Record<string, unknown>) => {
  const handler = handlers[name];
  if (!handler) throw new Error(`Missing local handler for ${name}`);
  const response = await handler(new Request(`http://local/functions/v1/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }));
  const json = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, json };
};

const scenarios = [
  {
    name: 'email_only',
    email: `matrix.email+${Date.now()}@example.com`,
    phone: null,
    requestedChannel: 'sms',
    expectedChannel: 'email',
  },
  {
    name: 'phone_only',
    email: null,
    phone: '(321) 555-0101',
    requestedChannel: 'email',
    expectedChannel: 'sms',
  },
  {
    name: 'both_available',
    email: `matrix.both+${Date.now()}@example.com`,
    phone: '(321) 555-0102',
    requestedChannel: 'sms',
    expectedChannel: 'sms',
  },
  {
    name: 'no_contact',
    email: null,
    phone: null,
    requestedChannel: 'email',
    expectedChannel: null,
  },
];

const results: Array<Record<string, unknown>> = [];

try {
  for (const scenario of scenarios) {
    const leadId = await createLead({ email: scenario.email, phone: scenario.phone });
    const quoteId = await createQuote(leadId);
    const jobId = await createJob(leadId, quoteId);
    const invoiceId = await createInvoice(leadId, jobId);

    const quoteResult = await callHandler('send-estimate', {
      quote_id: quoteId,
      tenant_id: TENANT_ID,
      delivery_channel: scenario.requestedChannel,
      dry_run: true,
    });

    const invoiceResult = await callHandler('send-invoice', {
      invoice_id: invoiceId,
      tenant_id: TENANT_ID,
      delivery_channel: scenario.requestedChannel,
      dry_run: true,
    });

    const receiptResult = await callHandler('send-receipt', {
      invoice_id: invoiceId,
      tenant_id: TENANT_ID,
      delivery_channel: scenario.requestedChannel,
    });

    if (scenario.expectedChannel) {
      if (!quoteResult.ok || quoteResult.json?.delivery_channel !== scenario.expectedChannel) {
        throw new Error(`Quote scenario ${scenario.name} failed: ${JSON.stringify(quoteResult)}`);
      }
      if (!invoiceResult.ok || invoiceResult.json?.delivery_channel !== scenario.expectedChannel) {
        throw new Error(`Invoice scenario ${scenario.name} failed: ${JSON.stringify(invoiceResult)}`);
      }
      if (!receiptResult.ok || receiptResult.json?.delivery_channel !== scenario.expectedChannel) {
        throw new Error(`Receipt scenario ${scenario.name} failed: ${JSON.stringify(receiptResult)}`);
      }
    } else {
      if (quoteResult.ok || invoiceResult.ok || receiptResult.ok) {
        throw new Error(`No-contact scenario unexpectedly succeeded: ${JSON.stringify({ quoteResult, invoiceResult, receiptResult })}`);
      }
    }

    results.push({
      scenario: scenario.name,
      requested_channel: scenario.requestedChannel,
      expected_channel: scenario.expectedChannel,
      quote: { ok: quoteResult.ok, delivery_channel: quoteResult.json?.delivery_channel ?? null, status: quoteResult.status },
      invoice: { ok: invoiceResult.ok, delivery_channel: invoiceResult.json?.delivery_channel ?? null, status: invoiceResult.status },
      receipt: { ok: receiptResult.ok, delivery_channel: receiptResult.json?.delivery_channel ?? null, status: receiptResult.status },
    });
  }

  console.log(JSON.stringify({ ok: true, results }, null, 2));
} finally {
  for (const invoiceId of createdInvoiceIds) {
    await fetch(`${SUPABASE_URL}/rest/v1/invoices?id=eq.${invoiceId}`, { method: 'DELETE', headers: authHeaders }).catch(() => null);
  }
  for (const jobId of createdJobIds) {
    await fetch(`${SUPABASE_URL}/rest/v1/jobs?id=eq.${jobId}`, { method: 'DELETE', headers: authHeaders }).catch(() => null);
  }
  for (const quoteId of createdQuoteIds) {
    await fetch(`${SUPABASE_URL}/rest/v1/quote_items?quote_id=eq.${quoteId}`, { method: 'DELETE', headers: authHeaders }).catch(() => null);
    await fetch(`${SUPABASE_URL}/rest/v1/quotes?id=eq.${quoteId}`, { method: 'DELETE', headers: authHeaders }).catch(() => null);
  }
  for (const leadId of createdLeadIds) {
    await fetch(`${SUPABASE_URL}/rest/v1/leads?id=eq.${leadId}`, { method: 'DELETE', headers: authHeaders }).catch(() => null);
  }
}
