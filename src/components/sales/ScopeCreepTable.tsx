import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { averageScopeDeviation, scopeSeverity } from '@/lib/operationsMetrics';
import type { ScopeCreepRow } from './useOperationsData';

type SortKey = 'projectName' | 'clientName' | 'estimatedHours' | 'actualHours' | 'deviationHours' | 'deviationPct';
const PAGE_SIZE = 10;

const COLUMNS: { key: SortKey; label: string; numeric: boolean }[] = [
  { key: 'projectName', label: 'Progetto', numeric: false },
  { key: 'clientName', label: 'Cliente', numeric: false },
  { key: 'estimatedHours', label: 'Ore preventivate', numeric: true },
  { key: 'actualHours', label: 'Ore effettive', numeric: true },
  { key: 'deviationHours', label: 'Differenza', numeric: true },
  { key: 'deviationPct', label: 'Scostamento', numeric: true },
];

const SEVERITY_TEXT = {
  ok: '',
  warning: 'text-amber-600 dark:text-amber-400',
  critical: 'text-destructive',
} as const;

const hours = (value: number) => `${value.toFixed(1).replace('.', ',')} h`;

export function ScopeCreepTable({ rows }: { rows: ScopeCreepRow[] }) {
  const navigate = useNavigate();
  const [sort, setSort] = useState<SortKey>('deviationPct');
  const [dir, setDir] = useState<'asc' | 'desc'>('desc');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const average = useMemo(() => averageScopeDeviation(rows), [rows]);

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('it');
    if (!query) return rows;
    return rows.filter((row) => `${row.projectName} ${row.clientName}`.toLocaleLowerCase('it').includes(query));
  }, [rows, search]);

  const sorted = useMemo(() => {
    const factor = dir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sort === 'projectName' || sort === 'clientName') return factor * a[sort].localeCompare(b[sort], 'it');
      const av = sort === 'deviationPct' ? Number(a.deviationPct ?? -Infinity) : a[sort];
      const bv = sort === 'deviationPct' ? Number(b.deviationPct ?? -Infinity) : b[sort];
      return factor * (av - bv);
    });
  }, [filtered, sort, dir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const visible = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => setPage(1), [search, sort, dir]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

  const toggleSort = (key: SortKey) => {
    if (key === sort) { setDir((value) => (value === 'asc' ? 'desc' : 'asc')); return; }
    setSort(key);
    setDir(key === 'projectName' || key === 'clientName' ? 'asc' : 'desc');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Scostamento medio:{' '}
          <span className={cn('font-medium', SEVERITY_TEXT[scopeSeverity(average)])}>
            {average === null ? '—' : `${average > 0 ? '+' : ''}${average.toFixed(1).replace('.', ',')}%`}
          </span>
          {' · '}{rows.length} progetti
        </p>
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cerca progetto o cliente..." className="pl-9" />
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {COLUMNS.map((column) => {
                const active = sort === column.key;
                const Icon = active ? (dir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
                return (
                  <TableHead key={column.key} className={cn(column.numeric && 'text-right')}>
                    <button
                      type="button"
                      onClick={() => toggleSort(column.key)}
                      className={cn('inline-flex items-center gap-1 hover:text-foreground', active ? 'font-medium text-foreground' : 'text-muted-foreground')}
                    >
                      {column.label}<Icon className="h-3.5 w-3.5" />
                    </button>
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((row) => {
              const severity = scopeSeverity(row.deviationPct);
              return (
                <TableRow key={row.projectId} className="cursor-pointer" onClick={() => navigate(`/projects/${row.projectId}/canvas`)}>
                  <TableCell className="font-medium">{row.projectName}</TableCell>
                  <TableCell>{row.clientName}</TableCell>
                  <TableCell className="text-right">{hours(row.estimatedHours)}</TableCell>
                  <TableCell className="text-right">{hours(row.actualHours)}</TableCell>
                  <TableCell className="text-right">{row.deviationHours > 0 ? '+' : ''}{hours(row.deviationHours)}</TableCell>
                  <TableCell className={cn('text-right font-medium', SEVERITY_TEXT[severity])}>
                    {row.deviationPct === null ? '—' : `${row.deviationPct > 0 ? '+' : ''}${row.deviationPct.toFixed(1).replace('.', ',')}%`}
                  </TableCell>
                </TableRow>
              );
            })}
            {visible.length === 0 && (
              <TableRow><TableCell colSpan={COLUMNS.length} className="h-24 text-center text-muted-foreground">Nessun risultato trovato.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious href="#" onClick={(event) => { event.preventDefault(); setPage((current) => Math.max(1, current - 1)); }} className={cn(page === 1 && 'pointer-events-none opacity-50')} />
            </PaginationItem>
            <PaginationItem><span className="px-3 text-sm text-muted-foreground">Pagina {page} di {totalPages}</span></PaginationItem>
            <PaginationItem>
              <PaginationNext href="#" onClick={(event) => { event.preventDefault(); setPage((current) => Math.min(totalPages, current + 1)); }} className={cn(page === totalPages && 'pointer-events-none opacity-50')} />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}
