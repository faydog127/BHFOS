import { corsHeaders } from './cors.ts';
import { sendSms } from '../_shared/sms.ts';

const respondJson = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const parseJson = async (req: Request): Promise<Record<string, unknown>> => {
  try {
    const parsed = await req.json();
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
};

const asString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return respondJson({ error: 'Method not allowed' }, 405);
  }

  const body = await parseJson(req);
  const to = asString(body.to || body.phone);
  const messageBody = asString(body.body || body.message);
  const dryRun = body.dry_run === true;

  if (!to) {
    return respondJson({ error: 'Missing phone number', code: 'MISSING_PHONE' }, 400);
  }
  if (!messageBody) {
    return respondJson({ error: 'Missing SMS body', code: 'MISSING_BODY' }, 400);
  }

  const result = await sendSms({
    to,
    body: messageBody,
    dryRun,
  });

  if (!result.success) {
    return respondJson(
      {
        success: false,
        error: result.error || 'SMS send failed',
        code: result.code || 'SMS_SEND_FAILED',
        details: result.details ?? null,
      },
      400,
    );
  }

  return respondJson({
    success: true,
    provider: result.provider,
    sid: result.sid ?? null,
    status: result.status ?? null,
    to: result.to ?? null,
    dry_run: dryRun || false,
  });
});
