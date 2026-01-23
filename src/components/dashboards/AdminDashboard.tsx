import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { 
  FileText, 
  FolderOpen, 
  Users, 
  TrendingUp, 
  AlertCircle, 
  ArrowRight, 
  Euro,
  Clock,
  Calendar,
  CheckCircle
} from 'lucide-react';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, LineChart, Line, ReferenceLine } from 'recharts';
import { WorkloadSummaryWidget } from './WorkloadSummaryWidget';
import { DashboardDateFilter, DateRange } from '@/components/DashboardDateFilter';
import { formatHours } from '@/lib/utils';

interface PersonalStats {
  todayPlannedHours: number;
  todayConfirmedHours: number;
  weekPlannedHours: number;
  weekConfirmedHours: number;
  weeklyContractHours: number;
  assignedProjects: number;
  pendingActivities: number;
  billableHours: number;
  totalHours: number;
  actualProductivity: number;
  targetProductivity: number;
}

interface ProjectHours {
  name: string;
  plannedHours: number;
  confirmedHours: number;
}

interface CategoryHours {
  category: string;
  hours: number;
}

interface ProductivityTrendPoint {
  month: string;
  productivity: number;
  target: number;
}

interface UserWorkloadSummary {
  userId: string;
  fullName: string;
  plannedHours: number;
  capacityHours: number;
  utilizationPercentage: number;
}

interface AdminDashboardProps {
  stats: {
    totalBudgets: number;
    pendingBudgets: number;
    totalProjects: number;
    activeProjects: number;
    totalQuotes: number;
    pendingQuotes: number;
    totalUsers: number;
    totalBudgetValue: number;
    projectsNearDeadline: number;
  };
  personalStats?: PersonalStats;
  weeklyHoursByProject?: ProjectHours[];
  confirmedHoursByCategory?: CategoryHours[];
  productivityTrend?: ProductivityTrendPoint[];
  budgetsByStatus?: {
    status: string;
    count: number;
  }[];
  projectsByArea?: {
    area: string;
    count: number;
  }[];
  teamWorkload?: UserWorkloadSummary[];
  workloadLoading?: boolean;
  userName?: string;
  dateRange?: DateRange;
  onDateRangeChange?: (range: DateRange) => void;
  hideHeader?: boolean;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--muted))'];

const CATEGORY_COLORS: Record<string, string> = {
  'Management': 'hsl(220, 70%, 50%)',
  'Design': 'hsl(280, 60%, 55%)',
  'Dev': 'hsl(160, 60%, 45%)',
  'Content': 'hsl(30, 80%, 55%)',
  'Support': 'hsl(var(--primary))',
  'Meeting': 'hsl(340, 65%, 55%)',
  'Altro': 'hsl(var(--muted-foreground))',
};

const chartConfig = {
  count: { label: 'Conteggio' },
  value: { label: 'Valore' },
  pianificate: { label: 'Pianificate', color: 'hsl(var(--primary))' },
  confermate: { label: 'Confermate', color: 'hsl(var(--secondary))' },
  plannedHours: { label: 'Pianificate', color: 'hsl(var(--primary))' },
  confirmedHours: { label: 'Confermate', color: 'hsl(var(--secondary))' },
  hours: { label: 'Ore' },
};

export const AdminDashboard = ({
  stats,
  personalStats,
  weeklyHoursByProject = [],
  confirmedHoursByCategory = [],
  productivityTrend = [],
  budgetsByStatus = [],
  projectsByArea = [],
  teamWorkload = [],
  workloadLoading = false,
  userName,
  dateRange,
  onDateRangeChange,
  hideHeader = false
}: AdminDashboardProps) => {
  const navigate = useNavigate();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR'
    }).format(value);
  };

  const getCategoryColor = (category: string) => {
    return CATEGORY_COLORS[category] || CATEGORY_COLORS['Altro'];
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

  // Personal stats calculations
  const todayCompletionRate = personalStats && personalStats.todayPlannedHours > 0 
    ? Math.round((personalStats.todayConfirmedHours / personalStats.todayPlannedHours) * 100) 
    : 0;

  return (
    <div className="space-y-8">
      {!hideHeader && (
        <div>
          <h1 className="text-3xl font-bold text-foreground">Ciao{userName ? ` ${userName}` : ''}</h1>
          <p className="text-muted-foreground mt-1">Panoramica completa del sistema</p>
        </div>
      )}


      {/* ===== AREA FINANCE ===== */}
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

      {/* ===== AREA PROGETTI E RISORSE ===== */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-1 rounded-full" style={{ backgroundColor: 'hsl(var(--primary))' }} />
            <h2 className="text-xl font-semibold">Area Progetti e Risorse</h2>
          </div>
          {dateRange && onDateRangeChange && (
            <DashboardDateFilter dateRange={dateRange} onDateRangeChange={onDateRangeChange} />
          )}
        </div>

        {/* Projects & Resources Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card variant="stats">
            <CardHeader variant="stats">
              <CardTitle className="text-sm font-medium">Progetti totali</CardTitle>
              <FolderOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent variant="stats">
              <div className="text-2xl font-bold">{stats.totalProjects}</div>
              <p className="text-xs text-muted-foreground">
                progetti nel sistema
              </p>
            </CardContent>
          </Card>

          <Card variant="stats">
            <CardHeader variant="stats">
              <CardTitle className="text-sm font-medium">Progetti attivi</CardTitle>
              <FolderOpen className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent variant="stats">
              <div className="text-2xl font-bold text-primary">{stats.activeProjects}</div>
              <div className="flex items-center gap-2 mt-1">
                <Progress 
                  value={stats.totalProjects > 0 ? (stats.activeProjects / stats.totalProjects) * 100 : 0} 
                  className="h-2 flex-1" 
                />
                <span className="text-xs text-muted-foreground">
                  {stats.totalProjects > 0 ? Math.round((stats.activeProjects / stats.totalProjects) * 100) : 0}%
                </span>
              </div>
            </CardContent>
          </Card>

          <Card variant="stats">
            <CardHeader variant="stats">
              <CardTitle className="text-sm font-medium">Utenti</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent variant="stats">
              <div className="text-2xl font-bold">{stats.totalUsers}</div>
              <p className="text-xs text-muted-foreground">utenti approvati</p>
            </CardContent>
          </Card>

          <Card variant="stats">
            <CardHeader variant="stats">
              <CardTitle className="text-sm font-medium">Risorse per progetto</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent variant="stats">
              <div className="text-2xl font-bold">
                {stats.activeProjects > 0 ? (stats.totalUsers / stats.activeProjects).toFixed(1) : '-'}
              </div>
              <p className="text-xs text-muted-foreground">
                media utenti/progetto attivo
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Team Workload Widget */}
        <WorkloadSummaryWidget data={teamWorkload} isLoading={workloadLoading} />

      </section>
    </div>
  );
};
