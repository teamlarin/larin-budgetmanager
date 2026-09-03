import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChevronDown, ChevronLeft, ChevronRight, Users, AlertTriangle, Palmtree, Plus } from 'lucide-react';
import { formatHours } from '@/lib/utils';
import { useTeamWeek, type TeamWeekMember } from '@/hooks/useTeamWeek';
import { ReassignDialog, type ReassignTarget } from './ReassignDialog';
import { PlanTeamHoursDialog, type PlanTeamHoursTarget } from './PlanTeamHoursDialog';
import { TeamWeekCalendar } from './TeamWeekCalendar';
import { UserHoursSummary } from './UserHoursSummary';

const AREA_LABELS: Record<string, string> = {
  tech: 'Tech', marketing: 'Marketing', branding: 'Branding',
  sales: 'Sales', struttura: 'Struttura', ai: 'Jarvis', interno: 'Interno',
};

const PROJECT_COLORS = [
  'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-violet-500',
  'bg-pink-500', 'bg-cyan-500', 'bg-orange-500', 'bg-lime-500',
];

const colorForProject = (projectId: string) => {
  let hash = 0;
  for (let i = 0; i < projectId.length; i++) hash = (hash * 31 + projectId.charCodeAt(i)) % 100000;
  return PROJECT_COLORS[hash % PROJECT_COLORS.length];
};

const STATUS_LABELS: Record<string, string> = {
  todo: 'Da fare', in_progress: 'In corso', in_review: 'In revisione', done: 'Completato',
};
const PRIORITY_LABELS: Record<string, string> = { high: 'Alta', medium: 'Normale', low: 'Bassa' };

/** Barra a doppia traccia: pianificato (traccia larga) e confermato (traccia sottile sovrapposta). */
const DualBar = ({ member }: { member: TeamWeekMember }) => {
  const plannedWidth = Math.min(member.plannedPct, 100);
  const confirmedWidth = Math.min(member.confirmedPct, 100);
  const over = member.plannedPct > 100;
  return (
    <div className="space-y-1">
      <div className="relative h-3 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={`absolute inset-y-0 left-0 ${over ? 'bg-destructive' : member.plannedPct >= 80 ? 'bg-amber-500' : 'bg-primary'}`}
          style={{ width: `${plannedWidth}%` }}
        />
        <div
          className="absolute bottom-0 left-0 h-1 bg-foreground/70"
          style={{ width: `${confirmedWidth}%` }}
        />
      </div>
      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
        <span>Pianificate {formatHours(member.plannedHours)} ({member.plannedPct}%)</span>
        <span>Confermate {formatHours(member.confirmedHours)} ({member.confirmedPct}%)</span>
      </div>
    </div>
  );
};

