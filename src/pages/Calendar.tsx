import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CalendarSettings, CalendarConfig, loadCalendarConfig } from '@/components/CalendarSettings';
import { 
  ContextMenu, 
  ContextMenuContent, 
  ContextMenuItem, 
  ContextMenuTrigger,
  ContextMenuSeparator 
} from '@/components/ui/context-menu';
import { toast } from 'sonner';
import { format, startOfWeek, addDays, addWeeks, subWeeks, isSameDay, parseISO, getDay, isBefore, parse } from 'date-fns';
import { it } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Clock, Play, Square, Trash2, Copy, Edit, CheckCircle } from 'lucide-react';
import { 
  DndContext, 
  DragEndEvent, 
  DragOverlay, 
  useDraggable, 
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

interface Activity {
  id: string;
  activity_name: string;
  category: string;
  hours_worked: number;
  total_cost: number;
  project_id: string;
  project_name: string;
  assignee_id: string;
}

interface TimeTracking {
  id: string;
  budget_item_id: string;
  user_id: string;
  scheduled_date: string | null;
  scheduled_start_time: string | null;
  scheduled_end_time: string | null;
  actual_start_time: string | null;
  actual_end_time: string | null;
  notes: string | null;
  activity?: Activity;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const HOUR_HEIGHT = 60; // pixels per hour

function DraggableActivity({ activity }: { activity: Activity }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: activity.id,
    data: { activity },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-move mb-2"
    >
      <div className="flex flex-col gap-1">
        <span className="font-medium text-sm">{activity.activity_name}</span>
        <Badge variant="secondary" className="w-fit text-xs">
          {activity.category}
        </Badge>
        <span className="text-xs text-muted-foreground">{activity.project_name}</span>
        <span className="text-xs text-muted-foreground">{activity.hours_worked}h</span>
      </div>
    </div>
  );
}

function TimeSlot({ date, hour }: { date: Date; hour: number }) {
  const { setNodeRef, isOver, active } = useDroppable({
    id: `${format(date, 'yyyy-MM-dd')}-${hour}`,
    data: { date, hour },
  });

  return (
    <div
      ref={setNodeRef}
      className={`border-t border-l h-[60px] transition-colors relative ${
        isOver ? 'bg-primary/20 ring-2 ring-primary ring-inset' : 'hover:bg-muted/30'
      } ${active ? 'z-0' : ''}`}
    />
  );
}

function ScheduledActivity({ 
  tracking, 
  onStartTracking, 
  onStopTracking, 
  workDayStartHour,
  onSaveResize,
  onOpenDetail,
  onDuplicate,
  onConfirm
}: { 
  tracking: TimeTracking;
  onStartTracking: (id: string) => void;
  onStopTracking: (id: string) => void;
  workDayStartHour: number;
  onSaveResize: (id: string, startTime: string, endTime: string) => void;
  onOpenDetail: (tracking: TimeTracking) => void;
  onDuplicate: (tracking: TimeTracking) => void;
  onConfirm: (tracking: TimeTracking) => void;
}) {
  const [isResizing, setIsResizing] = useState<'top' | 'bottom' | null>(null);
  const [localTimes, setLocalTimes] = useState<{ start: string; end: string } | null>(null);
  const [resizeStartData, setResizeStartData] = useState<{ 
    y: number; 
    originalStartMinutes: number; 
    originalEndMinutes: number;
  } | null>(null);
  
  if (!tracking.scheduled_start_time || !tracking.scheduled_end_time || !tracking.activity) return null;

  // Use local times during resize, otherwise use tracking times
  const displayStartTime = localTimes?.start || tracking.scheduled_start_time;
  const displayEndTime = localTimes?.end || tracking.scheduled_end_time;

  const startMinutes = parseInt(displayStartTime.split(':')[0]) * 60 + 
                       parseInt(displayStartTime.split(':')[1]);
  const endMinutes = parseInt(displayEndTime.split(':')[0]) * 60 + 
                     parseInt(displayEndTime.split(':')[1]);
  
  // Calculate position relative to work day start
  const workDayStartMinutes = workDayStartHour * 60;
  const relativeStartMinutes = startMinutes - workDayStartMinutes;
  
  const top = (relativeStartMinutes / 60) * HOUR_HEIGHT;
  const height = ((endMinutes - startMinutes) / 60) * HOUR_HEIGHT;
  const isTrackingNow = tracking.actual_start_time && !tracking.actual_end_time;
  const isCompleted = tracking.actual_start_time && tracking.actual_end_time;

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `scheduled-${tracking.id}`,
    data: { tracking, type: 'scheduled' },
    disabled: isResizing !== null,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  const handleResizeStart = (e: React.MouseEvent, edge: 'top' | 'bottom') => {
    e.stopPropagation();
    e.preventDefault();
    const origStart = parseInt(tracking.scheduled_start_time!.split(':')[0]) * 60 + 
                      parseInt(tracking.scheduled_start_time!.split(':')[1]);
    const origEnd = parseInt(tracking.scheduled_end_time!.split(':')[0]) * 60 + 
                    parseInt(tracking.scheduled_end_time!.split(':')[1]);
    setIsResizing(edge);
    setResizeStartData({
      y: e.clientY,
      originalStartMinutes: origStart,
      originalEndMinutes: origEnd,
    });
    setLocalTimes({
      start: tracking.scheduled_start_time!,
      end: tracking.scheduled_end_time!,
    });
  };

  useEffect(() => {
    if (!isResizing || !resizeStartData) return;

    const handleResizeMove = (e: MouseEvent) => {
      const deltaY = e.clientY - resizeStartData.y;
      const deltaMinutes = Math.round((deltaY / HOUR_HEIGHT) * 60 / 15) * 15; // Snap to 15 min

      if (isResizing === 'top') {
        const newStartMinutes = Math.max(0, Math.min(resizeStartData.originalStartMinutes + deltaMinutes, resizeStartData.originalEndMinutes - 15));
        const hours = Math.floor(newStartMinutes / 60);
        const mins = newStartMinutes % 60;
        const newStartTime = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
        const endHours = Math.floor(resizeStartData.originalEndMinutes / 60);
        const endMins = resizeStartData.originalEndMinutes % 60;
        const endTime = `${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`;
        setLocalTimes({ start: newStartTime, end: endTime });
      } else {
        const newEndMinutes = Math.min(24 * 60, Math.max(resizeStartData.originalStartMinutes + 15, resizeStartData.originalEndMinutes + deltaMinutes));
        const hours = Math.floor(newEndMinutes / 60);
        const mins = newEndMinutes % 60;
        const newEndTime = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
        const startHours = Math.floor(resizeStartData.originalStartMinutes / 60);
        const startMins = resizeStartData.originalStartMinutes % 60;
        const startTime = `${startHours.toString().padStart(2, '0')}:${startMins.toString().padStart(2, '0')}`;
        setLocalTimes({ start: startTime, end: newEndTime });
      }
    };

    const handleResizeEnd = () => {
      if (localTimes && (localTimes.start !== tracking.scheduled_start_time || localTimes.end !== tracking.scheduled_end_time)) {
        onSaveResize(tracking.id, localTimes.start, localTimes.end);
      }
      setIsResizing(null);
      setResizeStartData(null);
      setLocalTimes(null);
    };

    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
    return () => {
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeEnd);
    };
  }, [isResizing, resizeStartData, localTimes, tracking.id, tracking.scheduled_start_time, tracking.scheduled_end_time, onSaveResize]);

  const handleClick = (e: React.MouseEvent) => {
    if (isDragging || isResizing) return;
    e.stopPropagation();
    onOpenDetail(tracking);
  };

  // Check if activity can be confirmed (end time is in the past)
  const canConfirm = useMemo(() => {
    if (!tracking.scheduled_date || !tracking.scheduled_end_time) return false;
    if (isCompleted) return false; // Already confirmed
    
    // Handle time format with or without seconds (HH:mm or HH:mm:ss)
    const endTime = tracking.scheduled_end_time.substring(0, 5); // Get just HH:mm
    const endDateTime = new Date(`${tracking.scheduled_date}T${endTime}:00`);
    return isBefore(endDateTime, new Date());
  }, [tracking.scheduled_date, tracking.scheduled_end_time, isCompleted]);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={setNodeRef}
          {...attributes}
          {...listeners}
          style={{ 
            ...style, 
            top: `${top}px`, 
            height: `${Math.max(height, 30)}px`,
            pointerEvents: isDragging ? 'none' : 'auto',
          }}
          className={`absolute left-1 right-1 rounded-md shadow-sm border-l-4 overflow-hidden select-none ${
            isDragging ? 'cursor-grabbing z-50 opacity-80' : 'cursor-grab z-10'
          } ${
            isCompleted ? 'bg-green-100 border-green-500 dark:bg-green-900/30' :
            isTrackingNow ? 'bg-blue-100 border-blue-500 dark:bg-blue-900/30' :
            'bg-primary/10 border-primary'
          }`}
          onClick={handleClick}
        >
          {/* Resize handle top */}
          <div
            className="absolute top-0 left-0 right-0 h-2 cursor-ns-resize hover:bg-primary/30 z-20"
            onMouseDown={(e) => handleResizeStart(e, 'top')}
            onPointerDown={(e) => e.stopPropagation()}
          />

          {/* Confirmed badge */}
          {isCompleted && (
            <div className="absolute top-1 right-1 z-10">
              <Badge variant="secondary" className="bg-green-500 text-white text-[10px] px-1.5 py-0 h-4 flex items-center gap-0.5">
                <CheckCircle className="h-2.5 w-2.5" />
                <span>Confermata</span>
              </Badge>
            </div>
          )}

          {/* Content */}
          <div className="flex flex-col h-full justify-between p-1.5 pt-3 pb-3">
            <div className="min-w-0">
              <div className={`font-medium text-xs truncate ${isCompleted ? 'pr-16' : ''}`}>{tracking.activity.activity_name}</div>
              <div className="text-xs text-muted-foreground truncate">{tracking.activity.project_name}</div>
              <div className="text-xs flex items-center gap-1 mt-0.5">
                <Clock className="h-3 w-3 flex-shrink-0" />
                <span>{displayStartTime.substring(0, 5)} - {displayEndTime.substring(0, 5)}</span>
              </div>
            </div>
            <div className="flex gap-1 items-center">
              {!tracking.actual_start_time && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-5 px-1.5"
                  onClick={(e) => {
                    e.stopPropagation();
                    onStartTracking(tracking.id);
                  }}
                >
                  <Play className="h-3 w-3" />
                </Button>
              )}
              {isTrackingNow && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-5 px-1.5"
                  onClick={(e) => {
                    e.stopPropagation();
                    onStopTracking(tracking.id);
                  }}
                >
                  <Square className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>

          {/* Resize handle bottom */}
          <div
            className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize hover:bg-primary/30 z-20"
            onMouseDown={(e) => handleResizeStart(e, 'bottom')}
            onPointerDown={(e) => e.stopPropagation()}
          />
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={() => onOpenDetail(tracking)}>
          <Edit className="h-4 w-4 mr-2" />
          Modifica
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onDuplicate(tracking)}>
          <Copy className="h-4 w-4 mr-2" />
          Duplica
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem 
          onClick={() => onConfirm(tracking)}
          disabled={!canConfirm}
          className={!canConfirm ? 'opacity-50 cursor-not-allowed' : ''}
        >
          <CheckCircle className="h-4 w-4 mr-2" />
          Conferma attività
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

