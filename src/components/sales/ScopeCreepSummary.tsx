/** Indicatori sintetici della deviazione del budget ore (dettaglio a parte). */
import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { scopeCreepSummary, scopeSeverity } from '@/lib/operationsMetrics';
import type { ScopeCreepRow } from './useOperationsData';

const SEVERITY_TEXT = {
  ok: 'text-emerald-600 dark:text-emerald-400',
  warning: 'text-amber-600 dark:text-amber-400',
  critical: 'text-destructive',
} as const;

const pct = (value: number | null) =>
  value === null ? '—' : `${value > 0 ? '+' : ''}${value.toFixed(1).replace('.', ',')}%`;

export function ScopeCreepSummary({ rows }: { rows: ScopeCreepRow[] }) {
  const summary = useMemo(() => scopeCreepSummary(rows), [rows]);

  return (
    <div className="flex flex-wrap items-end gap-8">
      <div>
        <div className={cn('text-5xl font-bold', SEVERITY_TEXT[scopeSeverity(summary.averagePct)])}>
          {pct(summary.averagePct)}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">scostamento medio su {summary.projects} progetti</p>
      </div>
      <dl className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-muted-foreground">Oltre il preventivo</dt>
          <dd className="font-medium">{summary.overBudget}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Critici (oltre +20%)</dt>
          <dd className={cn('font-medium', summary.critical > 0 && 'text-destructive')}>{summary.critical}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Ore in eccesso</dt>
          <dd className="font-medium">{summary.excessHours.toFixed(1).replace('.', ',')} h</dd>
        </div>
      </dl>
    </div>
  );
}
