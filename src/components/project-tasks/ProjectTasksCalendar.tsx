import { useMemo, useState } from 'react';
import {
  addMonths, addWeeks, eachDayOfInterval, endOfMonth, endOfWeek, format,
  isSameMonth, isToday, startOfMonth, startOfWeek, subMonths, subWeeks,
} from 'date-fns';
import { it } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Repeat } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  PRIORITY_LABELS, STATUS_LABELS, type ProjectTask, type ProjectTaskPriority,
} from '@/lib/projectTaskSort';

export type TaskCalendarMode = 'month' | 'week';

const priorityDot: Record<ProjectTaskPriority, string> = {
  high: 'bg-destructive',
  medium: 'bg-primary',
  low: 'bg-muted-foreground',
};

interface Props {
  tasks: ProjectTask[];
  mode: TaskCalendarMode;
  onModeChange: (mode: TaskCalendarMode) => void;
  onSelectTask?: (task: ProjectTask) => void;
  nameById: Map<string, string>;
}

export const ProjectTasksCalendar = ({ tasks, mode, onModeChange, onSelectTask, nameById }: Props) => {
  const [anchor, setAnchor] = useState<Date>(new Date());

  const { days, rangeLabel } = useMemo(() => {
    if (mode === 'week') {
      const start = startOfWeek(anchor, { weekStartsOn: 1 });
      const end = endOfWeek(anchor, { weekStartsOn: 1 });
      return {
        days: eachDayOfInterval({ start, end }),
        rangeLabel: `${format(start, 'd MMM', { locale: it })} – ${format(end, 'd MMM yyyy', { locale: it })}`,
      };
    }
    const start = startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(anchor), { weekStartsOn: 1 });
    return {
      days: eachDayOfInterval({ start, end }),
      rangeLabel: format(anchor, 'MMMM yyyy', { locale: it }),
    };
  }, [anchor, mode]);

  const tasksByDay = useMemo(() => {
    const map = new Map<string, ProjectTask[]>();
    tasks.forEach((t) => {
      if (!t.due_date) return;
      const key = t.due_date.slice(0, 10);
      map.set(key, [...(map.get(key) || []), t]);
    });
    return map;
  }, [tasks]);

  const undated = useMemo(() => tasks.filter((t) => !t.due_date), [tasks]);

  const shift = (dir: -1 | 1) =>
    setAnchor((prev) =>
      mode === 'week'
        ? (dir === 1 ? addWeeks(prev, 1) : subWeeks(prev, 1))
        : (dir === 1 ? addMonths(prev, 1) : subMonths(prev, 1))
    );

  const weekDays = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

  const TaskChip = ({ task }: { task: ProjectTask }) => (
    <button
      type="button"
      onClick={() => onSelectTask?.(task)}
      title={`${task.title} · ${PRIORITY_LABELS[task.priority]} · ${STATUS_LABELS[task.status]}${
        task.assignee_id ? ` · ${nameById.get(task.assignee_id) || ''}` : ''
      }`}
      className={cn(
        'w-full text-left flex items-center gap-1 rounded px-1.5 py-1 text-[11px] leading-tight',
        'bg-muted/60 hover:bg-muted transition-colors',
        task.status === 'done' && 'opacity-60 line-through'
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', priorityDot[task.priority])} />
      <span className="truncate">{task.title}</span>
      {task.recurrence_rule !== 'none' && <Repeat className="h-2.5 w-2.5 shrink-0 text-muted-foreground" />}
    </button>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => shift(-1)} aria-label="Periodo precedente">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" className="h-8" onClick={() => setAnchor(new Date())}>Oggi</Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => shift(1)} aria-label="Periodo successivo">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="ml-2 text-sm font-medium capitalize">{rangeLabel}</span>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-border p-0.5">
          {(['month', 'week'] as TaskCalendarMode[]).map((m) => (
            <Button
              key={m}
              variant={mode === m ? 'default' : 'ghost'}
              size="sm"
              className="h-7 text-xs"
              onClick={() => onModeChange(m)}
            >
              {m === 'month' ? 'Mese' : 'Settimana'}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px rounded-lg border border-border bg-border overflow-hidden">
        {weekDays.map((d) => (
          <div key={d} className="bg-muted/40 px-2 py-1 text-center text-[11px] font-medium text-muted-foreground">
            {d}
          </div>
        ))}
        {days.map((day) => {
          const key = format(day, 'yyyy-MM-dd');
          const dayTasks = tasksByDay.get(key) || [];
          const outside = mode === 'month' && !isSameMonth(day, anchor);
          return (
            <div
              key={key}
              className={cn(
                'bg-card p-1.5 space-y-1 align-top',
                mode === 'week' ? 'min-h-[180px]' : 'min-h-[104px]',
                outside && 'bg-muted/20'
              )}
            >
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    'text-[11px]',
                    outside ? 'text-muted-foreground/60' : 'text-muted-foreground',
                    isToday(day) && 'font-semibold text-primary'
                  )}
                >
                  {format(day, 'd')}
                </span>
                {dayTasks.length > 0 && (
                  <span className="text-[10px] text-muted-foreground">{dayTasks.length}</span>
                )}
              </div>
              <div className="space-y-1">
                {dayTasks.slice(0, mode === 'week' ? 12 : 4).map((t) => (
                  <TaskChip key={t.id} task={t} />
                ))}
                {dayTasks.length > (mode === 'week' ? 12 : 4) && (
                  <span className="block px-1 text-[10px] text-muted-foreground">
                    +{dayTasks.length - (mode === 'week' ? 12 : 4)} altre
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {undated.length > 0 && (
        <div className="rounded-lg border border-border p-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium">Senza scadenza</span>
            <Badge variant="outline" className="text-[10px]">{undated.length}</Badge>
          </div>
          <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
            {undated.map((t) => <TaskChip key={t.id} task={t} />)}
          </div>
        </div>
      )}

      {tasks.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-4">
          Nessuna task corrisponde ai filtri selezionati.
        </p>
      )}
    </div>
  );
};
