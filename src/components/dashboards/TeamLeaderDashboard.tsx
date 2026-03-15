import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Users, 
  FolderOpen, 
  Clock,
  ArrowRight,
  Calendar,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  ArrowUpDown
} from 'lucide-react';
import { formatHours } from '@/lib/utils';
import { TeamMemberActivitiesDialog } from './TeamMemberActivitiesDialog';
import { ProjectsNearDeadlineWidget } from './ProjectsNearDeadlineWidget';

interface TeamMember {
  id: string;
  name: string;
  planned_hours: number;
  confirmed_hours: number;
  capacity_hours?: number;
}

interface Project {
  id: string;
  name: string;
  client_name?: string;
  progress?: number;
  project_status?: string;
}

interface ProjectNearDeadline {
  id: string;
  name: string;
  client_name?: string;
  end_date: string;
  progress?: number;
  project_status?: string;
}

interface WeeklyCalendarDay {
  day: string;
  date: string;
  fullDate?: string;
  planned: number;
  confirmed: number;
  activities: number;
  isToday?: boolean;
  dayActivities?: Array<{
    id: string;
    activity_name: string;
    project_name: string;
    scheduled_start_time: string | null;
    scheduled_end_time: string | null;
    is_confirmed: boolean;
  }>;
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
  projectsNearDeadline?: ProjectNearDeadline[];
  weeklyCalendar?: WeeklyCalendarDay[];
  weekOffset?: number;
  onWeekChange?: (offset: number) => void;
  weekDateRange?: string;
  userName?: string;
  hideHeader?: boolean;
  dateFrom?: Date;
  dateTo?: Date;
}

type SortOption = 'name' | 'workload_desc' | 'workload_asc' | 'available_desc' | 'available_asc';

