import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BudgetStatusBadge } from '@/components/BudgetStatusBadge';
import { 
  FileText, 
  TrendingUp, 
  Euro,
  Percent,
  ArrowRight,
  AlertTriangle
} from 'lucide-react';
import { DashboardDateFilter, DateRange } from '@/components/DashboardDateFilter';
import { KinstaSitesWidget } from './KinstaSitesWidget';

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

interface AdminFinanceDashboardProps {
  stats: {
    totalBudgets: number;
    pendingBudgets: number;
    totalQuotes: number;
    pendingQuotes: number;
    totalBudgetValue: number;
    approvedValue: number;
    allBudgetsValue: number;
    conversionRate: number;
    avgApprovedValue: number;
  };
  statusBreakdown?: StatusBreakdown;
  actionableBudgets?: ActionableBudget[];
  dateRange?: DateRange;
  onDateRangeChange?: (range: DateRange) => void;
}

const STATUS_PIPELINE: { key: keyof StatusBreakdown; label: string; color: string }[] = [
  { key: 'bozza', label: 'Bozza', color: 'hsl(var(--muted-foreground))' },
  { key: 'in_revisione', label: 'In Revisione', color: 'hsl(210 100% 50%)' },
  { key: 'in_attesa', label: 'In Attesa', color: 'hsl(45 93% 47%)' },
  { key: 'approvato', label: 'Approvato', color: 'hsl(142 71% 35%)' },
  { key: 'rifiutato', label: 'Rifiutato', color: 'hsl(var(--destructive))' },
];

export const AdminFinanceDashboard = ({
  stats,
  statusBreakdown = { bozza: 0, in_revisione: 0, in_attesa: 0, approvato: 0, rifiutato: 0 },
  actionableBudgets = [],
  dateRange,
  onDateRangeChange
}: AdminFinanceDashboardProps) => {
  const navigate = useNavigate();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR'
    }).format(value);
  };

  const totalPipeline = Object.values(statusBreakdown).reduce((a, b) => a + b, 0);

  return (
    <section className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-1 rounded-full" style={{ backgroundColor: 'hsl(var(--secondary))' }} />
          <h2 className="text-xl font-semibold">Area Finance</h2>
        </div>
        {dateRange && onDateRangeChange && (
          <DashboardDateFilter dateRange={dateRange} onDateRangeChange={onDateRangeChange} />
        )}
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => navigate('/budgets')} variant="outline" size="sm">
          Vedi tutti i Budget <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
        <Button onClick={() => navigate('/quotes')} variant="outline" size="sm">
          Vedi Preventivi <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </div>

      {/* Finance Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card variant="stats">
          <CardHeader variant="stats">
            <CardTitle className="text-sm font-medium">Budget totali</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent variant="stats">
            <div className="text-2xl font-bold">{stats.totalBudgets}</div>
            <p className="text-xs text-muted-foreground">
              {stats.pendingBudgets} in attesa di approvazione
            </p>
          </CardContent>
        </Card>

        <Card variant="stats">
          <CardHeader variant="stats">
            <CardTitle className="text-sm font-medium">Preventivi</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent variant="stats">
            <div className="text-2xl font-bold">{stats.totalQuotes}</div>
            <p className="text-xs text-muted-foreground">
              {stats.pendingQuotes} in attesa
            </p>
          </CardContent>
        </Card>

        <Card variant="stats">
          <CardHeader variant="stats">
            <CardTitle className="text-sm font-medium">Valore approvato</CardTitle>
            <Euro className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent variant="stats">
            <div className="text-2xl font-bold">{formatCurrency(stats.approvedValue)}</div>
            <p className="text-xs text-muted-foreground">
              su {formatCurrency(stats.allBudgetsValue)} totale
            </p>
          </CardContent>
        </Card>

        <Card variant="stats">
          <CardHeader variant="stats">
            <CardTitle className="text-sm font-medium">Tasso conversione</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent variant="stats">
            <div className="text-2xl font-bold">{stats.conversionRate}%</div>
            <p className="text-xs text-muted-foreground">
              media {formatCurrency(stats.avgApprovedValue)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Pipeline Stati Budget */}
      <Card>
        <CardHeader>
          <CardTitle>Pipeline Budget</CardTitle>
          <CardDescription>Distribuzione di tutti i budget per stato</CardDescription>
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

      {/* Widget "Budget da approvare" */}
      {actionableBudgets.length > 0 && (
        <Card className="border-destructive/50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <CardTitle>Budget da approvare</CardTitle>
            </div>
            <CardDescription>Budget in attesa di approvazione o in revisione</CardDescription>
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
    </section>
  );
};
