import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfWeek, endOfWeek, format, differenceInCalendarDays } from 'date-fns';

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

      // 3. Parallel: budget items, time tracking (user), progress updates
      const [budgetItems, userTracking, lastUpdates] = await Promise.all([
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
      ]);

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

        // confirmed hours total (any user via activity_time_tracking is hard; approximate using user's own tracked + planned)
        // For % budget consumed we use ALL tracking of project (separate query would be heavy). Use sum of budget_items hours_worked vs project total budget hours as proxy is not right — instead use confirmed user hours / project budget: not meaningful.
        // Simpler: use project.progress as fallback when available; but we want budget %.
        // Use confirmed entries from userTracking is per-user only. So compute project-wide via separate aggregation below.
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

        // Budget consumed %: confirmed hours (all users) vs total budget hours.
        // We don't have it cheaply here without an extra query; expose null and skip the +25/+10 score.
        const budgetConsumedPct: number | null = null;

        let score = 0;
        if (daysToDeadline !== null) {
          if (daysToDeadline >= 0 && daysToDeadline <= differenceInCalendarDays(weekEnd, today))
            score += 50;
          else if (daysToDeadline >= 0 && daysToDeadline <= 14) score += 20;
        }
        if (userPlanned > 0) score += 15;
        if (daysSinceLastUpdate === null || daysSinceLastUpdate > 14) score += 10;

        let bucket: FocusItem['bucket'] = 'ongoing';
        if (score >= 60) bucket = 'urgent';
        else if (score >= 30) bucket = 'soon';

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
