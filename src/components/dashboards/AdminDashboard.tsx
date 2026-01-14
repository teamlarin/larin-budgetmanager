import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, FolderOpen, Users, TrendingUp, AlertCircle, ArrowRight, Euro } from 'lucide-react';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from 'recharts';
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
  budgetsByStatus?: {
    status: string;
    count: number;
  }[];
  projectsByArea?: {
    area: string;
    count: number;
  }[];
  userName?: string;
}
const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--muted))'];
const chartConfig = {
  count: {
    label: 'Conteggio'
  },
  value: {
    label: 'Valore'
  }
};
export const AdminDashboard = ({
  stats,
  budgetsByStatus = [],
  projectsByArea = [],
  userName
}: AdminDashboardProps) => {
  const navigate = useNavigate();
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR'
    }).format(value);
  };

  // Default data for charts if not provided
  const defaultBudgetsByStatus = [{
    status: 'In Attesa',
    count: stats.pendingBudgets
  }, {
    status: 'Approvati',
    count: stats.totalBudgets - stats.pendingBudgets
  }];
  const defaultProjectsByStatus = [{
    name: 'Attivi',
    value: stats.activeProjects
  }, {
    name: 'Altri',
    value: stats.totalProjects - stats.activeProjects
  }];
  return <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Ciao{userName ? ` ${userName}` : ''}</h1>
        <p className="text-muted-foreground mt-1">Panoramica completa del sistema</p>
      </div>

      {/* Stats Grid */}
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
            <CardTitle className="text-sm font-medium">Progetti attivi</CardTitle>
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent variant="stats">
            <div className="text-2xl font-bold">{stats.activeProjects}</div>
            <p className="text-xs text-muted-foreground">
              su {stats.totalProjects} progetti totali
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
            <CardTitle className="text-sm font-medium">Utenti</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent variant="stats">
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
            <p className="text-xs text-muted-foreground">utenti approvati</p>
          </CardContent>
        </Card>
      </div>

      {/* Financial Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card variant="stats">
          <CardHeader variant="stats">
            <CardTitle className="text-sm font-medium">Valore budget totale</CardTitle>
            <Euro className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent variant="stats">
            <div className="text-2xl font-bold">{formatCurrency(stats.totalBudgetValue)}</div>
            <p className="text-xs text-muted-foreground">
              Somma di tutti i budget approvati
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

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Budget Status Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Stato budget</CardTitle>
            <CardDescription>Distribuzione dei budget per stato</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[200px]">
              <PieChart>
                <Pie data={budgetsByStatus.length > 0 ? budgetsByStatus : defaultBudgetsByStatus} cx="50%" cy="50%" innerRadius={40} outerRadius={80} paddingAngle={5} dataKey="count" nameKey="status" label={({
                status,
                count
              }) => `${status}: ${count}`}>
                  {(budgetsByStatus.length > 0 ? budgetsByStatus : defaultBudgetsByStatus).map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                </Pie>
                <ChartTooltip content={<ChartTooltipContent />} />
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Projects Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Stato progetti</CardTitle>
            <CardDescription>Progetti attivi vs altri</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[200px]">
              <PieChart>
                <Pie data={defaultProjectsByStatus} cx="50%" cy="50%" innerRadius={40} outerRadius={80} paddingAngle={5} dataKey="value" nameKey="name" label={({
                name,
                value
              }) => `${name}: ${value}`}>
                  {defaultProjectsByStatus.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                </Pie>
                <ChartTooltip content={<ChartTooltipContent />} />
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>;
};