import { useMemo, useState } from 'react';
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

const STATUS_ORDER: ProjectTaskStatus[] = ['todo', 'in_progress', 'done'];
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

export const ProjectTasksAgenda = ({ tasks, nameById, onSelectTask, onTaskDrop }: Props) => {
  const [day, setDay] = useState<Date>(new Date());
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const dndEnabled = !!onTaskDrop;
  const dayKey = format(day, 'yyyy-MM-dd');

  const taskById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

  /** Task del giorno + scadute non completate + senza scadenza, mantenendo l'ordine ricevuto. */
  const { dayTasks, overdue, undated } = useMemo(() => {
    const inDay: ProjectTask[] = [];
    const late: ProjectTask[] = [];
    const none: ProjectTask[] = [];
    tasks.forEach((t) => {
      const due = t.due_date ? t.due_date.slice(0, 10) : null;
      if (!due) none.push(t);
      else if (due === dayKey) inDay.push(t);
      else if (due < dayKey && t.status !== 'done') late.push(t);
    });
    return { dayTasks: inDay, overdue: late, undated: none };
  }, [tasks, dayKey]);

  const dropHandlers = (zoneKey: string, changes: TaskDropChanges) =>
    dndEnabled
      ? {
        onDragOver: (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverKey(zoneKey); },
        onDragLeave: () => setDragOverKey((k) => (k === zoneKey ? null : k)),
        onDrop: (e: React.DragEvent) => {
          e.preventDefault();
          setDragOverKey(null);
          const id = getDragTaskId(e);
          const task = id ? taskById.get(id) : null;
          if (task) onTaskDrop?.(task, changes);
        },
      }
      : {};

  const TaskRow = ({ task }: { task: ProjectTask }) => (
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
            {task.assignee_id ? (nameById.get(task.assignee_id) || 'Utente') : 'Non assegnata'}
          </span>
          {task.due_date && <span>{format(new Date(task.due_date), 'd MMM', { locale: it })}</span>}
          {task.recurrence_rule !== 'none' && <Repeat className="h-2.5 w-2.5" />}
        </span>
      </button>
      {dndEnabled && <GripVertical className="mt-1 h-3 w-3 shrink-0 text-muted-foreground/60" />}
    </div>
  );

  const Section = ({
    title, items, zoneKey, changes, emptyHint,
  }: { title: string; items: ProjectTask[]; zoneKey: string; changes: TaskDropChanges; emptyHint?: string }) => (
    <div
      className={cn(
        'rounded-lg border border-border p-2 space-y-1.5',
        dragOverKey === zoneKey && 'ring-2 ring-inset ring-primary bg-primary/5'
      )}
      {...dropHandlers(zoneKey, changes)}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium">{title}</span>
        <Badge variant="outline" className="text-[10px]">{items.length}</Badge>
      </div>
      {items.length > 0
        ? <div className="space-y-1">{items.map((t) => <TaskRow key={t.id} task={t} />)}</div>
        : <p className="text-[10px] text-muted-foreground">{emptyHint || 'Nessuna task'}</p>}
    </div>
  );

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
            items={dayTasks.filter((t) => t.status === status)}
            zoneKey={`status:${status}`}
            changes={{ status, due_date: dayKey }}
            emptyHint={dndEnabled ? 'Trascina qui per spostare in questo stato' : 'Nessuna task'}
          />
        ))}
      </div>

      {/* Raggruppamento per priorità */}
      <div className="grid gap-2 md:grid-cols-3">
        {PRIORITY_ORDER.map((priority) => (
          <Section
            key={priority}
            title={`Priorità ${PRIORITY_LABELS[priority]}`}
            items={dayTasks.filter((t) => t.priority === priority)}
            zoneKey={`prio:${priority}`}
            changes={{ priority, due_date: dayKey }}
            emptyHint={dndEnabled ? 'Trascina qui per cambiare priorità' : 'Nessuna task'}
          />
        ))}
      </div>

      {overdue.length > 0 && (
        <Section
          title="Scadute e ancora aperte"
          items={overdue}
          zoneKey="overdue"
          changes={{ due_date: dayKey }}
          emptyHint="Nessuna task scaduta"
        />
      )}

      {(undated.length > 0 || dndEnabled) && (
        <Section
          title="Senza scadenza"
          items={undated}
          zoneKey="undated"
          changes={{ due_date: null }}
          emptyHint="Trascina qui per rimuovere la scadenza"
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
