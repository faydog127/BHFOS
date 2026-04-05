import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import {
  createAdminClient,
  createRunId,
} from '../tests/smoke/helpers/supabaseAdmin.js';

const RUN_AT_IN_HOURS = '2026-03-18T15:00:00.000Z';
const RUN_AT_AFTER_HOURS = '2026-03-18T23:00:00.000Z';

const parseEnvFile = (envPath) => {
  if (!fs.existsSync(envPath)) return {};
  const raw = fs.readFileSync(envPath, 'utf8');
  const out = {};
  raw.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const idx = trimmed.indexOf('=');
    if (idx === -1) return;
    out[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
  });
  return out;
};

const env = {
  ...parseEnvFile(path.join(process.cwd(), '.env')),
  ...parseEnvFile(path.join(process.cwd(), '.env.local')),
};

const anonKey = process.env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
if (!anonKey) {
  throw new Error('Missing VITE_SUPABASE_ANON_KEY for function invocation.');
}

const { client: admin, env: adminEnv } = createAdminClient();
const supabaseUrl = adminEnv.supabaseUrl;
const tenantId = `appendixa-proof-${Date.now()}`;
const runId = createRunId();
const randomUuid = () => crypto.randomUUID();

const assertTrue = (condition, message, details = undefined) => {
  if (!condition) {
    const error = new Error(message);
    if (details !== undefined) error.details = details;
    throw error;
  }
};

const invokeFunction = async ({ functionName, accessToken, body }) => {
  const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
      'x-tenant-id': tenantId,
    },
    body: JSON.stringify(body),
  });
  const json = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, json };
};

const invokePublicFunction = async ({ functionName, query = {} }) => {
  const url = new URL(`${supabaseUrl}/functions/v1/${functionName}`);
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      apikey: anonKey,
      'x-tenant-id': tenantId,
    },
  });
  const json = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, json };
};

const createTempSession = async () => {
  const client = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const email = `appendix.a.${Date.now()}@proof.local`;
  const password = 'Passw0rd!AppendixA1';

  const { data: createdUser, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { tenant_id: tenantId },
  });
  if (createError) throw createError;

  const userId = createdUser?.user?.id;
  const { data: signInData, error: signInError } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError) throw signInError;

  const accessToken = signInData?.session?.access_token;
  if (!accessToken) throw new Error('Failed to get access token for proof user.');

  return {
    accessToken,
    cleanup: async () => {
      if (userId) {
        await admin.auth.admin.deleteUser(userId);
      }
    },
  };
};

