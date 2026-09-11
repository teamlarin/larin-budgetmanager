import { describe, expect, it } from 'vitest';
import { calculateProfit, normalizeMonthlyRecurring, sumTargetToMonth } from '@/lib/salesMetrics';

describe('sales metrics', () => {
  it('calcola profitto e margine sui totali', () => {
    expect(calculateProfit({ value: 1000, labor: 300, external: 200 })).toEqual({ totalCost: 500, profit: 500, margin: 50 });
  });

  it('non produce una percentuale senza valore', () => {
    expect(calculateProfit({ value: 0, labor: 100, external: 0 }).margin).toBeNull();
  });

  it('normalizza mensile, trimestrale e annuale in MRR', () => {
    expect(normalizeMonthlyRecurring(100, 'mensile')).toBe(100);
    expect(normalizeMonthlyRecurring(300, 'trimestrale')).toBe(100);
    expect(normalizeMonthlyRecurring(1200, 'annuale')).toBe(100);
  });

  it('somma il target stagionale fino al mese richiesto', () => {
    expect(sumTargetToMonth([{ month: 1, amount: 100 }, { month: 2, amount: 150 }, { month: 3, amount: 200 }], 2)).toBe(250);
  });
});