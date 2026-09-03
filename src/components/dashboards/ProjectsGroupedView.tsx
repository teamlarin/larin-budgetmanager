import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format, differenceInCalendarDays } from 'date-fns';
import { it } from 'date-fns/locale';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, CalendarClock, FolderOpen, Rocket, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatHours } from '@/lib/utils';
import {
  useProjectCriticality,
  GROUP_LABELS,
  type CriticalityProject,
  type CriticalitySignals,
  type ProjectGroup,
  type Severity,
} from '@/hooks/useProjectCriticality';

export interface GroupedProject extends CriticalityProject {
  id: string;
  name: string;
  client_name?: string | null;
  project_leader_id?: string | null;
}

interface ProjectsGroupedViewProps {
  projects: GroupedProject[];
  openGroups: ProjectGroup[];
  onOpenGroupsChange: (groups: ProjectGroup[]) => void;
}

const GROUP_ICONS: Record<ProjectGroup, typeof FolderOpen> = {
  at_risk: AlertTriangle,
  closing: CalendarClock,
  in_progress: FolderOpen,
  starting: Rocket,
};

const GROUP_DESCRIPTIONS: Record<ProjectGroup, string> = {
  at_risk: 'Budget oltre l\'85%, margine sotto obiettivo o proiezione di sforamento',
  closing: 'Scadenza entro 30 giorni',
  in_progress: 'Progetti aperti senza segnali di allerta',
  starting: 'Da avviare',
};

const severityText: Record<Severity, string> = {
  critical: 'text-destructive',
  warning: 'text-amber-700 dark:text-amber-400',
  none: 'text-muted-foreground',
};

const ReasonBadges = ({ signals }: { signals?: CriticalitySignals }) => {
  if (!signals || signals.reasons.length === 0) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {signals.reasons.map((r) => (
        <Badge
          key={r}
          variant={signals.level === 'critical' ? 'destructive' : 'secondary'}
          className="text-[10px] font-normal"
        >
          {r}
        </Badge>
      ))}
    </div>
  );
};

const DaysCell = ({ days }: { days: number | null }) => {
  if (days == null) return <span className="text-muted-foreground">—</span>;
  if (days < 0) return <span className="text-destructive font-medium">scaduto {Math.abs(days)}g</span>;
  if (days === 0) return <span className="text-destructive font-medium">oggi</span>;
  return (
    <span className={days <= 3 ? 'text-destructive font-medium' : days <= 7 ? 'text-amber-700 dark:text-amber-400' : ''}>
      {days}g
    </span>
  );
};

const numberOrDash = (v: number | null | undefined, suffix = '') =>
  v == null ? '—' : `${v}${suffix}`;

const currency = (v: number | null | undefined) =>
  v == null
    ? '—'
    : new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);

const GRID = 'grid-cols-1 md:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))]';


