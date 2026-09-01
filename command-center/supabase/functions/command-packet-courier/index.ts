// Destination identity for unpublished n8n ingress (comments/docs only): VaeN89dWkLYoyWyh
// Do not hardcode a live webhook URL. Read ingress secrets before lease; never log them.
import { supabaseAdmin } from '../_lib/supabaseAdmin.ts';
import { getVerifiedClaims } from '../_shared/auth.ts';
import { buildCorsHeaders, readJson } from '../_shared/publicUtils.ts';
import {
  COMMAND_CENTER_ADMIN_ROLES,
  COMMAND_PACKET_DISPATCH_STARTED_FUNCTION,
  COMMAND_PACKET_FINALIZE_FUNCTION,
  COMMAND_PACKET_LEASE_FUNCTION,
  createCommandPacketDispatchStartedAdapter,
  createCommandPacketFinalizeAdapter,
  createCommandPacketLeaseAdapter,
  isAuthorizedFromClaims,
  isAuthorizedFromRoles,
  redactSensitive,
  submitCommandPacket,
} from '../_shared/commandPacketCourier.mjs';

const respondJson = (body: Record<string, unknown>, status: number, headers: Record<string, string>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });

const asString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const loadRoles = async (userId: string): Promise<string[]> => {
  const { data, error } = await supabaseAdmin.from('app_user_roles').select('role').eq('user_id', userId);
  if (error) throw error;
  return (data ?? []).map((row: { role?: string | null }) => asString(row?.role).toLowerCase()).filter(Boolean);
};

const authorizeCommandCenterRequest = async (req: Request) => {
  let claims;
  try {
    ({ claims } = await getVerifiedClaims(req));
  } catch {
    return { ok: false, status: 'unauthorized', httpStatus: 401 };
  }

  if (isAuthorizedFromClaims(claims as Record<string, unknown>)) {
    return { ok: true, actorId: asString(claims?.sub) };
  }

  const userId = asString(claims?.sub);
  if (!userId) {
    return { ok: false, status: 'unauthorized', httpStatus: 401 };
  }

  try {
    const roles = await loadRoles(userId);
    if (isAuthorizedFromRoles(roles) || roles.some((role) => COMMAND_CENTER_ADMIN_ROLES.includes(role))) {
      return { ok: true, actorId: userId };
    }
  } catch {
    return { ok: false, status: 'forbidden', httpStatus: 403 };
  }

  return { ok: false, status: 'forbidden', httpStatus: 403 };
};

const publicBody = (result: Record<string, unknown>) =>
  redactSensitive({
    ok: result.ok === true,
    status: result.status,
    delivered: result.delivered === true,
    delivery_id: result.delivery_id ?? null,
    constructed: result.constructed ?? null,
  });

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const cors = buildCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors.headers });
  }

  if (req.method !== 'POST') {
    return respondJson({ error: 'Method not allowed', delivered: false }, 405, cors.headers);
  }

  const body = (await readJson(req)) as Record<string, unknown> | null;
  const packetId = asString(body?.packet_id);
  const packetText = typeof body?.packet_text === 'string' ? body.packet_text : '';

  const result = await submitCommandPacket(
    {
      request: req,
      packetId,
      packetText,
      authorization: req.headers.get('authorization') || '',
    },
    {
      authorize: () => authorizeCommandCenterRequest(req),
      getIngressSecrets: () => ({
        url: (Deno.env.get('N8N_COMMAND_INGRESS_URL') ?? '').trim(),
        token: (Deno.env.get('N8N_COMMAND_INGRESS_TOKEN') ?? '').trim(),
      }),
      leasePacket: createCommandPacketLeaseAdapter(async (args) => {
        const { data, error } = await supabaseAdmin.rpc(COMMAND_PACKET_LEASE_FUNCTION, args);
        if (error) throw error;
        return data;
      }),
      markDispatchStarted: createCommandPacketDispatchStartedAdapter(async (args) => {
        const { data, error } = await supabaseAdmin.rpc(COMMAND_PACKET_DISPATCH_STARTED_FUNCTION, args);
        if (error) throw error;
        return data;
      }),
      finalizeDelivery: createCommandPacketFinalizeAdapter(async (args) => {
        const { data, error } = await supabaseAdmin.rpc(COMMAND_PACKET_FINALIZE_FUNCTION, args);
        if (error) throw error;
        return data;
      }),
      fetch: globalThis.fetch.bind(globalThis),
    },
  );

  return respondJson(publicBody(result as Record<string, unknown>), result.httpStatus ?? 500, cors.headers);
});
