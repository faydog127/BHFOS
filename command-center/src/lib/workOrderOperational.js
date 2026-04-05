import { normalizeJobStatus, normalizePaymentStatus } from '@/lib/jobStatus';

const PAYMENT_TERM_ALIAS_MAP = {
  'due on receipt': 'DUE_ON_RECEIPT',
  due_on_receipt: 'DUE_ON_RECEIPT',
  dueuponreceipt: 'DUE_ON_RECEIPT',
  'net 7': 'NET_7',
  net7: 'NET_7',
  'net 15': 'NET_15',
  net15: 'NET_15',
  'net 30': 'NET_30',
  net30: 'NET_30',
};

const CUSTOMER_TYPE_ALIAS_MAP = {
  residential: 'residential',
  homeowner: 'residential',
  commercial: 'commercial',
  government: 'commercial',
  property_management: 'property_management',
  'property management': 'property_management',
  propertymanager: 'property_management',
  property_manager: 'property_management',
  partner: 'property_management',
};

const normalizeText = (value) => String(value ?? '').trim().toLowerCase();

export const PAYMENT_TERM_OPTIONS = [
  { value: 'NET_7', label: 'Net 7' },
  { value: 'NET_15', label: 'Net 15' },
  { value: 'NET_30', label: 'Net 30' },
  { value: 'DUE_ON_RECEIPT', label: 'Due on Receipt' },
];

export const normalizeWorkOrderPaymentTerms = (value) => {
  const normalized = normalizeText(value);
  return PAYMENT_TERM_ALIAS_MAP[normalized] || value || '';
};

export const normalizeWorkOrderCustomerType = (value) => {
  const normalized = normalizeText(value);
  return CUSTOMER_TYPE_ALIAS_MAP[normalized] || (normalized || 'residential');
};

export const defaultPaymentTermsForCustomerType = (value) => {
  switch (normalizeWorkOrderCustomerType(value)) {
    case 'property_management':
      return 'NET_30';
    case 'commercial':
      return 'NET_15';
    default:
      return 'NET_7';
  }
};

export const paymentTermsDueDays = (value) => {
  switch (normalizeWorkOrderPaymentTerms(value)) {
    case 'NET_30':
      return 30;
    case 'NET_15':
      return 15;
    case 'DUE_ON_RECEIPT':
      return 0;
    default:
      return 7;
  }
};

export const formatPaymentTermsLabel = (value) => {
  switch (normalizeWorkOrderPaymentTerms(value)) {
    case 'NET_30':
      return 'Net 30';
    case 'NET_15':
      return 'Net 15';
    case 'DUE_ON_RECEIPT':
      return 'Due on Receipt';
    default:
      return 'Net 7';
  }
};

export const formatOperationalStageLabel = (value) => {
  const normalized = normalizeText(value).replaceAll('_', ' ');
  if (!normalized) return 'Unknown';
  return normalized
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const addHours = (dateValue, hours) => {
  const base = new Date(dateValue);
  if (Number.isNaN(base.getTime())) return null;
  return new Date(base.getTime() + hours * 60 * 60 * 1000);
};

const addDays = (dateValue, days) => {
  const base = new Date(dateValue);
  if (Number.isNaN(base.getTime())) return null;
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
};

export const computeFallbackOperationalState = (job) => {
  const status = normalizeJobStatus(job?.status);
  const paymentStatus = normalizePaymentStatus(job?.payment_status);
  const paymentTerms =
    normalizeWorkOrderPaymentTerms(job?.payment_terms) ||
    defaultPaymentTermsForCustomerType(job?.customer_type_snapshot);
  const dueDays = paymentTermsDueDays(paymentTerms);

  let operationalStage = status || 'unscheduled';
  if (paymentStatus === 'paid') {
    operationalStage = 'paid';
  } else if (status === 'completed') {
    operationalStage = 'invoice_draft';
  }

  let dueAt = null;
  if (operationalStage === 'unscheduled' || operationalStage === 'pending_schedule') {
    dueAt = addHours(job?.updated_at || job?.created_at, 24);
  } else if (operationalStage === 'scheduled') {
    dueAt = job?.scheduled_start ? new Date(job.scheduled_start) : null;
  } else if (operationalStage === 'invoice_draft') {
    dueAt = addHours(job?.completed_at || job?.updated_at || job?.created_at, 12);
  }

  const isOverdue = dueAt instanceof Date && !Number.isNaN(dueAt.getTime()) && dueAt.getTime() < Date.now();

  return {
    operational_stage: operationalStage,
    operational_sort:
      operationalStage === 'unscheduled' || operationalStage === 'pending_schedule'
        ? 10
        : operationalStage === 'scheduled'
          ? 20
          : operationalStage === 'en_route'
            ? 30
            : operationalStage === 'in_progress'
              ? 40
              : operationalStage === 'on_hold'
                ? 45
                : operationalStage === 'invoice_draft'
                  ? 50
                  : operationalStage === 'invoiced'
                    ? 60
                    : operationalStage === 'paid'
                      ? 80
                      : 95,
    due_at: dueAt ? dueAt.toISOString() : null,
    is_overdue: isOverdue,
    overdue_reason:
      isOverdue && (operationalStage === 'unscheduled' || operationalStage === 'pending_schedule')
        ? 'Scheduling overdue'
        : isOverdue && operationalStage === 'scheduled'
          ? 'Dispatch overdue'
          : isOverdue && operationalStage === 'invoice_draft'
            ? `Invoice draft overdue (${formatPaymentTermsLabel(paymentTerms)})`
            : null,
    payment_terms: paymentTerms,
    customer_type_snapshot:
      normalizeWorkOrderCustomerType(job?.customer_type_snapshot) || 'residential',
    next_action_label:
      operationalStage === 'unscheduled' || operationalStage === 'pending_schedule'
        ? 'Schedule'
        : operationalStage === 'scheduled'
          ? 'Start'
          : operationalStage === 'in_progress'
            ? 'Complete'
            : operationalStage === 'invoice_draft'
              ? 'Send Invoice'
              : operationalStage === 'invoiced'
                ? 'Collect Payment'
                : operationalStage === 'paid'
                  ? 'Closed'
                  : 'Open',
    payment_terms_due_days: dueDays,
  };
};
