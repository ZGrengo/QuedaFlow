import { describe, it, expect } from 'vitest';
import { hhmmToMin, minToHhmm, overlaps, clamp } from './time';

describe('time utilities', () => {
  describe('hhmmToMin', () => {
    it('converts valid HH:MM to minutes', () => {
      expect(hhmmToMin('00:00')).toBe(0);
      expect(hhmmToMin('09:30')).toBe(570);
      expect(hhmmToMin('23:59')).toBe(1439);
    });

    it('throws on invalid format', () => {
      expect(() => hhmmToMin('25:00')).toThrow();
      expect(() => hhmmToMin('09:60')).toThrow();
      expect(() => hhmmToMin('invalid')).toThrow();
    });
  });

  describe('minToHhmm', () => {
    it('converts minutes to HH:MM', () => {
      expect(minToHhmm(0)).toBe('00:00');
      expect(minToHhmm(570)).toBe('09:30');
      expect(minToHhmm(1439)).toBe('23:59');
      expect(minToHhmm(1440)).toBe('24:00'); // end of day (for display)
    });

    it('throws on invalid minutes', () => {
      expect(() => minToHhmm(-1)).toThrow();
      expect(() => minToHhmm(1441)).toThrow();
    });
  });

  describe('overlaps', () => {
    it('detects overlapping ranges', () => {
      expect(overlaps(0, 100, 50, 150)).toBe(true);
      expect(overlaps(50, 150, 0, 100)).toBe(true);
      expect(overlaps(0, 100, 100, 200)).toBe(false); // touching but not overlapping
      expect(overlaps(0, 100, 101, 200)).toBe(false);
    });
  });

  describe('clamp', () => {
    it('clamps values to range', () => {
      expect(clamp(5, 0, 10)).toBe(5);
      expect(clamp(-5, 0, 10)).toBe(0);
      expect(clamp(15, 0, 10)).toBe(10);
    });
  });
});

