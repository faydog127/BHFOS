/**
 * Shared MIL role resolution for edge functions (single-company; auth.uid()-based).
 * Mirrors SQL `mil_current_role()` in 20260725120000_media_intelligence_library.sql —
 * a user may have multiple app_user_roles rows; the MIL-relevant role with the
 * highest priority wins (ties broken by newest created_at). Picking merely the
 * newest row (as earlier drafts of these edge functions did) lets a stale or
 * lower-privilege row shadow an admin/manager grant, or vice versa.
 */
import { supabaseAdmin } from './supabaseAdmin.ts'

export type MilRole =
  | 'admin'
  | 'manager'
  | 'office'
  | 'media_reviewer'
  | 'reel_creator'
  | 'phone_uploader'
  | 'technician'
  | 'unauthenticated'

const ROLE_PRIORITY: Record<string, number> = {
  admin: 1,
  manager: 2,
  media_reviewer: 3,
  office: 4,
  reel_creator: 5,
  phone_uploader: 6,
  technician: 7,
}

export function normalizeMilRole(role: string | null | undefined): MilRole {
  const r = String(role || '').toLowerCase().trim()
  if (['admin', 'super_admin', 'owner'].includes(r)) return 'admin'
  if (r === 'manager') return 'manager'
  if (['office', 'csr'].includes(r)) return 'office'
  if (['media_reviewer', 'reviewer'].includes(r)) return 'media_reviewer'
  if (['reel_creator', 'creator', 'contributor'].includes(r)) return 'reel_creator'
  if (['phone_uploader', 'uploader'].includes(r)) return 'phone_uploader'
  if (['technician', 'tech'].includes(r)) return 'technician'
  return 'unauthenticated'
}

/** Query every app_user_roles row for the user and pick the highest-priority MIL role. */
export async function resolveMilRole(userId: string): Promise<MilRole> {
  if (!userId) return 'unauthenticated'
  const { data, error } = await supabaseAdmin
    .from('app_user_roles')
    .select('role, created_at')
    .eq('user_id', userId)
  if (error) throw error
  if (!data || !data.length) return 'unauthenticated'

  let best: { role: MilRole; priority: number; createdAt: number } | null = null
  for (const row of data) {
    const role = normalizeMilRole(row.role)
    const priority = ROLE_PRIORITY[role] ?? 99
    const createdAt = row.created_at ? new Date(row.created_at).getTime() : 0
    if (
      !best ||
      priority < best.priority ||
      (priority === best.priority && createdAt > best.createdAt)
    ) {
      best = { role, priority, createdAt }
    }
  }
  return best?.role ?? 'unauthenticated'
}

export async function isMilOwnerAdmin(userId: string): Promise<boolean> {
  const role = await resolveMilRole(userId)
  return role === 'admin' || role === 'manager'
}

/** Library staff: browse private originals / library surfaces. Technicians excluded by default. */
export async function isMilStaff(userId: string): Promise<boolean> {
  const role = await resolveMilRole(userId)
  return ['admin', 'manager', 'office', 'media_reviewer'].includes(role)
}

export async function isMilReviewer(userId: string): Promise<boolean> {
  return isMilStaff(userId)
}

export async function isMilCreator(userId: string): Promise<boolean> {
  const role = await resolveMilRole(userId)
  return role === 'reel_creator'
}
