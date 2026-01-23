import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, 
  TrendingUp, 
  Euro,
  AlertCircle,
  ArrowRight
} from 'lucide-react';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, PieChart, Pie, Cell } from 'recharts';
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
  recentProjects: Project[];
  dateRange?: DateRange;
  onDateRangeChange?: (range: DateRange) => void;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--muted))'];

const chartConfig = {
  value: { label: 'Valore' },
  count: { label: 'Conteggio' },
  miei: { label: 'I Miei', color: 'hsl(var(--primary))' },
  globali: { label: 'Totali', color: 'hsl(var(--muted))' },
};

export const AccountBudgetQuoteDashboard = ({ 
  stats, 
  globalStats,
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

  // Comparison chart data
  const comparisonData = globalStats ? [
    { 
      name: 'Budget', 
      miei: stats.myBudgets, 
      globali: globalStats.totalBudgets 
    },
    { 
      name: 'Preventivi', 
      miei: stats.myQuotes, 
      globali: globalStats.totalQuotes 
    },
  ] : [];

  // Personal stats pie chart
  const personalStatusData = [
    { name: 'Approvati', value: stats.myBudgets - stats.pendingBudgets },
    { name: 'In Attesa', value: stats.pendingBudgets },
  ].filter(d => d.value > 0);

  const quoteStatusData = [
    { name: 'Approvati', value: stats.myQuotes - stats.pendingQuotes },
    { name: 'In Attesa', value: stats.pendingQuotes },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex items-center gap-3">
        <div className="h-8 w-1 rounded-full" style={{ backgroundColor: 'hsl(var(--primary))' }} />
        <h2 className="text-xl font-semibold">Budget & Quote</h2>
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

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Comparison Bar Chart */}
        {globalStats && comparisonData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Confronto</CardTitle>
              <CardDescription>I miei vs Totali</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[200px]">
                <BarChart data={comparisonData}>
                  <XAxis dataKey="name" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="miei" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="globali" fill="hsl(var(--muted))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        )}

        {/* Budget Status Pie */}
        {personalStatusData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Stato Budget</CardTitle>
              <CardDescription>Distribuzione per stato</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[200px]">
                <PieChart>
                  <Pie
                    data={personalStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {personalStatusData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />} />
                </PieChart>
              </ChartContainer>
            </CardContent>
          </Card>
        )}

        {/* Quote Status Pie */}
        {quoteStatusData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Stato Preventivi</CardTitle>
              <CardDescription>Distribuzione per stato</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[200px]">
                <PieChart>
                  <Pie
                    data={quoteStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {quoteStatusData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />} />
                </PieChart>
              </ChartContainer>
            </CardContent>
          </Card>
        )}
      </div>

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
