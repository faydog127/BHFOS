import { supabaseAdmin } from '../_lib/supabaseAdmin.ts';
import { getTenantIdFromClaims, getVerifiedClaims } from '../_shared/auth.ts';
import { buildCorsHeaders, readJson } from '../_shared/publicUtils.ts';
import { closeFollowUpTasks } from '../_shared/taskUtils.ts';
import { BUSINESS_WEBSITE, renderEmailLayout, sendEmail } from '../_shared/email.ts';

type MoveRequest = {
  entity_type?: 'lead' | 'quote' | 'job' | 'invoice';
  entity_id?: string;
  to_column_key?: string;
  tenant_id?: string;
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
  return null;
};

const quoteColumnKey = (statusRaw: unknown) => {
  const status = normalizeStatus(statusRaw);
  if (!status || status === 'draft') return 'quote_draft';
  if (['sent', 'quote_sending', 'quote_send_failed', 'sending', 'send_failed'].includes(status)) return 'quote_sent';
  if (status === 'viewed') return 'quote_viewed';
  if (['accepted', 'approved'].includes(status)) return 'quote_accepted';
  if (['converted', 'archived'].includes(status)) return null;
  return null;
};

const jobColumnKey = (statusRaw: unknown) => {
  const status = normalizeStatus(statusRaw);
  if (!status || ['scheduled', 'in_progress', 'pending'].includes(status)) return 'job_scheduled';
  if (status === 'completed') return 'job_completed';
  if (['invoiced', 'archived'].includes(status)) return null;
  return null;
};

const invoiceColumnKey = (statusRaw: unknown) => {
  const status = normalizeStatus(statusRaw);
  if (status === 'paid') return 'invoice_paid';
  return 'invoice_open';
};

