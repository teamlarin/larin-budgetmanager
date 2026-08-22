import { memo, useCallback, useMemo, useState } from 'react';
import { addDays, format, isToday, subDays } from 'date-fns';
import { it } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, GripVertical, Repeat, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  PRIORITY_LABELS, STATUS_LABELS,
  type ProjectTask, type ProjectTaskPriority, type ProjectTaskStatus,
} from '@/lib/projectTaskSort';
import { getDragTaskId, setDragTaskId, type TaskDropChanges } from '@/lib/projectTaskDnd';
import { useIncrementalRender } from '@/hooks/useIncrementalRender';
import { Skeleton } from '@/components/ui/skeleton';

const STATUS_ORDER: ProjectTaskStatus[] = ['todo', 'in_progress', 'in_review', 'done'];
const PRIORITY_ORDER: ProjectTaskPriority[] = ['high', 'medium', 'low'];

const priorityDot: Record<ProjectTaskPriority, string> = {
  high: 'bg-destructive',
  medium: 'bg-primary',
  low: 'bg-muted-foreground',
};

interface Props {
  /** Task già filtrate, cercate e ordinate dal pannello. */
  tasks: ProjectTask[];
  nameById: Map<string, string>;
  onSelectTask?: (task: ProjectTask) => void;
  onTaskDrop?: (task: ProjectTask, changes: TaskDropChanges) => void;
}

/** Riga memoizzata a livello di modulo: con molte task evita rimontaggi a ogni render. */
const TaskRow = memo(({
  task, dndEnabled, assigneeName, onSelectTask,
}: {
  task: ProjectTask;
  dndEnabled: boolean;
  assigneeName?: string;
  onSelectTask?: (task: ProjectTask) => void;
}) => (
  <div
    draggable={dndEnabled}
    onDragStart={dndEnabled ? (e) => setDragTaskId(e, task.id) : undefined}
    className={cn(
      'flex items-start gap-2 rounded-md border border-border bg-card px-2 py-1.5',
      dndEnabled && 'cursor-grab active:cursor-grabbing',
      task.status === 'done' && 'opacity-70'
    )}
  >
    <span className={cn('mt-1.5 h-1.5 w-1.5 rounded-full shrink-0', priorityDot[task.priority])} />
    <button
      type="button"
      onClick={() => onSelectTask?.(task)}
      className="min-w-0 flex-1 text-left"
    >
      <span className={cn('block truncate text-xs font-medium', task.status === 'done' && 'line-through')}>
        {task.title}
      </span>
      <span className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <User className="h-2.5 w-2.5" />
          {task.assignee_id ? (assigneeName || 'Utente') : 'Non assegnata'}
        </span>
        {task.due_date && <span>{format(new Date(task.due_date), 'd MMM', { locale: it })}</span>}
        {task.recurrence_rule !== 'none' && <Repeat className="h-2.5 w-2.5" />}
      </span>
    </button>
    {dndEnabled && <GripVertical className="mt-1 h-3 w-3 shrink-0 text-muted-foreground/60" />}
  </div>
));
TaskRow.displayName = 'AgendaTaskRow';

interface SectionProps {
  title: string;
  items: ProjectTask[];
  zoneKey: string;
  emptyHint?: string;
  dndEnabled: boolean;
  active: boolean;
  nameById: Map<string, string>;
  onSelectTask?: (task: ProjectTask) => void;
  onDragOverZone: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragLeaveZone: (e: React.DragEvent<HTMLDivElement>) => void;
  onDropZone: (e: React.DragEvent<HTMLDivElement>) => void;
}

const Section = memo(({
  title, items, zoneKey, emptyHint, dndEnabled, active, nameById, onSelectTask,
  onDragOverZone, onDragLeaveZone, onDropZone,
}: SectionProps) => {
  // Rendering incrementale per sezione: primo blocco immediato, resto nei frame successivi.
  const { count, isRendering } = useIncrementalRender(items.length, { initial: 50, chunk: 50 });
  return (
  <div
    className={cn(
      'rounded-lg border border-border p-2 space-y-1.5',
      active && 'ring-2 ring-inset ring-primary bg-primary/5'
    )}
    {...(dndEnabled
      ? { 'data-zone': zoneKey, onDragOver: onDragOverZone, onDragLeave: onDragLeaveZone, onDrop: onDropZone }
      : {})}
  >
    <div className="flex items-center justify-between">
      <span className="text-xs font-medium">{title}</span>
      <Badge variant="outline" className="text-[10px]">{items.length}</Badge>
    </div>
    {items.length > 0
      ? (
        <div className="space-y-1">
          {items.slice(0, count).map((t) => (
            <TaskRow
              key={t.id}
              task={t}
              dndEnabled={dndEnabled}
              assigneeName={t.assignee_id ? nameById.get(t.assignee_id) : undefined}
              onSelectTask={onSelectTask}
            />
          ))}
          {isRendering && <Skeleton className="h-9 w-full" />}
        </div>
      )
      : <p className="text-[10px] text-muted-foreground">{emptyHint || 'Nessuna task'}</p>}
  </div>
  );
});
Section.displayName = 'AgendaSection';

