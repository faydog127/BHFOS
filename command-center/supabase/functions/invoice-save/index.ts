import { corsHeaders } from '../_lib/cors.ts';
import { supabaseAdmin } from '../_lib/supabaseAdmin.ts';
import { getTenantIdFromClaims, getVerifiedClaims } from '../_shared/auth.ts';
import {
  finishInvoiceCheckoutMutation,
  prepareInvoiceCheckoutMutation,
} from '../_shared/checkoutInvalidation.ts';
import { changesPayableState } from '../_shared/publicPaymentRules.js';

const INVOICE_SELECT = `
  id,
  tenant_id,
  lead_id,
  quote_id,
  job_id,
  status,
  invoice_type,
  release_approved,
  release_approved_at,
  release_approved_by,
  issue_date,
  due_date,
  notes,
  terms,
  customer_name,
  customer_email,
  customer_phone,
  subtotal,
  tax_rate,
  tax_amount,
  discount_amount,
  total_amount,
  amount_paid,
  balance_due,
  checkout_generation,
  paid_at,
  payment_method,
  invoice_number,
  public_token,
  sent_at,
  created_at,
  updated_at
`;

const GENERATED_COLUMN_RE = /column "([^"]+)" is a generated column/i;
const COLUMN_NAME_RE = /column "([^"]+)"/i;
const MISSING_COLUMN_CACHE_RE = /Could not find the '([^']+)' column/i;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const asNullableString = (value: unknown) => {
  if (value === null) return null;
  const text = String(value ?? '').trim();
  return text ? text : null;
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

const asNullableBoolean = (value: unknown) => {
  if (value === null) return null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return Boolean(value);
};

