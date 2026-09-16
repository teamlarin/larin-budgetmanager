import { useNavigate } from 'react-router-dom';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { it } from 'date-fns/locale';
import { useState, useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Calendar,
  ExternalLink,
  TrendingUp,
  Inbox,
  AlertTriangle,
  CheckCircle2,
  ListChecks,
  Clock,
  Target,
  ChevronDown,
  MoreHorizontal,
} from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { focusReasonSeverity, focusSeverityClasses, topFocusReasons } from '@/lib/focusSeverity';
import {
  useWeekFocusRows,
  useHoursToRecover,
  type FocusItem,
} from '@/hooks/useWeeklyFocus';
import { useCompleteMyTask } from '@/hooks/useMyTasks';
import { getAreaColor, getAreaLabel } from '@/lib/areaColors';
import { ProgressUpdateDialog } from '@/components/ProgressUpdateDialog';
import { MyTasksWidget } from './MyTasksWidget';

interface Activity {
  id: string;
  activity_name: string;
  project_name: string;
  scheduled_date?: string;
  scheduled_start_time?: string;
  scheduled_end_time?: string;
  is_confirmed: boolean;
}

interface Props {
  userId: string;
  userName?: string;
  todayActivities?: Activity[];
  /** Ore della settimana corrente, già calcolate a monte. */
  capacity?: {
    weekPlannedHours: number;
    weekConfirmedHours: number;
    weeklyContractHours: number;
  };
}

const BUCKET_META = {
  urgent: { label: '🔴 Urgente', className: 'border-l-4 border-l-destructive' },
  soon: { label: '🟡 Da tenere d’occhio', className: 'border-l-4 border-l-warning' },
  ongoing: { label: '🟢 In corso', className: 'border-l-4 border-l-primary' },
} as const;

const formatHours = (h: number) => `${Math.round(h * 10) / 10}h`;

