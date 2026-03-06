/**
 * Converts a Date to YYYY-MM-DD using local timezone.
 * Avoids the off-by-one-day bug when using toISOString() in timezones ahead of UTC.
 */
export function dateToLocalISOString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Formats an ISO date string (YYYY-MM-DD) as dd/mm/yyyy for display.
 */
export function formatDateDDMMYYYY(iso: string): string {
  if (!iso || iso.length < 10) return iso;
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