const asIsoDateTime = (value: unknown) => {
  if (value === null) return null;
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid datetime value: ${raw}`);
  }
  return parsed.toISOString();
};

const asDateOnly = (value: unknown) => {
  if (value === null) return null;
  const raw = String(value ?? '').trim();
  return raw || null;
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

const buildInvoicePatch = (input: Record<string, unknown>, tenantId: string) => {
  const patch: Record<string, unknown> = {
    tenant_id: tenantId,
  };

  if ('lead_id' in input) patch.lead_id = asNullableString(input.lead_id);
  if ('quote_id' in input) patch.quote_id = asNullableString(input.quote_id);
  if ('job_id' in input) patch.job_id = asNullableString(input.job_id);
  if ('status' in input) patch.status = asNullableString(input.status);
  if ('invoice_type' in input) patch.invoice_type = asNullableString(input.invoice_type);
  if ('release_approved' in input) patch.release_approved = asNullableBoolean(input.release_approved);
  if ('release_approved_at' in input) patch.release_approved_at = asIsoDateTime(input.release_approved_at);
  if ('release_approved_by' in input) patch.release_approved_by = asNullableString(input.release_approved_by);
  if ('issue_date' in input) patch.issue_date = asDateOnly(input.issue_date);
  if ('due_date' in input) patch.due_date = asDateOnly(input.due_date);
  if ('notes' in input) patch.notes = asNullableString(input.notes);
  if ('terms' in input) patch.terms = asNullableString(input.terms);
  if ('customer_name' in input) patch.customer_name = asNullableString(input.customer_name);
  if ('customer_email' in input) patch.customer_email = asNullableString(input.customer_email);
  if ('customer_phone' in input) patch.customer_phone = asNullableString(input.customer_phone);
  if ('subtotal' in input) patch.subtotal = asNullableNumber(input.subtotal);
  if ('tax_rate' in input) patch.tax_rate = asNullableNumber(input.tax_rate);
  if ('tax_amount' in input) patch.tax_amount = asNullableNumber(input.tax_amount);
  if ('discount_amount' in input) patch.discount_amount = asNullableNumber(input.discount_amount);
  if ('total_amount' in input) patch.total_amount = asNullableNumber(input.total_amount);
  if ('payment_method' in input) patch.payment_method = asNullableString(input.payment_method);
  if ('invoice_number' in input) patch.invoice_number = asNullableString(input.invoice_number);
  if ('public_token' in input) patch.public_token = asNullableString(input.public_token);
  if ('sent_at' in input) patch.sent_at = asIsoDateTime(input.sent_at);

  return Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined));
};

const normalizeInvoiceItems = (items: unknown) => {
  if (!Array.isArray(items)) return [];

  return items.map((item) => {
    const row = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
    return {
      description: asNullableString(row.description),
      quantity: asNullableNumber(row.quantity),
      unit_price: asNullableNumber(row.unit_price),
      total_price: asNullableNumber(row.total_price),
    };
  });
};

const upsertInvoice = async (
  invoiceId: string | null,
  patch: Record<string, unknown>,
  checkoutGeneration: number | null,
) => {
  let nextPatch = { ...patch };

  for (let attempt = 0; attempt < 4; attempt += 1) {
    let query = invoiceId
      ? supabaseAdmin.from('invoices').update(nextPatch).eq('id', invoiceId).eq('tenant_id', patch.tenant_id)
      : null;
    if (query && checkoutGeneration !== null) {
      query = query
        .eq('checkout_generation', checkoutGeneration)
        .eq('checkout_mutation_pending', true);
    }
    const saveQuery = query
      ? query.select(INVOICE_SELECT).maybeSingle()
      : supabaseAdmin.from('invoices').insert(nextPatch).select(INVOICE_SELECT).single();

    const { data, error } = await saveQuery;
    if (!error) {
      if (data) return data;
      throw new Error('Invoice not found after save.');
    }

    const retriableColumn = getRetriableColumnName(error);
    if (!retriableColumn || !Object.prototype.hasOwnProperty.call(nextPatch, retriableColumn)) {
      throw error;
    }

    delete nextPatch[retriableColumn];
  }

  throw new Error('Invoice save failed after removing incompatible columns.');
};

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object') {
    const maybeMessage = (error as { message?: unknown }).message;
    if (typeof maybeMessage === 'string' && maybeMessage.trim()) return maybeMessage.trim();
    const maybeError = (error as { error?: unknown }).error;
    if (typeof maybeError === 'string' && maybeError.trim()) return maybeError.trim();
  }
  return 'Unknown error';
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
    const invoiceId = asNullableString(body?.invoice_id);
    const requestedTenantId = asNullableString(body?.tenant_id);
    const invoiceInput = body?.invoice;
    const itemsInput = body?.items;
    const observedCheckoutGeneration = Number(body?.checkout_generation ?? invoiceInput?.checkout_generation);

    if (!requestedTenantId) {
      return json({ error: 'Missing tenant_id' }, 400);
    }
    if (requestedTenantId !== jwtTenantId) {
      return json({ error: 'Tenant mismatch' }, 403);
    }
    if (!invoiceInput || typeof invoiceInput !== 'object' || Array.isArray(invoiceInput)) {
      return json({ error: 'Invalid invoice payload' }, 400);
    }

    const patch = buildInvoicePatch(invoiceInput as Record<string, unknown>, jwtTenantId);
    const relationships = [
      { field: 'lead_id', table: 'leads' },
      { field: 'quote_id', table: 'quotes' },
      { field: 'job_id', table: 'jobs' },
    ] as const;
    for (const relationship of relationships) {
      const relatedId = asNullableString(patch[relationship.field]);
      if (!relatedId) continue;
      const { data: relatedRow, error: relationshipError } = await supabaseAdmin
        .from(relationship.table)
        .select('id')
        .eq('id', relatedId)
        .eq('tenant_id', jwtTenantId)
        .maybeSingle();
      if (relationshipError) {
        console.error(`invoice-save ${relationship.field} validation failed:`, relationshipError.message);
        return json({ error: 'Invoice relationship could not be validated.' }, 500);
      }
      if (!relatedRow?.id) {
        return json({ error: `Invalid ${relationship.field} for tenant.` }, 400);
      }
    }
    let checkoutGeneration: number | null = null;
    if (invoiceId) {
      const { data: currentInvoice, error: currentInvoiceError } = await supabaseAdmin
        .from('invoices')
        .select(INVOICE_SELECT)
        .eq('id', invoiceId)
        .eq('tenant_id', jwtTenantId)
        .maybeSingle();

      if (currentInvoiceError || !currentInvoice) {
        return json({ error: currentInvoiceError?.message || 'Invoice not found' }, 404);
      }

      if (changesPayableState(currentInvoice, patch)) {
        if (
          !Number.isSafeInteger(observedCheckoutGeneration) ||
          observedCheckoutGeneration < 0 ||
          observedCheckoutGeneration !== Number(currentInvoice.checkout_generation ?? 0)
        ) {
          return json({ error: 'Invoice changed since it was opened. Reload before saving.' }, 409);
        }
        checkoutGeneration = await prepareInvoiceCheckoutMutation({
          tenantId: jwtTenantId,
          invoiceId,
          expectedGeneration: observedCheckoutGeneration,
        });
      }
    }

    try {
      const savedInvoice = await upsertInvoice(invoiceId, patch, checkoutGeneration);
      const invoiceItems = normalizeInvoiceItems(itemsInput);

      if (invoiceId && checkoutGeneration !== null) {
        const { data: itemsReplaced, error: itemsReplaceError } = await supabaseAdmin.rpc(
          'replace_invoice_items_fenced',
          {
            p_tenant_id: jwtTenantId,
            p_invoice_id: savedInvoice.id,
            p_checkout_generation: checkoutGeneration,
            p_items: invoiceItems,
          },
        );
        if (itemsReplaceError || itemsReplaced !== true) {
          console.error('invoice-save fenced invoice_items replacement failed:', itemsReplaceError);
          return json({ error: 'Invoice items could not be saved.' }, 409);
        }
      } else {
        await supabaseAdmin.from('invoice_items').delete().eq('invoice_id', savedInvoice.id);
        const insertRows = invoiceItems.map((item) => ({
          invoice_id: savedInvoice.id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_price,
        }));

        if (insertRows.length > 0) {
          const { error: itemsError } = await supabaseAdmin.from('invoice_items').insert(insertRows);
          if (itemsError) {
            console.error('invoice-save invoice_items failed:', itemsError);
            return json({ error: 'Invoice items could not be saved.' }, 500);
          }
        }
      }

      const { data: hydratedInvoice, error: hydrateError } = await supabaseAdmin
        .from('invoices')
        .select(INVOICE_SELECT)
        .eq('id', savedInvoice.id)
        .eq('tenant_id', jwtTenantId)
        .maybeSingle();

      if (hydrateError || !hydratedInvoice) {
        console.error('invoice-save hydrate failed:', hydrateError);
        return json({ error: hydrateError?.message || 'Invoice saved but could not be reloaded.' }, 500);
      }

      return json({ invoice: hydratedInvoice });
    } finally {
      if (invoiceId && checkoutGeneration !== null) {
        await finishInvoiceCheckoutMutation({
          tenantId: jwtTenantId,
          invoiceId,
          generation: checkoutGeneration,
        });
      }
    }
  } catch (error) {
    const message = getErrorMessage(error);
    console.error('invoice-save failed:', error);
    return json({ error: message }, 500);
  }
});
