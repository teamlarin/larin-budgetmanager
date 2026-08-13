import { addDays, addMonths, addWeeks, format, parseISO } from 'date-fns';

export type ProjectTaskStatus = 'todo' | 'in_progress' | 'done';
export type ProjectTaskPriority = 'high' | 'medium' | 'low';
export type ProjectTaskRecurrence = 'none' | 'daily' | 'weekly' | 'monthly';

export interface ProjectTask {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  assignee_id: string | null;
  status: ProjectTaskStatus;
  priority: ProjectTaskPriority;
  due_date: string | null;
  budget_item_id: string | null;
  created_by: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  recurrence_rule: ProjectTaskRecurrence;
  recurrence_interval: number;
  recurrence_end_date: string | null;
  recurrence_parent_id: string | null;
}

export const RECURRENCE_LABELS: Record<ProjectTaskRecurrence, string> = {
  none: 'Nessuna ricorrenza',
  daily: 'Giornaliera',
  weekly: 'Settimanale',
  monthly: 'Mensile',
};

/** Prossima data di scadenza secondo la regola di ricorrenza (formato yyyy-MM-dd). */
export function nextRecurrenceDate(
  fromDate: string,
  rule: ProjectTaskRecurrence,
  interval = 1
): string | null {
  if (rule === 'none') return null;
  const step = Math.max(1, Math.floor(interval || 1));
  const base = parseISO(fromDate);
  const next =
    rule === 'daily' ? addDays(base, step)
      : rule === 'weekly' ? addWeeks(base, step)
        : addMonths(base, step);
  return format(next, 'yyyy-MM-dd');
}

/** True se la prossima occorrenza va generata (ricorrenza attiva e non oltre la data di fine). */
export function shouldGenerateNextOccurrence(
  task: Pick<ProjectTask, 'recurrence_rule' | 'recurrence_interval' | 'recurrence_end_date' | 'due_date'>,
  today: string
): boolean {
  if (task.recurrence_rule === 'none') return false;
  const base = task.due_date || today;
  const next = nextRecurrenceDate(base, task.recurrence_rule, task.recurrence_interval);
  if (!next) return false;
  if (task.recurrence_end_date && next > task.recurrence_end_date) return false;
  return true;
}

/** Ambito di applicazione delle modifiche a una task ricorrente. */
export type RecurrenceEditScope = 'single' | 'this_and_future' | 'future_only';

/** Identificatore della serie ricorrente a cui appartiene la task. */
export function seriesIdOf(task: Pick<ProjectTask, 'id' | 'recurrence_parent_id'>): string {
  return task.recurrence_parent_id || task.id;
}

/** True se la task fa parte di una serie ricorrente (capostipite o occorrenza generata). */
export function isRecurringSeriesTask(
  task: Pick<ProjectTask, 'recurrence_rule' | 'recurrence_parent_id'>
): boolean {
  return task.recurrence_rule !== 'none' || !!task.recurrence_parent_id;
}

/** Campi che vengono propagati alle occorrenze future (non specifici della singola occorrenza). */
export const SERIES_PROPAGATED_FIELDS = [
  'title',
  'description',
  'assignee_id',
  'priority',
  'budget_item_id',
  'recurrence_rule',
  'recurrence_interval',
  'recurrence_end_date',
] as const;

export const PRIORITY_RANK: Record<ProjectTaskPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export const STATUS_RANK: Record<ProjectTaskStatus, number> = {
  todo: 0,
  in_progress: 1,
  done: 2,
};

export const STATUS_LABELS: Record<ProjectTaskStatus, string> = {
  todo: 'Da fare',
  in_progress: 'In corso',
  done: 'Fatto',
};

export const PRIORITY_LABELS: Record<ProjectTaskPriority, string> = {
  high: 'Alta',
  medium: 'Media',
  low: 'Bassa',
};

export type ProjectTaskSortKey = 'priority' | 'due_date' | 'status' | 'created_at';

export interface ProjectTaskFilters {
  status?: ProjectTaskStatus | 'all';
  priority?: ProjectTaskPriority | 'all';
  assigneeId?: string | 'all' | 'unassigned';
  budgetItemId?: string | 'all' | 'none';
}

const dueDateValue = (d: string | null): number =>
  d ? new Date(d).getTime() : Number.POSITIVE_INFINITY;

export function filterProjectTasks<T extends ProjectTask>(tasks: T[], filters: ProjectTaskFilters = {}): T[] {
  const { status = 'all', priority = 'all', assigneeId = 'all', budgetItemId = 'all' } = filters;
  return tasks.filter((t) => {
    if (status !== 'all' && t.status !== status) return false;
    if (priority !== 'all' && t.priority !== priority) return false;
    if (assigneeId === 'unassigned' && t.assignee_id) return false;
    if (assigneeId !== 'all' && assigneeId !== 'unassigned' && t.assignee_id !== assigneeId) return false;
    if (budgetItemId === 'none' && t.budget_item_id) return false;
    if (budgetItemId !== 'all' && budgetItemId !== 'none' && t.budget_item_id !== budgetItemId) return false;
    return true;
  });
}


export function sortProjectTasks<T extends ProjectTask>(tasks: T[], sortKey: ProjectTaskSortKey = 'priority'): T[] {
  const copy = [...tasks];
  copy.sort((a, b) => {
    if (sortKey === 'due_date') {
      const diff = dueDateValue(a.due_date) - dueDateValue(b.due_date);
      if (diff !== 0) return diff;
      return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    }
    if (sortKey === 'status') {
      const diff = STATUS_RANK[a.status] - STATUS_RANK[b.status];
      if (diff !== 0) return diff;
      return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    }
    if (sortKey === 'created_at') {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
    // priority (default): high -> medium -> low, then due_date ASC nulls last
    const pDiff = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (pDiff !== 0) return pDiff;
    return dueDateValue(a.due_date) - dueDateValue(b.due_date);
  });
  return copy;
}

/** Ricerca testuale su titolo, descrizione e nome assegnatario. */
export function searchProjectTasks<T extends ProjectTask>(
  tasks: T[],
  query: string,
  assigneeNames: Map<string, string> | Record<string, string> = {}
): T[] {
  const q = (query || '').trim().toLowerCase();
  if (!q) return tasks;
  const nameOf = (id: string | null): string => {
    if (!id) return '';
    return (assigneeNames instanceof Map ? assigneeNames.get(id) : assigneeNames[id]) || '';
  };
  return tasks.filter((t) =>
    t.title.toLowerCase().includes(q) ||
    (t.description || '').toLowerCase().includes(q) ||
    nameOf(t.assignee_id).toLowerCase().includes(q)
  );
}

export function filterAndSortProjectTasks<T extends ProjectTask>(
  tasks: T[],
  filters: ProjectTaskFilters = {},
  sortKey: ProjectTaskSortKey = 'priority',
  search = '',
  assigneeNames: Map<string, string> | Record<string, string> = {}
): T[] {
  return sortProjectTasks(
    searchProjectTasks(filterProjectTasks(tasks, filters), search, assigneeNames),
    sortKey
  );
}
