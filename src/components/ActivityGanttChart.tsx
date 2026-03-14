import { useState, useRef, useCallback } from 'react';
import { formatHours } from '@/lib/utils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { format, addDays, differenceInDays, startOfDay, startOfMonth, addMonths } from 'date-fns';
import { it } from 'date-fns/locale';
import { CalendarDays, GripVertical, Download, FileImage, FileText, AlertTriangle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { categoryColorsSolid, getCategorySolidColor } from '@/lib/categoryColors';

interface ActivityGanttChartProps {
  projectId: string;
  projectStartDate?: string | null;
  projectEndDate?: string | null;
  projectName?: string;
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

// Draggable bar component for horizontal movement
const DraggableBar = ({
  activity,
  barColor,
  totalDays,
  projectDurationDays,
  onDragEnd,
  isExporting
}: {
  activity: ActivityWithDates;
  barColor: string;
  totalDays: number;
  projectDurationDays: number | null;
  onDragEnd: (activityId: string, newStartDay: number) => void;
  isExporting: boolean;
}) => {
  const barRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [currentOffset, setCurrentOffset] = useState(activity.start_day_offset || 0);
  const dragDataRef = useRef({
    startX: 0,
    initialOffset: 0
  });
  const barWidth = (activity.duration_days || 1) / totalDays * 100;
  const barLeft = currentOffset / totalDays * 100;
  
  const activityEndDay = currentOffset + (activity.duration_days || 1);
  const exceedsProjectEnd = projectDurationDays !== null && activityEndDay > projectDurationDays;

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isExporting) return;
    e.preventDefault();
    e.stopPropagation();
    const container = containerRef.current?.parentElement;
    if (!container) return;
    setIsDragging(true);
    dragDataRef.current = {
      startX: e.clientX,
      initialOffset: currentOffset
    };
    const containerWidth = container.getBoundingClientRect().width;
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - dragDataRef.current.startX;
      const deltaDays = Math.round(deltaX / containerWidth * totalDays);
      const newOffset = Math.max(0, dragDataRef.current.initialOffset + deltaDays);
      setCurrentOffset(newOffset);
    };
    const handleMouseUp = (upEvent: MouseEvent) => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      const deltaX = upEvent.clientX - dragDataRef.current.startX;
      const deltaDays = Math.round(deltaX / containerWidth * totalDays);
      const newOffset = Math.max(0, dragDataRef.current.initialOffset + deltaDays);
      if (newOffset !== dragDataRef.current.initialOffset) {
        onDragEnd(activity.id, newOffset);
      }
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const barContent = (
    <div ref={containerRef} className="absolute inset-0">
      <div
        ref={barRef}
        onMouseDown={handleMouseDown}
        className={`absolute h-6 top-1 rounded ${barColor} ${isDragging ? 'opacity-100 shadow-lg ring-2 ring-primary' : 'opacity-80 hover:opacity-100'} ${exceedsProjectEnd ? 'ring-2 ring-red-500 ring-offset-1' : ''} transition-opacity ${isExporting ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'}`}
        style={{
          left: `${barLeft}%`,
          width: `${Math.max(barWidth, 2)}%`
        }}
      >
        <div className="flex items-center h-full">
          {exceedsProjectEnd && (
            <AlertTriangle className="h-3 w-3 text-white ml-1 flex-shrink-0" />
          )}
          <span className={`text-xs text-white font-medium truncate block leading-6 ${exceedsProjectEnd ? 'pl-1 pr-2' : 'px-2'}`}>
            {activity.activity_name}
          </span>
        </div>
      </div>
    </div>
  );

  if (isExporting) return barContent;

  return (
    <div ref={containerRef} className="absolute inset-0">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              ref={barRef}
              onMouseDown={handleMouseDown}
              className={`absolute h-6 top-1 rounded ${barColor} ${isDragging ? 'opacity-100 shadow-lg ring-2 ring-primary' : 'opacity-80 hover:opacity-100'} ${exceedsProjectEnd ? 'ring-2 ring-red-500 ring-offset-1' : ''} transition-opacity cursor-grab active:cursor-grabbing`}
              style={{
                left: `${barLeft}%`,
                width: `${Math.max(barWidth, 2)}%`
              }}
            >
              <div className="flex items-center h-full">
                {exceedsProjectEnd && (
                  <AlertTriangle className="h-3 w-3 text-white ml-1 flex-shrink-0" />
                )}
                <span className={`text-xs text-white font-medium truncate block leading-6 ${exceedsProjectEnd ? 'pl-1 pr-2' : 'px-2'}`}>
                  {activity.activity_name}
                </span>
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <div className="space-y-1">
              <p className="font-medium">{activity.activity_name}</p>
              <p className="text-xs">
                {format(activity.startDate, 'dd MMM yyyy', { locale: it })} - {format(activity.endDate, 'dd MMM yyyy', { locale: it })}
              </p>
              <p className="text-xs">Durata: {activity.duration_days} giorni • {formatHours(activity.hours_worked)}</p>
              {exceedsProjectEnd && (
                <p className="text-xs text-red-500 font-medium">⚠️ Supera la data di fine progetto</p>
              )}
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
  projectDurationDays,
  todayPosition,
  showTodayMarker,
  onBarDragEnd,
  isExporting
}: {
  activity: ActivityWithDates;
  barColor: string;
  totalDays: number;
  projectDurationDays: number | null;
  todayPosition: number;
  showTodayMarker: boolean;
  onBarDragEnd: (activityId: string, newStartDay: number) => void;
  isExporting: boolean;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({
    id: activity.id,
    disabled: isExporting
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 'auto'
  };

  return (
    <div ref={setNodeRef} style={style} className={`flex items-center min-h-[36px] ${isDragging ? 'bg-muted/50 rounded' : ''}`}>
      <div className={`${isExporting ? 'w-64' : 'w-48'} flex-shrink-0 pr-4 flex items-center gap-2`}>
        {!isExporting && (
          <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded touch-none">
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${isExporting ? '' : 'truncate'}`} title={activity.activity_name}>
            {activity.activity_name}
          </p>
          <p className="text-xs text-muted-foreground">
            {activity.duration_days}g • {activity.hours_worked}h
          </p>
        </div>
      </div>
      <div className="flex-1 relative h-8 bg-muted/30 rounded min-w-[500px]">
        <DraggableBar activity={activity} barColor={barColor} totalDays={totalDays} projectDurationDays={projectDurationDays} onDragEnd={onBarDragEnd} isExporting={isExporting} />
        {showTodayMarker && (
          <div className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10 pointer-events-none" style={{
            left: `${todayPosition / totalDays * 100}%`
          }} />
        )}
      </div>
    </div>
  );
};

// Generate time markers based on project duration
function generateTimeMarkers(startDate: Date, endDate: Date, totalDays: number) {
  if (totalDays > 60) {
    // Monthly markers
    const markers: { start: Date; label: string; widthDays: number }[] = [];
    let current = startOfMonth(startDate);
    if (current < startDate) current = startDate;
    
    while (current <= endDate) {
      const nextMonth = addMonths(startOfMonth(current), 1);
      const markerEnd = nextMonth > endDate ? endDate : addDays(nextMonth, -1);
      const widthDays = differenceInDays(markerEnd, current) + 1;
      
      const label = totalDays > 180
        ? format(current, 'MMM', { locale: it })
        : format(current, 'MMM yyyy', { locale: it });
      
      markers.push({ start: current, label, widthDays });
      current = nextMonth;
    }
    return markers;
  } else {
    // Weekly markers
    const markers: { start: Date; label: string; widthDays: number }[] = [];
    let currentWeekStart = startDate;
    while (currentWeekStart <= endDate) {
      const weekEnd = addDays(currentWeekStart, 6);
      const actualEnd = weekEnd > endDate ? endDate : weekEnd;
      const widthDays = differenceInDays(actualEnd, currentWeekStart) + 1;
      markers.push({
        start: currentWeekStart,
        label: format(currentWeekStart, 'dd MMM', { locale: it }),
        widthDays
      });
      currentWeekStart = addDays(currentWeekStart, 7);
    }
    return markers;
  }
}

export const ActivityGanttChart = ({
  projectId,
  projectStartDate,
  projectEndDate,
  projectName
}: ActivityGanttChartProps) => {
  const queryClient = useQueryClient();
  const [localActivities, setLocalActivities] = useState<BudgetItem[] | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);
  const sensors = useSensors(useSensor(PointerSensor, {
    activationConstraint: { distance: 8 }
  }), useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates
  }));

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
    }
  });

  const reorderMutation = useMutation({
    mutationFn: async (reorderedItems: { id: string; display_order: number }[]) => {
      const updates = reorderedItems.map(item =>
        supabase.from('budget_items').update({ display_order: item.display_order }).eq('id', item.id)
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
    }
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
    }
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const currentItems = localActivities || activitiesWithDuration;
      const oldIndex = currentItems.findIndex(item => item.id === active.id);
      const newIndex = currentItems.findIndex(item => item.id === over.id);
      const newOrder = arrayMove(currentItems, oldIndex, newIndex);
      setLocalActivities(newOrder);
      const updates = newOrder.map((item, index) => ({
        id: item.id,
        display_order: index + 1
      }));
      reorderMutation.mutate(updates);
    }
  };

  const handleBarDragEnd = (activityId: string, newStartDay: number) => {
    const currentItems = localActivities || activities;
    const updatedItems = currentItems.map(item =>
      item.id === activityId ? { ...item, start_day_offset: newStartDay } : item
    );
    setLocalActivities(updatedItems);
    updateStartOffsetMutation.mutate({ activityId, startDayOffset: newStartDay });
  };

  const doExport = useCallback(async (type: 'png' | 'pdf') => {
    if (!chartRef.current) return;
    setIsExporting(true);
    
    // Wait for React to re-render with export mode
    await new Promise(resolve => setTimeout(resolve, 100));
    
    try {
      const canvas = await html2canvas(chartRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true
      });

      if (type === 'png') {
        const link = document.createElement('a');
        link.download = `gantt-timeline-${format(new Date(), 'yyyy-MM-dd')}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        toast.success('Timeline esportata come PNG');
      } else {
        // Use A3 landscape with margins
        const pdf = new jsPDF({
          orientation: 'landscape',
          unit: 'mm',
          format: 'a3'
        });
        
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 15;
        const availableWidth = pageWidth - margin * 2;
        const availableHeight = pageHeight - margin * 2;
        
        const imgRatio = canvas.width / canvas.height;
        let imgWidth = availableWidth;
        let imgHeight = imgWidth / imgRatio;
        
        if (imgHeight > availableHeight) {
          imgHeight = availableHeight;
          imgWidth = imgHeight * imgRatio;
        }
        
        const xOffset = margin + (availableWidth - imgWidth) / 2;
        const yOffset = margin;
        
        const imgData = canvas.toDataURL('image/png');
        pdf.addImage(imgData, 'PNG', xOffset, yOffset, imgWidth, imgHeight);
        pdf.save(`gantt-timeline-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
        toast.success('Timeline esportata come PDF');
      }
    } catch (error) {
      toast.error('Errore nell\'esportazione');
      console.error(error);
    } finally {
      setIsExporting(false);
    }
  }, []);

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
  const projectEnd = projectEndDate ? startOfDay(new Date(projectEndDate)) : null;
  const projectDurationDays = projectEnd ? differenceInDays(projectEnd, startDate) + 1 : null;

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
      startDay: activityStartDay
    };
  });

  const totalDays = Math.max(projectDurationDays || maxEndDay, 7);
  const endDate = addDays(startDate, totalDays - 1);
  const timeMarkers = generateTimeMarkers(startDate, endDate, totalDays);

  const today = startOfDay(new Date());
  const todayPosition = differenceInDays(today, startDate);
  const showTodayMarker = todayPosition >= 0 && todayPosition < totalDays;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5" />
          Timeline Attività
          {!isExporting && (
            <span className="text-xs font-normal text-muted-foreground ml-2">
              (⋮⋮ riordina righe • trascina barre per spostare date)
            </span>
          )}
        </CardTitle>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" disabled={isExporting}>
              <Download className="h-4 w-4 mr-2" />
              {isExporting ? 'Esportazione...' : 'Esporta'}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => doExport('png')}>
              <FileImage className="h-4 w-4 mr-2" />
              Esporta come PNG
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => doExport('pdf')}>
              <FileText className="h-4 w-4 mr-2" />
              Esporta come PDF
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent>
        <div ref={chartRef} className={`space-y-4 bg-background ${isExporting ? 'p-8' : 'p-4 -m-4'}`}>
          {/* Export header - only visible during export */}
          {isExporting && (
            <div className="mb-6 pb-4 border-b-2 border-foreground/20">
              <h2 className="text-xl font-bold text-foreground">
                {projectName || 'Timeline Progetto'}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {format(startDate, 'dd MMMM yyyy', { locale: it })} — {format(endDate, 'dd MMMM yyyy', { locale: it })}
                {' • '}{totalDays} giorni • {activitiesWithDuration.length} attività • {formatHours(activitiesWithDuration.reduce((sum, a) => sum + a.hours_worked, 0))}
              </p>
            </div>
          )}

          {/* Legend */}
          <div className="flex flex-wrap gap-3 mb-4">
            {Object.entries(categoryColorsSolid).map(([cat, color]) => (
              <div key={cat} className="flex items-center gap-1.5 text-xs">
                <div className={`w-3 h-3 rounded ${color}`}></div>
                <span className="text-muted-foreground">{cat}</span>
              </div>
            ))}
          </div>

          {/* Timeline header */}
          <div className="relative">
            <div className="flex border-b border-border pb-2 mb-2 overflow-x-auto">
              <div className={`${isExporting ? 'w-64' : 'w-48'} flex-shrink-0 text-sm font-medium text-muted-foreground`}>
                Attività
              </div>
              <div className="flex-1 relative min-w-[500px]">
                <div className="flex">
                  {timeMarkers.map((marker, i) => (
                    <div key={i} className="text-xs text-muted-foreground" style={{
                      width: `${marker.widthDays / totalDays * 100}%`,
                      minWidth: '40px'
                    }}>
                      {marker.label}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Activities with drag and drop */}
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={activitiesWithDates.map(a => a.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2 overflow-x-auto">
                  {activitiesWithDates.map(activity => {
                    const barColor = getCategorySolidColor(activity.category);
                    return (
                      <SortableGanttRow
                        key={activity.id}
                        activity={activity}
                        barColor={barColor}
                        totalDays={totalDays}
                        projectDurationDays={projectDurationDays}
                        todayPosition={todayPosition}
                        showTodayMarker={showTodayMarker}
                        onBarDragEnd={handleBarDragEnd}
                        isExporting={isExporting}
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
                  <span className="font-medium">{formatHours(activitiesWithDuration.reduce((sum, a) => sum + a.hours_worked, 0))}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
