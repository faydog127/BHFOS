import { supabase } from '@/lib/customSupabaseClient';
import {
  normalizeMilRole,
  resolveMilRoleFromRows,
} from '@/lib/mediaIntel/rolePriority';

export { normalizeMilRole, resolveMilRoleFromRows, MIL_ROLE_PRIORITY } from '@/lib/mediaIntel/rolePriority';

/** Roles with Media Library browse / private-original access. Technicians excluded. */
const LIBRARY_STAFF = new Set(['admin', 'manager', 'office', 'media_reviewer']);
/** Aligns with SQL mil_is_reviewer() — office may browse/upload but cannot review. */
const REVIEWERS = new Set(['admin', 'manager', 'media_reviewer']);
/** May invite/revoke creators, mint upload sessions, promote website media, approve reels. */
const OWNERS = new Set(['admin', 'manager']);

/** Resolve MIL role from authenticated user — no route/tenant identity. */
export async function fetchMilRole() {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return 'unauthenticated';

  // Fetch ALL role rows; resolve by shared priority + newest created_at tie-break.
  // Do not use newest-row-only limiting — that disagrees with SQL/edge.
  const { data, error } = await supabase
    .from('app_user_roles')
    .select('id, role, created_at')
    .eq('user_id', auth.user.id);
  if (error) {
    console.warn('MIL role lookup failed', error);
    return 'unauthenticated';
  }
  return resolveMilRoleFromRows(data || []);
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
    // Contributor self-shot intake on /creator — not broad library staff upload.
    canContributorSelfUpload: r === 'reel_creator',
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
