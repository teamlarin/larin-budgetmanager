import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { format, addDays, differenceInDays, startOfDay } from 'date-fns';
import { it } from 'date-fns/locale';
import { CalendarDays, GripVertical } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface ActivityGanttChartProps {
  projectId: string;
  projectStartDate?: string | null;
}

interface BudgetItem {
  id: string;
  activity_name: string;
  category: string;
  hours_worked: number;
  duration_days: number | null;
  display_order: number;
  start_day_offset: number | null;
}

interface ActivityWithDates extends BudgetItem {
  startDate: Date;
  endDate: Date;
  startDay: number;
}

const categoryColors: Record<string, string> = {
  Management: 'bg-blue-500',
  Design: 'bg-purple-500',
  Dev: 'bg-green-500',
  Content: 'bg-orange-500',
  Support: 'bg-gray-500',
  Altro: 'bg-slate-500',
};

// Draggable bar component for horizontal movement
const DraggableBar = ({
  activity,
  barColor,
  totalDays,
  onDragEnd,
}: {
  activity: ActivityWithDates;
  barColor: string;
  totalDays: number;
  onDragEnd: (activityId: string, newStartDay: number) => void;
}) => {
  const barRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);

  const barWidth = ((activity.duration_days || 1) / totalDays) * 100;
  const barLeft = ((activity.start_day_offset || 0) / totalDays) * 100;

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    
    const container = containerRef.current?.parentElement;
    if (!container) return;

    const startX = e.clientX;
    const containerWidth = container.getBoundingClientRect().width;
    const initialLeft = (activity.start_day_offset || 0);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaDays = Math.round((deltaX / containerWidth) * totalDays);
      const newStartDay = Math.max(0, initialLeft + deltaDays);
      setDragOffset(newStartDay - initialLeft);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      const newStartDay = Math.max(0, initialLeft + dragOffset);
      if (dragOffset !== 0) {
        onDragEnd(activity.id, newStartDay);
      }
      setDragOffset(0);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const currentLeft = barLeft + (dragOffset / totalDays) * 100;

  return (
    <div ref={containerRef} className="absolute inset-0">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              ref={barRef}
              onMouseDown={handleMouseDown}
              className={`absolute h-6 top-1 rounded ${barColor} ${
                isDragging ? 'opacity-100 shadow-lg ring-2 ring-primary' : 'opacity-80 hover:opacity-100'
              } transition-all cursor-grab active:cursor-grabbing`}
              style={{
                left: `${currentLeft}%`,
                width: `${Math.max(barWidth, 2)}%`,
              }}
            >
              <span className="text-xs text-white font-medium px-2 truncate block leading-6">
                {activity.activity_name}
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <div className="space-y-1">
              <p className="font-medium">{activity.activity_name}</p>
              <p className="text-xs">
                {format(activity.startDate, 'dd MMM yyyy', { locale: it })} - {format(activity.endDate, 'dd MMM yyyy', { locale: it })}
              </p>
              <p className="text-xs">Durata: {activity.duration_days} giorni • {activity.hours_worked}h</p>
              <p className="text-xs text-muted-foreground">Trascina per spostare la data di inizio</p>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
};

// Sortable row component
const SortableGanttRow = ({ 
  activity, 
  barColor, 
  totalDays, 
  todayPosition, 
  showTodayMarker,
  onBarDragEnd,
}: { 
  activity: ActivityWithDates;
  barColor: string;
  totalDays: number;
  todayPosition: number;
  showTodayMarker: boolean;
  onBarDragEnd: (activityId: string, newStartDay: number) => void;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: activity.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 'auto',
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className={`flex items-center min-h-[36px] ${isDragging ? 'bg-muted/50 rounded' : ''}`}
    >
      <div className="w-48 flex-shrink-0 pr-4 flex items-center gap-2">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded touch-none"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate" title={activity.activity_name}>
            {activity.activity_name}
          </p>
          <p className="text-xs text-muted-foreground">
            {activity.duration_days}g • {activity.hours_worked}h
          </p>
        </div>
      </div>
      <div className="flex-1 relative h-8 bg-muted/30 rounded min-w-[500px]">
        <DraggableBar
          activity={activity}
          barColor={barColor}
          totalDays={totalDays}
          onDragEnd={onBarDragEnd}
        />

        {/* Today marker */}
        {showTodayMarker && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10 pointer-events-none"
            style={{ left: `${(todayPosition / totalDays) * 100}%` }}
          />
        )}
      </div>
    </div>
  );
};

