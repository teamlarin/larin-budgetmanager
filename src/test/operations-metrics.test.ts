import { describe, expect, it } from 'vitest';
import {
  averageScopeDeviation,
  delayDays,
  npsSummary,
  onTimeDeliverySummary,
  operationsPeriodRange,
  remainingCapacity,
  saturationPct,
  scopeDeviationPct,
  scopeSeverity,
  utilizationRate,
  utilizationStatus,
} from '@/lib/operationsMetrics';

describe('operationsPeriodRange', () => {
  it('usa il mese corrente per l\'anno in corso', () => {
    const { start, end } = operationsPeriodRange('month', 2026, new Date(2026, 8, 11));
    expect(start.getMonth()).toBe(8);
    expect(end.getDate()).toBe(30);
  });

  it('usa il trimestre del riferimento', () => {
    const { start, end } = operationsPeriodRange('quarter', 2026, new Date(2026, 8, 11));
    expect(start.getMonth()).toBe(6);
    expect(end.getMonth()).toBe(8);
  });

  it('per gli anni passati parte da dicembre', () => {
    const { start } = operationsPeriodRange('month', 2025, new Date(2026, 0, 5));
    expect(start.getFullYear()).toBe(2025);
    expect(start.getMonth()).toBe(11);
  });

  it('anno intero', () => {
    const { start, end } = operationsPeriodRange('year', 2026, new Date(2026, 4, 4));
    expect(start.getMonth()).toBe(0);
    expect(end.getMonth()).toBe(11);
  });
});

describe('utilizzo', () => {
  it('calcola la percentuale', () => {
    expect(utilizationRate(75, 100)).toBe(75);
    expect(utilizationRate(10, 0)).toBe(0);
  });

  it('classifica rispetto al benchmark', () => {
    expect(utilizationStatus(75)).toBe('optimal');
    expect(utilizationStatus(60)).toBe('low');
    expect(utilizationStatus(85)).toBe('high');
    expect(utilizationStatus(95)).toBe('critical');
  });
});

describe('scostamento ore', () => {
  it('percentuale e severità', () => {
    expect(scopeDeviationPct(100, 130)).toBe(30);
    expect(scopeDeviationPct(0, 10)).toBeNull();
    expect(scopeSeverity(30)).toBe('critical');
    expect(scopeSeverity(10)).toBe('warning');
    expect(scopeSeverity(-5)).toBe('ok');
    expect(scopeSeverity(null)).toBe('ok');
  });

  it('media solo sui valori calcolabili', () => {
    expect(averageScopeDeviation([{ deviationPct: 10 }, { deviationPct: null }, { deviationPct: 30 }])).toBe(20);
    expect(averageScopeDeviation([{ deviationPct: null }])).toBeNull();
  });
});

describe('consegne in tempo', () => {
  it('conta in tempo, in ritardo e senza data', () => {
    const summary = onTimeDeliverySummary([
      { dueDate: '2026-01-31', completedAt: '2026-01-20T10:00:00Z' },
      { dueDate: '2026-02-28', completedAt: '2026-03-05T10:00:00Z' },
      { dueDate: null, completedAt: '2026-03-05T10:00:00Z' },
    ]);
    expect(summary).toMatchObject({ measured: 2, onTime: 1, late: 1, withoutDueDate: 1, ratePct: 50 });
  });

  it('giorni di ritardo', () => {
    expect(delayDays('2026-02-28', '2026-03-05T09:00:00Z')).toBe(5);
    expect(delayDays('2026-02-28', '2026-02-01T09:00:00Z')).toBe(0);
  });
});

describe('saturazione', () => {
  it('percentuale e ore libere', () => {
    expect(saturationPct(80, 100)).toBe(80);
    expect(remainingCapacity(100, 80)).toBe(20);
    expect(remainingCapacity(100, 130)).toBe(0);
  });
});

describe('nps', () => {
  it('calcola promotori, detrattori e indice', () => {
    const summary = npsSummary([10, 9, 8, 5, null]);
    expect(summary).toMatchObject({ responses: 4, promoters: 2, passives: 1, detractors: 1, npsScore: 25 });
    expect(summary.averageScore).toBe(8);
  });

  it('senza risposte resta vuoto', () => {
    expect(npsSummary([])).toMatchObject({ responses: 0, npsScore: null, averageScore: null });
  });
});
