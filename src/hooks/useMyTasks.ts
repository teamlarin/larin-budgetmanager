import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { addDays, format, startOfWeek } from 'date-fns';
import type { ProjectTask, ProjectTaskPriority, ProjectTaskStatus } from '@/lib/projectTaskSort';

export interface MyTask extends ProjectTask {
  projectName: string;
  clientName: string | null;
}

export type MyTaskBucket =
  | 'overdue'
  | 'today'
  | 'tomorrow'
  | 'this_week'
  | 'later'
  | 'no_date';

export const MY_TASK_BUCKET_LABELS: Record<MyTaskBucket, string> = {
  overdue: 'In ritardo',
  today: 'Oggi',
  tomorrow: 'Domani',
  this_week: 'Questa settimana',
  later: 'Più avanti',
  no_date: 'Senza scadenza',
};

export const MY_TASK_BUCKET_ORDER: MyTaskBucket[] = [
  'overdue',
  'today',
  'tomorrow',
  'this_week',
  'later',
  'no_date',
];

const PRIORITY_WEIGHT: Record<ProjectTaskPriority, number> = { high: 0, medium: 1, low: 2 };

/** Bucket di scadenza di una task (date in formato yyyy-MM-dd, no timezone shift). */
export function myTaskBucket(dueDate: string | null, today = new Date()): MyTaskBucket {
  if (!dueDate) return 'no_date';
  const todayStr = format(today, 'yyyy-MM-dd');
  const tomorrowStr = format(addDays(today, 1), 'yyyy-MM-dd');
  const weekEndStr = format(addDays(startOfWeek(today, { weekStartsOn: 1 }), 6), 'yyyy-MM-dd');
  const d = dueDate.slice(0, 10);
  if (d < todayStr) return 'overdue';
  if (d === todayStr) return 'today';
  if (d === tomorrowStr) return 'tomorrow';
  if (d <= weekEndStr) return 'this_week';
  return 'later';
}

/** Ordina per scadenza crescente (senza scadenza in fondo) e poi per priorità. */
export function sortMyTasks<T extends { due_date: string | null; priority: ProjectTaskPriority }>(
  tasks: T[]
): T[] {
  return [...tasks].sort((a, b) => {
    if (!!a.due_date !== !!b.due_date) return a.due_date ? -1 : 1;
    if (a.due_date && b.due_date && a.due_date !== b.due_date) {
      return a.due_date < b.due_date ? -1 : 1;
    }
    return PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority];
  });
}

export function useMyTasks(userId: string | null | undefined, includeDone = false) {
  return useQuery({
    queryKey: ['my-tasks', userId, includeDone],
    enabled: !!userId,
    staleTime: 2 * 60 * 1000,
    queryFn: async (): Promise<MyTask[]> => {
      if (!userId) return [];
      let query = supabase
        .from('project_tasks')
        .select(
          'id, project_id, title, description, assignee_id, status, priority, due_date, budget_item_id, created_by, completed_at, created_at, updated_at, recurrence_rule, recurrence_interval, recurrence_end_date, recurrence_parent_id, projects(name, clients(name))'
        )
        .eq('assignee_id', userId)
        .limit(1000);

      if (!includeDone) query = query.neq('status', 'done');

      const { data, error } = await query;
      if (error) throw error;

      const mapped = (data ?? []).map((row: any) => ({
        ...(row as ProjectTask),
        projectName: row.projects?.name ?? 'Progetto',
        clientName: row.projects?.clients?.name ?? null,
      })) as MyTask[];

      return sortMyTasks(mapped);
    },
  });
}

export function useCompleteMyTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      taskId,
      status,
    }: {
      taskId: string;
      projectId: string;
      status: ProjectTaskStatus;
    }) => {
      const { error } = await supabase
        .from('project_tasks')
        .update({
          status,
          completed_at: status === 'done' ? new Date().toISOString() : null,
        })
        .eq('id', taskId);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['project-tasks', variables.projectId] });
    },
  });
}
