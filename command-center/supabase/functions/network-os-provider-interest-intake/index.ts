import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  createProviderInterestIntakeHandler,
  parseAllowedOrigins,
} from './handler.mjs';

const INTAKE_TABLE = 'network_os_provider_interest_intake';

function readServerEnv(name: string): string {
  try {
    return Deno.env.get(name) ?? '';
  } catch {
    return '';
  }
}

function privilegedInsertClient() {
  const url = readServerEnv('SUPABASE_URL');
  const credential = readServerEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !credential) return null;
  return createClient(url, credential, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function insertRow(row: Record<string, unknown>) {
  const client = privilegedInsertClient();
  if (!client) return { ok: false };

  const { error } = await client.from(INTAKE_TABLE).insert(row);
  if (!error) return { ok: true };
  if (error.code === '23505') return { ok: false, duplicate: true };
  return { ok: false };
}

const handle = createProviderInterestIntakeHandler({
  allowedOrigins: parseAllowedOrigins(readServerEnv('CONVENTION_INTAKE_ALLOWED_ORIGINS')),
  insertRow,
  log: (event: { request_id: string; status: number; reason: string }) => {
    console.log(JSON.stringify({
      request_id: event.request_id,
      status: event.status,
      reason: event.reason,
    }));
  },
});

Deno.serve((req: Request) => handle(req));
