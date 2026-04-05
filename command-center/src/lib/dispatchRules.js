import {
  addHours,
  addDays,
  differenceInCalendarDays,
  endOfDay,
  isSameDay,
} from 'date-fns';

import { getDispatchAddressValidation, hasDispatchableAddress } from '@/lib/dispatchAddress';
import { normalizeJobStatus } from '@/lib/jobStatus';

export const DISPATCH_PRIORITY_ORDER = ['critical', 'at_risk', 'triage', 'hygiene'];

export const DISPATCH_PRIORITY_META = {
  critical: {
    label: 'Critical',
    description: 'Near-term jobs with true dispatch blockers.',
    accent: 'red',
  },
  at_risk: {
    label: 'At Risk',
    description: 'Likely to slip unless dispatch acts soon.',
    accent: 'amber',
  },
  triage: {
    label: 'Triage',
    description: 'New or unscheduled work that still needs placement.',
    accent: 'blue',
  },
  hygiene: {
    label: 'Hygiene',
    description: 'Future work with non-blocking data gaps.',
    accent: 'slate',
  },
};

const ACTIVE_DISPATCH_STATUSES = ['scheduled', 'pending_schedule', 'en_route', 'in_progress', 'on_hold'];
const OPEN_DISPATCH_STATUSES = ['unscheduled', 'pending_schedule', ...ACTIVE_DISPATCH_STATUSES];
const CLOSED_DISPATCH_STATUSES = ['completed', 'cancelled'];
const TEST_RECORD_PATTERN = /\b(?:uat|test|legacy)\b/i;

const DEFAULT_CONTEXT = {
  now: null,
  criticalWindowHours: 24,
  atRiskWindowHours: 48,
  newIntakeHours: 48,
  legacyCutoffDays: 30,
};

const asText = (value) => (typeof value === 'string' ? value.trim() : '');

export const toDate = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const normalizeDispatchStatus = (value) => normalizeJobStatus(value);

const resolveContext = (context = {}) => {
  const now = toDate(context.now) || new Date();
  return {
    ...DEFAULT_CONTEXT,
    ...context,
    now,
  };
};

const jobPhone = (job) => asText(job?.leads?.phone || job?.lead_phone || job?.phone);

const hasPhone = (job) => Boolean(jobPhone(job));

const hasAddress = (job) => hasDispatchableAddress(job?.service_address);

const hasScheduledTime = (job) => Boolean(toDate(job?.scheduled_start));

const hasDuration = (job) => {
  if (Number(job?.estimated_duration_minutes) > 0) return true;

  const start = toDate(job?.scheduled_start);
  const end = toDate(job?.scheduled_end);
  if (!start || !end) return false;

  return end.getTime() > start.getTime();
};

const accessNotes = (job) =>
  asText(
    job?.access_notes ||
      job?.property_access_notes ||
      job?.gate_code ||
      job?.gate_notes ||
      job?.entry_notes ||
      job?.service_notes,
  );

const requiresAccessInfo = (job) =>
  Boolean(job?.requires_access_info || job?.gated_property || job?.access_required);

const requiresActiveCoordination = (job) =>
  Boolean(job?.requires_customer_contact || job?.coordination_required || job?.customer_contact_required);

const isOpenDispatchJob = (job) => OPEN_DISPATCH_STATUSES.includes(normalizeDispatchStatus(job?.status));

const isClosedDispatchJob = (job) => CLOSED_DISPATCH_STATUSES.includes(normalizeDispatchStatus(job?.status));

const isSchedulingBacklogJob = (job) => {
  const status = normalizeDispatchStatus(job?.status);
  const stage = asText(job?.operational_stage);

  return (
    status === 'unscheduled' ||
    status === 'pending_schedule' ||
    stage === 'unscheduled' ||
    stage === 'pending_schedule'
  );
};

const isScheduledLikeJob = (job) => {
  const status = normalizeDispatchStatus(job?.status);
  return ACTIVE_DISPATCH_STATUSES.includes(status) && status !== 'pending_schedule';
};

const getScheduledDayOffset = (job, context) => {
  const scheduled = toDate(job?.scheduled_start);
  if (!scheduled) return null;

  return differenceInCalendarDays(scheduled, context.now);
};

