import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Euro, 
  TrendingUp, 
  Receipt,
  ArrowRight,
  FileText,
  Calculator
} from 'lucide-react';

interface Project {
  id: string;
  name: string;
  client_name?: string;
  project_status?: string;
  total_budget: number;
  margin_percentage?: number;
}

interface FinanceDashboardProps {
  stats: {
    totalRevenue: number;
    pendingInvoices: number;
    projectsToInvoice: number;
    totalQuotes: number;
    approvedQuotes: number;
    avgMargin: number;
  };
  projectsToInvoice: Project[];
}

export const FinanceDashboard = ({ stats, projectsToInvoice }: FinanceDashboardProps) => {
  const navigate = useNavigate();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(value);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard Finance</h1>
        <p className="text-muted-foreground mt-1">Panoramica finanziaria e fatturazione</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fatturato Totale</CardTitle>
            <Euro className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">
              budget approvati
            </p>
          </CardContent>
        </Card>

        <Card className={stats.projectsToInvoice > 0 ? 'border-amber-500' : ''}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Da Fatturare</CardTitle>
            <Receipt className={`h-4 w-4 ${stats.projectsToInvoice > 0 ? 'text-amber-500' : 'text-muted-foreground'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stats.projectsToInvoice > 0 ? 'text-amber-500' : ''}`}>
              {stats.projectsToInvoice}
            </div>
            <p className="text-xs text-muted-foreground">
              progetti pronti
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Preventivi Approvati</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.approvedQuotes}</div>
            <p className="text-xs text-muted-foreground">
              su {stats.totalQuotes} totali
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Margine Medio</CardTitle>
            <Calculator className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgMargin.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              sui progetti
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Projects to Invoice */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Progetti da Fatturare</CardTitle>
            <CardDescription>Progetti pronti per la fatturazione</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/projects')}>
            Vedi tutti <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          {projectsToInvoice.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nessun progetto da fatturare</p>
          ) : (
            <div className="space-y-3">
              {projectsToInvoice.slice(0, 5).map((project) => (
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
                    {project.margin_percentage !== undefined && (
                      <Badge variant="outline">
                        {project.margin_percentage.toFixed(0)}% margine
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
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Button variant="outline" className="h-auto py-4 flex flex-col gap-2" onClick={() => navigate('/quotes')}>
              <FileText className="h-5 w-5" />
              <span className="text-sm">Preventivi</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex flex-col gap-2" onClick={() => navigate('/projects')}>
              <Receipt className="h-5 w-5" />
              <span className="text-sm">Progetti</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex flex-col gap-2" onClick={() => navigate('/')}>
              <Euro className="h-5 w-5" />
              <span className="text-sm">Budget</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
