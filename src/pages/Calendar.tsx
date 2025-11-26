import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { CalendarSettings, CalendarConfig, loadCalendarConfig } from '@/components/CalendarSettings';
import { toast } from 'sonner';
import { format, startOfWeek, addDays, addWeeks, subWeeks, isSameDay, parseISO, getDay } from 'date-fns';
import { it } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Clock, Play, Square, GripVertical } from 'lucide-react';
import { DndContext, DragEndEvent, DragOverlay, useDraggable, useDroppable } from '@dnd-kit/core';
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
  const { setNodeRef, isOver } = useDroppable({
    id: `${format(date, 'yyyy-MM-dd')}-${hour}`,
    data: { date, hour },
  });

  return (
    <div
      ref={setNodeRef}
      className={`border-t border-l h-[60px] transition-colors ${
        isOver ? 'bg-primary/10' : 'hover:bg-muted/30'
      }`}
    />
  );
}

function ScheduledActivity({ 
  tracking, 
  onStartTracking, 
  onStopTracking, 
  workDayStartHour,
  onUpdateTracking 
}: { 
  tracking: TimeTracking;
  onStartTracking: (id: string) => void;
  onStopTracking: (id: string) => void;
  workDayStartHour: number;
  onUpdateTracking: (id: string, startTime: string, endTime: string) => void;
}) {
  const [isResizing, setIsResizing] = useState<'top' | 'bottom' | null>(null);
  const [resizeStart, setResizeStart] = useState<{ y: number; startTime: string; endTime: string } | null>(null);
  
  if (!tracking.scheduled_start_time || !tracking.scheduled_end_time || !tracking.activity) return null;

  const startMinutes = parseInt(tracking.scheduled_start_time.split(':')[0]) * 60 + 
                       parseInt(tracking.scheduled_start_time.split(':')[1]);
  const endMinutes = parseInt(tracking.scheduled_end_time.split(':')[0]) * 60 + 
                     parseInt(tracking.scheduled_end_time.split(':')[1]);
  
  // Calculate position relative to work day start
  const workDayStartMinutes = workDayStartHour * 60;
  const relativeStartMinutes = startMinutes - workDayStartMinutes;
  
  const top = (relativeStartMinutes / 60) * HOUR_HEIGHT;
  const height = ((endMinutes - startMinutes) / 60) * HOUR_HEIGHT;
  const isTracking = tracking.actual_start_time && !tracking.actual_end_time;
  const isCompleted = tracking.actual_start_time && tracking.actual_end_time;

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `scheduled-${tracking.id}`,
    data: { tracking, type: 'scheduled' },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  const handleResizeStart = (e: React.MouseEvent, edge: 'top' | 'bottom') => {
    e.stopPropagation();
    setIsResizing(edge);
    setResizeStart({
      y: e.clientY,
      startTime: tracking.scheduled_start_time!,
      endTime: tracking.scheduled_end_time!,
    });
  };

  const handleResizeMove = (e: MouseEvent) => {
    if (!isResizing || !resizeStart) return;

    const deltaY = e.clientY - resizeStart.y;
    const deltaMinutes = Math.round((deltaY / HOUR_HEIGHT) * 60);

    if (isResizing === 'top') {
      const newStartMinutes = startMinutes + deltaMinutes;
      if (newStartMinutes >= 0 && newStartMinutes < endMinutes - 15) {
        const hours = Math.floor(newStartMinutes / 60);
        const mins = newStartMinutes % 60;
        const newStartTime = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
        onUpdateTracking(tracking.id, newStartTime, tracking.scheduled_end_time!);
      }
    } else {
      const newEndMinutes = endMinutes + deltaMinutes;
      if (newEndMinutes > startMinutes + 15 && newEndMinutes <= 24 * 60) {
        const hours = Math.floor(newEndMinutes / 60);
        const mins = newEndMinutes % 60;
        const newEndTime = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
        onUpdateTracking(tracking.id, tracking.scheduled_start_time!, newEndTime);
      }
    }
  };

  const handleResizeEnd = () => {
    setIsResizing(null);
    setResizeStart(null);
  };

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);
      return () => {
        document.removeEventListener('mousemove', handleResizeMove);
        document.removeEventListener('mouseup', handleResizeEnd);
      };
    }
  }, [isResizing, resizeStart]);

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{ ...style, top: `${top}px`, height: `${height}px`, minHeight: '40px' }}
      className={`absolute left-0 right-0 mx-1 rounded-md shadow-sm border-l-4 overflow-visible cursor-move ${
        isCompleted ? 'bg-green-100 border-green-500' :
        isTracking ? 'bg-blue-100 border-blue-500' :
        'bg-primary/10 border-primary'
      }`}
    >
      {/* Resize handle top */}
      <div
        className="absolute top-0 left-0 right-0 h-2 cursor-ns-resize hover:bg-primary/20 flex items-center justify-center"
        onMouseDown={(e) => handleResizeStart(e, 'top')}
      >
        <GripVertical className="h-3 w-3 text-muted-foreground" />
      </div>

      <div className="flex flex-col h-full justify-between p-2">
        <div>
          <div className="font-medium text-xs truncate">{tracking.activity.activity_name}</div>
          <div className="text-xs text-muted-foreground truncate">{tracking.activity.project_name}</div>
          <div className="text-xs flex items-center gap-1 mt-1">
            <Clock className="h-3 w-3" />
            {tracking.scheduled_start_time.substring(0, 5)} - {tracking.scheduled_end_time.substring(0, 5)}
          </div>
        </div>
        <div className="flex gap-1">
          {!tracking.actual_start_time && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2"
              onClick={(e) => {
                e.stopPropagation();
                onStartTracking(tracking.id);
              }}
            >
              <Play className="h-3 w-3" />
            </Button>
          )}
          {isTracking && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2"
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
        className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize hover:bg-primary/20 flex items-center justify-center"
        onMouseDown={(e) => handleResizeStart(e, 'bottom')}
      >
        <GripVertical className="h-3 w-3 text-muted-foreground" />
      </div>
    </div>
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

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const dropData = over.data.current as { date: Date; hour: number };
    if (!dropData) return;

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

  const activeActivity = activeId ? activities.find(a => a.id === activeId) : null;

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

  return (
    <div className="h-screen flex flex-col">
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Calendario Attività</h1>
            <p className="text-muted-foreground">Trascina le attività nel calendario per pianificarle</p>
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
        <DndContext onDragEnd={handleDragEnd} onDragStart={(e) => setActiveId(e.active.id as string)}>
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
                                onUpdateTracking={(id, start, end) => 
                                  updateTrackingTimeMutation.mutate({ 
                                    trackingId: id, 
                                    startTime: start, 
                                    endTime: end 
                                  })
                                }
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
                </div>
              </div>
            </div>
          </div>

          <DragOverlay>
            {activeActivity && (
              <div className="p-3 border rounded-lg bg-background shadow-lg opacity-80">
                <div className="flex flex-col gap-1">
                  <span className="font-medium text-sm">{activeActivity.activity_name}</span>
                  <Badge variant="secondary" className="w-fit text-xs">
                    {activeActivity.category}
                  </Badge>
                </div>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}
