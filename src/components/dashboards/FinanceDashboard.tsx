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
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, LineChart, Line, PieChart, Pie, Cell } from 'recharts';

interface Project {
  id: string;
  name: string;
  client_name?: string;
  project_status?: string;
  total_budget: number;
  margin_percentage?: number;
}

interface MonthlyRevenue {
  month: string;
  currentYear: number;
  previousYear: number;
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
  monthlyRevenue?: MonthlyRevenue[];
  userName?: string;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--muted))'];

const chartConfig = {
  value: { label: 'Valore' },
  margin: { label: 'Margine' },
  budget: { label: 'Budget' },
  currentYear: { label: new Date().getFullYear().toString(), color: 'hsl(var(--primary))' },
  previousYear: { label: (new Date().getFullYear() - 1).toString(), color: 'hsl(var(--muted))' },
};

export const FinanceDashboard = ({ stats, projectsToInvoice, monthlyRevenue = [], userName }: FinanceDashboardProps) => {
  const navigate = useNavigate();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(value);
  };

  // Chart data
  const marginData = projectsToInvoice.slice(0, 5).map(p => ({
    name: p.name.substring(0, 15) + (p.name.length > 15 ? '...' : ''),
    margine: p.margin_percentage || 0,
    budget: (p.total_budget || 0) / 1000, // in thousands
  }));

  const quotesData = [
    { name: 'Approvati', value: stats.approvedQuotes },
    { name: 'Pendenti', value: stats.totalQuotes - stats.approvedQuotes },
  ];

  const revenueData = [
    { name: 'Fatturato', value: stats.totalRevenue / 1000 },
    { name: 'Da Fatturare', value: projectsToInvoice.reduce((sum, p) => sum + (p.total_budget || 0), 0) / 1000 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Ciao{userName ? ` ${userName}` : ''}</h1>
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

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Revenue Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Fatturato (k€)</CardTitle>
            <CardDescription>Fatturato vs Da Fatturare</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[200px]">
              <BarChart data={revenueData}>
                <XAxis dataKey="name" />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Quotes Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Stato Preventivi</CardTitle>
            <CardDescription>Approvati vs Pendenti</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[200px]">
              <PieChart>
                <Pie
                  data={quotesData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  nameKey="name"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {quotesData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <ChartTooltip content={<ChartTooltipContent />} />
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Revenue Comparison Chart */}
      {monthlyRevenue.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Fatturato Mensile (k€)</CardTitle>
            <CardDescription>Confronto {new Date().getFullYear()} vs {new Date().getFullYear() - 1}</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[250px]">
              <LineChart data={monthlyRevenue.map(d => ({
                ...d,
                currentYear: d.currentYear / 1000,
                previousYear: d.previousYear / 1000
              }))}>
                <XAxis dataKey="month" />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line 
                  type="monotone" 
                  dataKey="currentYear" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--primary))' }}
                  name={`${new Date().getFullYear()}`}
                />
                <Line 
                  type="monotone" 
                  dataKey="previousYear" 
                  stroke="hsl(var(--muted-foreground))" 
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ fill: 'hsl(var(--muted-foreground))' }}
                  name={`${new Date().getFullYear() - 1}`}
                />
              </LineChart>
            </ChartContainer>
            <div className="flex justify-center gap-6 mt-2">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-primary"></div>
                <span className="text-xs text-muted-foreground">{new Date().getFullYear()}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-muted-foreground"></div>
                <span className="text-xs text-muted-foreground">{new Date().getFullYear() - 1}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Margin Chart */}
      {marginData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Margini Progetti da Fatturare</CardTitle>
            <CardDescription>Percentuale margine per progetto</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[200px]">
              <BarChart data={marginData} layout="vertical">
                <XAxis type="number" domain={[0, 100]} />
                <YAxis type="category" dataKey="name" width={100} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="margine" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

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
    </div>
  );
};