const isTomorrowDispatchJob = (job, context) => {
  const dayOffset = getScheduledDayOffset(job, context);
  return dayOffset === 1;
};

const isWithinAtRiskWindow = (job, context) => {
  const scheduled = toDate(job?.scheduled_start);
  if (!scheduled) return false;

  return scheduled <= addHours(context.now, context.atRiskWindowHours);
};

const isStartedToday = (job, context) => {
  const startedAt = toDate(job?.started_at || job?.actual_start_at);
  return Boolean(startedAt) && isSameDay(startedAt, context.now);
};

const isRecentIntake = (job, context) => {
  const createdAt = toDate(job?.created_at);
  if (!createdAt) return false;

  return createdAt >= addHours(context.now, -context.newIntakeHours);
};

const dispatchIdentityText = (job) =>
  [
    job?.work_order_number,
    job?.job_number,
    job?.quote_number,
    job?.leads?.first_name,
    job?.leads?.last_name,
    job?.lead_first_name,
    job?.lead_last_name,
    job?.service_address,
  ]
    .map((value) => asText(value))
    .filter(Boolean)
    .join(' ');

export const isLegacyExcluded = (job, context = {}) => {
  const resolvedContext = resolveContext(context);
  const createdAt = toDate(job?.created_at);
  const ageDays = createdAt ? differenceInCalendarDays(resolvedContext.now, createdAt) : 0;
  const looksLikeTestRecord =
    Boolean(job?.is_test_data) || TEST_RECORD_PATTERN.test(dispatchIdentityText(job));
  const staleBacklog =
    ageDays > resolvedContext.legacyCutoffDays &&
    isSchedulingBacklogJob(job) &&
    !toDate(job?.scheduled_start) &&
    !toDate(job?.completed_at);

  return looksLikeTestRecord || staleBacklog;
};

export const getDispatchAreaLabel = (job) => {
  const address = getDispatchAddressValidation(job?.service_address);
  if (!address.hasText) return 'Area unknown';
  if (address.city) return address.city;

  const parts = address.raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  return parts[1] || parts[0] || 'Area unknown';
};

export const getBlockers = (job, context = {}) => {
  const resolvedContext = resolveContext(context);
  const status = normalizeDispatchStatus(job?.status);
  const scheduledLike = isScheduledLikeJob(job);
  const today = isTodayDispatchJob(job, resolvedContext);
  const tomorrow = isTomorrowDispatchJob(job, resolvedContext);
  const active = ['en_route', 'in_progress'].includes(status);
  const coordinationRequired = requiresActiveCoordination(job);
  const missingAccess = requiresAccessInfo(job) && !accessNotes(job);

  const blockers = [];

  if ((today || tomorrow || active) && !hasAddress(job)) {
    blockers.push({ code: 'missing_address', label: 'Missing address' });
  }

  if ((scheduledLike || active || today) && !hasScheduledTime(job)) {
    blockers.push({ code: 'missing_scheduled_time', label: 'Missing scheduled time' });
  }

  if ((today || tomorrow) && !job?.technician_id && status !== 'in_progress') {
    blockers.push({ code: 'missing_technician', label: 'Missing technician' });
  }

  if ((today || tomorrow || active) && missingAccess) {
    blockers.push({ code: 'missing_access', label: 'Missing access info' });
  }

  if ((today || tomorrow || active) && coordinationRequired && !hasPhone(job)) {
    blockers.push({ code: 'missing_phone', label: 'Missing phone' });
  }

  return blockers;
};

export const getWarnings = (job, context = {}) => {
  const resolvedContext = resolveContext(context);
  const blockers = getBlockers(job, resolvedContext);
  const blockerCodes = new Set(blockers.map((entry) => entry.code));
  const scheduled = toDate(job?.scheduled_start);
  const futureScheduled = Boolean(scheduled) && scheduled > endOfDay(resolvedContext.now);

  const warnings = [];

  if (!blockerCodes.has('missing_phone') && !hasPhone(job)) {
    warnings.push({ code: 'missing_phone', label: 'Phone missing' });
  }

  if ((futureScheduled || isScheduledLikeJob(job)) && !hasDuration(job)) {
    warnings.push({ code: 'missing_duration', label: 'Duration missing' });
  }

  if (!blockerCodes.has('missing_access') && requiresAccessInfo(job) && !accessNotes(job)) {
    warnings.push({ code: 'missing_access', label: 'Access info missing' });
  }

  return warnings;
};

