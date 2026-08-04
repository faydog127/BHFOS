/**
 * Owner/admin-only creator account administration (single-company).
 *
 * Centralizes the previously-manual "run this SQL yourself" creator invite
 * flow (see MediaSettings.jsx) behind an audited, role-checked edge function.
 * The service role key never leaves this function — the client only ever
 * gets back safe fields (user id, email, role).
 *
 * Actions: invite_creator, list_creators, assign, revoke_assignment, revoke_access.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { milCorsHeaders, milCorsPreflight } from '../_shared/milCors.ts'
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts'
import { isMilOwnerAdmin, normalizeMilRole } from '../_shared/milRoles.ts'
import {
  newCorrelationId,
  PUBLIC_ERROR_CATALOG,
  redactErrorForClient,
} from '../_shared/milSafeErrors.ts'
// Essential role mutations use transactional SQL RPCs (mutation+audit).

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

async function findUserByEmail(email: string) {
  const target = email.toLowerCase().trim()
  const perPage = 200
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage })
    if (error) throw error
    const match = data?.users?.find((u) => (u.email || '').toLowerCase() === target)
    if (match) return match
    if (!data?.users?.length || data.users.length < perPage) break
  }
  return null
}

Deno.serve(async (req) => {
  const cors = milCorsHeaders(req)
  if (req.method === 'OPTIONS') return milCorsPreflight(req)
  const correlationId = req.headers.get('x-correlation-id') || newCorrelationId()
  const json = (body: Record<string, unknown>, status = 200) =>
    new Response(JSON.stringify({ ...body, correlationId }), {
      status,
      headers: {
        ...cors,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'x-correlation-id': correlationId,
      },
    })
  const deny = (code: string, status = 403) => {
    const pub = PUBLIC_ERROR_CATALOG[code] ? code : 'INTERNAL_ERROR'
    return json({ error: PUBLIC_ERROR_CATALOG[pub], code: pub }, status)
  }

  try {
    const authHeader = req.headers.get('Authorization') || ''
    const authClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) return deny('SIGN_IN_REQUIRED', 401)

    if (!(await isMilOwnerAdmin(user.id))) {
      return deny('MEDIA_ACCESS_DENIED', 403)
    }

    const body = await req.json().catch(() => ({}))
    const action = String(body.action || '')

    if (action === 'invite_creator') {
      const email = String(body.email || '').trim().toLowerCase()
      if (!email || !EMAIL_RE.test(email)) return deny('INVALID_REQUEST', 400)

      let targetUser = await findUserByEmail(email)
      let invited = false

      if (!targetUser) {
        const { data: created, error: inviteErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(email)
        if (inviteErr || !created?.user) {
          console.error('media-intel-creator-admin invite', { correlationId, msg: inviteErr?.message })
          return deny('INVALID_REQUEST', 400)
        }
        targetUser = created.user
        invited = true
      }

      // Auth invite is outside the DB. Role grant + essential audit are atomic
      // in mil_grant_creator_role_audited — failure rolls back the role row.
      const { data: granted, error: grantErr } = await supabaseAdmin.rpc(
        'mil_grant_creator_role_audited',
        {
          p_user_id: targetUser.id,
          p_actor_id: user.id,
          p_details: { email, invited },
          p_idempotency_key: `creator_invited:${targetUser.id}:${user.id}`,
        },
      )
      if (grantErr) throw grantErr
      if (!(granted as { ok?: boolean })?.ok) {
        return deny('INTERNAL_ERROR', 500)
      }

      return json({ ok: true, userId: targetUser.id, email, role: 'reel_creator', invited })
    }

    if (action === 'list_creators') {
      const { data: roles, error: rolesErr } = await supabaseAdmin
        .from('app_user_roles')
        .select('user_id, role, created_at')
      if (rolesErr) throw rolesErr

      const creatorUserIds = new Map<string, string>()
      for (const row of roles || []) {
        if (normalizeMilRole(row.role) === 'reel_creator' && !creatorUserIds.has(row.user_id)) {
          creatorUserIds.set(row.user_id, row.created_at)
        }
      }

      const creators = [] as Array<{ user_id: string; email: string | null; role: string; created_at: string | null }>
      for (const [userId, createdAt] of creatorUserIds) {
        let email: string | null = null
        try {
          const { data } = await supabaseAdmin.auth.admin.getUserById(userId)
          email = data?.user?.email || null
        } catch {
          email = null
        }
        creators.push({ user_id: userId, email, role: 'reel_creator', created_at: createdAt })
      }

      return json({ creators })
    }

    if (action === 'assign') {
      const creatorUserId = String(body.creatorUserId || '').trim()
      const assetId = body.assetId ? String(body.assetId).trim() : null
      const collectionId = body.collectionId ? String(body.collectionId).trim() : null
      const notes = body.notes ? String(body.notes) : null
      const instructions = body.instructions ? String(body.instructions) : notes
      const dueAt = body.dueAt ? String(body.dueAt) : null
      const requestedOutput = body.requestedOutput ? String(body.requestedOutput) : null
      const platformFormat = body.platformFormat ? String(body.platformFormat) : null
      if (!creatorUserId) return deny('INVALID_REQUEST', 400)
      if ((assetId === null) === (collectionId === null)) {
        return deny('INVALID_REQUEST', 400)
      }

      // Call via the caller's own JWT so mil_assign_creator's SECURITY DEFINER
      // auth.uid()/mil_is_owner_admin() checks apply — defense in depth, not
      // just this function's own gate above.
      const { data, error } = await authClient.rpc('mil_assign_creator', {
        p_creator_user_id: creatorUserId,
        p_asset_id: assetId,
        p_collection_id: collectionId,
        p_notes: notes,
        p_due_at: dueAt,
        p_requested_output: requestedOutput,
        p_platform_format: platformFormat,
        p_instructions: instructions,
      })
      if (error) {
        console.error('media-intel-creator-admin assign', { correlationId, msg: error.message })
        return deny('INVALID_REQUEST', 400)
      }
      return json({ ok: true, assignmentId: data })
    }

    if (action === 'revoke_assignment') {
      const assignmentId = String(body.assignmentId || '').trim()
      if (!assignmentId) return deny('INVALID_REQUEST', 400)
      const { data, error } = await authClient.rpc('mil_revoke_creator_assignment', {
        p_assignment_id: assignmentId,
      })
      if (error) {
        console.error('media-intel-creator-admin revoke_assignment', { correlationId, msg: error.message })
        return deny('INVALID_REQUEST', 400)
      }
      return json({ ok: true, revoked: Boolean(data) })
    }

    if (action === 'revoke_access') {
      const creatorUserId = String(body.creatorUserId || '').trim()
      if (!creatorUserId) return deny('INVALID_REQUEST', 400)

      const { data: revoked, error: revErr } = await supabaseAdmin.rpc(
        'mil_revoke_creator_access_audited',
        {
          p_user_id: creatorUserId,
          p_actor_id: user.id,
          p_details: {},
          p_idempotency_key: `creator_access_revoked:${creatorUserId}:${user.id}`,
        },
      )
      if (revErr) throw revErr
      const payload = revoked as {
        ok?: boolean
        revokedRoleRows?: number
        revokedAssignments?: number
      }
      if (!payload?.ok) return deny('INTERNAL_ERROR', 500)
      if (!payload.revokedRoleRows) {
        return deny('MEDIA_NOT_AVAILABLE', 404)
      }
      return json({
        ok: true,
        revokedRoleRows: payload.revokedRoleRows,
        revokedAssignments: payload.revokedAssignments || 0,
      })
    }

    return deny('INVALID_REQUEST', 400)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('media-intel-creator-admin', { correlationId, msg })
    const redacted = redactErrorForClient(error, { correlationId, fallbackCode: 'INTERNAL_ERROR' })
    return json({ error: redacted.error, code: redacted.code }, 500)
  }
})
