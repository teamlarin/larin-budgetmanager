import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Clock, 
  Calendar,
  CheckCircle,
  ArrowRight,
  FolderOpen,
  TrendingUp,
  Crown,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, PieChart, Pie, Cell, LineChart, Line, ReferenceLine } from 'recharts';
import { formatHours } from '@/lib/utils';

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

interface ProductivityTrendPoint {
  month: string;
  productivity: number;
  target: number;
}

interface MonthlyHoursPoint {
  month: string;
  plannedHours: number;
  confirmedHours: number;
}

interface LeaderProject {
  id: string;
  name: string;
  client_name?: string;
  progress?: number;
  project_status?: string;
  end_date?: string;
}

interface WeeklyCalendarDay {
  day: string;
  date: string;
  planned: number;
  confirmed: number;
  activities: number;
  isToday?: boolean;
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
    billableHours: number;
    totalHours: number;
    actualProductivity: number;
    targetProductivity: number;
  };
  todayActivities: Activity[];
  upcomingActivities: Activity[];
  weeklyHoursByProject: ProjectHours[];
  confirmedHoursByCategory: CategoryHours[];
  productivityTrend?: ProductivityTrendPoint[];
  monthlyHoursTrend?: MonthlyHoursPoint[];
  weeklyCalendar?: WeeklyCalendarDay[];
  weekOffset?: number;
  onWeekChange?: (offset: number) => void;
  weekDateRange?: string;
  leaderProjects?: LeaderProject[];
  userName?: string;
  onLeaderProjectProgressUpdate?: (projectId: string, newProgress: number) => void;
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

