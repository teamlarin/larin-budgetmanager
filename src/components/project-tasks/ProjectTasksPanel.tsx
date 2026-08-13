import { useMemo, useState } from 'react';
import { format, parseISO, differenceInDays, startOfDay } from 'date-fns';
import { it } from 'date-fns/locale';
import { Plus, CalendarIcon, User, Trash2, Pencil, Link2, ListChecks, Repeat, X, Search } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { getProfileDisplayName } from '@/types/workflow';
import {
  filterAndSortProjectTasks, PRIORITY_LABELS, STATUS_LABELS, RECURRENCE_LABELS,
  type ProjectTask, type ProjectTaskPriority, type ProjectTaskSortKey, type ProjectTaskStatus,
} from '@/lib/projectTaskSort';
import { useProjectTasks, useProjectTeam, useWorkflowTaskOptions } from '@/hooks/useProjectTasks';
import { ProjectTaskFormSheet } from './ProjectTaskFormSheet';

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

const DueDate = ({ date, done }: { date: string; done: boolean }) => {
  const due = startOfDay(parseISO(date));
  const diff = differenceInDays(due, startOfDay(new Date()));
  const label = format(due, 'd MMM yyyy', { locale: it });
  const tone = done
    ? 'text-muted-foreground'
    : diff < 0
      ? 'text-destructive font-medium'
      : diff <= 2
        ? 'text-orange-600 dark:text-orange-400 font-medium'
        : 'text-muted-foreground';
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs', tone)}>
      <CalendarIcon className="h-3 w-3" />
      {!done && diff < 0 ? `Scaduta il ${label}` : label}
    </span>
  );
};

interface Props {
  projectId: string;
  readOnly?: boolean;
}

