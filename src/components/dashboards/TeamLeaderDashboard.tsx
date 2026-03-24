import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { startOfWeek, endOfWeek, addWeeks, format } from 'date-fns';
import { it } from 'date-fns/locale';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { 
  Users, 
  FolderOpen, 
  Clock,
  ArrowRight,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  ArrowUpDown,
  Euro,
  Rocket,
  FileText
} from 'lucide-react';
import { formatHours } from '@/lib/utils';
import { calculateSafeHours } from '@/lib/timeUtils';
import { supabase } from '@/integrations/supabase/client';
import { TeamMemberActivitiesDialog } from './TeamMemberActivitiesDialog';
import { ProjectsNearDeadlineWidget } from './ProjectsNearDeadlineWidget';
import { WeeklyUpdatesWidget } from './WeeklyUpdatesWidget';

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
  total_budget?: number | null;
  end_date?: string | null;
  start_date?: string | null;
}

interface ProjectNearDeadline {
  id: string;
  name: string;
  client_name?: string;
  end_date: string;
  progress?: number;
  project_status?: string;
}

interface TeamMemberProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  area: string | null;
  contract_hours: number | null;
  contract_hours_period: string | null;
}

interface TeamLeaderDashboardProps {
  stats: {
    teamMembers: number;
    activeProjects: number;
    totalPlannedHours: number;
    totalConfirmedHours: number;
    projectsInProgress: number;
    startingProjects: number;
    completedYearRevenue: number;
    totalBudgetValue: number;
  };
  teamWorkload: TeamMember[];
  recentProjects: Project[];
  projectsNearDeadline?: ProjectNearDeadline[];
  startingProjectsList?: Project[];
  closingProjectsList?: Project[];
  userName?: string;
  hideHeader?: boolean;
  dateFrom?: Date;
  dateTo?: Date;
  teamMemberProfiles?: TeamMemberProfile[];
}

type SortOption = 'name' | 'workload_desc' | 'workload_asc' | 'available_desc' | 'available_asc';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);
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

