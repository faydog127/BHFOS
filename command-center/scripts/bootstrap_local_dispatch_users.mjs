import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const parseEnvFile = (envPath) => {
  if (!fs.existsSync(envPath)) return {};

  const raw = fs.readFileSync(envPath, 'utf8');
  const entries = {};

  raw.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) return;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (key) entries[key] = value;
  });

  return entries;
};

const loadLocalEnv = () => {
  const cwd = process.cwd();
  const envValues = {
    ...parseEnvFile(path.join(cwd, '.env')),
    ...parseEnvFile(path.join(cwd, '.env.local')),
  };

  Object.entries(envValues).forEach(([key, value]) => {
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  });
};

loadLocalEnv();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing local Supabase URL or service role key.');
}

if (!/127\.0\.0\.1|localhost/i.test(supabaseUrl)) {
  throw new Error(`Refusing to bootstrap non-local Supabase project: ${supabaseUrl}`);
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const ensureAuthUser = async ({ email, password, appMetadata, userMetadata }) => {
  const { data: usersData, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (listError) throw listError;

  const existing = usersData.users.find((user) => String(user.email || '').toLowerCase() === email.toLowerCase());
  if (existing) {
    const { error: updateError } = await admin.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      app_metadata: { ...(existing.app_metadata || {}), ...appMetadata },
      user_metadata: { ...(existing.user_metadata || {}), ...userMetadata },
    });
    if (updateError) throw updateError;
    return { id: existing.id, email, action: 'updated' };
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: appMetadata,
    user_metadata: userMetadata,
  });
  if (error) throw error;
  return { id: data.user.id, email, action: 'created' };
};

const ensureTechnician = async ({ userId, fullName, email, phone, colorCode, isPrimaryDefault }) => {
  const { data: existing, error: existingError } = await admin
    .from('technicians')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (existingError) throw existingError;

  if (existing?.id) {
    const { error: updateError } = await admin
      .from('technicians')
      .update({
        full_name: fullName,
        email,
        phone,
        color_code: colorCode,
        is_active: true,
        is_primary_default: isPrimaryDefault,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);

    if (updateError) throw updateError;
    return { id: existing.id, action: 'updated' };
  }

  const { data, error } = await admin
    .from('technicians')
    .insert({
      user_id: userId,
      full_name: fullName,
      email,
      phone,
      color_code: colorCode,
      is_active: true,
      is_primary_default: isPrimaryDefault,
    })
    .select('id')
    .single();

  if (error) throw error;
  return { id: data.id, action: 'created' };
};

const main = async () => {
  const localAdmin = await ensureAuthUser({
    email: process.env.VITE_LOCAL_DEV_AUTH_EMAIL || 'local.admin@tvg.local',
    password: process.env.VITE_LOCAL_DEV_AUTH_PASSWORD || 'Dispatch!Local2026',
    appMetadata: { tenant_id: 'tvg', role: 'admin' },
    userMetadata: { role: 'admin' },
  });

  const dispatchTech = await ensureAuthUser({
    email: 'dispatch.tech@tvg.local',
    password: 'DispatchTech!2026',
    appMetadata: { tenant_id: 'tvg', role: 'technician' },
    userMetadata: { role: 'technician' },
  });

  const technician = await ensureTechnician({
    userId: dispatchTech.id,
    fullName: 'Dispatch Tech Local',
    email: 'dispatch.tech@tvg.local',
    phone: '3215552200',
    colorCode: '#0f766e',
    isPrimaryDefault: true,
  });

  console.log(
    JSON.stringify(
      {
        localAdmin,
        dispatchTech,
        technician,
      },
      null,
      2,
    ),
  );
};

await main();
