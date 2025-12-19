import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Clock, 
  Calendar,
  CheckCircle,
  ArrowRight,
  FolderOpen
} from 'lucide-react';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, PieChart, Pie, Cell } from 'recharts';

interface Activity {
  id: string;
  activity_name: string;
  project_name: string;
  scheduled_date?: string;
  scheduled_start_time?: string;
  scheduled_end_time?: string;
  is_confirmed: boolean;
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

interface MemberDashboardProps {
  stats: {
    todayPlannedHours: number;
    todayConfirmedHours: number;
    weekPlannedHours: number;
    weekConfirmedHours: number;
    weeklyContractHours: number;
    assignedProjects: number;
    pendingActivities: number;
  };
  todayActivities: Activity[];
  upcomingActivities: Activity[];
  weeklyHoursByProject: ProjectHours[];
  confirmedHoursByCategory: CategoryHours[];
  userName?: string;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--muted))'];
const PROJECT_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--secondary))',
  'hsl(220, 70%, 50%)',
  'hsl(160, 60%, 45%)',
  'hsl(30, 80%, 55%)',
  'hsl(280, 60%, 55%)',
];

const chartConfig = {
  pianificate: { label: 'Pianificate', color: 'hsl(var(--primary))' },
  confermate: { label: 'Confermate', color: 'hsl(var(--secondary))' },
  plannedHours: { label: 'Pianificate', color: 'hsl(var(--primary))' },
  confirmedHours: { label: 'Confermate', color: 'hsl(var(--secondary))' },
  value: { label: 'Valore' },
  hours: { label: 'Ore' },
};

const CATEGORY_COLORS: Record<string, string> = {
  'Management': 'hsl(220, 70%, 50%)',
  'Design': 'hsl(280, 60%, 55%)',
  'Dev': 'hsl(160, 60%, 45%)',
  'Content': 'hsl(30, 80%, 55%)',
  'Support': 'hsl(var(--primary))',
  'Meeting': 'hsl(340, 65%, 55%)',
  'Altro': 'hsl(var(--muted-foreground))',
};

export const MemberDashboard = ({ stats, todayActivities, upcomingActivities, weeklyHoursByProject, confirmedHoursByCategory, userName }: MemberDashboardProps) => {
  const navigate = useNavigate();

  const formatTime = (time: string) => {
    return time.substring(0, 5);
  };

  // Chart data
  const hoursData = [
    { name: 'Oggi', pianificate: stats.todayPlannedHours, confermate: stats.todayConfirmedHours },
    { name: 'Settimana', pianificate: stats.weekPlannedHours, confermate: stats.weekConfirmedHours },
  ];

  const todayCompletionRate = stats.todayPlannedHours > 0 
    ? Math.round((stats.todayConfirmedHours / stats.todayPlannedHours) * 100) 
    : 0;

  const getCategoryColor = (category: string) => {
    return CATEGORY_COLORS[category] || CATEGORY_COLORS['Altro'];
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Ciao{userName ? ` ${userName}` : ''}</h1>
        <p className="text-muted-foreground mt-1">Le tue attività e il tuo tempo</p>
      </div>

      {/* Today Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ore Oggi</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.todayPlannedHours.toFixed(1)}h</div>
            <div className="flex items-center gap-2 mt-1">
              <Progress value={todayCompletionRate} className="h-2 flex-1" />
              <span className="text-xs text-muted-foreground">{todayCompletionRate}%</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ore Settimana</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.weekConfirmedHours.toFixed(1)}h
              <span className="text-sm font-normal text-muted-foreground ml-1">
                / {stats.weeklyContractHours > 0 ? `${stats.weeklyContractHours}h` : '-'}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Progress 
                value={stats.weeklyContractHours > 0 ? Math.min((stats.weekConfirmedHours / stats.weeklyContractHours) * 100, 100) : 0} 
                className="h-2 flex-1" 
              />
              <span className="text-xs text-muted-foreground">
                {stats.weeklyContractHours > 0 ? Math.round((stats.weekConfirmedHours / stats.weeklyContractHours) * 100) : 0}%
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.weekPlannedHours.toFixed(1)}h pianificate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Progetti Assegnati</CardTitle>
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.assignedProjects}</div>
            <p className="text-xs text-muted-foreground">
              progetti attivi
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Attività da Fare</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingActivities}</div>
            <p className="text-xs text-muted-foreground">
              da completare
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Hours Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Riepilogo Ore</CardTitle>
            <CardDescription>Pianificate vs Confermate</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[200px]">
              <BarChart data={hoursData}>
                <XAxis dataKey="name" />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="pianificate" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="confermate" fill="hsl(var(--secondary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

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
            {weeklyHoursByProject.length > 0 && (
              <div className="mt-3 flex gap-4 justify-center text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                  <span>Pianificate</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2.5 h-2.5 rounded-full bg-secondary" />
                  <span>Confermate</span>
                </div>
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

      {/* Today's Activities */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Attività di Oggi</CardTitle>
            <CardDescription>Le tue attività pianificate per oggi</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/calendar')}>
            Calendario <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          {todayActivities.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nessuna attività pianificata per oggi</p>
          ) : (
            <div className="space-y-3">
              {todayActivities.map((activity) => (
                <div 
                  key={activity.id} 
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div className="space-y-1">
                    <p className="font-medium">{activity.activity_name}</p>
                    <p className="text-sm text-muted-foreground">{activity.project_name}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {activity.scheduled_start_time && activity.scheduled_end_time && (
                      <span className="text-sm text-muted-foreground">
                        {formatTime(activity.scheduled_start_time)} - {formatTime(activity.scheduled_end_time)}
                      </span>
                    )}
                    {activity.is_confirmed ? (
                      <Badge variant="default" className="bg-green-500">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Confermata
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Pianificata</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upcoming Activities */}
      <Card>
        <CardHeader>
          <CardTitle>Prossime Attività</CardTitle>
          <CardDescription>Le tue attività nei prossimi giorni</CardDescription>
        </CardHeader>
        <CardContent>
          {upcomingActivities.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nessuna attività in programma</p>
          ) : (
            <div className="space-y-3">
              {upcomingActivities.slice(0, 5).map((activity) => (
                <div 
                  key={activity.id} 
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div className="space-y-1">
                    <p className="font-medium">{activity.activity_name}</p>
                    <p className="text-sm text-muted-foreground">{activity.project_name}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {activity.scheduled_date && (
                      <span className="text-sm text-muted-foreground">
                        {new Date(activity.scheduled_date).toLocaleDateString('it-IT')}
                      </span>
                    )}
                    {activity.scheduled_start_time && activity.scheduled_end_time && (
                      <span className="text-sm text-muted-foreground">
                        {formatTime(activity.scheduled_start_time)} - {formatTime(activity.scheduled_end_time)}
                      </span>
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