export const isTodayDispatchJob = (job, context = {}) => {
  const resolvedContext = resolveContext(context);
  const status = normalizeDispatchStatus(job?.status);
  if (isClosedDispatchJob(job)) return false;

  const scheduled = toDate(job?.scheduled_start);
  if (scheduled && isSameDay(scheduled, resolvedContext.now)) return true;

  if (['in_progress', 'en_route'].includes(status)) {
    if (scheduled && isSameDay(scheduled, resolvedContext.now)) return true;
    if (isStartedToday(job, resolvedContext)) return true;
  }

  return false;
};

export const isUpcomingDispatchJob = (job, context = {}) => {
  const resolvedContext = resolveContext(context);
  if (isClosedDispatchJob(job)) return false;

  const scheduled = toDate(job?.scheduled_start);
  if (!scheduled) return false;

  return (
    scheduled > endOfDay(resolvedContext.now) &&
    scheduled <= endOfDay(addDays(resolvedContext.now, 7))
  );
};

export const getPriorityTier = (job, context = {}) => {
  const resolvedContext = resolveContext(context);
  if (!isOpenDispatchJob(job) || isLegacyExcluded(job, resolvedContext)) return null;

  const blockers = getBlockers(job, resolvedContext);
  const warnings = getWarnings(job, resolvedContext);
  const today = isTodayDispatchJob(job, resolvedContext);
  const atRiskWindow = isWithinAtRiskWindow(job, resolvedContext);
  const active = ['in_progress', 'en_route'].includes(normalizeDispatchStatus(job?.status));

  if ((today || active) && blockers.length > 0) {
    return 'critical';
  }

  if ((isSchedulingBacklogJob(job) && job?.is_overdue) || (atRiskWindow && blockers.length > 0)) {
    return 'at_risk';
  }

  if (isSchedulingBacklogJob(job)) {
    return 'triage';
  }

  if (warnings.length > 0) {
    return 'hygiene';
  }

  return null;
};

const PRIMARY_BLOCKER_ORDER = [
  'missing_technician',
  'missing_address',
  'missing_access',
  'missing_phone',
  'missing_scheduled_time',
];

const PRIMARY_WARNING_ORDER = ['missing_access', 'missing_duration', 'missing_phone'];

const ISSUE_META = {
  missing_technician: {
    label: 'No technician assigned',
    nextAction: 'Assign technician',
  },
  missing_address: {
    label: 'Missing address',
    nextAction: 'Confirm address',
  },
  missing_access: {
    label: 'Missing access info',
    nextAction: 'Add access info',
  },
  missing_phone: {
    label: 'Missing phone',
    nextAction: 'Add phone number',
  },
  missing_scheduled_time: {
    label: 'Missing scheduled time',
    nextAction: 'Set service time',
  },
  missing_duration: {
    label: 'Missing duration',
    nextAction: 'Set duration',
  },
};

const getFirstRankedIssue = (issues = [], preferredOrder = []) => {
  if (!issues.length) return null;

  const ranked = preferredOrder.find((code) => issues.some((issue) => issue.code === code));
  if (ranked) return issues.find((issue) => issue.code === ranked) || null;

  return issues[0] || null;
};

const getRiskWindowPrefix = (job, context) => {
  if (isTomorrowDispatchJob(job, context)) return 'Tomorrow';
  if (isTodayDispatchJob(job, context)) return 'Today';
  return 'Upcoming';
};