const MemberRow = ({
  member,
  onReassign,
  onPlan,
}: {
  member: TeamWeekMember;
  onReassign: (t: ReassignTarget) => void;
  onPlan: (t: PlanTeamHoursTarget) => void;
}) => {
  const [open, setOpen] = useState(false);
  const maxDayHours = Math.max(
    4,
    ...member.byDay.map(d => Math.max(d.plannedHours, d.confirmedHours, d.absenceHours))
  );

  return (
    <div className="rounded-lg border">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full text-left p-3 hover:bg-muted/40 transition-colors"
      >
        <div className="flex items-start gap-3">
          <ChevronDown className={`h-4 w-4 mt-1 shrink-0 transition-transform ${open ? '' : '-rotate-90'}`} />
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium truncate">{member.fullName}</span>
              <span className="text-xs text-muted-foreground truncate">
                {[member.title, member.area ? AREA_LABELS[member.area] || member.area : null, member.levelName]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
              {member.plannedPct > 100 && (
                <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">Sovraccarico</Badge>
              )}
              {member.absenceHours > 0 && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 gap-1">
                  <Palmtree className="h-3 w-3" /> Assenza {formatHours(member.absenceHours)}
                </Badge>
              )}
              {member.unconfirmedPastHours > 0 && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 gap-1">
                  <AlertTriangle className="h-3 w-3" /> {formatHours(member.unconfirmedPastHours)} da confermare
                </Badge>
              )}
            </div>

            <DualBar member={member} />
          </div>

          <div className="text-right text-xs whitespace-nowrap space-y-0.5">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="font-semibold">{formatHours(member.freeHours)} libere</div>
                </TooltipTrigger>
                <TooltipContent>
                  Capacità netta {formatHours(member.capacityNet)} (contratto {formatHours(member.capacityGross)} − assenze {formatHours(member.absenceHours)})
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <div className="text-muted-foreground">
              {member.tasks.length} task in scadenza
            </div>
          </div>
        </div>
      </button>

      {open && (
        <div className="border-t p-3 space-y-4">
          {/* Griglia lun–ven */}
          <div className="grid grid-cols-5 gap-2">
            {member.byDay.map(day => (
              <div key={day.date} className="space-y-1">
                <div className="text-[11px] text-muted-foreground capitalize">
                  {format(new Date(`${day.date}T00:00:00`), 'EEE d', { locale: it })}
                </div>
                <div className="h-24 rounded bg-muted/50 flex flex-col-reverse overflow-hidden">
                  {day.absenceHours > 0 && (
                    <div
                      className="bg-stone-400"
                      style={{ height: `${Math.min(100, (day.absenceHours / maxDayHours) * 100)}%` }}
                      title={`Assenza ${formatHours(day.absenceHours)}`}
                    />
                  )}
                  {day.segments.map(seg => (
                    <div
                      key={seg.projectId}
                      className={colorForProject(seg.projectId)}
                      style={{ height: `${Math.min(100, (seg.hours / maxDayHours) * 100)}%` }}
                      title={`${seg.projectName}: ${formatHours(seg.hours)}`}
                    />
                  ))}
                </div>
                <div className="text-[11px] text-center text-muted-foreground">
                  {formatHours(day.plannedHours)}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 w-full text-[11px]"
                  onClick={() =>
                    onPlan({ userId: member.userId, userName: member.fullName, date: day.date })
                  }
                >
                  <Plus className="h-3 w-3 mr-1" /> Pianifica
                </Button>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Progetti della settimana */}
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Progetti · ore settimana
              </div>
              {member.byProject.length === 0 && (
                <p className="text-sm text-muted-foreground">Nessuna ora sui progetti questa settimana.</p>
              )}
              {member.byProject.map(p => (
                <div key={p.projectId} className="flex items-center gap-2 text-sm">
                  <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${colorForProject(p.projectId)}`} />
                  <span className="truncate flex-1">{p.projectName}</span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatHours(p.plannedHours)} pian. · {formatHours(p.confirmedHours)} conf.
                  </span>
                  {p.entryIds.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() =>
                        onReassign({
                          kind: 'entries',
                          label: p.projectName,
                          fromUserId: member.userId,
                          entryIds: p.entryIds,
                        })
                      }
                    >
                      Riassegna
                    </Button>
                  )}
                </div>
              ))}
            </div>

            {/* Task in scadenza */}
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Task in scadenza questa settimana
              </div>
              {member.tasks.length === 0 && (
                <p className="text-sm text-muted-foreground">Nessuna task in scadenza.</p>
              )}
              {member.tasks.map(t => (
                <div key={t.id} className="flex items-center gap-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="truncate">{t.title}</div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {t.projectName} · {t.due_date ? format(new Date(`${t.due_date.slice(0, 10)}T00:00:00`), 'EEE d MMM', { locale: it }) : '—'}
                      {' · '}{STATUS_LABELS[t.status] || t.status} · {PRIORITY_LABELS[t.priority] || t.priority}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() =>
                      onReassign({ kind: 'task', label: t.title, fromUserId: member.userId, taskId: t.id })
                    }
                  >
                    Riassegna
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface TeamWeekViewProps {
  filterUserIds?: string[];
}

export const TeamWeekView = ({ filterUserIds }: TeamWeekViewProps) => {
  const [weekOffset, setWeekOffset] = useState(0);
  const [areaFilter, setAreaFilter] = useState<string>('all');
  const [reassignTarget, setReassignTarget] = useState<ReassignTarget | null>(null);
  const [planTarget, setPlanTarget] = useState<PlanTeamHoursTarget | null>(null);
  const { data, isLoading, weekStart, weekEnd } = useTeamWeek(weekOffset, filterUserIds);

  const allMembers = data?.members || [];
  const weekLabel = `${format(weekStart, 'd MMM', { locale: it })} – ${format(weekEnd, 'd MMM yyyy', { locale: it })}`;

  const availableAreas = useMemo(
    () => Array.from(new Set(allMembers.map(m => m.area).filter(Boolean) as string[])).sort(),
    [allMembers]
  );

  const members = useMemo(
    () => (areaFilter === 'all' ? allMembers : allMembers.filter(m => m.area === areaFilter)),
    [allMembers, areaFilter]
  );

  /** Cruscotto per area: pianificato, confermato e capacità netta aggregati. */
  const areaStats = useMemo(() => {
    const map = new Map<
      string,
      { area: string; people: number; planned: number; confirmed: number; capacityNet: number }
    >();
    for (const m of allMembers) {
      const key = m.area || 'senza_area';
      const row = map.get(key) || { area: key, people: 0, planned: 0, confirmed: 0, capacityNet: 0 };
      row.people += 1;
      row.planned += m.plannedHours;
      row.confirmed += m.confirmedHours;
      row.capacityNet += m.capacityNet;
      map.set(key, row);
    }
    return Array.from(map.values())
      .map(r => ({
        ...r,
        planned: Math.round(r.planned * 10) / 10,
        confirmed: Math.round(r.confirmed * 10) / 10,
        capacityNet: Math.round(r.capacityNet * 10) / 10,
        plannedPct: r.capacityNet > 0 ? Math.round((r.planned / r.capacityNet) * 100) : 0,
        confirmedPct: r.capacityNet > 0 ? Math.round((r.confirmed / r.capacityNet) * 100) : 0,
      }))
      .sort((a, b) => b.plannedPct - a.plannedPct);
  }, [allMembers]);

  const kpis = useMemo(() => {
    const withCapacity = members.filter(m => m.capacityNet > 0);
    const avg = (pick: (m: TeamWeekMember) => number) =>
      withCapacity.length > 0
        ? Math.round(withCapacity.reduce((s, m) => s + pick(m), 0) / withCapacity.length)
        : 0;
    return {
      people: members.length,
      plannedAvg: avg(m => m.plannedPct),
      confirmedAvg: avg(m => m.confirmedPct),
      freeHours: members.reduce((s, m) => s + m.freeHours, 0),
      overloaded: members.filter(m => m.plannedPct > 100).length,
    };
  }, [members]);

  const people = members.map(m => ({ userId: m.userId, fullName: m.fullName }));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-5 w-5" />
              Team · settimana
            </CardTitle>
            <CardDescription>{weekLabel} · capacità netta delle assenze</CardDescription>
          </div>
          <div className="flex items-center gap-1">
            <Select value={areaFilter} onValueChange={setAreaFilter}>
              <SelectTrigger className="h-8 w-[150px] text-xs mr-2">
                <SelectValue placeholder="Tutte le aree" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutte le aree</SelectItem>
                {availableAreas.map(a => (
                  <SelectItem key={a} value={a}>
                    {AREA_LABELS[a] || a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setWeekOffset(o => o - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              onClick={() => setWeekOffset(0)}
              disabled={weekOffset === 0}
            >
              Oggi
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setWeekOffset(o => o + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{kpis.people}</div>
              <div className="text-xs text-muted-foreground">Persone</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{kpis.plannedAvg}%</div>
              <div className="text-xs text-muted-foreground">% Pianificazione</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{kpis.confirmedAvg}%</div>
              <div className="text-xs text-muted-foreground">% Confermato</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{formatHours(kpis.freeHours)}</div>
              <div className="text-xs text-muted-foreground">Ore libere</div>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-bold ${kpis.overloaded > 0 ? 'text-destructive' : ''}`}>
                {kpis.overloaded}
              </div>
              <div className="text-xs text-muted-foreground">Sovraccarichi</div>
            </div>
          </div>

          {/* Cruscotto per area */}
          {areaStats.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Aree · ore pianificate, confermate e capacità netta
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
                {areaStats.map(a => (
                  <button
                    key={a.area}
                    type="button"
                    onClick={() => setAreaFilter(prev => (prev === a.area ? 'all' : a.area))}
                    className={`text-left rounded-lg border p-3 transition-colors hover:bg-muted/40 ${
                      areaFilter === a.area ? 'border-primary bg-muted/30' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">
                        {AREA_LABELS[a.area] || (a.area === 'senza_area' ? 'Senza area' : a.area)}
                      </span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                        {a.people} pers.
                      </Badge>
                    </div>
                    <div className="mt-2 relative h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className={`absolute inset-y-0 left-0 ${a.plannedPct > 100 ? 'bg-destructive' : 'bg-primary'}`}
                        style={{ width: `${Math.min(a.plannedPct, 100)}%` }}
                      />
                      <div
                        className="absolute bottom-0 left-0 h-[3px] bg-foreground/70"
                        style={{ width: `${Math.min(a.confirmedPct, 100)}%` }}
                      />
                    </div>
                    <div className="mt-1.5 text-[11px] text-muted-foreground">
                      {formatHours(a.planned)} pian. ({a.plannedPct}%) · {formatHours(a.confirmed)} conf. (
                      {a.confirmedPct}%) · cap. netta {formatHours(a.capacityNet)}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="h-40 flex items-center justify-center text-muted-foreground">Caricamento…</div>
          ) : members.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nessuna persona trovata</p>
          ) : (
            <Tabs defaultValue="rows">
              <TabsList>
                <TabsTrigger value="rows">Persone</TabsTrigger>
                <TabsTrigger value="calendar">Calendario team</TabsTrigger>
              </TabsList>
              <TabsContent value="rows" className="mt-4">
                <div className="space-y-2">
                  {members.map(m => (
                    <MemberRow
                      key={m.userId}
                      member={m}
                      onReassign={setReassignTarget}
                      onPlan={setPlanTarget}
                    />
                  ))}
                </div>
              </TabsContent>
              <TabsContent value="calendar" className="mt-4">
                <TeamWeekCalendar
                  members={members}
                  onPlan={(userId, userName, date) => setPlanTarget({ userId, userName, date })}
                />
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>

      <Accordion type="single" collapsible className="border-t pt-2">
        <AccordionItem value="ore" className="border-b-0">
          <AccordionTrigger className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Andamento ore
          </AccordionTrigger>
          <AccordionContent className="pt-4">
            <UserHoursSummary compactMode filterUserIds={filterUserIds} />
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <ReassignDialog
        target={reassignTarget}
        people={people}
        onOpenChange={open => !open && setReassignTarget(null)}
      />
    </div>
  );
};
