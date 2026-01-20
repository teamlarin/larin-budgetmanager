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
  userName?: string;
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
  userName
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
      <div>
        <h1 className="text-3xl font-bold text-foreground">Ciao{userName ? ` ${userName}` : ''}</h1>
        <p className="text-muted-foreground mt-1">Panoramica completa del sistema</p>
      </div>

      {/* ===== AREA PERSONALE ===== */}
      {personalStats && (
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-1 bg-primary rounded-full" />
            <h2 className="text-xl font-semibold">Area Personale</h2>
          </div>

          {/* Personal Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <Card variant="stats">
              <CardHeader variant="stats">
                <CardTitle className="text-sm font-medium">Ore Oggi</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent variant="stats">
                <div className="text-2xl font-bold">{personalStats.todayPlannedHours.toFixed(1)}h</div>
                <div className="flex items-center gap-2 mt-1">
                  <Progress value={todayCompletionRate} className="h-2 flex-1" />
                  <span className="text-xs text-muted-foreground">{todayCompletionRate}%</span>
                </div>
              </CardContent>
            </Card>

            <Card variant="stats">
              <CardHeader variant="stats">
                <CardTitle className="text-sm font-medium">Ore Settimana</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent variant="stats">
                <div className="text-2xl font-bold">
                  {personalStats.weekConfirmedHours.toFixed(1)}h
                  <span className="text-sm font-normal text-muted-foreground ml-1">
                    / {personalStats.weeklyContractHours > 0 ? `${personalStats.weeklyContractHours}h` : '-'}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <Progress 
                    value={personalStats.weeklyContractHours > 0 ? Math.min((personalStats.weekConfirmedHours / personalStats.weeklyContractHours) * 100, 100) : 0} 
                    className="h-2 flex-1" 
                  />
                  <span className="text-xs text-muted-foreground">
                    {personalStats.weeklyContractHours > 0 ? Math.round((personalStats.weekConfirmedHours / personalStats.weeklyContractHours) * 100) : 0}%
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {personalStats.weekPlannedHours.toFixed(1)}h pianificate
                </p>
              </CardContent>
            </Card>

            <Card variant="stats">
              <CardHeader variant="stats">
                <CardTitle className="text-sm font-medium">Progetti Assegnati</CardTitle>
                <FolderOpen className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent variant="stats">
                <div className="text-2xl font-bold">{personalStats.assignedProjects}</div>
                <p className="text-xs text-muted-foreground">progetti attivi</p>
              </CardContent>
            </Card>

            <Card variant="stats">
              <CardHeader variant="stats">
                <CardTitle className="text-sm font-medium">Attività da Fare</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent variant="stats">
                <div className="text-2xl font-bold">{personalStats.pendingActivities}</div>
                <p className="text-xs text-muted-foreground">da completare</p>
              </CardContent>
            </Card>

            <Card variant="stats" className={personalStats.actualProductivity >= personalStats.targetProductivity ? 'border-primary/50' : personalStats.actualProductivity >= personalStats.targetProductivity * 0.8 ? 'border-warning/50' : 'border-destructive/50'}>
              <CardHeader variant="stats">
                <CardTitle className="text-sm font-medium">Produttività Billable</CardTitle>
                <TrendingUp className={`h-4 w-4 ${personalStats.actualProductivity >= personalStats.targetProductivity ? 'text-primary' : personalStats.actualProductivity >= personalStats.targetProductivity * 0.8 ? 'text-warning' : 'text-destructive'}`} />
              </CardHeader>
              <CardContent variant="stats">
                <div className="flex items-baseline gap-1">
                  <span className={`text-2xl font-bold ${personalStats.actualProductivity >= personalStats.targetProductivity ? 'text-primary' : personalStats.actualProductivity >= personalStats.targetProductivity * 0.8 ? 'text-warning' : 'text-destructive'}`}>
                    {personalStats.actualProductivity}%
                  </span>
                  <span className="text-sm text-muted-foreground">/ {personalStats.targetProductivity}%</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <Progress 
                    value={Math.min((personalStats.actualProductivity / personalStats.targetProductivity) * 100, 100)} 
                    className="h-2 flex-1" 
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {personalStats.billableHours}h billable / {personalStats.totalHours}h totali
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Personal Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Weekly Hours by Project */}
            <Card>
              <CardHeader>
                <CardTitle>Ore per progetto</CardTitle>
                <CardDescription>Pianificate vs Confermate</CardDescription>
              </CardHeader>
              <CardContent>
                {weeklyHoursByProject.length > 0 ? (
                  <ChartContainer config={chartConfig} className="h-[200px]">
                    <BarChart data={weeklyHoursByProject} layout="vertical">
                      <XAxis type="number" />
                      <YAxis 
                        dataKey="name" 
                        type="category" 
                        width={80} 
                        tick={{ fontSize: 10 }}
                        tickFormatter={(value) => value.length > 12 ? `${value.substring(0, 12)}...` : value}
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="plannedHours" name="Pianificate" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="confirmedHours" name="Confermate" fill="hsl(var(--secondary))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ChartContainer>
                ) : (
                  <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                    Nessuna attività questa settimana
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Confirmed Hours by Category */}
            <Card>
              <CardHeader>
                <CardTitle>Ore per tipo attività</CardTitle>
                <CardDescription>Ore confermate per categoria</CardDescription>
              </CardHeader>
              <CardContent>
                {confirmedHoursByCategory.length > 0 ? (
                  <>
                    <ChartContainer config={chartConfig} className="h-[200px]">
                      <PieChart>
                        <Pie
                          data={confirmedHoursByCategory}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={80}
                          paddingAngle={2}
                          dataKey="hours"
                          nameKey="category"
                          label={({ hours }) => `${hours}h`}
                        >
                          {confirmedHoursByCategory.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={getCategoryColor(entry.category)} />
                          ))}
                        </Pie>
                        <ChartTooltip content={<ChartTooltipContent />} />
                      </PieChart>
                    </ChartContainer>
                    <div className="mt-3 grid grid-cols-2 gap-1.5">
                      {confirmedHoursByCategory.map((entry) => (
                        <div key={entry.category} className="flex items-center gap-2 text-xs">
                          <div 
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0" 
                            style={{ backgroundColor: getCategoryColor(entry.category) }}
                          />
                          <span className="truncate flex-1">{entry.category}</span>
                          <span className="text-muted-foreground font-medium">{entry.hours}h</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                    Nessuna attività confermata
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </section>
      )}

      {/* ===== AREA FINANCE ===== */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-1 bg-green-500 rounded-full" />
          <h2 className="text-xl font-semibold">Area Finance</h2>
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
        <div className="flex items-center gap-3">
          <div className="h-8 w-1 bg-blue-500 rounded-full" />
          <h2 className="text-xl font-semibold">Area Progetti e Risorse</h2>
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

      </section>
    </div>
  );
};
