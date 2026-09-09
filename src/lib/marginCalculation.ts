import { calculateSafeHours } from '@/lib/timeUtils';

/**
 * Sorgente unica del calcolo del margine residuo.
 *
 * Regola condivisa da lista progetti, lista budget, scheda progetto e
 * dall'edge function calculate-project-margins:
 *  - budget di riferimento: manual_activities_budget, altrimenti somma delle
 *    attività non-prodotto;
 *  - costo del lavoro: ore registrate x tariffa valida ALLA DATA della
 *    registrazione (periodi contrattuali, fallback tariffa profilo) + overheads;
 *  - costi esterni: project_additional_costs;
 *  - margine residuo = (budget - lavoro - esterni) / budget * 100.
 */

export interface ContractRatePeriod {
  user_id: string;
  start_date: string;
  end_date: string | null;
  hourly_rate: number | string | null;
}

export interface TimeEntryForCosting {
  user_id: string | null;
  actual_start_time: string | null;
  actual_end_time: string | null;
}

export type RateResolver = (userId: string | null | undefined, date: string | Date) => number;

function toDateString(date: string | Date): string {
  if (date instanceof Date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(date).slice(0, 10);
}

/**
 * Crea la funzione che restituisce la tariffa oraria valida a una data.
 * `profileRates` è il fallback per chi non ha periodi contrattuali coprenti.
 */
export function buildRateResolver(
  periods: ContractRatePeriod[] | null | undefined,
  profileRates?: Map<string, number> | null,
): RateResolver {
  const byUser = new Map<string, ContractRatePeriod[]>();
  for (const p of periods || []) {
    if (p.hourly_rate == null) continue;
    const list = byUser.get(p.user_id) || [];
    list.push(p);
    byUser.set(p.user_id, list);
  }
  // Ordine decrescente per start_date: il primo match è il periodo più recente applicabile.
  for (const list of byUser.values()) {
    list.sort((a, b) => (a.start_date < b.start_date ? 1 : a.start_date > b.start_date ? -1 : 0));
  }

  return (userId, date) => {
    if (!userId) return 0;
    const dateStr = toDateString(date);
    const match = byUser.get(userId)?.find(
      (p) => p.start_date <= dateStr && (!p.end_date || p.end_date >= dateStr),
    );
    if (match?.hourly_rate != null) return Number(match.hourly_rate) || 0;
    return Number(profileRates?.get(userId) ?? 0) || 0;
  };
}

/** Costo del lavoro delle registrazioni confermate, con overheads per ora. */
export function computeLaborCost(
  entries: TimeEntryForCosting[] | null | undefined,
  resolveRate: RateResolver,
  overheads = 0,
): number {
  let total = 0;
  for (const e of entries || []) {
    if (!e.actual_start_time || !e.actual_end_time) continue;
    const hours = calculateSafeHours(e.actual_start_time, e.actual_end_time);
    total += hours * (resolveRate(e.user_id, e.actual_start_time) + overheads);
  }
  return total;
}

export interface ResidualMarginInput {
  activitiesBudget: number;
  laborCost: number;
  externalCost?: number;
  marginPercentage?: number;
}

export interface ResidualMarginResult {
  /** null quando non è calcolabile (nessun budget attività e nessun costo). */
  residualMargin: number | null;
  targetBudget: number;
  totalSpent: number;
  remainingToTarget: number;
}

export function computeResidualMargin({
  activitiesBudget,
  laborCost,
  externalCost = 0,
  marginPercentage = 0,
}: ResidualMarginInput): ResidualMarginResult {
  const budget = Number(activitiesBudget) || 0;
  const totalSpent = (Number(laborCost) || 0) + (Number(externalCost) || 0);
  const targetBudget = budget * (1 - (Number(marginPercentage) || 0) / 100);

  let residualMargin: number | null;
  if (budget > 0) {
    residualMargin = round2(((budget - totalSpent) / budget) * 100);
  } else if (totalSpent > 0) {
    residualMargin = -100;
  } else {
    residualMargin = null;
  }

  return {
    residualMargin,
    targetBudget: round2(targetBudget),
    totalSpent: round2(totalSpent),
    remainingToTarget: round2(targetBudget - totalSpent),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
