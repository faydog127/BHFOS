type SmsSendInput = {
  to: string;
  body: string;
  from?: string | null;
  dryRun?: boolean;
};

type SmsSendResult = {
  success: boolean;
  provider: string;
  to: string | null;
  sid?: string | null;
  status?: string | null;
  error?: string | null;
  code?: string | null;
  details?: Record<string, unknown> | null;
  body?: string;
};

type DocumentSmsParams = {
  documentType: 'estimate' | 'invoice' | 'receipt';
  documentUrl: string;
  to: string;
  recipientName?: string | null;
  referenceNumber?: string | number | null;
  dryRun?: boolean;
};

const SMS_DELIVERY_MODE = String(Deno.env.get('SMS_DELIVERY_MODE') ?? '')
  .trim()
  .toLowerCase();

const DEFAULT_BRAND_NAME = 'The Vent Guys';

const formatError = (error: unknown) => (error instanceof Error ? error.message : String(error));

const normalizePhone = (value: unknown): string | null => {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  const hasPlus = raw.startsWith('+');
  if (hasPlus) {
    if (digits.length < 10 || digits.length > 15) return null;
    return `+${digits}`;
  }
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (digits.length >= 12 && digits.length <= 15) return `+${digits}`;
  return null;
};

const buildDocumentSmsBody = (params: DocumentSmsParams) => {
  const labelMap: Record<DocumentSmsParams['documentType'], string> = {
    estimate: 'Quote',
    invoice: 'Invoice',
    receipt: 'Receipt',
  };
  const actionMap: Record<DocumentSmsParams['documentType'], string> = {
    estimate: 'Review',
    invoice: 'Pay',
    receipt: 'View',
  };

  const label = labelMap[params.documentType] ?? 'Document';
  const action = actionMap[params.documentType] ?? 'View';
  const ref = params.referenceNumber ? ` #${params.referenceNumber}` : '';
  const name = params.recipientName ? `Hi ${params.recipientName}, ` : '';

  return `${name}${DEFAULT_BRAND_NAME} ${label}${ref} is ready. ${action}: ${params.documentUrl}`;
};

const sendSms = async (input: SmsSendInput): Promise<SmsSendResult> => {
  const normalizedTo = normalizePhone(input.to);
  if (!normalizedTo) {
    return {
      success: false,
      provider: 'validation',
      to: null,
      error: 'invalid_phone',
      code: 'INVALID_PHONE',
    };
  }

  const body = String(input.body ?? '').trim();
  if (!body) {
    return {
      success: false,
      provider: 'validation',
      to: normalizedTo,
      error: 'missing_body',
      code: 'MISSING_BODY',
    };
  }

  if (input.dryRun) {
    return {
      success: true,
      provider: 'dry_run',
      to: normalizedTo,
      status: 'dry_run',
      body,
    };
  }

  if (SMS_DELIVERY_MODE === 'mock') {
    const mockSid = `mock-${crypto.randomUUID()}`;
    console.log('Mock SMS delivery:', { to: normalizedTo, sid: mockSid });
    return {
      success: true,
      provider: 'mock',
      to: normalizedTo,
      sid: mockSid,
      status: 'mocked',
      body,
    };
  }

  const accountSid = String(Deno.env.get('TWILIO_ACCOUNT_SID') ?? '').trim();
  const authToken = String(Deno.env.get('TWILIO_AUTH_TOKEN') ?? '').trim();
  const fromNumber = String(input.from ?? Deno.env.get('TWILIO_FROM_NUMBER') ?? '').trim();

  if (!accountSid || !authToken || !fromNumber) {
    return {
      success: false,
      provider: 'twilio',
      to: normalizedTo,
      error: 'missing_twilio_config',
      code: 'MISSING_TWILIO_CONFIG',
      details: {
        hasAccountSid: Boolean(accountSid),
        hasAuthToken: Boolean(authToken),
        hasFromNumber: Boolean(fromNumber),
      },
    };
  }

  const credentials = btoa(`${accountSid}:${authToken}`);
  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: normalizedTo,
        From: fromNumber,
        Body: body,
      }),
    },
  );

  let payload: Record<string, unknown> | null = null;
  try {
    payload = (await response.json()) as Record<string, unknown>;
  } catch (err) {
    payload = { error: formatError(err) };
  }

  if (!response.ok) {
    return {
      success: false,
      provider: 'twilio',
      to: normalizedTo,
      error: String(payload?.message ?? 'twilio_send_failed'),
      code: String(payload?.code ?? response.status),
      details: payload,
    };
  }

  return {
    success: true,
    provider: 'twilio',
    to: normalizedTo,
    sid: String(payload?.sid ?? ''),
    status: String(payload?.status ?? 'queued'),
    body,
  };
};

const sendDocumentSms = async (params: DocumentSmsParams): Promise<SmsSendResult> => {
  const body = buildDocumentSmsBody(params);
  const result = await sendSms({
    to: params.to,
    body,
    dryRun: params.dryRun,
  });

  return {
    ...result,
    body,
  };
};

export { buildDocumentSmsBody, normalizePhone, sendDocumentSms, sendSms };
