import { useNavigate } from 'react-router-dom';
import { format, differenceInCalendarDays, startOfWeek, endOfWeek } from 'date-fns';
import { it } from 'date-fns/locale';
import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar, ExternalLink, TrendingUp, Inbox } from 'lucide-react';
import { useWeeklyFocus, FocusItem } from '@/hooks/useWeeklyFocus';
import { getAreaColor, getAreaLabel } from '@/lib/areaColors';
import { ProgressUpdateDialog } from '@/components/ProgressUpdateDialog';

interface Props {
  userId: string;
  userName?: string;
}

const BUCKET_META = {
  urgent: { label: '🔴 Urgente', className: 'border-l-4 border-l-destructive' },
  soon: { label: '🟡 In scadenza questa settimana', className: 'border-l-4 border-l-warning' },
  ongoing: { label: '🟢 In corso', className: 'border-l-4 border-l-primary' },
} as const;

export const WeeklyFocusView = ({ userId, userName }: Props) => {
  const navigate = useNavigate();
  const { data: items, isLoading } = useWeeklyFocus(userId);
  const [progressDialog, setProgressDialog] = useState<FocusItem | null>(null);

  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
  const weekLabel = `${format(weekStart, 'd', { locale: it })}–${format(weekEnd, 'd MMM yyyy', { locale: it })}`;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 w-full" />)}
      </div>
    );
  }

  const grouped = {
    urgent: items?.filter((i) => i.bucket === 'urgent') ?? [],
    soon: items?.filter((i) => i.bucket === 'soon') ?? [],
    ongoing: items?.filter((i) => i.bucket === 'ongoing') ?? [],
  };

  const isEmpty = !items || items.length === 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Focus settimana · {weekLabel}</h2>
        <p className="text-muted-foreground mt-1">
          {userName ? `Ciao ${userName}, ` : ''}ecco su cosa concentrarti questa settimana.
        </p>
      </div>

      {isEmpty && (
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

      {(['urgent', 'soon', 'ongoing'] as const).map((bucket) => {
        const list = grouped[bucket];
        if (list.length === 0) return null;
        return (
          <section key={bucket} className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              {BUCKET_META[bucket].label}
            </h3>
            {list.map((item) => (
              <Card key={item.projectId} className={BUCKET_META[bucket].className}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {item.clientName && (
                          <span className="text-sm text-muted-foreground">{item.clientName} ·</span>
                        )}
                        <h4 className="font-semibold text-foreground">{item.projectName}</h4>
                        {item.area && (
                          <Badge variant="outline" className={getAreaColor(item.area as any)}>
                            {getAreaLabel(item.area as any)}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2 flex-wrap">
                        {item.endDate && (
                          <span>
                            📅 {format(new Date(item.endDate), 'dd/MM', { locale: it })}
                            {item.daysToDeadline !== null && item.daysToDeadline >= 0 && (
                              <> · tra {item.daysToDeadline}gg</>
                            )}
                            {item.daysToDeadline !== null && item.daysToDeadline < 0 && (
                              <> · scaduto</>
                            )}
                          </span>
                        )}
                        <span>⏱ {item.userPlannedHours}h pianificate questa settimana</span>
                        {item.daysSinceLastUpdate !== null && item.daysSinceLastUpdate > 14 && (
                          <span className="text-warning">
                            Ultimo update: {item.daysSinceLastUpdate}gg fa
                          </span>
                        )}
                      </div>
                      {item.nextActivity && (
                        <p className="text-xs text-foreground mt-2">
                          → Prossima: <span className="font-medium">{item.nextActivity.name}</span>{' '}
                          ({format(new Date(item.nextActivity.date), 'EEE d MMM', { locale: it })})
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate(`/projects/${item.projectId}/canvas`)}
                    >
                      <ExternalLink className="h-3 w-3 mr-1" /> Apri canvas
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate(`/calendar?project=${item.projectId}`)}
                    >
                      <Calendar className="h-3 w-3 mr-1" /> Pianifica
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setProgressDialog(item)}
                    >
                      <TrendingUp className="h-3 w-3 mr-1" /> Aggiorna progresso
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </section>
        );
      })}

      <div className="text-center pt-4">
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
