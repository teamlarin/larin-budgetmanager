import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addWeeks, eachDayOfInterval, endOfWeek, format, isWeekend, startOfWeek } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { calculateSafeHours } from '@/lib/timeUtils';
import { getEffectiveContract, ContractPeriodRow } from '@/lib/contractPeriods';
import {
  buildCapacityBreakdown,
  grossCapacityHours,
  isAbsenceProjectName,
  type CapacityBreakdown,
} from '@/lib/capacity';
import type { ProjectTaskPriority, ProjectTaskStatus } from '@/lib/projectTaskSort';
import { sortMyTasks } from '@/hooks/useMyTasks';

const EXCLUDED_AREAS = ['struttura', 'sales'];

export interface TeamWeekSlot {
  id: string;
  projectId: string;
  projectName: string;
  startTime: string | null;
  endTime: string | null;
  hours: number;
  confirmed: boolean;
  absence: boolean;
}

export interface TeamWeekDay {
  date: string; // yyyy-MM-dd
  plannedHours: number;
  confirmedHours: number;
  absenceHours: number;
  segments: { projectId: string; projectName: string; hours: number }[];
  slots: TeamWeekSlot[];
}

export interface TeamWeekProjectRow {
  projectId: string;
  projectName: string;
  plannedHours: number;
  confirmedHours: number;
  /** Slot pianificati della settimana, per la riassegnazione. */
  entryIds: string[];
}

export interface TeamWeekTask {
  id: string;
  title: string;
  projectId: string;
  projectName: string;
  status: ProjectTaskStatus;
  priority: ProjectTaskPriority;
  due_date: string | null;
}

export interface TeamWeekMember extends CapacityBreakdown {
  userId: string;
  fullName: string;
  title: string | null;
  area: string | null;
  levelName: string | null;
  /** Ore pianificate in giorni già passati e mai confermate. */
  unconfirmedPastHours: number;
  byDay: TeamWeekDay[];
  byProject: TeamWeekProjectRow[];
  tasks: TeamWeekTask[];
}

export interface TeamWeekResult {
  weekStart: Date;
  weekEnd: Date;
  members: TeamWeekMember[];
}

const round = (n: number) => Math.round(n * 10) / 10;

