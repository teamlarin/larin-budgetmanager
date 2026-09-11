import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { delayDays, onTimeDeliverySummary } from '@/lib/operationsMetrics';
import type { DeliveryRow } from './useOperationsData';

const formatDay = (value: string | null) =>
  value ? format(new Date(value), 'd MMM yyyy', { locale: it }) : '—';

export function OnTimeDeliverySection({ rows }: { rows: DeliveryRow[] }) {
  const summary = useMemo(
    () => onTimeDeliverySummary(rows.map((row) => ({ dueDate: row.dueDate, completedAt: row.completedAt }))),
    [rows],
  );

  const late = useMemo(
    () =>
      rows
        .map((row) => ({ ...row, delay: delayDays(row.dueDate, row.completedAt) }))
        .filter((row) => row.delay > 0)
        .sort((a, b) => b.delay - a.delay),
    [rows],
  );

  const navigate = useNavigate();
  const rate = summary.ratePct;
  const tone = rate === null ? '' : rate >= 85 ? 'text-emerald-600 dark:text-emerald-400' : rate >= 70 ? 'text-amber-600 dark:text-amber-400' : 'text-destructive';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className={cn('text-5xl font-bold', tone)}>{rate === null ? '—' : `${rate.toFixed(1).replace('.', ',')}%`}</div>
          <p className="mt-1 text-sm text-muted-foreground">
            {summary.onTime} in tempo su {summary.measured} progetti completati
          </p>
        </div>
        <dl className="grid grid-cols-3 gap-x-6 text-sm">
          <div><dt className="text-muted-foreground">In tempo</dt><dd className="font-medium">{summary.onTime}</dd></div>
          <div><dt className="text-muted-foreground">In ritardo</dt><dd className="font-medium">{summary.late}</dd></div>
          <div><dt className="text-muted-foreground">Senza data di fine</dt><dd className="font-medium">{summary.withoutDueDate}</dd></div>
        </dl>
      </div>

      {late.length > 0 && (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Progetto</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Fine prevista</TableHead>
                <TableHead>Completato il</TableHead>
                <TableHead className="text-right">Ritardo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {late.map((row) => (
                <TableRow key={row.projectId} className="cursor-pointer" onClick={() => navigate(`/projects/${row.projectId}/canvas`)}>
                  <TableCell className="font-medium">{row.projectName}</TableCell>
                  <TableCell>{row.clientName}</TableCell>
                  <TableCell>{formatDay(row.dueDate)}</TableCell>
                  <TableCell>{formatDay(row.completedAt)}</TableCell>
                  <TableCell className="text-right font-medium text-destructive">{row.delay} g</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {rows.length === 0 && <p className="text-sm text-muted-foreground">Nessun progetto completato nel periodo.</p>}
    </div>
  );
}
