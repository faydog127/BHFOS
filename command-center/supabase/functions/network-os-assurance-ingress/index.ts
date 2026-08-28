import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  createAssuranceIngressHandler,
  parseAllowedActions,
} from './handler.mjs';

function readServerEnv(name: string): string {
  try {
    return Deno.env.get(name) ?? '';
  } catch {
    return '';
  }
}

function positiveInteger(value: string): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 0;
}

const mode = readServerEnv('NOS_ASSURANCE_MODE');
const webhookSecret = readServerEnv('NOS_ASSURANCE_GITHUB_WEBHOOK_SECRET');
const supabaseUrl = readServerEnv('SUPABASE_URL');
const serviceRoleKey = readServerEnv('SUPABASE_SERVICE_ROLE_KEY');
const n8nIngressUrl = readServerEnv('NOS_ASSURANCE_N8N_TEST_INGRESS_URL');
const n8nIngressToken = readServerEnv('NOS_ASSURANCE_N8N_TEST_INGRESS_TOKEN');

const target = {
  repositoryId: positiveInteger(readServerEnv('NOS_ASSURANCE_REPOSITORY_ID')),
  repositoryFullName: readServerEnv('NOS_ASSURANCE_REPOSITORY_FULL_NAME'),
  installationId: positiveInteger(readServerEnv('NOS_ASSURANCE_INSTALLATION_ID')),
  allowedActions: parseAllowedActions(readServerEnv('NOS_ASSURANCE_ALLOWED_ACTIONS')),
};

const database = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

async function claimDelivery(envelope: Record<string, unknown>) {
  if (!database) return 'error';
  const repository = envelope.repository as { id: number };
  const pullRequest = envelope.pull_request as { number: number; head_sha: string };
  const { data, error } = await database.rpc('network_os_claim_assurance_delivery', {
    p_delivery_id: envelope.delivery_id,
    p_event_name: envelope.event_name,
    p_repository_id: repository.id,
    p_installation_id: envelope.installation_id,
    p_pr_number: pullRequest.number,
    p_head_sha: pullRequest.head_sha,
  });
  if (error) return 'error';
  return data === true ? 'claimed' : 'duplicate';
}

async function markDelivery(deliveryId: string, state: string) {
  if (!database) return false;
  const { data, error } = await database.rpc('network_os_mark_assurance_delivery_forward_result', {
    p_delivery_id: deliveryId,
    p_forward_state: state,
  });
  return !error && data === true;
}

async function forwardEnvelope(envelope: Record<string, unknown>, { signal }: { signal: AbortSignal }) {
  if (!n8nIngressUrl || !n8nIngressToken) return { ok: false };
  const response = await fetch(n8nIngressUrl, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${n8nIngressToken}`,
      'content-type': 'application/json',
      'x-nos-envelope-schema': '1.0',
    },
    body: JSON.stringify(envelope),
    redirect: 'error',
    signal,
  });
  return { ok: response.ok };
}

const configurationReady = Boolean(
  mode === 'preview-test'
    && webhookSecret
    && supabaseUrl
    && serviceRoleKey
    && n8nIngressUrl
    && n8nIngressToken
    && target.repositoryId
    && target.repositoryFullName
    && target.installationId
    && target.allowedActions.size,
);

const handle = createAssuranceIngressHandler({
  configurationReady,
  webhookSecret,
  target,
  claimDelivery,
  markDelivery,
  forwardEnvelope,
  log: (event: { status: number; code: string; delivery_id: string | null }) => {
    console.log(JSON.stringify({
      component: 'network-os-assurance-ingress',
      status: event.status,
      code: event.code,
      delivery_id: event.delivery_id,
    }));
  },
});

Deno.serve((request: Request) => handle(request));
