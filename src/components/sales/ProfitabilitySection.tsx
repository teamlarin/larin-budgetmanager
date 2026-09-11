import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpDown, Search } from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { calculateProfit } from '@/lib/salesMetrics';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ProjectMarginRow } from '@/hooks/useTeamLeaderProjectMargins';
import type { SalesProjectRow } from './types';

type SortKey = 'profit' | 'margin';
const PAGE_SIZE = 10;

export function ProfitabilitySection({ projects, margins }: { projects: SalesProjectRow[]; margins: Map<string, ProjectMarginRow> }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'project' | 'client'>('project');
  const [sort, setSort] = useState<SortKey>('profit');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const rows = useMemo(() => {
    const projectRows = projects.flatMap((project) => {
      const margin = margins.get(project.id); if (!margin) return [];
      const value = Number(margin.activitiesBudget ?? margin.budget); const { profit } = calculateProfit({ value, labor: margin.laborCost, external: margin.externalCost });
      return [{ id: project.id, name: project.name, client: project.client_name, value, labor: margin.laborCost, external: margin.externalCost, profit, margin: margin.residualMargin }];
    });
    if (mode === 'project') return projectRows;
    const grouped = new Map<string, typeof projectRows[number]>();
    projectRows.forEach((row) => { const current = grouped.get(row.client); const next = current ?? { ...row, id: row.client, name: row.client, client: '', value: 0, labor: 0, external: 0, profit: 0, margin: null }; next.value += row.value; next.labor += row.labor; next.external += row.external; next.profit += row.profit; next.margin = next.value > 0 ? next.profit / next.value * 100 : null; grouped.set(row.client, next); });
    return [...grouped.values()];
  }, [projects, margins, mode]);
  const filteredRows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('it');
    if (!query) return rows;
    return rows.filter((row) => `${row.name} ${row.client}`.toLocaleLowerCase('it').includes(query));
  }, [rows, search]);
  const sorted = useMemo(
    () => [...filteredRows].sort((a, b) => sort === 'profit' ? b.profit - a.profit : Number(b.margin ?? -Infinity) - Number(a.margin ?? -Infinity)),
    [filteredRows, sort],
  );
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const visibleRows = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => setPage(1), [mode, search, sort]);
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><Tabs value={mode} onValueChange={(value) => setMode(value as typeof mode)}><TabsList><TabsTrigger value="project">Per progetto</TabsTrigger><TabsTrigger value="client">Per cliente</TabsTrigger></TabsList></Tabs><Button variant="ghost" size="sm" onClick={() => setSort((value) => value === 'profit' ? 'margin' : 'profit')}><ArrowUpDown className="mr-2 h-4 w-4" />Ordina per {sort === 'profit' ? 'profitto' : 'margine'}</Button></div>
    <div className="relative max-w-sm">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={mode === 'project' ? 'Cerca progetto o cliente...' : 'Cerca cliente...'} className="pl-9" />
    </div>
    <div className="overflow-x-auto rounded-md border"><Table><TableHeader><TableRow><TableHead>{mode === 'project' ? 'Progetto' : 'Cliente'}</TableHead>{mode === 'project' && <TableHead>Cliente</TableHead>}<TableHead className="text-right">Budget attività</TableHead><TableHead className="text-right">Ore interne</TableHead><TableHead className="text-right">Costi esterni</TableHead><TableHead className="text-right">Profitto</TableHead><TableHead className="text-right">Margine</TableHead></TableRow></TableHeader>
    <TableBody>{visibleRows.map((row) => <TableRow key={row.id} className={cn(mode === 'project' && 'cursor-pointer')} onClick={() => mode === 'project' && navigate(`/projects/${row.id}/canvas`)}><TableCell className="font-medium">{row.name}</TableCell>{mode === 'project' && <TableCell>{row.client}</TableCell>}<TableCell className="text-right">{formatCurrency(row.value)}</TableCell><TableCell className="text-right">{formatCurrency(row.labor)}</TableCell><TableCell className="text-right">{formatCurrency(row.external)}</TableCell><TableCell className={cn('text-right font-medium', row.profit < 0 && 'text-destructive')}>{formatCurrency(row.profit)}</TableCell><TableCell className={cn('text-right font-medium', Number(row.margin) < 0 && 'text-destructive')}>{row.margin == null ? '—' : `${row.margin.toFixed(1).replace('.', ',')}%`}</TableCell></TableRow>)}{visibleRows.length === 0 && <TableRow><TableCell colSpan={mode === 'project' ? 7 : 6} className="h-24 text-center text-muted-foreground">Nessun risultato trovato.</TableCell></TableRow>}</TableBody></Table></div>
    {totalPages > 1 && <Pagination><PaginationContent><PaginationItem><PaginationPrevious href="#" onClick={(event) => { event.preventDefault(); setPage((current) => Math.max(1, current - 1)); }} className={cn(page === 1 && 'pointer-events-none opacity-50')} /></PaginationItem><PaginationItem><span className="px-3 text-sm text-muted-foreground">Pagina {page} di {totalPages}</span></PaginationItem><PaginationItem><PaginationNext href="#" onClick={(event) => { event.preventDefault(); setPage((current) => Math.min(totalPages, current + 1)); }} className={cn(page === totalPages && 'pointer-events-none opacity-50')} /></PaginationItem></PaginationContent></Pagination>}
  </div>;
}