// Extracted Team Section component
export const TeamLeaderTeamSection = ({ stats, teamWorkload, teamMemberProfiles = [] }: Pick<TeamLeaderDashboardProps, 'stats' | 'teamWorkload' | 'teamMemberProfiles'>) => {
  const [showAllMembers, setShowAllMembers] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('workload_desc');
  const [selectedMember, setSelectedMember] = useState<{ id: string; name: string } | null>(null);
  const [workloadWeekOffset, setWorkloadWeekOffset] = useState(0);

  const workloadWeekStart = useMemo(() => startOfWeek(addWeeks(new Date(), workloadWeekOffset), { weekStartsOn: 1 }), [workloadWeekOffset]);
  const workloadWeekEnd = useMemo(() => endOfWeek(addWeeks(new Date(), workloadWeekOffset), { weekStartsOn: 1 }), [workloadWeekOffset]);

  const calculateCapacityHours = (contractHours: number, contractPeriod: string, start: Date, end: Date): number => {
    let businessDays = 0;
    const current = new Date(start);
    while (current <= end) {
      const dayOfWeek = current.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) businessDays++;
      current.setDate(current.getDate() + 1);
    }
    switch (contractPeriod) {
      case 'daily': return contractHours * businessDays;
      case 'weekly': return contractHours * (businessDays / 5);
      case 'monthly': return contractHours * (businessDays / 22);
      default: return contractHours * (businessDays / 22);
    }
  };

  const { data: weeklyWorkload } = useQuery({
    queryKey: ['team-leader-workload-week', workloadWeekStart.toISOString(), teamMemberProfiles.map(p => p.id).join(',')],
    queryFn: async () => {
      const memberIds = teamMemberProfiles.map(p => p.id);
      if (memberIds.length === 0) return [];
      const fromStr = format(workloadWeekStart, 'yyyy-MM-dd');
      const toStr = format(workloadWeekEnd, 'yyyy-MM-dd');
      let timeEntries: any[] = [];
      const pageSize = 1000;
      let offset = 0;
      let hasMore = true;
      while (hasMore) {
        const { data, error } = await supabase
          .from('activity_time_tracking')
          .select('user_id, scheduled_start_time, scheduled_end_time, actual_start_time, actual_end_time, scheduled_date')
          .gte('scheduled_date', fromStr)
          .lte('scheduled_date', toStr)
          .in('user_id', memberIds)
          .order('id')
          .range(offset, offset + pageSize - 1);
        if (error) { hasMore = false; }
        else if (data && data.length > 0) { timeEntries = timeEntries.concat(data); offset += pageSize; hasMore = data.length === pageSize; }
        else { hasMore = false; }
      }
      const userHours: Record<string, { planned: number; confirmed: number }> = {};
      timeEntries.forEach(e => {
        if (!userHours[e.user_id]) userHours[e.user_id] = { planned: 0, confirmed: 0 };
        if (e.scheduled_start_time && e.scheduled_end_time) {
          userHours[e.user_id].planned += calculateSafeHours(e.scheduled_start_time, e.scheduled_end_time, true);
        }
        if (e.actual_start_time && e.actual_end_time && e.scheduled_start_time && e.scheduled_end_time) {
          userHours[e.user_id].confirmed += calculateSafeHours(e.scheduled_start_time, e.scheduled_end_time, true);
        }
      });
      return teamMemberProfiles.map(p => {
        const name = `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Utente';
        const capacity = calculateCapacityHours(p.contract_hours || 0, p.contract_hours_period || 'monthly', workloadWeekStart, workloadWeekEnd);
        const hours = userHours[p.id] || { planned: 0, confirmed: 0 };
        return { id: p.id, name, planned_hours: hours.planned, confirmed_hours: hours.confirmed, capacity_hours: capacity } as TeamMember;
      });
    },
    enabled: teamMemberProfiles.length > 0
  });

  const effectiveWorkload = weeklyWorkload || teamWorkload;

  const avgUtilization = useMemo(() => {
    const membersWithCapacity = effectiveWorkload.filter(m => (m.capacity_hours || 0) > 0);
    if (membersWithCapacity.length === 0) return 0;
    const totalUtilization = membersWithCapacity.reduce((sum, m) => sum + (m.planned_hours / (m.capacity_hours || 1)) * 100, 0);
    return Math.round(totalUtilization / membersWithCapacity.length);
  }, [effectiveWorkload]);

  const totalAvailableHours = useMemo(() => {
    return effectiveWorkload.reduce((sum, m) => sum + Math.max(0, (m.capacity_hours || 0) - m.planned_hours), 0);
  }, [effectiveWorkload]);

  const sortedTeamWorkload = useMemo(() => {
    return [...effectiveWorkload].sort((a, b) => {
      const aCapacity = a.capacity_hours || 0;
      const bCapacity = b.capacity_hours || 0;
      const aUtilization = aCapacity > 0 ? (a.planned_hours / aCapacity) * 100 : 0;
      const bUtilization = bCapacity > 0 ? (b.planned_hours / bCapacity) * 100 : 0;
      const aAvailable = Math.max(0, aCapacity - a.planned_hours);
      const bAvailable = Math.max(0, bCapacity - b.planned_hours);
      switch (sortBy) {
        case 'name': return a.name.localeCompare(b.name);
        case 'workload_desc': return bUtilization - aUtilization;
        case 'workload_asc': return aUtilization - bUtilization;
        case 'available_desc': return bAvailable - aAvailable;
        case 'available_asc': return aAvailable - bAvailable;
        default: return 0;
      }
    });
  }, [effectiveWorkload, sortBy]);

  const overloadedMembers = effectiveWorkload.filter(m => {
    const capacity = m.capacity_hours || 0;
    return capacity > 0 && (m.planned_hours / capacity) * 100 >= 120;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Users className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Team</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            <CardTitle className="text-sm font-medium">Utilizzo medio</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent variant="stats">
            <div className="text-2xl font-bold">{avgUtilization}%</div>
            <p className="text-xs text-muted-foreground">carico di lavoro</p>
          </CardContent>
        </Card>
        <Card variant="stats">
          <CardHeader variant="stats">
            <CardTitle className="text-sm font-medium">Ore disponibili</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent variant="stats">
            <div className="text-2xl font-bold">{formatHours(totalAvailableHours)}</div>
            <p className="text-xs text-muted-foreground">ore libere nel team</p>
          </CardContent>
        </Card>
      </div>
      {overloadedMembers.length > 0 && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="py-3">
            <div className="flex items-center gap-2 text-destructive text-sm">
              <AlertTriangle className="h-4 w-4" />
              <span><strong>{overloadedMembers.length}</strong> membri sovraccarichi (≥120%): {overloadedMembers.map(m => m.name).join(', ')}</span>
            </div>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Carico di Lavoro</CardTitle>
              <CardDescription>
                Settimana: {format(workloadWeekStart, 'd MMM', { locale: it })} - {format(workloadWeekEnd, 'd MMM yyyy', { locale: it })}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWorkloadWeekOffset(prev => prev - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" className="h-8" onClick={() => setWorkloadWeekOffset(0)}>Oggi</Button>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWorkloadWeekOffset(prev => prev + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
              <SelectTrigger className="w-[200px] h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="workload_desc">Carico ↓</SelectItem>
                <SelectItem value="workload_asc">Carico ↑</SelectItem>
                <SelectItem value="available_desc">Ore libere ↓</SelectItem>
                <SelectItem value="available_asc">Ore libere ↑</SelectItem>
                <SelectItem value="name">Nome</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {sortedTeamWorkload.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nessun membro nel team</p>
          ) : (
            <div className="space-y-3">
              {(showAllMembers ? sortedTeamWorkload : sortedTeamWorkload.slice(0, 5)).map((member) => {
                const capacity = member.capacity_hours || 0;
                const pct = capacity > 0 ? Math.round((member.planned_hours / capacity) * 100) : 0;
                const available = Math.max(0, capacity - member.planned_hours);
                return (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => setSelectedMember({ id: member.id, name: member.name })}
                  >
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-sm">{member.name}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{formatHours(member.planned_hours)} / {formatHours(capacity)}</span>
                          <Badge variant={pct >= 120 ? 'destructive' : pct >= 80 ? 'default' : 'secondary'} className="text-xs">{pct}%</Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Progress value={Math.min(pct, 100)} className="h-2 flex-1" />
                        <span className="text-xs text-muted-foreground whitespace-nowrap">{formatHours(available)} libere</span>
                      </div>
                    </div>
                  </div>
                );
              })}
              {sortedTeamWorkload.length > 5 && (
                <Button variant="ghost" size="sm" className="w-full" onClick={() => setShowAllMembers(!showAllMembers)}>
                  {showAllMembers ? <><ChevronUp className="mr-1 h-4 w-4" /> Mostra meno</> : <><ChevronDown className="mr-1 h-4 w-4" /> Mostra tutti ({sortedTeamWorkload.length})</>}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      <TeamMemberActivitiesDialog
        open={!!selectedMember}
        onOpenChange={(open) => !open && setSelectedMember(null)}
        memberId={selectedMember?.id || null}
        memberName={selectedMember?.name || ''}
        dateFrom={workloadWeekStart}
        dateTo={workloadWeekEnd}
      />
    </div>
  );
};

// Extracted Projects Section component
export const TeamLeaderProjectsSection = ({ stats, recentProjects, projectsNearDeadline = [], leaderAreas }: Pick<TeamLeaderDashboardProps, 'stats' | 'recentProjects' | 'projectsNearDeadline'> & { leaderAreas?: string[] }) => {
  const navigate = useNavigate();
  const now = new Date();
  const sevenDaysFromNow = new Date(now);
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

  const criticalProjects = projectsNearDeadline.filter(p => {
    const endDate = new Date(p.end_date);
    return endDate <= sevenDaysFromNow && (p.progress || 0) < 80;
  });

  // Count projects nearing completion (>= 85% progress)
  const closingProjects = recentProjects.filter(p => (p.progress || 0) >= 85);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <FolderOpen className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Progetti & Economia</h2>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card variant="stats">
          <CardHeader variant="stats">
            <CardTitle className="text-sm font-medium">Progetti aperti</CardTitle>
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent variant="stats">
            <div className="text-2xl font-bold">{stats.projectsInProgress}</div>
            <p className="text-xs text-muted-foreground">in corso</p>
          </CardContent>
        </Card>
        <Card variant="stats">
          <CardHeader variant="stats">
            <CardTitle className="text-sm font-medium">In partenza</CardTitle>
            <Rocket className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent variant="stats">
            <div className="text-2xl font-bold">{stats.startingProjects}</div>
            <p className="text-xs text-muted-foreground">da avviare</p>
          </CardContent>
        </Card>
        <Card variant="stats">
          <CardHeader variant="stats">
            <CardTitle className="text-sm font-medium">Budget totale</CardTitle>
            <Euro className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent variant="stats">
            <div className="text-2xl font-bold">{formatCurrency(stats.totalBudgetValue)}</div>
            <p className="text-xs text-muted-foreground">progetti attivi</p>
          </CardContent>
        </Card>
        <Card variant="stats">
          <CardHeader variant="stats">
            <CardTitle className="text-sm font-medium">Da fatturare</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent variant="stats">
            <div className="text-2xl font-bold">{stats.projectsToInvoice}</div>
            <p className="text-xs text-muted-foreground">progetti</p>
          </CardContent>
        </Card>
        <Card variant="stats">
          <CardHeader variant="stats">
            <CardTitle className="text-sm font-medium">In chiusura</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent variant="stats">
            <div className="text-2xl font-bold">{closingProjects.length}</div>
            <p className="text-xs text-muted-foreground">≥ 85% completati</p>
          </CardContent>
        </Card>
      </div>
      {criticalProjects.length > 0 && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4" />
              Progetti a rischio scadenza ({criticalProjects.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {criticalProjects.map(project => {
              const daysLeft = Math.ceil((new Date(project.end_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
              return (
                <div key={project.id} className="flex items-center justify-between p-3 rounded-lg border border-destructive/20 bg-background cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => navigate(`/projects/${project.id}/canvas`)}>
                  <div className="space-y-0.5">
                    <p className="font-medium text-sm">{project.name}</p>
                    {project.client_name && <p className="text-xs text-muted-foreground">{project.client_name}</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-destructive border-destructive/30">{project.progress || 0}%</Badge>
                    <span className="text-xs text-destructive font-medium">{daysLeft <= 0 ? 'Scaduto' : `${daysLeft}g rimasti`}</span>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
      <ProjectsNearDeadlineWidget projects={projectsNearDeadline} />
      <WeeklyUpdatesWidget filterAreas={leaderAreas} />
    </div>
  );
};

export const TeamLeaderDashboard = ({ stats, teamWorkload, recentProjects, projectsNearDeadline = [], userName, hideHeader = false, dateFrom, dateTo, teamMemberProfiles = [] }: TeamLeaderDashboardProps) => {
  const navigate = useNavigate();
  const [showAllMembers, setShowAllMembers] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('workload_desc');
  const [selectedMember, setSelectedMember] = useState<{ id: string; name: string } | null>(null);
  const [workloadWeekOffset, setWorkloadWeekOffset] = useState(0);

  // Workload week dates
  const workloadWeekStart = useMemo(() => startOfWeek(addWeeks(new Date(), workloadWeekOffset), { weekStartsOn: 1 }), [workloadWeekOffset]);
  const workloadWeekEnd = useMemo(() => endOfWeek(addWeeks(new Date(), workloadWeekOffset), { weekStartsOn: 1 }), [workloadWeekOffset]);

  // Helper to calculate capacity hours based on contract
  const calculateCapacityHours = (contractHours: number, contractPeriod: string, start: Date, end: Date): number => {
    let businessDays = 0;
    const current = new Date(start);
    while (current <= end) {
      const dayOfWeek = current.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) businessDays++;
      current.setDate(current.getDate() + 1);
    }
    switch (contractPeriod) {
      case 'daily': return contractHours * businessDays;
      case 'weekly': return contractHours * (businessDays / 5);
      case 'monthly': return contractHours * (businessDays / 22);
      default: return contractHours * (businessDays / 22);
    }
  };

  // Independent workload query for the selected week
  const { data: weeklyWorkload } = useQuery({
    queryKey: ['team-leader-workload-week', workloadWeekStart.toISOString(), teamMemberProfiles.map(p => p.id).join(',')],
    queryFn: async () => {
      const memberIds = teamMemberProfiles.map(p => p.id);
      if (memberIds.length === 0) return [];

      const fromStr = format(workloadWeekStart, 'yyyy-MM-dd');
      const toStr = format(workloadWeekEnd, 'yyyy-MM-dd');

      let timeEntries: any[] = [];
      const pageSize = 1000;
      let offset = 0;
      let hasMore = true;
      while (hasMore) {
        const { data, error } = await supabase
          .from('activity_time_tracking')
          .select('user_id, scheduled_start_time, scheduled_end_time, actual_start_time, actual_end_time, scheduled_date')
          .gte('scheduled_date', fromStr)
          .lte('scheduled_date', toStr)
          .in('user_id', memberIds)
          .order('id')
          .range(offset, offset + pageSize - 1);
        if (error) { hasMore = false; }
        else if (data && data.length > 0) { timeEntries = timeEntries.concat(data); offset += pageSize; hasMore = data.length === pageSize; }
        else { hasMore = false; }
      }

      const userHours: Record<string, { planned: number; confirmed: number }> = {};
      timeEntries.forEach(e => {
        if (!userHours[e.user_id]) userHours[e.user_id] = { planned: 0, confirmed: 0 };
        if (e.scheduled_start_time && e.scheduled_end_time) {
          userHours[e.user_id].planned += calculateSafeHours(e.scheduled_start_time, e.scheduled_end_time, true);
        }
        if (e.actual_start_time && e.actual_end_time && e.scheduled_start_time && e.scheduled_end_time) {
          userHours[e.user_id].confirmed += calculateSafeHours(e.scheduled_start_time, e.scheduled_end_time, true);
        }
      });

      return teamMemberProfiles.map(p => {
        const name = `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Utente';
        const capacity = calculateCapacityHours(p.contract_hours || 0, p.contract_hours_period || 'monthly', workloadWeekStart, workloadWeekEnd);
        const hours = userHours[p.id] || { planned: 0, confirmed: 0 };
        return {
          id: p.id,
          name,
          planned_hours: hours.planned,
          confirmed_hours: hours.confirmed,
          capacity_hours: capacity
        } as TeamMember;
      });
    },
    enabled: teamMemberProfiles.length > 0
  });

  // Use weekly workload data if available, otherwise fall back to props
  const effectiveWorkload = weeklyWorkload || teamWorkload;

  // Computed team stats
  const avgUtilization = useMemo(() => {
    const membersWithCapacity = effectiveWorkload.filter(m => (m.capacity_hours || 0) > 0);
    if (membersWithCapacity.length === 0) return 0;
    const totalUtilization = membersWithCapacity.reduce((sum, m) => {
      return sum + (m.planned_hours / (m.capacity_hours || 1)) * 100;
    }, 0);
    return Math.round(totalUtilization / membersWithCapacity.length);
  }, [effectiveWorkload]);

  const totalAvailableHours = useMemo(() => {
    return effectiveWorkload.reduce((sum, m) => {
      return sum + Math.max(0, (m.capacity_hours || 0) - m.planned_hours);
    }, 0);
  }, [effectiveWorkload]);

  // Sort team members
  const sortedTeamWorkload = useMemo(() => {
    return [...effectiveWorkload].sort((a, b) => {
      const aCapacity = a.capacity_hours || 0;
      const bCapacity = b.capacity_hours || 0;
      const aUtilization = aCapacity > 0 ? (a.planned_hours / aCapacity) * 100 : 0;
      const bUtilization = bCapacity > 0 ? (b.planned_hours / bCapacity) * 100 : 0;
      const aAvailable = Math.max(0, aCapacity - a.planned_hours);
      const bAvailable = Math.max(0, bCapacity - b.planned_hours);

      switch (sortBy) {
        case 'name': return a.name.localeCompare(b.name);
        case 'workload_desc': return bUtilization - aUtilization;
        case 'workload_asc': return aUtilization - bUtilization;
        case 'available_desc': return bAvailable - aAvailable;
        case 'available_asc': return aAvailable - bAvailable;
        default: return 0;
      }
    });
  }, [effectiveWorkload, sortBy]);

  // Critical alerts
  const now = new Date();
  const sevenDaysFromNow = new Date(now);
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

  const criticalProjects = projectsNearDeadline.filter(p => {
    const endDate = new Date(p.end_date);
    return endDate <= sevenDaysFromNow && (p.progress || 0) < 80;
  });

  const overloadedMembers = effectiveWorkload.filter(m => {
    const capacity = m.capacity_hours || 0;
    return capacity > 0 && (m.planned_hours / capacity) * 100 >= 120;
  });

  return (
    <div className="space-y-8">
      {!hideHeader && (
        <div>
          <h1 className="text-3xl font-bold text-foreground">Ciao{userName ? ` ${userName}` : ''}</h1>
          <p className="text-muted-foreground mt-1">Gestisci il tuo team e i progetti</p>
        </div>
      )}

      {/* ========== SECTION 1: TEAM ========== */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Team</h2>
        </div>

        {/* Team KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              <CardTitle className="text-sm font-medium">Utilizzo medio</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent variant="stats">
              <div className={`text-2xl font-bold ${avgUtilization >= 120 ? 'text-destructive' : avgUtilization >= 90 ? 'text-warning' : ''}`}>
                {avgUtilization}%
              </div>
              <p className="text-xs text-muted-foreground">pianificato / capacità</p>
            </CardContent>
          </Card>

          <Card variant="stats">
            <CardHeader variant="stats">
              <CardTitle className="text-sm font-medium">Ore disponibili</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent variant="stats">
              <div className="text-2xl font-bold">{formatHours(totalAvailableHours)}</div>
              <p className="text-xs text-muted-foreground">ore libere nel team</p>
            </CardContent>
          </Card>
        </div>

        {/* Overloaded Members Alert */}
        {overloadedMembers.length > 0 && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4" />
                Membri sovraccarichi ({overloadedMembers.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
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
            </CardContent>
          </Card>
        )}

        {/* Team Workload Table */}
        <Card>
          <CardHeader className="space-y-3">
            <div className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Carico di lavoro</CardTitle>
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
                {effectiveWorkload.length > 5 && (
                  <Button variant="ghost" size="sm" onClick={() => setShowAllMembers(!showAllMembers)}>
                    {showAllMembers ? (
                      <>Mostra meno <ChevronUp className="ml-1 h-4 w-4" /></>
                    ) : (
                      <>Tutti ({effectiveWorkload.length}) <ChevronDown className="ml-1 h-4 w-4" /></>
                    )}
                  </Button>
                )}
              </div>
            </div>
            {/* Week Navigation */}
            <div className="flex items-center justify-center gap-3">
              <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setWorkloadWeekOffset(prev => prev - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <button 
                className="text-sm font-medium text-foreground hover:text-primary transition-colors cursor-pointer"
                onClick={() => setWorkloadWeekOffset(0)}
              >
                {format(workloadWeekStart, 'd MMM', { locale: it })} – {format(workloadWeekEnd, 'd MMM yyyy', { locale: it })}
                {workloadWeekOffset === 0 && <span className="ml-1.5 text-xs text-muted-foreground">(questa settimana)</span>}
              </button>
              <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setWorkloadWeekOffset(prev => prev + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {effectiveWorkload.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nessun dato disponibile</p>
            ) : (
              <div className="space-y-3">
                {(showAllMembers ? sortedTeamWorkload : sortedTeamWorkload.slice(0, 5)).map((member) => {
                  const capacity = member.capacity_hours || 0;
                  const pct = capacity > 0 ? Math.round((member.planned_hours / capacity) * 100) : 0;
                  const clampedPct = Math.min(pct, 100);

                  const getBarColor = (p: number) => {
                    if (p > 100) return 'bg-destructive';
                    if (p >= 80) return 'bg-amber-500';
                    if (p < 50) return 'bg-blue-400';
                    return 'bg-primary';
                  };
                  const getTextColor = (p: number) => {
                    if (p > 100) return 'text-destructive';
                    if (p >= 80) return 'text-amber-600';
                    if (p < 50) return 'text-blue-500';
                    return 'text-foreground';
                  };
                  
                  return (
                    <div 
                      key={member.id} 
                      className="space-y-1 p-2 -mx-2 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => setSelectedMember({ id: member.id, name: member.name })}
                    >
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-medium truncate">{member.name}</span>
                          {pct > 100 && (
                            <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">Sovraccarico</Badge>
                          )}
                          {pct < 50 && capacity > 0 && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-blue-500 border-blue-300">Scarico</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs whitespace-nowrap ml-2">
                          <span className="text-muted-foreground">
                            {formatHours(member.planned_hours)}/{capacity > 0 ? formatHours(capacity) : '-'}
                          </span>
                          <span className={`font-semibold w-10 text-right ${getTextColor(pct)}`}>{pct}%</span>
                        </div>
                      </div>
                      <Progress 
                        value={clampedPct} 
                        className="h-2"
                        indicatorClassName={getBarColor(pct)}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* ========== SECTION 2: PROJECTS & ECONOMY ========== */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <FolderOpen className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Progetti & Economia</h2>
        </div>

        {/* Projects & Economy KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card variant="stats">
            <CardHeader variant="stats">
              <CardTitle className="text-sm font-medium">Progetti aperti</CardTitle>
              <FolderOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent variant="stats">
              <div className="text-2xl font-bold">{stats.projectsInProgress}</div>
              <p className="text-xs text-muted-foreground">in corso</p>
            </CardContent>
          </Card>

          <Card variant="stats">
            <CardHeader variant="stats">
              <CardTitle className="text-sm font-medium">In partenza</CardTitle>
              <Rocket className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent variant="stats">
              <div className="text-2xl font-bold">{stats.startingProjects}</div>
              <p className="text-xs text-muted-foreground">da avviare</p>
            </CardContent>
          </Card>

          <Card variant="stats">
            <CardHeader variant="stats">
              <CardTitle className="text-sm font-medium">Budget totale</CardTitle>
              <Euro className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent variant="stats">
              <div className="text-2xl font-bold">{formatCurrency(stats.totalBudgetValue)}</div>
              <p className="text-xs text-muted-foreground">progetti attivi</p>
            </CardContent>
          </Card>

          <Card variant="stats">
            <CardHeader variant="stats">
              <CardTitle className="text-sm font-medium">Da fatturare</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent variant="stats">
              <div className="text-2xl font-bold">{stats.projectsToInvoice}</div>
              <p className="text-xs text-muted-foreground">progetti</p>
            </CardContent>
          </Card>
        </div>

        {/* Critical Projects Alert */}
        {criticalProjects.length > 0 && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4" />
                Progetti a rischio scadenza ({criticalProjects.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
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
            </CardContent>
          </Card>
        )}

        {/* Projects Near Deadline Widget */}
        <ProjectsNearDeadlineWidget projects={projectsNearDeadline} />

        {/* Enriched Project List */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Progetti del Team</CardTitle>
              <CardDescription>Progetti aperti e in partenza nell'area</CardDescription>
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
                {recentProjects.map((project) => (
                  <div 
                    key={project.id} 
                    className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => navigate(`/projects/${project.id}/canvas`)}
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <p className="font-medium truncate">{project.name}</p>
                      {project.client_name && (
                        <p className="text-sm text-muted-foreground">{project.client_name}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                      {project.total_budget != null && project.total_budget > 0 && (
                        <span className="text-sm font-medium">{formatCurrency(project.total_budget)}</span>
                      )}
                      {project.progress !== undefined && (
                        <span className="text-sm text-muted-foreground">{project.progress}%</span>
                      )}
                      {project.end_date && (
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(project.end_date).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}
                        </span>
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
      </div>

      {/* Member Activities Dialog */}
      <TeamMemberActivitiesDialog
        open={!!selectedMember}
        onOpenChange={(open) => !open && setSelectedMember(null)}
        memberId={selectedMember?.id || null}
        memberName={selectedMember?.name || ''}
        dateFrom={workloadWeekStart}
        dateTo={workloadWeekEnd}
      />
    </div>
  );
};
