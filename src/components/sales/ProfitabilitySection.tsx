import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { calculateProfit } from '@/lib/salesMetrics';
import { Input } from '@/components/ui/input';
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ProjectMarginRow } from '@/hooks/useTeamLeaderProjectMargins';
import type { SalesProjectRow } from './types';

type SortKey = 'name' | 'value' | 'labor' | 'external' | 'profit' | 'margin';
type SortDir = 'asc' | 'desc';
const PAGE_SIZE = 10;

const COLUMNS: { key: SortKey; label: string; numeric: boolean }[] = [
  { key: 'name', label: 'Cliente', numeric: false },
  { key: 'value', label: 'Budget attività', numeric: true },
  { key: 'labor', label: 'Ore interne', numeric: true },
  { key: 'external', label: 'Costi esterni', numeric: true },
  { key: 'profit', label: 'Profitto', numeric: true },
  { key: 'margin', label: 'Margine', numeric: true },
];

export function ProfitabilitySection({ projects, margins }: { projects: SalesProjectRow[]; margins: Map<string, ProjectMarginRow> }) {
  const [sort, setSort] = useState<SortKey>('profit');
  const [dir, setDir] = useState<SortDir>('desc');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const rows = useMemo(() => {
    const grouped = new Map<string, { id: string; name: string; value: number; labor: number; external: number; profit: number; margin: number | null }>();
    projects.forEach((project) => {
      const margin = margins.get(project.id); if (!margin) return;
      const value = Number(margin.activitiesBudget ?? margin.budget);
      const { profit } = calculateProfit({ value, labor: margin.laborCost, external: margin.externalCost });
      const current = grouped.get(project.client_name) ?? { id: project.client_name, name: project.client_name, value: 0, labor: 0, external: 0, profit: 0, margin: null };
      current.value += value; current.labor += margin.laborCost; current.external += margin.externalCost; current.profit += profit;
      current.margin = current.value > 0 ? current.profit / current.value * 100 : null;
      grouped.set(project.client_name, current);
    });
    return [...grouped.values()];
  }, [projects, margins]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('it');
    if (!query) return rows;
    return rows.filter((row) => row.name.toLocaleLowerCase('it').includes(query));
  }, [rows, search]);

  const sorted = useMemo(() => {
    const factor = dir === 'asc' ? 1 : -1;
    return [...filteredRows].sort((a, b) => {
      if (sort === 'name') return factor * a.name.localeCompare(b.name, 'it');
      const av = sort === 'margin' ? Number(a.margin ?? -Infinity) : a[sort];
      const bv = sort === 'margin' ? Number(b.margin ?? -Infinity) : b[sort];
      return factor * (av - bv);
    });
  }, [filteredRows, sort, dir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const visibleRows = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => setPage(1), [search, sort, dir]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

  const toggleSort = (key: SortKey) => {
    if (key === sort) { setDir((value) => value === 'asc' ? 'desc' : 'asc'); return; }
    setSort(key); setDir(key === 'name' ? 'asc' : 'desc');
  };

  return <div className="space-y-4">
    <div className="relative max-w-sm">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cerca cliente..." className="pl-9" />
    </div>
    <div className="overflow-x-auto rounded-md border"><Table><TableHeader><TableRow>{COLUMNS.map((column) => {
      const active = sort === column.key;
      const Icon = active ? (dir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
      return <TableHead key={column.key} className={cn(column.numeric && 'text-right')}>
        <button type="button" onClick={() => toggleSort(column.key)} className={cn('inline-flex items-center gap-1 hover:text-foreground', active ? 'text-foreground font-medium' : 'text-muted-foreground')}>
          {column.label}<Icon className="h-3.5 w-3.5" />
        </button>
      </TableHead>;
    })}</TableRow></TableHeader>
    <TableBody>{visibleRows.map((row) => <TableRow key={row.id}><TableCell className="font-medium">{row.name}</TableCell><TableCell className="text-right">{formatCurrency(row.value)}</TableCell><TableCell className="text-right">{formatCurrency(row.labor)}</TableCell><TableCell className="text-right">{formatCurrency(row.external)}</TableCell><TableCell className={cn('text-right font-medium', row.profit < 0 && 'text-destructive')}>{formatCurrency(row.profit)}</TableCell><TableCell className={cn('text-right font-medium', Number(row.margin) < 0 && 'text-destructive')}>{row.margin == null ? '—' : `${row.margin.toFixed(1).replace('.', ',')}%`}</TableCell></TableRow>)}{visibleRows.length === 0 && <TableRow><TableCell colSpan={COLUMNS.length} className="h-24 text-center text-muted-foreground">Nessun risultato trovato.</TableCell></TableRow>}</TableBody></Table></div>
    {totalPages > 1 && <Pagination><PaginationContent><PaginationItem><PaginationPrevious href="#" onClick={(event) => { event.preventDefault(); setPage((current) => Math.max(1, current - 1)); }} className={cn(page === 1 && 'pointer-events-none opacity-50')} /></PaginationItem><PaginationItem><span className="px-3 text-sm text-muted-foreground">Pagina {page} di {totalPages}</span></PaginationItem><PaginationItem><PaginationNext href="#" onClick={(event) => { event.preventDefault(); setPage((current) => Math.min(totalPages, current + 1)); }} className={cn(page === totalPages && 'pointer-events-none opacity-50')} /></PaginationItem></PaginationContent></Pagination>}
  </div>;
}
