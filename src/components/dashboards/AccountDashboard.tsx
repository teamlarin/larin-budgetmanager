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
}

export const AccountDashboard = ({ stats, recentProjects }: AccountDashboardProps) => {
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard Account</h1>
        <p className="text-muted-foreground mt-1">Gestisci i tuoi progetti e preventivi</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">I Miei Budget</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.myBudgets}</div>
            <p className="text-xs text-muted-foreground">
              {stats.pendingBudgets} in attesa
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">I Miei Progetti</CardTitle>
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeProjects}</div>
            <p className="text-xs text-muted-foreground">
              progetti attivi
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">I Miei Preventivi</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.myQuotes}</div>
            <p className="text-xs text-muted-foreground">
              {stats.pendingQuotes} in attesa
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valore Totale</CardTitle>
            <Euro className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
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

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Azioni Rapide</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button variant="outline" className="h-auto py-4 flex flex-col gap-2" onClick={() => navigate('/')}>
              <FileText className="h-5 w-5" />
              <span className="text-sm">Nuovo Budget</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex flex-col gap-2" onClick={() => navigate('/quotes')}>
              <TrendingUp className="h-5 w-5" />
              <span className="text-sm">Preventivi</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex flex-col gap-2" onClick={() => navigate('/projects')}>
              <FolderOpen className="h-5 w-5" />
              <span className="text-sm">Progetti</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex flex-col gap-2" onClick={() => navigate('/calendar')}>
              <Clock className="h-5 w-5" />
              <span className="text-sm">Calendario</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
