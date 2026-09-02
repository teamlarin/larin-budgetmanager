import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  subMonths,
  format,
  differenceInCalendarDays,
} from 'date-fns';
import { it } from 'date-fns/locale';
import { calculateSafeHours } from '@/lib/timeUtils';
import { useMyTasks, myTaskBucket, type MyTask } from '@/hooks/useMyTasks';


export interface FocusItem {
  projectId: string;
  projectName: string;
  clientName: string | null;
  area: string | null;
  endDate: string | null;
  daysToDeadline: number | null;
  budgetConsumedPct: number | null;
  userPlannedHours: number;
  nextActivity: { name: string; date: string } | null;
  daysSinceLastUpdate: number | null;
  focusScore: number;
  bucket: 'urgent' | 'soon' | 'ongoing';
  /** Motivi leggibili che spiegano il punteggio (mostrati come chip). */
  reasons: string[];
}

const chunk = <T,>(arr: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

const fetchInBatches = async <T,>(
  ids: string[],
  fn: (batch: string[]) => Promise<T[]>
): Promise<T[]> => {
  if (ids.length === 0) return [];
  const batches = await Promise.all(chunk(ids, 100).map(fn));
  return batches.flat();
};

/** Etichetta giorno della settimana ("giovedì") per una data yyyy-MM-dd. */
const weekdayLabel = (dateStr: string): string =>
  format(new Date(`${dateStr}T00:00:00`), 'EEEE', { locale: it });


export const useWeeklyFocus = (userId: string | null | undefined) => {
  return useQuery({
    queryKey: ['weekly-focus', userId],
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<FocusItem[]> => {
      if (!userId) return [];

      const today = new Date();
      const weekStart = startOfWeek(today, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
      const weekStartStr = format(weekStart, 'yyyy-MM-dd');
      const weekEndStr = format(weekEnd, 'yyyy-MM-dd');
      const todayStr = format(today, 'yyyy-MM-dd');

      // 1. Project IDs from membership + leader/account/assigned
      const [memberRes, ownedRes] = await Promise.all([
        supabase.from('project_members').select('project_id').eq('user_id', userId),
        supabase
          .from('projects')
          .select('id')
          .or(
            `project_leader_id.eq.${userId},account_user_id.eq.${userId},assigned_user_id.eq.${userId}`
          ),
      ]);

      const projectIds = Array.from(
        new Set([
          ...(memberRes.data?.map((m) => m.project_id) ?? []),
          ...(ownedRes.data?.map((p) => p.id) ?? []),
        ])
      );

      if (projectIds.length === 0) return [];

      // 2. Fetch project details (open/starting + approved)
      const projects = await fetchInBatches(projectIds, async (batch) => {
        const { data } = await supabase
          .from('projects')
          .select('id, name, area, end_date, project_status, status, clients(name)')
          .in('id', batch)
          .eq('status', 'approvato')
          .in('project_status', ['aperto', 'in_partenza']);
        return data ?? [];
      });

      if (projects.length === 0) return [];
      const activeIds = projects.map((p) => p.id);

      // 3. Parallel: budget items, time tracking (user), progress updates, confirmed hours (all users)
      const [budgetItems, userTracking, lastUpdates, projectConfirmed] = await Promise.all([
        fetchInBatches(activeIds, async (batch) => {
          const { data } = await supabase
            .from('budget_items')
            .select('project_id, hours_worked, assignee_id')
            .in('project_id', batch);
          return data ?? [];
        }),
        (async () => {
          const { data } = await supabase
            .from('activity_time_tracking')
            .select(
              'scheduled_date, scheduled_start_time, scheduled_end_time, budget_items!inner(project_id, activity_name)'
            )
            .eq('user_id', userId)
            .gte('scheduled_date', weekStartStr);
          return (data ?? []) as any[];
        })(),
        fetchInBatches(activeIds, async (batch) => {
          const { data } = await supabase
            .from('project_progress_updates')
            .select('project_id, created_at')
            .in('project_id', batch)
            .order('created_at', { ascending: false });
          return data ?? [];
        }),
        // Ore confermate di TUTTI gli utenti sulle attività dei progetti attivi.
        // Paginata: il limite Supabase è 1.000 righe per query.
        fetchInBatches(activeIds, async (batch) => {
          const rows: any[] = [];
          const PAGE = 1000;
          for (let page = 0; page < 20; page++) {
            const { data } = await supabase
              .from('activity_time_tracking')
              .select(
                'scheduled_start_time, scheduled_end_time, actual_start_time, actual_end_time, budget_items!inner(project_id)'
              )
              .in('budget_items.project_id', batch)
              .not('actual_start_time', 'is', null)
              .not('actual_end_time', 'is', null)
              .range(page * PAGE, page * PAGE + PAGE - 1);
            if (!data || data.length === 0) break;
            rows.push(...data);
            if (data.length < PAGE) break;
          }
          return rows;
        }),
      ]);

      // Ore confermate per progetto (durata pianificata, coerente col Calendario)
      const confirmedByProject = new Map<string, number>();
      for (const r of projectConfirmed as any[]) {
        const pid = r.budget_items?.project_id;
        if (!pid) continue;
        if (!r.actual_start_time || !r.actual_end_time) continue;
        if (!r.scheduled_start_time || !r.scheduled_end_time) continue;
        const h = calculateSafeHours(r.scheduled_start_time, r.scheduled_end_time, true);
        confirmedByProject.set(pid, (confirmedByProject.get(pid) ?? 0) + h);
      }



      // 4. Aggregate per project
      const lastUpdateByProject = new Map<string, string>();
      for (const u of lastUpdates) {
        if (!lastUpdateByProject.has(u.project_id)) {
          lastUpdateByProject.set(u.project_id, u.created_at);
        }
      }

      const calcHours = (s?: string | null, e?: string | null): number => {
        if (!s || !e) return 0;
        const [sh, sm] = s.split(':').map(Number);
        const [eh, em] = e.split(':').map(Number);
        let mins = eh * 60 + em - (sh * 60 + sm);
        if (mins < 0) mins += 24 * 60;
        return Math.min(mins, 16 * 60) / 60;
      };

      const items: FocusItem[] = projects.map((p) => {
        const projItems = budgetItems.filter((b) => b.project_id === p.id);
        const totalBudgetHours = projItems.reduce(
          (s, b) => s + (Number(b.hours_worked) || 0),
          0
        );

        const projTracking = userTracking.filter(
          (t: any) => t.budget_items?.project_id === p.id
        );

        let userPlanned = 0;
        let nextActivity: { name: string; date: string } | null = null;
        for (const t of projTracking as any[]) {
          if (
            t.scheduled_date &&
            t.scheduled_date >= weekStartStr &&
            t.scheduled_date <= weekEndStr
          ) {
            userPlanned += calcHours(t.scheduled_start_time, t.scheduled_end_time);
          }
          if (t.scheduled_date && t.scheduled_date >= todayStr) {
            if (!nextActivity || t.scheduled_date < nextActivity.date) {
              nextActivity = {
                name: t.budget_items?.activity_name || 'Attività',
                date: t.scheduled_date,
              };
            }
          }
        }

        const daysToDeadline = p.end_date
          ? differenceInCalendarDays(new Date(p.end_date), today)
          : null;

        const lastUpdateAt = lastUpdateByProject.get(p.id);
        const daysSinceLastUpdate = lastUpdateAt
          ? differenceInCalendarDays(today, new Date(lastUpdateAt))
          : null;

        // % budget consumato: ore confermate (tutti gli utenti) su ore previste.
        const confirmedHours = confirmedByProject.get(p.id) ?? 0;
        const budgetConsumedPct =
          totalBudgetHours > 0 ? Math.round((confirmedHours / totalBudgetHours) * 100) : null;

        let score = 0;
        const reasons: string[] = [];

        if (daysToDeadline !== null) {
          if (daysToDeadline < 0) {
            score += 50;
            reasons.push(`scaduto da ${Math.abs(daysToDeadline)}gg`);
          } else if (daysToDeadline <= differenceInCalendarDays(weekEnd, today)) {
            score += 50;
            reasons.push(
              daysToDeadline === 0
                ? 'scade oggi'
                : `scade ${weekdayLabel(format(new Date(p.end_date!), 'yyyy-MM-dd'))}`
            );
          } else if (daysToDeadline <= 14) {
            score += 20;
            reasons.push(`scade tra ${daysToDeadline}gg`);
          }
        }

        if (budgetConsumedPct !== null) {
          if (budgetConsumedPct >= 90) {
            score += 25;
            reasons.push(`budget al ${budgetConsumedPct}%`);
          } else if (budgetConsumedPct >= 75) {
            score += 10;
            reasons.push(`budget al ${budgetConsumedPct}%`);
          }
        }

        if (userPlanned > 0) {
          score += 15;
          reasons.push(`${Math.round(userPlanned * 10) / 10}h pianificate`);
        }

        if (daysSinceLastUpdate === null) {
          score += 10;
          reasons.push('nessun aggiornamento');
        } else if (daysSinceLastUpdate > 14) {
          score += 10;
          reasons.push(`fermo da ${Math.floor(daysSinceLastUpdate / 7)} settimane`);
        }

        // Soglie tarate sul massimo reale (100).
        let bucket: FocusItem['bucket'] = 'ongoing';
        if (score >= 50) bucket = 'urgent';
        else if (score >= 25) bucket = 'soon';

        return {
          projectId: p.id,
          projectName: p.name,
          clientName: (p.clients as any)?.name ?? null,
          area: p.area,
          endDate: p.end_date,
          daysToDeadline,
          budgetConsumedPct,
          userPlannedHours: Math.round(userPlanned * 10) / 10,
          nextActivity,
          daysSinceLastUpdate,
          focusScore: score,
          bucket,
          reasons,
        };
      });


      const filtered = items.filter((i) => i.focusScore > 0);
      filtered.sort((a, b) => b.focusScore - a.focusScore);

      // Fallback: if empty, return top 5 by user planned hours
      if (filtered.length === 0) {
        const fallback = items
          .filter((i) => i.userPlannedHours > 0)
          .sort((a, b) => b.userPlannedHours - a.userPlannedHours)
          .slice(0, 5)
          .map((i) => ({ ...i, bucket: 'ongoing' as const }));
        return fallback;
      }

      return filtered.slice(0, 7);
    },
  });
};

// ────────────────────────────────────────────────────────────────────────────
// Lista unificata progetti + task
// ────────────────────────────────────────────────────────────────────────────

export interface FocusRowProject {
  kind: 'project';
  id: string;
  score: number;
  bucket: FocusItem['bucket'];
  reasons: string[];
  project: FocusItem;
}

export interface FocusRowTask {
  kind: 'task';
  id: string;
  score: number;
  bucket: FocusItem['bucket'];
  reasons: string[];
  task: MyTask;
}

export type FocusRow = FocusRowProject | FocusRowTask;

const TASK_PRIORITY_BONUS: Record<string, number> = { high: 20, medium: 10, low: 0 };

/** Punteggio + motivi di una task, con bonus se il progetto è già urgente. */
export function scoreTask(
  task: MyTask,
  today: Date,
  urgentProjectIds: Set<string>
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  const bucket = myTaskBucket(task.due_date, today);
  if (bucket === 'overdue') {
    const days = differenceInCalendarDays(today, new Date(`${task.due_date!.slice(0, 10)}T00:00:00`));
    score += 55;
    reasons.push(days === 1 ? 'in ritardo di 1 giorno' : `in ritardo di ${days} giorni`);
  } else if (bucket === 'today') {
    score += 45;
    reasons.push('scade oggi');
  } else if (bucket === 'tomorrow') {
    score += 35;
    reasons.push('scade domani');
  } else if (bucket === 'this_week') {
    score += 25;
    reasons.push(`scade ${weekdayLabel(task.due_date!.slice(0, 10))}`);
  } else if (bucket === 'later') {
    score += 5;
  }

  const prioBonus = TASK_PRIORITY_BONUS[task.priority] ?? 0;
  score += prioBonus;
  if (task.priority === 'high') reasons.push('priorità alta');

  if (urgentProjectIds.has(task.project_id)) {
    score += 10;
    reasons.push('progetto urgente');
  }

  if (task.status === 'in_progress') reasons.push('in corso');

  return { score, reasons };
}

/**
 * Focus della settimana: progetti e task in un'unica lista ordinata per punteggio,
 * con i motivi che spiegano la posizione.
 */
export const useWeekFocusRows = (userId: string | null | undefined) => {
  const projectsQuery = useWeeklyFocus(userId);
  const tasksQuery = useMyTasks(userId);

  const today = new Date();
  const projectItems = projectsQuery.data ?? [];
  const tasks = tasksQuery.data ?? [];

  const urgentProjectIds = new Set(
    projectItems.filter((p) => p.bucket === 'urgent').map((p) => p.projectId)
  );

  const rows: FocusRow[] = [
    ...projectItems.map<FocusRowProject>((p) => ({
      kind: 'project',
      id: `project-${p.projectId}`,
      score: p.focusScore,
      bucket: p.bucket,
      reasons: p.reasons,
      project: p,
    })),
    ...tasks.map<FocusRowTask>((t) => {
      const { score, reasons } = scoreTask(t, today, urgentProjectIds);
      const bucket: FocusItem['bucket'] = score >= 50 ? 'urgent' : score >= 25 ? 'soon' : 'ongoing';
      return { kind: 'task', id: `task-${t.id}`, score, bucket, reasons, task: t };
    }),
  ].sort((a, b) => b.score - a.score);

  return {
    rows,
    isLoading: projectsQuery.isLoading || tasksQuery.isLoading,
  };
};

// ────────────────────────────────────────────────────────────────────────────
// Ore da recuperare (pianificate nel passato e mai confermate)
// ────────────────────────────────────────────────────────────────────────────

export interface RecoverDay {
  date: string;
  hours: number;
  activities: { name: string; projectName: string | null; hours: number }[];
}

export interface HoursToRecover {
  /** Giorni passati della settimana corrente e delle settimane precedenti del mese in corso. */
  days: RecoverDay[];
  totalHours: number;
  /** Ore non confermate del mese precedente (blocco ancora aperto). */
  previousMonthHours: number;
  previousMonthCount: number;
}

export const useHoursToRecover = (userId: string | null | undefined) => {
  return useQuery({
    queryKey: ['hours-to-recover', userId],
    enabled: !!userId,
    staleTime: 2 * 60 * 1000,
    queryFn: async (): Promise<HoursToRecover> => {
      const empty: HoursToRecover = {
        days: [],
        totalHours: 0,
        previousMonthHours: 0,
        previousMonthCount: 0,
      };
      if (!userId) return empty;

      const today = new Date();
      const todayStr = format(today, 'yyyy-MM-dd');
      const monthStart = format(startOfMonth(today), 'yyyy-MM-dd');
      const prevMonthStart = format(startOfMonth(subMonths(today, 1)), 'yyyy-MM-dd');
      const prevMonthEnd = format(endOfMonth(subMonths(today, 1)), 'yyyy-MM-dd');

      const { data, error } = await supabase
        .from('activity_time_tracking')
        .select(
          'scheduled_date, scheduled_start_time, scheduled_end_time, actual_start_time, actual_end_time, budget_items(activity_name, projects:project_id(name))'
        )
        .eq('user_id', userId)
        .gte('scheduled_date', prevMonthStart)
        .lt('scheduled_date', todayStr)
        .limit(1000);

      if (error) throw error;

      const unconfirmed = (data ?? []).filter(
        (r: any) =>
          r.scheduled_start_time &&
          r.scheduled_end_time &&
          (!r.actual_start_time || !r.actual_end_time)
      ) as any[];

      const dayMap = new Map<string, RecoverDay>();
      let previousMonthHours = 0;
      let previousMonthCount = 0;

      for (const r of unconfirmed) {
        const hours = calculateSafeHours(r.scheduled_start_time, r.scheduled_end_time, true);
        const date: string = r.scheduled_date;

        if (date >= prevMonthStart && date <= prevMonthEnd) {
          previousMonthHours += hours;
          previousMonthCount += 1;
          continue;
        }
        if (date < monthStart) continue;

        if (!dayMap.has(date)) dayMap.set(date, { date, hours: 0, activities: [] });
        const entry = dayMap.get(date)!;
        entry.hours += hours;
        entry.activities.push({
          name: r.budget_items?.activity_name ?? 'Attività',
          projectName: r.budget_items?.projects?.name ?? null,
          hours: Math.round(hours * 10) / 10,
        });
      }

      const days = Array.from(dayMap.values())
        .map((d) => ({ ...d, hours: Math.round(d.hours * 10) / 10 }))
        .sort((a, b) => (a.date < b.date ? 1 : -1));

      return {
        days,
        totalHours: Math.round(days.reduce((s, d) => s + d.hours, 0) * 10) / 10,
        previousMonthHours: Math.round(previousMonthHours * 10) / 10,
        previousMonthCount,
      };
    },
  });
};