export const MemberDashboard = ({ stats, todayActivities, upcomingActivities, weeklyHoursByProject, confirmedHoursByCategory, productivityTrend, monthlyHoursTrend, weeklyCalendar, weekOffset = 0, onWeekChange, weekDateRange, leaderProjects, userName, onLeaderProjectProgressUpdate }: MemberDashboardProps) => {
  const navigate = useNavigate();
  const [editingProjectProgress, setEditingProjectProgress] = useState<string | null>(null);
  const [tempProgress, setTempProgress] = useState<number>(0);

  const handleProgressSave = async (projectId: string) => {
    const newProgress = Math.max(0, Math.min(100, tempProgress));
    
    const { error } = await supabase
      .from('projects')
      .update({ progress: newProgress })
      .eq('id', projectId);

    if (error) {
      toast.error('Errore nell\'aggiornamento del progresso');
      console.error('Error updating progress:', error);
    } else {
      toast.success('Progresso aggiornato');
      onLeaderProjectProgressUpdate?.(projectId, newProgress);
    }
    setEditingProjectProgress(null);
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'aperto':
        return <Badge variant="default" className="bg-primary">Aperto</Badge>;
      case 'in_partenza':
        return <Badge variant="secondary">In Partenza</Badge>;
      case 'chiuso':
        return <Badge variant="outline">Chiuso</Badge>;
      case 'sospeso':
        return <Badge variant="destructive">Sospeso</Badge>;
      default:
        return <Badge variant="outline">{status || 'N/A'}</Badge>;
    }
  };

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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card variant="stats">
          <CardHeader variant="stats">
            <CardTitle className="text-sm font-medium">Ore Oggi</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent variant="stats">
            <div className="text-2xl font-bold">{formatHours(stats.todayPlannedHours)}</div>
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
              {formatHours(stats.weekConfirmedHours)}
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
              {formatHours(stats.weekPlannedHours)} pianificate
            </p>
          </CardContent>
        </Card>

        <Card variant="stats">
          <CardHeader variant="stats">
            <CardTitle className="text-sm font-medium">Progetti Assegnati</CardTitle>
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent variant="stats">
            <div className="text-2xl font-bold">{stats.assignedProjects}</div>
            <p className="text-xs text-muted-foreground">
              progetti attivi
            </p>
          </CardContent>
        </Card>

        <Card variant="stats">
          <CardHeader variant="stats">
            <CardTitle className="text-sm font-medium">Attività da Fare</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent variant="stats">
            <div className="text-2xl font-bold">{stats.pendingActivities}</div>
            <p className="text-xs text-muted-foreground">
              da completare
            </p>
          </CardContent>
        </Card>

        <Card variant="stats" className={stats.actualProductivity >= stats.targetProductivity ? 'border-primary/50' : stats.actualProductivity >= stats.targetProductivity * 0.8 ? 'border-warning/50' : 'border-destructive/50'}>
          <CardHeader variant="stats">
            <CardTitle className="text-sm font-medium">Produttività Billable</CardTitle>
            <TrendingUp className={`h-4 w-4 ${stats.actualProductivity >= stats.targetProductivity ? 'text-primary' : stats.actualProductivity >= stats.targetProductivity * 0.8 ? 'text-warning' : 'text-destructive'}`} />
          </CardHeader>
          <CardContent variant="stats">
            <div className="flex items-baseline gap-1">
              <span className={`text-2xl font-bold ${stats.actualProductivity >= stats.targetProductivity ? 'text-primary' : stats.actualProductivity >= stats.targetProductivity * 0.8 ? 'text-warning' : 'text-destructive'}`}>
                {stats.actualProductivity}%
              </span>
              <span className="text-sm text-muted-foreground">/ {stats.targetProductivity}%</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Progress 
                value={Math.min((stats.actualProductivity / stats.targetProductivity) * 100, 100)} 
                className="h-2 flex-1" 
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {formatHours(stats.billableHours)} billable / {formatHours(stats.totalHours)} totali
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
                      label={({ hours }) => formatHours(hours)}
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
                      <span className="text-muted-foreground font-medium">{formatHours(entry.hours)}</span>
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

      {/* Trend Charts Row */}
      {(productivityTrend && productivityTrend.length > 0) || (monthlyHoursTrend && monthlyHoursTrend.length > 0) ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Productivity Trend Chart */}
          {productivityTrend && productivityTrend.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Trend Produttività Billable
                </CardTitle>
                <CardDescription>Andamento ultimi 6 mesi vs target ({stats.targetProductivity}%)</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[200px]">
                  <LineChart data={productivityTrend}>
                    <XAxis dataKey="month" />
                    <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                    <ChartTooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-popover border rounded-lg p-2 shadow-md">
                              <p className="font-medium">{payload[0]?.payload?.month}</p>
                              <p className="text-sm">Produttività: <span className="font-bold">{payload[0]?.value}%</span></p>
                              <p className="text-sm text-muted-foreground">Target: {stats.targetProductivity}%</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <ReferenceLine y={stats.targetProductivity} stroke="hsl(var(--muted-foreground))" strokeDasharray="5 5" />
                    <Line 
                      type="monotone" 
                      dataKey="productivity" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ChartContainer>
                <div className="mt-3 flex gap-4 justify-center text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-0.5 bg-primary" />
                    <span>Produttività effettiva</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-0.5 border-t-2 border-dashed border-muted-foreground" />
                    <span>Target ({stats.targetProductivity}%)</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Monthly Hours Trend Chart */}
          {monthlyHoursTrend && monthlyHoursTrend.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Andamento Ore Mensili
                </CardTitle>
                <CardDescription>Ore pianificate vs confermate ultimi 6 mesi</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[200px]">
                  <BarChart data={monthlyHoursTrend}>
                    <XAxis dataKey="month" />
                    <YAxis />
                    <ChartTooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-popover border rounded-lg p-2 shadow-md">
                              <p className="font-medium">{payload[0]?.payload?.month}</p>
                              <p className="text-sm">Pianificate: <span className="font-bold">{formatHours(payload[0]?.payload?.plannedHours || 0)}</span></p>
                              <p className="text-sm">Confermate: <span className="font-bold">{formatHours(payload[0]?.payload?.confirmedHours || 0)}</span></p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="plannedHours" name="Pianificate" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="confirmedHours" name="Confermate" fill="hsl(var(--secondary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
                <div className="mt-3 flex gap-4 justify-center text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                    <span>Pianificate</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-secondary" />
                    <span>Confermate</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      ) : null}

      {/* Weekly Calendar */}
      {weeklyCalendar && weeklyCalendar.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Pianificazione Settimanale
                {weekDateRange && (
                  <span className="text-sm font-normal text-muted-foreground ml-2">
                    ({weekDateRange})
                  </span>
                )}
              </CardTitle>
              <CardDescription>Panoramica delle tue attività pianificate</CardDescription>
            </div>
            {onWeekChange && (
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={() => onWeekChange(weekOffset - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => onWeekChange(0)}
                  disabled={weekOffset === 0}
                >
                  Oggi
                </Button>
                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={() => onWeekChange(weekOffset + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-2">
              {weeklyCalendar.map((day) => {
                const hasActivities = day.activities > 0;
                const completionRate = day.planned > 0 ? (day.confirmed / day.planned) * 100 : 0;
                
                return (
                  <div 
                    key={day.day + day.date} 
                    className={`p-3 rounded-lg border text-center transition-colors ${
                      day.isToday ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-border'
                    } ${hasActivities ? 'hover:bg-muted/50 cursor-pointer' : ''}`}
                    onClick={() => hasActivities && navigate('/calendar')}
                  >
                    <div className={`text-xs font-medium ${day.isToday ? 'text-primary' : 'text-muted-foreground'}`}>
                      {day.day}
                    </div>
                    <div className={`text-sm font-bold mt-1 ${day.isToday ? 'text-primary' : ''}`}>
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

      {/* Activities Row - Today and Upcoming side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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

      {/* Leader Projects Section */}
      {leaderProjects && leaderProjects.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>I Tuoi Progetti come Leader</CardTitle>
                <CardDescription>Progetti di cui sei responsabile</CardDescription>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/approved-projects')}>
              Vedi tutti <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {leaderProjects.slice(0, 5).map((project) => (
                <div 
                  key={project.id} 
                  className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => navigate(`/project/${project.id}`)}
                >
                  <div className="space-y-1 flex-1">
                    <p className="font-medium">{project.name}</p>
                    {project.client_name && (
                      <p className="text-sm text-muted-foreground">{project.client_name}</p>
                    )}
                  </div>
                    <div className="flex items-center gap-4">
                    {project.progress !== undefined && (
                      <div 
                        className="flex items-center gap-2 min-w-[120px]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {editingProjectProgress === project.id ? (
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              min={0}
                              max={100}
                              value={tempProgress}
                              onChange={(e) => setTempProgress(Number(e.target.value))}
                              className="w-16 h-7 text-sm"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleProgressSave(project.id);
                                if (e.key === 'Escape') setEditingProjectProgress(null);
                              }}
                              onBlur={() => handleProgressSave(project.id)}
                            />
                            <span className="text-sm text-muted-foreground">%</span>
                          </div>
                        ) : (
                          <div 
                            className="flex items-center gap-2 cursor-pointer hover:bg-muted rounded px-1 py-0.5"
                            onClick={() => {
                              setEditingProjectProgress(project.id);
                              setTempProgress(project.progress || 0);
                            }}
                            title="Clicca per modificare"
                          >
                            <Progress value={Math.min(project.progress, 100)} className="h-2 w-16" />
                            <span className="text-sm text-muted-foreground">{project.progress}%</span>
                          </div>
                        )}
                      </div>
                    )}
                    {project.end_date && (
                      <span className="text-sm text-muted-foreground">
                        {new Date(project.end_date).toLocaleDateString('it-IT')}
                      </span>
                    )}
                    {getStatusBadge(project.project_status)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  );
};
