import { supabaseAdmin } from '../_lib/supabaseAdmin.ts';
import { createFollowUpTask } from './taskUtils.ts';
import { scheduleAutomationDayOffset } from './businessHours.ts';

type MoneyLoopEventInput = {
  tenantId?: string | null;
  entityType: string;
  entityId: string;
  eventType: string;
  actorType: string;
  actorId?: string | null;
  payload?: Record<string, unknown>;
};

const VIEW_DEDUPE_WINDOW_MINUTES = 5;
const isDuplicateKeyError = (error: { code?: string; message?: string } | null | undefined) =>
  error?.code === '23505';
const formatError = (error: unknown) => (error instanceof Error ? error.message : String(error));

const logMoneyLoopEvent = async (input: MoneyLoopEventInput) => {
  try {
    const { error } = await supabaseAdmin.from('events').insert({
      tenant_id: input.tenantId,
      entity_type: input.entityType,
      entity_id: input.entityId,
      event_type: input.eventType,
      actor_type: input.actorType,
      actor_id: input.actorId ?? null,
      payload: input.payload ?? {},
      created_at: new Date().toISOString(),
    });

    if (!error || isDuplicateKeyError(error)) {
      return;
    }

    console.error('logMoneyLoopEvent failed:', error.message || error);
  } catch (err) {
    console.error('logMoneyLoopEvent failed:', formatError(err));
  }
};

const hasRecentEvent = async (params: {
  entityType: string;
  entityId: string;
  eventType: string;
  windowMinutes?: number;
}) => {
  try {
    const windowMinutes = params.windowMinutes ?? VIEW_DEDUPE_WINDOW_MINUTES;
    const threshold = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
    const { data } = await supabaseAdmin
      .from('events')
      .select('id')
      .eq('entity_type', params.entityType)
      .eq('entity_id', params.entityId)
      .eq('event_type', params.eventType)
      .gte('created_at', threshold)
      .limit(1)
      .maybeSingle();
    return Boolean(data);
  } catch (err) {
    console.error('hasRecentEvent check failed:', formatError(err));
    return false;
  }
};

const hasEvent = async (params: {
  entityType: string;
  entityId: string;
  eventType: string;
}) => {
  try {
    const { data } = await supabaseAdmin
      .from('events')
      .select('id')
      .eq('entity_type', params.entityType)
      .eq('entity_id', params.entityId)
      .eq('event_type', params.eventType)
      .limit(1)
      .maybeSingle();
    return Boolean(data);
  } catch (err) {
    console.error('hasEvent check failed:', formatError(err));
    return false;
  }
};

const upsertAutomationSuspension = async (params: {
  tenantId?: string | null;
  entityType: string;
  entityId: string;
  reason: string;
}) => {
  try {
    const now = new Date().toISOString();
    let query = supabaseAdmin
      .from('automation_suspensions')
      .select('id')
      .eq('entity_type', params.entityType)
      .eq('entity_id', params.entityId)
      .is('resumed_at', null);

    if (params.tenantId) {
      query = query.eq('tenant_id', params.tenantId);
    } else {
      query = query.is('tenant_id', null);
    }

    const { data: existing } = await query.maybeSingle();

    if (existing?.id) {
      await supabaseAdmin
        .from('automation_suspensions')
        .update({ reason: params.reason, suspended_at: now })
        .eq('id', existing.id);
      return;
    }

    await supabaseAdmin.from('automation_suspensions').insert({
      tenant_id: params.tenantId ?? null,
      entity_type: params.entityType,
      entity_id: params.entityId,
      reason: params.reason,
      suspended_at: now,
      resumed_at: null,
    });
  } catch (err) {
    console.error('upsertAutomationSuspension failed:', formatError(err));
  }
};

const convertContactToCustomer = async (params: {
  contactId?: string | null;
  leadId?: string | null;
}) => {
  try {
    let contactId = params.contactId ?? null;
    if (!contactId && params.leadId) {
      const { data: lead } = await supabaseAdmin
        .from('leads')
        .select('contact_id')
        .eq('id', params.leadId)
        .maybeSingle();
      contactId = lead?.contact_id ?? null;
    }

    if (!contactId) {
      return null;
    }

    // Gotcha #2: Only set customer_created_at if not already set (preserve original conversion date)
    const { data: existing } = await supabaseAdmin
      .from('contacts')
      .select('is_customer, customer_created_at')
      .eq('id', contactId)
      .maybeSingle();

    const updateData: Record<string, unknown> = {
      is_customer: true,
      manual_convert_reason: null,
    };

    // Only set timestamp if not already a customer
    if (!existing?.is_customer || !existing?.customer_created_at) {
      updateData.customer_created_at = new Date().toISOString();
    }

    await supabaseAdmin
      .from('contacts')
      .update(updateData)
      .eq('id', contactId);

    return contactId;
  } catch (err) {
    console.error('convertContactToCustomer failed:', formatError(err));
    return null;
  }
};

