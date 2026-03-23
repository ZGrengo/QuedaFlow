const DEFAULT_GROUP_TIMEZONE = 'Europe/Madrid';
const USER_TIMEZONE_STORAGE_KEY = 'qf.user.timezone';

function hasSupportedValuesOfTimeZone(): boolean {
  return typeof Intl !== 'undefined' && typeof (Intl as any).supportedValuesOf === 'function';
}

function getSupportedTimezonesSet(): Set<string> | null {
  if (!hasSupportedValuesOfTimeZone()) return null;
  try {
    const values = (Intl as any).supportedValuesOf('timeZone') as string[];
    return new Set(values);
  } catch {
    return null;
  }
}

export function isValidTimezone(value: string | null | undefined): boolean {
  const tz = (value ?? '').trim();
  if (!tz) return false;

  const supported = getSupportedTimezonesSet();
  if (supported) {
    return supported.has(tz);
  }

  // Fallback: accept non-empty "Area/Location" like names.
  return /^[A-Za-z_]+(?:\/[A-Za-z0-9_\-+]+)+$/.test(tz);
}

export function normalizeGroupTimezone(value: string | null | undefined): string {
  const tz = (value ?? '').trim();
  return isValidTimezone(tz) ? tz : DEFAULT_GROUP_TIMEZONE;
}

export function getBrowserTimezone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';
    return normalizeGroupTimezone(tz);
  } catch {
    return DEFAULT_GROUP_TIMEZONE;
  }
}

export function setStoredUserTimezone(value: string | null | undefined): string {
  const tz = normalizeGroupTimezone(value);
  try {
    localStorage.setItem(USER_TIMEZONE_STORAGE_KEY, tz);
  } catch {
    // ignore storage failures
  }
  return tz;
}

export function getStoredUserTimezone(): string {
  try {
    const stored = localStorage.getItem(USER_TIMEZONE_STORAGE_KEY);
    if (stored) return normalizeGroupTimezone(stored);
  } catch {
    // ignore storage failures
  }
  return getBrowserTimezone();
}

export function isDifferentTimezone(groupTz: string | null | undefined, userTz: string | null | undefined): boolean {
  const group = normalizeGroupTimezone(groupTz);
  const user = normalizeGroupTimezone(userTz);
  return !!user && group !== user;
}

export function formatGroupTimezoneLabel(timezone: string | null | undefined): string {
  return normalizeGroupTimezone(timezone);
}

export function formatCalendarDateEs(dateISO: string): string {
  if (!dateISO) return '';
  const [y, m, d] = dateISO.split('-').map((v) => Number(v));
  if (!y || !m || !d) return dateISO;
  const dateUtc = new Date(Date.UTC(y, m - 1, d));
  return new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC'
  }).format(dateUtc);
}

export const TIMEZONE_DEFAULT = DEFAULT_GROUP_TIMEZONE;
