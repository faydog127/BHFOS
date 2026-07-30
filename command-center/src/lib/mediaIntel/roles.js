import { supabase } from '@/lib/customSupabaseClient';

/** Roles with Media Library browse / private-original access. Technicians excluded. */
const LIBRARY_STAFF = new Set(['admin', 'manager', 'office', 'media_reviewer']);
/** Aligns with SQL mil_is_reviewer() — office may browse/upload but cannot review. */
const REVIEWERS = new Set(['admin', 'manager', 'media_reviewer']);
/** May invite/revoke creators, mint upload sessions, promote website media, approve reels. */
const OWNERS = new Set(['admin', 'manager']);

export function normalizeMilRole(role) {
  const r = String(role || '').toLowerCase().trim();
  if (['admin', 'super_admin', 'owner'].includes(r)) return 'admin';
  if (r === 'manager') return 'manager';
  if (['office', 'csr'].includes(r)) return 'office';
  if (['media_reviewer', 'reviewer'].includes(r)) return 'media_reviewer';
  if (['reel_creator', 'creator', 'contributor'].includes(r)) return 'reel_creator';
  if (['phone_uploader', 'uploader'].includes(r)) return 'phone_uploader';
  if (['technician', 'tech'].includes(r)) return 'technician';
  return 'unauthenticated';
}

/** Resolve MIL role from authenticated user — no route/tenant identity. */
export async function fetchMilRole() {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return 'unauthenticated';

  const { data, error } = await supabase
    .from('app_user_roles')
    .select('role, created_at')
    .eq('user_id', auth.user.id)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) {
    console.warn('MIL role lookup failed', error);
    return 'unauthenticated';
  }
  return normalizeMilRole(data?.[0]?.role);
}

export function milCapabilities(role) {
  const r = normalizeMilRole(role);
  const isLibraryStaff = LIBRARY_STAFF.has(r);
  return {
    role: r,
    isStaff: isLibraryStaff,
    isReviewer: REVIEWERS.has(r),
    isOwnerAdmin: OWNERS.has(r),
    isCreator: r === 'reel_creator',
    isPhoneUploader: r === 'phone_uploader',
    isTechnician: r === 'technician',
    // phone_uploader is not a product role with library capabilities — it exists only
    // for legacy accounts. Phone uploads are authorized purely by a bearer session
    // token (mil_upload_sessions) minted by an owner/admin, never by this role.
    canUpload: isLibraryStaff,
    canVerify: REVIEWERS.has(r),
    canLifecycleCleanup: REVIEWERS.has(r),
    canPermanentDelete: OWNERS.has(r),
    canApproveReels: OWNERS.has(r),
    canManageCreatorAccess: OWNERS.has(r),
    canPromoteWebsite: OWNERS.has(r),
    canChangeSecuritySettings: OWNERS.has(r),
    canBrowseLibrary: isLibraryStaff,
    // Technicians use CRM/tech surfaces; they are not MIL library staff.
    canAccessCrm: isLibraryStaff || r === 'technician',
  };
}
