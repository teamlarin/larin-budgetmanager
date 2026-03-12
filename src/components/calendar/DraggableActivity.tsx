import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle } from 'lucide-react';
import { getCategoryBadgeColor } from '@/lib/categoryColors';
import { formatHours } from '@/lib/utils';
import { Activity } from './calendarTypes';

interface DraggableActivityProps {
  activity: Activity;
  onComplete: (activityId: string) => void;
}

export function DraggableActivity({ activity, onComplete }: DraggableActivityProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging
  } = useDraggable({
    id: activity.id,
    data: { activity }
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1
  };

  const isInternoOrConsumptive = activity.billing_type === 'interno' || activity.billing_type === 'consumptive';
  const totalScheduledHours = activity.confirmed_hours + activity.planned_hours;
  const isOverBudget = !isInternoOrConsumptive && totalScheduledHours > activity.hours_worked;
  const overagePercentage = activity.hours_worked > 0
    ? ((totalScheduledHours - activity.hours_worked) / activity.hours_worked * 100).toFixed(0)
    : 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`px-2.5 py-1.5 border rounded-md hover:bg-muted/50 transition-colors cursor-move mb-1 ${isOverBudget ? 'border-destructive bg-destructive/5' : ''}`}
    >
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-xs truncate">{activity.activity_name}</span>
            {isOverBudget && (
              <Badge variant="destructive" className="text-[9px] px-1 py-0 flex-shrink-0 leading-tight">
                +{overagePercentage}%
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Badge className={getCategoryBadgeColor(activity.category) + " text-[10px] px-1 py-0 leading-tight"}>
              {activity.category}
            </Badge>
            <span className="text-[10px] text-muted-foreground truncate">{activity.project_name}</span>
          </div>
          {!isInternoOrConsumptive && (
            <div className="flex gap-2 text-[10px] text-muted-foreground mt-0.5">
              <span>{formatHours(activity.hours_worked)}h</span>
              <span className="text-green-600 dark:text-green-400">{formatHours(activity.confirmed_hours)}h ✓</span>
              <span className={isOverBudget ? 'text-destructive font-medium' : 'text-blue-600 dark:text-blue-400'}>
                {formatHours(activity.planned_hours)}h ⏳
              </span>
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-5 w-5 p-0 flex-shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            onComplete(activity.id);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          title="Segna come completata"
        >
          <CheckCircle className="h-3.5 w-3.5 text-muted-foreground hover:text-green-600" />
        </Button>
      </div>
    </div>
  );
}
