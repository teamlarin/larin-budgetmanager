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
} from 'lucide-react';
import {
  useWeekFocusRows,
  useHoursToRecover,
  type FocusItem,
} from '@/hooks/useWeeklyFocus';
import { useCompleteMyTask } from '@/hooks/useMyTasks';
import { getAreaColor, getAreaLabel } from '@/lib/areaColors';
import { ProgressUpdateDialog } from '@/components/ProgressUpdateDialog';

interface Props {
  userId: string;
  userName?: string;
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

export const WeeklyFocusView = ({ userId, userName, capacity }: Props) => {
  const navigate = useNavigate();
  const { rows: allRows, isLoading } = useWeekFocusRows(userId);
  const { data: recover } = useHoursToRecover(userId);
  const completeTask = useCompleteMyTask();
  const [progressDialog, setProgressDialog] = useState<FocusItem | null>(null);
  const [areaFilter, setAreaFilter] = useState<string>('all');

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

  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
  const weekLabel = `${format(weekStart, 'd', { locale: it })}–${format(weekEnd, 'd MMM yyyy', { locale: it })}`;

  const planned = capacity?.weekPlannedHours ?? 0;
  const confirmed = capacity?.weekConfirmedHours ?? 0;
  const contract = capacity?.weeklyContractHours ?? 0;
  const plannedPct = contract > 0 ? Math.min(100, (planned / contract) * 100) : 0;
  const confirmedPct = contract > 0 ? Math.min(100, (confirmed / contract) * 100) : 0;

  const hasRecover = !!recover && (recover.days.length > 0 || recover.previousMonthCount > 0);

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

      {/* 3. Focus: progetti + task */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Focus
        </h3>

        {isLoading && [1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}

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

        {!isLoading &&
          rows.map((row) => (
            <Card key={row.id} className={BUCKET_META[row.bucket].className}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {row.kind === 'task' ? (
                        <>
                          <ListChecks className="h-4 w-4 text-muted-foreground shrink-0" />
                          <h4 className="font-semibold text-foreground">{row.task.title}</h4>
                          <span className="text-sm text-muted-foreground">
                            {row.task.clientName ? `${row.task.clientName} · ` : ''}
                            {row.task.projectName}
                          </span>
                        </>
                      ) : (
                        <>
                          {row.project.clientName && (
                            <span className="text-sm text-muted-foreground">
                              {row.project.clientName} ·
                            </span>
                          )}
                          <h4 className="font-semibold text-foreground">{row.project.projectName}</h4>
                          {row.project.area && (
                            <Badge variant="outline" className={getAreaColor(row.project.area as any)}>
                              {getAreaLabel(row.project.area as any)}
                            </Badge>
                          )}
                        </>
                      )}
                    </div>

                    {/* Chip dei motivi */}
                    {row.reasons.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap mt-2">
                        {row.reasons.map((r) => (
                          <Badge
                            key={r}
                            variant={row.bucket === 'urgent' ? 'destructive' : 'secondary'}
                            className="text-xs font-normal"
                          >
                            {r}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {row.kind === 'project' && row.project.nextActivity && (
                      <p className="text-xs text-foreground mt-2">
                        → Prossima:{' '}
                        <span className="font-medium">{row.project.nextActivity.name}</span> (
                        {format(new Date(row.project.nextActivity.date), 'EEE d MMM', { locale: it })})
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 flex-wrap">
                  {row.kind === 'task' ? (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={completeTask.isPending}
                        onClick={() =>
                          completeTask.mutate({
                            taskId: row.task.id,
                            projectId: row.task.project_id,
                            status: 'done',
                          })
                        }
                      >
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Completa
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(`/projects/${row.task.project_id}/canvas`)}
                      >
                        <ExternalLink className="h-3 w-3 mr-1" /> Apri progetto
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(`/projects/${row.project.projectId}/canvas`)}
                      >
                        <ExternalLink className="h-3 w-3 mr-1" /> Apri canvas
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(`/calendar?project=${row.project.projectId}`)}
                      >
                        <Calendar className="h-3 w-3 mr-1" /> Pianifica
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setProgressDialog(row.project)}>
                        <TrendingUp className="h-3 w-3 mr-1" /> Aggiorna progresso
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
      </div>

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
