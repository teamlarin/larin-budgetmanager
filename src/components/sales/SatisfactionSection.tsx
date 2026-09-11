import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { npsSummary } from '@/lib/operationsMetrics';
import type { SatisfactionRow } from './useOperationsData';

const scoreTone = (score: number | null) => {
  if (score === null) return '';
  if (score >= 9) return 'text-emerald-600 dark:text-emerald-400';
  if (score >= 7) return 'text-amber-600 dark:text-amber-400';
  return 'text-destructive';
};

export function SatisfactionSection({ rows, isError }: { rows: SatisfactionRow[]; isError?: boolean }) {
  const navigate = useNavigate();
  const summary = useMemo(() => npsSummary(rows.map((row) => row.nps)), [rows]);

  if (isError) {
    return <p className="text-sm text-muted-foreground">Il foglio delle risposte non è raggiungibile in questo momento.</p>;
  }

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Nessuna risposta ancora raccolta per il periodo selezionato.</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {summary.responses} risposte · voto medio {summary.averageScore === null ? '—' : summary.averageScore.toFixed(1).replace('.', ',')}
      </p>


      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Progetto</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead className="text-right">NPS</TableHead>
              <TableHead>Cosa migliorare</TableHead>
              <TableHead>Aspetti apprezzati</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, index) => (
              <TableRow
                key={`${row.projectName}-${index}`}
                className={cn(row.projectId && 'cursor-pointer')}
                onClick={() => row.projectId && navigate(`/projects/${row.projectId}/canvas`)}
              >
                <TableCell className="font-medium">
                  {row.projectName || '—'}
                  {!row.projectId && <span className="ml-2 text-xs text-muted-foreground">(progetto non collegato)</span>}
                </TableCell>
                <TableCell>{row.clientName || '—'}</TableCell>
                <TableCell className={cn('text-right font-medium', scoreTone(row.nps))}>{row.nps ?? '—'}</TableCell>
                <TableCell className="max-w-xs whitespace-pre-wrap text-sm text-muted-foreground">{row.improvements || '—'}</TableCell>
                <TableCell className="max-w-xs whitespace-pre-wrap text-sm text-muted-foreground">{row.appreciated || '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
