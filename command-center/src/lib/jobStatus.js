const JOB_STATUS_ALIAS_MAP = {
  inprogress: 'in_progress',
  'in-progress': 'in_progress',
  complete: 'completed',
  done: 'completed',
  pending: 'unscheduled',
  pendingschedule: 'pending_schedule',
  'pending-schedule': 'pending_schedule',
};

const PAYMENT_STATUS_ALIAS_MAP = {
  partial_paid: 'partial',
  partially_paid: 'partial',
};

const normalize = (value) => String(value || '').trim().toLowerCase();

export const normalizeJobStatus = (value) => {
  const normalized = normalize(value);
  return JOB_STATUS_ALIAS_MAP[normalized] || normalized;
};

export const normalizePaymentStatus = (value) => {
  const normalized = normalize(value);
  return PAYMENT_STATUS_ALIAS_MAP[normalized] || normalized;
};

const expandLegacyValues = (values, normalizer, aliasMap) =>
  Array.from(
    new Set(
      values
        .flatMap((value) => {
          const canonical = normalizer(value);
          if (!canonical) return [];

          const aliases = Object.entries(aliasMap)
            .filter(([, mapped]) => mapped === canonical)
            .map(([alias]) => alias);

          return [canonical, canonical.toUpperCase(), ...aliases, ...aliases.map((alias) => alias.toUpperCase())];
        })
    )
  );

// Temporary compatibility for mixed historical casing until DB migration is applied everywhere.
export const expandLegacyJobStatuses = (values) => expandLegacyValues(values, normalizeJobStatus, JOB_STATUS_ALIAS_MAP);
export const expandLegacyPaymentStatuses = (values) => expandLegacyValues(values, normalizePaymentStatus, PAYMENT_STATUS_ALIAS_MAP);
