import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  FileText, 
  TrendingUp, 
  AlertCircle, 
  Euro
} from 'lucide-react';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { PieChart, Pie, Cell } from 'recharts';
import { DashboardDateFilter, DateRange } from '@/components/DashboardDateFilter';

interface AdminFinanceDashboardProps {
  stats: {
    totalBudgets: number;
    pendingBudgets: number;
    totalQuotes: number;
    pendingQuotes: number;
    totalBudgetValue: number;
    projectsNearDeadline: number;
    totalProjects: number;
    activeProjects: number;
  };
  budgetsByStatus?: {
    status: string;
    count: number;
  }[];
  dateRange?: DateRange;
  onDateRangeChange?: (range: DateRange) => void;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--muted))'];

const chartConfig = {
  count: { label: 'Conteggio' },
  value: { label: 'Valore' },
};

export const AdminFinanceDashboard = ({
  stats,
  budgetsByStatus = [],
  dateRange,
  onDateRangeChange
}: AdminFinanceDashboardProps) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR'
    }).format(value);
  };

  // Default data for charts if not provided
  const defaultBudgetsByStatus = [
    { status: 'In Attesa', count: stats.pendingBudgets },
    { status: 'Approvati', count: stats.totalBudgets - stats.pendingBudgets }
  ];

  const defaultProjectsByStatus = [
    { name: 'Attivi', value: stats.activeProjects },
    { name: 'Altri', value: stats.totalProjects - stats.activeProjects }
  ];

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
            <CardTitle className="text-sm font-medium">Valore budget totale</CardTitle>
            <Euro className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent variant="stats">
            <div className="text-2xl font-bold">{formatCurrency(stats.totalBudgetValue)}</div>
            <p className="text-xs text-muted-foreground">
              Somma budget approvati
            </p>
          </CardContent>
        </Card>

        <Card variant="stats" className={stats.projectsNearDeadline > 0 ? 'border-destructive' : ''}>
          <CardHeader variant="stats">
            <CardTitle className="text-sm font-medium">Progetti in scadenza</CardTitle>
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

      {/* Finance Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Stato budget</CardTitle>
            <CardDescription>Distribuzione dei budget per stato</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[200px]">
              <PieChart>
                <Pie 
                  data={budgetsByStatus.length > 0 ? budgetsByStatus : defaultBudgetsByStatus} 
                  cx="50%" 
                  cy="50%" 
                  innerRadius={40} 
                  outerRadius={80} 
                  paddingAngle={5} 
                  dataKey="count" 
                  nameKey="status" 
                  label={({ status, count }) => `${status}: ${count}`}
                >
                  {(budgetsByStatus.length > 0 ? budgetsByStatus : defaultBudgetsByStatus).map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <ChartTooltip content={<ChartTooltipContent />} />
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Stato progetti</CardTitle>
            <CardDescription>Progetti attivi vs altri</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[200px]">
              <PieChart>
                <Pie 
                  data={defaultProjectsByStatus} 
                  cx="50%" 
                  cy="50%" 
                  innerRadius={40} 
                  outerRadius={80} 
                  paddingAngle={5} 
                  dataKey="value" 
                  nameKey="name" 
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {defaultProjectsByStatus.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <ChartTooltip content={<ChartTooltipContent />} />
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </section>
  );
};
