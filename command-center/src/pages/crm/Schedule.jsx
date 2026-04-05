import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { differenceInCalendarDays, format } from 'date-fns';
import {
  AlertTriangle,
  Calendar as CalIcon,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileText,
  Info,
  Loader2,
  MapPin,
  Phone,
  PlayCircle,
  Route,
  UserCheck,
  Wrench,
} from 'lucide-react';

import AddressAutocomplete from '@/components/AddressAutocomplete';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { getDispatchAddressValidation } from '@/lib/dispatchAddress';
import {
  buildDispatchBoard,
  DISPATCH_PRIORITY_ORDER,
  DISPATCH_PRIORITY_META,
  getDispatchPrimaryAction,
  normalizeDispatchStatus,
  toDate,
} from '@/lib/dispatchRules';
import { formatPhoneNumber } from '@/lib/formUtils';
import { cn } from '@/lib/utils';
import {
  formatOperationalStageLabel,
} from '@/lib/workOrderOperational';
import { getTenantId } from '@/lib/tenantUtils';
import { jobService } from '@/services/jobService';
import { workOrderBoardService } from '@/services/workOrderBoardService';

const STATUS_OPTIONS = [
  'unscheduled',
  'pending_schedule',
  'scheduled',
  'en_route',
  'in_progress',
  'on_hold',
  'completed',
  'cancelled',
];

const asText = (value) => (typeof value === 'string' ? value.trim() : '');
const asTracking = (value) => asText(value).toUpperCase();
const normalizeStatus = (value) => normalizeDispatchStatus(value);
const isMissingRelationError = (error) =>
  ['42P01', 'PGRST204', 'PGRST205'].includes(error?.code) ||
  /relation .* does not exist/i.test(error?.message || '') ||
  /could not find the (table|relation) .* schema cache/i.test(error?.message || '');

