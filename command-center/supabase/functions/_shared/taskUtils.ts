import { supabaseAdmin } from '../_lib/supabaseAdmin.ts';
import { normalizeAutomationDueAt } from './businessHours.ts';

const OPEN_TASK_STATUSES = ['open', 'new', 'pending', 'PENDING', 'in-progress'] as const;

type CloseFollowUpInput = {
  tenantId: string;
  sourceType?: string | null;
  sourceId?: string | null;
  leadId?: string | null;
};

type CreateFollowUpTaskInput = {
  tenantId: string;
  sourceType: string;
  sourceId: string;
  title: string;
  leadId?: string | null;
  dueAt?: string | null;
  priority?: string;
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
};

const formatError = (error: unknown) => (error instanceof Error ? error.message : String(error));

const closeFollowUpTasks = async ({ tenantId, sourceType, sourceId, leadId }: CloseFollowUpInput) => {
  let query = supabaseAdmin
    .from('crm_tasks')
    .update({ status: 'completed', updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('type', 'follow_up')
    .in('status', OPEN_TASK_STATUSES);

  if (sourceType && sourceId) {
    query = query.eq('source_type', sourceType).eq('source_id', sourceId);
  }

  if (leadId) {
    query = query.eq('lead_id', leadId);
  }

  const { error } = await query;
  if (error) {
    throw error;
  }
};

const createFollowUpTask = async ({
  tenantId,
  sourceType,
  sourceId,
  title,
  leadId = null,
  dueAt = null,
  priority = 'medium',
  notes = null,
  metadata = {},
}: CreateFollowUpTaskInput) => {
  const now = new Date().toISOString();
  try {
    const resolvedDueAt = (await normalizeAutomationDueAt({
      tenantId,
      requestedAt: dueAt || now,
    })).toISOString();

    const { data: existing } = await supabaseAdmin
      .from('crm_tasks')
      .select('id, due_at, priority, notes, metadata')
      .eq('tenant_id', tenantId)
      .eq('source_type', sourceType)
      .eq('source_id', sourceId)
      .eq('title', title)
      .in('status', OPEN_TASK_STATUSES)
      .maybeSingle();

    if (existing?.id) {
      const mergedMetadata = {
        ...((existing.metadata as Record<string, unknown> | null) || {}),
        ...(metadata || {}),
      };
      const patch: Record<string, unknown> = { updated_at: now };
      if (existing.due_at !== resolvedDueAt) patch.due_at = resolvedDueAt;
      if (existing.priority !== priority) patch.priority = priority;
      if ((existing.notes || null) !== notes) patch.notes = notes;
      if (JSON.stringify((existing.metadata as Record<string, unknown> | null) || {}) !== JSON.stringify(mergedMetadata)) {
        patch.metadata = mergedMetadata;
      }

      if (Object.keys(patch).length > 1) {
        await supabaseAdmin.from('crm_tasks').update(patch).eq('id', existing.id);
      }
      return;
    }

    const { data: newTask, error } = await supabaseAdmin.from('crm_tasks').insert({
      tenant_id: tenantId,
      lead_id: leadId,
      source_type: sourceType,
      source_id: sourceId,
      type: 'follow_up',
      title,
      status: 'open',
      priority,
      notes,
      metadata,
      due_at: resolvedDueAt,
      created_at: now,
      updated_at: now,
    }).select('id').single();

    if (error) {
      throw error;
    }

    // Emit TaskCreated event
    if (newTask?.id) {
      try {
        await supabaseAdmin.from('events').insert({
          tenant_id: tenantId,
          entity_type: 'task',
          entity_id: newTask.id,
          event_type: 'TaskCreated',
          actor_type: 'system',
          payload: { source_type: sourceType, source_id: sourceId, title },
          created_at: now,
        });
      } catch (eventErr) {
        console.error('TaskCreated event failed:', formatError(eventErr));
      }
    }
  } catch (err) {
    console.error('createFollowUpTask failed:', formatError(err));
  }
};

export { closeFollowUpTasks, createFollowUpTask, OPEN_TASK_STATUSES };