const createScenarioInvoice = async (label) => {
  const createdAt = new Date().toISOString();
  const email = `${label}.${runId}@example.com`;
  const { data: leadRow, error: leadError } = await admin
    .from('leads')
    .insert({
      tenant_id: tenantId,
      first_name: 'Appendix',
      last_name: `Proof ${label}`,
      email,
      phone: '3215550199',
      service: 'residential',
      source: 'APPENDIX_A_PROOF',
      status: 'new',
      stage: 'new',
      persona: 'homeowner',
      is_partner: false,
      created_at: createdAt,
      updated_at: createdAt,
    })
    .select('id')
    .single();
  if (leadError) throw leadError;
  const leadId = leadRow.id;

  const { data: quoteRow, error: quoteError } = await admin
    .from('quotes')
    .insert({
      lead_id: leadId,
      quote_number: `APPA-${label}-${Date.now()}`,
      status: 'draft',
      subtotal: 200,
      tax_rate: 0.07,
      tax_amount: 14,
      total_amount: 214,
      valid_until: '2026-03-31',
      header_text: `Appendix A proof quote ${label}`,
      footer_text: 'Appendix A automation proof',
      public_token: randomUuid(),
      customer_email: email,
      tenant_id: tenantId,
      created_at: createdAt,
      updated_at: createdAt,
    })
    .select('id')
    .single();
  if (quoteError) throw quoteError;
  const quoteId = quoteRow.id;

  const { error: quoteItemError } = await admin
    .from('quote_items')
    .insert({
      quote_id: quoteId,
      description: 'Appendix A proof service',
      quantity: 1,
      unit_price: 200,
      total_price: 200,
      tenant_id: tenantId,
      created_at: createdAt,
      updated_at: createdAt,
    });
  if (quoteItemError) throw quoteItemError;

  const { data: jobRow, error: jobError } = await admin
    .from('jobs')
    .insert({
      tenant_id: tenantId,
      lead_id: leadId,
      quote_id: quoteId,
      status: 'unscheduled',
      payment_status: 'unpaid',
      total_amount: 214,
      service_address: '123 Proof St, Titusville, FL 32780',
      access_notes: `Appendix A proof ${label}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (jobError) throw jobError;
  const jobId = jobRow.id;

  const { data: invoiceRow, error: invoiceError } = await admin
    .from('invoices')
    .insert({
      tenant_id: tenantId,
      lead_id: leadId,
      quote_id: quoteId,
      job_id: jobId,
      invoice_number: `INV-${label}-${Date.now()}`,
      status: 'draft',
      issue_date: '2026-03-18',
      due_date: '2026-04-01',
      subtotal: 200,
      tax_rate: 0.07,
      tax_amount: 14,
      total_amount: 214,
      amount_paid: 0,
      balance_due: 214,
      notes: `Appendix A proof invoice ${label}`,
      terms: 'Payment due upon receipt.',
      public_token: randomUuid(),
      customer_email: email,
      invoice_type: 'final',
      release_approved: false,
      created_at: createdAt,
      updated_at: createdAt,
    })
    .select('id')
    .single();
  if (invoiceError) throw invoiceError;
  const invoiceId = invoiceRow.id;

  const { error: invoiceItemError } = await admin
    .from('invoice_items')
    .insert({
      invoice_id: invoiceId,
      description: 'Appendix A proof service',
      quantity: 1,
      unit_price: 214,
      total_price: 214,
      tenant_id: tenantId,
      created_at: createdAt,
      updated_at: createdAt,
    });
  if (invoiceItemError) throw invoiceItemError;

  return { leadId, quoteId, jobId, invoiceId };
};

const createScenarioQuote = async (label) => {
  const createdAt = new Date().toISOString();
  const email = `${label}.${runId}@example.com`;
  const { data: leadRow, error: leadError } = await admin
    .from('leads')
    .insert({
      tenant_id: tenantId,
      first_name: 'Appendix',
      last_name: `Quote ${label}`,
      email,
      phone: '3215550200',
      service: 'residential',
      source: 'APPENDIX_A_PROOF',
      status: 'new',
      stage: 'new',
      persona: 'homeowner',
      is_partner: false,
      created_at: createdAt,
      updated_at: createdAt,
    })
    .select('id')
    .single();
  if (leadError) throw leadError;
  const leadId = leadRow.id;

  const publicToken = randomUuid();
  const { data: quoteRow, error: quoteError } = await admin
    .from('quotes')
    .insert({
      lead_id: leadId,
      quote_number: `Q-${label}-${Date.now()}`,
      status: 'draft',
      subtotal: 200,
      tax_rate: 0.07,
      tax_amount: 14,
      total_amount: 214,
      valid_until: '2026-03-31',
      header_text: `Appendix A proof quote ${label}`,
      footer_text: 'Appendix A quote reminder proof',
      public_token: publicToken,
      customer_email: email,
      service_address: '456 Quote St, Titusville, FL 32780',
      tenant_id: tenantId,
      created_at: createdAt,
      updated_at: createdAt,
    })
    .select('id')
    .single();
  if (quoteError) throw quoteError;
  const quoteId = quoteRow.id;

  const { error: quoteItemError } = await admin
    .from('quote_items')
    .insert({
      quote_id: quoteId,
      description: 'Appendix A quote reminder service',
      quantity: 1,
      unit_price: 200,
      total_price: 200,
      tenant_id: tenantId,
      created_at: createdAt,
      updated_at: createdAt,
    });
  if (quoteItemError) throw quoteItemError;

  return { leadId, quoteId, publicToken };
};

const getSourceTasks = async (sourceType, sourceId) => {
  const { data, error } = await admin
    .from('crm_tasks')
    .select('id, title, status, due_at, metadata')
    .eq('tenant_id', tenantId)
    .eq('source_type', sourceType)
    .eq('source_id', sourceId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
};

const setTaskDueAt = async (taskId, dueAt) => {
  const { error } = await admin
    .from('crm_tasks')
    .update({ due_at: dueAt, updated_at: new Date().toISOString() })
    .eq('id', taskId);
  if (error) throw error;
};

const markInvoicePaid = async (invoiceId) => {
  const { error } = await admin
    .from('invoices')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      amount_paid: 214,
      balance_due: 0,
      updated_at: new Date().toISOString(),
    })
    .eq('id', invoiceId);
  if (error) throw error;
};

const createSuspension = async (invoiceId) => {
  const { error } = await admin
    .from('automation_suspensions')
    .insert({
      tenant_id: tenantId,
      entity_type: 'invoice',
      entity_id: invoiceId,
      reason: 'appendix_a_proof_human_signal',
      suspended_at: new Date().toISOString(),
      resumed_at: null,
    });
  if (error) throw error;
};

const countEvents = async (entityType, entityId, eventType) => {
  const { count, error } = await admin
    .from('events')
    .select('id', { count: 'exact', head: true })
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .eq('event_type', eventType);
  if (error) throw error;
  return count || 0;
};

const getTaskByTitle = async (sourceType, sourceId, title) => {
  const tasks = await getSourceTasks(sourceType, sourceId);
  return tasks.find((task) => task.title === title) || null;
};

const assertLadderCreated = async (invoiceId) => {
  const tasks = await getSourceTasks('invoice', invoiceId);
  const titles = tasks.map((task) => task.title);
  assertTrue(titles.includes('Invoice Reminder - Day 2'), 'Missing Day 2 reminder task.', titles);
  assertTrue(titles.includes('Invoice Follow Up - Day 5 Call'), 'Missing Day 5 call task.', titles);
  assertTrue(titles.includes('Invoice Escalation - Day 10'), 'Missing Day 10 escalation task.', titles);
  return tasks;
};

const summary = {
  tenant_id: tenantId,
  run_id: runId,
  send_invoice: null,
  day2_send: null,
  stop_on_paid: null,
  suppression: null,
  after_hours: null,
  quote_send: null,
  quote_day2_send: null,
  quote_suppression: null,
  quote_after_hours: null,
};

const { accessToken, cleanup } = await createTempSession();

try {
  const sendScenario = await createScenarioInvoice('send');
  const sendInvoiceResult = await invokeFunction({
    functionName: 'send-invoice',
    accessToken,
    body: {
      invoice_id: sendScenario.invoiceId,
      tenant_id: tenantId,
      to_email: `send.${runId}@example.com`,
    },
  });
  assertTrue(sendInvoiceResult.ok, 'send-invoice failed for primary scenario.', sendInvoiceResult);
  const ladderTasks = await assertLadderCreated(sendScenario.invoiceId);
  const invoiceSentEvents = await countEvents('invoice', sendScenario.invoiceId, 'InvoiceSent');
  assertTrue(invoiceSentEvents >= 1, 'InvoiceSent event missing after send-invoice.', { invoiceSentEvents });
  summary.send_invoice = {
    invoice_id: sendScenario.invoiceId,
    ladder_titles: ladderTasks.map((task) => task.title),
    invoice_sent_events: invoiceSentEvents,
    provider_response: sendInvoiceResult.json,
  };

  const day2Task = await getTaskByTitle('invoice', sendScenario.invoiceId, 'Invoice Reminder - Day 2');
  assertTrue(day2Task?.id, 'Could not find Day 2 task for send scenario.');
  await setTaskDueAt(day2Task.id, RUN_AT_IN_HOURS);

  const runnerSend = await invokeFunction({
    functionName: 'run-invoice-reminders',
    accessToken,
    body: {
      tenant_id: tenantId,
      run_at: RUN_AT_IN_HOURS,
      limit: 25,
    },
  });
  assertTrue(runnerSend.ok, 'run-invoice-reminders failed for send scenario.', runnerSend);
  const sendOutcome = runnerSend.json?.results?.find?.((row) => row.invoice_id === sendScenario.invoiceId)?.outcome;
  assertTrue(sendOutcome === 'sent', 'Day 2 reminder did not send in-hours.', runnerSend.json);
  const day2TaskAfter = await getTaskByTitle('invoice', sendScenario.invoiceId, 'Invoice Reminder - Day 2');
  assertTrue(day2TaskAfter?.status === 'completed', 'Day 2 task was not completed after send.', day2TaskAfter);
  const reminderEvents = await countEvents('invoice', sendScenario.invoiceId, 'InvoiceReminderSent');
  assertTrue(reminderEvents >= 1, 'InvoiceReminderSent event missing after runner send.', { reminderEvents });
  summary.day2_send = {
    invoice_id: sendScenario.invoiceId,
    outcome: sendOutcome,
    reminder_events: reminderEvents,
  };

  const paidScenario = await createScenarioInvoice('paid');
  const paidSend = await invokeFunction({
    functionName: 'send-invoice',
    accessToken,
    body: {
      invoice_id: paidScenario.invoiceId,
      tenant_id: tenantId,
      to_email: `paid.${runId}@example.com`,
    },
  });
  assertTrue(paidSend.ok, 'send-invoice failed for paid scenario.', paidSend);
  const paidDay2 = await getTaskByTitle('invoice', paidScenario.invoiceId, 'Invoice Reminder - Day 2');
  assertTrue(paidDay2?.id, 'Missing Day 2 task for paid scenario.');
  await setTaskDueAt(paidDay2.id, RUN_AT_IN_HOURS);
  await markInvoicePaid(paidScenario.invoiceId);
  const beforePaidReminderEvents = await countEvents('invoice', paidScenario.invoiceId, 'InvoiceReminderSent');
  const runnerPaid = await invokeFunction({
    functionName: 'run-invoice-reminders',
    accessToken,
    body: {
      tenant_id: tenantId,
      run_at: RUN_AT_IN_HOURS,
      limit: 25,
    },
  });
  assertTrue(runnerPaid.ok, 'run-invoice-reminders failed for paid scenario.', runnerPaid);
  const paidOutcome = runnerPaid.json?.results?.find?.((row) => row.invoice_id === paidScenario.invoiceId)?.outcome;
  assertTrue(paidOutcome === 'already_paid', 'Runner did not stop on paid invoice.', runnerPaid.json);
  const afterPaidReminderEvents = await countEvents('invoice', paidScenario.invoiceId, 'InvoiceReminderSent');
  assertTrue(afterPaidReminderEvents === beforePaidReminderEvents, 'Reminder event emitted after invoice was paid.', {
    beforePaidReminderEvents,
    afterPaidReminderEvents,
  });
  summary.stop_on_paid = {
    invoice_id: paidScenario.invoiceId,
    outcome: paidOutcome,
    reminder_events_before: beforePaidReminderEvents,
    reminder_events_after: afterPaidReminderEvents,
  };

  const suppressedScenario = await createScenarioInvoice('suspended');
  const suppressedSend = await invokeFunction({
    functionName: 'send-invoice',
    accessToken,
    body: {
      invoice_id: suppressedScenario.invoiceId,
      tenant_id: tenantId,
      to_email: `suspended.${runId}@example.com`,
    },
  });
  assertTrue(suppressedSend.ok, 'send-invoice failed for suppression scenario.', suppressedSend);
  const suppressedDay2 = await getTaskByTitle('invoice', suppressedScenario.invoiceId, 'Invoice Reminder - Day 2');
  assertTrue(suppressedDay2?.id, 'Missing Day 2 task for suppression scenario.');
  await setTaskDueAt(suppressedDay2.id, RUN_AT_IN_HOURS);
  await createSuspension(suppressedScenario.invoiceId);
  const beforeSuppressedEvents = await countEvents('invoice', suppressedScenario.invoiceId, 'InvoiceReminderSent');
  const runnerSuppressed = await invokeFunction({
    functionName: 'run-invoice-reminders',
    accessToken,
    body: {
      tenant_id: tenantId,
      run_at: RUN_AT_IN_HOURS,
      limit: 25,
    },
  });
  assertTrue(runnerSuppressed.ok, 'run-invoice-reminders failed for suppression scenario.', runnerSuppressed);
  const suppressedOutcome = runnerSuppressed.json?.results?.find?.((row) => row.invoice_id === suppressedScenario.invoiceId)?.outcome;
  assertTrue(
    suppressedOutcome === 'suppressed_active_suspension',
    'Runner did not suppress after human-signal suspension.',
    runnerSuppressed.json,
  );
  const afterSuppressedEvents = await countEvents('invoice', suppressedScenario.invoiceId, 'InvoiceReminderSent');
  assertTrue(afterSuppressedEvents === beforeSuppressedEvents, 'Reminder event emitted despite active suspension.', {
    beforeSuppressedEvents,
    afterSuppressedEvents,
  });
  summary.suppression = {
    invoice_id: suppressedScenario.invoiceId,
    outcome: suppressedOutcome,
  };

  const afterHoursScenario = await createScenarioInvoice('afterhours');
  const afterHoursSend = await invokeFunction({
    functionName: 'send-invoice',
    accessToken,
    body: {
      invoice_id: afterHoursScenario.invoiceId,
      tenant_id: tenantId,
      to_email: `afterhours.${runId}@example.com`,
    },
  });
  assertTrue(afterHoursSend.ok, 'send-invoice failed for after-hours scenario.', afterHoursSend);
  const afterHoursDay2 = await getTaskByTitle('invoice', afterHoursScenario.invoiceId, 'Invoice Reminder - Day 2');
  assertTrue(afterHoursDay2?.id, 'Missing Day 2 task for after-hours scenario.');
  const beforeDueAt = '2026-03-18T22:30:00.000Z';
  await setTaskDueAt(afterHoursDay2.id, beforeDueAt);
  const runnerAfterHours = await invokeFunction({
    functionName: 'run-invoice-reminders',
    accessToken,
    body: {
      tenant_id: tenantId,
      run_at: RUN_AT_AFTER_HOURS,
      limit: 25,
    },
  });
  assertTrue(runnerAfterHours.ok, 'run-invoice-reminders failed for after-hours scenario.', runnerAfterHours);
  const afterHoursResult = runnerAfterHours.json?.results?.find?.((row) => row.invoice_id === afterHoursScenario.invoiceId);
  assertTrue(afterHoursResult?.outcome === 'deferred_after_hours', 'Runner did not defer after hours.', runnerAfterHours.json);
  const afterHoursTaskAfter = await getTaskByTitle('invoice', afterHoursScenario.invoiceId, 'Invoice Reminder - Day 2');
  assertTrue(afterHoursTaskAfter?.due_at && afterHoursTaskAfter.due_at > beforeDueAt, 'After-hours deferral did not move due_at forward.', afterHoursTaskAfter);
  summary.after_hours = {
    invoice_id: afterHoursScenario.invoiceId,
    outcome: afterHoursResult.outcome,
    before_due_at: beforeDueAt,
    after_due_at: afterHoursTaskAfter.due_at,
  };

  const quoteSendScenario = await createScenarioQuote('quote-send');
  const quoteSendResult = await invokeFunction({
    functionName: 'send-estimate',
    accessToken,
    body: {
      quote_id: quoteSendScenario.quoteId,
      tenant_id: tenantId,
      to_email: `quote-send.${runId}@example.com`,
    },
  });
  assertTrue(quoteSendResult.ok, 'send-estimate failed for quote reminder scenario.', quoteSendResult);
  const quoteSentEvents = await countEvents('quote', quoteSendScenario.quoteId, 'QuoteSent');
  assertTrue(quoteSentEvents >= 1, 'QuoteSent event missing after send-estimate.', { quoteSentEvents });
  const quoteDay2Task = await getTaskByTitle('quote', quoteSendScenario.quoteId, 'Quote Reminder - Day 2');
  assertTrue(quoteDay2Task?.id, 'Missing Day 2 quote reminder task.', quoteDay2Task);
  summary.quote_send = {
    quote_id: quoteSendScenario.quoteId,
    quote_sent_events: quoteSentEvents,
    provider_response: quoteSendResult.json,
  };

  await setTaskDueAt(quoteDay2Task.id, RUN_AT_IN_HOURS);
  const quoteRunnerSend = await invokeFunction({
    functionName: 'run-quote-reminders',
    accessToken,
    body: {
      tenant_id: tenantId,
      run_at: RUN_AT_IN_HOURS,
      limit: 25,
    },
  });
  assertTrue(quoteRunnerSend.ok, 'run-quote-reminders failed for send scenario.', quoteRunnerSend);
  const quoteSendOutcome = quoteRunnerSend.json?.results?.find?.((row) => row.quote_id === quoteSendScenario.quoteId)?.outcome;
  assertTrue(quoteSendOutcome === 'sent', 'Day 2 quote reminder did not send in-hours.', quoteRunnerSend.json);
  const quoteDay2TaskAfter = await getTaskByTitle('quote', quoteSendScenario.quoteId, 'Quote Reminder - Day 2');
  assertTrue(quoteDay2TaskAfter?.status === 'completed', 'Day 2 quote reminder task was not completed after send.', quoteDay2TaskAfter);
  const quoteReminderEvents = await countEvents('quote', quoteSendScenario.quoteId, 'QuoteReminderSent');
  assertTrue(quoteReminderEvents >= 1, 'QuoteReminderSent event missing after runner send.', { quoteReminderEvents });
  summary.quote_day2_send = {
    quote_id: quoteSendScenario.quoteId,
    outcome: quoteSendOutcome,
    reminder_events: quoteReminderEvents,
  };

  const quoteSuppressedScenario = await createScenarioQuote('quote-suppressed');
  const quoteSuppressedSend = await invokeFunction({
    functionName: 'send-estimate',
    accessToken,
    body: {
      quote_id: quoteSuppressedScenario.quoteId,
      tenant_id: tenantId,
      to_email: `quote-suppressed.${runId}@example.com`,
    },
  });
  assertTrue(quoteSuppressedSend.ok, 'send-estimate failed for quote suppression scenario.', quoteSuppressedSend);
  const quoteSuppressedTask = await getTaskByTitle('quote', quoteSuppressedScenario.quoteId, 'Quote Reminder - Day 2');
  assertTrue(quoteSuppressedTask?.id, 'Missing Day 2 quote reminder task for suppression scenario.');
  await setTaskDueAt(quoteSuppressedTask.id, RUN_AT_IN_HOURS);
  const quoteViewResult = await invokePublicFunction({
    functionName: 'public-quote',
    query: {
      token: quoteSuppressedScenario.publicToken,
      tenant_id: tenantId,
      view: 'json',
    },
  });
  assertTrue(quoteViewResult.ok, 'public-quote failed for suppression scenario.', quoteViewResult);
  const beforeQuoteSuppressedEvents = await countEvents('quote', quoteSuppressedScenario.quoteId, 'QuoteReminderSent');
  const quoteRunnerSuppressed = await invokeFunction({
    functionName: 'run-quote-reminders',
    accessToken,
    body: {
      tenant_id: tenantId,
      run_at: RUN_AT_IN_HOURS,
      limit: 25,
    },
  });
  assertTrue(quoteRunnerSuppressed.ok, 'run-quote-reminders failed for suppression scenario.', quoteRunnerSuppressed);
  const quoteSuppressedOutcome = quoteRunnerSuppressed.json?.results?.find?.((row) => row.quote_id === quoteSuppressedScenario.quoteId)?.outcome;
  assertTrue(
    quoteSuppressedOutcome === 'suppressed_active_suspension',
    'Quote reminder did not suppress after public quote view.',
    quoteRunnerSuppressed.json,
  );
  const afterQuoteSuppressedEvents = await countEvents('quote', quoteSuppressedScenario.quoteId, 'QuoteReminderSent');
  assertTrue(afterQuoteSuppressedEvents === beforeQuoteSuppressedEvents, 'Quote reminder event emitted despite active suspension.', {
    beforeQuoteSuppressedEvents,
    afterQuoteSuppressedEvents,
  });
  summary.quote_suppression = {
    quote_id: quoteSuppressedScenario.quoteId,
    outcome: quoteSuppressedOutcome,
  };

  const quoteAfterHoursScenario = await createScenarioQuote('quote-afterhours');
  const quoteAfterHoursSend = await invokeFunction({
    functionName: 'send-estimate',
    accessToken,
    body: {
      quote_id: quoteAfterHoursScenario.quoteId,
      tenant_id: tenantId,
      to_email: `quote-afterhours.${runId}@example.com`,
    },
  });
  assertTrue(quoteAfterHoursSend.ok, 'send-estimate failed for quote after-hours scenario.', quoteAfterHoursSend);
  const quoteAfterHoursTask = await getTaskByTitle('quote', quoteAfterHoursScenario.quoteId, 'Quote Reminder - Day 2');
  assertTrue(quoteAfterHoursTask?.id, 'Missing Day 2 quote reminder task for after-hours scenario.');
  const quoteBeforeDueAt = '2026-03-18T22:30:00.000Z';
  await setTaskDueAt(quoteAfterHoursTask.id, quoteBeforeDueAt);
  const quoteRunnerAfterHours = await invokeFunction({
    functionName: 'run-quote-reminders',
    accessToken,
    body: {
      tenant_id: tenantId,
      run_at: RUN_AT_AFTER_HOURS,
      limit: 25,
    },
  });
  assertTrue(quoteRunnerAfterHours.ok, 'run-quote-reminders failed for after-hours scenario.', quoteRunnerAfterHours);
  const quoteAfterHoursResult = quoteRunnerAfterHours.json?.results?.find?.((row) => row.quote_id === quoteAfterHoursScenario.quoteId);
  assertTrue(
    quoteAfterHoursResult?.outcome === 'deferred_after_hours',
    'Quote reminder did not defer after hours.',
    quoteRunnerAfterHours.json,
  );
  const quoteAfterHoursTaskAfter = await getTaskByTitle('quote', quoteAfterHoursScenario.quoteId, 'Quote Reminder - Day 2');
  assertTrue(
    quoteAfterHoursTaskAfter?.due_at && quoteAfterHoursTaskAfter.due_at > quoteBeforeDueAt,
    'Quote after-hours deferral did not move due_at forward.',
    quoteAfterHoursTaskAfter,
  );
  summary.quote_after_hours = {
    quote_id: quoteAfterHoursScenario.quoteId,
    outcome: quoteAfterHoursResult.outcome,
    before_due_at: quoteBeforeDueAt,
    after_due_at: quoteAfterHoursTaskAfter.due_at,
  };

  console.log(JSON.stringify({ ok: true, summary }, null, 2));
} finally {
  await cleanup();
}