export const ProjectsGroupedView = ({ projects, openGroups, onOpenGroupsChange }: ProjectsGroupedViewProps) => {
  const navigate = useNavigate();
  const { signals, groups, isLoading } = useProjectCriticality(projects);

  const projectIds = useMemo(() => projects.map((p) => p.id).sort(), [projects]);
  const leaderIds = useMemo(
    () => Array.from(new Set(projects.map((p) => p.project_leader_id).filter(Boolean))) as string[],
    [projects],
  );

  // Metadati di supporto alle colonne: ultimo aggiornamento, leader, dimensione team.
  const { data: meta } = useQuery({
    queryKey: ['dashboard-projects-meta', projectIds.join(','), leaderIds.join(',')],
    enabled: projectIds.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const [updatesRes, leadersRes, membersRes] = await Promise.all([
        supabase
          .from('project_progress_updates')
          .select('project_id, created_at')
          .in('project_id', projectIds)
          .order('created_at', { ascending: false }),
        leaderIds.length > 0
          ? supabase.from('profiles').select('id, first_name, last_name').in('id', leaderIds)
          : Promise.resolve({ data: [] as any[] }),
        supabase.from('project_members').select('project_id, user_id').in('project_id', projectIds),
      ]);

      const lastUpdate = new Map<string, string>();
      for (const u of updatesRes.data ?? []) {
        if (!lastUpdate.has(u.project_id)) lastUpdate.set(u.project_id, u.created_at);
      }
      const leaderName = new Map<string, string>();
      for (const p of (leadersRes.data ?? []) as any[]) {
        leaderName.set(p.id, `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim());
      }
      const teamSize = new Map<string, number>();
      for (const m of membersRes.data ?? []) {
        teamSize.set(m.project_id, (teamSize.get(m.project_id) ?? 0) + 1);
      }
      return { lastUpdate, leaderName, teamSize };
    },
  });

  const renderRow = (p: GroupedProject, group: ProjectGroup) => {
    const s = signals.get(p.id);
    const lastUpdateAt = meta?.lastUpdate.get(p.id);
    const daysSinceUpdate = lastUpdateAt
      ? differenceInCalendarDays(new Date(), new Date(lastUpdateAt))
      : null;

    return (
      <div
        key={p.id}
        className={`grid grid-cols-1 md:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))] gap-2 md:gap-3 items-start p-2 rounded-lg border cursor-pointer transition-colors hover:bg-muted/50 ${
          s?.level === 'critical' ? 'border-destructive/40 bg-destructive/5' : ''
        }`}
        onClick={() => navigate(`/projects/${p.id}/canvas`)}
      >
        <div className="min-w-0">
          <p className="font-medium text-sm truncate">{p.name}</p>
          {p.client_name && <p className="text-xs text-muted-foreground truncate">{p.client_name}</p>}
          <div className="mt-1">
            <ReasonBadges signals={s} />
          </div>
        </div>

        {group === 'at_risk' && (
          <>
            <div className="text-xs">
              <span className="text-muted-foreground md:hidden">Budget: </span>
              <span className={severityText[s?.budget.level ?? 'none']}>
                {numberOrDash(s?.budget.pct ?? null, '%')}
              </span>
            </div>
            <div className="text-xs">
              <span className="text-muted-foreground md:hidden">Margine: </span>
              <span className={severityText[s?.margin.level ?? 'none']}>
                {s?.margin.residual != null ? `${Math.round(s.margin.residual)}%` : '—'}
                {s?.margin.delta != null && (
                  <span className="text-muted-foreground"> ({s.margin.delta > 0 ? '+' : ''}{s.margin.delta} pt)</span>
                )}
              </span>
            </div>
            <div className="text-xs">
              <span className="text-muted-foreground md:hidden">Ore residue: </span>
              {s?.hoursRemaining != null ? formatHours(s.hoursRemaining) : '—'}
            </div>
          </>
        )}

        {group === 'closing' && (
          <>
            <div className="text-xs">
              <span className="text-muted-foreground md:hidden">Deadline: </span>
              <DaysCell days={s?.deadline.daysToEnd ?? null} />
            </div>
            <div className="text-xs">
              <span className="text-muted-foreground md:hidden">Progresso: </span>
              {numberOrDash(s?.progress ?? null, '%')}
            </div>
            <div className="text-xs">
              <span className="text-muted-foreground md:hidden">Ore residue: </span>
              {s?.hoursRemaining != null ? formatHours(s.hoursRemaining) : '—'}
            </div>
          </>
        )}

        {group === 'in_progress' && (
          <>
            <div className="text-xs">
              <span className="text-muted-foreground md:hidden">Ultimo aggiornamento: </span>
              {daysSinceUpdate == null ? (
                <span className="text-amber-700 dark:text-amber-400">mai</span>
              ) : daysSinceUpdate === 0 ? (
                'oggi'
              ) : (
                `${daysSinceUpdate}g`
              )}
            </div>
            <div className="text-xs">
              <span className="text-muted-foreground md:hidden">Budget: </span>
              <span className={severityText[s?.budget.level ?? 'none']}>
                {numberOrDash(s?.budget.pct ?? null, '%')}
              </span>
            </div>
            <div className="text-xs truncate">
              <span className="text-muted-foreground md:hidden">Leader: </span>
              {(p.project_leader_id && meta?.leaderName.get(p.project_leader_id)) || '—'}
            </div>
          </>
        )}

        {group === 'starting' && (
          <>
            <div className="text-xs">
              <span className="text-muted-foreground md:hidden">Inizio: </span>
              {p.start_date ? format(new Date(p.start_date), 'd MMM yyyy', { locale: it }) : '—'}
            </div>
            <div className="text-xs flex items-center gap-1">
              <Users className="h-3 w-3 text-muted-foreground shrink-0" />
              {meta?.teamSize.get(p.id) ?? 0} persone
            </div>
            <div className="text-xs">
              <span className="text-muted-foreground md:hidden">Ore previste: </span>
              {s?.totalHours != null ? formatHours(s.totalHours) : '—'}
            </div>
          </>
        )}
      </div>
    );
  };

  const columnHeaders: Record<ProjectGroup, string[]> = {
    at_risk: ['Progetto', 'Budget', 'Margine', 'Ore residue'],
    closing: ['Progetto', 'Deadline', 'Progresso', 'Ore residue'],
    in_progress: ['Progetto', 'Ultimo agg.', 'Budget', 'Leader'],
    starting: ['Progetto', 'Data inizio', 'Team', 'Ore previste'],
  };

  const order: ProjectGroup[] = ['at_risk', 'closing', 'in_progress', 'starting'];

  if (isLoading && projects.length > 0) {
    return (
      <Card>
        <CardContent className="py-4 space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Accordion
      type="multiple"
      value={openGroups}
      onValueChange={(v) => onOpenGroupsChange(v as ProjectGroup[])}
      className="space-y-2"
    >
      {order.map((group) => {
        const list = groups[group];
        const Icon = GROUP_ICONS[group];
        const criticalCount = list.filter((p) => signals.get(p.id)?.level === 'critical').length;
        return (
          <AccordionItem
            key={group}
            value={group}
            id={`projects-group-${group}`}
            className="border rounded-lg px-3 scroll-mt-24"
          >
            <AccordionTrigger className="hover:no-underline py-3">
              <div className="flex items-center gap-2 flex-wrap text-left">
                <Icon className={`h-4 w-4 ${group === 'at_risk' ? 'text-destructive' : 'text-muted-foreground'}`} />
                <span className="font-semibold text-sm">{GROUP_LABELS[group]}</span>
                <Badge variant="outline" className="text-xs">{list.length}</Badge>
                {criticalCount > 0 && (
                  <Badge variant="destructive" className="text-xs">{criticalCount} critici</Badge>
                )}
                <span className="text-xs text-muted-foreground hidden lg:inline">
                  {GROUP_DESCRIPTIONS[group]}
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              {list.length === 0 ? (
                <p className="text-sm text-muted-foreground py-3">Nessun progetto in questo gruppo</p>
              ) : (
                <div className="space-y-2 pb-2">
                  <div className="hidden md:grid grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))] gap-3 px-2 text-xs font-medium text-muted-foreground">
                    {columnHeaders[group].map((h) => (
                      <span key={h}>{h}</span>
                    ))}
                  </div>
                  {list.map((p) => renderRow(p, group))}
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
};
