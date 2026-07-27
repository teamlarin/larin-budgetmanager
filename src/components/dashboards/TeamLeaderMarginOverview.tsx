import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle2, DollarSign, ArrowUpDown } from 'lucide-react';
import type { ProjectMarginRow, MarginStatus } from '@/hooks/useTeamLeaderProjectMargins';

interface LeaderProject {
  id: string;
  name: string;
  client_name?: string;
  project_status?: string;
  end_date?: string | null;
  end_date?: string | null;
}

// Higher = more urgent. Combines margin risk (magnitude of under-target) weighted
// by project budget and deadline urgency to surface "what matters most".
export function computeImpactScore(
  m: ProjectMarginRow,
  endDate?: string | null,
): number {
  const under = Math.max(0, -m.deltaVsTarget); // points below target
  const budgetWeight = Math.log10(Math.max(1000, m.budget || 1)); // 3..7
  let urgency = 1;
  if (endDate) {
    const days = Math.ceil((new Date(endDate).getTime() - Date.now()) / 86400000);
    if (days <= 7) urgency = 2.5;
    else if (days <= 14) urgency = 2;
    else if (days <= 30) urgency = 1.5;
    else if (days <= 90) urgency = 1.2;
  }
  const base = under * budgetWeight * urgency;
  return m.status === 'critical' ? base + 50 : base;

interface Props {
  projects: LeaderProject[];
  margins: Map<string, ProjectMarginRow>;
  isLoading?: boolean;
}

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v || 0);

const statusMeta: Record<
  MarginStatus,
  { label: string; badge: 'default' | 'secondary' | 'destructive' | 'outline'; className: string; Icon: typeof TrendingUp }
> = {
  profit: { label: 'In profitto', badge: 'default', className: 'text-emerald-700 dark:text-emerald-400', Icon: TrendingUp },
  warning: { label: 'Warning', badge: 'secondary', className: 'text-amber-700 dark:text-amber-400', Icon: TrendingDown },
  critical: { label: 'Critico', badge: 'destructive', className: 'text-destructive', Icon: AlertTriangle },
  unknown: { label: 'N/D', badge: 'outline', className: 'text-muted-foreground', Icon: Minus },
};

type SortKey = 'delta' | 'budget' | 'name';

export const TeamLeaderMarginOverview = ({ projects, margins, isLoading }: Props) => {
  const navigate = useNavigate();
  const [showAll, setShowAll] = useState(false);
  const [onlyCritical, setOnlyCritical] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('delta');

  const rows = useMemo(() => {
    return projects
      .map((p) => ({
        project: p,
        margin: margins.get(p.id),
      }))
      .filter((r) => !!r.margin) as Array<{ project: LeaderProject; margin: ProjectMarginRow }>;
  }, [projects, margins]);

  const counts = useMemo(() => {
    const c = { profit: 0, warning: 0, critical: 0, unknown: 0 };
    rows.forEach((r) => c[r.margin.status]++);
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    let list = rows;
    if (onlyCritical) list = list.filter((r) => r.margin.status === 'critical' || r.margin.status === 'warning');
    const sorted = [...list].sort((a, b) => {
      if (sortKey === 'name') return a.project.name.localeCompare(b.project.name);
      if (sortKey === 'budget') return (b.margin.budget || 0) - (a.margin.budget || 0);
      // 'delta' — worst first
      return a.margin.deltaVsTarget - b.margin.deltaVsTarget;
    });
    return sorted;
  }, [rows, onlyCritical, sortKey]);

  const visible = filtered.slice(0, 10);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Marginalità progetti
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[120px] flex items-center justify-center text-muted-foreground text-sm">
            Calcolo marginalità in corso…
          </div>
        </CardContent>
      </Card>
    );
  }

  if (rows.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Marginalità progetti
          </CardTitle>
          <CardDescription>Nessun progetto attivo con dati di marginalità</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const renderRow = (project: LeaderProject, m: ProjectMarginRow) => {
    const meta = statusMeta[m.status];
    const Icon = meta.Icon;
    return (
      <TableRow
        key={project.id}
        className="cursor-pointer hover:bg-muted/50"
        onClick={() => navigate(`/projects/${project.id}/canvas`)}
      >
        <TableCell>
          <div className="font-medium">{project.name}</div>
          {project.client_name && (
            <div className="text-xs text-muted-foreground">{project.client_name}</div>
          )}
        </TableCell>
        <TableCell className="text-right whitespace-nowrap">{formatCurrency(m.budget)}</TableCell>
        <TableCell className="text-right whitespace-nowrap">{formatCurrency(m.totalCost)}</TableCell>
        <TableCell className="text-right whitespace-nowrap text-muted-foreground">{m.targetMargin.toFixed(0)}%</TableCell>
        <TableCell className={`text-right whitespace-nowrap font-medium ${meta.className}`}>
          {m.residualMargin.toFixed(1)}%
        </TableCell>
        <TableCell className={`text-right whitespace-nowrap font-medium ${meta.className}`}>
          <span className="inline-flex items-center gap-1">
            <Icon className="h-3.5 w-3.5" />
            {m.deltaVsTarget > 0 ? '+' : ''}
            {m.deltaVsTarget.toFixed(1)}pt
          </span>
        </TableCell>
        <TableCell>
          <Badge variant={meta.badge}>{meta.label}</Badge>
        </TableCell>
      </TableRow>
    );
  };

  const table = (list: typeof filtered) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Progetto</TableHead>
          <TableHead className="text-right">Budget</TableHead>
          <TableHead className="text-right">Costi</TableHead>
          <TableHead className="text-right">Target</TableHead>
          <TableHead className="text-right">Residuo</TableHead>
          <TableHead className="text-right">Delta</TableHead>
          <TableHead>Stato</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>{list.map(({ project, margin }) => renderRow(project, margin))}</TableBody>
    </Table>
  );

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Marginalità progetti
              </CardTitle>
              <CardDescription>Confronto tra margine residuo e target sui progetti attivi</CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Switch id="only-critical" checked={onlyCritical} onCheckedChange={setOnlyCritical} />
                <Label htmlFor="only-critical" className="text-xs cursor-pointer">Solo critici/warning</Label>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setSortKey((k) => (k === 'delta' ? 'budget' : k === 'budget' ? 'name' : 'delta'))
                }
                title="Cambia ordinamento"
              >
                <ArrowUpDown className="h-3.5 w-3.5 mr-1" />
                {sortKey === 'delta' ? 'Delta' : sortKey === 'budget' ? 'Budget' : 'Nome'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                In profitto
              </div>
              <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{counts.profit}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <TrendingDown className="h-3.5 w-3.5 text-amber-600" />
                Warning
              </div>
              <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">{counts.warning}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                Critici
              </div>
              <div className="text-2xl font-bold text-destructive">{counts.critical}</div>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="h-[80px] flex items-center justify-center text-muted-foreground text-sm">
              Nessun progetto corrisponde al filtro
            </div>
          ) : (
            <>
              {table(visible)}
              {filtered.length > 10 && (
                <div className="flex justify-center pt-2">
                  <Button variant="outline" size="sm" onClick={() => setShowAll(true)}>
                    Vedi tutti ({filtered.length})
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={showAll} onOpenChange={setShowAll}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Marginalità progetti ({filtered.length})</DialogTitle>
          </DialogHeader>
          {table(filtered)}
        </DialogContent>
      </Dialog>
    </>
  );
};
