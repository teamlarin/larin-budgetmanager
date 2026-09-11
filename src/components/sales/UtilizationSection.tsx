import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { utilizationStatus, type UtilizationStatus } from '@/lib/operationsMetrics';
import type { UtilizationResult } from './useOperationsData';

const STATUS_TEXT: Record<UtilizationStatus, string> = {
  low: 'text-amber-600 dark:text-amber-400',
  optimal: 'text-emerald-600 dark:text-emerald-400',
  high: 'text-amber-600 dark:text-amber-400',
  critical: 'text-destructive',
};

const STATUS_BAR: Record<UtilizationStatus, string> = {
  low: 'bg-amber-500',
  optimal: 'bg-emerald-500',
  high: 'bg-amber-500',
  critical: 'bg-destructive',
};

const STATUS_LABEL: Record<UtilizationStatus, string> = {
  low: 'sotto la fascia ottimale',
  optimal: 'nella fascia ottimale',
  high: 'sopra la fascia ottimale',
  critical: 'sovraccarico',
};

const hours = (value: number) => `${value.toFixed(1).replace('.', ',')} h`;

export function UtilizationSection({ data }: { data: UtilizationResult }) {
  const [expanded, setExpanded] = useState(false);
  const status = utilizationStatus(data.utilizationPct);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className={cn('text-5xl font-bold', STATUS_TEXT[status])}>
            {data.utilizationPct.toFixed(1).replace('.', ',')}%
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {STATUS_LABEL[status]} · riferimento 70-80%
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
          <div><dt className="text-muted-foreground">Ore fatturabili</dt><dd className="font-medium">{hours(data.billableHours)}</dd></div>
          <div><dt className="text-muted-foreground">Ore non fatturabili</dt><dd className="font-medium">{hours(data.nonBillableHours)}</dd></div>
          <div><dt className="text-muted-foreground">Assenze</dt><dd className="font-medium">{hours(data.absenceHours)}</dd></div>
          <div><dt className="text-muted-foreground">Capacità netta</dt><dd className="font-medium">{hours(data.capacityNet)}</dd></div>
        </dl>
      </div>

      <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
        <div className={cn('h-full rounded-full', STATUS_BAR[status])} style={{ width: `${Math.min(100, data.utilizationPct)}%` }} />
      </div>

      <Button variant="ghost" size="sm" onClick={() => setExpanded((value) => !value)}>
        {expanded ? <ChevronDown className="mr-2 h-4 w-4" /> : <ChevronRight className="mr-2 h-4 w-4" />}
        Dettaglio per persona
      </Button>

      {expanded && (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Persona</TableHead>
                <TableHead className="text-right">Fatturabili</TableHead>
                <TableHead className="text-right">Non fatturabili</TableHead>
                <TableHead className="text-right">Assenze</TableHead>
                <TableHead className="text-right">Capacità netta</TableHead>
                <TableHead className="text-right">Utilizzo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.members.map((member) => {
                const memberStatus = utilizationStatus(member.utilizationPct);
                return (
                  <TableRow key={member.userId}>
                    <TableCell className="font-medium">{member.fullName}</TableCell>
                    <TableCell className="text-right">{hours(member.billableHours)}</TableCell>
                    <TableCell className="text-right">{hours(member.nonBillableHours)}</TableCell>
                    <TableCell className="text-right">{hours(member.absenceHours)}</TableCell>
                    <TableCell className="text-right">{hours(member.capacityNet)}</TableCell>
                    <TableCell className={cn('text-right font-medium', STATUS_TEXT[memberStatus])}>
                      {member.utilizationPct.toFixed(1).replace('.', ',')}%
                    </TableCell>
                  </TableRow>
                );
              })}
              {data.members.length === 0 && (
                <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">Nessun dato nel periodo.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
