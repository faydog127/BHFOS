const JOB_STATUS_ALIAS_MAP = {
  inprogress: 'in_progress',
  'in-progress': 'in_progress',
  complete: 'completed',
  done: 'completed',
  pending: 'unscheduled',
  pendingschedule: 'pending_schedule',
  'pending-schedule': 'pending_schedule',
  on_the_way: 'en_route',
  ontheway: 'en_route',
  paused: 'on_hold',
  pause: 'on_hold',
  noaccess: 'no_access',
  'no-access': 'no_access',
  reschedule: 'reschedule_required',
  'reschedule-required': 'reschedule_required',
  completionpending: 'completion_pending',
  'completion-pending': 'completion_pending',
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