export const getDispatchPrimaryIssue = (job, context = {}) => {
  const resolvedContext = resolveContext(context);
  const priorityTier = getPriorityTier(job, resolvedContext);
  const blockers = getBlockers(job, resolvedContext);
  const warnings = getWarnings(job, resolvedContext);
  const primaryBlocker = getFirstRankedIssue(blockers, PRIMARY_BLOCKER_ORDER);
  const primaryWarning = getFirstRankedIssue(warnings, PRIMARY_WARNING_ORDER);

  if (priorityTier === 'critical' && primaryBlocker) {
    return {
      code: primaryBlocker.code,
      severity: 'blocker',
      text: ISSUE_META[primaryBlocker.code]?.label || primaryBlocker.label,
      nextAction: ISSUE_META[primaryBlocker.code]?.nextAction || 'Fix blocker',
    };
  }

  if (priorityTier === 'at_risk') {
    if (isSchedulingBacklogJob(job) && job?.is_overdue) {
      return {
        code: 'overdue_unscheduled',
        severity: 'warning',
        text: 'Overdue - not scheduled',
        nextAction: 'Schedule job',
      };
    }

    if (primaryBlocker) {
      return {
        code: primaryBlocker.code,
        severity: 'warning',
        text: `${getRiskWindowPrefix(job, resolvedContext)} - ${(ISSUE_META[primaryBlocker.code]?.label || primaryBlocker.label).toLowerCase()}`,
        nextAction: ISSUE_META[primaryBlocker.code]?.nextAction || 'Resolve blocker',
      };
    }

    return {
      code: 'needs_scheduling',
      severity: 'warning',
      text: 'Needs scheduling',
      nextAction: 'Schedule job',
    };
  }

  if (priorityTier === 'triage') {
    if (isRecentIntake(job, resolvedContext)) {
      return {
        code: 'new_unscheduled',
        severity: 'info',
        text: 'New unscheduled work',
        nextAction: 'Review and schedule',
      };
    }

    return {
      code: 'ready_for_schedule',
      severity: 'info',
      text: 'Ready for scheduling',
      nextAction: 'Schedule job',
    };
  }

  if (priorityTier === 'hygiene' && primaryWarning) {
    return {
      code: primaryWarning.code,
      severity: 'warning',
      text: ISSUE_META[primaryWarning.code]?.label || primaryWarning.label,
      nextAction: ISSUE_META[primaryWarning.code]?.nextAction || 'Update record',
    };
  }

  return null;
};

export const getDispatchNextActionText = (job, context = {}) => {
  const primaryIssue = getDispatchPrimaryIssue(job, context);
  if (primaryIssue?.nextAction) return `Next: ${primaryIssue.nextAction}`;

  const primaryAction = getDispatchPrimaryAction(job);
  if (primaryAction?.label) return `Next: ${primaryAction.label}`;

  return 'Next: Review record';
};

export const getDispatchPrimaryAction = (job) => {
  const status = normalizeDispatchStatus(job?.status);

  if (status === 'unscheduled' || status === 'pending_schedule') {
    return { key: 'schedule', label: 'Schedule Now' };
  }

  if (status === 'scheduled' && !job?.technician_id) {
    return { key: 'assign_technician', label: 'Assign Technician' };
  }

  if (['scheduled', 'on_hold', 'en_route'].includes(status)) {
    return { key: 'start', label: 'Start Job' };
  }

  if (status === 'in_progress') {
    return { key: 'complete', label: 'Complete Job' };
  }

  if (status === 'completed' && job?.payment_status !== 'paid' && job?.latest_invoice_id) {
    return { key: 'invoice', label: 'Open Invoice' };
  }

  return { key: 'record', label: 'Open Record' };
};

