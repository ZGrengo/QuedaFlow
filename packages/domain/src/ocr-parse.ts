/**
 * OCR Parser for schedule screenshots (Mapal and other apps)
 * Tolerant parser: handles split lines, various date/time formats, OCR errors.
 *
 * Formatos soportados:
 * - dd/mm, dd-mm, dd.mm (con o sin año)
 * - HH:MM - HH:MM, HH:MM–HH:MM, HH:MM a HH:MM
 * - Fecha y horas en la misma línea o en líneas separadas
 * - Rango partido: "13:00 -\n17:00"
 * - "Día libre" para omitir turnos
 *
 * Limitaciones:
 * - Requiere fecha en contexto cercano (máx ~5 líneas) para rangos horarios sueltos
 * - El año se resuelve por planning_start/planning_end del grupo
 */

export interface DetectedShift {
  dateISO: string; // YYYY-MM-DD
  startMin: number; // minutes from midnight (0-1439)
  endMin: number; // minutes from midnight (0-1439)
  crossesMidnight: boolean;
  confidence?: number;
}

export interface ParseIssue {
  line: string;
  reason: string;
}

export interface NormalizedLine {
  index: number;
  text: string;
}

/** Normalizes OCR text before parsing */
export function normalizeOcrText(text: string): { normalized: string; lines: NormalizedLine[] } {
  if (!text || !text.trim()) {
    return { normalized: '', lines: [] };
  }

  let normalized = text
    // Guiones largos → guion estándar
    .replace(/[–—−—]/g, '-')
    // " a " (con espacios) → " - "
    .replace(/\s+a\s+/gi, ' - ')
    // 13h00 → 13:00
    .replace(/(\d{1,2})h(\d{2})/gi, '$1:$2')
    // OCR: I/l→1 en contexto de horas (1I:00)
    .replace(/([01]?\d)[Il|](?=:\d{2})/g, '$11')
    // OCR: O→0 en contexto de horas (11:OO, 17:O0)
    .replace(/(\d{1,2}):([Oo0])([Oo0])/g, (_, h, m1, m2) => `${h}:${m1 === 'O' || m1 === 'o' ? '0' : m1}${m2 === 'O' || m2 === 'o' ? '0' : m2}`)
    .replace(/([Oo])([Oo0]):(\d{2})/g, (_, h1, h2, m) => `${h1 === 'O' || h1 === 'o' ? '0' : h1}${h2 === 'O' || h2 === 'o' ? '0' : h2}:${m}`)
    // Colapsar espacios múltiples (mantener \n)
    .replace(/[ \t]+/g, ' ')
    .replace(/\n +/g, '\n')
    .replace(/ +\n/g, '\n')
    .trim();

  const rawLines = normalized.split('\n');
  const lines: NormalizedLine[] = [];
  rawLines.forEach((line, i) => {
    const trimmed = line.trim();
    if (trimmed.length > 0) {
      lines.push({ index: i, text: trimmed });
    }
  });

  return { normalized, lines };
}

// --- Token types ---
type DateToken = { kind: 'date'; dd: number; mm: number; lineIndex: number };
type TimeToken = { kind: 'time'; hh: number; min: number; lineIndex: number; position: number };
type TimeRangeToken = { kind: 'range'; start: { hh: number; min: number }; end: { hh: number; min: number }; lineIndex: number };
type PartialRangeToken = { kind: 'partial'; start: { hh: number; min: number }; lineIndex: number };
type FreeDayToken = { kind: 'free'; lineIndex: number };

type Token = DateToken | TimeToken | TimeRangeToken | PartialRangeToken | FreeDayToken;

const DATE_RE = /(\b\d{1,2})[\/\.\-](\d{1,2})(?:[\/\.\-](\d{2,4}))?/g;
const TIME_RE = /\b([01]?\d|2[0-3])[:\.h]([0-5]\d)\b/g;
const RANGE_RE = /(\d{1,2})[:\.](\d{2})\s*-\s*(\d{1,2})[:\.](\d{2})/g;
const PARTIAL_RANGE_RE = /(\d{1,2})[:\.](\d{2})\s*-\s*$/;
const FREE_DAY_RE = /d[ií]a\s+libre|libre\b|sin\s+trabajo|no\s+trabajo|descanso/i;

