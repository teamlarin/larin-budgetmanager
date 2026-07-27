import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CalendarClock, ArrowRight, AlertTriangle, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { it } from 'date-fns/locale';
import type { ProjectMarginRow } from '@/hooks/useTeamLeaderProjectMargins';

interface ProjectNearDeadline {
  id: string;
  name: string;
  client_name?: string;
  end_date: string;
  progress?: number;
  project_status?: string;
  area?: string | null;
}

interface ProjectsNearDeadlineWidgetProps {
  projects: ProjectNearDeadline[];
  isLoading?: boolean;
  margins?: Map<string, ProjectMarginRow>;
}

type Filter = 'critical' | '14' | '30';

const getDaysRemaining = (endDate: string) => {
  const end = new Date(endDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return differenceInDays(end, today);
};

const getUrgencyBadge = (daysRemaining: number) => {
  if (daysRemaining < 0) return <Badge variant="destructive">Scaduto</Badge>;
  if (daysRemaining === 0) return <Badge variant="destructive">Oggi</Badge>;
  if (daysRemaining <= 3) return <Badge variant="destructive">{daysRemaining}g</Badge>;
  if (daysRemaining <= 7) return <Badge variant="secondary">{daysRemaining}g</Badge>;
  return <Badge variant="outline">{daysRemaining}g</Badge>;
};

const MarginBadge = ({ m }: { m?: ProjectMarginRow }) => {
  if (!m || m.status === 'unknown') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Minus className="h-3 w-3" /> N/D
      </span>
    );
  }
  if (m.status === 'profit') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400 font-medium">
        <TrendingUp className="h-3 w-3" />
        {m.residualMargin.toFixed(0)}%
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium ${
        m.status === 'critical' ? 'text-destructive' : 'text-amber-700 dark:text-amber-400'
      }`}
    >
      <TrendingDown className="h-3 w-3" />
      {m.residualMargin.toFixed(0)}%
    </span>
  );
};

export const ProjectsNearDeadlineWidget = ({ projects, isLoading, margins }: ProjectsNearDeadlineWidgetProps) => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>('14');

  const buckets = useMemo(() => {
    const critical: ProjectNearDeadline[] = [];
    const within14: ProjectNearDeadline[] = [];
    const within30: ProjectNearDeadline[] = [];
    for (const p of projects) {
      const d = getDaysRemaining(p.end_date);
      if (d <= 30) within30.push(p);
      if (d <= 14) within14.push(p);
      if (d <= 7 && (p.progress || 0) < 80) critical.push(p);
    }
    const sortByDays = (a: ProjectNearDeadline, b: ProjectNearDeadline) =>
      getDaysRemaining(a.end_date) - getDaysRemaining(b.end_date);
    return {
      critical: critical.sort(sortByDays),
      '14': within14.sort(sortByDays),
      '30': within30.sort(sortByDays),
    } as Record<Filter, ProjectNearDeadline[]>;
  }, [projects]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5" />
            Progetti in scadenza
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[150px] flex items-center justify-center text-muted-foreground">
            Caricamento...
          </div>
        </CardContent>
      </Card>
    );
  }

  const list = buckets[filter];

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 space-y-0 pb-2">
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-2 flex-wrap">
            <CalendarClock className="h-5 w-5 shrink-0" />
            <span className="truncate">Progetti in scadenza</span>
            {buckets.critical.length > 0 && (
              <Badge variant="destructive" className="ml-1">
                {buckets.critical.length} critici
              </Badge>
            )}
          </CardTitle>
          <CardDescription>Deadlines dei progetti attivi</CardDescription>
        </div>
        <Button variant="ghost" size="sm" className="self-start sm:self-auto shrink-0" onClick={() => navigate('/projects')}>
          Tutti
          <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </CardHeader>
      <CardContent>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)} className="mb-3">
          <TabsList className="grid grid-cols-3 w-full sm:max-w-sm">
            <TabsTrigger value="critical" className="text-xs sm:text-sm">Critici ({buckets.critical.length})</TabsTrigger>
            <TabsTrigger value="14" className="text-xs sm:text-sm">14g ({buckets['14'].length})</TabsTrigger>
            <TabsTrigger value="30" className="text-xs sm:text-sm">30g ({buckets['30'].length})</TabsTrigger>
          </TabsList>
        </Tabs>

        {list.length === 0 ? (
          <div className="h-[80px] flex flex-col items-center justify-center text-muted-foreground text-sm">
            <CalendarClock className="h-6 w-6 mb-1 opacity-50" />
            Nessun progetto in questa fascia
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
            {list.slice(0, 12).map((project) => {
              const daysRemaining = getDaysRemaining(project.end_date);
              const isUrgent = daysRemaining <= 3;
              const m = margins?.get(project.id);

              return (
                <div
                  key={project.id}
                  className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-2 rounded-lg border cursor-pointer transition-colors hover:bg-muted/50 ${
                    isUrgent ? 'border-destructive/50 bg-destructive/5' : ''
                  }`}
                  onClick={() => navigate(`/projects/${project.id}/canvas`)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {isUrgent && <AlertTriangle className="h-3.5 w-3.5 text-destructive flex-shrink-0" />}
                      <span className="font-medium text-sm truncate">{project.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground flex-wrap">
                      {project.client_name && <span className="truncate max-w-[140px]">{project.client_name}</span>}
                      {project.client_name && <span>·</span>}
                      <span className="whitespace-nowrap">{format(new Date(project.end_date), 'd MMM', { locale: it })}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    <MarginBadge m={m} />
                    {project.progress !== undefined && (
                      <span className="text-xs text-muted-foreground">{project.progress}%</span>
                    )}
                    {getUrgencyBadge(daysRemaining)}
                  </div>
                </div>
              );
            })}
            {list.length > 12 && (
              <div className="text-xs text-muted-foreground text-center pt-1 sm:col-span-2 xl:col-span-3">
                +{list.length - 12} altri progetti
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