const createMoneyLoopTask = async (input: {
  tenantId: string;
  sourceType: string;
  sourceId: string;
  title: string;
  leadId?: string | null;
  dueAt?: string | null;
  priority?: string;
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
}) => {
  await createFollowUpTask({
    ...input,
    dueAt: input.dueAt ?? null,
    priority: input.priority ?? 'medium',
    notes: input.notes ?? null,
    metadata: input.metadata ?? {},
  });
};

const enqueueInvoiceReminderLadder = async (params: {
  tenantId: string;
  invoiceId: string;
  leadId?: string | null;
  invoiceNumber?: string | null;
  sentAt?: string | null;
}) => {
  const day2 = await scheduleAutomationDayOffset({
    tenantId: params.tenantId,
    baseAt: params.sentAt,
    dayOffset: 2,
  });
  const day5 = await scheduleAutomationDayOffset({
    tenantId: params.tenantId,
    baseAt: params.sentAt,
    dayOffset: 5,
  });
  const day10 = await scheduleAutomationDayOffset({
    tenantId: params.tenantId,
    baseAt: params.sentAt,
    dayOffset: 10,
  });

  const invoiceNumber = params.invoiceNumber || null;

  await createMoneyLoopTask({
    tenantId: params.tenantId,
    sourceType: 'invoice',
    sourceId: params.invoiceId,
    title: 'Invoice Reminder - Day 2',
    leadId: params.leadId ?? null,
    dueAt: day2.toISOString(),
    priority: 'medium',
    metadata: {
      automation_kind: 'invoice_reminder_day2',
      day_offset: 2,
      invoice_number: invoiceNumber,
    },
  });

  await createMoneyLoopTask({
    tenantId: params.tenantId,
    sourceType: 'invoice',
    sourceId: params.invoiceId,
    title: 'Invoice Follow Up - Day 5 Call',
    leadId: params.leadId ?? null,
    dueAt: day5.toISOString(),
    priority: 'high',
    notes: 'Manual call task if invoice is still unpaid on day 5.',
    metadata: {
      automation_kind: 'invoice_day5_call',
      day_offset: 5,
      invoice_number: invoiceNumber,
    },
  });

  await createMoneyLoopTask({
    tenantId: params.tenantId,
    sourceType: 'invoice',
    sourceId: params.invoiceId,
    title: 'Invoice Escalation - Day 10',
    leadId: params.leadId ?? null,
    dueAt: day10.toISOString(),
    priority: 'high',
    notes: 'Final reminder note and manual escalation if invoice remains unpaid on day 10.',
    metadata: {
      automation_kind: 'invoice_day10_escalation',
      day_offset: 10,
      invoice_number: invoiceNumber,
    },
  });
};

const enqueueQuoteReminderTask = async (params: {
  tenantId: string;
  quoteId: string;
  leadId?: string | null;
  quoteNumber?: string | null;
  sentAt?: string | null;
}) => {
  const day2 = await scheduleAutomationDayOffset({
    tenantId: params.tenantId,
    baseAt: params.sentAt,
    dayOffset: 2,
  });

  await createMoneyLoopTask({
    tenantId: params.tenantId,
    sourceType: 'quote',
    sourceId: params.quoteId,
    title: 'Quote Reminder - Day 2',
    leadId: params.leadId ?? null,
    dueAt: day2.toISOString(),
    priority: 'medium',
    metadata: {
      automation_kind: 'quote_reminder_day2',
      day_offset: 2,
      quote_number: params.quoteNumber || null,
    },
  });
};

const ensureSuspension = async (params: {
  tenantId?: string | null;
  entityType: string;
  entityId: string;
  reason: string;
}) => {
  try {
    const now = new Date().toISOString();
    let query = supabaseAdmin
      .from('automation_suspensions')
      .select('id')
      .eq('entity_type', params.entityType)
      .eq('entity_id', params.entityId)
      .is('resumed_at', null);

    if (params.tenantId) {
      query = query.eq('tenant_id', params.tenantId);
    } else {
      query = query.is('tenant_id', null);
    }

    const { data: existing } = await query.maybeSingle();

    if (existing?.id) {
      // Already suspended, just update
      await supabaseAdmin
        .from('automation_suspensions')
        .update({ reason: params.reason, suspended_at: now })
        .eq('id', existing.id);
      return;
    }

    // New suspension - insert and emit event
    await supabaseAdmin.from('automation_suspensions').insert({
      tenant_id: params.tenantId ?? null,
      entity_type: params.entityType,
      entity_id: params.entityId,
      reason: params.reason,
      suspended_at: now,
      resumed_at: null,
    });

    // Emit AutomationSuspended event
    await logMoneyLoopEvent({
      tenantId: params.tenantId,
      entityType: params.entityType,
      entityId: params.entityId,
      eventType: 'AutomationSuspended',
      actorType: 'system',
      payload: { reason: params.reason },
    });
  } catch (err) {
    console.error('ensureSuspension failed:', formatError(err));
  }
};

export {
  createMoneyLoopTask,
  convertContactToCustomer,
  enqueueInvoiceReminderLadder,
  enqueueQuoteReminderTask,
  ensureSuspension,
  hasEvent,
  hasRecentEvent,
  logMoneyLoopEvent,
  upsertAutomationSuspension,
  VIEW_DEDUPE_WINDOW_MINUTES,
};