export const ProjectTasksAgenda = ({ tasks, nameById, onSelectTask, onTaskDrop }: Props) => {
  const [day, setDay] = useState<Date>(new Date());
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const dndEnabled = !!onTaskDrop;
  const dayKey = format(day, 'yyyy-MM-dd');

  /**
   * Un solo passaggio sulle task: split giorno / scadute / senza scadenza,
   * più raggruppamento per stato e priorità e indice per id (per il drop).
   */
  const { dayTasks, overdue, undated, byStatus, byPriority, taskById } = useMemo(() => {
    const inDay: ProjectTask[] = [];
    const late: ProjectTask[] = [];
    const none: ProjectTask[] = [];
    const byId = new Map<string, ProjectTask>();
    const status: Record<ProjectTaskStatus, ProjectTask[]> = { todo: [], in_progress: [], in_review: [], done: [] };
    const priority: Record<ProjectTaskPriority, ProjectTask[]> = { high: [], medium: [], low: [] };
    for (const t of tasks) {
      byId.set(t.id, t);
      const due = t.due_date ? t.due_date.slice(0, 10) : null;
      if (!due) { none.push(t); continue; }
      if (due === dayKey) {
        inDay.push(t);
        status[t.status].push(t);
        priority[t.priority].push(t);
      } else if (due < dayKey && t.status !== 'done') {
        late.push(t);
      }
    }
    return { dayTasks: inDay, overdue: late, undated: none, byStatus: status, byPriority: priority, taskById: byId };
  }, [tasks, dayKey]);

  /** Handler unici delegati via data-zone: nessuna closure per sezione. */
  const zoneChanges = useCallback((zoneKey: string): TaskDropChanges | null => {
    if (zoneKey.startsWith('status:')) return { status: zoneKey.slice(7) as ProjectTaskStatus, due_date: dayKey };
    if (zoneKey.startsWith('prio:')) return { priority: zoneKey.slice(5) as ProjectTaskPriority, due_date: dayKey };
    if (zoneKey === 'overdue') return { due_date: dayKey };
    if (zoneKey === 'undated') return { due_date: null };
    return null;
  }, [dayKey]);

  const onDragOverZone = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const key = e.currentTarget.dataset.zone || null;
    setDragOverKey((prev) => (prev === key ? prev : key));
  }, []);

  const onDragLeaveZone = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    const key = e.currentTarget.dataset.zone;
    setDragOverKey((prev) => (prev === key ? null : prev));
  }, []);

  const onDropZone = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOverKey(null);
    const changes = zoneChanges(e.currentTarget.dataset.zone || '');
    const id = getDragTaskId(e);
    const task = id ? taskById.get(id) : null;
    if (task && changes) onTaskDrop?.(task, changes);
  }, [onTaskDrop, taskById, zoneChanges]);

  const sectionCommon = {
    dndEnabled,
    nameById,
    onSelectTask,
    onDragOverZone,
    onDragLeaveZone,
    onDropZone,
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1">
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setDay((d) => subDays(d, 1))} aria-label="Giorno precedente">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" className="h-8" onClick={() => setDay(new Date())}>Oggi</Button>
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setDay((d) => addDays(d, 1))} aria-label="Giorno successivo">
          <ChevronRight className="h-4 w-4" />
        </Button>
        <span className={cn('ml-2 text-sm font-medium capitalize', isToday(day) && 'text-primary')}>
          {format(day, 'EEEE d MMMM yyyy', { locale: it })}
        </span>
        <Badge variant="outline" className="ml-1 text-[10px]">{dayTasks.length} in agenda</Badge>
      </div>

      {dndEnabled && (
        <p className="text-xs text-muted-foreground">
          Trascina una task su un gruppo di stato per cambiarne lo stato, o su una fascia di priorità per riclassificarla.
        </p>
      )}

      {/* Raggruppamento per stato */}
      <div className="grid gap-2 md:grid-cols-3">
        {STATUS_ORDER.map((status) => (
          <Section
            key={status}
            title={STATUS_LABELS[status]}
            items={byStatus[status]}
            zoneKey={`status:${status}`}
            active={dragOverKey === `status:${status}`}
            emptyHint={dndEnabled ? 'Trascina qui per spostare in questo stato' : 'Nessuna task'}
            {...sectionCommon}
          />
        ))}
      </div>

      {/* Raggruppamento per priorità */}
      <div className="grid gap-2 md:grid-cols-3">
        {PRIORITY_ORDER.map((priority) => (
          <Section
            key={priority}
            title={`Priorità ${PRIORITY_LABELS[priority]}`}
            items={byPriority[priority]}
            zoneKey={`prio:${priority}`}
            active={dragOverKey === `prio:${priority}`}
            emptyHint={dndEnabled ? 'Trascina qui per cambiare priorità' : 'Nessuna task'}
            {...sectionCommon}
          />
        ))}
      </div>

      {overdue.length > 0 && (
        <Section
          title="Scadute e ancora aperte"
          items={overdue}
          zoneKey="overdue"
          active={dragOverKey === 'overdue'}
          emptyHint="Nessuna task scaduta"
          {...sectionCommon}
        />
      )}

      {(undated.length > 0 || dndEnabled) && (
        <Section
          title="Senza scadenza"
          items={undated}
          zoneKey="undated"
          active={dragOverKey === 'undated'}
          emptyHint="Trascina qui per rimuovere la scadenza"
          {...sectionCommon}
        />
      )}

      {tasks.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-4">
          Nessuna task corrisponde ai filtri selezionati.
        </p>
      )}
    </div>
  );
};
