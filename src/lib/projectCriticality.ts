import { differenceInCalendarDays } from 'date-fns';

/**
 * Sorgente unica di criticità dei progetti (logica pura, senza React).
 *
 * Prima di questo modulo la stessa domanda ("questo progetto è a rischio?")
 * riceveva tre risposte diverse: la pagina Progetti Approvati, la dashboard
 * del team leader e il focus score personale. Tutte le viste devono usare
 * queste funzioni.
 */

export type Severity = 'none' | 'warning' | 'critical';

export const CRITICALITY_THRESHOLDS = {
  /** % ore confermate su ore previste */
  budgetWarning: 75,
  budgetCritical: 90,
  /** soglia di ingresso nel gruppo "A rischio" */
  budgetAtRisk: 85,
  /** giorni alla deadline */
  deadlineCritical: 3,
  deadlineWarning: 7,
  /** finestra del gruppo "In chiusura" */
  closingDays: 30,
  /** delta punti margine residuo vs margine obiettivo */
  marginWarningDelta: -5,
  marginCriticalDelta: -10,
  /** % di sforamento proiettato vs budget target (fallback se il progetto non ha soglie proprie) */
  projectionWarningPct: 10,
  projectionCriticalPct: 25,
  /** progresso oltre il quale un progetto è "in chiusura" per avanzamento */
  nearCompletionProgress: 85,
} as const;

const maxSeverity = (...levels: Severity[]): Severity =>
  levels.includes('critical') ? 'critical' : levels.includes('warning') ? 'warning' : 'none';

/** Dati economici calcolati dalla edge function calculate-project-margins. */
export interface MarginSnapshot {
  residualMargin: number;
  totalCost: number;
  targetBudget: number;
  budget: number;
  confirmedHours: number;
  totalHours: number;
  targetMargin?: number;
}

/** Tipi di progetto senza budget economico: nessuna criticità su budget/margine/proiezione. */
export const hasNoEconomics = (billingType?: string | null, area?: string | null): boolean => {
  const bt = (billingType || '').toLowerCase();
  const ar = (area || '').toLowerCase();
  return ar === 'interno' || bt === 'interno' || bt === 'pre_sales' || bt === 'consumptive';
};

export const classifyBudget = (pct: number | null | undefined): Severity => {
  if (pct == null) return 'none';
  if (pct >= CRITICALITY_THRESHOLDS.budgetCritical) return 'critical';
  if (pct >= CRITICALITY_THRESHOLDS.budgetWarning) return 'warning';
  return 'none';
};

export const classifyDeadline = (daysToEnd: number | null | undefined): Severity => {
  if (daysToEnd == null) return 'none';
  if (daysToEnd <= CRITICALITY_THRESHOLDS.deadlineCritical) return 'critical';
  if (daysToEnd <= CRITICALITY_THRESHOLDS.deadlineWarning) return 'warning';
  return 'none';
};

export type MarginStatus = 'profit' | 'warning' | 'critical' | 'unknown';

/**
 * Salute del margine: `critical` se il margine residuo è negativo o è più di 10
 * punti sotto l'obiettivo, `warning` tra -10 e -5 punti, `unknown` senza budget.
 */
export function classifyMargin(
  residualMargin: number,
  targetMargin: number,
  budget: number,
): MarginStatus {
  if (!budget || budget <= 0) return 'unknown';
  const delta = residualMargin - targetMargin;
  if (residualMargin < 0 || delta < CRITICALITY_THRESHOLDS.marginCriticalDelta) return 'critical';
  if (delta < CRITICALITY_THRESHOLDS.marginWarningDelta) return 'warning';
  return 'profit';
}

export const classifyProjection = (
  overrunPct: number | null | undefined,
  warningPct?: number | null,
  criticalPct?: number | null,
): Severity => {
  if (overrunPct == null) return 'none';
  const crit = criticalPct ?? CRITICALITY_THRESHOLDS.projectionCriticalPct;
  const warn = warningPct ?? CRITICALITY_THRESHOLDS.projectionWarningPct;
  if (overrunPct > crit) return 'critical';
  if (overrunPct > warn) return 'warning';
  return 'none';
};

