import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BudgetStatusBadge } from '@/components/BudgetStatusBadge';
import { 
  FileText, 
  TrendingUp, 
  Euro,
  AlertCircle,
  ArrowRight,
  Plus,
  AlertTriangle
} from 'lucide-react';
import { DashboardDateFilter, DateRange } from '@/components/DashboardDateFilter';

interface Project {
  id: string;
  name: string;
  client_name?: string;
  status: string;
  project_status?: string;
  total_budget: number;
  end_date?: string;
}

interface ActionableBudget {
  id: string;
  name: string;
  client_name?: string;
  status: 'bozza' | 'in_attesa' | 'in_revisione' | 'approvato' | 'rifiutato';
  created_at: string;
}

interface StatusBreakdown {
  bozza: number;
  in_revisione: number;
  in_attesa: number;
  approvato: number;
  rifiutato: number;
}

interface AccountBudgetQuoteDashboardProps {
  stats: {
    myBudgets: number;
    pendingBudgets: number;
    myProjects: number;
    activeProjects: number;
    myQuotes: number;
    pendingQuotes: number;
    totalBudgetValue: number;
    projectsNearDeadline: number;
  };
  globalStats?: {
    totalBudgets: number;
    totalPendingBudgets: number;
    totalQuotes: number;
    totalPendingQuotes: number;
    totalBudgetValue: number;
  };
  statusBreakdown: StatusBreakdown;
  actionableBudgets: ActionableBudget[];
  recentProjects: Project[];
  dateRange?: DateRange;
  onDateRangeChange?: (range: DateRange) => void;
}

const STATUS_PIPELINE: { key: keyof StatusBreakdown; label: string; color: string; bgColor: string }[] = [
  { key: 'bozza', label: 'Bozza', color: 'hsl(var(--muted-foreground))', bgColor: 'hsl(var(--muted))' },
  { key: 'in_revisione', label: 'In Revisione', color: 'hsl(210 100% 50%)', bgColor: 'hsl(210 100% 95%)' },
  { key: 'in_attesa', label: 'In Attesa', color: 'hsl(45 93% 47%)', bgColor: 'hsl(45 93% 94%)' },
  { key: 'approvato', label: 'Approvato', color: 'hsl(142 71% 35%)', bgColor: 'hsl(142 71% 94%)' },
  { key: 'rifiutato', label: 'Rifiutato', color: 'hsl(var(--destructive))', bgColor: 'hsl(var(--destructive) / 0.1)' },
];

