import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const tenantId = process.env.TENANT_ID;
const userId = process.env.USER_ID;
const userEmail = process.env.USER_EMAIL;

const missing = [];
if (!supabaseUrl) missing.push('SUPABASE_URL');
if (!serviceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
if (!tenantId) missing.push('TENANT_ID');
if (!userId && !userEmail) missing.push('USER_ID or USER_EMAIL');

if (missing.length) {
  console.error('Missing required env:', missing.join(', '));
  console.error('Example:');
  console.error('  SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... TENANT_ID=tvg USER_EMAIL=user@example.com node scripts/set-tenant-claim.js');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const findUserIdByEmail = async (email) => {
  const normalized = email.toLowerCase();
  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const users = data?.users ?? [];
    const match = users.find((user) => (user.email || '').toLowerCase() === normalized);
    if (match) return match.id;

    if (users.length < perPage) break;
    page += 1;
  }

  return null;
};

const resolveUserId = async () => {
  if (userId) return userId;
  return await findUserIdByEmail(userEmail);
};

const targetUserId = await resolveUserId();
if (!targetUserId) {
  console.error('No user found for the provided identifier.');
  process.exit(1);
}

const { data: existing, error: existingError } = await supabase.auth.admin.getUserById(targetUserId);
if (existingError) {
  console.error('Failed to load user:', existingError.message);
  process.exit(1);
}

const currentMetadata = existing?.user?.app_metadata ?? {};
const updatedMetadata = { ...currentMetadata, tenant_id: tenantId };

const { error: updateError } = await supabase.auth.admin.updateUserById(targetUserId, {
  app_metadata: updatedMetadata,
});

if (updateError) {
  console.error('Failed to update user:', updateError.message);
  process.exit(1);
}

console.log(`Updated user ${targetUserId} app_metadata.tenant_id=${tenantId}`);