export function useTeamWeek(weekOffset: number, filterUserIds?: string[]) {
  const base = addWeeks(new Date(), weekOffset);
  const weekStart = startOfWeek(base, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(base, { weekStartsOn: 1 });
  const fromStr = format(weekStart, 'yyyy-MM-dd');
  const toStr = format(weekEnd, 'yyyy-MM-dd');
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const query = useQuery({
    queryKey: ['team-week', fromStr, filterUserIds?.slice().sort().join(',') || 'all'],
    queryFn: async (): Promise<TeamWeekResult> => {
      let usersQuery = supabase
        .from('profiles')
        .select('id, full_name, first_name, last_name, title, area, level_id, levels:level_id(name)')
        .eq('approved', true)
        .is('deleted_at', null);

      if (filterUserIds && filterUserIds.length > 0) {
        usersQuery = usersQuery.in('id', filterUserIds);
      }

      const { data: usersBase } = await usersQuery;
      if (!usersBase) return { weekStart, weekEnd, members: [] };

      const { fetchProfilesCompensationMap } = await import('@/lib/profilesCompensation');
      const compMap = await fetchProfilesCompensationMap(usersBase.map(u => u.id));

      const users = usersBase
        .filter(u => !EXCLUDED_AREAS.includes(u.area || ''))
        .map(u => ({
          ...u,
          contract_hours: compMap.get(u.id)?.contract_hours ?? null,
          contract_hours_period: compMap.get(u.id)?.contract_hours_period ?? null,
        }));

      const userIds = users.map(u => u.id);
      if (userIds.length === 0) return { weekStart, weekEnd, members: [] };

      // Override contrattuali per periodo
      let contractPeriods: ContractPeriodRow[] = [];
      {
        const { data: cp } = await supabase
          .from('user_contract_periods')
          .select('user_id, start_date, end_date, contract_hours, contract_hours_period')
          .in('user_id', userIds);
        contractPeriods = (cp || []) as ContractPeriodRow[];
      }

      // Time tracking della settimana (paginato: limite Supabase 1000 righe)
      let entries: any[] = [];
      const pageSize = 1000;
      let offset = 0;
      let hasMore = true;
      while (hasMore) {
        const { data: page } = await supabase
          .from('activity_time_tracking')
          .select(
            'id, user_id, scheduled_date, scheduled_start_time, scheduled_end_time, actual_start_time, actual_end_time, budget_items(project_id, projects:project_id(id, name))'
          )
          .gte('scheduled_date', fromStr)
          .lte('scheduled_date', toStr)
          .order('id')
          .range(offset, offset + pageSize - 1);
        if (page && page.length > 0) {
          entries = entries.concat(page);
          offset += pageSize;
          hasMore = page.length === pageSize;
        } else {
          hasMore = false;
        }
      }

      // Task con scadenza nella settimana
      const { data: taskRows } = await supabase
        .from('project_tasks')
        .select(
          'id, title, status, priority, due_date, project_id, assignee_id, projects(name), project_task_assignees(user_id)'
        )
        .gte('due_date', fromStr)
        .lte('due_date', toStr);

      const businessDaysList = eachDayOfInterval({ start: weekStart, end: weekEnd }).filter(d => !isWeekend(d));
      const businessDays = businessDaysList.length;

      interface Acc {
        planned: number;
        confirmed: number;
        absence: number;
        unconfirmedPast: number;
        days: Map<string, TeamWeekDay>;
        projects: Map<string, TeamWeekProjectRow>;
        tasks: TeamWeekTask[];
      }

      const accs = new Map<string, Acc>();
      for (const id of userIds) {
        const days = new Map<string, TeamWeekDay>();
        for (const d of businessDaysList) {
          const key = format(d, 'yyyy-MM-dd');
          days.set(key, { date: key, plannedHours: 0, confirmedHours: 0, absenceHours: 0, segments: [] });
        }
        accs.set(id, {
          planned: 0,
          confirmed: 0,
          absence: 0,
          unconfirmedPast: 0,
          days,
          projects: new Map(),
          tasks: [],
        });
      }

      for (const entry of entries) {
        const acc = accs.get(entry.user_id);
        if (!acc) continue;
        const project = entry.budget_items?.projects || null;
        const projectId: string = project?.id || entry.budget_items?.project_id || 'unknown';
        const projectName: string = project?.name || 'Senza progetto';
        const absence = isAbsenceProjectName(projectName);

        const planned =
          entry.scheduled_start_time && entry.scheduled_end_time
            ? calculateSafeHours(entry.scheduled_start_time, entry.scheduled_end_time, true)
            : 0;
        const confirmed =
          entry.actual_start_time && entry.actual_end_time
            ? calculateSafeHours(entry.actual_start_time, entry.actual_end_time)
            : 0;

        const dateKey = (entry.scheduled_date || '').slice(0, 10);
        const day = acc.days.get(dateKey);

        if (absence) {
          // Le assenze scalano la capacità, non contano come carico
          acc.absence += confirmed || planned;
          if (day) day.absenceHours += confirmed || planned;
          continue;
        }

        acc.planned += planned;
        acc.confirmed += confirmed;
        if (planned > 0 && confirmed === 0 && dateKey && dateKey < todayStr) {
          acc.unconfirmedPast += planned;
        }

        if (day) {
          day.plannedHours += planned;
          day.confirmedHours += confirmed;
          const hours = confirmed || planned;
          if (hours > 0) {
            const seg = day.segments.find(s => s.projectId === projectId);
            if (seg) seg.hours += hours;
            else day.segments.push({ projectId, projectName, hours });
          }
        }

        if (planned > 0 || confirmed > 0) {
          const row =
            acc.projects.get(projectId) ||
            ({ projectId, projectName, plannedHours: 0, confirmedHours: 0, entryIds: [] } as TeamWeekProjectRow);
          row.plannedHours += planned;
          row.confirmedHours += confirmed;
          if (entry.id) row.entryIds.push(entry.id);
          acc.projects.set(projectId, row);
        }
      }

      for (const row of taskRows || []) {
        const links = ((row as any).project_task_assignees as { user_id: string }[] | null) || [];
        const ids = new Set<string>(links.map(l => l.user_id));
        if ((row as any).assignee_id) ids.add((row as any).assignee_id);
        for (const uid of ids) {
          const acc = accs.get(uid);
          if (!acc) continue;
          acc.tasks.push({
            id: (row as any).id,
            title: (row as any).title,
            projectId: (row as any).project_id,
            projectName: (row as any).projects?.name || '—',
            status: (row as any).status,
            priority: (row as any).priority,
            due_date: (row as any).due_date,
          });
        }
      }

      const members: TeamWeekMember[] = users.map(user => {
        const acc = accs.get(user.id)!;
        const fullName =
          user.full_name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Utente';
        const eff = getEffectiveContract(
          user.id,
          weekStart,
          weekEnd,
          contractPeriods,
          user.contract_hours || 0,
          user.contract_hours_period || 'monthly'
        );
        const breakdown = buildCapacityBreakdown({
          capacityGross: grossCapacityHours(eff.hours, eff.period, businessDays),
          absenceHours: acc.absence,
          plannedHours: acc.planned,
          confirmedHours: acc.confirmed,
        });

        return {
          userId: user.id,
          fullName,
          title: user.title || null,
          area: user.area || null,
          levelName: (user as any).levels?.name || null,
          ...breakdown,
          unconfirmedPastHours: round(acc.unconfirmedPast),
          byDay: Array.from(acc.days.values()).map(d => ({
            ...d,
            plannedHours: round(d.plannedHours),
            confirmedHours: round(d.confirmedHours),
            absenceHours: round(d.absenceHours),
            segments: d.segments.map(s => ({ ...s, hours: round(s.hours) })),
          })),
          byProject: Array.from(acc.projects.values())
            .map(p => ({ ...p, plannedHours: round(p.plannedHours), confirmedHours: round(p.confirmedHours) }))
            .sort((a, b) => b.plannedHours + b.confirmedHours - (a.plannedHours + a.confirmedHours)),
          tasks: sortMyTasks(acc.tasks) as TeamWeekTask[],
        };
      });

      members.sort((a, b) => b.plannedPct - a.plannedPct);
      return { weekStart, weekEnd, members };
    },
  });

  return { ...query, weekStart, weekEnd };
}

/** Riassegna una task a un'altra persona (assignee singolo + tabella assegnatari). */
export function useReassign() {
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['team-week'] });
    queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
    queryClient.invalidateQueries({ queryKey: ['project-tasks'] });
    queryClient.invalidateQueries({ queryKey: ['workload-weekly'] });
  };

  const reassignTask = useMutation({
    mutationFn: async ({ taskId, toUserId }: { taskId: string; toUserId: string }) => {
      const { error } = await supabase
        .from('project_tasks')
        .update({ assignee_id: toUserId })
        .eq('id', taskId);
      if (error) throw error;
      await supabase.from('project_task_assignees').delete().eq('task_id', taskId);
      const { error: insErr } = await supabase
        .from('project_task_assignees')
        .insert({ task_id: taskId, user_id: toUserId });
      if (insErr) throw insErr;
    },
    onSuccess: invalidate,
  });

  const reassignEntries = useMutation({
    mutationFn: async ({ entryIds, toUserId }: { entryIds: string[]; toUserId: string }) => {
      if (entryIds.length === 0) return;
      for (let i = 0; i < entryIds.length; i += 100) {
        const chunk = entryIds.slice(i, i + 100);
        const { error } = await supabase
          .from('activity_time_tracking')
          .update({ user_id: toUserId })
          .in('id', chunk);
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
  });

  return { reassignTask, reassignEntries };
}
