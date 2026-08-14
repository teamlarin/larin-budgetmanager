import { useQuery } from '@tanstack/react-query';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { PRIORITY_LABELS, type ProjectTaskPriority } from '@/lib/projectTaskSort';

export const NO_TASK = '__none__';

export interface ActivityTask {
  id: string;
  title: string;
  status: string;
  priority: ProjectTaskPriority;
  due_date: string | null;
}

/** Task aperte collegate all'attività di budget selezionata. */
export function useActivityTasks(budgetItemId?: string | null, enabled = true) {
  return useQuery<ActivityTask[]>({
    queryKey: ['activity-tasks', budgetItemId],
    queryFn: async () => {
      if (!budgetItemId) return [];
      const { data, error } = await supabase
        .from('project_tasks')
        .select('id, title, status, priority, due_date')
        .eq('budget_item_id', budgetItemId)
        .neq('status', 'done')
        .order('due_date', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data || []) as ActivityTask[];
    },
    enabled: enabled && !!budgetItemId,
  });
}

interface Props {
  budgetItemId?: string | null;
  value: string | null;
  onChange: (taskId: string | null) => void;
  enabled?: boolean;
  label?: string;
}

/**
 * Select facoltativa della task collegata all'attività.
 * Non renderizza nulla quando l'attività non ha task aperte collegate.
 */
export function ActivityTaskSelect({ budgetItemId, value, onChange, enabled = true, label = 'Task (facoltativo)' }: Props) {
  const { data: tasks = [] } = useActivityTasks(budgetItemId, enabled);
  if (!budgetItemId || tasks.length === 0) return null;

  return (
    <div>
      <Label>{label}</Label>
      <Select
        value={value || NO_TASK}
        onValueChange={(v) => onChange(v === NO_TASK ? null : v)}
      >
        <SelectTrigger className="mt-1"><SelectValue placeholder="Nessuna task" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={NO_TASK}>Nessuna task</SelectItem>
          {tasks.map(task => (
            <SelectItem key={task.id} value={task.id}>
              <div className="flex items-center gap-2">
                <span className="truncate">{task.title}</span>
                <Badge variant="secondary" className="text-xs">{PRIORITY_LABELS[task.priority]}</Badge>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
