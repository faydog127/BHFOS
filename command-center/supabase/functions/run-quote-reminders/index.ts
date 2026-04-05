import { corsHeaders } from '../_shared/cors.ts';
import { getTenantIdFromClaims, getVerifiedClaims } from '../_shared/auth.ts';
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { isWithinBusinessHours, normalizeAutomationDueAt } from '../_shared/businessHours.ts';
import { logMoneyLoopEvent } from '../_shared/moneyLoopUtils.ts';
import { sendEmail, renderEmailLayout, escapeHtml } from '../_shared/email.ts';
import { OPEN_TASK_STATUSES } from '../_shared/taskUtils.ts';

type TaskRow = {
  id: string;
  tenant_id: string;
  source_id: string;
  lead_id: string | null;
  title: string;
  due_at: string | null;
  metadata: Record<string, unknown> | null;
};

type QuoteLeadRow = {
  first_name: string | null;
  last_name: string | null;
  company?: string | null;
  email: string | null;
};

type QuoteRow = {
  id: string;
  tenant_id: string | null;
  quote_number: string | number | null;
  status: string | null;
  total_amount: number | string | null;
  valid_until: string | null;
  public_token: string | null;
  lead_id: string | null;
  leads: QuoteLeadRow | QuoteLeadRow[] | null;
};

const respondJson = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const parseJson = async (req: Request): Promise<Record<string, unknown>> => {
  try {
    const parsed = await req.json();
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
};

const asString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const asNumber = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
};

