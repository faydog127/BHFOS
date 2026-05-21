import { corsHeaders } from './cors.ts';
import { getTenantIdFromClaims, getVerifiedClaims } from '../_shared/auth.ts';
import { getClientInfo } from '../_shared/publicUtils.ts';
import { sendEmail } from '../_shared/email.ts';

type JsonObject = Record<string, unknown>;

const respondJson = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const parseJson = async (req: Request): Promise<JsonObject> => {
  try {
    const parsed = await req.json();
    return parsed && typeof parsed === 'object' ? (parsed as JsonObject) : {};
  } catch {
    return {};
  }
};

const asString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const normalizeTo = (value: unknown): string | string[] | null => {
  if (Array.isArray(value)) {
    const list = value.map((v) => asString(v)).filter(Boolean).slice(0, 10);
    return list.length ? list : null;
  }
  const single = asString(value);
  if (!single) return null;
  if (single.includes(',') || single.includes(';')) {
    const list = single
      .split(/[;,]/g)
      .map((part) => part.trim())
      .filter(Boolean)
      .slice(0, 10);
    return list.length ? list : null;
  }
  return single;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return respondJson({ success: false, error: 'Method not allowed' }, 405);
  }

  const clientInfo = getClientInfo(req);

  try {
    const verified = await getVerifiedClaims(req);
    const claims = verified.claims as Record<string, unknown>;
    const tenantId = getTenantIdFromClaims(claims);

    const body = await parseJson(req);

    const to = normalizeTo(body.to ?? body.to_email ?? body.email);
    const subject = asString(body.subject);
    const html = asString(body.html);
    const text = asString(body.text);

    if (!to) {
      return respondJson({ success: false, error: 'Missing recipient (to)' }, 400);
    }

    if (!subject) {
      return respondJson({ success: false, error: 'Missing subject' }, 400);
    }

    if (!html && !text) {
      return respondJson({ success: false, error: 'Missing html/text body' }, 400);
    }

    const from = asString(body.from);
    const replyTo = asString(body.reply_to ?? body.replyTo);
    const cc = body.cc;
    const bcc = body.bcc;
    const attachments = Array.isArray(body.attachments) ? body.attachments.slice(0, 10) : undefined;
    const tags = Array.isArray(body.tags) ? body.tags.slice(0, 10) : undefined;
    const headers = body.headers && typeof body.headers === 'object' ? (body.headers as Record<string, string>) : undefined;

    const result = await sendEmail({
      to,
      subject,
      html: html || `<pre style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; white-space: pre-wrap;">${text}</pre>`,
      from: from || undefined,
      replyTo: replyTo || undefined,
      cc: cc as any,
      bcc: bcc as any,
      attachments,
      tags,
      headers,
    });

    return respondJson({
      success: true,
      id: (result as Record<string, unknown>)?.id ?? null,
      provider: (result as Record<string, unknown>)?.provider ?? 'resend',
      tenant_id: tenantId || null,
      client: clientInfo,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return respondJson(
      {
        success: false,
        error: message,
        client: clientInfo,
      },
      500,
    );
  }
});

