import { supabaseAdmin } from '../_lib/supabaseAdmin.ts';

type DayHours = {
  isOpen: boolean;
  start: string;
  end: string;
};

type BusinessHoursRow = {
  operating_hours?: Record<string, DayHours> | null;
  time_zone?: string | null;
};

type BusinessHoursPolicy = {
  timeZone: string;
  operatingHours: Record<string, DayHours>;
};

type WindowOptions = {
  includeCurrentIfInside?: boolean;
};

const DEFAULT_TIME_ZONE = 'America/New_York';
const OPEN_BUFFER_MINUTES = 1;
const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const DEFAULT_OPERATING_HOURS: Record<string, DayHours> = {
  monday: { isOpen: true, start: '09:00', end: '17:00' },
  tuesday: { isOpen: true, start: '09:00', end: '17:00' },
  wednesday: { isOpen: true, start: '09:00', end: '17:00' },
  thursday: { isOpen: true, start: '09:00', end: '17:00' },
  friday: { isOpen: true, start: '09:00', end: '17:00' },
  saturday: { isOpen: false, start: '10:00', end: '14:00' },
  sunday: { isOpen: false, start: '10:00', end: '14:00' },
};

const policyCache = new Map<string, Promise<BusinessHoursPolicy>>();

const parseTimeParts = (value: string | null | undefined) => {
  const normalized = String(value || '').trim();
  const match = normalized.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return { hour: 9, minute: 0 };
  return {
    hour: Math.max(0, Math.min(23, Number(match[1]))),
    minute: Math.max(0, Math.min(59, Number(match[2]))),
  };
};

const toMinutes = (value: string | null | undefined) => {
  const { hour, minute } = parseTimeParts(value);
  return hour * 60 + minute;
};

const getTimeZoneOffsetMinutes = (date: Date, timeZone: string) => {
  const tzName = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'shortOffset',
  }).format(date);
  const match = tzName.match(/GMT([+-]\d{1,2})(?::(\d{2}))?/);
  if (!match) return 0;
  const hours = Number(match[1]);
  const minutes = match[2] ? Number(match[2]) : 0;
  return hours * 60 + (hours < 0 ? -minutes : minutes);
};

const getZonedDateParts = (date: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'long',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const out = parts.reduce<Record<string, string>>((acc, part) => {
    if (part.type !== 'literal') acc[part.type] = part.value;
    return acc;
  }, {});

  return {
    weekday: String(out.weekday || '').toLowerCase(),
    year: Number(out.year || 0),
    month: Number(out.month || 1),
    day: Number(out.day || 1),
    hour: Number(out.hour || 0),
    minute: Number(out.minute || 0),
    second: Number(out.second || 0),
  };
};

const buildZonedDate = (
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
) => {
  const naiveUtc = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const offsetMinutes = getTimeZoneOffsetMinutes(naiveUtc, timeZone);
  return new Date(naiveUtc.getTime() - offsetMinutes * 60_000);
};

const addCalendarDaysInTimeZone = (date: Date, days: number, timeZone: string) => {
  const parts = getZonedDateParts(date, timeZone);
  return buildZonedDate(parts.year, parts.month, parts.day + days, parts.hour, parts.minute, timeZone);
};

const normalizeOperatingHours = (value: Record<string, DayHours> | null | undefined) => {
  const merged: Record<string, DayHours> = { ...DEFAULT_OPERATING_HOURS };
  for (const dayKey of DAY_KEYS) {
    const current = value?.[dayKey];
    if (!current || typeof current !== 'object') continue;
    merged[dayKey] = {
      isOpen: Boolean(current.isOpen),
      start: current.start || DEFAULT_OPERATING_HOURS[dayKey].start,
      end: current.end || DEFAULT_OPERATING_HOURS[dayKey].end,
    };
  }
  return merged;
};

const loadPolicy = async (tenantId: string | null | undefined): Promise<BusinessHoursPolicy> => {
  const key = String(tenantId || '__default__');
  const cached = policyCache.get(key);
  if (cached) return cached;

  const pending = (async () => {
    let row: BusinessHoursRow | null = null;
    try {
      const baseQuery = supabaseAdmin
        .from('business_settings')
        .select('operating_hours, time_zone')
        .order('updated_at', { ascending: false })
        .limit(1);

      if (tenantId) {
        const { data, error } = await baseQuery.eq('tenant_id', tenantId).maybeSingle();
        if (!error) {
          row = (data as BusinessHoursRow | null) ?? null;
        }
      }

      if (!row) {
        const { data, error } = await supabaseAdmin
          .from('business_settings')
          .select('operating_hours, time_zone')
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!error) {
          row = (data as BusinessHoursRow | null) ?? null;
        }
      }
    } catch {
      row = null;
    }

    return {
      timeZone: row?.time_zone?.trim() || DEFAULT_TIME_ZONE,
      operatingHours: normalizeOperatingHours(row?.operating_hours),
    };
  })();

  policyCache.set(key, pending);
  try {
    return await pending;
  } catch (error) {
    policyCache.delete(key);
    throw error;
  }
};