/** Progresso "visualizzato": lineare sul tempo per i ricorrenti, altrimenti il campo progress. */
export function displayProgress(
  p: {
    billing_type?: string | null;
    start_date?: string | null;
    end_date?: string | null;
    progress?: number | null;
  },
  today: Date = new Date(),
): number | null {
  const bt = (p.billing_type || '').toLowerCase();
  if (bt === 'interno' || bt === 'consumptive') return null;
  if (bt === 'recurring' && p.start_date && p.end_date) {
    const start = new Date(p.start_date).getTime();
    const end = new Date(p.end_date).getTime();
    const totalDays = Math.max(1, Math.ceil((end - start) / 86400000));
    const elapsed = Math.ceil((today.getTime() - start) / 86400000);
    return Math.min(100, Math.max(0, Math.round((elapsed / totalDays) * 100)));
  }
  return p.progress ?? null;
}

export const isNearCompletion = (
  p: Parameters<typeof displayProgress>[0],
  today: Date = new Date(),
): boolean => {
  const dp = displayProgress(p, today);
  return dp != null && dp >= CRITICALITY_THRESHOLDS.nearCompletionProgress;
};

export type ProjectGroup = 'at_risk' | 'closing' | 'in_progress' | 'starting';

export interface CriticalityProject {
  id: string;
  name?: string;
  area?: string | null;
  billing_type?: string | null;
  project_status?: string | null;
  project_type?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  progress?: number | null;
  total_budget?: number | null;
  margin_percentage?: number | null;
  projection_warning_threshold?: number | null;
  projection_critical_threshold?: number | null;
}

export interface CriticalitySignals {
  level: Severity;
  reasons: string[];
  group: ProjectGroup;
  budget: { level: Severity; pct: number | null };
  margin: { level: Severity; residual: number | null; delta: number | null };
  deadline: { level: Severity; daysToEnd: number | null };
  projection: { level: Severity; overrunPct: number | null };
  hoursRemaining: number | null;
  totalHours: number | null;
  progress: number | null;
  economicsExcluded: boolean;
}

/** % di sforamento proiettato del costo a fine progetto rispetto al budget target. */
export function projectedOverrunPct(
  margin: Pick<MarginSnapshot, 'totalCost' | 'targetBudget'> | undefined,
  progress: number | null,
): number | null {
  if (!margin || !margin.targetBudget || margin.targetBudget <= 0) return null;
  if (progress == null || progress < 10) return null;
  const projectedCost = margin.totalCost / (progress / 100);
  return Math.round(((projectedCost - margin.targetBudget) / margin.targetBudget) * 100);
}

