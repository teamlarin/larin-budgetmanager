/**
 * Calcoli puri per la tab "Progetti e operations" del cruscotto:
 * utilizzo del team, deviazione delle ore preventivate, consegne in tempo,
 * saturazione della capacità e sintesi NPS. Nessuna lettura dal database qui.
 */
import { roundToMinute } from '@/lib/capacity';

export type OperationsPeriod = 'month' | 'quarter' | 'year';

export const OPERATIONS_PERIOD_LABELS: Record<OperationsPeriod, string> = {
  month: 'Mese',
  quarter: 'Trimestre',
  year: 'Anno',
};

/**
 * Intervallo del periodo scelto dentro l'anno selezionato. Per l'anno corrente
 * il riferimento è oggi; per gli anni passati è il 31 dicembre di quell'anno.
 */
export function operationsPeriodRange(
  period: OperationsPeriod,
  year: number,
  today: Date = new Date()
): { start: Date; end: Date } {
  const isCurrentYear = today.getFullYear() === year;
  const ref = isCurrentYear ? today : new Date(year, 11, 31);
  if (period === 'year') return { start: new Date(year, 0, 1), end: new Date(year, 11, 31) };
  if (period === 'month') {
    return { start: new Date(year, ref.getMonth(), 1), end: new Date(year, ref.getMonth() + 1, 0) };
  }
  const quarterStartMonth = Math.floor(ref.getMonth() / 3) * 3;
  return { start: new Date(year, quarterStartMonth, 1), end: new Date(year, quarterStartMonth + 3, 0) };
}

export interface PeriodRange {
  start: Date;
  end: Date;
  /** true quando non esiste alcun mese chiuso nell'anno selezionato. */
  empty: boolean;
  canPrev: boolean;
  canNext: boolean;
}

/**
 * Indice (0-11) dell'ultimo mese completamente chiuso dentro l'anno indicato.
 * null se l'anno non ha ancora nessun mese chiuso (gennaio dell'anno corrente
 * o anni futuri).
 */
export function lastClosedMonthIndex(year: number, today: Date = new Date()): number | null {
  if (year > today.getFullYear()) return null;
  if (year < today.getFullYear()) return 11;
  const index = today.getMonth() - 1;
  return index >= 0 ? index : null;
}

/**
 * Intervallo del periodo escludendo il mese in corso: le attività del mese
 * corrente non sono ancora pianificate/confermate del tutto e falserebbero i
 * conteggi. `offset` = 0 indica l'ultimo periodo chiuso, 1 il precedente e così
 * via.
 */
export function closedPeriodRange(
  period: OperationsPeriod,
  year: number,
  offset = 0,
  today: Date = new Date()
): PeriodRange {
  const last = lastClosedMonthIndex(year, today);
  if (last === null) {
    return {
      start: new Date(year, 0, 1),
      end: new Date(year, 0, 0),
      empty: true,
      canPrev: false,
      canNext: false,
    };
  }

  if (period === 'year') {
    return {
      start: new Date(year, 0, 1),
      end: new Date(year, last + 1, 0),
      empty: false,
      canPrev: false,
      canNext: false,
    };
  }

  if (period === 'month') {
    const month = Math.max(0, last - offset);
    return {
      start: new Date(year, month, 1),
      end: new Date(year, month + 1, 0),
      empty: false,
      canPrev: month > 0,
      canNext: month < last,
    };
  }

  const lastQuarter = Math.floor(last / 3);
  const quarter = Math.max(0, lastQuarter - offset);
  const startMonth = quarter * 3;
  const endMonth = Math.min(startMonth + 2, last);
  return {
    start: new Date(year, startMonth, 1),
    end: new Date(year, endMonth + 1, 0),
    empty: false,
    canPrev: quarter > 0,
    canNext: quarter < lastQuarter,
  };
}

/** Percentuale di ore fatturabili sulla capacità netta (0 se non c'è capacità). */
export function utilizationRate(billableHours: number, netCapacityHours: number): number {
  if (netCapacityHours <= 0) return 0;
  return Math.round((billableHours / netCapacityHours) * 1000) / 10;
}

export type UtilizationStatus = 'low' | 'optimal' | 'high' | 'critical';

