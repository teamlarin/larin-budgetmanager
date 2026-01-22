import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  CalendarDays, 
  Clock,
  ArrowRight,
  Calendar,
  CheckCircle,
  AlertTriangle,
  ListTodo,
  Users
} from 'lucide-react';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, PieChart, Pie, Cell } from 'recharts';
import { formatHours } from '@/lib/utils';

interface TeamMember {
  id: string;
  name: string;
  planned_hours: number;
  confirmed_hours: number;
}

interface Activity {
  id: string;
  activity_name: string;
  project_name: string;
  assignee_name?: string;
  scheduled_date?: string;
  scheduled_start_time?: string;
  scheduled_end_time?: string;
  is_confirmed: boolean;
}

interface ProjectDeadline {
  id: string;
  name: string;
  client_name?: string;
  end_date: string;
  days_remaining: number;
  progress?: number;
}

interface WeeklyCalendarDay {
  day: string;
  date: string;
  planned: number;
  confirmed: number;
  activities: number;
}

interface CoordinatorDashboardProps {
  stats: {
    totalActivitiesToday: number;
    confirmedActivitiesToday: number;
    pendingActivities: number;
    upcomingDeadlines: number;
    teamMembers: number;
    activeProjects: number;
  };
  teamWorkload: TeamMember[];
  todayActivities: Activity[];
  upcomingDeadlines: ProjectDeadline[];
  weeklyCalendar: WeeklyCalendarDay[];
  userName?: string;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--muted))'];

const chartConfig = {
  planned: { label: 'Pianificate' },
  confirmed: { label: 'Confermate' },
  activities: { label: 'Attività' },
};