export const TeamLeaderDashboard = ({ stats, teamWorkload, recentProjects, projectsNearDeadline = [], weeklyCalendar = [], weekOffset = 0, onWeekChange, weekDateRange, userName, hideHeader = false, dateFrom, dateTo }: TeamLeaderDashboardProps) => {
  const navigate = useNavigate();
  const [showAllMembers, setShowAllMembers] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('workload_desc');
  const [selectedMember, setSelectedMember] = useState<{ id: string; name: string } | null>(null);

  // Sort team members based on selected option
  const sortedTeamWorkload = useMemo(() => {
    return [...teamWorkload].sort((a, b) => {
      const aCapacity = a.capacity_hours || 0;
      const bCapacity = b.capacity_hours || 0;
      const aUtilization = aCapacity > 0 ? (a.planned_hours / aCapacity) * 100 : 0;
      const bUtilization = bCapacity > 0 ? (b.planned_hours / bCapacity) * 100 : 0;
      const aAvailable = Math.max(0, aCapacity - a.planned_hours);
      const bAvailable = Math.max(0, bCapacity - b.planned_hours);

      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'workload_desc':
          return bUtilization - aUtilization;
        case 'workload_asc':
          return aUtilization - bUtilization;
        case 'available_desc':
          return bAvailable - aAvailable;
        case 'available_asc':
          return aAvailable - bAvailable;
        default:
          return 0;
      }
    });
  }, [teamWorkload, sortBy]);

  const getProjectStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      'in_partenza': 'In Partenza',
      'aperto': 'Aperto',
      'da_fatturare': 'Da Fatturare',
      'completato': 'Completato'
    };
    return labels[status] || status;
  };

  const completionRate = stats.totalPlannedHours > 0 
    ? Math.round((stats.totalConfirmedHours / stats.totalPlannedHours) * 100) 
    : 0;

  // Critical alerts
  const now = new Date();
  const sevenDaysFromNow = new Date(now);
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

  const criticalProjects = projectsNearDeadline.filter(p => {
    const endDate = new Date(p.end_date);
    const progress = p.progress || 0;
    return endDate <= sevenDaysFromNow && progress < 80;
  });

  const overloadedMembers = teamWorkload.filter(m => {
    const capacity = m.capacity_hours || 0;
    return capacity > 0 && (m.planned_hours / capacity) * 100 >= 120;
  });

  const hasCriticalAlerts = criticalProjects.length > 0 || overloadedMembers.length > 0;

  return (
    <div className="space-y-6">
      {!hideHeader && (
        <div>
          <h1 className="text-3xl font-bold text-foreground">Ciao{userName ? ` ${userName}` : ''}</h1>
          <p className="text-muted-foreground mt-1">Gestisci il tuo team e i progetti</p>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card variant="stats">
          <CardHeader variant="stats">
            <CardTitle className="text-sm font-medium">Membri Team</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent variant="stats">
            <div className="text-2xl font-bold">{stats.teamMembers}</div>
            <p className="text-xs text-muted-foreground">utenti attivi</p>
          </CardContent>
        </Card>

        <Card variant="stats">
          <CardHeader variant="stats">
            <CardTitle className="text-sm font-medium">Progetti Attivi</CardTitle>
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent variant="stats">
            <div className="text-2xl font-bold">{stats.activeProjects}</div>
            <p className="text-xs text-muted-foreground">{stats.projectsInProgress} in corso</p>
          </CardContent>
        </Card>

        <Card variant="stats">
          <CardHeader variant="stats">
            <CardTitle className="text-sm font-medium">Ore pianificate</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent variant="stats">
            <div className="text-2xl font-bold">{formatHours(stats.totalPlannedHours)}</div>
            <p className="text-xs text-muted-foreground">questa settimana</p>
          </CardContent>
        </Card>

        <Card variant="stats">
          <CardHeader variant="stats">
            <CardTitle className="text-sm font-medium">Ore confermate</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent variant="stats">
            <div className="text-2xl font-bold">{formatHours(stats.totalConfirmedHours)}</div>
            <p className="text-xs text-muted-foreground">{completionRate}% completamento</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        <Button variant="outline" onClick={() => navigate('/calendar')}>
          <Calendar className="h-4 w-4 mr-2" />
          Vai al Calendario
        </Button>
        <Button variant="outline" onClick={() => navigate('/projects')}>
          <FolderOpen className="h-4 w-4 mr-2" />
          Vedi tutti i Progetti
        </Button>
      </div>

      {/* Critical Alerts */}
      {hasCriticalAlerts && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Situazioni critiche
            </CardTitle>
            <CardDescription>Elementi che richiedono attenzione immediata</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {criticalProjects.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Progetti a rischio scadenza</h4>
                <div className="space-y-2">
                  {criticalProjects.map(project => {
                    const daysLeft = Math.ceil((new Date(project.end_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                    return (
                      <div
                        key={project.id}
                        className="flex items-center justify-between p-3 rounded-lg border border-destructive/20 bg-background cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => navigate(`/projects/${project.id}/canvas`)}
                      >
                        <div className="space-y-0.5">
                          <p className="font-medium text-sm">{project.name}</p>
                          {project.client_name && (
                            <p className="text-xs text-muted-foreground">{project.client_name}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="text-destructive border-destructive/30">
                            {project.progress || 0}%
                          </Badge>
                          <span className="text-xs text-destructive font-medium">
                            {daysLeft <= 0 ? 'Scaduto' : `${daysLeft}g rimasti`}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {overloadedMembers.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Membri sovraccarichi</h4>
                <div className="space-y-2">
                  {overloadedMembers.map(member => {
                    const capacity = member.capacity_hours || 0;
                    const utilization = Math.round((member.planned_hours / capacity) * 100);
                    const excessHours = Math.round((member.planned_hours - capacity) * 10) / 10;
                    return (
                      <div
                        key={member.id}
                        className="flex items-center justify-between p-3 rounded-lg border border-destructive/20 bg-background cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => setSelectedMember({ id: member.id, name: member.name })}
                      >
                        <span className="font-medium text-sm">{member.name}</span>
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="text-destructive border-destructive/30">
                            {utilization}% carico
                          </Badge>
                          <span className="text-xs text-destructive font-medium">
                            +{formatHours(excessHours)} ore
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Weekly Calendar Compact */}
      {weeklyCalendar.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Calendario settimanale
                {weekDateRange && (
                  <span className="text-sm font-normal text-muted-foreground ml-2">
                    ({weekDateRange})
                  </span>
                )}
              </CardTitle>
              <CardDescription>Distribuzione carico di lavoro della settimana</CardDescription>
            </div>
            {onWeekChange && (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={() => onWeekChange(weekOffset - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => onWeekChange(0)} disabled={weekOffset === 0}>
                  Oggi
                </Button>
                <Button variant="outline" size="icon" onClick={() => onWeekChange(weekOffset + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-2">
              {weeklyCalendar.map((day) => {
                const hasActivities = day.activities > 0;
                const dayCompletionRate = day.planned > 0 ? (day.confirmed / day.planned) * 100 : 0;
                
                return (
                  <div 
                    key={day.day + day.date} 
                    className={`p-3 rounded-lg border text-center transition-colors ${
                      day.isToday ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-border'
                    } ${hasActivities ? 'hover:bg-muted/50' : ''}`}
                  >
                    <div className={`text-xs font-medium ${day.isToday ? 'text-primary' : 'text-muted-foreground'}`}>
                      {day.day}
                    </div>
                    <div className={`text-sm font-bold mt-1 ${day.isToday ? 'text-primary' : ''}`}>
                      {day.date}
                    </div>
                    <div className="mt-2 space-y-1">
                      <div className="text-lg font-bold">{formatHours(day.planned)}</div>
                      <div className="text-xs text-muted-foreground">{formatHours(day.confirmed)} conf.</div>
                      <div className="text-xs text-muted-foreground">{day.activities} att.</div>
                      {day.planned > 0 && (
                        <Progress value={Math.min(dayCompletionRate, 100)} className="h-1 mt-1" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Projects Near Deadline Widget */}
      <ProjectsNearDeadlineWidget projects={projectsNearDeadline} />

      {/* Team Workload Detail */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Carico di lavoro team</CardTitle>
            <CardDescription>Ore pianificate vs capacità per membro</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={sortBy} onValueChange={(value: SortOption) => setSortBy(value)}>
              <SelectTrigger className="w-[180px] h-8">
                <ArrowUpDown className="h-3.5 w-3.5 mr-2" />
                <SelectValue placeholder="Ordina per..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Nome</SelectItem>
                <SelectItem value="workload_desc">Carico ↓</SelectItem>
                <SelectItem value="workload_asc">Carico ↑</SelectItem>
                <SelectItem value="available_desc">Ore libere ↓</SelectItem>
                <SelectItem value="available_asc">Ore libere ↑</SelectItem>
              </SelectContent>
            </Select>
            {teamWorkload.length > 5 && (
              <Button variant="ghost" size="sm" onClick={() => setShowAllMembers(!showAllMembers)}>
                {showAllMembers ? (
                  <>Mostra meno <ChevronUp className="ml-1 h-4 w-4" /></>
                ) : (
                  <>Tutti ({teamWorkload.length}) <ChevronDown className="ml-1 h-4 w-4" /></>
                )}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {teamWorkload.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nessun dato disponibile</p>
          ) : (
            <div className="space-y-4">
              {(showAllMembers ? sortedTeamWorkload : sortedTeamWorkload.slice(0, 5)).map((member) => {
                const capacity = member.capacity_hours || 0;
                const utilizationRate = capacity > 0 ? (member.planned_hours / capacity) * 100 : 0;
                const availableHours = Math.max(0, capacity - member.planned_hours);
                const isOverloaded = utilizationRate > 100;
                
                return (
                  <div 
                    key={member.id} 
                    className="space-y-2 p-2 -mx-2 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => setSelectedMember({ id: member.id, name: member.name })}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{member.name}</span>
                        {isOverloaded && <AlertTriangle className="h-4 w-4 text-destructive" />}
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        {capacity > 0 && (
                          <span className={availableHours > 0 ? 'text-primary' : 'text-destructive'}>
                            {availableHours > 0 ? `${formatHours(availableHours)} libere` : 'Pieno'}
                          </span>
                        )}
                        <span className="text-muted-foreground">
                          {formatHours(member.planned_hours)} / {capacity > 0 ? formatHours(capacity) : '-'}
                        </span>
                      </div>
                    </div>
                    <Progress 
                      value={Math.min(utilizationRate, 100)} 
                      className={`h-2 ${isOverloaded ? '[&>div]:bg-destructive' : ''}`}
                    />
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

      {/* Member Activities Dialog */}
      <TeamMemberActivitiesDialog
        open={!!selectedMember}
        onOpenChange={(open) => !open && setSelectedMember(null)}
        memberId={selectedMember?.id || null}
        memberName={selectedMember?.name || ''}
        dateFrom={dateFrom || new Date()}
        dateTo={dateTo || new Date()}
      />
    </div>
  );
};