export const sortDispatchJobs = (jobs = [], context = {}) => {
  const compareDates = (leftValue, rightValue, { nullsLast = true } = {}) => {
    const leftDate = toDate(leftValue);
    const rightDate = toDate(rightValue);

    if (leftDate && rightDate) {
      if (leftDate.getTime() !== rightDate.getTime()) {
        return leftDate.getTime() - rightDate.getTime();
      }
      return 0;
    }

    if (leftDate || rightDate) {
      if (!leftDate) return nullsLast ? 1 : -1;
      return nullsLast ? -1 : 1;
    }

    return 0;
  };

  return [...jobs].sort((left, right) => {
    if (left?.priority_tier && left?.priority_tier === right?.priority_tier) {
      if (['critical', 'at_risk'].includes(left.priority_tier)) {
        const scheduledSort = compareDates(left?.scheduled_start, right?.scheduled_start);
        if (scheduledSort !== 0) return scheduledSort;

        const dueSort = compareDates(left?.due_at, right?.due_at);
        if (dueSort !== 0) return dueSort;

        const createdSort = compareDates(left?.created_at, right?.created_at);
        if (createdSort !== 0) return createdSort;
      }

      if (left.priority_tier === 'triage') {
        const createdSort = compareDates(left?.created_at, right?.created_at);
        if (createdSort !== 0) return createdSort;

        const dueSort = compareDates(left?.due_at, right?.due_at);
        if (dueSort !== 0) return dueSort;
      }

      if (left.priority_tier === 'hygiene') {
        const scheduledSort = compareDates(left?.scheduled_start, right?.scheduled_start);
        if (scheduledSort !== 0) return scheduledSort;

        const createdSort = compareDates(left?.created_at, right?.created_at);
        if (createdSort !== 0) return createdSort;
      }
    }

    const scheduledSort = compareDates(left?.scheduled_start, right?.scheduled_start);
    if (scheduledSort !== 0) return scheduledSort;

    const dueSort = compareDates(left?.due_at, right?.due_at);
    if (dueSort !== 0) return dueSort;

    const createdSort = compareDates(left?.created_at, right?.created_at);
    if (createdSort !== 0) {
      return createdSort;
    }

    return String(left?.id || '').localeCompare(String(right?.id || ''));
  });
};

export const decorateDispatchJob = (job, context = {}) => {
  const resolvedContext = resolveContext(context);
  const blockers = getBlockers(job, resolvedContext);
  const warnings = getWarnings(job, resolvedContext);
  const priorityTier = getPriorityTier(job, resolvedContext);

  return {
    ...job,
    dispatch_status: normalizeDispatchStatus(job?.status),
    dispatch_area: getDispatchAreaLabel(job),
    blockers,
    warnings,
    priority_tier: priorityTier,
    priority_meta: priorityTier ? DISPATCH_PRIORITY_META[priorityTier] : null,
    is_today_dispatch: isTodayDispatchJob(job, resolvedContext),
    is_upcoming_dispatch: isUpcomingDispatchJob(job, resolvedContext),
    is_recent_intake: isRecentIntake(job, resolvedContext),
    is_legacy_excluded: isLegacyExcluded(job, resolvedContext),
    dispatch_primary_action: getDispatchPrimaryAction(job),
    dispatch_primary_issue: getDispatchPrimaryIssue(job, resolvedContext),
    dispatch_next_action_text: getDispatchNextActionText(job, resolvedContext),
  };
};

export const buildDispatchBoard = (jobs = [], context = {}) => {
  const resolvedContext = resolveContext(context);
  const decoratedJobs = jobs.map((job) => decorateDispatchJob(job, resolvedContext));
  const visibleJobs = decoratedJobs.filter((job) => !job.is_legacy_excluded);
  const hiddenLegacyJobs = decoratedJobs.filter((job) => job.is_legacy_excluded);

  const needsAction = {
    critical: [],
    at_risk: [],
    triage: [],
    hygiene: [],
  };

  visibleJobs.forEach((job) => {
    if (job.priority_tier && needsAction[job.priority_tier]) {
      needsAction[job.priority_tier].push(job);
    }
  });

  Object.keys(needsAction).forEach((tier) => {
    needsAction[tier] = sortDispatchJobs(needsAction[tier], resolvedContext);
  });

  const today = sortDispatchJobs(
    visibleJobs.filter((job) => job.is_today_dispatch),
    resolvedContext,
  );

  const upcoming = sortDispatchJobs(
    visibleJobs.filter((job) => job.is_upcoming_dispatch),
    resolvedContext,
  );

  return {
    visibleJobs,
    allDecoratedJobs: decoratedJobs,
    needsAction,
    today,
    upcoming,
    hiddenLegacyJobs,
    hiddenLegacyCount: hiddenLegacyJobs.length,
    counts: {
      critical: needsAction.critical.length,
      atRisk: needsAction.at_risk.length,
      triage: needsAction.triage.length,
      hygiene: needsAction.hygiene.length,
      today: today.length,
      upcoming: upcoming.length,
    },
  };
};
