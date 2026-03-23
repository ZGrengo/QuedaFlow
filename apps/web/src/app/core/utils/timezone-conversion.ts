import { normalizeGroupTimezone } from './timezone';

export interface ZonedRangeInstants {
  startMs: number;
  endMs: number;
}

export interface LocalRangeDayInfo {
  formattedRange: string;
  localDateISOStart: string;
  localDateISOEnd: string;
  relativeDayOffsetStart: number;
  relativeDayOffsetEnd: number;
  dayOffsetBadge: string | null;
  localDayLabel: string;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function splitDateISO(dateISO: string): { y: number; m: number; d: number } | null {
  const [ys, ms, ds] = dateISO.split('-');
  const y = Number(ys);
  const m = Number(ms);
  const d = Number(ds);
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return null;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return { y, m, d };
}

function addDaysISO(dateISO: string, days: number): string {
  const base = splitDateISO(dateISO);
  if (!base) return dateISO;
  const dt = new Date(Date.UTC(base.y, base.m - 1, base.d + days));
  const y = dt.getUTCFullYear();
  const m = dt.getUTCMonth() + 1;
  const d = dt.getUTCDate();
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

function getZoneParts(epochMs: number, timeZone: string): { y: number; m: number; d: number; h: number; min: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(new Date(epochMs));

  const byType: Record<string, string> = {};
  for (const p of parts) byType[p.type] = p.value;
  return {
    y: Number(byType['year']),
    m: Number(byType['month']),
    d: Number(byType['day']),
    h: Number(byType['hour']),
    min: Number(byType['minute'])
  };
}

function dateISOFromZoneParts(parts: { y: number; m: number; d: number }): string {
  return `${parts.y}-${pad2(parts.m)}-${pad2(parts.d)}`;
}

function zonedCivilToEpochMs(dateISO: string, minutesFromMidnight: number, timeZone: string): number | null {
  const base = splitDateISO(dateISO);
  if (!base) return null;
  if (!Number.isInteger(minutesFromMidnight) || minutesFromMidnight < 0 || minutesFromMidnight > 1440) return null;
  const hh = Math.floor(minutesFromMidnight / 60);
  const mm = minutesFromMidnight % 60;
  const tz = normalizeGroupTimezone(timeZone);

  let guess = Date.UTC(base.y, base.m - 1, base.d, hh, mm, 0, 0);
  const targetCivilUtc = Date.UTC(base.y, base.m - 1, base.d, hh, mm, 0, 0);

  // Iterative correction: aligns guessed instant with desired civil date/time in zone.
  for (let i = 0; i < 6; i++) {
    const observed = getZoneParts(guess, tz);
    const observedCivilUtc = Date.UTC(observed.y, observed.m - 1, observed.d, observed.h, observed.min, 0, 0);
    const diff = targetCivilUtc - observedCivilUtc;
    guess += diff;
    if (diff === 0) break;
  }

  const finalParts = getZoneParts(guess, tz);
  if (
    finalParts.y !== base.y ||
    finalParts.m !== base.m ||
    finalParts.d !== base.d ||
    finalParts.h !== hh ||
    finalParts.min !== mm
  ) {
    // Invalid local wall-clock time (e.g. DST gap) or non-resolvable mapping.
    return null;
  }

  return guess;
}

function formatTimeInZone(epochMs: number, timeZone: string): string {
  const tz = normalizeGroupTimezone(timeZone);
  return new Intl.DateTimeFormat('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: tz
  }).format(new Date(epochMs));
}

function dayKeyInZone(epochMs: number, timeZone: string): string {
  const tz = normalizeGroupTimezone(timeZone);
  return dateISOFromZoneParts(getZoneParts(epochMs, tz));
}

function dayOffsetRelativeToGroupDate(groupDateISO: string, localDateISO: string): number {
  const group = splitDateISO(groupDateISO);
  const local = splitDateISO(localDateISO);
  if (!group || !local) return 0;
  const groupUtc = Date.UTC(group.y, group.m - 1, group.d);
  const localUtc = Date.UTC(local.y, local.m - 1, local.d);
  return Math.round((localUtc - groupUtc) / (24 * 60 * 60 * 1000));
}

function formatDayOffsetBadge(offset: number): string | null {
  if (offset === 1) return '+1 día';
  if (offset === -1) return '-1 día';
  if (offset > 1) return `+${offset} días`;
  if (offset < -1) return `${offset} días`;
  return null;
}

export function buildGroupRangeInstants(
  dateISO: string,
  startMin: number,
  endMin: number,
  groupTimezone: string
): ZonedRangeInstants | null {
  const startMs = zonedCivilToEpochMs(dateISO, startMin, groupTimezone);
  if (startMs == null) return null;

  const crossesMidnight = endMin <= startMin;
  const endDate = crossesMidnight ? addDaysISO(dateISO, 1) : dateISO;
  const endMs = zonedCivilToEpochMs(endDate, endMin, groupTimezone);
  if (endMs == null) return null;

  return { startMs, endMs };
}

export function formatRangeInTimezoneFromInstants(
  instants: ZonedRangeInstants,
  timezone: string
): string {
  const start = formatTimeInZone(instants.startMs, timezone);
  const end = formatTimeInZone(instants.endMs, timezone);
  const sameDay = dayKeyInZone(instants.startMs, timezone) === dayKeyInZone(instants.endMs, timezone);
  return sameDay ? `${start} - ${end}` : `${start} - ${end} (+1d)`;
}

export function buildLocalRangeDayInfoFromInstants(
  groupDateISO: string,
  instants: ZonedRangeInstants,
  timezone: string
): LocalRangeDayInfo {
  const tz = normalizeGroupTimezone(timezone);
  const localDateISOStart = dayKeyInZone(instants.startMs, tz);
  const localDateISOEnd = dayKeyInZone(instants.endMs, tz);
  const relativeDayOffsetStart = dayOffsetRelativeToGroupDate(groupDateISO, localDateISOStart);
  const relativeDayOffsetEnd = dayOffsetRelativeToGroupDate(groupDateISO, localDateISOEnd);
  const dayOffsetBadge = formatDayOffsetBadge(relativeDayOffsetStart);
  const localDayLabel = new Intl.DateTimeFormat('es-ES', {
    weekday: 'short',
    timeZone: tz
  })
    .format(new Date(instants.startMs))
    .replace('.', '')
    .toLowerCase();

  return {
    formattedRange: formatRangeInTimezoneFromInstants(instants, tz),
    localDateISOStart,
    localDateISOEnd,
    relativeDayOffsetStart,
    relativeDayOffsetEnd,
    dayOffsetBadge,
    localDayLabel
  };
}

