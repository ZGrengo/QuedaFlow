/**
 * Normalizes user time input to HH:MM (00:00–23:59).
 * Accepts: "9" → "09:00", "930" → "09:30", "09.30" → "09:30", etc.
 */
export function normalizeTimeInput(raw: string): { value?: string; error?: string } {
  const s = raw.trim();
  if (!s.length) {
    return { error: 'Introduce una hora' };
  }

  // Replace dot with colon for European-style input
  const normalized = s.replace(/\./g, ':');

  // Already valid HH:MM (with optional leading zeros)
  const hhmmStrict = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;
  const matchStrict = normalized.match(hhmmStrict);
  if (matchStrict) {
    const h = parseInt(matchStrict[1], 10);
    const m = parseInt(matchStrict[2], 10);
    if (h === 24 && m === 0) {
      return { error: 'Usa 23:59 como máximo' };
    }
    return {
      value: `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
    };
  }

  // HH:MM with single digit minutes (e.g. "9:3" → "09:03")
  const hhmmLax = /^([0-1]?[0-9]|2[0-3]):([0-9])$/;
  const matchLax = normalized.match(hhmmLax);
  if (matchLax) {
    const h = parseInt(matchLax[1], 10);
    const m = parseInt(matchLax[2], 10);
    return {
      value: `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
    };
  }

  // Digits only: "9" → "09:00", "12" → "12:00", "930" → "09:30", "0930" → "09:30", "2359" → "23:59"
  const digitsOnly = normalized.replace(/\D/g, '');
  if (digitsOnly.length >= 1 && digitsOnly.length <= 4) {
    let h: number;
    let m: number;
    if (digitsOnly.length === 1) {
      h = parseInt(digitsOnly, 10);
      m = 0;
    } else if (digitsOnly.length === 2) {
      h = parseInt(digitsOnly, 10);
      m = 0;
    } else if (digitsOnly.length === 3) {
      h = parseInt(digitsOnly.slice(0, 1), 10);
      m = parseInt(digitsOnly.slice(1), 10);
    } else {
      h = parseInt(digitsOnly.slice(0, 2), 10);
      m = parseInt(digitsOnly.slice(2), 10);
    }
    if (h > 23 || m > 59) {
      return { error: 'Hora fuera de rango (00:00–23:59)' };
    }
    return {
      value: `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
    };
  }

  return { error: 'Formato esperado HH:MM (ej: 09:00 o 17:30)' };
}

import { AbstractControl, ValidationErrors } from '@angular/forms';

const HHMM_REGEX = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;

export function timeFormatValidator(control: AbstractControl): ValidationErrors | null {
  const v = control.value;
  if (v == null || v === '') return null;
  return HHMM_REGEX.test(v) ? null : { timeFormat: true };
}

export function timeRangeValidator(control: AbstractControl): ValidationErrors | null {
  const v = control.value;
  if (v == null || v === '') return null;
  if (!HHMM_REGEX.test(v)) return null;
  const [h, m] = v.split(':').map(Number);
  if (h > 23 || m > 59) return { timeRange: true };
  return null;
}

export function timeStepValidator(stepMinutes: number) {
  return (control: AbstractControl): ValidationErrors | null => {
    const v = control.value;
    if (v == null || v === '') return null;
    if (!HHMM_REGEX.test(v)) return null;
    const [, minutesPart] = v.split(':').map(Number);
    if (minutesPart % stepMinutes !== 0) return { timeStep: true };
    return null;
  };
}