const normalizeLead = (lead: QuoteLeadRow | QuoteLeadRow[] | null | undefined): QuoteLeadRow | null => {
  if (!lead) return null;
  return Array.isArray(lead) ? lead[0] ?? null : lead;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

const getPublicQuoteBaseUrl = () => (Deno.env.get('PUBLIC_APP_URL') || 'https://app.bhfos.com').replace(/\/$/, '');

const buildQuoteLink = (token: string, tenantId: string) => {
  const url = new URL(`${getPublicQuoteBaseUrl()}/quotes/${token}`);
  url.searchParams.set('tenant_id', tenantId);
  return url.toString();
};

const updateTask = async (taskId: string, patch: Record<string, unknown>) => {
  await supabaseAdmin
    .from('crm_tasks')
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq('id', taskId);
};

const isQuoteAutomationSuspended = async (tenantId: string, quoteId: string, leadId?: string | null) => {
  const entityIds = [quoteId, leadId].filter(Boolean);
  if (!entityIds.length) return false;

  const { data } = await supabaseAdmin
    .from('automation_suspensions')
    .select('id, entity_type, entity_id')
    .eq('tenant_id', tenantId)
    .is('resumed_at', null)
    .in('entity_type', ['quote', 'lead'])
    .in('entity_id', entityIds as string[]);

  return Boolean(data?.length);
};

const isDecisionRecorded = (status: string) =>
  ['accepted', 'approved', 'declined', 'rejected', 'paid', 'converted', 'completed', 'cancelled'].includes(status);

const isExpired = (validUntil: string | null | undefined, at: Date) => {
  if (!validUntil) return false;
  if (/^\d{4}-\d{2}-\d{2}$/.test(validUntil)) {
    const endOfDay = new Date(`${validUntil}T23:59:59.999Z`);
    return endOfDay < at;
  }
  const parsed = new Date(validUntil);
  return !Number.isNaN(parsed.valueOf()) && parsed < at;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return respondJson({ error: 'Method not allowed' }, 405);

  try {
    const body = await parseJson(req);
    const { claims } = await getVerifiedClaims(req);
    const tenantId = asString(body.tenant_id) || getTenantIdFromClaims(claims) || 'tvg';
    const actorId = typeof claims.sub === 'string' ? claims.sub : null;
    const dryRun = body.dry_run === true;
    const limit = Math.max(1, Math.min(50, Number(body.limit) || 25));
    const requestedRunAt = asString(body.run_at);
    const effectiveNow = requestedRunAt ? new Date(requestedRunAt) : new Date();
    if (Number.isNaN(effectiveNow.valueOf())) {
      return respondJson({ error: 'run_at must be a valid ISO datetime when provided.' }, 400);
    }
    const nowIso = effectiveNow.toISOString();

    const { data: tasksRaw, error: tasksError } = await supabaseAdmin
      .from('crm_tasks')
      .select('id, tenant_id, source_id, lead_id, title, due_at, metadata')
      .eq('tenant_id', tenantId)
      .eq('type', 'follow_up')
      .eq('source_type', 'quote')
      .in('status', OPEN_TASK_STATUSES)
      .eq('metadata->>automation_kind', 'quote_reminder_day2')
      .lte('due_at', nowIso)
      .order('due_at', { ascending: true })
      .limit(limit);

    if (tasksError) {
      return respondJson({ error: tasksError.message || 'Failed to load quote reminder tasks.' }, 500);
    }

    const tasks = (tasksRaw || []) as TaskRow[];
    const results: Array<Record<string, unknown>> = [];

    for (const task of tasks) {
      const taskResult: Record<string, unknown> = { task_id: task.id, quote_id: task.source_id, outcome: 'skipped' };
      const metadata = (task.metadata || {}) as Record<string, unknown>;

      const insideBusinessHours = await isWithinBusinessHours({ tenantId, at: nowIso });
      if (!insideBusinessHours) {
        const deferredTo = await normalizeAutomationDueAt({ tenantId, requestedAt: nowIso });
        taskResult.outcome = 'deferred_after_hours';
        taskResult.deferred_to = deferredTo.toISOString();
        if (!dryRun) {
          await updateTask(task.id, {
            due_at: deferredTo.toISOString(),
            metadata: { ...metadata, automation_last_result: 'deferred_after_hours' },
          });
        }
        results.push(taskResult);
        continue;
      }

      const { data: quoteRaw, error: quoteError } = await supabaseAdmin
        .from('quotes')
        .select(`
          id,
          tenant_id,
          quote_number,
          status,
          total_amount,
          valid_until,
          public_token,
          lead_id,
          leads (
            first_name,
            last_name,
            email
          )
        `)
        .eq('id', task.source_id)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (quoteError || !quoteRaw) {
        taskResult.outcome = 'missing_quote';
        if (!dryRun) {
          await updateTask(task.id, {
            status: 'completed',
            metadata: { ...metadata, automation_last_result: 'missing_quote' },
          });
        }
        results.push(taskResult);
        continue;
      }

      const quote = quoteRaw as QuoteRow;
      const quoteStatus = asString(quote.status).toLowerCase();
      if (isDecisionRecorded(quoteStatus)) {
        taskResult.outcome = 'decision_recorded';
        if (!dryRun) {
          await updateTask(task.id, {
            status: 'completed',
            metadata: { ...metadata, automation_last_result: 'decision_recorded' },
          });
        }
        results.push(taskResult);
        continue;
      }

      if (isExpired(quote.valid_until, effectiveNow)) {
        taskResult.outcome = 'expired_quote';
        if (!dryRun) {
          await updateTask(task.id, {
            status: 'completed',
            metadata: { ...metadata, automation_last_result: 'expired_quote' },
          });
        }
        results.push(taskResult);
        continue;
      }

      const suspended = await isQuoteAutomationSuspended(tenantId, quote.id, quote.lead_id);
      if (suspended) {
        taskResult.outcome = 'suppressed_active_suspension';
        if (!dryRun) {
          await updateTask(task.id, {
            status: 'completed',
            metadata: { ...metadata, automation_last_result: 'suppressed_active_suspension' },
          });
        }
        results.push(taskResult);
        continue;
      }

      const lead = normalizeLead(quote.leads);
      const recipientEmail = asString(lead?.email);
      if (!recipientEmail || !recipientEmail.includes('@')) {
        taskResult.outcome = 'missing_recipient';
        if (!dryRun) {
          await updateTask(task.id, {
            status: 'completed',
            metadata: { ...metadata, automation_last_result: 'missing_recipient' },
          });
        }
        results.push(taskResult);
        continue;
      }

      const publicToken = asString(quote.public_token);
      if (!publicToken) {
        taskResult.outcome = 'missing_quote_link';
        if (!dryRun) {
          await updateTask(task.id, {
            status: 'completed',
            metadata: { ...metadata, automation_last_result: 'missing_quote_link' },
          });
        }
        results.push(taskResult);
        continue;
      }

      const quoteLink = buildQuoteLink(publicToken, tenantId);
      const quoteNumber = asString(quote.quote_number) || quote.id;
      const recipientName =
        [asString(lead?.first_name), asString(lead?.last_name)].filter(Boolean).join(' ') || 'Customer';
      const totalAmount = Math.max(asNumber(quote.total_amount), 0);

      const bodyHtml = `
        <p>Hello ${escapeHtml(recipientName)},</p>
        <p>This is a friendly reminder that your quote is ready for review.</p>
        <p><strong>Quote #:</strong> ${escapeHtml(quoteNumber)}</p>
        ${totalAmount > 0 ? `<p><strong>Total:</strong> ${escapeHtml(formatCurrency(totalAmount))}</p>` : ''}
        <p><a href="${quoteLink}" style="display:inline-block; padding:12px 18px; background:#173861; color:#ffffff; text-decoration:none; border-radius:8px; font-weight:600;">Review Quote</a></p>
        <p>If you have any questions, reply to this email and our office will help right away.</p>
      `;

      if (!dryRun) {
        await sendEmail({
          from: 'The Vent Guys Quotes <quotes@vent-guys.com>',
          to: [recipientEmail],
          subject: `Friendly Reminder: Quote #${quoteNumber}`,
          html: renderEmailLayout({
            preheader: `Friendly reminder for Quote #${quoteNumber}`,
            title: `Quote #${quoteNumber}`,
            bodyHtml,
          }),
        });

        await updateTask(task.id, {
          status: 'completed',
          metadata: { ...metadata, automation_last_result: 'sent', last_sent_at: nowIso },
        });

        await logMoneyLoopEvent({
          tenantId,
          entityType: 'quote',
          entityId: quote.id,
          eventType: 'QuoteReminderSent',
          actorType: actorId ? 'user' : 'system',
          actorId,
          payload: {
            reminder_day: 2,
            task_id: task.id,
            recipient_email: recipientEmail,
          },
        });
      }

      taskResult.outcome = 'sent';
      taskResult.recipient_email = recipientEmail;
      results.push(taskResult);
    }

    return respondJson({
      ok: true,
      tenant_id: tenantId,
      processed: results.length,
      dry_run: dryRun,
      run_at: nowIso,
      results,
    });
  } catch (error) {
    console.error('run-quote-reminders failed:', error);
    return respondJson({ error: error instanceof Error ? error.message : 'Internal error' }, 500);
  }
});