export function evaluateProjectCriticality(
  project: CriticalityProject,
  margin?: MarginSnapshot,
  today: Date = new Date(),
): CriticalitySignals {
  const economicsExcluded = hasNoEconomics(project.billing_type, project.area);
  const progress = displayProgress(project, today);

  const daysToEnd = project.end_date
    ? differenceInCalendarDays(new Date(project.end_date), today)
    : null;
  const deadlineLevel = classifyDeadline(daysToEnd);

  const totalHours = margin?.totalHours ?? null;
  const confirmedHours = margin?.confirmedHours ?? null;
  const budgetPct =
    !economicsExcluded && totalHours && totalHours > 0 && confirmedHours != null
      ? Math.round((confirmedHours / totalHours) * 100)
      : null;
  const budgetLevel = classifyBudget(budgetPct);

  const targetMargin = Number(project.margin_percentage ?? margin?.targetMargin ?? 0);
  const residual = !economicsExcluded && margin ? margin.residualMargin : null;
  const marginDelta = residual != null ? Math.round((residual - targetMargin) * 10) / 10 : null;
  const marginClass: MarginStatus =
    residual != null && margin ? classifyMargin(residual, targetMargin, margin.budget) : 'unknown';
  const marginLevel: Severity =
    marginClass === 'critical' ? 'critical' : marginClass === 'warning' ? 'warning' : 'none';

  const overrunPct = economicsExcluded ? null : projectedOverrunPct(margin, progress);
  const projectionLevel = classifyProjection(
    overrunPct,
    project.projection_warning_threshold,
    project.projection_critical_threshold,
  );

  const reasons: string[] = [];
  if (daysToEnd != null) {
    if (daysToEnd < 0) reasons.push(`scaduto da ${Math.abs(daysToEnd)}gg`);
    else if (daysToEnd === 0) reasons.push('scade oggi');
    else if (deadlineLevel !== 'none') reasons.push(`scade in ${daysToEnd}gg`);
  }
  if (budgetPct != null && budgetLevel !== 'none') reasons.push(`budget ${Math.round(budgetPct)}%`);
  if (marginLevel !== 'none' && marginDelta != null) {
    reasons.push(marginDelta < 0 ? `margine ${marginDelta} pt` : 'margine sotto obiettivo');
  }
  if (projectionLevel !== 'none' && overrunPct != null) {
    reasons.push(`proiezione +${overrunPct}%`);
  }

  const level = maxSeverity(deadlineLevel, budgetLevel, marginLevel, projectionLevel);

  const atRisk =
    (budgetPct != null && budgetPct >= CRITICALITY_THRESHOLDS.budgetAtRisk) ||
    marginLevel !== 'none' ||
    projectionLevel !== 'none';

  let group: ProjectGroup;
  if (project.project_status === 'in_partenza') {
    group = 'starting';
  } else if (atRisk) {
    group = 'at_risk';
  } else if (daysToEnd != null && daysToEnd <= CRITICALITY_THRESHOLDS.closingDays) {
    group = 'closing';
  } else {
    group = 'in_progress';
  }

  return {
    level,
    reasons,
    group,
    budget: { level: budgetLevel, pct: budgetPct },
    margin: { level: marginLevel, residual, delta: marginDelta },
    deadline: { level: deadlineLevel, daysToEnd },
    projection: { level: projectionLevel, overrunPct },
    hoursRemaining:
      totalHours != null && confirmedHours != null
        ? Math.round((totalHours - confirmedHours) * 10) / 10
        : null,
    totalHours,
    progress,
    economicsExcluded,
  };
}

const GROUP_ORDER: ProjectGroup[] = ['at_risk', 'closing', 'in_progress', 'starting'];

const severityRank: Record<Severity, number> = { critical: 2, warning: 1, none: 0 };

/** Raggruppa i progetti nei quattro gruppi, ordinati per urgenza dentro ogni gruppo. */
export function groupProjectsByCriticality<T extends CriticalityProject>(
  projects: T[],
  signalsById: Map<string, CriticalitySignals>,
): Record<ProjectGroup, T[]> {
  const out = {
    at_risk: [] as T[],
    closing: [] as T[],
    in_progress: [] as T[],
    starting: [] as T[],
  } as Record<ProjectGroup, T[]>;
  for (const p of projects) {
    const s = signalsById.get(p.id);
    out[s?.group ?? 'in_progress'].push(p);
  }
  for (const g of GROUP_ORDER) {
    out[g].sort((a, b) => {
      const sa = signalsById.get(a.id);
      const sb = signalsById.get(b.id);
      const rank = severityRank[sb?.level ?? 'none'] - severityRank[sa?.level ?? 'none'];
      if (rank !== 0) return rank;
      const da = sa?.deadline.daysToEnd ?? Number.MAX_SAFE_INTEGER;
      const db = sb?.deadline.daysToEnd ?? Number.MAX_SAFE_INTEGER;
      return da - db;
    });
  }
  return out;
}

export const GROUP_LABELS: Record<ProjectGroup, string> = {
  at_risk: 'A rischio',
  closing: 'In chiusura',
  in_progress: 'In corso',
  starting: 'In partenza',
};
