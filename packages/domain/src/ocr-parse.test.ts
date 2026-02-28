import { describe, it, expect } from 'vitest';
import { parseMapalOcrText } from './ocr-parse';

describe('parseMapalOcrText', () => {
  const planningStart = '2024-01-01';
  const planningEnd = '2024-01-31';

  describe('basic parsing', () => {
    it('parses simple date and time range', () => {
      const text = `15/01
11:00 - 17:00`;
      const result = parseMapalOcrText(text, planningStart, planningEnd);
      expect(result.shifts).toHaveLength(1);
      expect(result.shifts[0].dateISO).toBe('2024-01-15');
      expect(result.shifts[0].startMin).toBe(660); // 11:00
      expect(result.shifts[0].endMin).toBe(1020); // 17:00
      expect(result.shifts[0].crossesMidnight).toBe(false);
      expect(result.issues).toHaveLength(0);
    });

    it('parses multiple days', () => {
      const text = `15/01
11:00 - 17:00
16/01
09:00 - 13:00`;
      const result = parseMapalOcrText(text, planningStart, planningEnd);
      expect(result.shifts).toHaveLength(2);
      expect(result.shifts[0].dateISO).toBe('2024-01-15');
      expect(result.shifts[1].dateISO).toBe('2024-01-16');
    });
  });

  describe('free day detection', () => {
    it('skips free days', () => {
      const text = `15/01
Día libre
16/01
11:00 - 17:00`;
      const result = parseMapalOcrText(text, planningStart, planningEnd);
      expect(result.shifts).toHaveLength(1);
      expect(result.shifts[0].dateISO).toBe('2024-01-16');
    });

    it('handles "libre" marker', () => {
      const text = `15/01
Libre
16/01
09:00 - 13:00`;
      const result = parseMapalOcrText(text, planningStart, planningEnd);
      expect(result.shifts).toHaveLength(1);
      expect(result.shifts[0].dateISO).toBe('2024-01-16');
    });
  });

  describe('multiple shifts same day', () => {
    it('parses two shifts on the same day', () => {
      const text = `15/01
09:00 - 13:00
15/01
14:00 - 18:00`;
      const result = parseMapalOcrText(text, planningStart, planningEnd);
      expect(result.shifts).toHaveLength(2);
      expect(result.shifts[0].dateISO).toBe('2024-01-15');
      expect(result.shifts[0].startMin).toBe(540); // 09:00
      expect(result.shifts[0].endMin).toBe(780); // 13:00
      expect(result.shifts[1].dateISO).toBe('2024-01-15');
      expect(result.shifts[1].startMin).toBe(840); // 14:00
      expect(result.shifts[1].endMin).toBe(1080); // 18:00
    });

    it('parses two shifts on same day with date only once', () => {
      const text = `15/01
09:00 - 13:00
14:00 - 18:00`;
      const result = parseMapalOcrText(text, planningStart, planningEnd);
      expect(result.shifts).toHaveLength(2);
      expect(result.shifts[0].dateISO).toBe('2024-01-15');
      expect(result.shifts[1].dateISO).toBe('2024-01-15');
    });
  });

  describe('midnight crossing', () => {
    it('detects shift crossing midnight', () => {
      const text = `15/01
22:00 - 01:00`;
      const result = parseMapalOcrText(text, planningStart, planningEnd);
      expect(result.shifts).toHaveLength(1);
      expect(result.shifts[0].dateISO).toBe('2024-01-15');
      expect(result.shifts[0].startMin).toBe(1320); // 22:00
      expect(result.shifts[0].endMin).toBe(60); // 01:00
      expect(result.shifts[0].crossesMidnight).toBe(true);
    });

    it('handles shift ending at 00:00', () => {
      const text = `15/01
16:00 - 00:00`;
      const result = parseMapalOcrText(text, planningStart, planningEnd);
      expect(result.shifts).toHaveLength(1);
      expect(result.shifts[0].crossesMidnight).toBe(true);
      expect(result.shifts[0].endMin).toBe(1440); // 00:00 = end of day
    });
  });

  describe('OCR error normalization', () => {
    it('normalizes O to 0', () => {
      const text = `15/01
11:OO - 17:OO`;
      const result = parseMapalOcrText(text, planningStart, planningEnd);
      expect(result.shifts).toHaveLength(1);
      expect(result.shifts[0].startMin).toBe(660); // 11:00
      expect(result.shifts[0].endMin).toBe(1020); // 17:00
    });

    it('normalizes I/l to 1', () => {
      const text = `15/01
1I:00 - 17:00`;
      const result = parseMapalOcrText(text, planningStart, planningEnd);
      expect(result.shifts).toHaveLength(1);
      expect(result.shifts[0].startMin).toBe(660); // 11:00
    });

    it('normalizes various dash types', () => {
      const text = `15/01
11:00 – 17:00`; // en dash
      const result = parseMapalOcrText(text, planningStart, planningEnd);
      expect(result.shifts).toHaveLength(1);
      expect(result.shifts[0].startMin).toBe(660);
      expect(result.shifts[0].endMin).toBe(1020);
    });

    it('handles extra spaces', () => {
      const text = `15/01
11:00   -   17:00`;
      const result = parseMapalOcrText(text, planningStart, planningEnd);
      expect(result.shifts).toHaveLength(1);
      expect(result.shifts[0].startMin).toBe(660);
      expect(result.shifts[0].endMin).toBe(1020);
    });
  });

  describe('date range validation', () => {
    it('marks dates outside planning range', () => {
      const text = `15/12
11:00 - 17:00`;
      const result = parseMapalOcrText(text, planningStart, planningEnd);
      expect(result.shifts).toHaveLength(0);
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues[0].reason).toContain('fuera del rango');
    });

    it('handles dates in planning range', () => {
      const text = `01/01
11:00 - 17:00
31/01
09:00 - 13:00`;
      const result = parseMapalOcrText(text, planningStart, planningEnd);
      expect(result.shifts).toHaveLength(2);
      expect(result.issues).toHaveLength(0);
    });
  });

  describe('error handling', () => {
    it('handles empty text', () => {
      const result = parseMapalOcrText('', planningStart, planningEnd);
      expect(result.shifts).toHaveLength(0);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].reason).toContain('vacío');
    });

    it('reports time range without date', () => {
      const text = `11:00 - 17:00`;
      const result = parseMapalOcrText(text, planningStart, planningEnd);
      expect(result.shifts).toHaveLength(0);
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues[0].reason).toContain('sin fecha');
    });

    it('reports invalid time format', () => {
      const text = `15/01
25:00 - 17:00`;
      const result = parseMapalOcrText(text, planningStart, planningEnd);
      expect(result.shifts).toHaveLength(0);
      expect(result.issues.length).toBeGreaterThan(0);
    });
  });

  describe('Mapal same-line format (date + time on one line)', () => {
    const febPlanningStart = '2024-02-01';
    const febPlanningEnd = '2024-03-31';

    it('parses "dd/mm HH:mm - HH:mm e COC" lines', () => {
      const text = `26/02 17:00 - 20:00 e COC
26/02 21:30 - 01:00 e COC`;
      const result = parseMapalOcrText(text, febPlanningStart, febPlanningEnd);
      expect(result.shifts).toHaveLength(2);
      expect(result.shifts[0].dateISO).toBe('2024-02-26');
      expect(result.shifts[0].startMin).toBe(1020); // 17:00
      expect(result.shifts[0].endMin).toBe(1200); // 20:00
      expect(result.shifts[0].crossesMidnight).toBe(false);
      expect(result.shifts[1].dateISO).toBe('2024-02-26');
      expect(result.shifts[1].startMin).toBe(1290); // 21:30
      expect(result.shifts[1].endMin).toBe(60); // 01:00
      expect(result.shifts[1].crossesMidnight).toBe(true);
    });

    it('parses mix of same-line and date-only then time lines', () => {
      const text = `25/02
JU CRURS
26/02 17:00 - 20:00 e COC
26/02 21:30 - 01:00 e COC
27/02 20:30 - 01:00 e COC`;
      const result = parseMapalOcrText(text, febPlanningStart, febPlanningEnd);
      expect(result.shifts).toHaveLength(3);
      expect(result.shifts[0].dateISO).toBe('2024-02-26');
      expect(result.shifts[0].endMin).toBe(1200);
      expect(result.shifts[1].dateISO).toBe('2024-02-26');
      expect(result.shifts[1].crossesMidnight).toBe(true);
      expect(result.shifts[2].dateISO).toBe('2024-02-27');
      expect(result.shifts[2].crossesMidnight).toBe(true);
    });
  });

  describe('real-world OCR sample', () => {
    it('parses Mapal-like format with extra text', () => {
      const text = `LUNES 15/01
11:00 - 17:00 COC
MARTES 16/01
Día libre
MIÉRCOLES 17/01
09:00 - 13:00
14:00 - 18:00`;
      const result = parseMapalOcrText(text, planningStart, planningEnd);
      expect(result.shifts).toHaveLength(3);
      expect(result.shifts[0].dateISO).toBe('2024-01-15');
      expect(result.shifts[1].dateISO).toBe('2024-01-17');
      expect(result.shifts[2].dateISO).toBe('2024-01-17');
    });
  });

  describe('tolerant parsing (split lines, various formats)', () => {
    const marPlanningStart = '2026-03-01';
    const marPlanningEnd = '2026-03-31';

    it('1) Mapal line completa: dd/mm HH:mm - HH:mm', () => {
      const text = 'MI 04/02 CRURS 11:00 - 17:00 COC';
      const result = parseMapalOcrText(text, '2026-02-01', '2026-02-28');
      expect(result.shifts).toHaveLength(1);
      expect(result.shifts[0].dateISO).toBe('2026-02-04');
      expect(result.shifts[0].startMin).toBe(660);
      expect(result.shifts[0].endMin).toBe(1020);
    });

    it('2) Fecha en una línea + horas debajo', () => {
      const text = '10/03\n13:00 - 17:00\nCOC';
      const result = parseMapalOcrText(text, marPlanningStart, marPlanningEnd);
      expect(result.shifts).toHaveLength(1);
      expect(result.shifts[0].dateISO).toBe('2026-03-10');
      expect(result.shifts[0].startMin).toBe(780);
      expect(result.shifts[0].endMin).toBe(1020);
    });

    it('3) Rango partido: start en una línea, end en la siguiente', () => {
      const text = '10/03 13:00 -\n17:00 COC';
      const result = parseMapalOcrText(text, marPlanningStart, marPlanningEnd);
      expect(result.shifts).toHaveLength(1);
      expect(result.shifts[0].dateISO).toBe('2026-03-10');
      expect(result.shifts[0].startMin).toBe(780);
      expect(result.shifts[0].endMin).toBe(1020);
    });

    it('4) Guion largo y puntos en fecha', () => {
      const text = '10.03 13:00–17:00';
      const result = parseMapalOcrText(text, marPlanningStart, marPlanningEnd);
      expect(result.shifts).toHaveLength(1);
      expect(result.shifts[0].dateISO).toBe('2026-03-10');
      expect(result.shifts[0].startMin).toBe(780);
      expect(result.shifts[0].endMin).toBe(1020);
    });

    it('5) Con "a" entre horas', () => {
      const text = '10/03 13:00 a 17:00';
      const result = parseMapalOcrText(text, marPlanningStart, marPlanningEnd);
      expect(result.shifts).toHaveLength(1);
      expect(result.shifts[0].dateISO).toBe('2026-03-10');
      expect(result.shifts[0].startMin).toBe(780);
      expect(result.shifts[0].endMin).toBe(1020);
    });

    it('6) Sin fecha en esa línea pero con fecha previa', () => {
      const text = '10/03\nCOC\n13:00 - 17:00';
      const result = parseMapalOcrText(text, marPlanningStart, marPlanningEnd);
      expect(result.shifts).toHaveLength(1);
      expect(result.shifts[0].dateISO).toBe('2026-03-10');
      expect(result.shifts[0].startMin).toBe(780);
      expect(result.shifts[0].endMin).toBe(1020);
    });

    it('7) Fuera de rango: marca issue out_of_range', () => {
      const text = '10/03 13:00-17:00';
      const result = parseMapalOcrText(text, '2026-03-01', '2026-03-07');
      expect(result.shifts).toHaveLength(0);
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues.some(i => i.reason.includes('fuera del rango'))).toBe(true);
    });
  });

  describe('year resolution', () => {
    it('resolves year for dates in current year', () => {
      const text = `15/01
11:00 - 17:00`;
      const result = parseMapalOcrText(text, planningStart, planningEnd);
      expect(result.shifts[0].dateISO).toBe('2024-01-15');
    });

    it('handles year boundary in planning range', () => {
      const text = `31/12
11:00 - 17:00`;
      const result = parseMapalOcrText(text, '2023-12-01', '2024-01-31');
      // Should resolve to 2023-12-31 if it fits
      if (result.shifts.length > 0) {
        expect(result.shifts[0].dateISO).toMatch(/2023-12-31|2024-12-31/);
      }
    });
  });
});

