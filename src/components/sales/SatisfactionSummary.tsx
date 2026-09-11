/** Indicatori sintetici della customer satisfaction con confronto per area. */
import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { npsSummary, satisfactionBreakdown } from '@/lib/operationsMetrics';
import type { SatisfactionRow } from './useOperationsData';

type GroupKey = 'area' | 'projectType' | 'discipline';

const GROUP_LABELS: Record<GroupKey, string> = {
  area: 'Area',
  projectType: 'Tipologia',
  discipline: 'Disciplina',
};

const score = (value: number | null) => (value === null ? '—' : value.toFixed(1).replace('.', ','));

export function SatisfactionSummary({ rows, isError }: { rows: SatisfactionRow[]; isError?: boolean }) {
  const [groupBy, setGroupBy] = useState<GroupKey>('area');
  const summary = useMemo(() => npsSummary(rows.map((row) => row.nps)), [rows]);
  const groups = useMemo(() => satisfactionBreakdown(rows, (row) => (row as SatisfactionRow)[groupBy]), [rows, groupBy]);

  if (isError) {
    return <p className="text-sm text-muted-foreground">Il foglio delle risposte non è raggiungibile in questo momento.</p>;
  }

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Nessuna risposta ancora raccolta per il periodo selezionato.</p>;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="text-5xl font-bold text-foreground">{summary.npsScore ?? '—'}</div>
          <p className="mt-1 text-sm text-muted-foreground">indice NPS</p>
        </div>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
          <div><dt className="text-muted-foreground">Risposte raccolte</dt><dd className="font-medium">{summary.responses}</dd></div>
          <div><dt className="text-muted-foreground">Punteggio medio</dt><dd className="font-medium">{score(summary.averageScore)}</dd></div>
        </dl>
        <div className="flex gap-2">
          <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400">{summary.promoters} promotori</Badge>
          <Badge variant="outline" className="border-amber-500/40 text-amber-600 dark:text-amber-400">{summary.passives} passivi</Badge>
          <Badge variant="outline" className="border-destructive/40 text-destructive">{summary.detractors} detrattori</Badge>
        </div>
      </div>

      <div className="space-y-3">
        <Tabs value={groupBy} onValueChange={(value) => setGroupBy(value as GroupKey)}>
          <TabsList>
            {(Object.keys(GROUP_LABELS) as GroupKey[]).map((key) => (
              <TabsTrigger key={key} value={key}>{GROUP_LABELS[key]}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{GROUP_LABELS[groupBy]}</TableHead>
                <TableHead className="text-right">Risposte</TableHead>
                <TableHead className="text-right">Punteggio medio</TableHead>
                <TableHead className="text-right">NPS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map((group) => (
                <TableRow key={group.key}>
                  <TableCell className="font-medium">{group.key}</TableCell>
                  <TableCell className="text-right">{group.responses}</TableCell>
                  <TableCell className="text-right">{score(group.averageScore)}</TableCell>
                  <TableCell className="text-right">{group.npsScore ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