const randomToken = (bytes = 16) => {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

const asString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
const asTracking = (value: unknown) => asString(value).toUpperCase();

const isMissingColumnError = (error: { code?: string; message?: string } | null | undefined) => {
  if (!error) return false;
  if (error.code === 'PGRST204' || error.code === '42703') return true;
  const msg = String(error.message ?? '').toLowerCase();
  return msg.includes('column') && (msg.includes('does not exist') || msg.includes('could not find'));
};

const fallbackWorkOrderNumber = (tenantId: string, quoteNumber: unknown, nowIso: string) => {
  const year = new Date(nowIso).getUTCFullYear();
  const digits = asString(quoteNumber).replace(/\D/g, '');
  if (digits) {
    const seq = Number.parseInt(digits, 10) % 10000;
    return `WO-${year}-${String(seq).padStart(4, '0')}`;
  }
  const hash = Math.abs(
    Array.from(`${tenantId}:${nowIso}`).reduce((acc, ch) => ((acc * 31) + ch.charCodeAt(0)) | 0, 11),
  ) % 10000;
  return `WO-${year}-${String(hash).padStart(4, '0')}`;
};

const allocateWorkOrderNumber = async (tenantId: string, quoteNumber: unknown, nowIso: string) => {
  const { data, error } = await supabaseAdmin.rpc('next_work_order_number', {
    p_tenant_id: tenantId,
    p_created_at: nowIso,
  });

  if (!error && typeof data === 'string' && data.trim()) {
    return data.trim().toUpperCase();
  }

  return fallbackWorkOrderNumber(tenantId, quoteNumber, nowIso).toUpperCase();
};

const buildServiceAddress = (value: unknown): string | null => {
  const address = Array.isArray(value) ? value[0] : value;
  if (!address || typeof address !== 'object') return null;
  const row = address as Record<string, unknown>;
  const parts = [
    asString(row.address1),
    asString(row.address2),
    asString(row.city),
    asString(row.state),
    asString(row.zip),
  ].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
};

const resolveLeadServiceAddress = async (tenantId: string, leadId: string | null | undefined) => {
  if (!leadId) return null;
  const { data: lead, error } = await supabaseAdmin
    .from('leads')
    .select('address:property_id(address1,address2,city,state,zip)')
    .eq('tenant_id', tenantId)
    .eq('id', leadId)
    .maybeSingle();

  if (error) return null;
  return buildServiceAddress((lead as Record<string, unknown> | null)?.address);
};

const buildQuoteEmailHtml = (recipientName: string, quoteNumber: string | null, quoteUrl: string) => {
  const title = quoteNumber ? `Quote #${String(quoteNumber).toUpperCase()}` : 'Your Quote';
  const bodyHtml = `
    <p>Hi ${recipientName},</p>
    <p>Your quote is ready for review. Click below to view the details and accept it online.</p>
    <p><a href="${quoteUrl}" style="color:#1d4ed8;">View Quote</a></p>
  `;

  return renderEmailLayout({
    title,
    preheader: 'Your quote is ready to review.',
    bodyHtml,
  });
};

const getOrCreateQuoteForLead = async (lead: Record<string, unknown>) => {
  const { data: existing } = await supabaseAdmin
    .from('quotes')
    .select('id, status, lead_id, quote_number, public_token, tenant_id')
    .eq('tenant_id', lead.tenant_id)
    .eq('lead_id', lead.id)
    .maybeSingle();

  if (existing?.id) return existing;

  const quoteNumber = Math.floor(100000 + Math.random() * 900000);
  const publicToken = randomToken();
  const validUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabaseAdmin
    .from('quotes')
    .insert({
      lead_id: lead.id,
      tenant_id: lead.tenant_id,
      status: 'draft',
      quote_number: quoteNumber,
      public_token: publicToken,
      subtotal: 0,
      tax_rate: 0,
      tax_amount: 0,
      total_amount: 0,
      valid_until: validUntil,
      created_at: new Date().toISOString(),
    })
    .select('id, status, lead_id, quote_number, public_token, tenant_id')
    .single();

  if (error || !data) throw error || new Error('Failed to create quote');
  return data;
};

const getOrCreateJobForQuote = async (quote: Record<string, unknown>) => {
  const { data: existing } = await supabaseAdmin
    .from('jobs')
    .select('id, status, quote_id, tenant_id')
    .eq('tenant_id', quote.tenant_id)
    .eq('quote_id', quote.id)
    .maybeSingle();

  if (existing?.id) return existing;

  const nowIso = new Date().toISOString();
  const workOrderNumber = await allocateWorkOrderNumber(String(quote.tenant_id ?? ''), quote.quote_number, nowIso);
  const serviceAddress = await resolveLeadServiceAddress(String(quote.tenant_id ?? ''), asString(quote.lead_id));
  const richInsert: Record<string, unknown> = {
    quote_id: quote.id,
    lead_id: quote.lead_id ?? null,
    tenant_id: quote.tenant_id,
    status: 'scheduled',
    total_amount: quote.total_amount ?? 0,
    quote_number: asTracking(quote.quote_number) || null,
    work_order_number: workOrderNumber,
    job_number: workOrderNumber,
    payment_status: 'unpaid',
    service_address: serviceAddress,
    created_at: nowIso,
    updated_at: nowIso,
  };

  let { data, error } = await supabaseAdmin
    .from('jobs')
    .insert(richInsert)
    .select('id, status, quote_id, tenant_id')
    .single();

  if (error && isMissingColumnError(error)) {
    const fallbackInsert = await supabaseAdmin
      .from('jobs')
      .insert({
        quote_id: quote.id,
        lead_id: quote.lead_id ?? null,
        tenant_id: quote.tenant_id,
        status: 'scheduled',
        total_amount: quote.total_amount ?? 0,
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select('id, status, quote_id, tenant_id')
      .single();

    data = fallbackInsert.data;
    error = fallbackInsert.error;
  }

  if (error || !data) throw error || new Error('Failed to create job');
  return data;
};

const getOrCreateInvoiceForJob = async (job: Record<string, unknown>) => {
  const { data: existing } = await supabaseAdmin
    .from('invoices')
    .select('id, status, job_id, tenant_id')
    .eq('tenant_id', job.tenant_id)
    .eq('job_id', job.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.id) return existing;

  const totalAmount = typeof job.total_amount === 'number' ? job.total_amount : 0;
  const invoiceNumber = Math.floor(100000 + Math.random() * 900000);
  const publicToken = randomToken();

  const { data, error } = await supabaseAdmin
    .from('invoices')
    .insert({
      job_id: job.id,
      quote_id: job.quote_id ?? null,
      lead_id: job.lead_id ?? null,
      tenant_id: job.tenant_id,
      status: 'draft',
      invoice_type: 'final',
      release_approved: false,
      total_amount: totalAmount,
      amount_paid: 0,
      balance_due: totalAmount,
      invoice_number: invoiceNumber,
      public_token: publicToken,
      created_at: new Date().toISOString(),
    })
    .select('id, status, job_id, tenant_id')
    .single();

  if (error || !data) throw error || new Error('Failed to create invoice');
  return data;
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

  const body = (await readJson(req)) as MoveRequest | null;
  const entityType = body?.entity_type ?? null;
  const entityId = body?.entity_id ?? null;
  const toColumnKey = body?.to_column_key ?? null;
  const bodyTenantId = body?.tenant_id ?? null;

  const jwtTenantId = getTenantIdFromClaims(claims);
  if (!jwtTenantId) {
    return respondJson({ error: 'Unauthorized: missing tenant claim' }, 403, cors.headers);
  }

  if (bodyTenantId && bodyTenantId !== jwtTenantId) {
    return respondJson({ error: 'Tenant mismatch' }, 403, cors.headers);
  }

  if (!entityType || !entityId || !toColumnKey) {
    return respondJson({ error: 'entity_type, entity_id, and to_column_key are required' }, 400, cors.headers);
  }

  const actorId = claims.sub ?? null;

  if (entityType === 'lead') {
    const { data: lead, error } = await supabaseAdmin
      .from('leads')
      .select('id, status, tenant_id, first_name, last_name, company, email, phone')
      .eq('tenant_id', jwtTenantId)
      .eq('id', entityId)
      .maybeSingle();

    if (error || !lead) {
      return respondJson({ error: 'Lead not found' }, 404, cors.headers);
    }

    const fromColumnKey = leadColumnKey(lead.status);
    if (!fromColumnKey) {
      if (toColumnKey === 'quote_draft') {
        const quote = await getOrCreateQuoteForLead(lead);
        return respondJson(
          {
            ok: true,
            entity_type: 'quote',
            entity_id: quote.id,
            column_key: 'quote_draft',
            transformed_from: { entity_type: 'lead', entity_id: lead.id },
          },
          200,
          cors.headers
        );
      }

      return respondJson({ error: 'Lead is not movable' }, 409, cors.headers);
    }

    if (fromColumnKey === toColumnKey) {
      return respondJson({ ok: true, entity_type: 'lead', entity_id: lead.id, column_key: fromColumnKey }, 200, cors.headers);
    }

    if (fromColumnKey === 'lead_new' && toColumnKey === 'lead_contacted') {
      const { error: leadUpdateError } = await supabaseAdmin
        .from('leads')
        .update({ status: 'contacted' })
        .eq('id', lead.id)
        .eq('tenant_id', jwtTenantId);
      if (leadUpdateError) {
        return respondJson({ error: leadUpdateError.message }, 500, cors.headers);
      }
    } else if (fromColumnKey === 'lead_contacted' && toColumnKey === 'lead_qualified') {
      const { error: leadUpdateError } = await supabaseAdmin
        .from('leads')
        .update({ status: 'qualified' })
        .eq('id', lead.id)
        .eq('tenant_id', jwtTenantId);
      if (leadUpdateError) {
        return respondJson({ error: leadUpdateError.message }, 500, cors.headers);
      }
    } else if (fromColumnKey === 'lead_qualified' && toColumnKey === 'quote_draft') {
      const quote = await getOrCreateQuoteForLead(lead);
      const { error: leadUpdateError } = await supabaseAdmin
        .from('leads')
        .update({ status: 'converted' })
        .eq('id', lead.id)
        .eq('tenant_id', jwtTenantId);
      if (leadUpdateError) {
        return respondJson({ error: leadUpdateError.message }, 500, cors.headers);
      }

      await supabaseAdmin.from('kanban_status_events').insert({
        entity_type: 'lead',
        entity_id: lead.id,
        from_stage: fromColumnKey,
        to_stage: toColumnKey,
        actor_id: actorId,
        metadata: { next_entity_type: 'quote', next_entity_id: quote.id },
      });

      return respondJson(
        {
          ok: true,
          entity_type: 'quote',
          entity_id: quote.id,
          column_key: 'quote_draft',
          transformed_from: { entity_type: 'lead', entity_id: lead.id },
        },
        200,
        cors.headers
      );
    } else {
      return respondJson({ error: 'Invalid lead transition' }, 400, cors.headers);
    }

    await supabaseAdmin.from('kanban_status_events').insert({
      entity_type: 'lead',
      entity_id: lead.id,
      from_stage: fromColumnKey,
      to_stage: toColumnKey,
      actor_id: actorId,
      metadata: {},
    });

    return respondJson({ ok: true, entity_type: 'lead', entity_id: lead.id, column_key: toColumnKey }, 200, cors.headers);
  }

  if (entityType === 'quote') {
    const { data: quote, error } = await supabaseAdmin
      .from('quotes')
      .select(
        'id, status, tenant_id, lead_id, quote_number, public_token, total_amount, sent_at, updated_at, leads(first_name, last_name, email)'
      )
      .eq('tenant_id', jwtTenantId)
      .eq('id', entityId)
      .maybeSingle();

    if (error || !quote) {
      return respondJson({ error: 'Quote not found' }, 404, cors.headers);
    }

    const fromColumnKey = quoteColumnKey(quote.status);
    if (!fromColumnKey) {
      if (toColumnKey === 'job_scheduled') {
        const job = await getOrCreateJobForQuote(quote);
        return respondJson(
          {
            ok: true,
            entity_type: 'job',
            entity_id: job.id,
            column_key: 'job_scheduled',
            transformed_from: { entity_type: 'quote', entity_id: quote.id },
          },
          200,
          cors.headers
        );
      }

      return respondJson({ error: 'Quote is not movable' }, 409, cors.headers);
    }

    if (fromColumnKey === toColumnKey) {
      return respondJson({ ok: true, entity_type: 'quote', entity_id: quote.id, column_key: fromColumnKey }, 200, cors.headers);
    }

    if (fromColumnKey === 'quote_draft' && toColumnKey === 'quote_sent') {
      const { error: sendingError } = await supabaseAdmin
        .from('quotes')
        .update({ status: 'quote_sending', updated_at: new Date().toISOString() })
        .eq('id', quote.id)
        .eq('tenant_id', jwtTenantId);
      if (sendingError) {
        return respondJson({ error: sendingError.message }, 500, cors.headers);
      }

      const leadInfo = quote.leads ?? {};
      const email = String(leadInfo.email ?? '').trim();
      if (!email) {
        const { error: failError } = await supabaseAdmin
          .from('quotes')
          .update({ status: 'quote_send_failed', updated_at: new Date().toISOString() })
          .eq('id', quote.id)
          .eq('tenant_id', jwtTenantId);
        if (failError) {
          return respondJson({ error: failError.message }, 500, cors.headers);
        }

        return respondJson({ error: 'Quote recipient email missing', status: 'quote_send_failed' }, 422, cors.headers);
      }

      const publicToken = quote.public_token || randomToken();
      if (!quote.public_token) {
        const { error: tokenError } = await supabaseAdmin
          .from('quotes')
          .update({ public_token: publicToken })
          .eq('id', quote.id)
          .eq('tenant_id', jwtTenantId);
        if (tokenError) {
          return respondJson({ error: tokenError.message }, 500, cors.headers);
        }
      }

      const quoteUrl = `${BUSINESS_WEBSITE}/quotes/${publicToken}`;
      const recipientName =
        [leadInfo.first_name, leadInfo.last_name].filter(Boolean).join(' ').trim() || 'Customer';

      try {
        const quoteNumberLabel = asTracking(quote.quote_number) || null;
        const html = buildQuoteEmailHtml(recipientName, quoteNumberLabel, quoteUrl);
        await sendEmail({
          to: email,
          subject: quoteNumberLabel ? `Your Quote #${quoteNumberLabel}` : 'Your Quote',
          html,
        });

        const { error: sentError } = await supabaseAdmin
          .from('quotes')
          .update({ status: 'sent', sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq('id', quote.id)
          .eq('tenant_id', jwtTenantId);
        if (sentError) {
          return respondJson({ error: sentError.message }, 500, cors.headers);
        }
      } catch (sendError) {
        const { error: failError } = await supabaseAdmin
          .from('quotes')
          .update({ status: 'quote_send_failed', updated_at: new Date().toISOString() })
          .eq('id', quote.id)
          .eq('tenant_id', jwtTenantId);
        if (failError) {
          return respondJson({ error: failError.message }, 500, cors.headers);
        }

        return respondJson(
          { error: 'Quote email failed', detail: String(sendError?.message ?? sendError), status: 'quote_send_failed' },
          502,
          cors.headers
        );
      }
    } else if (fromColumnKey === 'quote_sent' && toColumnKey === 'quote_viewed') {
      const { error: viewedError } = await supabaseAdmin
        .from('quotes')
        .update({ status: 'viewed', updated_at: new Date().toISOString() })
        .eq('id', quote.id)
        .eq('tenant_id', jwtTenantId);
      if (viewedError) {
        return respondJson({ error: viewedError.message }, 500, cors.headers);
      }
    } else if (['quote_sent', 'quote_viewed'].includes(fromColumnKey) && toColumnKey === 'quote_accepted') {
      const { error: acceptedError } = await supabaseAdmin
        .from('quotes')
        .update({ status: 'accepted', accepted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', quote.id)
        .eq('tenant_id', jwtTenantId);
      if (acceptedError) {
        return respondJson({ error: acceptedError.message }, 500, cors.headers);
      }

      await closeFollowUpTasks({
        tenantId: quote.tenant_id,
        sourceType: 'quote',
        sourceId: quote.id,
      });
    } else if (fromColumnKey === 'quote_accepted' && toColumnKey === 'job_scheduled') {
      const job = await getOrCreateJobForQuote(quote);
      const { error: quoteUpdateError } = await supabaseAdmin
        .from('quotes')
        .update({ status: 'converted', updated_at: new Date().toISOString() })
        .eq('id', quote.id)
        .eq('tenant_id', jwtTenantId);
      if (quoteUpdateError) {
        return respondJson({ error: quoteUpdateError.message }, 500, cors.headers);
      }

      await supabaseAdmin.from('kanban_status_events').insert({
        entity_type: 'quote',
        entity_id: quote.id,
        from_stage: fromColumnKey,
        to_stage: toColumnKey,
        actor_id: actorId,
        metadata: { next_entity_type: 'job', next_entity_id: job.id },
      });

      return respondJson(
        {
          ok: true,
          entity_type: 'job',
          entity_id: job.id,
          column_key: 'job_scheduled',
          transformed_from: { entity_type: 'quote', entity_id: quote.id },
        },
        200,
        cors.headers
      );
    } else {
      return respondJson({ error: 'Invalid quote transition' }, 400, cors.headers);
    }

    await supabaseAdmin.from('kanban_status_events').insert({
      entity_type: 'quote',
      entity_id: quote.id,
      from_stage: fromColumnKey,
      to_stage: toColumnKey,
      actor_id: actorId,
      metadata: {},
    });

    return respondJson({ ok: true, entity_type: 'quote', entity_id: quote.id, column_key: toColumnKey }, 200, cors.headers);
  }

  if (entityType === 'job') {
    const { data: job, error } = await supabaseAdmin
      .from('jobs')
      .select('id, status, tenant_id, lead_id, quote_id, total_amount')
      .eq('tenant_id', jwtTenantId)
      .eq('id', entityId)
      .maybeSingle();

    if (error || !job) {
      return respondJson({ error: 'Job not found' }, 404, cors.headers);
    }

    const fromColumnKey = jobColumnKey(job.status);
    if (!fromColumnKey) {
      if (toColumnKey === 'invoice_open') {
        const invoice = await getOrCreateInvoiceForJob(job);
        return respondJson(
          {
            ok: true,
            entity_type: 'invoice',
            entity_id: invoice.id,
            column_key: 'invoice_open',
            transformed_from: { entity_type: 'job', entity_id: job.id },
          },
          200,
          cors.headers
        );
      }

      return respondJson({ error: 'Job is not movable' }, 409, cors.headers);
    }

    if (fromColumnKey === toColumnKey) {
      return respondJson({ ok: true, entity_type: 'job', entity_id: job.id, column_key: fromColumnKey }, 200, cors.headers);
    }

    if (fromColumnKey === 'job_scheduled' && toColumnKey === 'job_completed') {
      const { error: jobUpdateError } = await supabaseAdmin
        .from('jobs')
        .update({ status: 'completed', completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', job.id)
        .eq('tenant_id', jwtTenantId);
      if (jobUpdateError) {
        return respondJson({ error: jobUpdateError.message }, 500, cors.headers);
      }
    } else if (fromColumnKey === 'job_completed' && toColumnKey === 'invoice_open') {
      const invoice = await getOrCreateInvoiceForJob(job);
      const { error: jobUpdateError } = await supabaseAdmin
        .from('jobs')
        .update({ status: 'invoiced', updated_at: new Date().toISOString() })
        .eq('id', job.id)
        .eq('tenant_id', jwtTenantId);
      if (jobUpdateError) {
        return respondJson({ error: jobUpdateError.message }, 500, cors.headers);
      }

      await supabaseAdmin.from('kanban_status_events').insert({
        entity_type: 'job',
        entity_id: job.id,
        from_stage: fromColumnKey,
        to_stage: toColumnKey,
        actor_id: actorId,
        metadata: { next_entity_type: 'invoice', next_entity_id: invoice.id },
      });

      return respondJson(
        {
          ok: true,
          entity_type: 'invoice',
          entity_id: invoice.id,
          column_key: 'invoice_open',
          transformed_from: { entity_type: 'job', entity_id: job.id },
        },
        200,
        cors.headers
      );
    } else {
      return respondJson({ error: 'Invalid job transition' }, 400, cors.headers);
    }

    await supabaseAdmin.from('kanban_status_events').insert({
      entity_type: 'job',
      entity_id: job.id,
      from_stage: fromColumnKey,
      to_stage: toColumnKey,
      actor_id: actorId,
      metadata: {},
    });

    return respondJson({ ok: true, entity_type: 'job', entity_id: job.id, column_key: toColumnKey }, 200, cors.headers);
  }

  if (entityType === 'invoice') {
    const { data: invoice, error } = await supabaseAdmin
      .from('invoices')
      .select('id, status, tenant_id')
      .eq('tenant_id', jwtTenantId)
      .eq('id', entityId)
      .maybeSingle();

    if (error || !invoice) {
      return respondJson({ error: 'Invoice not found' }, 404, cors.headers);
    }

    const fromColumnKey = invoiceColumnKey(invoice.status);
    if (!fromColumnKey) {
      return respondJson({ error: 'Invoice is not movable' }, 409, cors.headers);
    }

    if (fromColumnKey === toColumnKey) {
      return respondJson(
        { ok: true, entity_type: 'invoice', entity_id: invoice.id, column_key: fromColumnKey },
        200,
        cors.headers
      );
    }

    return respondJson({ error: 'Invoice transitions must be handled by payments' }, 400, cors.headers);
  }

  return respondJson({ error: 'Unsupported entity_type' }, 400, cors.headers);
});
