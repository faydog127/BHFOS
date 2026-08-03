/**
 * MIL audit durability (Phase 2A final remediation).
 *
 * Essential mutations MUST create the audit event or durable outbox row in the
 * same database transaction as the business write (SECURITY DEFINER RPCs /
 * triggers). Edge helpers must not mutate then enqueue in a second request.
 */
import { supabaseAdmin } from './supabaseAdmin.ts'

export type MilAuditClassification = 'essential' | 'access'

export type MilAuditRecord = {
  actorUserId: string | null
  action: string
  targetType: string
  targetId?: string | null
  details?: Record<string, unknown>
  idempotencyKey?: string
}

/** Access/advisory — never throws. */
export async function persistAccessAudit(record: MilAuditRecord): Promise<boolean> {
  const key = record.idempotencyKey
    || `${record.action}:${record.targetId || 'none'}:${crypto.randomUUID()}`
  const { data, error } = await supabaseAdmin.rpc('mil_record_access_audit', {
    p_actor_id: record.actorUserId,
    p_action: record.action,
    p_target_type: record.targetType,
    p_target_id: record.targetId || null,
    p_details: { ...(record.details || {}), secrets_redacted: true },
    p_idempotency_key: key,
  })
  if (error) {
    console.error('persistAccessAudit rpc failed', error.message || error)
    try {
      await supabaseAdmin.rpc('mil_outbox_enqueue', {
        p_classification: 'access',
        p_event_type: record.action,
        p_entity_type: record.targetType,
        p_entity_id: record.targetId || null,
        p_actor_id: record.actorUserId,
        p_payload: record.details || {},
        p_idempotency_key: key,
      })
    } catch (e) {
      console.error('persistAccessAudit outbox fallback failed', e)
    }
    return false
  }
  return Boolean((data as { ok?: boolean })?.ok)
}

/**
 * Essential edge paths must call transactional audited RPCs.
 * Standalone post-mutation essential enqueue is forbidden (non-atomic).
 */
export async function persistEssentialAudit(_record: MilAuditRecord): Promise<void> {
  throw new Error(
    'EDGE_THEN_OUTBOX_NONATOMIC forbidden: use mil_*_audited transactional RPCs',
  )
}
