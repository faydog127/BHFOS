import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseEnv(content) {
  const out = {};
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    out[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return out;
}

function asNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function dateOnly(date) {
  return date.toISOString().slice(0, 10);
}

function buildInvoiceNumber(quoteNumber, quoteId) {
  const cleaned = String(quoteNumber ?? '').trim();
  if (cleaned) {
    const digitsOnly = cleaned.replace(/\D/g, '');
    const parsed = Number.parseInt(digitsOnly || cleaned, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed <= 2147483647 ? parsed : parsed % 2147483647;
    }
  }
  const fallback = Number.parseInt(quoteId.replace(/\D/g, '').slice(0, 9), 10);
  if (Number.isFinite(fallback) && fallback > 0) return fallback;
  return Math.floor(100000 + Math.random() * 900000);
}

function chunk(array, size) {
  const result = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const tenantArgIdx = args.indexOf('--tenant');
  const tenantArg = tenantArgIdx >= 0 ? args[tenantArgIdx + 1] : '';
  const limitArgIdx = args.indexOf('--limit');
  const limitArg = limitArgIdx >= 0 ? Number(args[limitArgIdx + 1]) : 0;
  const limit = Number.isFinite(limitArg) && limitArg > 0 ? Math.floor(limitArg) : 0;

  const envPath = path.resolve(__dirname, '..', '.env');
  const env = parseEnv(await fs.readFile(envPath, 'utf8'));
  const url = env.VITE_SUPABASE_URL;
  const serviceRole = env.SUPABASE_SERVICE_ROLE_KEY;
  const tenantId = tenantArg || env.VITE_TENANT_ID || 'tvg';

  if (!url || !serviceRole) {
    throw new Error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in command-center/.env');
  }

  const admin = createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let query = admin
    .from('quotes')
    .select(
      'id,tenant_id,lead_id,estimate_id,quote_number,status,subtotal,tax_rate,tax_amount,total_amount,valid_until,customer_email,created_at',
    )
    .eq('status', 'approved')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: true });

  if (limit) query = query.limit(limit);

  const { data: approvedQuotes, error: quotesError } = await query;
  if (quotesError) throw new Error(`Failed to query approved quotes: ${quotesError.message}`);

  if (!approvedQuotes || approvedQuotes.length === 0) {
    console.log(JSON.stringify({ tenant_id: tenantId, approved_quotes: 0, missing_invoices: 0 }, null, 2));
    return;
  }

  const quoteIdToInvoiceId = new Map();
  for (const ids of chunk(approvedQuotes.map((q) => q.id), 200)) {
    const { data: invoices, error: invoicesError } = await admin
      .from('invoices')
      .select('id,quote_id')
      .eq('tenant_id', tenantId)
      .in('quote_id', ids);

    if (invoicesError) throw new Error(`Failed to query invoices: ${invoicesError.message}`);
    for (const row of invoices ?? []) {
      if (row.quote_id) quoteIdToInvoiceId.set(row.quote_id, row.id);
    }
  }

  const missing = approvedQuotes.filter((q) => !quoteIdToInvoiceId.has(q.id));

  if (!apply) {
    console.log(
      JSON.stringify(
        {
          tenant_id: tenantId,
          approved_quotes: approvedQuotes.length,
          existing_invoices: quoteIdToInvoiceId.size,
          missing_invoices: missing.length,
          dry_run: true,
          sample_missing_quote_ids: missing.slice(0, 20).map((q) => q.id),
        },
        null,
        2,
      ),
    );
    return;
  }

  let createdInvoices = 0;
  let copiedItems = 0;
  let failures = 0;
  const failureDetails = [];

  for (const quote of missing) {
    const now = new Date();
    const nowIso = now.toISOString();
    const subtotal = asNumber(quote.subtotal);
    const taxRate = asNumber(quote.tax_rate);
    const taxAmount = asNumber(quote.tax_amount);
    const totalAmount = asNumber(quote.total_amount) ?? 0;
    const dueDate = quote.valid_until || dateOnly(new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000));

    let invoiceNumber = buildInvoiceNumber(quote.quote_number, quote.id);
    let invoiceId = null;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const { data: createdInvoice, error: createError } = await admin
        .from('invoices')
        .insert({
          tenant_id: tenantId,
          lead_id: quote.lead_id ?? null,
          quote_id: quote.id,
          estimate_id: quote.estimate_id ?? null,
          invoice_number: invoiceNumber,
          status: 'sent',
          subtotal,
          tax_rate: taxRate,
          tax_amount: taxAmount,
          total_amount: totalAmount,
          amount_paid: 0,
          issue_date: dateOnly(now),
          due_date: dueDate,
          sent_at: nowIso,
          customer_email: quote.customer_email ?? null,
          created_at: nowIso,
          updated_at: nowIso,
        })
        .select('id')
        .maybeSingle();

      if (!createError) {
        invoiceId = createdInvoice?.id ?? null;
        break;
      }

      if (createError.code === '23505' && attempt === 0) {
        invoiceNumber = Math.floor(100000 + Math.random() * 900000);
        continue;
      }

      failures += 1;
      failureDetails.push({
        quote_id: quote.id,
        code: createError.code ?? null,
        message: createError.message ?? 'invoice_insert_failed',
      });
      break;
    }

    if (!invoiceId) continue;
    createdInvoices += 1;

    const { data: quoteItems, error: quoteItemsError } = await admin
      .from('quote_items')
      .select('description,quantity,unit_price,total_price')
      .eq('quote_id', quote.id);

    if (quoteItemsError) {
      failures += 1;
      failureDetails.push({
        quote_id: quote.id,
        invoice_id: invoiceId,
        code: quoteItemsError.code ?? null,
        message: quoteItemsError.message ?? 'quote_items_fetch_failed',
      });
      continue;
    }

    if (quoteItems && quoteItems.length > 0) {
      const { error: invoiceItemsError } = await admin.from('invoice_items').insert(
        quoteItems.map((item) => ({
          invoice_id: invoiceId,
          description: item.description ?? null,
          quantity: item.quantity ?? null,
          unit_price: item.unit_price ?? null,
          total_price: item.total_price ?? null,
        })),
      );

      if (invoiceItemsError) {
        failures += 1;
        failureDetails.push({
          quote_id: quote.id,
          invoice_id: invoiceId,
          code: invoiceItemsError.code ?? null,
          message: invoiceItemsError.message ?? 'invoice_items_insert_failed',
        });
      } else {
        copiedItems += quoteItems.length;
      }
    }

    await admin.from('events').insert({
      tenant_id: tenantId,
      entity_type: 'invoice',
      entity_id: invoiceId,
      event_type: 'InvoiceCreated',
      actor_type: 'system',
      payload: {
        quoteId: quote.id,
        auto_created_on_quote_accept: true,
        source: 'backfill_approved_quotes_missing_invoices',
      },
      created_at: nowIso,
    });
  }

  console.log(
    JSON.stringify(
      {
        tenant_id: tenantId,
        approved_quotes: approvedQuotes.length,
        missing_invoices_initial: missing.length,
        invoices_created: createdInvoices,
        invoice_items_copied: copiedItems,
        failures,
        failure_details: failureDetails.slice(0, 20),
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
