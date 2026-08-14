import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Badge } from '@/components/ui/badge';
import { CalendarClock, GripVertical } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';

export interface PlannableTask {
  id: string;
  title: string;
  status: string;
  priority: 'high' | 'medium' | 'low';
  due_date: string | null;
  budget_item_id: string;
  activity_name: string;
  project_name: string;
  /** Minuti già pianificati nel calendario per questa task (settimana visualizzata). */
  plannedMinutes?: number;
}

const priorityLabel: Record<PlannableTask['priority'], string> = {
  high: 'Alta',
  medium: 'Media',
  low: 'Bassa',
};

const priorityDot: Record<PlannableTask['priority'], string> = {
  high: 'bg-destructive',
  medium: 'bg-primary',
  low: 'bg-muted-foreground',
};

interface Props {
  task: PlannableTask;
  disabled?: boolean;
}

/** Task trascinabile dalla sidebar direttamente su uno slot del calendario. */
export function DraggableTask({ task, disabled = false }: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `task-${task.id}`,
    data: { type: 'task', task },
    disabled,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(disabled ? {} : listeners)}
      {...attributes}
      className={`px-2.5 py-1.5 border rounded-md mb-1 transition-colors ${
        disabled ? 'opacity-60' : 'cursor-move hover:bg-muted/50'
      }`}
      title={disabled ? task.title : `${task.title} — trascina su uno slot del calendario per pianificarla`}
    >
      <div className="flex items-start gap-2">
        <span className={`mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0 ${priorityDot[task.priority]}`} />
        <div className="flex-1 min-w-0">
          <div className="font-medium text-xs truncate">{task.title}</div>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <Badge variant="outline" className="text-[9px] px-1 py-0 leading-tight">
              {priorityLabel[task.priority]}
            </Badge>
            <span className="text-[10px] text-muted-foreground truncate">{task.activity_name}</span>
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
            <span className="truncate">{task.project_name}</span>
            {task.due_date && (
              <span className="flex items-center gap-1 flex-shrink-0">
                <CalendarClock className="h-3 w-3" />
                {format(parseISO(task.due_date), 'd MMM', { locale: it })}
              </span>
            )}
          </div>
        </div>
        {!disabled && <GripVertical className="h-3.5 w-3.5 text-muted-foreground/60 flex-shrink-0 mt-0.5" />}
      </div>
    </div>
  );
}
