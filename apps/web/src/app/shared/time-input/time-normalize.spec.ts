import { normalizeTimeInput } from './time-normalize';

describe('normalizeTimeInput', () => {
  it('returns error for empty or whitespace', () => {
    expect(normalizeTimeInput('').error).toBeDefined();
    expect(normalizeTimeInput('   ').error).toBeDefined();
  });

  it('normalizes "9" to "09:00"', () => {
    expect(normalizeTimeInput('9').value).toBe('09:00');
  });

  it('normalizes "12" to "12:00"', () => {
    expect(normalizeTimeInput('12').value).toBe('12:00');
  });

  it('normalizes "930" to "09:30"', () => {
    expect(normalizeTimeInput('930').value).toBe('09:30');
  });

  it('normalizes "0930" to "09:30"', () => {
    expect(normalizeTimeInput('0930').value).toBe('09:30');
  });

  it('normalizes "09.30" to "09:30"', () => {
    expect(normalizeTimeInput('09.30').value).toBe('09:30');
  });

  it('normalizes "9:3" to "09:03"', () => {
    expect(normalizeTimeInput('9:3').value).toBe('09:03');
  });

  it('keeps valid HH:MM and pads', () => {
    expect(normalizeTimeInput('09:00').value).toBe('09:00');
    expect(normalizeTimeInput('9:00').value).toBe('09:00');
    expect(normalizeTimeInput('17:30').value).toBe('17:30');
  });

  it('rejects 24:00', () => {
    const r = normalizeTimeInput('24:00');
    expect(r.error).toBeDefined();
    expect(r.value).toBeUndefined();
  });

  it('rejects out-of-range', () => {
    expect(normalizeTimeInput('25:00').error).toBeDefined();
    expect(normalizeTimeInput('12:60').error).toBeDefined();
  });

  it('normalizes "2359" to "23:59"', () => {
    expect(normalizeTimeInput('2359').value).toBe('23:59');
  });
});
