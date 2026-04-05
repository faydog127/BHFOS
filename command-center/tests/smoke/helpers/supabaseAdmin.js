import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const DEFAULTS = {
  status: 'new',
  pipeline_stage: 'new',
  source: 'SMOKE_TEST',
  source_kind: 'SMOKE_TEST',
  customer_type: 'RESIDENTIAL',
  service: 'Duct Cleaning',
  quote_status: 'sent',
  quote_number: 'SMK-QUOTE',
  invoice_status: 'sent',
  notes: 'Smoke test record',
};

const MISSING_COLUMN_RE = /column "([^"]+)"( of relation "[^"]+")? does not exist/i;
const MISSING_COLUMN_CACHE_RE = /Could not find the '([^']+)' column of '([^']+)' in the schema cache/i;
const NOT_NULL_RE = /null value in column "([^"]+)" violates not-null constraint/i;
const TABLE_MISSING_RE = /relation "([^"]+)" does not exist/i;
const GENERATED_COLUMN_RE = /cannot insert a non-DEFAULT value into column "([^"]+)"/i;

const parseEnvFile = (envPath) => {
  if (!fs.existsSync(envPath)) return {};

  const raw = fs.readFileSync(envPath, 'utf8');
  const entries = {};

  raw.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) return;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (key) entries[key] = value;
  });

  return entries;
};

const loadDotEnv = () => {
  const envPath = path.join(process.cwd(), '.env');
  const localEnvPath = path.join(process.cwd(), '.env.local');
  const entries = {
    ...parseEnvFile(envPath),
    ...parseEnvFile(localEnvPath),
  };

  Object.entries(entries).forEach(([key, value]) => {
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  });

  return entries;
};

const getEnvConfig = () => {
  const dotenvValues = loadDotEnv();
  const supabaseUrl =
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    dotenvValues.SUPABASE_URL ||
    dotenvValues.VITE_SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
    dotenvValues.SUPABASE_SERVICE_ROLE_KEY ||
    dotenvValues.VITE_SUPABASE_SERVICE_ROLE_KEY;
  const warnings = [];

  if (!process.env.SUPABASE_URL && (process.env.VITE_SUPABASE_URL || dotenvValues.VITE_SUPABASE_URL)) {
    warnings.push('SUPABASE_URL missing, fell back to VITE_SUPABASE_URL.');
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY && (process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || dotenvValues.VITE_SUPABASE_SERVICE_ROLE_KEY)) {
    warnings.push('SUPABASE_SERVICE_ROLE_KEY missing, fell back to VITE_SUPABASE_SERVICE_ROLE_KEY.');
  }

  if (!supabaseUrl) {
    throw new Error('Missing SUPABASE_URL (or VITE_SUPABASE_URL).');
  }
  if (!serviceKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY (or VITE_SUPABASE_SERVICE_ROLE_KEY).');
  }

  return { supabaseUrl, serviceKey, warnings };
};

const createAdminClient = () => {
  const env = getEnvConfig();
  const client = createClient(env.supabaseUrl, env.serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return { client, env };
};

const createRunId = () => {
  if (crypto.randomUUID) return crypto.randomUUID();
  return crypto.randomBytes(16).toString('hex');
};

const randomToken = () => crypto.randomBytes(16).toString('hex');
const createUuid = () => (crypto.randomUUID ? crypto.randomUUID() : randomToken());

const parseMissingColumn = (message = '') => {
  const match = message.match(MISSING_COLUMN_RE);
  return match ? match[1] : null;
};

const parseMissingColumnCache = (message = '') => {
  const match = message.match(MISSING_COLUMN_CACHE_RE);
  return match ? match[1] : null;
};

const parseGeneratedColumn = (message = '') => {
  const match = message.match(GENERATED_COLUMN_RE);
  return match ? match[1] : null;
};

const parseNotNullColumn = (message = '') => {
  const match = message.match(NOT_NULL_RE);
  return match ? match[1] : null;
};

const parseMissingTable = (message = '') => {
  const match = message.match(TABLE_MISSING_RE);
  return match ? match[1] : null;
};

const insertWithRetry = async (client, table, payload, options = {}) => {
  const maxAttempts = options.maxAttempts || Math.max(8, Object.keys(payload || {}).length + 2);
  const current = { ...payload };
  const skippedColumns = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const { data, error } = await client
      .from(table)
      .insert(current)
      .select()
      .single();

    if (!error) {
      return { data, skippedColumns };
    }

    const message = error.message || '';
    const missingTable = parseMissingTable(message);
    if (missingTable) {
      return { error, skippedColumns, tableMissing: true };
    }

    const missingColumn =
      parseMissingColumn(message) ||
      parseMissingColumnCache(message);
    if (missingColumn && Object.prototype.hasOwnProperty.call(current, missingColumn)) {
      delete current[missingColumn];
      skippedColumns.push(missingColumn);
      continue;
    }

    const notNullColumn = parseNotNullColumn(message);
    if (notNullColumn && !Object.prototype.hasOwnProperty.call(current, notNullColumn)) {
      current[notNullColumn] = DEFAULTS[notNullColumn] || 'SMOKE_TEST';
      continue;
    }

    const generatedColumn = parseGeneratedColumn(message);
    if (generatedColumn && Object.prototype.hasOwnProperty.call(current, generatedColumn)) {
      delete current[generatedColumn];
      skippedColumns.push(generatedColumn);
      continue;
    }

    return { error, skippedColumns };
  }

  return {
    error: new Error(`Insert failed for ${table} after ${maxAttempts} attempts.`),
    skippedColumns,
  };
};

