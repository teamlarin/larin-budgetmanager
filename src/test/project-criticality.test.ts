import { describe, it, expect } from 'vitest';
import {
  CRITICALITY_THRESHOLDS,
  classifyBudget,
  classifyDeadline,
  classifyMargin,
  classifyProjection,
  displayProgress,
  evaluateProjectCriticality,
  groupProjectsByCriticality,
  hasNoEconomics,
  isNearCompletion,
  projectedOverrunPct,
  plannedHoursUnreliable,
  type CriticalitySignals,
} from '@/lib/projectCriticality';

const TODAY = new Date('2026-06-15T00:00:00Z');

const margin = (over: Partial<Parameters<typeof evaluateProjectCriticality>[1]> = {}) => ({
  residualMargin: 40,
  totalCost: 1000,
  targetBudget: 10000,
  budget: 10000,
  confirmedHours: 10,
  totalHours: 100,
  ...over,
});

describe('ore previste non attendibili', () => {
  it('rileva pianificazione assente o troppo bassa', () => {
    expect(plannedHoursUnreliable(0, 114)).toBe(true);
    expect(plannedHoursUnreliable(null, 10)).toBe(true);
    expect(plannedHoursUnreliable(40, 114)).toBe(true);
    expect(plannedHoursUnreliable(101, 114)).toBe(false);
    expect(plannedHoursUnreliable(100, 10)).toBe(false);
  });

  it('non mostra la % budget e non manda a rischio solo per il budget', () => {
    const s = evaluateProjectCriticality(
      { id: 'p1', billing_type: 'one_shot', margin_percentage: 30, end_date: '2026-08-31' },
      margin({ confirmedHours: 114, totalHours: 40 }),
      TODAY,
    );
    expect(s.budget.unreliable).toBe(true);
    expect(s.budget.pct).toBeNull();
    expect(s.reasons).toContain('ore previste da completare');
    expect(s.group).not.toBe('at_risk');
  });

  it('mostra la % budget quando la pianificazione è coerente', () => {
    const s = evaluateProjectCriticality(
      { id: 'p1', billing_type: 'one_shot', margin_percentage: 30, end_date: '2026-08-31' },
      margin({ confirmedHours: 114, totalHours: 101 }),
      TODAY,
    );
    expect(s.budget.unreliable).toBe(false);
    expect(s.budget.pct).toBe(113);
  });
});

describe('soglie budget', () => {
  it('classifica per soglie 75/90', () => {
    expect(classifyBudget(70)).toBe('none');
    expect(classifyBudget(CRITICALITY_THRESHOLDS.budgetWarning)).toBe('warning');
    expect(classifyBudget(89)).toBe('warning');
    expect(classifyBudget(CRITICALITY_THRESHOLDS.budgetCritical)).toBe('critical');
    expect(classifyBudget(null)).toBe('none');
  });
});

describe('soglie deadline', () => {
  it('classifica per giorni residui', () => {
    expect(classifyDeadline(30)).toBe('none');
    expect(classifyDeadline(7)).toBe('warning');
    expect(classifyDeadline(3)).toBe('critical');
    expect(classifyDeadline(-2)).toBe('critical');
    expect(classifyDeadline(null)).toBe('none');
  });
});

describe('margine', () => {
  it('usa il delta vs obiettivo', () => {
    expect(classifyMargin(40, 30, 10000)).toBe('profit');
    expect(classifyMargin(23, 30, 10000)).toBe('warning');
    expect(classifyMargin(15, 30, 10000)).toBe('critical');
    expect(classifyMargin(-5, 30, 10000)).toBe('critical');
    expect(classifyMargin(40, 30, 0)).toBe('unknown');
  });
});

describe('proiezione', () => {
  it('rispetta le soglie personalizzate del progetto', () => {
    expect(classifyProjection(5)).toBe('none');
    expect(classifyProjection(15)).toBe('warning');
    expect(classifyProjection(30)).toBe('critical');
    expect(classifyProjection(15, 20, 40)).toBe('none');
  });

  it('calcola lo sforamento solo con progresso >= 10%', () => {
    expect(projectedOverrunPct({ totalCost: 6000, targetBudget: 10000 }, 50)).toBe(20);
    expect(projectedOverrunPct({ totalCost: 6000, targetBudget: 10000 }, 5)).toBeNull();
    expect(projectedOverrunPct({ totalCost: 6000, targetBudget: 0 }, 50)).toBeNull();
  });
});