function tokenize(lines: NormalizedLine[]): Token[] {
  const tokens: Token[] = [];

  for (const { index, text } of lines) {
    if (FREE_DAY_RE.test(text) && !RANGE_RE.test(text)) {
      tokens.push({ kind: 'free', lineIndex: index });
      continue;
    }

    // Date
    const dateMatch = text.match(/(\b\d{1,2})[\/\.\-](\d{1,2})(?:[\/\.\-](\d{2,4}))?/);
    if (dateMatch) {
      const dd = parseInt(dateMatch[1], 10);
      const mm = parseInt(dateMatch[2], 10);
      if (dd >= 1 && dd <= 31 && mm >= 1 && mm <= 12) {
        tokens.push({ kind: 'date', dd, mm, lineIndex: index });
      }
    }

    // Full range on same line
    const rangeMatch = text.match(/(\d{1,2})[:\.](\d{2})\s*-\s*(\d{1,2})[:\.](\d{2})/);
    if (rangeMatch) {
      tokens.push({
        kind: 'range',
        start: { hh: parseInt(rangeMatch[1], 10), min: parseInt(rangeMatch[2], 10) },
        end: { hh: parseInt(rangeMatch[3], 10), min: parseInt(rangeMatch[4], 10) },
        lineIndex: index
      });
      continue;
    }

    // Partial range: "13:00 -" at end of line
    const partialMatch = text.match(/(\d{1,2})[:\.](\d{2})\s*-\s*$/);
    if (partialMatch) {
      tokens.push({
        kind: 'partial',
        start: { hh: parseInt(partialMatch[1], 10), min: parseInt(partialMatch[2], 10) },
        lineIndex: index
      });
      continue;
    }

    // Single times (for joining across lines)
    let m: RegExpExecArray | null;
    const timeRe = /\b([01]?\d|2[0-3])[:\.h]([0-5]\d)\b/g;
    while ((m = timeRe.exec(text)) !== null) {
      tokens.push({
        kind: 'time',
        hh: parseInt(m[1], 10),
        min: parseInt(m[2], 10),
        lineIndex: index,
        position: m.index
      });
    }
  }

  return tokens;
}

function timeToMin(hh: number, min: number): number {
  if (hh < 0 || hh > 24 || min < 0 || min > 59) return -1;
  if (hh === 24) return 1440;
  return hh * 60 + min;
}

function resolveDateWithYear(
  day: number,
  month: number,
  planningStartISO: string,
  planningEndISO: string
): string | null {
  const [startYear, startMonth, startDay] = planningStartISO.split('-').map(Number);
  const [endYear, endMonth, endDay] = planningEndISO.split('-').map(Number);
  const planningStart = new Date(startYear, startMonth - 1, startDay);
  const planningEnd = new Date(endYear, endMonth - 1, endDay);

  const yearsToTry = new Set<number>();
  for (let y = startYear; y <= endYear; y++) yearsToTry.add(y);
  yearsToTry.add(startYear - 1);
  yearsToTry.add(endYear + 1);

  for (const year of Array.from(yearsToTry).sort((a, b) => a - b)) {
    const candidate = new Date(year, month - 1, day);
    if (candidate.getDate() === day && candidate.getMonth() === month - 1) {
      const d = new Date(year, month - 1, day);
      if (d >= planningStart && d <= planningEnd) {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
      }
    }
  }
  return null;
}

