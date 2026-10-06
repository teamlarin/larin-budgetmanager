import { Fragment, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, ChevronRight, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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
const formatPct = (v: number | null) => v == null ? '—' : `${v.toFixed(1).replace('.', ',')}%`;

const COLUMNS: { key: SortKey; label: string; numeric: boolean }[] = [
  { key: 'name', label: 'Cliente', numeric: false },
  { key: 'value', label: 'Budget di competenza', numeric: true },
  { key: 'labor', label: 'Ore interne', numeric: true },
  { key: 'external', label: 'Costi esterni', numeric: true },
  { key: 'profit', label: 'Profitto', numeric: true },
  { key: 'margin', label: 'Margine', numeric: true },
];

/** Finestra di competenza: anno selezionato, troncato a oggi se in corso. */
export function getProfitabilityPeriod(year: number, today = new Date()) {
  const todayStr = format(today, 'yyyy-MM-dd');
  const yearEnd = `${year}-12-31`;
  return { start: `${year}-01-01`, end: todayStr < yearEnd ? todayStr : yearEnd };
}

const monthIndex = (d: string) => Number(d.slice(0, 4)) * 12 + Number(d.slice(5, 7)) - 1;
const monthsBetween = (a: string, b: string) => Math.max(0, monthIndex(b) - monthIndex(a) + 1);

type ProjectKind = 'completed' | 'recurring';
interface ProjectLine { id: string; name: string; kind: ProjectKind; months?: number; value: number; labor: number; external: number; profit: number; margin: number | null }
interface ClientRow { id: string; name: string; value: number; labor: number; external: number; profit: number; margin: number | null; projects: ProjectLine[] }

/**
 * Progetti completati nell'anno: valori a consuntivo interi.
 * Recurring aperti: budget attività ripartito per mese di contratto, contando solo
 * i mesi dell'anno fino a oggi; costi limitati allo stesso periodo.
 */
export function buildProfitabilityLines(projects: SalesProjectRow[], margins: Map<string, ProjectMarginRow>, year: number, today = new Date()) {
  const period = getProfitabilityPeriod(year, today);
  const lines: Array<ProjectLine & { client: string }> = [];
  for (const project of projects) {
    if (project.billing_type === 'interno') continue;
    const margin = margins.get(project.id); if (!margin) continue;
    const fullBudget = Number(margin.activitiesBudget ?? margin.budget) || 0;
    let line: ProjectLine | null = null;
    if (project.project_status === 'completato') {
      const closed = (project.actual_end_date || project.end_date || '').slice(0, 10);
      if (closed && (closed < period.start || closed > `${year}-12-31`)) continue;
      line = { id: project.id, name: project.name, kind: 'completed', value: fullBudget, labor: margin.laborCost, external: margin.externalCost, profit: 0, margin: null };
    } else if (project.billing_type === 'recurring' && project.project_status !== 'interrotto') {
      if (!project.start_date) continue;
      const pStart = project.start_date.slice(0, 10);
      const pEnd = project.end_date?.slice(0, 10) || null;
      const contractMonths = pEnd ? monthsBetween(pStart, pEnd) : 12;
      const from = pStart > period.start ? pStart : period.start;
      const to = pEnd && pEnd < period.end ? pEnd : period.end;
      const months = from <= to ? monthsBetween(from, to) : 0;
      if (months === 0 || contractMonths === 0) continue;
      const value = pEnd ? fullBudget * Math.min(months, contractMonths) / contractMonths : fullBudget / 12 * months;
      line = { id: project.id, name: project.name, kind: 'recurring', months, value, labor: margin.periodLaborCost ?? 0, external: margin.periodExternalCost ?? 0, profit: 0, margin: null };
    }
    if (!line) continue;
    const { profit, margin: pct } = calculateProfit({ value: line.value, labor: line.labor, external: line.external });
    lines.push({ ...line, profit, margin: pct, client: project.client_name });
  }
  return lines;
}

export function ProfitabilitySection({ year, projects, margins }: { year: number; projects: SalesProjectRow[]; margins: Map<string, ProjectMarginRow> }) {
  const [sort, setSort] = useState<SortKey>('profit');
  const [dir, setDir] = useState<SortDir>('desc');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const rows = useMemo(() => {
    const grouped = new Map<string, ClientRow>();
    for (const line of buildProfitabilityLines(projects, margins, year)) {
      const current = grouped.get(line.client) ?? { id: line.client, name: line.client, value: 0, labor: 0, external: 0, profit: 0, margin: null, projects: [] };
      current.value += line.value; current.labor += line.labor; current.external += line.external; current.profit += line.profit;
      current.margin = current.value > 0 ? current.profit / current.value * 100 : null;
      current.projects.push(line);
      grouped.set(line.client, current);
    }
    return [...grouped.values()];
  }, [projects, margins, year]);

  const totals = useMemo(() => {
    const t = rows.reduce((acc, r) => ({ value: acc.value + r.value, cost: acc.cost + r.labor + r.external, profit: acc.profit + r.profit }), { value: 0, cost: 0, profit: 0 });
    return { ...t, margin: t.value > 0 ? t.profit / t.value * 100 : null };
  }, [rows]);

  const toggleExpanded = (id: string) => setExpanded((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });

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
    <div className="grid gap-3 sm:grid-cols-4">
      {[['Budget di competenza', formatCurrency(totals.value)], ['Costi totali', formatCurrency(totals.cost)], ['Profitto', formatCurrency(totals.profit)], ['Margine ponderato', formatPct(totals.margin)]].map(([label, value]) =>
        <div key={label} className="rounded-md border bg-muted/30 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className={cn('text-lg font-semibold', label !== 'Budget di competenza' && label !== 'Costi totali' && totals.profit < 0 && 'text-destructive')}>{value}</p></div>)}
    </div>
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
    <TableBody>{visibleRows.map((row) => { const open = expanded.has(row.id); return <Fragment key={row.id}>
      <TableRow className="cursor-pointer" onClick={() => toggleExpanded(row.id)}>
        <TableCell className="font-medium"><span className="inline-flex items-center gap-1">{open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}{row.name}<span className="text-xs text-muted-foreground">({row.projects.length})</span></span></TableCell>
        <TableCell className="text-right">{formatCurrency(row.value)}</TableCell><TableCell className="text-right">{formatCurrency(row.labor)}</TableCell><TableCell className="text-right">{formatCurrency(row.external)}</TableCell>
        <TableCell className={cn('text-right font-medium', row.profit < 0 && 'text-destructive')}>{formatCurrency(row.profit)}</TableCell>
        <TableCell className={cn('text-right font-medium', Number(row.margin) < 0 && 'text-destructive')}>{formatPct(row.margin)}</TableCell>
      </TableRow>
      {open && row.projects.map((p) => <TableRow key={p.id} className="bg-muted/40 text-sm">
        <TableCell className="pl-10"><div className="flex flex-wrap items-center gap-2"><span>{p.name}</span><Badge variant="outline">{p.kind === 'completed' ? 'Completato' : `Recurring · ${p.months} ${p.months === 1 ? 'mese' : 'mesi'}`}</Badge></div></TableCell>
        <TableCell className="text-right">{formatCurrency(p.value)}</TableCell><TableCell className="text-right">{formatCurrency(p.labor)}</TableCell><TableCell className="text-right">{formatCurrency(p.external)}</TableCell>
        <TableCell className={cn('text-right', p.profit < 0 && 'text-destructive')}>{formatCurrency(p.profit)}</TableCell>
        <TableCell className={cn('text-right', Number(p.margin) < 0 && 'text-destructive')}>{formatPct(p.margin)}</TableCell>
      </TableRow>)}
    </Fragment>; })}{visibleRows.length === 0 && <TableRow><TableCell colSpan={COLUMNS.length} className="h-24 text-center text-muted-foreground">Nessun risultato trovato.</TableCell></TableRow>}</TableBody></Table></div>
    {totalPages > 1 && <Pagination><PaginationContent><PaginationItem><PaginationPrevious href="#" onClick={(event) => { event.preventDefault(); setPage((current) => Math.max(1, current - 1)); }} className={cn(page === 1 && 'pointer-events-none opacity-50')} /></PaginationItem><PaginationItem><span className="px-3 text-sm text-muted-foreground">Pagina {page} di {totalPages}</span></PaginationItem><PaginationItem><PaginationNext href="#" onClick={(event) => { event.preventDefault(); setPage((current) => Math.min(totalPages, current + 1)); }} className={cn(page === totalPages && 'pointer-events-none opacity-50')} /></PaginationItem></PaginationContent></Pagination>}
  </div>;
}