describe('esclusioni economiche', () => {
  it('esclude interni, pre-sales e consuntivi', () => {
    expect(hasNoEconomics('interno')).toBe(true);
    expect(hasNoEconomics('pre_sales')).toBe(true);
    expect(hasNoEconomics('consumptive')).toBe(true);
    expect(hasNoEconomics(null, 'interno')).toBe(true);
    expect(hasNoEconomics('fixed', 'tech')).toBe(false);
  });

  it('non segnala budget/margine sui progetti interni', () => {
    const s = evaluateProjectCriticality(
      { id: 'p1', billing_type: 'interno', end_date: '2026-12-31' },
      margin({ confirmedHours: 99, residualMargin: -20 }),
      TODAY,
    );
    expect(s.budget.pct).toBeNull();
    expect(s.margin.level).toBe('none');
    expect(s.projection.level).toBe('none');
    expect(s.group).toBe('in_progress');
  });
});

describe('progresso visualizzato', () => {
  it('usa il progresso lineare sui ricorrenti', () => {
    const p = { billing_type: 'recurring', start_date: '2026-01-01', end_date: '2026-12-31', progress: 5 };
    expect(displayProgress(p, TODAY)).toBeGreaterThan(40);
    expect(displayProgress(p, TODAY)).toBeLessThan(50);
  });

  it('restituisce null sui progetti senza progresso significativo', () => {
    expect(displayProgress({ billing_type: 'interno', progress: 30 })).toBeNull();
  });

  it('rileva i progetti quasi completati', () => {
    expect(isNearCompletion({ billing_type: 'fixed', progress: 90 })).toBe(true);
    expect(isNearCompletion({ billing_type: 'fixed', progress: 60 })).toBe(false);
  });
});

describe('precedenza dei gruppi', () => {
  const evaluate = (p: any, m?: any) => evaluateProjectCriticality(p, m, TODAY);

  it('in_partenza vince su tutto', () => {
    const s = evaluate(
      { id: 'p', project_status: 'in_partenza', end_date: '2026-06-16', margin_percentage: 30 },
      margin({ confirmedHours: 95, residualMargin: 0 }),
    );
    expect(s.group).toBe('starting');
  });

  it('a rischio vince su in chiusura', () => {
    const s = evaluate(
      { id: 'p', project_status: 'aperto', end_date: '2026-06-20', margin_percentage: 30 },
      margin({ confirmedHours: 95 }),
    );
    expect(s.group).toBe('at_risk');
    expect(s.level).toBe('critical');
  });

  it('in chiusura entro 30 giorni', () => {
    const s = evaluate(
      { id: 'p', project_status: 'aperto', end_date: '2026-07-01', margin_percentage: 30 },
      margin(),
    );
    expect(s.group).toBe('closing');
  });

  it('in corso quando non ci sono segnali', () => {
    const s = evaluate(
      { id: 'p', project_status: 'aperto', end_date: '2026-12-01', margin_percentage: 30 },
      margin(),
    );
    expect(s.group).toBe('in_progress');
    expect(s.level).toBe('none');
  });
});

describe('raggruppamento', () => {
  it('ordina per gravità poi per deadline', () => {
    const projects = [
      { id: 'a', project_status: 'aperto', end_date: '2026-07-05' },
      { id: 'b', project_status: 'aperto', end_date: '2026-06-17' },
      { id: 'c', project_status: 'in_partenza', end_date: '2026-09-01' },
    ];
    const signals = new Map<string, CriticalitySignals>(
      projects.map((p) => [p.id, evaluateProjectCriticality(p, margin(), TODAY)]),
    );
    const groups = groupProjectsByCriticality(projects, signals);
    expect(groups.closing.map((p) => p.id)).toEqual(['b', 'a']);
    expect(groups.starting.map((p) => p.id)).toEqual(['c']);
    expect(groups.at_risk).toHaveLength(0);
  });
});