const getDayHours = (policy: BusinessHoursPolicy, weekday: string) =>
  policy.operatingHours[weekday] || DEFAULT_OPERATING_HOURS[weekday] || DEFAULT_OPERATING_HOURS.monday;

const findNextBusinessWindow = (
  baseDate: Date,
  policy: BusinessHoursPolicy,
  options: WindowOptions = {},
) => {
  const includeCurrentIfInside = options.includeCurrentIfInside !== false;
  const baseParts = getZonedDateParts(baseDate, policy.timeZone);
  const baseDayUtc = new Date(Date.UTC(baseParts.year, baseParts.month - 1, baseParts.day));
  const baseMinutes = baseParts.hour * 60 + baseParts.minute;

  for (let offset = 0; offset < 14; offset += 1) {
    const candidateDayUtc = new Date(baseDayUtc.getTime() + offset * 86_400_000);
    const dayKey = DAY_KEYS[candidateDayUtc.getUTCDay()];
    const dayHours = getDayHours(policy, dayKey);
    if (!dayHours?.isOpen) continue;

    const startMinutes = toMinutes(dayHours.start) + OPEN_BUFFER_MINUTES;
    const endMinutes = toMinutes(dayHours.end);
    if (offset === 0) {
      if (includeCurrentIfInside && baseMinutes >= startMinutes && baseMinutes < endMinutes) {
        return baseDate;
      }
      if (baseMinutes < startMinutes) {
        return buildZonedDate(
          candidateDayUtc.getUTCFullYear(),
          candidateDayUtc.getUTCMonth() + 1,
          candidateDayUtc.getUTCDate(),
          Math.floor(startMinutes / 60),
          startMinutes % 60,
          policy.timeZone,
        );
      }
      continue;
    }

    return buildZonedDate(
      candidateDayUtc.getUTCFullYear(),
      candidateDayUtc.getUTCMonth() + 1,
      candidateDayUtc.getUTCDate(),
      Math.floor(startMinutes / 60),
      startMinutes % 60,
      policy.timeZone,
    );
  }

  return baseDate;
};

const coerceDate = (value: string | Date | null | undefined) => {
  if (value instanceof Date) return value;
  if (!value) return new Date();
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? new Date() : parsed;
};

export const getBusinessHoursPolicy = async (tenantId: string | null | undefined) => loadPolicy(tenantId);

export const isWithinBusinessHours = async (params: {
  tenantId?: string | null;
  at?: string | Date | null;
}) => {
  const policy = await loadPolicy(params.tenantId);
  const at = coerceDate(params.at);
  const parts = getZonedDateParts(at, policy.timeZone);
  const dayHours = getDayHours(policy, parts.weekday);
  if (!dayHours?.isOpen) return false;
  const minutes = parts.hour * 60 + parts.minute;
  const startMinutes = toMinutes(dayHours.start) + OPEN_BUFFER_MINUTES;
  const endMinutes = toMinutes(dayHours.end);
  return minutes >= startMinutes && minutes < endMinutes;
};

export const normalizeAutomationDueAt = async (params: {
  tenantId?: string | null;
  requestedAt?: string | Date | null;
  includeCurrentIfInside?: boolean;
}) => {
  const policy = await loadPolicy(params.tenantId);
  const requested = coerceDate(params.requestedAt);
  return findNextBusinessWindow(requested, policy, {
    includeCurrentIfInside: params.includeCurrentIfInside,
  });
};

export const scheduleAutomationDayOffset = async (params: {
  tenantId?: string | null;
  baseAt?: string | Date | null;
  dayOffset: number;
}) => {
  const policy = await loadPolicy(params.tenantId);
  const base = coerceDate(params.baseAt);
  const shifted = addCalendarDaysInTimeZone(base, params.dayOffset, policy.timeZone);
  return findNextBusinessWindow(shifted, policy, { includeCurrentIfInside: false });
};
