/**
 * Shared MIL role resolution for edge functions.
 * Total order (must match rolePriority.js + SQL mil_current_role):
 *   1. normalized priority ASC
 *   2. created_at DESC NULLS LAST
 *   3. row id DESC
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

export const ROLE_PRIORITY: Record<string, number> = {
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

function createdAtSortKey(createdAt: string | null | undefined): number | null {
  if (createdAt == null || createdAt === '') return null
  const t = new Date(createdAt).getTime()
  return Number.isFinite(t) ? t : null
}

export function compareMilRoleRows(
  a: { id?: string | null; role?: string | null; created_at?: string | null },
  b: { id?: string | null; role?: string | null; created_at?: string | null },
): number {
  const roleA = normalizeMilRole(a?.role)
  const roleB = normalizeMilRole(b?.role)
  const priA = roleA === 'unauthenticated' ? 99 : (ROLE_PRIORITY[roleA] ?? 99)
  const priB = roleB === 'unauthenticated' ? 99 : (ROLE_PRIORITY[roleB] ?? 99)
  if (priA !== priB) return priA - priB

  const tsA = createdAtSortKey(a?.created_at)
  const tsB = createdAtSortKey(b?.created_at)
  if (tsA == null && tsB == null) {
    /* id */
  } else if (tsA == null) return 1
  else if (tsB == null) return -1
  else if (tsA !== tsB) return tsB - tsA

  const idA = a?.id == null ? '' : String(a.id)
  const idB = b?.id == null ? '' : String(b.id)
  if (idA === idB) return 0
  return idA < idB ? 1 : -1
}

export function resolveMilRoleFromRows(
  rows: Array<{ id?: string | null; role?: string | null; created_at?: string | null }>,
): MilRole {
  if (!rows?.length) return 'unauthenticated'
  let best: { id?: string | null; role?: string | null; created_at?: string | null } | null = null
  for (const row of rows) {
    const role = normalizeMilRole(row.role)
    if (role === 'unauthenticated') continue
    if (!best || compareMilRoleRows(row, best) < 0) best = row
  }
  return best ? normalizeMilRole(best.role) : 'unauthenticated'
}

export async function resolveMilRole(userId: string): Promise<MilRole> {
  if (!userId) return 'unauthenticated'
  const { data, error } = await supabaseAdmin
    .from('app_user_roles')
    .select('id, role, created_at')
    .eq('user_id', userId)
  if (error) throw error
  if (!data || !data.length) return 'unauthenticated'
  return resolveMilRoleFromRows(data)
}

export async function isMilOwnerAdmin(userId: string): Promise<boolean> {
  const role = await resolveMilRole(userId)
  return role === 'admin' || role === 'manager'
}

export async function isMilStaff(userId: string): Promise<boolean> {
  const role = await resolveMilRole(userId)
  return ['admin', 'manager', 'office', 'media_reviewer'].includes(role)
}

export async function isMilReviewer(userId: string): Promise<boolean> {
  const role = await resolveMilRole(userId)
  return ['admin', 'manager', 'media_reviewer'].includes(role)
}

export async function isMilCreator(userId: string): Promise<boolean> {
  const role = await resolveMilRole(userId)
  return role === 'reel_creator'
}
