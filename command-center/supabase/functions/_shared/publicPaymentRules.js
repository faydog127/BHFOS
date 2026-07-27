const TERMINAL_PAID_STATUSES = new Set(['paid']);
const TERMINAL_NONPAYABLE_STATUSES = new Set(['void', 'voided', 'cancelled', 'canceled']);
const PAYABLE_STATUSES = new Set(['sent', 'partial', 'partially_paid', 'overdue', 'accepted', 'approved', 'unpaid']);
const REUSABLE_ATTEMPT_STATUSES = new Set(['initiated', 'pending']);

export const normalizePaymentMethod = (value) => String(value ?? 'card').trim().toLowerCase();

export const moneyToCents = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;
  return Math.round(amount * 100);
};

export const classifyInvoicePaymentState = (invoice) => {
  const status = String(invoice?.status ?? '').trim().toLowerCase();
  const settlementStatus = String(invoice?.settlement_status ?? '').trim().toLowerCase();
  const totalCents = moneyToCents(invoice?.total_amount);
  const amountPaidCents = moneyToCents(invoice?.amount_paid);
  const balanceCents = moneyToCents(invoice?.balance_due);

  if (TERMINAL_NONPAYABLE_STATUSES.has(status)) {
    return { kind: 'nonpayable', reason: 'terminal_status', status };
  }

  if (
    totalCents === null ||
    amountPaidCents === null ||
    balanceCents === null ||
    totalCents < 0 ||
    amountPaidCents < 0 ||
    balanceCents < 0
  ) {
    return { kind: 'invalid', reason: 'invalid_money_state', status };
  }

  if (amountPaidCents > totalCents && balanceCents > 0) {
    return { kind: 'invalid', reason: 'inconsistent_overpayment', status };
  }

  if (amountPaidCents <= totalCents && balanceCents !== totalCents - amountPaidCents) {
    return { kind: 'invalid', reason: 'inconsistent_balance', status };
  }

  const hasPaidSignal =
    TERMINAL_PAID_STATUSES.has(status) ||
    settlementStatus === 'paid' ||
    Boolean(invoice?.paid_at);
  if (hasPaidSignal && balanceCents > 0) {
    return { kind: 'invalid', reason: 'inconsistent_paid_state', status };
  }

  if (
    hasPaidSignal ||
    balanceCents === 0
  ) {
    return { kind: 'paid', reason: 'settled', status, balanceCents: 0 };
  }

  if (!PAYABLE_STATUSES.has(status) || balanceCents <= 0) {
    return { kind: 'nonpayable', reason: 'unsupported_status', status };
  }

  return { kind: 'payable', reason: 'balance_due', status, balanceCents };
};

export const normalizeCallerIdempotencyKey = (value) => {
  if (typeof value !== 'string') return null;
  const key = value.trim();
  if (key.length < 12 || key.length > 128) return null;
  if (!/^[A-Za-z0-9._:-]+$/.test(key)) return null;
  return key;
};

const sha256Hex = async (value) => {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
};

export const derivePublicPayIdempotencyKey = async ({
  invoiceId,
  amountCents,
  method,
  callerKey,
  nowMs = Date.now(),
}) => {
  const normalizedMethod = normalizePaymentMethod(method);
  const normalizedCallerKey = normalizeCallerIdempotencyKey(callerKey);
  const suffix = normalizedCallerKey
    ? `client:${(await sha256Hex(normalizedCallerKey)).slice(0, 32)}`
    : `bucket:${Math.floor(nowMs / (15 * 60 * 1000))}`;

  return `publicpay:v2:${invoiceId}:${amountCents}:${normalizedMethod}:${suffix}`;
};

export const isUsableCheckoutUrl = (value) => {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
};

export const isStripeCheckoutUrl = (value) => {
  if (!isUsableCheckoutUrl(value)) return false;
  return new URL(value).hostname.toLowerCase() === 'checkout.stripe.com';
};

export const isLocalCheckoutUrl = (value) => {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    const url = new URL(value);
    return /^(?:127\.0\.0\.1|localhost)$/i.test(url.hostname) && ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
};

export const canReuseCheckoutAttempt = ({
  attempt,
  invoiceId,
  amountCents,
  method,
  idempotencyKey,
  nowMs = Date.now(),
  checkoutUrlValidator = isUsableCheckoutUrl,
  requireIdempotencyKey = true,
  checkoutGeneration,
}) => {
  const expiresAtMs = Date.parse(String(attempt?.checkout_expires_at ?? ''));
  return (
    String(attempt?.invoice_id ?? '') === String(invoiceId) &&
    Number(attempt?.amount_cents) === amountCents &&
    normalizePaymentMethod(attempt?.method) === normalizePaymentMethod(method) &&
    (!requireIdempotencyKey || String(attempt?.idempotency_key ?? '') === idempotencyKey) &&
    (checkoutGeneration == null || Number(attempt?.checkout_generation) === checkoutGeneration) &&
    REUSABLE_ATTEMPT_STATUSES.has(String(attempt?.attempt_status ?? '').toLowerCase()) &&
    typeof attempt?.checkout_session_id === 'string' &&
    Boolean(attempt.checkout_session_id.trim()) &&
    checkoutUrlValidator(attempt?.checkout_url) &&
    Number.isFinite(expiresAtMs) &&
    expiresAtMs > nowMs
  );
};

const PAYABLE_MUTATION_FIELDS = new Set([
  'status',
  'subtotal',
  'tax_rate',
  'tax_amount',
  'discount_amount',
  'total_amount',
  'amount_paid',
  'balance_due',
  'paid_at',
  'payment_method',
  'public_token',
]);

export const changesPayableState = (currentInvoice, patch) =>
  Object.entries(patch ?? {}).some(([field, nextValue]) => {
    if (!PAYABLE_MUTATION_FIELDS.has(field)) return false;
    const currentValue = currentInvoice?.[field] ?? null;
    if (['subtotal', 'tax_rate', 'tax_amount', 'discount_amount', 'total_amount', 'amount_paid', 'balance_due'].includes(field)) {
      return moneyToCents(currentValue) !== moneyToCents(nextValue);
    }
    return String(currentValue ?? '') !== String(nextValue ?? '');
  });
