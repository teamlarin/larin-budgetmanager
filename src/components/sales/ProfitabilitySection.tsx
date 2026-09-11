import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpDown } from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ProjectMarginRow } from '@/hooks/useTeamLeaderProjectMargins';
import type { SalesProjectRow } from './types';

type SortKey = 'profit' | 'margin';
export function ProfitabilitySection({ projects, margins }: { projects: SalesProjectRow[]; margins: Map<string, ProjectMarginRow> }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'project' | 'client'>('project');
  const [sort, setSort] = useState<SortKey>('profit');
  const rows = useMemo(() => {
    const projectRows = projects.flatMap((project) => {
      const margin = margins.get(project.id); if (!margin) return [];
      const value = Number(margin.activitiesBudget ?? margin.budget); const profit = value - margin.totalCost;
      return [{ id: project.id, name: project.name, client: project.client_name, value, labor: margin.laborCost, external: margin.externalCost, profit, margin: margin.residualMargin }];
    });
    if (mode === 'project') return projectRows;
    const grouped = new Map<string, typeof projectRows[number]>();
    projectRows.forEach((row) => { const current = grouped.get(row.client); const next = current ?? { ...row, id: row.client, name: row.client, client: '', value: 0, labor: 0, external: 0, profit: 0, margin: null }; next.value += row.value; next.labor += row.labor; next.external += row.external; next.profit += row.profit; next.margin = next.value > 0 ? next.profit / next.value * 100 : null; grouped.set(row.client, next); });
    return [...grouped.values()];
  }, [projects, margins, mode]);
  const sorted = [...rows].sort((a, b) => sort === 'profit' ? b.profit - a.profit : Number(b.margin ?? -Infinity) - Number(a.margin ?? -Infinity));
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><Tabs value={mode} onValueChange={(value) => setMode(value as typeof mode)}><TabsList><TabsTrigger value="project">Per progetto</TabsTrigger><TabsTrigger value="client">Per cliente</TabsTrigger></TabsList></Tabs><Button variant="ghost" size="sm" onClick={() => setSort((value) => value === 'profit' ? 'margin' : 'profit')}><ArrowUpDown className="mr-2 h-4 w-4" />Ordina per {sort === 'profit' ? 'profitto' : 'margine'}</Button></div>
    <div className="overflow-x-auto rounded-md border"><Table><TableHeader><TableRow><TableHead>{mode === 'project' ? 'Progetto' : 'Cliente'}</TableHead>{mode === 'project' && <TableHead>Cliente</TableHead>}<TableHead className="text-right">Valore</TableHead><TableHead className="text-right">Ore interne</TableHead><TableHead className="text-right">Costi esterni</TableHead><TableHead className="text-right">Profitto</TableHead><TableHead className="text-right">Margine</TableHead></TableRow></TableHeader>
    <TableBody>{sorted.map((row) => <TableRow key={row.id} className={cn(mode === 'project' && 'cursor-pointer')} onClick={() => mode === 'project' && navigate(`/projects/${row.id}/canvas`)}><TableCell className="font-medium">{row.name}</TableCell>{mode === 'project' && <TableCell>{row.client}</TableCell>}<TableCell className="text-right">{formatCurrency(row.value)}</TableCell><TableCell className="text-right">{formatCurrency(row.labor)}</TableCell><TableCell className="text-right">{formatCurrency(row.external)}</TableCell><TableCell className={cn('text-right font-medium', row.profit < 0 && 'text-destructive')}>{formatCurrency(row.profit)}</TableCell><TableCell className={cn('text-right font-medium', Number(row.margin) < 0 && 'text-destructive')}>{row.margin == null ? '—' : `${row.margin.toFixed(1).replace('.', ',')}%`}</TableCell></TableRow>)}</TableBody></Table></div>
  </div>;
}