export const ActivityGanttChart = ({ projectId, projectStartDate }: ActivityGanttChartProps) => {
  const queryClient = useQueryClient();
  const [localActivities, setLocalActivities] = useState<BudgetItem[] | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const { data: activities = [], isLoading } = useQuery<BudgetItem[]>({
    queryKey: ['budget-items-gantt', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('budget_items')
        .select('id, activity_name, category, hours_worked, duration_days, display_order, start_day_offset')
        .eq('project_id', projectId)
        .eq('is_product', false)
        .order('display_order', { ascending: true });

      if (error) throw error;
      setLocalActivities(null);
      return data || [];
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async (reorderedItems: { id: string; display_order: number }[]) => {
      const updates = reorderedItems.map(item =>
        supabase
          .from('budget_items')
          .update({ display_order: item.display_order })
          .eq('id', item.id)
      );
      await Promise.all(updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget-items-gantt', projectId] });
      queryClient.invalidateQueries({ queryKey: ['budget-items', projectId] });
      toast.success('Ordine aggiornato');
    },
    onError: () => {
      setLocalActivities(null);
      toast.error('Errore nel riordinamento');
    },
  });

  const updateStartOffsetMutation = useMutation({
    mutationFn: async ({ activityId, startDayOffset }: { activityId: string; startDayOffset: number }) => {
      const { error } = await supabase
        .from('budget_items')
        .update({ start_day_offset: startDayOffset })
        .eq('id', activityId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget-items-gantt', projectId] });
      toast.success('Data di inizio aggiornata');
    },
    onError: () => {
      setLocalActivities(null);
      toast.error('Errore nell\'aggiornamento');
    },
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const currentItems = localActivities || activitiesWithDuration;
      const oldIndex = currentItems.findIndex((item) => item.id === active.id);
      const newIndex = currentItems.findIndex((item) => item.id === over.id);

      const newOrder = arrayMove(currentItems, oldIndex, newIndex);
      setLocalActivities(newOrder);

      const updates = newOrder.map((item, index) => ({
        id: item.id,
        display_order: index + 1,
      }));

      reorderMutation.mutate(updates);
    }
  };

  const handleBarDragEnd = (activityId: string, newStartDay: number) => {
    // Update local state immediately
    const currentItems = localActivities || activities;
    const updatedItems = currentItems.map(item =>
      item.id === activityId ? { ...item, start_day_offset: newStartDay } : item
    );
    setLocalActivities(updatedItems);
    
    // Save to database
    updateStartOffsetMutation.mutate({ activityId, startDayOffset: newStartDay });
  };

  const displayActivities = localActivities || activities;
  const activitiesWithDuration = displayActivities.filter(a => a.duration_days && a.duration_days > 0);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-muted rounded w-1/3"></div>
            <div className="h-40 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (activitiesWithDuration.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Timeline Attività
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            Nessuna attività con durata impostata. Imposta la durata in giorni per visualizzare la timeline.
          </p>
        </CardContent>
      </Card>
    );
  }

  const startDate = projectStartDate ? startOfDay(new Date(projectStartDate)) : startOfDay(new Date());
  
  // Calculate max end day to determine total timeline
  let maxEndDay = 0;
  const activitiesWithDates: ActivityWithDates[] = activitiesWithDuration.map(activity => {
    const activityStartDay = activity.start_day_offset || 0;
    const activityStart = addDays(startDate, activityStartDay);
    const activityEnd = addDays(activityStart, (activity.duration_days || 1) - 1);
    const endDay = activityStartDay + (activity.duration_days || 1);
    if (endDay > maxEndDay) maxEndDay = endDay;
    
    return {
      ...activity,
      startDate: activityStart,
      endDate: activityEnd,
      startDay: activityStartDay,
    };
  });

  const totalDays = Math.max(maxEndDay, 7); // Minimum 7 days for visibility
  const endDate = addDays(startDate, totalDays - 1);

  // Generate week markers
  const weeks: { start: Date; label: string }[] = [];
  let currentWeekStart = startDate;
  while (currentWeekStart <= endDate) {
    weeks.push({
      start: currentWeekStart,
      label: format(currentWeekStart, 'dd MMM', { locale: it }),
    });
    currentWeekStart = addDays(currentWeekStart, 7);
  }

  const today = startOfDay(new Date());
  const todayPosition = differenceInDays(today, startDate);
  const showTodayMarker = todayPosition >= 0 && todayPosition < totalDays;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5" />
          Timeline Attività
          <span className="text-xs font-normal text-muted-foreground ml-2">
            (⋮⋮ riordina righe • trascina barre per spostare date)
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Legend */}
          <div className="flex flex-wrap gap-3 mb-4">
            {Object.entries(categoryColors).map(([cat, color]) => (
              <div key={cat} className="flex items-center gap-1.5 text-xs">
                <div className={`w-3 h-3 rounded ${color}`}></div>
                <span className="text-muted-foreground">{cat}</span>
              </div>
            ))}
          </div>

          {/* Timeline header */}
          <div className="relative">
            <div className="flex border-b border-border pb-2 mb-2 overflow-x-auto">
              <div className="w-48 flex-shrink-0 text-sm font-medium text-muted-foreground">
                Attività
              </div>
              <div className="flex-1 relative min-w-[500px]">
                <div className="flex">
                  {weeks.map((week, i) => (
                    <div
                      key={i}
                      className="text-xs text-muted-foreground"
                      style={{ width: `${(7 / totalDays) * 100}%`, minWidth: '60px' }}
                    >
                      {week.label}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Activities with drag and drop */}
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={activitiesWithDates.map(a => a.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2 overflow-x-auto">
                  {activitiesWithDates.map((activity) => {
                    const barColor = categoryColors[activity.category] || categoryColors.Altro;

                    return (
                      <SortableGanttRow
                        key={activity.id}
                        activity={activity}
                        barColor={barColor}
                        totalDays={totalDays}
                        todayPosition={todayPosition}
                        showTodayMarker={showTodayMarker}
                        onBarDragEnd={handleBarDragEnd}
                      />
                    );
                  })}
                </div>
              </SortableContext>
            </DndContext>

            {/* Summary */}
            <div className="mt-6 pt-4 border-t border-border">
              <div className="flex flex-wrap gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Inizio progetto:</span>{' '}
                  <span className="font-medium">{format(startDate, 'dd MMM yyyy', { locale: it })}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Fine prevista:</span>{' '}
                  <span className="font-medium">{format(endDate, 'dd MMM yyyy', { locale: it })}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Durata totale:</span>{' '}
                  <span className="font-medium">{totalDays} giorni</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Ore totali:</span>{' '}
                  <span className="font-medium">{activitiesWithDuration.reduce((sum, a) => sum + a.hours_worked, 0)}h</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