const updateWithRetry = async (client, table, match, patch) => {
  const { data, error } = await client
    .from(table)
    .update(patch)
    .match(match)
    .select()
    .single();

  return { data, error };
};

const selectSingle = async (client, table, match, columns = '*') => {
  const { data, error } = await client
    .from(table)
    .select(columns)
    .match(match)
    .single();
  return { data, error };
};

const rpcSafe = async (client, name, args) => {
  const { data, error } = await client.rpc(name, args);
  return { data, error };
};

const buildLeadPayload = (runId, overrides = {}) => ({
  first_name: 'Smoke',
  last_name: 'Test',
  phone: '3215550000',
  email: `smoke.${runId}@example.com`,
  service: DEFAULTS.service,
  status: DEFAULTS.status,
  pipeline_stage: DEFAULTS.pipeline_stage,
  source: DEFAULTS.source,
  source_kind: DEFAULTS.source_kind,
  customer_type: DEFAULTS.customer_type,
  tenant_id: 'tvg',
  is_test_data: true,
  test_run_id: runId,
  ...overrides,
});

const buildQuotePayload = (leadId, runId, overrides = {}) => {
  const subtotal = 200;
  const taxRate = 0.07;
  const taxAmount = Number((subtotal * taxRate).toFixed(2));
  const totalAmount = subtotal + taxAmount;

  return {
    lead_id: leadId,
    status: DEFAULTS.quote_status,
    subtotal,
    tax_rate: taxRate,
    tax_amount: taxAmount,
    total_amount: totalAmount,
    valid_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    header_text: 'Smoke test quote',
    footer_text: 'Thank you for your business.',
    quote_number: Math.floor(100000 + Math.random() * 900000),
    public_token: createUuid(),
    fulfillment_mode: 'same_visit',
    tenant_id: 'tvg',
    is_test_data: true,
    test_run_id: runId,
    ...overrides,
  };
};

const buildQuoteItemPayload = (quoteId, runId, overrides = {}) => ({
  quote_id: quoteId,
  description: 'Smoke Test Service',
  quantity: 1,
  unit_price: 200,
  total_price: 200,
  tenant_id: 'tvg',
  is_test_data: true,
  test_run_id: runId,
  ...overrides,
});

const buildInvoicePayload = (leadId, quoteId, runId, overrides = {}) => {
  const issueDate = new Date();
  const dueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  const subtotal = 200;
  const taxRate = 0.07;
  const taxAmount = Number((subtotal * taxRate).toFixed(2));
  const totalAmount = subtotal + taxAmount;
  const amountPaid = 0;
  const balanceDue = totalAmount - amountPaid;

  return {
    lead_id: leadId,
    quote_id: quoteId,
    status: DEFAULTS.invoice_status,
    issue_date: issueDate.toISOString().slice(0, 10),
    due_date: dueDate.toISOString().slice(0, 10),
    notes: 'Smoke test invoice',
    terms: 'Payment due upon receipt.',
    subtotal,
    tax_rate: taxRate,
    tax_amount: taxAmount,
    discount_amount: 0,
    total_amount: totalAmount,
    amount_paid: amountPaid,
    balance_due: balanceDue,
    invoice_number: Math.floor(100000 + Math.random() * 900000),
    public_token: createUuid(),
    tenant_id: 'tvg',
    is_test_data: true,
    test_run_id: runId,
    ...overrides,
  };
};

const buildInvoiceItemPayload = (invoiceId, runId, overrides = {}) => ({
  invoice_id: invoiceId,
  description: 'Smoke Test Service',
  quantity: 1,
  unit_price: 200,
  total_price: 200,
  is_taxable: true,
  tenant_id: 'tvg',
  is_test_data: true,
  test_run_id: runId,
  ...overrides,
});

export {
  createAdminClient,
  createRunId,
  insertWithRetry,
  updateWithRetry,
  selectSingle,
  rpcSafe,
  buildLeadPayload,
  buildQuotePayload,
  buildQuoteItemPayload,
  buildInvoicePayload,
  buildInvoiceItemPayload,
};
