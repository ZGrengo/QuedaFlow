/**
 * OCR Parser for Mapal-like schedule screenshots
 * Parses OCR text to extract work shifts with dates and time ranges
 */

export interface DetectedShift {
  dateISO: string; // YYYY-MM-DD
  startMin: number; // minutes from midnight (0-1439)
  endMin: number; // minutes from midnight (0-1439)
  crossesMidnight: boolean;
  confidence?: number; // 0-1, optional
}

export interface ParseIssue {
  line: string; // Original line that caused the issue
  reason: string; // Human-readable reason
}

/**
 * Normalizes common OCR errors in time strings
 */
function normalizeTimeString(text: string): string {
  return text
    // Replace common OCR mistakes: O→0, I/l→1
    .replace(/[Oo]/g, '0')
    .replace(/[Il|]/g, '1')
    // Normalize various dash types to standard hyphen
    .replace(/[–—−]/g, '-')
    // Remove extra spaces
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extracts time range from text (e.g., "11:00 - 17:00" or "11:00-17:00 COC")
 * Returns [startHHMM, endHHMM] or null if not found
 */
function extractTimeRange(text: string): [string, string] | null {
  // Normalize first to handle OCR errors (O→0, I→1, etc.)
  const normalized = normalizeTimeString(text);
  
  // Pattern: HH:MM - HH:MM or HH:MM-HH:MM (after normalization)
  // Capture the full match to extract just the time range part
  const timePattern = /(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/;
  const match = normalized.match(timePattern);
  if (!match) return null;

  // Extract just the matched time range (ignore text before/after)
  const timeRangeStr = match[0];
  const parts = timeRangeStr.split(/\s*-\s*/);
  if (parts.length !== 2) return null;

  const start = parts[0].trim();
  const end = parts[1].trim();

  // Validate format
  if (!/^\d{1,2}:\d{2}$/.test(start) || !/^\d{1,2}:\d{2}$/.test(end)) {
    return null;
  }

  return [start, end];
}

/**
 * Converts HH:MM to minutes from midnight, handling values > 23:59
 * Special case: "00:00" as end time means end of day (1440)
 */
function hhmmToMinSafe(hhmm: string, isEndTime: boolean = false): number | null {
  const [hoursStr, minutesStr] = hhmm.split(':');
  const hours = parseInt(hoursStr, 10);
  const minutes = parseInt(minutesStr, 10);

  if (isNaN(hours) || isNaN(minutes) || minutes < 0 || minutes > 59) {
    return null;
  }

  // Special case: 00:00 as end time means end of day (1440)
  if (isEndTime && hours === 0 && minutes === 0) {
    return 1440;
  }

  // Allow hours > 23 for midnight crossing (e.g., 24:00 = next day 00:00)
  if (hours < 0 || hours > 24) {
    return null;
  }

  // If hours is 24, convert to 0 (next day)
  const normalizedHours = hours === 24 ? 0 : hours;
  return normalizedHours * 60 + minutes;
}

/**
 * Extracts date in dd/mm format from text
 * Returns [day, month] or null
 */
function extractDate(text: string): [number, number] | null {
  // Pattern: dd/mm (with optional year)
  const datePattern = /(\d{1,2})\/(\d{1,2})(?:\/\d{4})?/;
  const match = text.match(datePattern);
  if (!match) return null;

  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);

  if (day < 1 || day > 31 || month < 1 || month > 12) {
    return null;
  }

  return [day, month];
}

/**
 * Resolves year for a date given planning range
 * Returns YYYY-MM-DD or null if date doesn't fit in range
 */
function resolveDateWithYear(
  day: number,
  month: number,
  planningStartISO: string,
  planningEndISO: string
): string | null {
  // Parse planning dates as local dates (YYYY-MM-DD format)
  const [startYear, startMonth, startDay] = planningStartISO.split('-').map(Number);
  const [endYear, endMonth, endDay] = planningEndISO.split('-').map(Number);
  const planningStart = new Date(startYear, startMonth - 1, startDay);
  const planningEnd = new Date(endYear, endMonth - 1, endDay);

  // Try years in the planning range (start year, end year, and years in between)
  const yearsToTry = new Set<number>();
  for (let y = startYear; y <= endYear; y++) {
    yearsToTry.add(y);
  }
  // Also try adjacent years in case the range is near year boundary
  yearsToTry.add(startYear - 1);
  yearsToTry.add(endYear + 1);

  // Try each year
  for (const year of Array.from(yearsToTry).sort()) {
    const candidate = new Date(year, month - 1, day);
    // Check if date is valid (handles leap years, invalid dates like 31/02)
    if (candidate.getDate() === day && candidate.getMonth() === month - 1) {
      // Compare dates (ignore time)
      const candidateDateOnly = new Date(year, month - 1, day);
      if (candidateDateOnly >= planningStart && candidateDateOnly <= planningEnd) {
        // Format as YYYY-MM-DD manually to avoid timezone issues
        const yyyy = candidate.getFullYear();
        const mm = String(candidate.getMonth() + 1).padStart(2, '0');
        const dd = String(candidate.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
      }
    }
  }

  return null;
}

/**
 * Checks if text indicates a free day (no work)
 */
function isFreeDay(text: string): boolean {
  const normalized = text.toLowerCase().trim();
  const freeDayPatterns = [
    /d[ií]a\s+libre/i,
    /libre/i,
    /sin\s+trabajo/i,
    /no\s+trabajo/i,
    /descanso/i
  ];
  return freeDayPatterns.some(pattern => pattern.test(normalized));
}

/**
 * Parses a time range and pushes one shift to shifts (or an issue to issues).
 * @returns true if a shift was pushed, false if an issue was pushed
 */
function pushShiftFromTimeRange(
  shifts: DetectedShift[],
  issues: ParseIssue[],
  line: string,
  timeRange: [string, string],
  dateISO: string
): boolean {
  const [startHHMM, endHHMM] = timeRange;
  const startMin = hhmmToMinSafe(startHHMM, false);
  const endMin = hhmmToMinSafe(endHHMM, true);

  if (startMin === null || endMin === null) {
    issues.push({
      line,
      reason: `Formato de hora inválido: ${startHHMM} - ${endHHMM}`
    });
    return false;
  }

  const crossesMidnight = endMin < startMin || endMin >= 1440;
  let normalizedEndMin = endMin;
  if (endMin > 1440) {
    normalizedEndMin = endMin % 1440;
  }

  if (startMin < 0 || startMin >= 1440 || normalizedEndMin < 0 || normalizedEndMin > 1440) {
    issues.push({
      line,
      reason: `Rango de horas fuera de rango válido: ${startHHMM} - ${endHHMM}`
    });
    return false;
  }

  shifts.push({
    dateISO,
    startMin,
    endMin: normalizedEndMin,
    crossesMidnight
  });
  return true;
}

/**
 * Parses Mapal-like OCR text to extract work shifts
 * @param text - Raw OCR text
 * @param planningStartISO - Planning start date (YYYY-MM-DD)
 * @param planningEndISO - Planning end date (YYYY-MM-DD)
 * @returns Object with shifts array and issues array
 */
export function parseMapalOcrText(
  text: string,
  planningStartISO: string,
  planningEndISO: string
): { shifts: DetectedShift[]; issues: ParseIssue[] } {
  const shifts: DetectedShift[] = [];
  const issues: ParseIssue[] = [];

  if (!text || !text.trim()) {
    issues.push({ line: '', reason: 'Texto OCR vacío' });
    return { shifts, issues };
  }

  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  let currentDate: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check for free day (only if line doesn't look like "dd/mm HH:mm - HH:mm")
    if (isFreeDay(line) && !extractTimeRange(line)) {
      currentDate = null;
      continue;
    }

    const dateMatch = extractDate(line);
    const timeRange = extractTimeRange(line);

    // Same-line format: "26/02 17:00 - 20:00 e COC" → date and time on one line
    if (dateMatch && timeRange) {
      const [day, month] = dateMatch;
      const resolvedDate = resolveDateWithYear(day, month, planningStartISO, planningEndISO);
      if (!resolvedDate) {
        issues.push({
          line,
          reason: `Fecha ${day}/${month} fuera del rango de planificación (${planningStartISO} - ${planningEndISO})`
        });
        continue;
      }
      currentDate = resolvedDate;
      pushShiftFromTimeRange(shifts, issues, line, timeRange, resolvedDate);
      continue;
    }

    // Date only (e.g. "25/02" or "26/02" on its own)
    if (dateMatch && !timeRange) {
      const [day, month] = dateMatch;
      const resolvedDate = resolveDateWithYear(day, month, planningStartISO, planningEndISO);
      if (resolvedDate) {
        currentDate = resolvedDate;
      } else {
        issues.push({
          line,
          reason: `Fecha ${day}/${month} fuera del rango de planificación (${planningStartISO} - ${planningEndISO})`
        });
        currentDate = null;
      }
      continue;
    }

    // Time range only (use current date from previous line)
    if (timeRange) {
      if (!currentDate) {
        issues.push({
          line,
          reason: 'Rango de horas encontrado sin fecha asociada'
        });
        continue;
      }
      pushShiftFromTimeRange(shifts, issues, line, timeRange, currentDate);
    }
  }

  return { shifts, issues };
}