export const ProjectTasksPanel = ({ projectId, readOnly = false }: Props) => {
  const {
    tasks, isLoading, createTask, updateTask, deleteTask, bulkUpdateTasks, bulkDeleteTasks,
  } = useProjectTasks(projectId);
  const { profiles } = useProjectTeam(projectId);
  const workflowOptions = useWorkflowTaskOptions();

  const [statusFilter, setStatusFilter] = useState<ProjectTaskStatus | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<ProjectTaskPriority | 'all'>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');
  const [sortKey, setSortKey] = useState<ProjectTaskSortKey>('priority');
  const [search, setSearch] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectTask | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProjectTask | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    profiles.forEach((p) => map.set(p.id, getProfileDisplayName(p)));
    return map;
  }, [profiles]);

  const workflowById = useMemo(() => {
    const map = new Map<string, string>();
    workflowOptions.forEach((o) => map.set(o.id, `${o.title} — ${o.flowName}`));
    return map;
  }, [workflowOptions]);

  const visibleTasks = useMemo(
    () => filterAndSortProjectTasks(
      tasks,
      { status: statusFilter, priority: priorityFilter, assigneeId: assigneeFilter as string },
      sortKey,
      search,
      nameById
    ),
    [tasks, statusFilter, priorityFilter, assigneeFilter, sortKey, search, nameById]
  );

  const openCount = tasks.filter((t) => t.status !== 'done').length;

  const visibleIds = visibleTasks.map((t) => t.id);
  const selectedVisible = selectedIds.filter((id) => visibleIds.includes(id));
  const allVisibleSelected = visibleIds.length > 0 && selectedVisible.length === visibleIds.length;

  const toggleTask = (id: string, checked: boolean) =>
    setSelectedIds((prev) => (checked ? [...new Set([...prev, id])] : prev.filter((x) => x !== id)));

  const toggleAllVisible = (checked: boolean) =>
    setSelectedIds(checked ? [...new Set([...selectedIds, ...visibleIds])] : selectedIds.filter((id) => !visibleIds.includes(id)));

  const runBulk = (payload: { status?: ProjectTaskStatus; priority?: ProjectTaskPriority }) =>
    bulkUpdateTasks.mutate({ ids: selectedVisible, ...payload }, { onSuccess: () => setSelectedIds([]) });

  const handleSubmit = (input: Parameters<typeof createTask.mutate>[0]) => {
    if (editing) {
      updateTask.mutate({ id: editing.id, ...input }, { onSuccess: () => setSheetOpen(false) });
    } else {
      createTask.mutate(input, { onSuccess: () => setSheetOpen(false) });
    }
  };

  return (
    <Card variant="static">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <ListChecks className="h-5 w-5 text-primary" />
            Task
            <Badge variant="outline" className="text-xs font-normal">
              {openCount} aperte / {tasks.length} totali
            </Badge>
          </CardTitle>
          {!readOnly && (
            <Button size="sm" onClick={() => { setEditing(null); setSheetOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Nuova task
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Filtri */}
        <div className="flex flex-wrap gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cerca per titolo, descrizione, assegnatario"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 pl-8 pr-8"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Azzera ricerca"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as ProjectTaskStatus | 'all')}>
            <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti gli stati</SelectItem>
              {(Object.keys(STATUS_LABELS) as ProjectTaskStatus[]).map((s) => (
                <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={(v) => setPriorityFilter(v as ProjectTaskPriority | 'all')}>
            <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutte le priorità</SelectItem>
              {(Object.keys(PRIORITY_LABELS) as ProjectTaskPriority[]).map((p) => (
                <SelectItem key={p} value={p}>{PRIORITY_LABELS[p]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
            <SelectTrigger className="h-9 w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti gli assegnatari</SelectItem>
              <SelectItem value="unassigned">Non assegnate</SelectItem>
              {profiles.map((p) => (
                <SelectItem key={p.id} value={p.id}>{getProfileDisplayName(p)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sortKey} onValueChange={(v) => setSortKey(v as ProjectTaskSortKey)}>
            <SelectTrigger className="h-9 w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="priority">Ordina: priorità</SelectItem>
              <SelectItem value="due_date">Ordina: scadenza</SelectItem>
              <SelectItem value="status">Ordina: stato</SelectItem>
              <SelectItem value="created_at">Ordina: più recenti</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Azioni multiple */}
        {!readOnly && selectedVisible.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-2">
            <span className="text-sm font-medium px-1">{selectedVisible.length} selezionate</span>
            <Select value="" onValueChange={(v) => runBulk({ status: v as ProjectTaskStatus })}>
              <SelectTrigger className="h-8 w-[170px] text-xs"><SelectValue placeholder="Cambia stato" /></SelectTrigger>
              <SelectContent>
                {(Object.keys(STATUS_LABELS) as ProjectTaskStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value="" onValueChange={(v) => runBulk({ priority: v as ProjectTaskPriority })}>
              <SelectTrigger className="h-8 w-[170px] text-xs"><SelectValue placeholder="Cambia priorità" /></SelectTrigger>
              <SelectContent>
                {(Object.keys(PRIORITY_LABELS) as ProjectTaskPriority[]).map((p) => (
                  <SelectItem key={p} value={p}>{PRIORITY_LABELS[p]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="ghost" size="sm"
              className="h-8 text-destructive hover:text-destructive"
              onClick={() => setBulkDeleteOpen(true)}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" /> Elimina
            </Button>
            <Button variant="ghost" size="sm" className="h-8" onClick={() => setSelectedIds([])}>
              Annulla selezione
            </Button>
          </div>
        )}

        {/* Lista */}
        {isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        ) : visibleTasks.length === 0 ? (
          <div className="text-center py-10 text-sm text-muted-foreground">
            {tasks.length === 0
              ? 'Nessuna task per questo progetto. Creane una per iniziare a tracciare scadenze e priorità.'
              : 'Nessuna task corrisponde ai filtri selezionati.'}
          </div>
        ) : (
          <div className="divide-y divide-border rounded-lg border border-border">
            {visibleTasks.map((task) => (
              <div
                key={task.id}
                className="flex items-start gap-3 p-3 hover:bg-muted/40 transition-colors group"
              >
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn('text-sm font-medium', task.status === 'done' && 'line-through text-muted-foreground')}>
                      {task.title}
                    </span>
                    <Badge variant="outline" className={cn('text-xs', priorityClasses[task.priority])}>
                      {PRIORITY_LABELS[task.priority]}
                    </Badge>
                    <Badge variant="outline" className={cn('text-xs', statusClasses[task.status])}>
                      {STATUS_LABELS[task.status]}
                    </Badge>
                  </div>
                  {task.description && (
                    <p className="text-xs text-muted-foreground whitespace-pre-wrap">{task.description}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <User className="h-3 w-3" />
                      {task.assignee_id ? (nameById.get(task.assignee_id) || 'Utente') : 'Non assegnata'}
                    </span>
                    {task.due_date && <DueDate date={task.due_date} done={task.status === 'done'} />}
                    {task.workflow_flow_task_id && (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Link2 className="h-3 w-3" />
                        {workflowById.get(task.workflow_flow_task_id) || 'Task di workflow'}
                      </span>
                    )}
                  </div>
                </div>

                {!readOnly && (
                  <div className="flex items-center gap-1 shrink-0">
                    <Select
                      value={task.status}
                      onValueChange={(v) => updateTask.mutate({ id: task.id, status: v as ProjectTaskStatus })}
                    >
                      <SelectTrigger className="h-8 w-[120px] text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(STATUS_LABELS) as ProjectTaskStatus[]).map((s) => (
                          <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost" size="icon" className="h-8 w-8"
                      onClick={() => { setEditing(task); setSheetOpen(true); }}
                      aria-label="Modifica task"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(task)}
                      aria-label="Elimina task"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <ProjectTaskFormSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        task={editing}
        teamProfiles={profiles}
        workflowOptions={workflowOptions}
        onSubmit={handleSubmit}
        isSaving={createTask.isPending || updateTask.isPending}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare la task?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteTarget?.title}" verrà eliminata definitivamente. L'eventuale task di workflow collegata non verrà cancellata.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) deleteTask.mutate(deleteTarget.id);
                setDeleteTarget(null);
              }}
            >
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};
