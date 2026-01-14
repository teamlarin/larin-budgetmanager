import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, 
  FolderOpen, 
  TrendingUp, 
  Clock,
  ArrowRight,
  Euro,
  AlertCircle
} from 'lucide-react';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, PieChart, Pie, Cell } from 'recharts';

interface Project {
  id: string;
  name: string;
  client_name?: string;
  status: string;
  project_status?: string;
  total_budget: number;
  end_date?: string;
}

interface AccountDashboardProps {
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
  recentProjects: Project[];
  userName?: string;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--muted))'];

const chartConfig = {
  value: { label: 'Valore' },
  count: { label: 'Conteggio' },
};

export const AccountDashboard = ({ stats, recentProjects, userName }: AccountDashboardProps) => {
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

  // Chart data
  const summaryData = [
    { name: 'Budget', totali: stats.myBudgets, inAttesa: stats.pendingBudgets },
    { name: 'Progetti', totali: stats.myProjects, inAttesa: stats.myProjects - stats.activeProjects },
    { name: 'Preventivi', totali: stats.myQuotes, inAttesa: stats.pendingQuotes },
  ];

  const projectStatusData = recentProjects.reduce((acc, project) => {
    const status = project.project_status || 'non_definito';
    const existing = acc.find(item => item.status === status);
    if (existing) {
      existing.count++;
    } else {
      acc.push({ status: getProjectStatusLabel(status), count: 1 });
    }
    return acc;
  }, [] as { status: string; count: number }[]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Ciao{userName ? ` ${userName}` : ''}</h1>
        <p className="text-muted-foreground mt-1">Gestisci i tuoi progetti e preventivi</p>
      </div>

      {/* Stats Grid */}
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
            <CardTitle className="text-sm font-medium">I Miei Progetti</CardTitle>
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent variant="stats">
            <div className="text-2xl font-bold">{stats.activeProjects}</div>
            <p className="text-xs text-muted-foreground">
              progetti attivi
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
            <CardTitle className="text-sm font-medium">Valore Totale</CardTitle>
            <Euro className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent variant="stats">
            <div className="text-2xl font-bold">{formatCurrency(stats.totalBudgetValue)}</div>
            <p className="text-xs text-muted-foreground">
              budget gestiti
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Alert for projects near deadline */}
      {stats.projectsNearDeadline > 0 && (
        <Card className="border-destructive bg-destructive/5">
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <CardTitle className="text-destructive">Attenzione</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              Hai <strong>{stats.projectsNearDeadline}</strong> progetti in scadenza nei prossimi 7 giorni.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Summary Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Riepilogo Attività</CardTitle>
            <CardDescription>Totali vs In Attesa</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[200px]">
              <BarChart data={summaryData}>
                <XAxis dataKey="name" />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="totali" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="inAttesa" fill="hsl(var(--muted))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Project Status Pie */}
        {projectStatusData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Stato Progetti</CardTitle>
              <CardDescription>Distribuzione per stato</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[200px]">
                <PieChart>
                  <Pie
                    data={projectStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="count"
                    nameKey="status"
                    label={({ status, count }) => `${status}: ${count}`}
                  >
                    {projectStatusData.map((_, index) => (
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
            <CardTitle>Progetti Recenti</CardTitle>
            <CardDescription>I tuoi ultimi progetti gestiti</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/projects')}>
            Vedi tutti <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          {recentProjects.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nessun progetto recente</p>
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