function buildShiftsFromTokens(
  tokens: Token[],
  lines: NormalizedLine[],
  planningStartISO: string,
  planningEndISO: string
): { shifts: DetectedShift[]; issues: ParseIssue[] } {
  const shifts: DetectedShift[] = [];
  const issues: ParseIssue[] = [];
  const MAX_LINES_BACK = 5;

  let currentDate: string | null = null;
  let lastDateLineIndex = -1;
  const lineMap = new Map<number, string>();
  lines.forEach(l => lineMap.set(l.index, l.text));

  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i];

    if (t.kind === 'free') {
      currentDate = null;
      i++;
      continue;
    }

    if (t.kind === 'date') {
      const resolved = resolveDateWithYear(t.dd, t.mm, planningStartISO, planningEndISO);
      if (resolved) {
        currentDate = resolved;
        lastDateLineIndex = t.lineIndex;
      } else {
        const lineText = lineMap.get(t.lineIndex) ?? '';
        issues.push({
          line: lineText,
          reason: `Fecha ${t.dd}/${t.mm} fuera del rango de planificación (${planningStartISO} - ${planningEndISO})`
        });
        currentDate = null;
      }
      i++;
      continue;
    }

    if (t.kind === 'range') {
      const startMin = timeToMin(t.start.hh, t.start.min);
      let endMin = timeToMin(t.end.hh, t.end.min);
      if (t.end.hh === 0 && t.end.min === 0) endMin = 1440;

      if (startMin < 0 || endMin < 0) {
        issues.push({ line: lineMap.get(t.lineIndex) ?? '', reason: 'Formato de hora inválido' });
        i++;
        continue;
      }

      if (!currentDate) {
        issues.push({
          line: lineMap.get(t.lineIndex) ?? '',
          reason: 'Rango de horas sin fecha asociada en contexto cercano'
        });
        i++;
        continue;
      }

      const crossesMidnight = endMin < startMin || endMin >= 1440;
      const normalizedEnd = endMin > 1440 ? endMin % 1440 : endMin;
      if (startMin >= 1440 || normalizedEnd < 0 || normalizedEnd > 1440) {
        issues.push({ line: lineMap.get(t.lineIndex) ?? '', reason: 'Rango de horas inválido' });
        i++;
        continue;
      }

      shifts.push({
        dateISO: currentDate,
        startMin,
        endMin: normalizedEnd,
        crossesMidnight
      });
      i++;
      continue;
    }

    if (t.kind === 'partial') {
      const startMin = timeToMin(t.start.hh, t.start.min);
      if (startMin < 0) {
        i++;
        continue;
      }

      if (!currentDate) {
        issues.push({
          line: lineMap.get(t.lineIndex) ?? '',
          reason: 'Rango horario incompleto sin fecha en contexto'
        });
        i++;
        continue;
      }

      const nextToken = tokens[i + 1];
      if (nextToken?.kind === 'time') {
        const endMin = timeToMin(nextToken.hh, nextToken.min);
        if (endMin >= 0 && nextToken.lineIndex - t.lineIndex <= 2) {
          const crossesMidnight = endMin < startMin || endMin >= 1440;
          const normalizedEnd = endMin > 1440 ? endMin % 1440 : endMin;
          shifts.push({
            dateISO: currentDate,
            startMin,
            endMin: normalizedEnd,
            crossesMidnight
          });
          i += 2;
          continue;
        }
      }
      issues.push({
        line: lineMap.get(t.lineIndex) ?? '',
        reason: 'Rango horario incompleto (falta hora fin en línea siguiente)'
      });
      i++;
      continue;
    }

    if (t.kind === 'time') {
      const nextToken = tokens[i + 1];
      if (nextToken?.kind === 'time' && nextToken.lineIndex - t.lineIndex <= 2) {
        const startMin = timeToMin(t.hh, t.min);
        const endMin = timeToMin(nextToken.hh, nextToken.min);
        if (startMin >= 0 && endMin >= 0) {
          if (!currentDate) {
            issues.push({
              line: lineMap.get(t.lineIndex) ?? '',
              reason: 'Rango de horas sin fecha asociada'
            });
          } else {
            const crossesMidnight = endMin < startMin || endMin >= 1440;
            const normalizedEnd = endMin > 1440 ? endMin % 1440 : endMin;
            shifts.push({
              dateISO: currentDate,
              startMin,
              endMin: normalizedEnd,
              crossesMidnight
            });
          }
          i += 2;
          continue;
        }
      }
      i++;
    }
  }

  return { shifts, issues };
}

/**
 * Parses OCR text to extract work shifts (tolerant to various formats)
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

  const { lines } = normalizeOcrText(text);
  if (lines.length === 0) {
    issues.push({ line: '', reason: 'Texto OCR vacío tras normalización' });
    return { shifts, issues };
  }

  const tokens = tokenize(lines);
  const result = buildShiftsFromTokens(tokens, lines, planningStartISO, planningEndISO);

  return result;
}
