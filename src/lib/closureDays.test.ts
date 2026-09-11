import { describe, it, expect } from 'vitest';
import {
  calculateEasterDate,
  calculateEasterMondayDate,
  getClosureDatesForRange,
  countBusinessClosureDays,
  isBusinessDay,
} from '@/lib/closureDays';

describe('closureDays', () => {
  it('calcola Pasqua 2026', () => {
    const easter = calculateEasterDate(2026);
    expect(easter.getFullYear()).toBe(2026);
    expect(easter.getMonth()).toBe(3); // aprile
    expect(easter.getDate()).toBe(5);
  });

  it('calcola Pasquetta 2026', () => {
    const monday = calculateEasterMondayDate(2026);
    expect(monday.getFullYear()).toBe(2026);
    expect(monday.getMonth()).toBe(3);
    expect(monday.getDate()).toBe(6);
  });

  it('restituisce solo le chiusure dentro il range', () => {
    const settings = {
      closureDays: [
        { date: '08-15', name: 'Ferragosto', isRecurring: true },
        { date: '2026-01-01', name: 'Capodanno 2026', isRecurring: false },
        { date: '2025-12-25', name: 'Natale 2025', isRecurring: false },
      ],
    };
    const start = new Date(2026, 0, 1); // 1 gen 2026
    const end = new Date(2026, 7, 31); // 31 ago 2026
    const dates = getClosureDatesForRange(start, end, settings);
    const names = dates.map((d) => d.toISOString().slice(0, 10)).sort();
    expect(names).toContain('2026-01-01');
    expect(names).toContain('2026-08-15');
    expect(names).toContain('2026-04-05'); // Pasqua
    expect(names).toContain('2026-04-06'); // Pasquetta
    expect(names).not.toContain('2025-12-25');
  });

  it('conta solo i giorni di chiusura lavorativi', () => {
    // Pasqua 2026: 5 apr (domenica) -> non lavorativo, non conta
    // Pasquetta 2026: 6 apr (lunedì) -> lavorativo, conta
    const settings = { closureDays: [] };
    const start = new Date(2026, 3, 1);
    const end = new Date(2026, 3, 30);
    expect(countBusinessClosureDays(start, end, settings)).toBe(1);
  });

  it('ignora le chiusure nel weekend', () => {
    const settings = {
      closureDays: [{ date: '08-15', name: 'Ferragosto', isRecurring: true }],
    };
    // 15 ago 2026 è sabato
    const start = new Date(2026, 7, 1);
    const end = new Date(2026, 7, 31);
    expect(countBusinessClosureDays(start, end, settings)).toBe(0);
  });

  it('isBusinessDay riconosce i giorni lavorativi', () => {
    expect(isBusinessDay(new Date(2026, 8, 14))).toBe(true); // lun
    expect(isBusinessDay(new Date(2026, 8, 19))).toBe(false); // sab
    expect(isBusinessDay(new Date(2026, 8, 20))).toBe(false); // dom
  });
});
