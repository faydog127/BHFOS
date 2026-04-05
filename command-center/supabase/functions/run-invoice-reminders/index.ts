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

type InvoiceLeadRow = {
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  email: string | null;
};

type InvoiceRow = {
  id: string;
  tenant_id: string | null;
  invoice_number: string | number | null;
  status: string | null;
  total_amount: number | string | null;
  balance_due: number | string | null;
  due_date: string | null;
  customer_email: string | null;
  public_token: string | null;
  paid_at: string | null;
  lead_id: string | null;
  leads: InvoiceLeadRow | InvoiceLeadRow[] | null;
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

const normalizeLead = (lead: InvoiceLeadRow | InvoiceLeadRow[] | null | undefined): InvoiceLeadRow | null => {
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

const getPayBaseUrl = () => (Deno.env.get('PUBLIC_PAY_BASE_URL') || 'https://app.bhfos.com').replace(/\/$/, '');

const buildPayLink = (token: string) => `${getPayBaseUrl()}/pay/${token}`;

const updateTask = async (taskId: string, patch: Record<string, unknown>) => {
  await supabaseAdmin
    .from('crm_tasks')
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq('id', taskId);
};

const isInvoiceAutomationSuspended = async (tenantId: string, invoiceId: string, leadId?: string | null) => {
  const entityIds = [invoiceId, leadId].filter(Boolean);
  if (!entityIds.length) return false;

  const { data } = await supabaseAdmin
    .from('automation_suspensions')
    .select('id, entity_type, entity_id')
    .eq('tenant_id', tenantId)
    .is('resumed_at', null)
    .in('entity_type', ['invoice', 'lead'])
    .in('entity_id', entityIds as string[]);

  return Boolean(data?.length);
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
      .eq('source_type', 'invoice')
      .in('status', OPEN_TASK_STATUSES)
      .eq('metadata->>automation_kind', 'invoice_reminder_day2')
      .lte('due_at', nowIso)
      .order('due_at', { ascending: true })
      .limit(limit);

    if (tasksError) {
      return respondJson({ error: tasksError.message || 'Failed to load reminder tasks.' }, 500);
    }

    const tasks = (tasksRaw || []) as TaskRow[];
    const results: Array<Record<string, unknown>> = [];

    for (const task of tasks) {
      const taskResult: Record<string, unknown> = { task_id: task.id, invoice_id: task.source_id, outcome: 'skipped' };
      const metadata = (task.metadata || {}) as Record<string, unknown>;

      const insideBusinessHours = await isWithinBusinessHours({ tenantId, at: nowIso });
      if (!insideBusinessHours) {
        const deferredTo = await normalizeAutomationDueAt({ tenantId, requestedAt: nowIso });
        taskResult.outcome = 'deferred_after_hours';
        taskResult.deferred_to = deferredTo.toISOString();
        if (!dryRun) {
          await updateTask(task.id, {
            due_at: deferredTo.toISOString(),
            metadata: {
              ...metadata,
              automation_last_result: 'deferred_after_hours',
            },
          });
        }
        results.push(taskResult);
        continue;
      }

      const { data: invoiceRaw, error: invoiceError } = await supabaseAdmin
        .from('invoices')
        .select(`
          id,
          tenant_id,
          invoice_number,
          status,
          total_amount,
          balance_due,
          due_date,
          customer_email,
          public_token,
          paid_at,
          lead_id,
          leads (
            first_name,
            last_name,
            company,
            email
          )
        `)
        .eq('id', task.source_id)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (invoiceError || !invoiceRaw) {
        taskResult.outcome = 'missing_invoice';
        if (!dryRun) {
          await updateTask(task.id, {
            status: 'completed',
            metadata: { ...metadata, automation_last_result: 'missing_invoice' },
          });
        }
        results.push(taskResult);
        continue;
      }

      const invoice = invoiceRaw as InvoiceRow;
      const balanceDue = Math.max(asNumber(invoice.balance_due), 0);
      if (invoice.paid_at || balanceDue <= 0 || asString(invoice.status).toLowerCase() === 'paid') {
        taskResult.outcome = 'already_paid';
        if (!dryRun) {
          await updateTask(task.id, {
            status: 'completed',
            metadata: { ...metadata, automation_last_result: 'already_paid' },
          });
        }
        results.push(taskResult);
        continue;
      }

      const suspended = await isInvoiceAutomationSuspended(tenantId, invoice.id, invoice.lead_id);
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

      const lead = normalizeLead(invoice.leads);
      const recipientEmail = asString(invoice.customer_email) || asString(lead?.email);
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

      const payLink = asString(invoice.public_token) ? buildPayLink(asString(invoice.public_token)) : null;
      const invoiceNumber = asString(invoice.invoice_number) || invoice.id;
      const recipientName =
        asString(lead?.company) ||
        [asString(lead?.first_name), asString(lead?.last_name)].filter(Boolean).join(' ') ||
        'Customer';

      const bodyHtml = `
        <p>Hello ${escapeHtml(recipientName)},</p>
        <p>This is a friendly reminder that Invoice #${escapeHtml(invoiceNumber)} is still open.</p>
        <p><strong>Balance Due:</strong> ${escapeHtml(formatCurrency(balanceDue))}</p>
        ${invoice.due_date ? `<p><strong>Due Date:</strong> ${escapeHtml(invoice.due_date)}</p>` : ''}
        ${payLink ? `<p><a href="${payLink}" style="display:inline-block; padding:12px 18px; background:#173861; color:#ffffff; text-decoration:none; border-radius:8px; font-weight:600;">Pay Invoice</a></p>` : ''}
        <p>If you have any questions, reply to this email and our office will help right away.</p>
      `;

      if (!dryRun) {
        await sendEmail({
          from: 'The Vent Guys <info@vent-guys.com>',
          to: [recipientEmail],
          subject: `Friendly Reminder: Invoice #${invoiceNumber}`,
          html: renderEmailLayout({
            preheader: `Reminder for Invoice #${invoiceNumber}`,
            title: `Invoice Reminder #${invoiceNumber}`,
            bodyHtml,
          }),
        });

        await updateTask(task.id, {
          status: 'completed',
          metadata: {
            ...metadata,
            automation_last_result: 'sent',
            automation_sent_at: new Date().toISOString(),
          },
        });

        await logMoneyLoopEvent({
          tenantId,
          entityType: 'invoice',
          entityId: invoice.id,
          eventType: 'InvoiceReminderSent',
          actorType: actorId ? 'user' : 'system',
          actorId,
          payload: {
            task_id: task.id,
            reminder_day: 2,
            recipient_email: recipientEmail,
            balance_due: balanceDue,
          },
        });
      }

      taskResult.outcome = dryRun ? 'would_send' : 'sent';
      taskResult.recipient_email = recipientEmail;
      results.push(taskResult);
    }

    return respondJson({
      success: true,
      tenant_id: tenantId,
      dry_run: dryRun,
      run_at: nowIso,
      processed: results.length,
      results,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal error';
    console.error('run-invoice-reminders failed:', error);
    return respondJson({ error: message }, 500);
  }
});
