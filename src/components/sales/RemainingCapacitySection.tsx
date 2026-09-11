import { cn } from '@/lib/utils';
import { OVERLOAD_THRESHOLD_PCT } from '@/lib/capacity';
import type { UtilizationResult } from './useOperationsData';

const hours = (value: number) => `${value.toFixed(1).replace('.', ',')} h`;

export function RemainingCapacitySection({ data }: { data: UtilizationResult }) {
  const overloaded = data.saturationPct > OVERLOAD_THRESHOLD_PCT;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className={cn('text-5xl font-bold', overloaded ? 'text-destructive' : 'text-foreground')}>
            {hours(data.remainingHours)}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            ore ancora libere · saturazione {data.saturationPct.toFixed(1).replace('.', ',')}%
            {overloaded && ' · team in sovraccarico'}
          </p>
        </div>
        <dl className="grid grid-cols-3 gap-x-6 text-sm">
          <div><dt className="text-muted-foreground">Capacità netta</dt><dd className="font-medium">{hours(data.capacityNet)}</dd></div>
          <div><dt className="text-muted-foreground">Pianificate</dt><dd className="font-medium">{hours(data.plannedHours)}</dd></div>
          <div><dt className="text-muted-foreground">Giorni lavorativi</dt><dd className="font-medium">{data.businessDays}</dd></div>
        </dl>
      </div>

      <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full', overloaded ? 'bg-destructive' : 'bg-primary')}
          style={{ width: `${Math.min(100, data.saturationPct)}%` }}
        />
      </div>

      <div className="space-y-2">
        {data.byArea.map((area) => {
          const pct = area.capacityNet > 0 ? Math.min(100, (area.plannedHours / area.capacityNet) * 100) : 0;
          return (
            <div key={area.area} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="capitalize">{area.area}</span>
                <span className="text-muted-foreground">{hours(area.remainingHours)} libere · {Math.round(pct)}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className={cn('h-full rounded-full', pct > OVERLOAD_THRESHOLD_PCT ? 'bg-destructive' : 'bg-primary/70')} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
        {data.byArea.length === 0 && <p className="text-sm text-muted-foreground">Nessuna capacità disponibile nel periodo.</p>}
      </div>
    </div>
  );
}
