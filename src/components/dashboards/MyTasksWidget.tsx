import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import { CheckSquare, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { PRIORITY_LABELS, STATUS_LABELS, type ProjectTaskPriority, type ProjectTaskStatus } from '@/lib/projectTaskSort';
import {
  MY_TASK_BUCKET_LABELS,
  MY_TASK_BUCKET_ORDER,
  myTaskBucket,
  useCompleteMyTask,
  useMyTasks,
  type MyTask,
  type MyTaskBucket,
} from '@/hooks/useMyTasks';

const priorityClasses: Record<ProjectTaskPriority, string> = {
  high: 'bg-destructive/10 text-destructive border-destructive/30',
  medium: 'bg-primary/10 text-primary border-primary/30',
  low: 'bg-muted text-muted-foreground border-border',
};

const statusClasses: Record<ProjectTaskStatus, string> = {
  todo: 'bg-muted text-muted-foreground border-border',
  in_progress: 'bg-primary/10 text-primary border-primary/30',
  done: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30 dark:text-emerald-400',
};

const INITIAL_LIMIT = 10;

type SortKey = 'due_asc' | 'due_desc' | 'priority' | 'title';

const PRIORITY_WEIGHT: Record<ProjectTaskPriority, number> = { high: 0, medium: 1, low: 2 };

export const MyTasksWidget = ({ userId }: { userId?: string | null }) => {
  const navigate = useNavigate();
  const [includeDone, setIncludeDone] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('due_asc');
  const { data: tasks, isLoading } = useMyTasks(userId, includeDone);
  const completeTask = useCompleteMyTask();

  const filteredTasks = useMemo(() => {
    const list = tasks ?? [];
    const q = search.trim().toLowerCase();
    const filtered = q
      ? list.filter((t) =>
          [t.title, t.description ?? '', t.projectName, t.clientName ?? '']
            .join(' ')
            .toLowerCase()
            .includes(q)
        )
      : list;

    const sorted = [...filtered];
    sorted.sort((a, b) => {
      if (sortKey === 'title') return a.title.localeCompare(b.title, 'it');
      if (sortKey === 'priority') {
        const diff = PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority];
        if (diff !== 0) return diff;
      }
      // date comparison (tasks without due date always last)
      if (!!a.due_date !== !!b.due_date) return a.due_date ? -1 : 1;
      if (a.due_date && b.due_date && a.due_date !== b.due_date) {
        const asc = a.due_date < b.due_date ? -1 : 1;
        return sortKey === 'due_desc' ? -asc : asc;
      }
      return PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority];
    });
    return sorted;
  }, [tasks, search, sortKey]);

  const { grouped, counts, total } = useMemo(() => {
    const list = filteredTasks;
    const g = new Map<MyTaskBucket, MyTask[]>();
    const c: Partial<Record<MyTaskBucket, number>> = {};
    for (const t of list) {
      const b = myTaskBucket(t.due_date);
      if (!g.has(b)) g.set(b, []);
      g.get(b)!.push(t);
      c[b] = (c[b] ?? 0) + 1;
    }
    return { grouped: g, counts: c, total: list.length };
  }, [filteredTasks]);

  const visibleTasks = useMemo(
    () => (showAll ? filteredTasks : filteredTasks.slice(0, INITIAL_LIMIT)),
    [filteredTasks, showAll]
  );

  const visibleGrouped = useMemo(() => {
    const g = new Map<MyTaskBucket, MyTask[]>();
    for (const t of visibleTasks) {
      const b = myTaskBucket(t.due_date);
      if (!g.has(b)) g.set(b, []);
      g.get(b)!.push(t);
    }
    return g;
  }, [visibleTasks]);

  const summary = useMemo(() => {
    const parts: string[] = [];
    if (counts.overdue) parts.push(`${counts.overdue} in ritardo`);
    if (counts.today) parts.push(`${counts.today} oggi`);
    if (counts.tomorrow) parts.push(`${counts.tomorrow} domani`);
    return parts.length > 0 ? parts.join(' · ') : 'Nessuna scadenza imminente';
  }, [counts]);

  if (!userId) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2">
            <CheckSquare className="h-5 w-5 text-primary" />
            Le mie task
          </CardTitle>
          <CardDescription>{summary}</CardDescription>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Switch id="my-tasks-done" checked={includeDone} onCheckedChange={setIncludeDone} />
          <Label htmlFor="my-tasks-done" className="text-xs text-muted-foreground">
            Completate
          </Label>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : total === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Nessuna task assegnata</p>
        ) : (
          <>
            {MY_TASK_BUCKET_ORDER.filter((b) => (visibleGrouped.get(b)?.length ?? 0) > 0).map((bucket) => (
              <div key={bucket} className="space-y-2">
                <div className="flex items-center gap-2">
                  <p
                    className={cn(
                      'text-xs font-semibold uppercase tracking-wide',
                      bucket === 'overdue' ? 'text-destructive' : 'text-muted-foreground'
                    )}
                  >
                    {MY_TASK_BUCKET_LABELS[bucket]}
                  </p>
                  <Badge variant="outline" className="text-xs">
                    {grouped.get(bucket)?.length ?? 0}
                  </Badge>
                </div>
                <div className="space-y-2">
                  {(visibleGrouped.get(bucket) ?? []).map((task) => (
                    <div
                      key={task.id}
                      className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => navigate(`/projects/${task.project_id}/canvas?tab=tasks`)}
                    >
                      <div onClick={(e) => e.stopPropagation()} className="pt-0.5">
                        <Checkbox
                          checked={task.status === 'done'}
                          aria-label="Segna come completata"
                          onCheckedChange={(checked) =>
                            completeTask.mutate({
                              taskId: task.id,
                              projectId: task.project_id,
                              status: checked ? 'done' : 'todo',
                            })
                          }
                        />
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <p
                          className={cn(
                            'text-sm font-medium truncate',
                            task.status === 'done' && 'line-through text-muted-foreground'
                          )}
                        >
                          {task.title}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {task.projectName}
                          {task.clientName ? ` · ${task.clientName}` : ''}
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                          <Badge variant="outline" className={cn('text-xs', priorityClasses[task.priority])}>
                            {PRIORITY_LABELS[task.priority]}
                          </Badge>
                          <Badge variant="outline" className={cn('text-xs', statusClasses[task.status])}>
                            {STATUS_LABELS[task.status]}
                          </Badge>
                          {task.due_date && (
                            <span
                              className={cn(
                                'text-xs',
                                bucket === 'overdue' ? 'text-destructive font-medium' : 'text-muted-foreground'
                              )}
                            >
                              {format(parseISO(task.due_date.slice(0, 10)), 'd MMM yyyy', { locale: it })}
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {total > INITIAL_LIMIT && (
              <Button variant="ghost" size="sm" className="w-full" onClick={() => setShowAll((v) => !v)}>
                {showAll ? 'Mostra meno' : `Mostra tutte (${total})`}
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};
