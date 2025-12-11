import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Users, 
  FolderOpen, 
  Clock,
  ArrowRight,
  Calendar,
  CheckCircle
} from 'lucide-react';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, PieChart, Pie, Cell, RadialBarChart, RadialBar } from 'recharts';

interface TeamMember {
  id: string;
  name: string;
  planned_hours: number;
  confirmed_hours: number;
}

interface Project {
  id: string;
  name: string;
  client_name?: string;
  progress?: number;
  project_status?: string;
}

interface WeeklyCalendarDay {
  day: string;
  date: string;
  planned: number;
  confirmed: number;
  activities: number;
}

interface TeamLeaderDashboardProps {
  stats: {
    teamMembers: number;
    activeProjects: number;
    totalPlannedHours: number;
    totalConfirmedHours: number;
    projectsInProgress: number;
  };
  teamWorkload: TeamMember[];
  recentProjects: Project[];
  weeklyCalendar?: WeeklyCalendarDay[];
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--muted))', 'hsl(var(--destructive))'];

const chartConfig = {
  planned: { label: 'Pianificate' },
  confirmed: { label: 'Confermate' },
  progress: { label: 'Progresso' },
  activities: { label: 'Attività' },
};

export const TeamLeaderDashboard = ({ stats, teamWorkload, recentProjects, weeklyCalendar = [] }: TeamLeaderDashboardProps) => {
  const navigate = useNavigate();

  const getProjectStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      'in_partenza': 'In Partenza',
      'aperto': 'Aperto',
      'da_fatturare': 'Da Fatturare',
      'completato': 'Completato'
    };
    return labels[status] || status;
  };

  // Chart data
  const workloadChartData = teamWorkload.slice(0, 6).map(member => ({
    name: member.name.split(' ')[0] || 'Utente', // First name only
    pianificate: Math.round(member.planned_hours * 10) / 10,
    confermate: Math.round(member.confirmed_hours * 10) / 10,
  }));

  const completionRate = stats.totalPlannedHours > 0 
    ? Math.round((stats.totalConfirmedHours / stats.totalPlannedHours) * 100) 
    : 0;

  const completionData = [
    { name: 'Completamento', value: completionRate, fill: 'hsl(var(--primary))' },
  ];

  const projectProgressData = recentProjects.slice(0, 5).map(project => ({
    name: project.name.substring(0, 12) + (project.name.length > 12 ? '...' : ''),
    progresso: project.progress || 0,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard Team Leader</h1>
        <p className="text-muted-foreground mt-1">Gestisci il tuo team e i progetti</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Membri Team</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.teamMembers}</div>
            <p className="text-xs text-muted-foreground">
              utenti attivi
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Progetti Attivi</CardTitle>
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeProjects}</div>
            <p className="text-xs text-muted-foreground">
              {stats.projectsInProgress} in corso
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ore Pianificate</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalPlannedHours.toFixed(0)}h</div>
            <p className="text-xs text-muted-foreground">
              questa settimana
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ore Confermate</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalConfirmedHours.toFixed(0)}h</div>
            <p className="text-xs text-muted-foreground">
              {completionRate}% completamento
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Weekly Calendar Compact */}
      {weeklyCalendar.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Calendario Settimanale
            </CardTitle>
            <CardDescription>Distribuzione carico di lavoro della settimana</CardDescription>
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
                      isToday ? 'border-primary bg-primary/5' : 'border-border'
                    } ${hasActivities ? 'hover:bg-muted/50' : ''}`}
                  >
                    <div className={`text-xs font-medium ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>
                      {day.day}
                    </div>
                    <div className={`text-sm font-bold mt-1 ${isToday ? 'text-primary' : ''}`}>
                      {day.date}
                    </div>
                    <div className="mt-2 space-y-1">
                      <div className="text-lg font-bold">{day.planned}h</div>
                      <div className="text-xs text-muted-foreground">
                        {day.confirmed}h conf.
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {day.activities} att.
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
              <CardTitle>Ore per Membro</CardTitle>
              <CardDescription>Pianificate vs Confermate</CardDescription>
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

        {/* Project Progress Chart */}
        {projectProgressData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Avanzamento Progetti</CardTitle>
              <CardDescription>Percentuale completamento</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[200px]">
                <BarChart data={projectProgressData} layout="vertical">
                  <XAxis type="number" domain={[0, 100]} />
                  <YAxis type="category" dataKey="name" width={80} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="progresso" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Team Workload Detail */}
      <Card>
        <CardHeader>
          <CardTitle>Carico di Lavoro Team</CardTitle>
          <CardDescription>Ore pianificate vs confermate per membro</CardDescription>
        </CardHeader>
        <CardContent>
          {teamWorkload.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nessun dato disponibile</p>
          ) : (
            <div className="space-y-4">
              {teamWorkload.slice(0, 5).map((member) => {
                const completionRate = member.planned_hours > 0 
                  ? (member.confirmed_hours / member.planned_hours) * 100 
                  : 0;
                return (
                  <div key={member.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{member.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {member.confirmed_hours.toFixed(1)}h / {member.planned_hours.toFixed(1)}h
                      </span>
                    </div>
                    <Progress value={Math.min(completionRate, 100)} className="h-2" />
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Projects */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Progetti del Team</CardTitle>
            <CardDescription>Progetti su cui sta lavorando il team</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/projects')}>
            Vedi tutti <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          {recentProjects.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nessun progetto</p>
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
                    {project.progress !== undefined && (
                      <span className="text-sm text-muted-foreground">{project.progress}%</span>
                    )}
                    {project.project_status && (
                      <Badge variant="outline">
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
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Button variant="outline" className="h-auto py-4 flex flex-col gap-2" onClick={() => navigate('/calendar')}>
              <Calendar className="h-5 w-5" />
              <span className="text-sm">Calendario</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex flex-col gap-2" onClick={() => navigate('/projects')}>
              <FolderOpen className="h-5 w-5" />
              <span className="text-sm">Progetti</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex flex-col gap-2" onClick={() => navigate('/budgets')}>
              <Clock className="h-5 w-5" />
              <span className="text-sm">Budget</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