export const CoordinatorDashboard = ({ 
  stats, 
  teamWorkload, 
  todayActivities, 
  upcomingDeadlines,
  weeklyCalendar,
  userName 
}: CoordinatorDashboardProps) => {
  const navigate = useNavigate();

  const formatTime = (time: string) => {
    return time?.substring(0, 5) || '';
  };

  // Chart data
  const workloadChartData = teamWorkload.slice(0, 6).map(member => ({
    name: member.name.split(' ')[0] || 'Utente',
    pianificate: Math.round(member.planned_hours * 10) / 10,
    confermate: Math.round(member.confirmed_hours * 10) / 10,
  }));

  const todayCompletionRate = stats.totalActivitiesToday > 0 
    ? Math.round((stats.confirmedActivitiesToday / stats.totalActivitiesToday) * 100) 
    : 0;

  // Pie chart for activities status
  const activitiesStatusData = [
    { name: 'Confermate', value: stats.confirmedActivitiesToday, fill: 'hsl(var(--primary))' },
    { name: 'In attesa', value: stats.totalActivitiesToday - stats.confirmedActivitiesToday, fill: 'hsl(var(--muted))' },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Ciao{userName ? ` ${userName}` : ''}</h1>
        <p className="text-muted-foreground mt-1">Coordina le attività e il team</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card variant="stats">
          <CardHeader variant="stats">
            <CardTitle className="text-sm font-medium">Attività Oggi</CardTitle>
            <ListTodo className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent variant="stats">
            <div className="text-2xl font-bold">{stats.totalActivitiesToday}</div>
            <div className="flex items-center gap-2 mt-1">
              <Progress value={todayCompletionRate} className="h-2 flex-1" />
              <span className="text-xs text-muted-foreground">{todayCompletionRate}% conf.</span>
            </div>
          </CardContent>
        </Card>

        <Card variant="stats">
          <CardHeader variant="stats">
            <CardTitle className="text-sm font-medium">Da Pianificare</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent variant="stats">
            <div className="text-2xl font-bold">{stats.pendingActivities}</div>
            <p className="text-xs text-muted-foreground">
              attività senza data
            </p>
          </CardContent>
        </Card>

        <Card variant="stats">
          <CardHeader variant="stats">
            <CardTitle className="text-sm font-medium">Deadline Vicine</CardTitle>
            <AlertTriangle className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent variant="stats">
            <div className="text-2xl font-bold">{stats.upcomingDeadlines}</div>
            <p className="text-xs text-muted-foreground">
              nei prossimi 7 giorni
            </p>
          </CardContent>
        </Card>

        <Card variant="stats">
          <CardHeader variant="stats">
            <CardTitle className="text-sm font-medium">Team Attivo</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent variant="stats">
            <div className="text-2xl font-bold">{stats.teamMembers}</div>
            <p className="text-xs text-muted-foreground">
              su {stats.activeProjects} progetti
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Weekly Calendar */}
      {weeklyCalendar.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Pianificazione Settimanale
            </CardTitle>
            <CardDescription>Panoramica delle attività pianificate</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-2">
              {weeklyCalendar.map((day, index) => {
                const isToday = new Date().getDay() === index;
                const hasActivities = day.activities > 0;
                const completionRate = day.planned > 0 ? (day.confirmed / day.planned) * 100 : 0;
                
                return (
                  <div 
                    key={day.day} 
                    className={`p-3 rounded-lg border text-center transition-colors ${
                      isToday ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-border'
                    } ${hasActivities ? 'hover:bg-muted/50 cursor-pointer' : ''}`}
                    onClick={() => hasActivities && navigate('/calendar')}
                  >
                    <div className={`text-xs font-medium ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>
                      {day.day}
                    </div>
                    <div className={`text-sm font-bold mt-1 ${isToday ? 'text-primary' : ''}`}>
                      {day.date}
                    </div>
                    <div className="mt-2 space-y-1">
                      <div className="text-lg font-bold">{day.activities}</div>
                      <div className="text-xs text-muted-foreground">
                        attività
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatHours(day.planned)} pian.
                      </div>
                      {day.planned > 0 && (
                        <Progress value={Math.min(completionRate, 100)} className="h-1 mt-1" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Team Workload Bar Chart */}
        {workloadChartData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Carico Team</CardTitle>
              <CardDescription>Ore pianificate vs confermate per membro</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[200px]">
                <BarChart data={workloadChartData}>
                  <XAxis dataKey="name" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="pianificate" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="confermate" fill="hsl(var(--secondary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        )}

        {/* Activities Status Pie Chart */}
        {activitiesStatusData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Stato Attività Oggi</CardTitle>
              <CardDescription>Confermate vs in attesa di conferma</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-center">
              <ChartContainer config={chartConfig} className="h-[200px] w-[200px]">
                <PieChart>
                  <Pie
                    data={activitiesStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                    labelLine={false}
                  >
                    {activitiesStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
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
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              Attività di Oggi
            </CardTitle>
            <CardDescription>Tutte le attività pianificate per oggi</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/calendar')}>
            Vai al Calendario <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          {todayActivities.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nessuna attività pianificata per oggi
            </p>
          ) : (
            <div className="space-y-3">
              {todayActivities.slice(0, 8).map((activity) => (
                <div 
                  key={activity.id} 
                  className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                    activity.is_confirmed 
                      ? 'bg-primary/5 border-primary/20' 
                      : 'hover:bg-muted/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {activity.is_confirmed ? (
                      <CheckCircle className="h-5 w-5 text-primary" />
                    ) : (
                      <Clock className="h-5 w-5 text-muted-foreground" />
                    )}
                    <div>
                      <p className="font-medium">{activity.activity_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {activity.project_name}
                        {activity.assignee_name && ` • ${activity.assignee_name}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {activity.scheduled_start_time && activity.scheduled_end_time && (
                      <span className="text-sm text-muted-foreground">
                        {formatTime(activity.scheduled_start_time)} - {formatTime(activity.scheduled_end_time)}
                      </span>
                    )}
                    <Badge variant={activity.is_confirmed ? "default" : "outline"}>
                      {activity.is_confirmed ? 'Confermata' : 'In attesa'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upcoming Deadlines */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Deadline in Arrivo
            </CardTitle>
            <CardDescription>Progetti con scadenza nei prossimi 14 giorni</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/projects')}>
            Tutti i Progetti <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          {upcomingDeadlines.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nessuna deadline imminente
            </p>
          ) : (
            <div className="space-y-3">
              {upcomingDeadlines.slice(0, 5).map((project) => (
                <div 
                  key={project.id} 
                  className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors ${
                    project.days_remaining <= 3 ? 'border-destructive/50 bg-destructive/5' : ''
                  }`}
                  onClick={() => navigate(`/projects/${project.id}/canvas`)}
                >
                  <div className="space-y-1 flex-1">
                    <p className="font-medium">{project.name}</p>
                    {project.client_name && (
                      <p className="text-sm text-muted-foreground">{project.client_name}</p>
                    )}
                    {project.progress !== undefined && (
                      <div className="flex items-center gap-2">
                        <Progress value={project.progress} className="h-2 flex-1 max-w-[200px]" />
                        <span className="text-xs text-muted-foreground">{project.progress}%</span>
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <Badge 
                      variant={project.days_remaining <= 3 ? "destructive" : project.days_remaining <= 7 ? "secondary" : "outline"}
                    >
                      {project.days_remaining === 0 
                        ? 'Oggi!' 
                        : project.days_remaining === 1 
                          ? 'Domani' 
                          : `${project.days_remaining} giorni`}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(project.end_date).toLocaleDateString('it-IT')}
                    </p>
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