export default function Calendar() {
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<CalendarConfig>(loadCalendarConfig());
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(
    startOfWeek(new Date(), { weekStartsOn: config.weekStartsOn as 0 | 1 | 2 | 3 | 4 | 5 | 6 })
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedTracking, setSelectedTracking] = useState<TimeTracking | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [detailForm, setDetailForm] = useState({
    scheduled_date: '',
    scheduled_start_time: '',
    scheduled_end_time: '',
    notes: '',
  });

  // Configure drag sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement before drag starts
      },
    })
  );

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Update week start when config changes
  const handleConfigChange = (newConfig: CalendarConfig) => {
    setConfig(newConfig);
    setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: newConfig.weekStartsOn as 0 | 1 | 2 | 3 | 4 | 5 | 6 }));
  };

  const weekDays = useMemo(() => {
    const days = Array.from({ length: config.numberOfDays }, (_, i) => addDays(currentWeekStart, i));
    
    // Filter weekends if showWeekends is false
    if (!config.showWeekends) {
      return days.filter(day => {
        const dayOfWeek = getDay(day);
        return dayOfWeek !== 0 && dayOfWeek !== 6; // 0 = Sunday, 6 = Saturday
      });
    }
    
    return days;
  }, [currentWeekStart, config.numberOfDays, config.showWeekends]);

  // Calculate visible hours based on work day settings
  const visibleHours = useMemo(() => {
    const startHour = parseInt(config.workDayStart.split(':')[0]);
    const endHour = parseInt(config.workDayEnd.split(':')[0]);
    return Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i);
  }, [config.workDayStart, config.workDayEnd]);

  // Get current user
  const { data: currentUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  // Get user's assigned activities
  const { data: activities = [] } = useQuery<Activity[]>({
    queryKey: ['user-activities', currentUser?.id],
    queryFn: async () => {
      if (!currentUser?.id) return [];
      
      const { data: budgetItems, error } = await supabase
        .from('budget_items')
        .select(`
          id,
          activity_name,
          category,
          hours_worked,
          total_cost,
          project_id,
          assignee_id,
          projects:project_id (
            name
          )
        `)
        .eq('is_product', false)
        .like('assignee_id', `%${currentUser.id}%`);

      if (error) throw error;

      return (budgetItems || []).map(item => ({
        ...item,
        project_name: (item as any).projects?.name || 'Progetto sconosciuto',
      }));
    },
    enabled: !!currentUser?.id,
  });

  // Get time tracking for current week
  const { data: timeTracking = [] } = useQuery<TimeTracking[]>({
    queryKey: ['time-tracking', currentUser?.id, format(currentWeekStart, 'yyyy-MM-dd')],
    queryFn: async () => {
      if (!currentUser?.id) return [];
      
      const startDate = format(currentWeekStart, 'yyyy-MM-dd');
      const endDate = format(addDays(currentWeekStart, 6), 'yyyy-MM-dd');
      
      const { data, error } = await supabase
        .from('activity_time_tracking')
        .select(`
          *,
          budget_items:budget_item_id (
            id,
            activity_name,
            category,
            hours_worked,
            total_cost,
            project_id,
            assignee_id,
            projects:project_id (
              name
            )
          )
        `)
        .eq('user_id', currentUser.id)
        .gte('scheduled_date', startDate)
        .lte('scheduled_date', endDate);

      if (error) throw error;

      return (data || []).map(item => ({
        ...item,
        activity: item.budget_items ? {
          ...(item as any).budget_items,
          project_name: (item as any).budget_items?.projects?.name || 'Progetto sconosciuto',
        } : undefined,
      }));
    },
    enabled: !!currentUser?.id,
  });

  const scheduleActivityMutation = useMutation({
    mutationFn: async (data: {
      budget_item_id: string;
      scheduled_date: string;
      scheduled_start_time: string;
      scheduled_end_time: string;
    }) => {
      const { error } = await supabase
        .from('activity_time_tracking')
        .insert({
          ...data,
          user_id: currentUser?.id,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-tracking'] });
      toast.success('Attività pianificata');
    },
    onError: (error) => {
      console.error('Error scheduling activity:', error);
      toast.error('Errore durante la pianificazione');
    },
  });

  const startTrackingMutation = useMutation({
    mutationFn: async (trackingId: string) => {
      const { error } = await supabase
        .from('activity_time_tracking')
        .update({ actual_start_time: new Date().toISOString() })
        .eq('id', trackingId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-tracking'] });
      toast.success('Tracciamento avviato');
    },
  });

  const stopTrackingMutation = useMutation({
    mutationFn: async (trackingId: string) => {
      const { error } = await supabase
        .from('activity_time_tracking')
        .update({ actual_end_time: new Date().toISOString() })
        .eq('id', trackingId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-tracking'] });
      toast.success('Tracciamento terminato');
    },
  });

  const updateTrackingTimeMutation = useMutation({
    mutationFn: async ({ 
      trackingId, 
      startTime, 
      endTime 
    }: { 
      trackingId: string; 
      startTime: string; 
      endTime: string;
    }) => {
      const { error } = await supabase
        .from('activity_time_tracking')
        .update({
          scheduled_start_time: startTime,
          scheduled_end_time: endTime,
        })
        .eq('id', trackingId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-tracking'] });
    },
    onError: (error) => {
      console.error('Error updating tracking time:', error);
      toast.error('Errore durante l\'aggiornamento');
    },
  });

  const moveTrackingMutation = useMutation({
    mutationFn: async ({
      trackingId,
      newDate,
      newStartTime,
      newEndTime,
    }: {
      trackingId: string;
      newDate: string;
      newStartTime: string;
      newEndTime: string;
    }) => {
      const { error } = await supabase
        .from('activity_time_tracking')
        .update({
          scheduled_date: newDate,
          scheduled_start_time: newStartTime,
          scheduled_end_time: newEndTime,
        })
        .eq('id', trackingId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-tracking'] });
      toast.success('Attività spostata');
    },
    onError: (error) => {
      console.error('Error moving tracking:', error);
      toast.error('Errore durante lo spostamento');
    },
  });

  const updateTrackingDetailMutation = useMutation({
    mutationFn: async ({
      trackingId,
      updates,
    }: {
      trackingId: string;
      updates: Partial<TimeTracking>;
    }) => {
      const { error } = await supabase
        .from('activity_time_tracking')
        .update(updates)
        .eq('id', trackingId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-tracking'] });
      toast.success('Attività aggiornata');
      setDetailDialogOpen(false);
    },
    onError: (error) => {
      console.error('Error updating tracking:', error);
      toast.error('Errore durante l\'aggiornamento');
    },
  });

  const deleteTrackingMutation = useMutation({
    mutationFn: async (trackingId: string) => {
      const { error } = await supabase
        .from('activity_time_tracking')
        .delete()
        .eq('id', trackingId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-tracking'] });
      toast.success('Attività eliminata');
      setDetailDialogOpen(false);
    },
    onError: (error) => {
      console.error('Error deleting tracking:', error);
      toast.error('Errore durante l\'eliminazione');
    },
  });

  const duplicateTrackingMutation = useMutation({
    mutationFn: async (tracking: TimeTracking) => {
      const { error } = await supabase
        .from('activity_time_tracking')
        .insert({
          budget_item_id: tracking.budget_item_id,
          user_id: currentUser?.id,
          scheduled_date: tracking.scheduled_date,
          scheduled_start_time: tracking.scheduled_start_time,
          scheduled_end_time: tracking.scheduled_end_time,
          notes: tracking.notes,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-tracking'] });
      toast.success('Attività duplicata');
    },
    onError: (error) => {
      console.error('Error duplicating tracking:', error);
      toast.error('Errore durante la duplicazione');
    },
  });

  const confirmTrackingMutation = useMutation({
    mutationFn: async (tracking: TimeTracking) => {
      if (!tracking.scheduled_date || !tracking.scheduled_start_time || !tracking.scheduled_end_time) {
        throw new Error('Missing scheduled times');
      }

      // Convert scheduled times to actual times (handle both HH:mm and HH:mm:ss formats)
      const scheduledDate = tracking.scheduled_date;
      const startTime = tracking.scheduled_start_time.substring(0, 5); // Get HH:mm
      const endTime = tracking.scheduled_end_time.substring(0, 5); // Get HH:mm
      const startDateTime = `${scheduledDate}T${startTime}:00`;
      const endDateTime = `${scheduledDate}T${endTime}:00`;

      const { error } = await supabase
        .from('activity_time_tracking')
        .update({
          actual_start_time: startDateTime,
          actual_end_time: endDateTime,
        })
        .eq('id', tracking.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-tracking'] });
      toast.success('Attività confermata - ore aggiunte al conteggio');
    },
    onError: (error) => {
      console.error('Error confirming tracking:', error);
      toast.error('Errore durante la conferma');
    },
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    console.log('Drag end:', { active: active?.id, over: over?.id, overData: over?.data?.current });

    if (!over) {
      console.log('No drop target detected');
      return;
    }

    const dropData = over.data.current as { date: Date; hour: number };
    if (!dropData || !dropData.date) {
      console.log('Invalid drop data:', dropData);
      return;
    }

    // Check if dragging a new activity or moving an existing one
    if (active.data.current?.type === 'scheduled') {
      // Moving existing scheduled activity
      const tracking = active.data.current.tracking as TimeTracking;
      
      if (!tracking.scheduled_start_time || !tracking.scheduled_end_time) return;

      const startMinutes = parseInt(tracking.scheduled_start_time.split(':')[0]) * 60 + 
                           parseInt(tracking.scheduled_start_time.split(':')[1]);
      const endMinutes = parseInt(tracking.scheduled_end_time.split(':')[0]) * 60 + 
                         parseInt(tracking.scheduled_end_time.split(':')[1]);
      const duration = endMinutes - startMinutes;

      const newStartMinutes = dropData.hour * 60;
      const newEndMinutes = newStartMinutes + duration;

      const newStartHours = Math.floor(newStartMinutes / 60);
      const newStartMins = newStartMinutes % 60;
      const newEndHours = Math.floor(newEndMinutes / 60);
      const newEndMins = newEndMinutes % 60;

      const newStartTime = `${newStartHours.toString().padStart(2, '0')}:${newStartMins.toString().padStart(2, '0')}`;
      const newEndTime = `${newEndHours.toString().padStart(2, '0')}:${newEndMins.toString().padStart(2, '0')}`;

      console.log('Moving activity to:', { date: format(dropData.date, 'yyyy-MM-dd'), newStartTime, newEndTime });

      moveTrackingMutation.mutate({
        trackingId: tracking.id,
        newDate: format(dropData.date, 'yyyy-MM-dd'),
        newStartTime,
        newEndTime,
      });
    } else {
      // Scheduling new activity
      const activity = active.data.current?.activity as Activity;
      if (!activity) return;

      const durationHours = config.defaultSlotDuration / 60;
      const startTime = `${dropData.hour.toString().padStart(2, '0')}:00`;
      const endHour = dropData.hour + durationHours;
      const endTime = `${Math.min(Math.floor(endHour), 23).toString().padStart(2, '0')}:${((endHour % 1) * 60).toString().padStart(2, '0')}`;

      scheduleActivityMutation.mutate({
        budget_item_id: activity.id,
        scheduled_date: format(dropData.date, 'yyyy-MM-dd'),
        scheduled_start_time: startTime,
        scheduled_end_time: endTime,
      });
    }
  };

  // Get unique projects and categories for filters
  const uniqueProjects = useMemo(() => {
    const projects = activities.map(a => ({ id: a.project_id, name: a.project_name }));
    const uniqueMap = new Map(projects.map(p => [p.id, p]));
    return Array.from(uniqueMap.values());
  }, [activities]);

  const uniqueCategories = useMemo(() => {
    return Array.from(new Set(activities.map(a => a.category)));
  }, [activities]);

  // Filter activities based on selected filters
  const filteredActivities = useMemo(() => {
    return activities.filter(activity => {
      const matchesProject = selectedProject === 'all' || activity.project_id === selectedProject;
      const matchesCategory = selectedCategory === 'all' || activity.category === selectedCategory;
      return matchesProject && matchesCategory;
    });
  }, [activities, selectedProject, selectedCategory]);

  const handleOpenDetail = (tracking: TimeTracking) => {
    setSelectedTracking(tracking);
    setDetailForm({
      scheduled_date: tracking.scheduled_date || '',
      scheduled_start_time: tracking.scheduled_start_time || '',
      scheduled_end_time: tracking.scheduled_end_time || '',
      notes: tracking.notes || '',
    });
    setDetailDialogOpen(true);
  };

  const handleSaveDetail = () => {
    if (!selectedTracking) return;

    updateTrackingDetailMutation.mutate({
      trackingId: selectedTracking.id,
      updates: {
        scheduled_date: detailForm.scheduled_date,
        scheduled_start_time: detailForm.scheduled_start_time,
        scheduled_end_time: detailForm.scheduled_end_time,
        notes: detailForm.notes,
      },
    });
  };

  const handleDeleteTracking = () => {
    if (!selectedTracking) return;
    
    if (confirm('Sei sicuro di voler eliminare questa attività?')) {
      deleteTrackingMutation.mutate(selectedTracking.id);
    }
  };

  // Find active item for drag overlay
  const activeActivity = activeId ? activities.find(a => a.id === activeId) : null;
  const activeScheduledTracking = activeId?.startsWith('scheduled-') 
    ? timeTracking.find(t => `scheduled-${t.id}` === activeId) 
    : null;

  // Calculate daily totals (planned and confirmed separately)
  const dailyTotals = useMemo(() => {
    return weekDays.map(day => {
      const dayActivities = timeTracking.filter(
        t => t.scheduled_date && isSameDay(parseISO(t.scheduled_date), day)
      );
      
      let plannedMinutes = 0;
      let confirmedMinutes = 0;
      
      dayActivities.forEach(t => {
        if (!t.scheduled_start_time || !t.scheduled_end_time) return;
        const startMinutes = parseInt(t.scheduled_start_time.split(':')[0]) * 60 + 
                             parseInt(t.scheduled_start_time.split(':')[1]);
        const endMinutes = parseInt(t.scheduled_end_time.split(':')[0]) * 60 + 
                           parseInt(t.scheduled_end_time.split(':')[1]);
        const duration = endMinutes - startMinutes;
        
        plannedMinutes += duration;
        
        // If activity is confirmed (has actual_start_time and actual_end_time)
        if (t.actual_start_time && t.actual_end_time) {
          confirmedMinutes += duration;
        }
      });
      
      return {
        planned: plannedMinutes / 60,
        confirmed: confirmedMinutes / 60,
      };
    });
  }, [weekDays, timeTracking]);

  // Calculate current time indicator position
  const currentTimeIndicator = useMemo(() => {
    const now = new Date();
    const todayInWeek = weekDays.find(day => isSameDay(day, now));
    
    if (!todayInWeek) return null;

    const currentHour = now.getHours();
    const currentMinutes = now.getMinutes();
    const workDayStartHour = visibleHours[0];
    
    if (currentHour < workDayStartHour || currentHour > visibleHours[visibleHours.length - 1]) {
      return null;
    }

    const relativeHour = currentHour - workDayStartHour;
    const top = (relativeHour * HOUR_HEIGHT) + (currentMinutes / 60 * HOUR_HEIGHT);
    const dayIndex = weekDays.findIndex(day => isSameDay(day, now));

    return { top, dayIndex };
  }, [currentTime, weekDays, visibleHours]);

  // Calculate weekly totals
  const weeklyTotals = useMemo(() => {
    return dailyTotals.reduce(
      (acc, day) => ({
        planned: acc.planned + day.planned,
        confirmed: acc.confirmed + day.confirmed,
      }),
      { planned: 0, confirmed: 0 }
    );
  }, [dailyTotals]);

  return (
    <div className="h-screen flex flex-col">
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-6">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Calendario Attività</h1>
              <p className="text-muted-foreground">Trascina le attività nel calendario per pianificarle</p>
            </div>
            {/* Weekly Summary */}
            <div className="flex items-center gap-4 bg-muted/50 rounded-lg px-4 py-2 border">
              <div className="text-center">
                <div className="text-xs text-muted-foreground">Pianificate</div>
                <div className="text-lg font-bold">{weeklyTotals.planned.toFixed(1)}h</div>
              </div>
              <div className="w-px h-8 bg-border" />
              <div className="text-center">
                <div className="text-xs text-muted-foreground flex items-center gap-1 justify-center">
                  <CheckCircle className="h-3 w-3 text-green-600" />
                  Confermate
                </div>
                <div className="text-lg font-bold text-green-600">{weeklyTotals.confirmed.toFixed(1)}h</div>
              </div>
              {weeklyTotals.planned > 0 && (
                <>
                  <div className="w-px h-8 bg-border" />
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground">Completamento</div>
                    <div className="text-lg font-bold">
                      {((weeklyTotals.confirmed / weeklyTotals.planned) * 100).toFixed(0)}%
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => setCurrentWeekStart(subWeeks(currentWeekStart, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-sm font-medium min-w-[200px] text-center">
              {format(currentWeekStart, 'd MMM', { locale: it })} - {format(addDays(currentWeekStart, config.numberOfDays - 1), 'd MMM yyyy', { locale: it })}
            </div>
            <Button variant="outline" size="icon" onClick={() => setCurrentWeekStart(addWeeks(currentWeekStart, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button onClick={() => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: config.weekStartsOn as 0 | 1 | 2 | 3 | 4 | 5 | 6 }))}>
              Oggi
            </Button>
            <CalendarSettings config={config} onConfigChange={handleConfigChange} />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <DndContext 
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd} 
          onDragStart={(e) => setActiveId(e.active.id as string)}
        >
          <div className="flex h-full">
            {/* Sidebar con attività */}
            <Card className="w-80 m-6 mt-0 flex-shrink-0 overflow-hidden flex flex-col">
              <CardHeader>
                <CardTitle>Attività Assegnate</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto flex flex-col gap-4">
                {/* Filtri */}
                <div className="space-y-3 pb-3 border-b">
                  <div>
                    <Label className="text-xs">Progetto</Label>
                    <Select value={selectedProject} onValueChange={setSelectedProject}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Tutti i progetti" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tutti i progetti</SelectItem>
                        {uniqueProjects.map((project) => (
                          <SelectItem key={project.id} value={project.id}>
                            {project.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Categoria</Label>
                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Tutte le categorie" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tutte le categorie</SelectItem>
                        {uniqueCategories.map((category) => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {(selectedProject !== 'all' || selectedCategory !== 'all') && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        setSelectedProject('all');
                        setSelectedCategory('all');
                      }}
                    >
                      Rimuovi filtri
                    </Button>
                  )}
                </div>

                {/* Lista attività */}
                {filteredActivities.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8 text-sm">
                    {activities.length === 0 ? 'Nessuna attività assegnata' : 'Nessuna attività corrisponde ai filtri'}
                  </p>
                ) : (
                  <div>
                    {filteredActivities.map((activity) => (
                      <DraggableActivity key={activity.id} activity={activity} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Calendario settimanale */}
            <div className="flex-1 overflow-auto mr-6">
              <div className="inline-block min-w-full">
                {/* Header giorni */}
                <div className="flex sticky top-0 bg-background z-10 border-b">
                  <div className="w-16 flex-shrink-0 border-r" />
                  {weekDays.map((day) => (
                    <div
                      key={day.toISOString()}
                      className={`flex-1 min-w-[120px] p-2 text-center border-r ${
                        isSameDay(day, new Date()) ? 'bg-primary/5' : ''
                      }`}
                    >
                      <div className="text-xs text-muted-foreground">
                        {format(day, 'EEE', { locale: it })}
                      </div>
                      <div className={`text-lg font-semibold ${
                        isSameDay(day, new Date()) ? 'text-primary' : ''
                      }`}>
                        {format(day, 'd')}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Griglia oraria */}
                <div className="relative">
                  {visibleHours.map((hour, index) => (
                    <div key={hour} className="flex">
                      <div className="w-16 flex-shrink-0 border-r text-xs text-muted-foreground text-right pr-2 pt-1">
                        {hour.toString().padStart(2, '0')}:00
                      </div>
                      {weekDays.map((day, dayIndex) => {
                        const dayTracking = timeTracking.filter(
                          t => t.scheduled_date && isSameDay(parseISO(t.scheduled_date), day)
                        );

                        return (
                          <div key={`${day.toISOString()}-${hour}`} className="flex-1 min-w-[120px] relative">
                            <TimeSlot date={day} hour={hour} />
                            {index === 0 && dayTracking.map(tracking => (
                              <ScheduledActivity
                                key={tracking.id}
                                tracking={tracking}
                                workDayStartHour={visibleHours[0]}
                                onStartTracking={(id) => startTrackingMutation.mutate(id)}
                                onStopTracking={(id) => stopTrackingMutation.mutate(id)}
                                onSaveResize={(id, start, end) => 
                                  updateTrackingTimeMutation.mutate({ 
                                    trackingId: id, 
                                    startTime: start, 
                                    endTime: end 
                                  })
                                }
                                onOpenDetail={handleOpenDetail}
                                onDuplicate={(t) => duplicateTrackingMutation.mutate(t)}
                                onConfirm={(t) => confirmTrackingMutation.mutate(t)}
                              />
                            ))}
                            {/* Current time indicator */}
                            {index === 0 && currentTimeIndicator && currentTimeIndicator.dayIndex === dayIndex && (
                              <div
                                className="absolute left-0 right-0 z-20 flex items-center pointer-events-none"
                                style={{ top: `${currentTimeIndicator.top}px` }}
                              >
                                <div className="w-2 h-2 rounded-full bg-red-500 -ml-1" />
                                <div className="flex-1 h-0.5 bg-red-500" />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}

                  {/* Daily totals */}
                  <div className="flex border-t-2 bg-muted/30">
                    <div className="w-16 flex-shrink-0 border-r text-xs font-semibold text-right pr-2 py-2">
                      Totale
                    </div>
                    {dailyTotals.map((total, index) => (
                      <div
                        key={index}
                        className="flex-1 min-w-[120px] text-center py-2 border-r"
                      >
                        <div className="text-sm font-semibold text-muted-foreground">
                          {total.planned.toFixed(1)}h
                        </div>
                        {total.confirmed > 0 && (
                          <div className="text-xs text-green-600 font-medium flex items-center justify-center gap-1">
                            <CheckCircle className="h-3 w-3" />
                            {total.confirmed.toFixed(1)}h
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Activity Detail Dialog */}
          <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Dettagli Attività</DialogTitle>
              </DialogHeader>
              {selectedTracking && (
                <div className="space-y-4 py-4">
                  <div>
                    <Label className="text-sm font-semibold">Attività</Label>
                    <p className="text-sm mt-1">{selectedTracking.activity?.activity_name}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-semibold">Progetto</Label>
                    <p className="text-sm mt-1">{selectedTracking.activity?.project_name}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-semibold">Categoria</Label>
                    <Badge variant="secondary" className="mt-1">
                      {selectedTracking.activity?.category}
                    </Badge>
                  </div>
                  <div>
                    <Label htmlFor="detail-date">Data</Label>
                    <Input
                      id="detail-date"
                      type="date"
                      value={detailForm.scheduled_date}
                      onChange={(e) => setDetailForm({ ...detailForm, scheduled_date: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="detail-start">Ora inizio</Label>
                      <Input
                        id="detail-start"
                        type="time"
                        value={detailForm.scheduled_start_time}
                        onChange={(e) => setDetailForm({ ...detailForm, scheduled_start_time: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="detail-end">Ora fine</Label>
                      <Input
                        id="detail-end"
                        type="time"
                        value={detailForm.scheduled_end_time}
                        onChange={(e) => setDetailForm({ ...detailForm, scheduled_end_time: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="detail-notes">Note</Label>
                    <Textarea
                      id="detail-notes"
                      value={detailForm.notes}
                      onChange={(e) => setDetailForm({ ...detailForm, notes: e.target.value })}
                      placeholder="Aggiungi note..."
                      className="mt-1"
                      rows={3}
                    />
                  </div>
                  {selectedTracking.actual_start_time && (
                    <div>
                      <Label className="text-sm font-semibold">Tempo tracciato</Label>
                      <p className="text-sm mt-1">
                        Inizio: {selectedTracking.actual_start_time ? 
                          format(new Date(selectedTracking.actual_start_time), 'HH:mm', { locale: it }) : 
                          '-'}
                      </p>
                      {selectedTracking.actual_end_time && (
                        <p className="text-sm">
                          Fine: {format(new Date(selectedTracking.actual_end_time), 'HH:mm', { locale: it })}
                        </p>
                      )}
                    </div>
                  )}
                  <div className="flex justify-between pt-4 border-t">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleDeleteTracking}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Elimina
                    </Button>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setDetailDialogOpen(false)}>
                        Annulla
                      </Button>
                      <Button onClick={handleSaveDetail}>
                        Salva
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

          <DragOverlay>
            {activeActivity && (
              <div className="p-3 border rounded-lg bg-background shadow-lg opacity-90">
                <div className="flex flex-col gap-1">
                  <span className="font-medium text-sm">{activeActivity.activity_name}</span>
                  <Badge variant="secondary" className="w-fit text-xs">
                    {activeActivity.category}
                  </Badge>
                </div>
              </div>
            )}
            {activeScheduledTracking?.activity && (
              <div className="p-3 border-l-4 border-primary rounded-lg bg-primary/10 shadow-lg opacity-90 min-w-[150px]">
                <div className="flex flex-col gap-1">
                  <span className="font-medium text-sm">{activeScheduledTracking.activity.activity_name}</span>
                  <span className="text-xs text-muted-foreground">{activeScheduledTracking.activity.project_name}</span>
                  <span className="text-xs">
                    {activeScheduledTracking.scheduled_start_time?.substring(0, 5)} - {activeScheduledTracking.scheduled_end_time?.substring(0, 5)}
                  </span>
                </div>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}
