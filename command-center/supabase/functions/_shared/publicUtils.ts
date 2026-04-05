import { supabaseAdmin } from '../_lib/supabaseAdmin.ts';

type ClientInfo = {
  ip: string;
  userAgent: string;
};

type LogEventInput = {
  kind: string;
  tenantId?: string | null;
  quoteId?: string | null;
  invoiceId?: string | null;
  token?: string | null;
  status?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown> | null;
};

const formatError = (error: unknown) => (error instanceof Error ? error.message : String(error));

const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3003',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://172.22.32.1:3000',
  'http://172.22.32.1:3003',
  'https://vent-guys.com',
  'https://www.vent-guys.com',
  'https://app.bhfos.com',
  'https://installworxs.com',
  'https://www.installworxs.com',
  'https://demo.example.com',
];

const rateLimitState = new Map<string, { count: number; bucket: number }>();

const resolveCorsOrigin = (origin: string | null): string | null => {
  if (!origin) return null;
  if (allowedOrigins.includes(origin)) return origin;
  return null;
};

const buildCorsHeaders = (origin: string | null) => {
  const allowed = resolveCorsOrigin(origin);
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  };

  if (allowed) {
    headers['Access-Control-Allow-Origin'] = allowed;
  }

  return { headers, allowed };
};

const getClientInfo = (req: Request): ClientInfo => {
  const forwarded = req.headers.get('x-forwarded-for') || '';
  const ip =
    forwarded.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    req.headers.get('cf-connecting-ip') ||
    'unknown';
  const userAgent = req.headers.get('user-agent') || '';

  return { ip, userAgent };
};

const isRateLimited = (key: string, limit = 30, windowMs = 60_000) => {
  const now = Date.now();
  const bucket = Math.floor(now / windowMs);
  const entry = rateLimitState.get(key);

  if (!entry || entry.bucket !== bucket) {
    rateLimitState.set(key, { count: 1, bucket });
    return false;
  }

  if (entry.count >= limit) {
    return true;
  }

  entry.count += 1;
  return false;
};

const hashToken = async (token: string) => {
  const data = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

const logPublicEvent = async (input: LogEventInput) => {
  try {
    const tokenHash = input.token ? await hashToken(input.token) : null;
    const payload = {
      kind: input.kind,
      tenant_id: input.tenantId,
      quote_id: input.quoteId,
      invoice_id: input.invoiceId,
      token_hash: tokenHash,
      ip_address: input.ip,
      user_agent: input.userAgent,
      status: input.status,
      metadata: input.metadata ?? null,
    };

    const { error } = await supabaseAdmin.from('public_events').insert(payload);
    if (error) {
      console.error('public_events insert error:', error.message);
    }
  } catch (err) {
    console.error('public_events logging failed:', formatError(err));
  }
};

const readJson = async (req: Request) => {
  try {
    return await req.json();
  } catch {
    return null;
  }
};

export {
  buildCorsHeaders,
  getClientInfo,
  isRateLimited,
  logPublicEvent,
  readJson,
};