/** Benchmark d'agenzia: 70-80% ottimale, oltre il 90% sovraccarico. */
export function utilizationStatus(pct: number): UtilizationStatus {
  if (pct > 90) return 'critical';
  if (pct >= 70 && pct <= 80) return 'optimal';
  if (pct > 80) return 'high';
  return 'low';
}

/** Scostamento percentuale tra ore effettive e ore preventivate. */
export function scopeDeviationPct(estimatedHours: number, actualHours: number): number | null {
  if (!estimatedHours || estimatedHours <= 0) return null;
  return Math.round(((actualHours - estimatedHours) / estimatedHours) * 1000) / 10;
}

export type ScopeSeverity = 'ok' | 'warning' | 'critical';

export function scopeSeverity(pct: number | null): ScopeSeverity {
  if (pct === null) return 'ok';
  if (pct > 20) return 'critical';
  if (pct > 5) return 'warning';
  return 'ok';
}

/** Media degli scostamenti calcolabili. */
export function averageScopeDeviation(rows: { deviationPct: number | null }[]): number | null {
  const values = rows.map((row) => row.deviationPct).filter((value): value is number => value !== null);
  if (values.length === 0) return null;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

export interface DeliveryItem {
  /** Data di fine prevista, null se il progetto non ne ha una. */
  dueDate: string | null;
  /** Data di passaggio a completato. */
  completedAt: string | null;
}

export interface DeliverySummary {
  measured: number;
  onTime: number;
  late: number;
  withoutDueDate: number;
  ratePct: number | null;
}

export function onTimeDeliverySummary(items: DeliveryItem[]): DeliverySummary {
  let onTime = 0;
  let late = 0;
  let withoutDueDate = 0;
  for (const item of items) {
    if (!item.dueDate || !item.completedAt) {
      withoutDueDate++;
      continue;
    }
    if (item.completedAt.slice(0, 10) <= item.dueDate.slice(0, 10)) onTime++;
    else late++;
  }
  const measured = onTime + late;
  return {
    measured,
    onTime,
    late,
    withoutDueDate,
    ratePct: measured > 0 ? Math.round((onTime / measured) * 1000) / 10 : null,
  };
}

/** Giorni di ritardo (0 se in tempo o non calcolabile). */
export function delayDays(dueDate: string | null, completedAt: string | null): number {
  if (!dueDate || !completedAt) return 0;
  const due = new Date(`${dueDate.slice(0, 10)}T00:00:00`);
  const done = new Date(`${completedAt.slice(0, 10)}T00:00:00`);
  const diff = Math.round((done.getTime() - due.getTime()) / 86_400_000);
  return diff > 0 ? diff : 0;
}

/** Percentuale di capacità netta già impegnata (pianificato). */
export function saturationPct(plannedHours: number, netCapacityHours: number): number {
  if (netCapacityHours <= 0) return 0;
  return Math.round((plannedHours / netCapacityHours) * 1000) / 10;
}

/** Ore ancora libere: mai negative, arrotondate al minuto. */
export function remainingCapacity(netCapacityHours: number, plannedHours: number): number {
  return roundToMinute(Math.max(0, netCapacityHours - plannedHours));
}

export interface NpsSummary {
  responses: number;
  promoters: number;
  passives: number;
  detractors: number;
  averageScore: number | null;
  npsScore: number | null;
}

/** Sintesi NPS su scala 0-10: promotori 9-10, passivi 7-8, detrattori 0-6. */
export function npsSummary(scores: (number | null)[]): NpsSummary {
  const valid = scores.filter((score): score is number => score !== null && Number.isFinite(score));
  const promoters = valid.filter((score) => score >= 9).length;
  const passives = valid.filter((score) => score >= 7 && score < 9).length;
  const detractors = valid.filter((score) => score < 7).length;
  return {
    responses: valid.length,
    promoters,
    passives,
    detractors,
    averageScore: valid.length ? Math.round((valid.reduce((sum, s) => sum + s, 0) / valid.length) * 10) / 10 : null,
    npsScore: valid.length ? Math.round(((promoters - detractors) / valid.length) * 100) : null,
  };
}

/** Confronto di nomi progetto tollerante a spazi e maiuscole. */
export function normalizeProjectName(name: string | null | undefined): string {
  return (name ?? '').trim().toLocaleLowerCase('it').replace(/\s+/g, ' ');
}
