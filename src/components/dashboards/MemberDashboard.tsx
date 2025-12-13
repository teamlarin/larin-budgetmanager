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
import { BarChart, Bar, XAxis, YAxis, PieChart, Pie, Cell, RadialBarChart, RadialBar } from 'recharts';

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
  hours: number;
}

interface MemberDashboardProps {
  stats: {
    todayPlannedHours: number;
    todayConfirmedHours: number;
    weekPlannedHours: number;
    weekConfirmedHours: number;
    assignedProjects: number;
    pendingActivities: number;
  };
  todayActivities: Activity[];
  upcomingActivities: Activity[];
  weeklyHoursByProject: ProjectHours[];
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
  pianificate: { label: 'Pianificate' },
  confermate: { label: 'Confermate' },
  value: { label: 'Valore' },
  hours: { label: 'Ore' },
};

export const MemberDashboard = ({ stats, todayActivities, upcomingActivities, weeklyHoursByProject, userName }: MemberDashboardProps) => {
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

  const weekCompletionRate = stats.weekPlannedHours > 0 
    ? Math.round((stats.weekConfirmedHours / stats.weekPlannedHours) * 100) 
    : 0;

  const activityStatusData = [
    { name: 'Confermate', value: todayActivities.filter(a => a.is_confirmed).length },
    { name: 'Da fare', value: todayActivities.filter(a => !a.is_confirmed).length },
  ].filter(d => d.value > 0);

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
            <div className="text-2xl font-bold">{stats.weekPlannedHours.toFixed(1)}h</div>
            <div className="flex items-center gap-2 mt-1">
              <Progress value={weekCompletionRate} className="h-2 flex-1" />
              <span className="text-xs text-muted-foreground">{weekCompletionRate}%</span>
            </div>
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
            <CardTitle>Ore per Progetto</CardTitle>
            <CardDescription>Distribuzione settimanale</CardDescription>
          </CardHeader>
          <CardContent>
            {weeklyHoursByProject.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-[200px]">
                <PieChart>
                  <Pie
                    data={weeklyHoursByProject}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="hours"
                    nameKey="name"
                    label={({ name, hours }) => `${hours}h`}
                  >
                    {weeklyHoursByProject.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={PROJECT_COLORS[index % PROJECT_COLORS.length]} />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />} />
                </PieChart>
              </ChartContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                Nessuna attività questa settimana
              </div>
            )}
            {weeklyHoursByProject.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {weeklyHoursByProject.map((project, index) => (
                  <div key={project.name} className="flex items-center gap-2 text-xs">
                    <div 
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0" 
                      style={{ backgroundColor: PROJECT_COLORS[index % PROJECT_COLORS.length] }}
                    />
                    <span className="truncate flex-1">{project.name}</span>
                    <span className="text-muted-foreground font-medium">{project.hours}h</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Activity Status Pie */}
        {activityStatusData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Attività Oggi</CardTitle>
              <CardDescription>Stato completamento</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[200px]">
                <PieChart>
                  <Pie
                    data={activityStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {activityStatusData.map((_, index) => (
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

      {/* Quick Action */}
      <Card>
        <CardHeader>
          <CardTitle>Azioni Rapide</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <Button variant="outline" className="h-auto py-4 flex flex-col gap-2" onClick={() => navigate('/calendar')}>
              <Calendar className="h-5 w-5" />
              <span className="text-sm">Calendario</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex flex-col gap-2" onClick={() => navigate('/profile')}>
              <Clock className="h-5 w-5" />
              <span className="text-sm">Profilo</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