const toDatetimeLocal = (value) => {
  const date = toDate(value);
  if (!date) return '';

  const pad = (part) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const formatMoney = (value) => {
  const amount = Number(value || 0);
  return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
};

const formatPhoneDisplay = (value) => {
  const formatted = formatPhoneNumber(asText(value));
  return formatted || 'No phone on file';
};

const phoneHref = (value) => {
  const digits = String(value || '').replace(/[^\d]/g, '');
  return digits ? `tel:${digits}` : null;
};

const getMapUrl = (address) => {
  const normalized = asText(address);
  return normalized ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(normalized)}` : null;
};

const getWorkOrderLabel = (job) => {
  const workOrder = asTracking(job?.work_order_number);
  if (workOrder) return workOrder;

  const legacy = asTracking(job?.job_number);
  if (legacy) return legacy;

  return `WO-${String(job?.id || '').slice(0, 8).toUpperCase()}`;
};

const getCustomerName = (job) => {
  const first = asText(job?.leads?.first_name || job?.lead_first_name);
  const last = asText(job?.leads?.last_name || job?.lead_last_name);
  const combined = [first, last].filter(Boolean).join(' ');
  return combined || 'Unknown customer';
};

const getServiceLabel = (job) =>
  asText(
    job?.service_type ||
      job?.service_name ||
      job?.service_category ||
      job?.scope_summary ||
      job?.job_type ||
      job?.leads?.service ||
      job?.lead_service,
  ) || 'Service not set';

const getInitials = (name) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'WO';

const getUpcomingDayLabel = (value) => {
  const date = toDate(value);
  if (!date) return 'Upcoming';

  const diff = differenceInCalendarDays(date, new Date());
  if (diff === 1) return 'Tomorrow';
  return format(date, 'EEEE');
};

const getDurationMinutes = (job) => {
  const start = toDate(job?.scheduled_start);
  const end = toDate(job?.scheduled_end);
  if (!start || !end) return 120;

  const minutes = Math.round((end.getTime() - start.getTime()) / 60000);
  return minutes > 0 ? minutes : 120;
};

const getScheduleLabel = (job) => {
  const start = toDate(job?.scheduled_start);
  const end = toDate(job?.scheduled_end);
  if (!start) return 'Not scheduled';
  if (!end) return format(start, 'EEE, MMM d • h:mm a');
  return `${format(start, 'EEE, MMM d • h:mm a')} - ${format(end, 'h:mm a')}`;
};

const getNeedsActionTimeText = (job) => {
  const scheduled = toDate(job?.scheduled_start);
  if (scheduled) {
    const diff = differenceInCalendarDays(scheduled, new Date());
    if (diff === 0) return `Today, ${format(scheduled, 'h:mm a')}`;
    if (diff === 1) return `Tomorrow, ${format(scheduled, 'h:mm a')}`;
    return format(scheduled, 'MMM d, h:mm a');
  }

  const requested = toDate(job?.due_at);
  if (requested) return `Requested ${format(requested, 'MMM d')}`;

  return 'Needs scheduling';
};

const getNeedsActionAreaText = (job) => {
  const address = getDispatchAddressValidation(job?.service_address);
  if (!address.hasText) return 'Address missing';
  if (!address.hasDispatchableAddress) return 'Address incomplete';
  return job.dispatch_area || address.city || 'Area unknown';
};

const getEditableServiceText = (job) =>
  asText(
    job?.service_name ||
      job?.service_type ||
      job?.service_category ||
      job?.scope_summary ||
      job?.job_type ||
      job?.leads?.service ||
      job?.lead_service,
  );

const getDispatchBadgeStage = (job) => {
  if (job?.blockers?.some((issue) => issue.code === 'missing_technician')) {
    return 'unassigned';
  }

  return job?.operational_stage || job?.status;
};

const formatSelectedAddress = (addressData) => {
  if (!addressData || typeof addressData !== 'object') return '';
  const street = asText(addressData.street);
  const city = asText(addressData.city);
  const state = asText(addressData.state);
  const zip = asText(addressData.zip);
  const cityLine = [city, state, zip].filter(Boolean).join(' ');
  return [street, cityLine].filter(Boolean).join(', ') || asText(addressData.formatted_address);
};

const statusLabel = (value) =>
  normalizeStatus(value)
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const getTechnicianDisplayName = (technicians, technicianId) => {
  if (!technicianId) return 'Unassigned';
  const technician = technicians.find((entry) =>
    [entry.dispatch_id, entry.user_id, entry.id].filter(Boolean).includes(technicianId),
  );
  return technician?.full_name || 'Unassigned';
};

const resolveTechnicianSelection = (technicians, technicianId) => {
  if (!technicianId) return 'unassigned';
  const technician = technicians.find((entry) =>
    [entry.dispatch_id, entry.user_id, entry.id].filter(Boolean).includes(technicianId),
  );
  return technician?.dispatch_id || 'unassigned';
};

const MetricCard = ({ icon: Icon, label, value, tone = 'slate', detail }) => (
  <Card
    className={cn(
      'border shadow-sm',
      tone === 'red' && 'border-red-200 bg-red-50/80',
      tone === 'amber' && 'border-amber-200 bg-amber-50/80',
      tone === 'blue' && 'border-blue-200 bg-blue-50/80',
      tone === 'emerald' && 'border-emerald-200 bg-emerald-50/80',
    )}
  >
    <CardContent className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-end gap-3">
          <div
            className={cn(
              'text-5xl font-semibold leading-none',
              tone === 'red' && 'text-red-700',
              tone === 'amber' && 'text-amber-700',
              tone === 'blue' && 'text-blue-700',
              tone === 'emerald' && 'text-emerald-700',
              tone === 'slate' && 'text-slate-900',
            )}
          >
            {value}
          </div>
          <div className="pb-1 text-2xl font-medium leading-none text-slate-900">{label}</div>
        </div>
        <div
          className={cn(
            'rounded-xl p-2.5',
            tone === 'red' && 'bg-red-100 text-red-700',
            tone === 'amber' && 'bg-amber-100 text-amber-700',
            tone === 'blue' && 'bg-blue-100 text-blue-700',
            tone === 'emerald' && 'bg-emerald-100 text-emerald-700',
            tone === 'slate' && 'bg-slate-100 text-slate-700',
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>
      {detail ? <div className="mt-3 text-sm text-slate-600">{detail}</div> : null}
    </CardContent>
  </Card>
);

const EmptyMiniState = ({ title, detail }) => (
  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center">
    <div className="text-sm font-medium text-slate-700">{title}</div>
    <div className="mt-1 text-sm text-slate-500">{detail}</div>
  </div>
);

const EmptyMainState = ({ title, detail }) => (
  <div className="flex min-h-[220px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 text-center">
    <div className="space-y-2">
      <div className="text-base font-semibold text-slate-800">{title}</div>
      <div className="text-sm text-slate-500">{detail}</div>
    </div>
  </div>
);

const LoadingState = () => (
  <div className="flex min-h-[220px] items-center justify-center rounded-2xl border border-slate-200 bg-white">
    <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
  </div>
);

const StatusBadge = ({ stage, overdueReason }) => {
  const normalized = asText(stage);
  const isDanger = Boolean(overdueReason);
  const className = isDanger
    ? 'border-red-200 bg-red-50 text-red-700'
    : normalized === 'unassigned'
      ? 'border-amber-200 bg-amber-50 text-amber-700'
    : normalized === 'in_progress'
      ? 'border-blue-200 bg-blue-50 text-blue-700'
      : normalized === 'scheduled'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
        : normalized === 'invoice_draft' || normalized === 'invoiced'
          ? 'border-amber-200 bg-amber-50 text-amber-700'
          : normalized === 'paid'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
            : 'border-slate-200 bg-slate-50 text-slate-700';

  return (
    <Badge
      variant="outline"
      className={cn('rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]', className)}
    >
      {overdueReason || (normalized === 'unassigned' ? 'Unassigned' : formatOperationalStageLabel(normalized || 'unknown'))}
    </Badge>
  );
};

const AvatarChip = ({ name }) => (
  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-sm font-semibold text-slate-700">
    {getInitials(name)}
  </div>
);

const TimeChip = ({ job, subtle = false }) => {
  const start = toDate(job?.scheduled_start);
  const requested = toDate(job?.due_at);
  const className = subtle
    ? 'border-slate-200 bg-slate-50 text-slate-700'
    : job.priority_tier === 'critical'
      ? 'border-red-200 bg-red-50 text-red-700'
      : job.priority_tier === 'at_risk'
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : 'border-blue-200 bg-blue-50 text-blue-700';

  const label = start
    ? format(start, differenceInCalendarDays(start, new Date()) === 0 ? 'h:mm a' : 'MMM d')
    : requested
      ? format(requested, 'MMM d')
      : 'Needs Scheduling';

  return (
    <span className={cn('inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold', className)}>
      {label}
    </span>
  );
};

const IssueTray = ({ job, excludeCodes = [] }) => {
  const issues = [...(job?.blockers || []), ...(job?.warnings || [])];
  if (issues.length === 0) return null;

  const rendered = [];
  const seenCodes = new Set();
  const excluded = new Set(excludeCodes);

  issues.forEach((issue) => {
    if (!issue?.code || seenCodes.has(issue.code) || excluded.has(issue.code)) return;
    seenCodes.add(issue.code);

    if (issue.code === 'missing_address') {
      rendered.push({
        code: issue.code,
        icon: MapPin,
        label: 'Address missing',
        className: 'border-red-200 bg-red-50 text-red-700',
      });
      return;
    }

    if (issue.code === 'missing_technician') {
      rendered.push({
        code: issue.code,
        icon: UserCheck,
        label: 'Tech missing',
        className: 'border-red-200 bg-red-50 text-red-700',
      });
      return;
    }

    if (issue.code === 'missing_phone') {
      rendered.push({
        code: issue.code,
        icon: Phone,
        label: 'Phone missing',
        className: 'border-amber-200 bg-amber-50 text-amber-700',
      });
      return;
    }

    if (issue.code === 'missing_duration') {
      rendered.push({
        code: issue.code,
        icon: Clock3,
        label: 'Duration missing',
        className: 'border-amber-200 bg-amber-50 text-amber-700',
      });
      return;
    }

    if (issue.code === 'missing_access') {
      rendered.push({
        code: issue.code,
        icon: AlertTriangle,
        label: 'Access info missing',
        className: 'border-amber-200 bg-amber-50 text-amber-700',
      });
    }
  });

  if (rendered.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {rendered.slice(0, 3).map(({ code, icon: Icon, label, className }) => (
        <span
          key={code}
          className={cn(
            'inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-medium',
            className,
          )}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
        </span>
      ))}
    </div>
  );
};

const PrimaryIssueLine = ({ issue }) => {
  if (!issue?.text) return null;

  const Icon = issue.severity === 'info' ? Info : AlertTriangle;
  const className =
    issue.severity === 'blocker'
      ? 'text-red-700'
      : issue.severity === 'warning'
        ? 'text-amber-700'
        : 'text-blue-700';

  return (
    <div className={cn('mt-3 flex items-start gap-2 text-sm font-semibold', className)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{issue.text}</span>
    </div>
  );
};

const QueueSection = ({ title, description, jobs, selectedJobId, onSelect, accent = 'slate' }) => (
  <div className="space-y-3">
    <div className="flex items-center justify-between">
      <div>
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'h-2.5 w-2.5 rounded-full',
              accent === 'red' && 'bg-red-500',
              accent === 'amber' && 'bg-amber-500',
              accent === 'blue' && 'bg-blue-500',
              accent === 'slate' && 'bg-slate-400',
            )}
          />
          <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-900">{title}</h3>
        </div>
        <p className="mt-1 text-xs text-slate-500">{description}</p>
      </div>
      <Badge variant="outline" className="border-slate-200 bg-white text-slate-700">
        {jobs.length}
      </Badge>
    </div>

    {jobs.length === 0 ? (
      <EmptyMiniState title="Nothing waiting here" detail="This queue is clear right now." />
    ) : (
      <div className="space-y-3">
        {jobs.map((job) => (
          <button
            key={job.id}
            type="button"
            onClick={() => onSelect(job.id)}
            className={cn(
              'w-full rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:border-slate-300 hover:shadow-md',
              selectedJobId === job.id && 'border-blue-400 ring-2 ring-blue-100',
            )}
          >
            <div
              className={cn(
                'flex items-start justify-between gap-3 border-l-4 pl-3',
                job.priority_tier === 'critical' && 'border-red-500',
                job.priority_tier === 'at_risk' && 'border-amber-500',
                job.priority_tier === 'triage' && 'border-blue-500',
                job.priority_tier === 'hygiene' && 'border-slate-400',
                !job.priority_tier && 'border-slate-200',
              )}
            >
              <div className="flex items-start gap-3">
                <AvatarChip name={getCustomerName(job)} />
                <div className="min-w-0 space-y-1">
                  <div className="text-lg font-semibold text-slate-900">{getCustomerName(job)}</div>
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    {getWorkOrderLabel(job)}
                  </div>
                  <div className="text-base text-slate-700">{getServiceLabel(job)}</div>
                  <PrimaryIssueLine issue={job.dispatch_primary_issue} />
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <TimeChip job={job} />
              </div>
            </div>

            <div className="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-3">
              <span className="inline-flex items-center gap-1">
                <Clock3 className="h-3.5 w-3.5" />
                {getNeedsActionTimeText(job)}
              </span>
              <span className="inline-flex items-center gap-1">
                <UserCheck className="h-3.5 w-3.5" />
                {job.technician_name || 'Unassigned'}
              </span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {getNeedsActionAreaText(job)}
              </span>
            </div>

            <div className="mt-3 text-sm font-medium text-slate-800">{job.dispatch_next_action_text || 'Next: Review record'}</div>

            <IssueTray job={job} excludeCodes={job.dispatch_primary_issue?.code ? [job.dispatch_primary_issue.code] : []} />
          </button>
        ))}
      </div>
    )}
  </div>
);

const TodayDispatchCard = ({ job, selected, onSelect, technicianName }) => {
  return (
    <div
      className={cn(
        'rounded-2xl border bg-white p-4 shadow-sm transition',
        selected ? 'border-blue-400 ring-2 ring-blue-100' : 'border-slate-200',
      )}
    >
      <div
        className={cn(
          'flex items-start justify-between gap-3 border-l-4 pl-3',
          job.priority_tier === 'critical' && 'border-red-500',
          job.priority_tier === 'at_risk' && 'border-amber-500',
          job.priority_tier === 'triage' && 'border-blue-500',
          job.priority_tier === 'hygiene' && 'border-slate-400',
          !job.priority_tier && 'border-slate-200',
        )}
      >
        <button type="button" onClick={() => onSelect(job.id)} className="flex flex-1 items-start gap-3 text-left">
          <AvatarChip name={getCustomerName(job)} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3">
              <div className="text-lg font-semibold text-slate-900">{getCustomerName(job)}</div>
              <StatusBadge
                stage={getDispatchBadgeStage(job)}
                overdueReason={job.is_overdue ? job.overdue_reason : null}
              />
            </div>
            <div className="text-base text-slate-700">{getServiceLabel(job)}</div>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-500">
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {job.dispatch_area || 'Area unknown'}
              </span>
              <span className="inline-flex items-center gap-1">
                <UserCheck className="h-3.5 w-3.5" />
                {technicianName}
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock3 className="h-3.5 w-3.5" />
                {getDurationMinutes(job)} min
              </span>
            </div>
            <IssueTray job={job} />
          </div>
          <TimeChip job={job} subtle />
        </button>
      </div>
    </div>
  );
};

const UpcomingDispatchRow = ({ job, selected, onSelect, technicianName }) => (
  <button
    type="button"
    onClick={() => onSelect(job.id)}
    className={cn(
      'flex w-full items-start justify-between gap-4 rounded-2xl border px-4 py-3 text-left transition hover:border-slate-300',
      selected ? 'border-blue-400 bg-blue-50/60' : 'border-slate-200 bg-white',
    )}
  >
    <div className="flex min-w-0 items-start gap-3">
      <AvatarChip name={getCustomerName(job)} />
      <div className="min-w-0 space-y-1">
        <div className="truncate text-base font-semibold text-slate-900">{getCustomerName(job)}</div>
        <div className="truncate text-sm text-slate-700">{technicianName}</div>
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
          <span>{format(toDate(job.scheduled_start) || new Date(), 'h:mm a')}</span>
          <span className="text-slate-300">•</span>
          <span className="truncate">{job.dispatch_area || 'Area unknown'}</span>
        </div>
      </div>
    </div>
    <div className="space-y-1 text-right">
      <div className="text-sm font-medium text-slate-900">{getServiceLabel(job)}</div>
      <div className="text-sm text-slate-500">{formatMoney(job.total_amount)}</div>
    </div>
  </button>
);

const UpcomingDayBlock = ({ label, jobs, selectedJobId, onSelect }) => (
  <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
    <div className="text-lg font-semibold text-slate-900">{label}</div>
    <div className="space-y-3">
      {jobs.map((job) => (
        <UpcomingDispatchRow
          key={job.id}
          job={job}
          selected={selectedJobId === job.id}
          onSelect={onSelect}
          technicianName={job.technician_name || 'Unassigned'}
        />
      ))}
    </div>
  </div>
);

const ConsoleStat = ({ label, value }) => (
  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</div>
    <div className="mt-1 text-sm font-medium text-slate-800">{value}</div>
  </div>
);

const getPrimaryActionIcon = (actionKey) => {
  if (actionKey === 'schedule' || actionKey === 'assign_technician') return CalIcon;
  if (actionKey === 'start') return PlayCircle;
  if (actionKey === 'complete') return CheckCircle2;
  if (actionKey === 'invoice') return FileText;
  return ExternalLink;
};

const getPrimaryActionClassName = (actionKey) => {
  if (actionKey === 'complete') {
    return 'bg-emerald-600 text-white hover:bg-emerald-700';
  }

  if (actionKey === 'start') {
    return 'bg-blue-600 text-white hover:bg-blue-700';
  }

  if (actionKey === 'schedule' || actionKey === 'assign_technician') {
    return 'bg-slate-900 text-white hover:bg-slate-800';
  }

  return 'bg-slate-100 text-slate-900 hover:bg-slate-200';
};

export default function Schedule() {
  const { toast } = useToast();
  const tenantId = getTenantId();

  const [workOrders, setWorkOrders] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [processingId, setProcessingId] = useState(null);
  const [dispatchStart, setDispatchStart] = useState('');
  const [dispatchDuration, setDispatchDuration] = useState('120');
  const [dispatchTechnicianId, setDispatchTechnicianId] = useState('unassigned');
  const [dispatchAddress, setDispatchAddress] = useState('');
  const [dispatchService, setDispatchService] = useState('');
  const [dispatchStatus, setDispatchStatus] = useState('unscheduled');
  const [dispatchErrors, setDispatchErrors] = useState({});

  const hydrateBoard = async ({ showPageSpinner = false } = {}) => {
    if (!tenantId) return;

    if (showPageSpinner) setLoading(true);
    else setRefreshing(true);

    try {
      const [{ data: techniciansData, error: techniciansError }, workOrderRows] =
        await Promise.all([
          supabase
            .from('technicians')
            .select('id, user_id, full_name, is_active')
            .order('full_name', { ascending: true }),
          workOrderBoardService.fetchWorkOrders(tenantId),
        ]);

      if (techniciansError && !isMissingRelationError(techniciansError)) throw techniciansError;

      const technicianRows = ((techniciansError ? [] : techniciansData) || [])
        .filter((tech) => tech?.is_active !== false)
        .map((tech) => ({
          ...tech,
          dispatch_id: tech.user_id || tech.id,
        }));

      setTechnicians(technicianRows);
      setWorkOrders(
        (workOrderRows || []).map((job) => ({
          ...job,
          technician_name: getTechnicianDisplayName(technicianRows, job.technician_id),
        })),
      );
    } catch (error) {
      console.error('Schedule board load failed:', error);
      toast({
        variant: 'destructive',
        title: 'Dispatch load failed',
        description: error?.message || 'Could not load schedule board.',
      });
    } finally {
      if (showPageSpinner) setLoading(false);
      else setRefreshing(false);
    }
  };

  useEffect(() => {
    // Initial tenant load is intentionally keyed to tenant changes.
    hydrateBoard({ showPageSpinner: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  const dispatchBoard = buildDispatchBoard(workOrders, { now: new Date() });
  const needsActionSections = DISPATCH_PRIORITY_ORDER.filter((tier) => tier !== 'hygiene').map((tier) => ({
    key: tier,
    label: DISPATCH_PRIORITY_META[tier].label,
    description: DISPATCH_PRIORITY_META[tier].description,
    accent: DISPATCH_PRIORITY_META[tier].accent,
    jobs: dispatchBoard.needsAction[tier] || [],
  }));

  const firstActionableJob =
    needsActionSections.find((section) => section.jobs.length > 0)?.jobs[0] ||
    dispatchBoard.today[0] ||
    dispatchBoard.upcoming[0] ||
    dispatchBoard.visibleJobs[0] ||
    null;

  const assertFreshWorkOrder = async (job) => {
    if (!job?.id) return;

    const { data, error } = await supabase
      .from('jobs')
      .select('id, updated_at, status')
      .eq('id', job.id)
      .maybeSingle();

    if (error) throw error;
    if (!data?.id) return;

    const currentUpdatedAt = job?.updated_at ? new Date(job.updated_at).getTime() : null;
    const latestUpdatedAt = data?.updated_at ? new Date(data.updated_at).getTime() : null;

    if (
      Number.isFinite(currentUpdatedAt) &&
      Number.isFinite(latestUpdatedAt) &&
      currentUpdatedAt !== latestUpdatedAt
    ) {
      throw new Error('This work order changed in another session. Refresh the board and try again.');
    }
  };

  useEffect(() => {
    if (!dispatchBoard.visibleJobs.length) {
      setSelectedJobId(null);
      return;
    }

    const existing = dispatchBoard.visibleJobs.find((job) => job.id === selectedJobId);
    if (existing) return;

    setSelectedJobId(firstActionableJob?.id || null);
  }, [selectedJobId, dispatchBoard.visibleJobs, firstActionableJob]);

  const selectedJob = dispatchBoard.visibleJobs.find((job) => job.id === selectedJobId) || null;
  const selectedPrimaryAction = selectedJob?.dispatch_primary_action || (selectedJob ? getDispatchPrimaryAction(selectedJob) : null);
  const upcomingGroups = dispatchBoard.upcoming.reduce((groups, job) => {
    const label = getUpcomingDayLabel(job.scheduled_start);
    const existing = groups.find((group) => group.label === label);
    if (existing) {
      existing.jobs.push(job);
      return groups;
    }

    groups.push({ label, jobs: [job] });
    return groups;
  }, []);
  const unassignedCount = dispatchBoard.visibleJobs.filter((job) =>
    job.blockers?.some((issue) => issue.code === 'missing_technician'),
  ).length;
  const showDispatchEditor = ['schedule', 'assign_technician'].includes(selectedPrimaryAction?.key);

  const selectedJobResetKey = selectedJob
    ? [
        selectedJob.id,
        selectedJob.updated_at,
        selectedJob.technician_id || '',
        selectedJob.scheduled_start || '',
        selectedJob.scheduled_end || '',
        selectedJob.service_address || '',
        selectedJob.status || '',
        getEditableServiceText(selectedJob),
      ].join('|')
    : 'none';

  const selectedJobDispatchStart = selectedJob ? toDatetimeLocal(selectedJob.scheduled_start) : '';
  const selectedJobDispatchDuration = selectedJob ? String(getDurationMinutes(selectedJob)) : '120';
  const selectedJobDispatchTechnicianId = selectedJob
    ? resolveTechnicianSelection(technicians, selectedJob.technician_id)
    : 'unassigned';
  const selectedJobDispatchAddress = selectedJob?.service_address || '';
  const selectedJobDispatchService = selectedJob ? getEditableServiceText(selectedJob) : '';
  const selectedJobDispatchStatus = selectedJob ? normalizeStatus(selectedJob.status) || 'unscheduled' : 'unscheduled';

  useEffect(() => {
    if (selectedJobResetKey === 'none') {
      setDispatchStart('');
      setDispatchDuration('120');
      setDispatchTechnicianId('unassigned');
      setDispatchAddress('');
      setDispatchService('');
      setDispatchStatus('unscheduled');
      setDispatchErrors({});
      return;
    }

    setDispatchStart(selectedJobDispatchStart);
    setDispatchDuration(selectedJobDispatchDuration);
    setDispatchTechnicianId(selectedJobDispatchTechnicianId);
    setDispatchAddress(selectedJobDispatchAddress);
    setDispatchService(selectedJobDispatchService);
    setDispatchStatus(selectedJobDispatchStatus);
    setDispatchErrors({});
  }, [
    selectedJobResetKey,
    selectedJobDispatchAddress,
    selectedJobDispatchDuration,
    selectedJobDispatchService,
    selectedJobDispatchStart,
    selectedJobDispatchStatus,
    selectedJobDispatchTechnicianId,
  ]);

  const handlePrimaryAction = async () => {
    if (!selectedJob || !selectedPrimaryAction) return;

    if (selectedPrimaryAction.key === 'schedule' || selectedPrimaryAction.key === 'assign_technician') {
      await handleSaveDispatch();
      return;
    }

    if (selectedPrimaryAction.key === 'start') {
      await handleJobStatusChange(selectedJob, 'in_progress');
      return;
    }

    if (selectedPrimaryAction.key === 'complete') {
      await handleJobStatusChange(selectedJob, 'completed');
    }
  };

  const handleRefresh = async () => {
    await hydrateBoard();
  };

  const handleJobStatusChange = async (job, nextStatus) => {
    if (!job?.id) return;

    const normalizedNext = normalizeStatus(nextStatus);
    setProcessingId(job.id);

    try {
      await assertFreshWorkOrder(job);

      const result = await jobService.updateWorkOrder(
        job.id,
        {
          status: normalizedNext,
          updated_at: new Date().toISOString(),
        },
        tenantId,
      );

      if (!result.success) throw new Error(result.error);

      let description = `Work order moved to ${statusLabel(normalizedNext)}.`;
      if (normalizedNext === 'completed') {
        if (result?.invoiceResult?.invoice?.id) {
          const invoiceNumber = result?.invoice?.invoice_number
            ? `Invoice #${result.invoice.invoice_number}`
            : 'Draft invoice';
          description = `Work order completed. ${invoiceNumber} is ready.`;
        } else if (result?.invoiceResult?.error) {
          description = `Work order completed, but invoice flow failed: ${result.invoiceResult.error}`;
        } else {
          description = 'Work order completed. Invoice flow queued.';
        }
      }

      toast({ title: 'Dispatch updated', description });
      await hydrateBoard();
    } catch (error) {
      if ((error?.message || '').includes('changed in another session')) {
        await hydrateBoard();
      }
      toast({
        variant: 'destructive',
        title: 'Status change failed',
        description: error?.message || 'Could not update work order.',
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleSaveDispatch = async () => {
    if (!selectedJob?.id) return;

    const trimmedAddress = dispatchAddress.trim();
    const trimmedService = dispatchService.trim();
    const nextStatus = normalizeStatus(dispatchStatus || selectedJob.status);
    const mustHaveStart =
      ['unscheduled', 'pending_schedule'].includes(selectedJob.dispatch_status) || Boolean(dispatchStart);
    const addressValidation = getDispatchAddressValidation(trimmedAddress);
    const nextErrors = {};

    if (!trimmedAddress) {
      nextErrors.address = 'Street, city, and state are required before dispatch.';
    } else if (!addressValidation.hasDispatchableAddress) {
      nextErrors.address = 'Enter a dispatchable address with street, city, and state.';
    }

    if (!trimmedService) {
      nextErrors.service = 'Set the service or scope before saving dispatch.';
    }

    if (selectedPrimaryAction?.key === 'assign_technician' && dispatchTechnicianId === 'unassigned') {
      nextErrors.technician = technicians.length
        ? 'Choose a technician before assigning this work order.'
        : 'No active technicians are available to assign.';
    } else if (selectedPrimaryAction?.key === 'assign_technician' && technicians.length === 0) {
      nextErrors.technician = 'No active technicians are available to assign.';
    }

    if (mustHaveStart && !dispatchStart) {
      nextErrors.start = 'Select the service date and time before saving dispatch.';
    }

    const duration = Number(dispatchDuration);
    if (!Number.isFinite(duration) || duration <= 0) {
      nextErrors.duration = 'Dispatch duration must be greater than 0 minutes.';
    }

    setDispatchErrors(nextErrors);

    if (nextErrors.address) {
      toast({
        variant: 'destructive',
        title: 'Address required',
        description: nextErrors.address,
      });
      return;
    }

    if (nextErrors.service) {
      toast({
        variant: 'destructive',
        title: 'Service required',
        description: nextErrors.service,
      });
      return;
    }

    if (nextErrors.technician) {
      toast({
        variant: 'destructive',
        title: 'Technician required',
        description: nextErrors.technician,
      });
      return;
    }

    if (nextErrors.duration) {
      toast({
        variant: 'destructive',
        title: 'Invalid duration',
        description: nextErrors.duration,
      });
      return;
    }

    if (nextErrors.start) {
      toast({
        variant: 'destructive',
        title: 'Start time required',
        description: nextErrors.start,
      });
      return;
    }

    const payload = {
      service_address: trimmedAddress,
      technician_id: dispatchTechnicianId === 'unassigned' ? null : dispatchTechnicianId,
      status: nextStatus,
      updated_at: new Date().toISOString(),
    };

    if (dispatchStart) {
      const start = new Date(dispatchStart);
      if (Number.isNaN(start.getTime())) {
        toast({
          variant: 'destructive',
          title: 'Invalid start time',
          description: 'Use a valid service date and time.',
        });
        return;
      }

      const end = new Date(start.getTime() + duration * 60000);
      payload.scheduled_start = start.toISOString();
      payload.scheduled_end = end.toISOString();

      if (
        ['unscheduled', 'pending_schedule'].includes(selectedJob.dispatch_status) &&
        ['unscheduled', 'pending_schedule'].includes(nextStatus)
      ) {
        payload.status = 'scheduled';
      }
    }

    setProcessingId(selectedJob.id);
    try {
      await assertFreshWorkOrder(selectedJob);

      const result = await jobService.updateWorkOrder(selectedJob.id, payload, tenantId);
      if (!result.success) throw new Error(result.error);

      if (selectedJob.lead_id) {
        const { error: leadUpdateError } = await supabase
          .from('leads')
          .update({
            service: trimmedService,
            updated_at: new Date().toISOString(),
          })
          .eq('id', selectedJob.lead_id)
          .eq('tenant_id', tenantId);

        if (leadUpdateError) {
          throw leadUpdateError;
        }
      }

      toast({
        title: 'Dispatch saved',
        description: 'Service, schedule, technician, and dispatch details were updated.',
      });

      setDispatchErrors({});
      await hydrateBoard();
    } catch (error) {
      if ((error?.message || '').includes('changed in another session')) {
        await hydrateBoard();
      }
      toast({
        variant: 'destructive',
        title: 'Dispatch save failed',
        description: error?.message || 'Could not save dispatch changes.',
      });
    } finally {
      setProcessingId(null);
    }
  };

  const selectedJobMapUrl = getMapUrl(selectedJob?.service_address);
  const selectedJobPhoneHref = phoneHref(selectedJob?.leads?.phone);
  const selectedJobInvoiceHref =
    selectedJob?.latest_invoice_id ? `/${tenantId}/crm/invoices/${selectedJob.latest_invoice_id}` : null;
  const selectedJobRecordHref = selectedJob?.id ? `/${tenantId}/crm/jobs?id=${selectedJob.id}` : null;
  const selectedPrimaryActionHref =
    selectedPrimaryAction?.key === 'invoice'
      ? selectedJobInvoiceHref
      : selectedPrimaryAction?.key === 'record'
        ? selectedJobRecordHref
        : null;

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
            <Route className="h-3.5 w-3.5" />
            Execution Only
          </div>
          <div>
            <h1 className="text-4xl font-semibold tracking-tight text-slate-950">Dispatch</h1>
            <p className="mt-2 max-w-3xl text-base text-slate-600">
              Assign technicians, resolve blockers, and run already-booked work. First-time booking belongs in Calendar, not here.
            </p>
          </div>
        </div>

        <Button variant="outline" onClick={handleRefresh} disabled={refreshing || loading}>
          {refreshing || loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalIcon className="mr-2 h-4 w-4" />}
          Refresh Board
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={AlertTriangle}
          label="Critical"
          value={dispatchBoard.counts.critical}
          detail="Fix-now work with true dispatch blockers."
          tone="red"
        />
        <MetricCard
          icon={Wrench}
          label="At Risk"
          value={dispatchBoard.counts.atRisk}
          detail="Work likely to slip unless dispatch moves next."
          tone="amber"
        />
        <MetricCard
          icon={Clock3}
          label="Jobs Today"
          value={dispatchBoard.counts.today}
          detail="Committed work currently on the board for today."
          tone="blue"
        />
        <MetricCard
          icon={UserCheck}
          label="Unassigned"
          value={unassignedCount}
          detail="Visible work orders still missing a technician."
          tone="blue"
        />
      </div>

      {dispatchBoard.hiddenLegacyCount > 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          {dispatchBoard.hiddenLegacyCount} legacy or test work order
          {dispatchBoard.hiddenLegacyCount === 1 ? '' : 's'} hidden from the live dispatch board.
        </div>
      ) : null}

      {loading ? (
        <LoadingState />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)_380px]">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-100 bg-slate-50/80">
              <CardTitle className="text-2xl text-slate-950">Needs Action</CardTitle>
              <CardDescription>
                Severity-ranked dispatch work. Clear Critical first, then At Risk, then Triage.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 p-6">
              {needsActionSections.map((section) => (
                <QueueSection
                  key={section.key}
                  title={section.label}
                  description={section.description}
                  jobs={section.jobs}
                  selectedJobId={selectedJobId}
                  onSelect={setSelectedJobId}
                  accent={section.accent}
                />
              ))}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="border-b border-slate-100 bg-slate-50/80">
                <CardTitle className="text-2xl text-slate-950">Today</CardTitle>
                <CardDescription>
                  Ordered by time so dispatch can see the run of day, not just a list of records.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 p-6">
                {dispatchBoard.today.length === 0 ? (
                  <EmptyMainState
                    title="Nothing scheduled for today"
                    detail="Once a work order gets a date and time, it will appear here in dispatch order."
                  />
                ) : (
                  dispatchBoard.today.map((job) => (
                    <TodayDispatchCard
                      key={job.id}
                      job={job}
                      selected={selectedJobId === job.id}
                      onSelect={setSelectedJobId}
                      technicianName={job.technician_name || 'Unassigned'}
                    />
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="border-b border-slate-100 bg-slate-50/80">
                <CardTitle className="text-2xl text-slate-950">Hygiene</CardTitle>
                <CardDescription>
                  Future jobs with non-blocking data gaps. Fix these before they become tomorrow&apos;s problems.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 p-6">
                {dispatchBoard.needsAction.hygiene.length === 0 ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-5 text-sm font-medium text-emerald-700">
                    All set. No hygiene issues to address.
                  </div>
                ) : (
                  dispatchBoard.needsAction.hygiene.slice(0, 4).map((job) => (
                    <UpcomingDispatchRow
                      key={job.id}
                      job={job}
                      selected={selectedJobId === job.id}
                      onSelect={setSelectedJobId}
                      technicianName={job.technician_name || 'Unassigned'}
                    />
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6 xl:sticky xl:top-6 xl:self-start">
            <Card className="h-fit border-slate-200 shadow-sm">
              <CardHeader className="border-b border-slate-100 bg-slate-50/80">
                <CardTitle className="text-2xl text-slate-950">Dispatch Console</CardTitle>
                <CardDescription>
                  Select a booked work order and make the next operational move from one place.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5 p-6">
                {!selectedJob ? (
                  <EmptyMiniState
                    title="Select a job to dispatch"
                    detail="Choose any item from Needs Action, Today, or Upcoming to load its controls here."
                  />
                ) : (
                  <>
                    <div className="rounded-2xl border border-slate-200 bg-white p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="text-3xl font-semibold tracking-tight text-slate-950">
                            {getCustomerName(selectedJob)}
                          </div>
                          <div className="mt-1 text-lg text-slate-700">{getWorkOrderLabel(selectedJob)}</div>
                          <div className="mt-1 text-base text-slate-600">{getServiceLabel(selectedJob)}</div>
                        </div>
                        <AvatarChip name={getCustomerName(selectedJob)} />
                      </div>

                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <StatusBadge
                          stage={getDispatchBadgeStage(selectedJob)}
                          overdueReason={selectedJob.is_overdue ? selectedJob.overdue_reason : null}
                        />
                        <TimeChip job={selectedJob} subtle />
                      </div>

                      <div className="mt-4 space-y-3 text-base text-slate-700">
                        <div className="flex items-start gap-2">
                          <Clock3 className="mt-1 h-4 w-4 text-slate-400" />
                          <span>{getScheduleLabel(selectedJob)}</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <UserCheck className="mt-1 h-4 w-4 text-slate-400" />
                          <span>{selectedJob.technician_name || 'Unassigned technician'}</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <Phone className="mt-1 h-4 w-4 text-slate-400" />
                          <span>{formatPhoneDisplay(selectedJob.leads?.phone)}</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <MapPin className="mt-1 h-4 w-4 text-slate-400" />
                          <div className="space-y-1">
                            <div>{asText(selectedJob.service_address) || 'Service address missing'}</div>
                            {selectedJobMapUrl ? (
                              <a
                                href={selectedJobMapUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"
                              >
                                Open in Maps
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      <IssueTray job={selectedJob} />

                      <div className="mt-5 grid gap-3 sm:grid-cols-2">
                        <ConsoleStat
                          label="Next Action"
                          value={selectedPrimaryAction?.label || selectedJob.next_action_label || 'Open Record'}
                        />
                        <ConsoleStat
                          label="Payment"
                          value={asText(selectedJob.payment_status) || 'unpaid'}
                        />
                        <ConsoleStat
                          label="Potential Revenue"
                          value={formatMoney(selectedJob.total_amount)}
                        />
                        <ConsoleStat
                          label="Blocked Time"
                          value={`${getDurationMinutes(selectedJob)} min`}
                        />
                      </div>
                    </div>

                    {showDispatchEditor ? (
                      <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-700">
                          Dispatch Setup
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="dispatch-service-input">Service / Scope</Label>
                            <Input
                              id="dispatch-service-input"
                              aria-label="Dispatch Service Scope"
                              value={dispatchService}
                              onChange={(event) => {
                                setDispatchService(event.target.value);
                                setDispatchErrors((prev) => ({ ...prev, service: null }));
                              }}
                              placeholder="Dryer Vent Cleaning"
                              disabled={processingId === selectedJob.id}
                            />
                            {dispatchErrors.service ? (
                              <p className="text-sm text-red-600">{dispatchErrors.service}</p>
                            ) : null}
                          </div>

                        <div className="space-y-2">
                          <Label htmlFor="dispatch-status-select">Dispatch Status</Label>
                          <Select
                            value={dispatchStatus}
                            onValueChange={setDispatchStatus}
                            disabled={processingId === selectedJob.id}
                          >
                            <SelectTrigger id="dispatch-status-select" aria-label="Dispatch Status">
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent>
                              {STATUS_OPTIONS.map((status) => (
                                <SelectItem key={status} value={status}>
                                  {statusLabel(status)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="dispatch-start-input">Service Date & Time</Label>
                          <Input
                            id="dispatch-start-input"
                            aria-label="Dispatch Service Date Time"
                            type="datetime-local"
                            value={dispatchStart}
                            onChange={(event) => {
                              setDispatchStart(event.target.value);
                              setDispatchErrors((prev) => ({ ...prev, start: null }));
                            }}
                            disabled={processingId === selectedJob.id}
                          />
                          {dispatchErrors.start ? (
                            <p className="text-sm text-red-600">{dispatchErrors.start}</p>
                          ) : null}
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="dispatch-duration-input">Duration (minutes)</Label>
                            <Input
                              id="dispatch-duration-input"
                              aria-label="Dispatch Duration Minutes"
                              type="number"
                              min="30"
                              step="15"
                              value={dispatchDuration}
                              onChange={(event) => {
                                setDispatchDuration(event.target.value);
                                setDispatchErrors((prev) => ({ ...prev, duration: null }));
                              }}
                              disabled={processingId === selectedJob.id}
                            />
                            {dispatchErrors.duration ? (
                              <p className="text-sm text-red-600">{dispatchErrors.duration}</p>
                            ) : null}
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="dispatch-technician-select">Technician</Label>
                            <Select
                              value={dispatchTechnicianId}
                              onValueChange={(value) => {
                                setDispatchTechnicianId(value);
                                setDispatchErrors((prev) => ({ ...prev, technician: null }));
                              }}
                              disabled={processingId === selectedJob.id}
                            >
                              <SelectTrigger id="dispatch-technician-select" aria-label="Dispatch Technician">
                                <SelectValue placeholder="Unassigned" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="unassigned">Unassigned</SelectItem>
                                {technicians.map((technician) => (
                                  <SelectItem key={technician.id} value={technician.dispatch_id}>
                                    {technician.full_name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {dispatchErrors.technician ? (
                              <p className="text-sm text-red-600">{dispatchErrors.technician}</p>
                            ) : technicians.length === 0 ? (
                              <p className="text-sm text-amber-700">
                                No active technicians are available. Seed or create a technician before assigning work.
                              </p>
                            ) : null}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label>Service Address</Label>
                          <AddressAutocomplete
                            name="dispatch_service_address"
                            value={dispatchAddress}
                            onChange={(event) => {
                              setDispatchAddress(event.target.value);
                              setDispatchErrors((prev) => ({ ...prev, address: null }));
                            }}
                            onAddressSelect={(addressData) => {
                              setDispatchAddress(formatSelectedAddress(addressData));
                              setDispatchErrors((prev) => ({ ...prev, address: null }));
                            }}
                            className={dispatchErrors.address ? 'border-red-300 focus-visible:ring-red-300' : ''}
                            placeholder="Street, City, State ZIP"
                            disabled={processingId === selectedJob.id}
                          />
                          {dispatchErrors.address ? (
                            <p className="text-sm text-red-600">{dispatchErrors.address}</p>
                          ) : (
                            <p className="text-xs text-slate-500">Manual entry is allowed, but it must include street, city, and state.</p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-700">
                          Dispatch Context
                        </div>
                        <div className="mt-3 space-y-2 text-sm text-slate-600">
                          <div className="flex items-start gap-2">
                            <Clock3 className="mt-0.5 h-4 w-4 text-slate-400" />
                            <span>{getScheduleLabel(selectedJob)}</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <Wrench className="mt-0.5 h-4 w-4 text-slate-400" />
                            <span>{selectedJob.next_action_label || 'Move this job through its next operational step.'}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="grid gap-3">
                      {selectedPrimaryActionHref ? (
                        <Button asChild className={cn('h-14 text-xl font-semibold', getPrimaryActionClassName(selectedPrimaryAction?.key))}>
                          <Link to={selectedPrimaryActionHref}>
                            {React.createElement(getPrimaryActionIcon(selectedPrimaryAction?.key), {
                              className: 'mr-2 h-5 w-5',
                            })}
                            {selectedPrimaryAction?.label || 'Open Record'}
                          </Link>
                        </Button>
                      ) : (
                        <Button
                          onClick={handlePrimaryAction}
                          disabled={processingId === selectedJob.id}
                          className={cn('h-14 text-xl font-semibold', getPrimaryActionClassName(selectedPrimaryAction?.key))}
                        >
                          {processingId === selectedJob.id ? (
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          ) : (
                            React.createElement(getPrimaryActionIcon(selectedPrimaryAction?.key), {
                              className: 'mr-2 h-5 w-5',
                            })
                          )}
                          {selectedPrimaryAction?.label || 'Open Record'}
                        </Button>
                      )}

                      <div className="grid grid-cols-3 gap-2">
                        {selectedJobPhoneHref ? (
                          <Button variant="outline" asChild>
                            <a href={selectedJobPhoneHref}>
                              <Phone className="mr-2 h-4 w-4" />
                              Call
                            </a>
                          </Button>
                        ) : (
                          <Button variant="outline" disabled>
                            <Phone className="mr-2 h-4 w-4" />
                            Call
                          </Button>
                        )}

                        {selectedJobMapUrl ? (
                          <Button variant="outline" asChild>
                            <a href={selectedJobMapUrl} target="_blank" rel="noreferrer">
                              <MapPin className="mr-2 h-4 w-4" />
                              Map
                            </a>
                          </Button>
                        ) : (
                          <Button variant="outline" disabled>
                            <MapPin className="mr-2 h-4 w-4" />
                            Map
                          </Button>
                        )}

                        {selectedJobInvoiceHref ? (
                          <Button variant="outline" asChild>
                            <Link to={selectedJobInvoiceHref}>
                              <FileText className="mr-2 h-4 w-4" />
                              Invoice
                            </Link>
                          </Button>
                        ) : (
                          <Button variant="outline" disabled>
                            <FileText className="mr-2 h-4 w-4" />
                            Invoice
                          </Button>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="border-b border-slate-100 bg-slate-50/80">
                <CardTitle className="text-2xl text-slate-950">Upcoming This Week</CardTitle>
                <CardDescription>
                  Future scheduled work grouped by day so dispatch can see the next handoff before it becomes urgent.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 p-6">
                {upcomingGroups.length === 0 ? (
                  <EmptyMiniState
                    title="No upcoming work on the board"
                    detail="Future scheduled jobs will appear here grouped by day."
                  />
                ) : (
                  upcomingGroups.map((group) => (
                    <UpcomingDayBlock
                      key={group.label}
                      label={group.label}
                      jobs={group.jobs}
                      selectedJobId={selectedJobId}
                      onSelect={setSelectedJobId}
                    />
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-100 bg-slate-50/80">
          <CardTitle className="text-2xl text-slate-950">Calendar Handoff</CardTitle>
          <CardDescription>
            Booking and appointment approval now live in Calendar. Dispatch starts after the booking is committed.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <div className="text-base font-semibold text-slate-900">Need to book, approve, or reschedule a visit?</div>
              <div className="text-sm text-slate-600">
                Use Calendar as the only booking engine, then return here once the work is ready for technician assignment.
              </div>
            </div>
            <Button asChild>
              <Link to={`/${tenantId}/crm/calendar`}>
                Open Calendar
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
