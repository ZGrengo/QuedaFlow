/**
 * Formats an ISO date string (YYYY-MM-DD) as dd/mm/yyyy for display.
 */
export function formatDateDDMMYYYY(iso: string): string {
  if (!iso || iso.length < 10) return iso;
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
