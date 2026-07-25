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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function authClientFor(req: Request) {
  const authHeader = req.headers.get('Authorization') || ''
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  })
}

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
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })

  try {
    const authHeader = req.headers.get('Authorization') || ''
    const authClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) return json({ error: 'Sign in required' }, 401)

    if (!(await isMilOwnerAdmin(user.id))) {
      return json({ error: 'Only owner/admin may manage creator access' }, 403)
    }

    const body = await req.json().catch(() => ({}))
    const action = String(body.action || '')

    if (action === 'invite_creator') {
      const email = String(body.email || '').trim().toLowerCase()
      if (!email || !EMAIL_RE.test(email)) return json({ error: 'Valid email is required' }, 400)

      let targetUser = await findUserByEmail(email)
      let invited = false

      if (!targetUser) {
        const { data: created, error: inviteErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(email)
        if (inviteErr || !created?.user) {
          return json({ error: inviteErr?.message || 'Could not invite this email address' }, 400)
        }
        targetUser = created.user
        invited = true
      }

      const { data: existingRoles, error: rolesErr } = await supabaseAdmin
        .from('app_user_roles')
        .select('id, role, created_at')
        .eq('user_id', targetUser.id)
      if (rolesErr) throw rolesErr

      const existingCreatorRow = (existingRoles || []).find((r) => normalizeMilRole(r.role) === 'reel_creator')

      if (existingCreatorRow) {
        if (existingCreatorRow.role !== 'reel_creator') {
          const { error: updErr } = await supabaseAdmin
            .from('app_user_roles')
            .update({ role: 'reel_creator' })
            .eq('id', existingCreatorRow.id)
          if (updErr) throw updErr
        }
      } else {
        const { error: insErr } = await supabaseAdmin
          .from('app_user_roles')
          .insert({ user_id: targetUser.id, role: 'reel_creator' })
        if (insErr) throw insErr
      }

      await supabaseAdmin.from('mil_audit_events').insert({
        actor_user_id: user.id,
        action: 'creator_invited',
        target_type: 'auth.users',
        target_id: targetUser.id,
        details: { email, invited },
      })

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
      if (!creatorUserId) return json({ error: 'Missing creatorUserId' }, 400)
      if ((assetId === null) === (collectionId === null)) {
        return json({ error: 'Provide exactly one of assetId or collectionId' }, 400)
      }

      // Call via the caller's own JWT so mil_assign_creator's SECURITY DEFINER
      // auth.uid()/mil_is_owner_admin() checks apply — defense in depth, not
      // just this function's own gate above.
      const { data, error } = await authClient.rpc('mil_assign_creator', {
        p_creator_user_id: creatorUserId,
        p_asset_id: assetId,
        p_collection_id: collectionId,
        p_notes: notes,
      })
      if (error) return json({ error: error.message }, 400)
      return json({ ok: true, assignmentId: data })
    }

    if (action === 'revoke_assignment') {
      const assignmentId = String(body.assignmentId || '').trim()
      if (!assignmentId) return json({ error: 'Missing assignmentId' }, 400)
      const { data, error } = await authClient.rpc('mil_revoke_creator_assignment', {
        p_assignment_id: assignmentId,
      })
      if (error) return json({ error: error.message }, 400)
      return json({ ok: true, revoked: Boolean(data) })
    }

    if (action === 'revoke_access') {
      const creatorUserId = String(body.creatorUserId || '').trim()
      if (!creatorUserId) return json({ error: 'Missing creatorUserId' }, 400)

      const { data: existingRoles, error: rolesErr } = await supabaseAdmin
        .from('app_user_roles')
        .select('id, role')
        .eq('user_id', creatorUserId)
      if (rolesErr) throw rolesErr
      const creatorRowIds = (existingRoles || [])
        .filter((r) => normalizeMilRole(r.role) === 'reel_creator')
        .map((r) => r.id)

      if (!creatorRowIds.length) {
        return json({ error: 'This user does not have the reel_creator role' }, 404)
      }

      // Deleting (not soft-flagging) the role row means mil_current_role() and
      // every edge/RLS role check fail closed on the very next request — the
      // revoked user cannot obtain a new signed URL, even mid-session.
      const { error: delErr } = await supabaseAdmin
        .from('app_user_roles')
        .delete()
        .in('id', creatorRowIds)
      if (delErr) throw delErr

      // Defense in depth: also revoke any active assignments so a stale
      // assignment cannot be reused if the role is later re-granted in error.
      const { data: revokedAssignments } = await supabaseAdmin
        .from('mil_creator_assignments')
        .update({ status: 'revoked', revoked_at: new Date().toISOString() })
        .eq('creator_user_id', creatorUserId)
        .eq('status', 'active')
        .select('id')

      await supabaseAdmin.from('mil_audit_events').insert({
        actor_user_id: user.id,
        action: 'creator_access_revoked',
        target_type: 'auth.users',
        target_id: creatorUserId,
        details: { revokedRoleRows: creatorRowIds.length, revokedAssignments: (revokedAssignments || []).length },
      })

      return json({ ok: true, revokedRoleRows: creatorRowIds.length, revokedAssignments: (revokedAssignments || []).length })
    }

    return json({ error: `Unknown action: ${action}` }, 400)
  } catch (error) {
    console.error('media-intel-creator-admin', error instanceof Error ? error.message : error)
    return json({ error: error instanceof Error ? error.message : 'Creator admin action failed' }, 500)
  }
})
