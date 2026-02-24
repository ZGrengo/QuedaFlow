/**
 * Converts HH:MM format to minutes from midnight
 * @param hhmm - Time in HH:MM format (e.g., "09:30")
 * @returns Minutes from midnight (0-1439)
 */
export function hhmmToMin(hhmm: string): number {
  const [hours, minutes] = hhmm.split(':').map(Number);
  if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    throw new Error(`Invalid time format: ${hhmm}. Expected HH:MM`);
  }
  return hours * 60 + minutes;
}

/**
 * Converts minutes from midnight to HH:MM format
 * @param min - Minutes from midnight (0-1439, or 1440 for end-of-day display)
 * @returns Time in HH:MM format; 1440 is displayed as "24:00"
 */
export function minToHhmm(min: number): string {
  if (min < 0 || min > 1440) {
    throw new Error(`Invalid minutes: ${min}. Must be 0-1440`);
  }
  if (min === 1440) {
    return '24:00';
  }
  const hours = Math.floor(min / 60);
  const minutes = min % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

/**
 * Checks if two time ranges overlap
 * @param start1 - Start of first range (minutes)
 * @param end1 - End of first range (minutes)
 * @param start2 - Start of second range (minutes)
 * @param end2 - End of second range (minutes)
 * @returns True if ranges overlap
 */
export function overlaps(
  start1: number,
  end1: number,
  start2: number,
  end2: number
): boolean {
  return start1 < end2 && start2 < end1;
}

/**
 * Clamps a value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

