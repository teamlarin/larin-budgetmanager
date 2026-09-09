import { describe, it, expect } from 'vitest';
import {
  buildRateResolver,
  computeLaborCost,
  computeResidualMargin,
} from '@/lib/marginCalculation';

const U = 'user-1';

describe('buildRateResolver', () => {
  const periods = [
    { user_id: U, start_date: '2025-01-01', end_date: '2025-12-31', hourly_rate: 25 },
    { user_id: U, start_date: '2026-01-01', end_date: null, hourly_rate: 30 },
  ];

  it('usa la tariffa del periodo valido alla data', () => {
    const r = buildRateResolver(periods);
    expect(r(U, '2025-06-15')).toBe(25);
    expect(r(U, '2026-03-01')).toBe(30);
  });

  it('ricade sulla tariffa del profilo fuori dai periodi o senza periodi', () => {
    const r = buildRateResolver(periods, new Map([[U, 42], ['user-2', 18]]));
    expect(r(U, '2024-05-01')).toBe(42);
    expect(r('user-2', '2026-05-01')).toBe(18);
    expect(r('sconosciuto', '2026-05-01')).toBe(0);
    expect(r(null, '2026-05-01')).toBe(0);
  });
});

describe('computeLaborCost', () => {
  const resolver = buildRateResolver([
    { user_id: U, start_date: '2026-01-01', end_date: null, hourly_rate: 20 },
  ]);

  it('somma ore x (tariffa + overheads)', () => {
    const cost = computeLaborCost(
      [{ user_id: U, actual_start_time: '2026-02-02T09:00:00Z', actual_end_time: '2026-02-02T11:00:00Z' }],
      resolver,
      5,
    );
    expect(cost).toBe(50);
  });

  it('gestisce le registrazioni a cavallo di mezzanotte', () => {
    const cost = computeLaborCost(
      [{ user_id: U, actual_start_time: '2026-02-02T23:00:00Z', actual_end_time: '2026-02-02T01:00:00Z' }],
      resolver,
    );
    expect(cost).toBe(40);
  });

  it('ignora le registrazioni non confermate', () => {
    expect(
      computeLaborCost(
        [{ user_id: U, actual_start_time: '2026-02-02T09:00:00Z', actual_end_time: null }],
        resolver,
      ),
    ).toBe(0);
  });
});

describe('computeResidualMargin', () => {
  it('calcola margine, target e residuo al target', () => {
    const r = computeResidualMargin({
      activitiesBudget: 1500,
      laborCost: 600,
      externalCost: 150,
      marginPercentage: 30,
    });
    expect(r.residualMargin).toBe(50);
    expect(r.targetBudget).toBe(1050);
    expect(r.totalSpent).toBe(750);
    expect(r.remainingToTarget).toBe(300);
  });

  it('senza budget attività ma con costi il margine è -100', () => {
    expect(computeResidualMargin({ activitiesBudget: 0, laborCost: 500 }).residualMargin).toBe(-100);
  });

  it('senza budget attività e senza costi il margine non è calcolabile', () => {
    expect(computeResidualMargin({ activitiesBudget: 0, laborCost: 0 }).residualMargin).toBeNull();
  });

  it('il margine può diventare negativo con sforamento', () => {
    expect(
      computeResidualMargin({ activitiesBudget: 1000, laborCost: 1300 }).residualMargin,
    ).toBe(-30);
  });
});