export const AccountBudgetQuoteDashboard = ({ 
  stats, 
  globalStats,
  statusBreakdown,
  actionableBudgets,
  recentProjects,
  dateRange,
  onDateRangeChange
}: AccountBudgetQuoteDashboardProps) => {
  const navigate = useNavigate();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(value);
  };

  const getProjectStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      'in_partenza': 'In Partenza',
      'aperto': 'Aperto',
      'da_fatturare': 'Da Fatturare',
      'completato': 'Completato'
    };
    return labels[status] || status;
  };

  const getProjectStatusVariant = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
      'in_partenza': 'secondary',
      'aperto': 'default',
      'da_fatturare': 'outline',
      'completato': 'secondary'
    };
    return variants[status] || 'default';
  };

  const totalPipeline = Object.values(statusBreakdown).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex items-center gap-3">
        <div className="h-8 w-1 rounded-full bg-primary" />
        <h2 className="text-xl font-semibold">Budget & Quote</h2>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => navigate('/budgets')} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Nuovo Budget
        </Button>
        <Button onClick={() => navigate('/quotes')} variant="secondary" size="sm">
          <Plus className="h-4 w-4 mr-1" /> Nuovo Preventivo
        </Button>
        <Button onClick={() => navigate('/budgets')} variant="outline" size="sm">
          Vedi tutti i Budget <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </div>

      {/* Global Stats Section */}
      {globalStats && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Statistiche Generali</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card variant="stats">
              <CardHeader variant="stats">
                <CardTitle className="text-sm font-medium">Budget Totali</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent variant="stats">
                <div className="text-2xl font-bold">{globalStats.totalBudgets}</div>
                <p className="text-xs text-muted-foreground">
                  {globalStats.totalPendingBudgets} in attesa
                </p>
              </CardContent>
            </Card>

            <Card variant="stats">
              <CardHeader variant="stats">
                <CardTitle className="text-sm font-medium">Preventivi Totali</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent variant="stats">
                <div className="text-2xl font-bold">{globalStats.totalQuotes}</div>
                <p className="text-xs text-muted-foreground">
                  {globalStats.totalPendingQuotes} in attesa
                </p>
              </CardContent>
            </Card>

            <Card variant="stats">
              <CardHeader variant="stats">
                <CardTitle className="text-sm font-medium">Valore Totale</CardTitle>
                <Euro className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent variant="stats">
                <div className="text-2xl font-bold">{formatCurrency(globalStats.totalBudgetValue)}</div>
                <p className="text-xs text-muted-foreground">
                  budget approvati
                </p>
              </CardContent>
            </Card>

            <Card variant="stats">
              <CardHeader variant="stats">
                <CardTitle className="text-sm font-medium">Quota Personale</CardTitle>
                <Euro className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent variant="stats">
                <div className="text-2xl font-bold text-primary">
                  {globalStats.totalBudgetValue > 0 
                    ? Math.round((stats.totalBudgetValue / globalStats.totalBudgetValue) * 100) 
                    : 0}%
                </div>
                <p className="text-xs text-muted-foreground">
                  del valore totale
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Personal Stats Section */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Le Mie Statistiche</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card variant="stats">
            <CardHeader variant="stats">
              <CardTitle className="text-sm font-medium">I Miei Budget</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent variant="stats">
              <div className="text-2xl font-bold">{stats.myBudgets}</div>
              <p className="text-xs text-muted-foreground">
                {stats.pendingBudgets} in attesa
              </p>
            </CardContent>
          </Card>

          <Card variant="stats">
            <CardHeader variant="stats">
              <CardTitle className="text-sm font-medium">I Miei Preventivi</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent variant="stats">
              <div className="text-2xl font-bold">{stats.myQuotes}</div>
              <p className="text-xs text-muted-foreground">
                {stats.pendingQuotes} in attesa
              </p>
            </CardContent>
          </Card>

          <Card variant="stats">
            <CardHeader variant="stats">
              <CardTitle className="text-sm font-medium">Valore Gestito</CardTitle>
              <Euro className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent variant="stats">
              <div className="text-2xl font-bold">{formatCurrency(stats.totalBudgetValue)}</div>
              <p className="text-xs text-muted-foreground">
                budget approvati
              </p>
            </CardContent>
          </Card>

          <Card variant="stats" className={stats.projectsNearDeadline > 0 ? 'border-destructive' : ''}>
            <CardHeader variant="stats">
              <CardTitle className="text-sm font-medium">In Scadenza</CardTitle>
              <AlertCircle className={`h-4 w-4 ${stats.projectsNearDeadline > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
            </CardHeader>
            <CardContent variant="stats">
              <div className={`text-2xl font-bold ${stats.projectsNearDeadline > 0 ? 'text-destructive' : ''}`}>
                {stats.projectsNearDeadline}
              </div>
              <p className="text-xs text-muted-foreground">
                nei prossimi 7 giorni
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Pipeline Stati Budget */}
      <Card>
        <CardHeader>
          <CardTitle>Pipeline Budget</CardTitle>
          <CardDescription>Distribuzione per stato dei tuoi budget</CardDescription>
        </CardHeader>
        <CardContent>
          {totalPipeline === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nessun budget nel periodo selezionato</p>
          ) : (
            <div className="space-y-4">
              {/* Segmented bar */}
              <div className="flex h-8 rounded-lg overflow-hidden">
                {STATUS_PIPELINE.map(({ key, color }) => {
                  const count = statusBreakdown[key];
                  if (count === 0) return null;
                  const pct = (count / totalPipeline) * 100;
                  return (
                    <div
                      key={key}
                      className="flex items-center justify-center text-xs font-semibold transition-all"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: color,
                        color: 'white',
                        minWidth: count > 0 ? '32px' : '0',
                      }}
                    >
                      {count}
                    </div>
                  );
                })}
              </div>
              {/* Legend */}
              <div className="flex flex-wrap gap-4">
                {STATUS_PIPELINE.map(({ key, label, color }) => (
                  <div key={key} className="flex items-center gap-2 text-sm">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
                    <span className="text-muted-foreground">{label}:</span>
                    <span className="font-medium">{statusBreakdown[key]}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Widget "Richiede la tua attenzione" */}
      {actionableBudgets.length > 0 && (
        <Card className="border-destructive/50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <CardTitle>Richiede la tua attenzione</CardTitle>
            </div>
            <CardDescription>Budget che necessitano di azione immediata</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {actionableBudgets.map((budget) => (
                <div
                  key={budget.id}
                  className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => navigate(`/projects/${budget.id}/budget`)}
                >
                  <div className="space-y-1">
                    <p className="font-medium">{budget.name}</p>
                    {budget.client_name && (
                      <p className="text-sm text-muted-foreground">{budget.client_name}</p>
                    )}
                  </div>
                  <BudgetStatusBadge status={budget.status} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Projects */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Ultimi Budget</CardTitle>
            <CardDescription>I tuoi ultimi budget creati</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/budgets')}>
            Vedi tutti <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          {recentProjects.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nessun budget recente</p>
          ) : (
            <div className="space-y-3">
              {recentProjects.slice(0, 5).map((project) => (
                <div 
                  key={project.id} 
                  className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => navigate(`/projects/${project.id}/canvas`)}
                >
                  <div className="space-y-1">
                    <p className="font-medium">{project.name}</p>
                    {project.client_name && (
                      <p className="text-sm text-muted-foreground">{project.client_name}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium">{formatCurrency(project.total_budget)}</span>
                    {project.project_status && (
                      <Badge variant={getProjectStatusVariant(project.project_status)}>
                        {getProjectStatusLabel(project.project_status)}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