export const WeeklyFocusView = ({ userId, userName, todayActivities = [], capacity }: Props) => {
  const navigate = useNavigate();
  const { rows: allRows, isLoading } = useWeekFocusRows(userId);
  const { data: recover } = useHoursToRecover(userId);
  const completeTask = useCompleteMyTask();
  const [progressDialog, setProgressDialog] = useState<FocusItem | null>(null);
  const [areaFilter, setAreaFilter] = useState<string>('all');
  const [showOngoing, setShowOngoing] = useState(false);
  const [showConfirmedToday, setShowConfirmedToday] = useState(false);

  const today = new Date();
  const todayKey = format(today, 'yyyy-MM-dd');
  const todaysList = useMemo(
    () =>
      [...todayActivities]
        .filter((a) => a.scheduled_date === todayKey)
        .sort((a, b) => (a.scheduled_start_time || '').localeCompare(b.scheduled_start_time || '')),
    [todayActivities, todayKey]
  );
  const hasUnconfirmedToday = todaysList.some((a) => !a.is_confirmed);
  const pendingToday = useMemo(() => todaysList.filter((a) => !a.is_confirmed), [todaysList]);
  const confirmedToday = useMemo(() => todaysList.filter((a) => a.is_confirmed), [todaysList]);

  const renderTodayRow = (activity: Activity) => (
    <div
      key={activity.id}
      className="flex items-center justify-between gap-3 flex-wrap text-sm border-b last:border-0 pb-1 last:pb-0"
    >
      <div className="min-w-0">
        <span className="font-medium">{activity.activity_name}</span>
        <span className="text-muted-foreground"> · {activity.project_name}</span>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {activity.scheduled_start_time && activity.scheduled_end_time && (
          <span className="text-xs text-muted-foreground">
            {activity.scheduled_start_time.substring(0, 5)} - {activity.scheduled_end_time.substring(0, 5)}
          </span>
        )}
        {activity.is_confirmed ? (
          <Badge variant="default" className="bg-green-500 text-xs h-5">
            <CheckCircle2 className="h-3 w-3 mr-1" /> Confermata
          </Badge>
        ) : (
          <Badge variant="secondary" className="text-xs h-5">Pianificata</Badge>
        )}
      </div>
    </div>
  );

  // Mappa progetto → area, usata anche per filtrare le task del focus.
  const areaByProject = useMemo(() => {
    const map = new Map<string, string>();
    allRows.forEach((row) => {
      if (row.kind === 'project' && row.project.area) {
        map.set(row.project.projectId, String(row.project.area).toLowerCase());
      }
    });
    return map;
  }, [allRows]);

  const availableAreas = useMemo(
    () => Array.from(new Set(Array.from(areaByProject.values()))).sort(),
    [areaByProject],
  );

  const rows = useMemo(() => {
    if (areaFilter === 'all') return allRows;
    return allRows.filter((row) => {
      const area =
        row.kind === 'project'
          ? (row.project.area ? String(row.project.area).toLowerCase() : null)
          : areaByProject.get((row.task as any).project_id) ?? null;
      // Le righe senza area conosciuta restano visibili per non nascondere lavoro.
      return area == null || area === areaFilter;
    });
  }, [allRows, areaFilter, areaByProject]);

  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
  const weekLabel = `${format(weekStart, 'd', { locale: it })}–${format(weekEnd, 'd MMM yyyy', { locale: it })}`;

  const planned = capacity?.weekPlannedHours ?? 0;
  const confirmed = capacity?.weekConfirmedHours ?? 0;
  const contract = capacity?.weeklyContractHours ?? 0;
  const plannedPct = contract > 0 ? Math.min(100, (planned / contract) * 100) : 0;
  const confirmedPct = contract > 0 ? Math.min(100, (confirmed / contract) * 100) : 0;

  const hasRecover = !!recover && (recover.days.length > 0 || recover.previousMonthCount > 0);

  // Le 3 voci a priorità più alta (le righe arrivano già ordinate per punteggio)
  const topRows = useMemo(() => rows.slice(0, 3), [rows]);
  const groupedRest = useMemo(() => {
    const rest = rows.slice(3);
    return {
      urgent: rest.filter((r) => r.bucket === 'urgent'),
      soon: rest.filter((r) => r.bucket === 'soon'),
      ongoing: rest.filter((r) => r.bucket === 'ongoing'),
    };
  }, [rows]);

  const focusTaskIds = useMemo(
    () => rows.filter((r) => r.kind === 'task').map((r) => (r as any).task.id as string),
    [rows]
  );

  const renderRow = (row: (typeof rows)[number], className = '') => {
    const { visible, hiddenCount } = topFocusReasons(row.reasons);
    const isTask = row.kind === 'task';
    const title = isTask ? row.task.title : row.project.projectName;
    const subtitle = isTask
      ? [row.task.clientName, row.task.projectName].filter(Boolean).join(' · ')
      : row.project.clientName ?? '';
    const projectId = isTask ? row.task.project_id : row.project.projectId;

    return (
      <div
        key={row.id}
        className={`flex items-center justify-between gap-2 py-1.5 px-2 ${className}`}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            {isTask && <ListChecks className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
            <span className="font-medium text-sm text-foreground truncate">{title}</span>
            {!isTask && row.project.area && (
              <Badge
                variant="outline"
                className={`shrink-0 text-[10px] px-1.5 py-0 ${getAreaColor(row.project.area as any)}`}
              >
                {getAreaLabel(row.project.area as any)}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
            {subtitle && (
              <span className="text-[11px] text-muted-foreground truncate max-w-[16rem]">{subtitle}</span>
            )}
            {visible.map((r) => (
              <Badge
                key={r}
                variant="outline"
                className={`text-[10px] px-1.5 py-0 font-normal ${focusSeverityClasses[focusReasonSeverity(r)]}`}
              >
                {r}
              </Badge>
            ))}
            {hiddenCount > 0 && (
              <span className="text-[10px] text-muted-foreground">+{hiddenCount}</span>
            )}
          </div>
          {!isTask && row.project.nextActivity && (
            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
              → Prossima: <span className="font-medium text-foreground">{row.project.nextActivity.name}</span>{' '}
              ({format(new Date(row.project.nextActivity.date), 'EEE d MMM', { locale: it })})
            </p>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {isTask ? (
            <Button
              size="sm"
              variant="outline"
              disabled={completeTask.isPending}
              onClick={() =>
                completeTask.mutate({ taskId: row.task.id, projectId, status: 'done' })
              }
            >
              <CheckCircle2 className="h-3 w-3 mr-1" /> Completa
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => navigate(`/projects/${projectId}/canvas`)}>
              <ExternalLink className="h-3 w-3 mr-1" /> Apri canvas
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Altre azioni">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {isTask ? (
                <DropdownMenuItem onClick={() => navigate(`/projects/${projectId}/canvas?tab=tasks`)}>
                  <ExternalLink className="h-4 w-4 mr-2" /> Apri progetto
                </DropdownMenuItem>
              ) : (
                <>
                  <DropdownMenuItem onClick={() => navigate(`/calendar?project=${projectId}`)}>
                    <Calendar className="h-4 w-4 mr-2" /> Pianifica
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setProgressDialog(row.project)}>
                    <TrendingUp className="h-4 w-4 mr-2" /> Aggiorna progresso
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">La mia settimana · {weekLabel}</h2>
        <p className="text-muted-foreground mt-1">
          {userName ? `Ciao ${userName}, ` : ''}capacità, ore da recuperare e su cosa concentrarti.
        </p>
      </div>

      {/* 1. Barra capacità */}
      {capacity && (
        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-3 flex-wrap text-sm">
            <span className="font-medium text-foreground">Capacità settimana</span>
            <span className="text-muted-foreground">
              {formatHours(planned)} pianificate su {formatHours(contract)} contrattuali ·{' '}
              <span className="text-foreground font-medium">{formatHours(confirmed)} confermate</span>
            </span>
          </div>
          <div className="relative h-3 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-primary/30"
              style={{ width: `${plannedPct}%` }}
            />
            <div
              className="absolute inset-y-0 left-0 bg-primary"
              style={{ width: `${confirmedPct}%` }}
            />
          </div>
        </div>
      )}

      {/* 2. Da recuperare */}
      {hasRecover && (
        <Card className="border-l-4 border-l-destructive">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <h3 className="font-semibold text-foreground">Da recuperare</h3>
              {recover!.totalHours > 0 && (
                <Badge variant="destructive">{formatHours(recover!.totalHours)}</Badge>
              )}
            </div>

            {recover!.days.length > 0 ? (
              <div className="space-y-2">
                {recover!.days.map((d) => (
                  <div
                    key={d.date}
                    className="flex items-center justify-between gap-3 flex-wrap text-sm border-b last:border-0 pb-2 last:pb-0"
                  >
                    <div className="min-w-0">
                      <span className="font-medium capitalize">
                        {format(new Date(`${d.date}T00:00:00`), 'EEEE d MMM', { locale: it })}
                      </span>
                      <span className="text-muted-foreground">
                        {' '}
                        · {formatHours(d.hours)} ·{' '}
                        {d.activities
                          .map((a) => (a.projectName ? `${a.projectName}: ${a.name}` : a.name))
                          .join(', ')}
                      </span>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => navigate(`/calendar?date=${d.date}`)}>
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Conferma ore
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nessuna ora aperta in questo mese.
              </p>
            )}

            {recover!.previousMonthCount > 0 && (
              <div className="flex items-center justify-between gap-3 flex-wrap text-sm rounded-md bg-muted/50 p-2">
                <span className="text-muted-foreground">
                  Mese precedente ancora aperto: {recover!.previousMonthCount} attività ·{' '}
                  {formatHours(recover!.previousMonthHours)}
                </span>
                <Button size="sm" variant="outline" onClick={() => navigate('/calendar')}>
                  Vai al calendario
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 3. Attività di oggi (le confermate restano nascoste) */}
      {todaysList.length > 0 && (
        <Card className="border-l-4 border-l-primary">
          <CardContent className="p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-foreground">Oggi</h3>
              {hasUnconfirmedToday && (
                <Badge variant="secondary">da confermare</Badge>
              )}
            </div>
            {pendingToday.length > 0 && (
              <div className="space-y-1">
                {pendingToday.map((activity) => renderTodayRow(activity))}
              </div>
            )}
            {confirmedToday.length > 0 && (
              <Collapsible open={showConfirmedToday} onOpenChange={setShowConfirmedToday}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground">
                    <CheckCircle2 className="h-3 w-3 mr-1 text-green-600" />
                    {confirmedToday.length} confermate
                    <ChevronDown
                      className={`h-3 w-3 ml-1 transition-transform ${showConfirmedToday ? 'rotate-180' : ''}`}
                    />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-1 space-y-1">
                  {confirmedToday.map((activity) => renderTodayRow(activity))}
                </CollapsibleContent>
              </Collapsible>
            )}
            {hasUnconfirmedToday && (
              <div className="flex justify-end">
                <Button size="sm" variant="outline" onClick={() => navigate(`/calendar?date=${todayKey}`)}>
                  <CheckCircle2 className="h-3 w-3 mr-1" /> Conferma ore
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 4. Focus: progetti + task */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Focus
          </h3>
          {availableAreas.length > 1 && (
            <Select value={areaFilter} onValueChange={setAreaFilter}>
              <SelectTrigger className="w-[180px] h-9">
                <SelectValue placeholder="Tutte le aree" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutte le aree</SelectItem>
                {availableAreas.map((a) => (
                  <SelectItem key={a} value={a}>{getAreaLabel(a as any)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {isLoading && [1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}

        {!isLoading && rows.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center space-y-3">
              <Inbox className="h-10 w-10 text-muted-foreground mx-auto" />
              <p className="text-sm text-muted-foreground">
                Nessuna urgenza questa settimana. Goditi un po' di respiro 🌿
              </p>
              <Button variant="outline" size="sm" onClick={() => navigate('/projects')}>
                Vai a tutti i progetti
              </Button>
            </CardContent>
          </Card>
        )}

        {!isLoading && topRows.length > 0 && (
          <Card className="border-l-4 border-l-destructive">
            <CardContent className="p-4 space-y-1">
              <div className="flex items-center gap-2 pb-2">
                <Target className="h-4 w-4 text-destructive" />
                <h4 className="font-semibold text-foreground">Da fare subito</h4>
                <Badge variant="secondary">{topRows.length}</Badge>
              </div>
              <div className="divide-y">
                {topRows.map((row) => renderRow(row))}
              </div>
            </CardContent>
          </Card>
        )}

        {!isLoading &&
          (['urgent', 'soon'] as const).map((bucket) =>
            groupedRest[bucket].length > 0 ? (
              <div key={bucket} className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {BUCKET_META[bucket].label}
                  </span>
                  <Badge variant="outline" className="text-xs">{groupedRest[bucket].length}</Badge>
                </div>
                <Card className={BUCKET_META[bucket].className}>
                  <CardContent className="p-2 grid gap-x-4 lg:grid-cols-2">
                    {groupedRest[bucket].map((row) => renderRow(row, 'border-b last:border-b-0'))}
                  </CardContent>
                </Card>
              </div>
            ) : null
          )}

        {!isLoading && groupedRest.ongoing.length > 0 && (
          <Collapsible open={showOngoing} onOpenChange={setShowOngoing}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-between">
                <span className="flex items-center gap-2">
                  {BUCKET_META.ongoing.label}
                  <Badge variant="outline" className="text-xs">{groupedRest.ongoing.length}</Badge>
                </span>
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${showOngoing ? 'rotate-180' : ''}`}
                />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <Card className={BUCKET_META.ongoing.className}>
                <CardContent className="p-2 grid gap-x-4 lg:grid-cols-2">
                  {groupedRest.ongoing.map((row) => renderRow(row, 'border-b last:border-b-0'))}
                </CardContent>
              </Card>
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>

      {/* 5. Altre task assegnate (quelle già nel focus non vengono ripetute) */}
      <MyTasksWidget userId={userId} excludeTaskIds={focusTaskIds} title="Altre task assegnate" />

      <div className="text-center pt-2">
        <Button variant="ghost" size="sm" onClick={() => navigate('/projects')}>
          Non vedi un progetto? → Tutti i progetti
        </Button>
      </div>

      {progressDialog && (
        <ProgressUpdateDialog
          open={!!progressDialog}
          onOpenChange={(open) => !open && setProgressDialog(null)}
          projectId={progressDialog.projectId}
          projectName={progressDialog.projectName}
          currentProgress={0}
          clientName={progressDialog.clientName ?? undefined}
          onSaved={() => setProgressDialog(null)}
        />
      )}
    </div>
  );
};
