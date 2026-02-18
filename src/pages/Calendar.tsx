import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
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
import { Progress } from '@/components/ui/progress';
import { CalendarSettings, CalendarConfig } from '@/components/CalendarSettings';
import { useCalendarSettings } from '@/hooks/useCalendarSettings';
import { GoogleCalendarEvent, GoogleEvent } from '@/components/GoogleCalendarEvent';
import { CreateManualActivityDialog, RecurrenceData } from '@/components/CreateManualActivityDialog';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger, ContextMenuSeparator } from '@/components/ui/context-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { TimeSlotSelect } from '@/components/ui/time-slot-select';
import { toast } from 'sonner';
import { format, startOfWeek, addDays, addWeeks, subWeeks, isSameDay, parseISO, getDay, isBefore, parse, addMonths } from 'date-fns';
import { it } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Clock, Trash2, Copy, Edit, CheckCircle, Repeat, CalendarOff, RotateCcw, ChevronDown, Users, LayoutGrid, PanelLeftClose, PanelLeft, Search, ZoomIn, ZoomOut } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { DndContext, DragEndEvent, DragOverlay, useDraggable, useDroppable, PointerSensor, useSensor, useSensors, closestCenter, Modifier } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useClosureDays, ClosureDayInfo } from '@/hooks/useClosureDays';
import { categoryColorsSolid, getCategorySolidColor, getCategoryBadgeColor, getCategoryBorderColor, getDynamicCategorySolidColor } from '@/lib/categoryColors';
import { MultiUserCalendarView } from '@/components/MultiUserCalendarView';
import { formatHours } from '@/lib/utils';
import { logAction } from '@/hooks/useActionLogger';

// Roles that can view other users' calendars
const CALENDAR_VIEWER_ROLES = ['admin', 'team_leader', 'coordinator'];
// Roles that can also edit other users' calendars
const CALENDAR_EDITOR_ROLES = ['admin', 'team_leader'];

interface Activity {
  id: string;
  activity_name: string;
  category: string;
  hours_worked: number;
  total_cost: number;
  project_id: string;
  project_name: string;
  assignee_id: string;
  confirmed_hours: number;
  planned_hours: number;
  billing_type?: string | null;
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
  is_recurring?: boolean;
  recurrence_type?: string;
  recurrence_parent_id?: string | null;
  google_event_id?: string | null;
  google_event_title?: string | null;
  confirmed?: boolean;
  activity?: Activity;
}
interface DragCreateState {
  isCreating: boolean;
  startDate: Date | null;
  startHour: number;
  startMinutes: number;
  currentMinutes: number;
}
const HOURS = Array.from({
  length: 24
}, (_, i) => i);
const DEFAULT_HOUR_HEIGHT = 60; // pixels per hour (used as fallback)
const ZOOM_LEVELS = [60, 80, 100, 120]; // Available zoom levels

// Helper to create ISO datetime string with local timezone
const createLocalISOString = (date: string, time: string): string => {
  // time can be HH:mm or HH:mm:ss, normalize to HH:mm:ss
  const normalizedTime = time.length === 5 ? `${time}:00` : time;
  // Create a Date object from local date and time
  const localDate = new Date(`${date}T${normalizedTime}`);
  // Return ISO string which includes timezone offset properly
  return localDate.toISOString();
};

function DraggableActivity({
  activity,
  onComplete
}: {
  activity: Activity;
  onComplete: (activityId: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging
  } = useDraggable({
    id: activity.id,
    data: {
      activity
    }
  });
  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1
  };
  
  // Per progetti interno e consumptive non mostrare ore e alert superamento
  const isInternoOrConsumptive = activity.billing_type === 'interno' || activity.billing_type === 'consumptive';
  
  const totalScheduledHours = activity.confirmed_hours + activity.planned_hours;
  const isOverBudget = !isInternoOrConsumptive && totalScheduledHours > activity.hours_worked;
  const overagePercentage = activity.hours_worked > 0 
    ? ((totalScheduledHours - activity.hours_worked) / activity.hours_worked * 100).toFixed(0)
    : 0;
  
  return <div ref={setNodeRef} style={style} {...listeners} {...attributes} className={`px-2.5 py-1.5 border rounded-md hover:bg-muted/50 transition-colors cursor-move mb-1 ${isOverBudget ? 'border-destructive bg-destructive/5' : ''}`}>
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
    </div>;
}
interface TimeSlotProps {
  date: Date;
  hour: number;
  hourHeight: number;
  onDragCreateStart: (date: Date, hour: number, minutes: number) => void;
  onDragCreateMove: (minutes: number) => void;
  onDragCreateEnd: () => void;
  isDragCreating: boolean;
}
function TimeSlot({
  date,
  hour,
  hourHeight,
  onDragCreateStart,
  onDragCreateMove,
  onDragCreateEnd,
  isDragCreating
}: TimeSlotProps) {
  const slotRef = useRef<HTMLDivElement>(null);
  
  // Calculate minute offset from mouse position for precise drop
  const getMinuteOffsetFromEvent = useCallback((clientY: number) => {
    const rect = slotRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    const relativeY = clientY - rect.top;
    // Snap to 15 minutes
    return Math.floor(relativeY / hourHeight * 60 / 15) * 15;
  }, [hourHeight]);
  
  const {
    setNodeRef,
    isOver,
    active
  } = useDroppable({
    id: `${format(date, 'yyyy-MM-dd')}-${hour}`,
    data: {
      date,
      hour,
      getMinuteOffset: getMinuteOffsetFromEvent,
      slotRef
    }
  });
  
  const handleMouseDown = (e: React.MouseEvent) => {
    if (active) return; // Don't start drag-create if dragging from sidebar
    e.preventDefault();
    const rect = slotRef.current?.getBoundingClientRect();
    if (!rect) return;
    const relativeY = e.clientY - rect.top;
    const minuteOffset = Math.floor(relativeY / hourHeight * 60 / 15) * 15; // Snap to 15 min
    const minutes = hour * 60 + minuteOffset;
    onDragCreateStart(date, hour, minutes);
  };
  return <div ref={node => {
    setNodeRef(node);
    (slotRef as any).current = node;
  }} onMouseDown={handleMouseDown} style={{ height: `${hourHeight}px` }} className={`border-t border-l transition-colors relative ${isOver ? 'bg-primary/20 ring-2 ring-primary ring-inset' : 'hover:bg-muted/30'} ${active ? 'z-0' : ''} ${isDragCreating ? 'cursor-ns-resize' : 'cursor-pointer'}`} />;
}
// Calculate overlapping activities and assign horizontal positions
function calculateOverlapPositions(trackings: TimeTracking[]): Map<string, { column: number; totalColumns: number }> {
  const positions = new Map<string, { column: number; totalColumns: number }>();
  
  // Filter valid trackings and sort by start time
  const validTrackings = trackings
    .filter(t => t.scheduled_start_time && t.scheduled_end_time)
    .sort((a, b) => {
      const aStart = a.scheduled_start_time!;
      const bStart = b.scheduled_start_time!;
      return aStart.localeCompare(bStart);
    });

  if (validTrackings.length === 0) return positions;

  // Helper to convert time string to minutes
  const toMinutes = (time: string) => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  };

  // Find all overlapping groups
  const groups: TimeTracking[][] = [];
  let currentGroup: TimeTracking[] = [];
  let groupEndTime = 0;

  for (const tracking of validTrackings) {
    const startMins = toMinutes(tracking.scheduled_start_time!);
    const endMins = toMinutes(tracking.scheduled_end_time!);

    if (currentGroup.length === 0 || startMins < groupEndTime) {
      // Overlaps with current group
      currentGroup.push(tracking);
      groupEndTime = Math.max(groupEndTime, endMins);
    } else {
      // Start new group
      if (currentGroup.length > 0) {
        groups.push(currentGroup);
      }
      currentGroup = [tracking];
      groupEndTime = endMins;
    }
  }
  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  // Assign columns within each group
  for (const group of groups) {
    const columns: { endTime: number }[] = [];
    
    for (const tracking of group) {
      const startMins = toMinutes(tracking.scheduled_start_time!);
      const endMins = toMinutes(tracking.scheduled_end_time!);
      
      // Find first available column
      let assignedColumn = -1;
      for (let i = 0; i < columns.length; i++) {
        if (columns[i].endTime <= startMins) {
          assignedColumn = i;
          columns[i].endTime = endMins;
          break;
        }
      }
      
      if (assignedColumn === -1) {
        // Need new column
        assignedColumn = columns.length;
        columns.push({ endTime: endMins });
      }
      
      positions.set(tracking.id, { column: assignedColumn, totalColumns: 0 });
    }
    
    // Update total columns for all in group
    const totalColumns = columns.length;
    for (const tracking of group) {
      const pos = positions.get(tracking.id)!;
      pos.totalColumns = totalColumns;
    }
  }

  return positions;
}

function ScheduledActivity({
  tracking,
  workDayStartHour,
  hourHeight,
  onSaveResize,
  onOpenDetail,
  onDuplicate,
  onConfirm,
  onUnconfirm,
  onDelete,
  onDeleteAllRecurring,
  onCompleteActivity,
  overlapPosition
}: {
  tracking: TimeTracking;
  workDayStartHour: number;
  hourHeight: number;
  onSaveResize: (id: string, startTime: string, endTime: string, isConfirmed?: boolean, scheduledDate?: string) => void;
  onOpenDetail: (tracking: TimeTracking) => void;
  onDuplicate: (tracking: TimeTracking) => void;
  onConfirm: (tracking: TimeTracking) => void;
  onUnconfirm: (tracking: TimeTracking) => void;
  onDelete: (tracking: TimeTracking) => void;
  onDeleteAllRecurring: (tracking: TimeTracking) => void;
  onCompleteActivity: (budgetItemId: string) => void;
  overlapPosition?: { column: number; totalColumns: number };
}) {
  const [isResizing, setIsResizing] = useState<'top' | 'bottom' | null>(null);
  const [localTimes, setLocalTimes] = useState<{
    start: string;
    end: string;
  } | null>(null);
  const [resizeStartData, setResizeStartData] = useState<{
    y: number;
    originalStartMinutes: number;
    originalEndMinutes: number;
  } | null>(null);
  if (!tracking.scheduled_start_time || !tracking.scheduled_end_time || !tracking.activity) return null;

  // Use local times during resize, otherwise use tracking times
  const displayStartTime = localTimes?.start || tracking.scheduled_start_time;
  const displayEndTime = localTimes?.end || tracking.scheduled_end_time;
  const startMinutes = parseInt(displayStartTime.split(':')[0]) * 60 + parseInt(displayStartTime.split(':')[1]);
  const endMinutes = parseInt(displayEndTime.split(':')[0]) * 60 + parseInt(displayEndTime.split(':')[1]);

  // Calculate position relative to work day start
  const workDayStartMinutes = workDayStartHour * 60;
  const relativeStartMinutes = startMinutes - workDayStartMinutes;
  const top = relativeStartMinutes / 60 * hourHeight;
  const height = (endMinutes - startMinutes) / 60 * hourHeight;
  const isTrackingNow = tracking.actual_start_time && !tracking.actual_end_time;
  const isCompleted = tracking.actual_start_time && tracking.actual_end_time;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging
  } = useDraggable({
    id: `scheduled-${tracking.id}`,
    data: {
      tracking,
      type: 'scheduled'
    },
    disabled: isResizing !== null
  });
  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1
  };
  const handleResizeStart = (e: React.MouseEvent, edge: 'top' | 'bottom') => {
    e.stopPropagation();
    e.preventDefault();
    const origStart = parseInt(tracking.scheduled_start_time!.split(':')[0]) * 60 + parseInt(tracking.scheduled_start_time!.split(':')[1]);
    const origEnd = parseInt(tracking.scheduled_end_time!.split(':')[0]) * 60 + parseInt(tracking.scheduled_end_time!.split(':')[1]);
    setIsResizing(edge);
    setResizeStartData({
      y: e.clientY,
      originalStartMinutes: origStart,
      originalEndMinutes: origEnd
    });
    setLocalTimes({
      start: tracking.scheduled_start_time!,
      end: tracking.scheduled_end_time!
    });
  };
  useEffect(() => {
    if (!isResizing || !resizeStartData) return;
    const handleResizeMove = (e: MouseEvent) => {
      const deltaY = e.clientY - resizeStartData.y;
      const deltaMinutes = Math.round(deltaY / hourHeight * 60 / 15) * 15; // Snap to 15 min

      if (isResizing === 'top') {
        const newStartMinutes = Math.max(0, Math.min(resizeStartData.originalStartMinutes + deltaMinutes, resizeStartData.originalEndMinutes - 15));
        const hours = Math.floor(newStartMinutes / 60);
        const mins = newStartMinutes % 60;
        const newStartTime = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
        const endHours = Math.floor(resizeStartData.originalEndMinutes / 60);
        const endMins = resizeStartData.originalEndMinutes % 60;
        const endTime = `${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`;
        setLocalTimes({
          start: newStartTime,
          end: endTime
        });
      } else {
        const newEndMinutes = Math.min(24 * 60, Math.max(resizeStartData.originalStartMinutes + 15, resizeStartData.originalEndMinutes + deltaMinutes));
        const hours = Math.floor(newEndMinutes / 60);
        const mins = newEndMinutes % 60;
        const newEndTime = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
        const startHours = Math.floor(resizeStartData.originalStartMinutes / 60);
        const startMins = resizeStartData.originalStartMinutes % 60;
        const startTime = `${startHours.toString().padStart(2, '0')}:${startMins.toString().padStart(2, '0')}`;
        setLocalTimes({
          start: startTime,
          end: newEndTime
        });
      }
    };
    const handleResizeEnd = () => {
      if (localTimes && (localTimes.start !== tracking.scheduled_start_time || localTimes.end !== tracking.scheduled_end_time)) {
        onSaveResize(tracking.id, localTimes.start, localTimes.end, !!isCompleted, tracking.scheduled_date || undefined);
      }
      setIsResizing(null);
      setResizeStartData(null);
      // Keep localTimes until data is refetched, so opening the modal uses the updated times
    };
    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
    return () => {
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeEnd);
    };
  }, [isResizing, resizeStartData, localTimes, tracking.id, tracking.scheduled_start_time, tracking.scheduled_end_time, onSaveResize]);

  // Reset localTimes when tracking data changes (after refetch)
  useEffect(() => {
    setLocalTimes(null);
  }, [tracking.scheduled_start_time, tracking.scheduled_end_time]);

  const handleClick = (e: React.MouseEvent) => {
    if (isDragging || isResizing) return;
    e.stopPropagation();
    // Use updated times if available (after resize but before refetch)
    const updatedTracking = localTimes ? {
      ...tracking,
      scheduled_start_time: localTimes.start,
      scheduled_end_time: localTimes.end
    } : tracking;
    onOpenDetail(updatedTracking);
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
  const categoryBorderColor = getCategoryBorderColor(tracking.activity.category);
  
  // Calculate duration in minutes to determine if tooltip is needed
  const durationMinutes = endMinutes - startMinutes;
  const isShortActivity = durationMinutes < 45;
  const isVeryShortActivity = durationMinutes <= 15;
  
  // Minimum visual height for very short activities to improve usability
  // Use a small minimum (20px) to keep events proportionally accurate
  const minVisualHeight = 20;
  const actualHeight = Math.max(height, minVisualHeight);
  
  // For very short activities, we need to adjust the resize handles
  const resizeHandleHeight = isVeryShortActivity ? 'h-3' : 'h-2';
  // Calculate horizontal position for overlapping activities
  const hasOverlap = overlapPosition && overlapPosition.totalColumns > 1;
  const columnWidth = hasOverlap ? `calc((100% - 8px) / ${overlapPosition.totalColumns})` : 'calc(100% - 8px)';
  const leftOffset = hasOverlap ? `calc(4px + ${overlapPosition.column} * (100% - 8px) / ${overlapPosition.totalColumns})` : '4px';

  const activityContent = (
    <div ref={setNodeRef} {...attributes} {...listeners} data-tracking-id={tracking.id} style={{
      ...style,
      top: `${top}px`,
      height: `${actualHeight}px`,
      left: leftOffset,
      width: columnWidth,
      pointerEvents: isDragging ? 'none' : 'auto',
      transition: isDragging ? 'none' : 'top 0.15s ease-out, height 0.15s ease-out, left 0.15s ease-out, width 0.15s ease-out'
    }} className={`absolute rounded-[2px] shadow-sm border-l-4 overflow-hidden select-none ${isDragging ? 'cursor-grabbing z-50 opacity-80 scale-[1.02]' : 'cursor-grab z-10'} ${categoryBorderColor} ${isCompleted ? 'bg-green-100 dark:bg-green-900/30' : isTrackingNow ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-card'} ${isVeryShortActivity ? 'group hover:z-30 hover:shadow-lg' : ''} ${hasOverlap ? 'hover:z-40 hover:shadow-md' : ''}`} onClick={handleClick}>
      {/* Resize handle top - larger for short activities */}
      <div className={`absolute top-0 left-0 right-0 ${resizeHandleHeight} cursor-ns-resize hover:bg-primary/30 z-20 ${isVeryShortActivity ? 'bg-primary/10' : ''}`} onMouseDown={e => handleResizeStart(e, 'top')} onPointerDown={e => e.stopPropagation()} />

      {/* Google linked badge - hide when confirmed */}
      {tracking.google_event_id && !isCompleted && <div className={`absolute top-1 ${tracking.is_recurring ? 'right-12' : 'right-6'} z-10`}>
          <Badge variant="outline" className="bg-yellow-100 dark:bg-yellow-900/50 border-yellow-400 text-yellow-700 dark:text-yellow-300 text-[10px] px-1.5 py-0 h-4">
            Google
          </Badge>
        </div>}

      {/* Recurring badge */}
      {tracking.is_recurring && <div className={`absolute top-1 ${isCompleted ? 'right-20' : 'right-6'} z-10`}>
          <Badge variant="outline" className="bg-background/80 text-[10px] px-1.5 py-0 h-4 flex items-center gap-0.5">
            <Repeat className="h-2.5 w-2.5" />
          </Badge>
        </div>}

      {/* Confirmed badge */}
      {isCompleted && <div className="absolute top-1 right-1 z-10">
          <div className="bg-green-500 text-white rounded-full p-0.5">
            <Clock className="h-3 w-3" />
          </div>
        </div>}

      {/* Content */}
      <div className="flex flex-col h-full justify-between p-1.5 pt-2 pb-3">
        <div className="min-w-0">
          {/* Show Google event title if linked */}
          {tracking.google_event_title ? (
            <>
              <div className={`font-medium text-xs truncate ${isCompleted ? 'pr-16' : ''}`}>{tracking.google_event_title}</div>
              <div className="text-xs text-muted-foreground truncate">{tracking.activity.project_name}</div>
            </>
          ) : (
            <>
              <div className={`font-medium text-xs truncate ${isCompleted ? 'pr-16' : ''}`}>{tracking.activity.activity_name}</div>
              <div className="text-xs text-muted-foreground truncate">{tracking.activity.project_name}</div>
            </>
          )}
          <div className="text-xs flex items-center gap-1 mt-0.5">
            <Clock className="h-3 w-3 flex-shrink-0" />
            <span>{displayStartTime.substring(0, 5)} - {displayEndTime.substring(0, 5)}</span>
          </div>
        </div>
      </div>

      {/* Resize handle bottom - larger for short activities */}
      <div className={`absolute bottom-0 left-0 right-0 ${resizeHandleHeight} cursor-ns-resize hover:bg-primary/30 z-20 ${isVeryShortActivity ? 'bg-primary/10' : ''}`} onMouseDown={e => handleResizeStart(e, 'bottom')} onPointerDown={e => e.stopPropagation()} />
    </div>
  );

  const tooltipContent = (
    <div className="space-y-1 max-w-xs">
      {tracking.google_event_title && (
        <div className="font-medium">{tracking.google_event_title}</div>
      )}
      <div className="font-medium">{tracking.activity.activity_name}</div>
      <div className="text-muted-foreground">{tracking.activity.project_name}</div>
      <div className="flex items-center gap-1">
        <Clock className="h-3 w-3" />
        <span>{displayStartTime.substring(0, 5)} - {displayEndTime.substring(0, 5)}</span>
      </div>
      {tracking.notes && (
        <div className="text-muted-foreground text-xs pt-1 border-t">{tracking.notes}</div>
      )}
      <Badge className={`${getCategoryBadgeColor(tracking.activity.category)} mt-1`}>
        {tracking.activity.category}
      </Badge>
    </div>
  );
  
  // Always show tooltip for short activities, and show it faster for very short ones
  const wrappedContent = isShortActivity ? (
    <TooltipProvider>
      <Tooltip delayDuration={isVeryShortActivity ? 100 : 200}>
        <TooltipTrigger asChild>
          {activityContent}
        </TooltipTrigger>
        <TooltipContent side="right" className="z-50">
          {tooltipContent}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ) : (
    activityContent
  );

  return <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="contents">
          {wrappedContent}
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
        {isCompleted ? <ContextMenuItem onClick={() => onUnconfirm(tracking)}>
            <Clock className="h-4 w-4 mr-2" />
            Annulla conferma tempo
          </ContextMenuItem> : <ContextMenuItem onClick={() => onConfirm(tracking)} disabled={!canConfirm} className={!canConfirm ? 'opacity-50 cursor-not-allowed' : ''}>
            <Clock className="h-4 w-4 mr-2" />
            Conferma tempo
          </ContextMenuItem>}
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => onCompleteActivity(tracking.budget_item_id)} className="text-green-600 focus:text-green-600">
          <CheckCircle className="h-4 w-4 mr-2" />
          Completa attività
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => onDelete(tracking)} className="text-destructive focus:text-destructive">
          <Trash2 className="h-4 w-4 mr-2" />
          Elimina
        </ContextMenuItem>
        {tracking.is_recurring && <>
            <ContextMenuItem onClick={() => onDeleteAllRecurring(tracking)} className="text-destructive focus:text-destructive">
              <Trash2 className="h-4 w-4 mr-2" />
              Elimina tutte le ricorrenze
            </ContextMenuItem>
          </>}
      </ContextMenuContent>
    </ContextMenu>;
}
export default function Calendar() {
  const queryClient = useQueryClient();
  const { config, saveConfig, isLoading: isConfigLoading } = useCalendarSettings();
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(startOfWeek(new Date(), {
    weekStartsOn: 1 // Default to Monday, will update when config loads
  }));
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [projectFilterOpen, setProjectFilterOpen] = useState(false);
  const [projectFilterSearch, setProjectFilterSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activitySearchQuery, setActivitySearchQuery] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedTracking, setSelectedTracking] = useState<TimeTracking | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [isDuplicateMode, setIsDuplicateMode] = useState(false);
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);
  const { getClosureDaysForDates, isClosureDay } = useClosureDays();
  
  // User viewing state - for viewing other users' calendars
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  
  // Sidebar visibility state - persisted in localStorage
  const [isSidebarVisible, setIsSidebarVisible] = useState(() => {
    const saved = localStorage.getItem('calendar-sidebar-visible');
    return saved !== null ? saved === 'true' : true;
  });
  
  // Persist sidebar visibility preference
  useEffect(() => {
    localStorage.setItem('calendar-sidebar-visible', String(isSidebarVisible));
  }, [isSidebarVisible]);
  
  // Multi-user calendar view state
  const [showMultiUserView, setShowMultiUserView] = useState(false);
  // Hidden Google events (stored in localStorage)
  const [hiddenGoogleEvents, setHiddenGoogleEvents] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('hiddenGoogleEvents');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  
  const [detailForm, setDetailForm] = useState({
    scheduled_date: '',
    scheduled_start_time: '',
    scheduled_end_time: '',
    notes: '',
    selectedProject: '',
    selectedActivity: ''
  });
  const [detailProjectSearch, setDetailProjectSearch] = useState('');

  // Drag-to-create state
  const [dragCreateState, setDragCreateState] = useState<DragCreateState>({
    isCreating: false,
    startDate: null,
    startHour: 0,
    startMinutes: 0,
    currentMinutes: 0
  });
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createDialogData, setCreateDialogData] = useState({
    date: '',
    startTime: '',
    endTime: ''
  });
  
  // Track last mouse position for precise drop
  const lastMousePositionRef = useRef<{ clientX: number; clientY: number } | null>(null);
  
  // Track the initial drag offset (where user grabbed the activity relative to its top)
  const dragStartOffsetRef = useRef<number>(0);
  
  // Track mouse position during drag
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      lastMousePositionRef.current = { clientX: e.clientX, clientY: e.clientY };
    };
    document.addEventListener('mousemove', handleMouseMove);
    return () => document.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Drag-to-create handlers
  const handleDragCreateStart = useCallback((date: Date, hour: number, minutes: number) => {
    // Check if it's a closure day
    const closureDay = isClosureDay(date);
    if (closureDay) {
      toast.error(`Non puoi pianificare attività il ${format(date, 'd MMMM', { locale: it })}`, {
        description: `${closureDay.name} - Giorno di chiusura aziendale`
      });
      return;
    }
    
    setDragCreateState({
      isCreating: true,
      startDate: date,
      startHour: hour,
      startMinutes: minutes,
      currentMinutes: minutes + config.defaultSlotDuration // Use configured slot duration
    });
  }, [isClosureDay]);
  const handleDragCreateMove = useCallback((e: MouseEvent) => {
    if (!dragCreateState.isCreating || !dragCreateState.startDate) return;
    const calendarGrid = document.querySelector('[data-calendar-grid]');
    if (!calendarGrid) return;
    const rect = calendarGrid.getBoundingClientRect();
    const relativeY = e.clientY - rect.top;
    const workDayStartHour = parseInt(config.workDayStart.split(':')[0]);
    const currentHourHeight = config.zoomLevel || DEFAULT_HOUR_HEIGHT;

    // Calculate total minutes from the top of the grid
    const totalMinutes = Math.floor(relativeY / currentHourHeight * 60) + workDayStartHour * 60;
    // Snap to 15 minutes
    const snappedMinutes = Math.floor(totalMinutes / 15) * 15;
    setDragCreateState(prev => ({
      ...prev,
      currentMinutes: Math.max(prev.startMinutes + config.defaultSlotDuration, snappedMinutes) // Use configured slot duration as minimum
    }));
  }, [dragCreateState.isCreating, dragCreateState.startDate, dragCreateState.startMinutes, config.workDayStart]);
  const handleDragCreateEnd = useCallback(() => {
    if (!dragCreateState.isCreating || !dragCreateState.startDate) return;
    const startMinutes = Math.min(dragCreateState.startMinutes, dragCreateState.currentMinutes);
    const endMinutes = Math.max(dragCreateState.startMinutes, dragCreateState.currentMinutes);

    // Format times
    const startHours = Math.floor(startMinutes / 60);
    const startMins = startMinutes % 60;
    const endHours = Math.floor(endMinutes / 60);
    const endMins = endMinutes % 60;
    const startTime = `${startHours.toString().padStart(2, '0')}:${startMins.toString().padStart(2, '0')}`;
    const endTime = `${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`;
    setCreateDialogData({
      date: format(dragCreateState.startDate, 'yyyy-MM-dd'),
      startTime,
      endTime
    });
    setCreateDialogOpen(true);
    setDragCreateState({
      isCreating: false,
      startDate: null,
      startHour: 0,
      startMinutes: 0,
      currentMinutes: 0
    });
  }, [dragCreateState]);

  // Global mouse event listeners for drag-to-create
  useEffect(() => {
    if (dragCreateState.isCreating) {
      const handleMouseMove = (e: MouseEvent) => handleDragCreateMove(e);
      const handleMouseUp = () => handleDragCreateEnd();
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragCreateState.isCreating, handleDragCreateMove, handleDragCreateEnd]);

  // Configure drag sensors
  const sensors = useSensors(useSensor(PointerSensor, {
    activationConstraint: {
      distance: 8 // 8px movement before drag starts
    }
  }));

  // Snap modifier for 15-minute intervals (15px = 15 minutes since HOUR_HEIGHT = 60px)
  const snapTo15MinModifier: Modifier = ({ transform }) => {
    return {
      ...transform,
      y: Math.round(transform.y / 15) * 15, // Snap to 15px intervals
    };
  };

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Update week start when config changes
  const handleConfigChange = async (newConfig: CalendarConfig) => {
    await saveConfig(newConfig);
    setCurrentWeekStart(startOfWeek(new Date(), {
      weekStartsOn: newConfig.weekStartsOn as 0 | 1 | 2 | 3 | 4 | 5 | 6
    }));
  };
  const weekDays = useMemo(() => {
    const days = Array.from({
      length: config.numberOfDays
    }, (_, i) => addDays(currentWeekStart, i));

    // Filter weekends if showWeekends is false
    if (!config.showWeekends) {
      return days.filter(day => {
        const dayOfWeek = getDay(day);
        return dayOfWeek !== 0 && dayOfWeek !== 6; // 0 = Sunday, 6 = Saturday
      });
    }
    return days;
  }, [currentWeekStart, config.numberOfDays, config.showWeekends]);

  // Get closure days for the visible week
  const closureDaysMap = useMemo(() => {
    return getClosureDaysForDates(weekDays);
  }, [weekDays, getClosureDaysForDates]);

  // Calculate visible hours based on work day settings
  const visibleHours = useMemo(() => {
    const startHour = parseInt(config.workDayStart.split(':')[0]);
    const endHour = parseInt(config.workDayEnd.split(':')[0]);
    return Array.from({
      length: endHour - startHour + 1
    }, (_, i) => startHour + i);
  }, [config.workDayStart, config.workDayEnd]);

  // Get current zoom level (hourHeight in pixels)
  const hourHeight = config.zoomLevel || DEFAULT_HOUR_HEIGHT;

  // Get current user
  const {
    data: currentUser
  } = useQuery({
    queryKey: ['current-user'],
    queryFn: async () => {
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      return user;
    }
  });

  // Get current user's role
  const {
    data: userRole
  } = useQuery({
    queryKey: ['current-user-role', currentUser?.id],
    queryFn: async () => {
      if (!currentUser?.id) return null;
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', currentUser.id)
        .maybeSingle();
      if (error) throw error;
      return data?.role || null;
    },
    enabled: !!currentUser?.id
  });

  // Check if user can view other users' calendars
  const canViewOtherUsers = userRole && CALENDAR_VIEWER_ROLES.includes(userRole);

  // Get all users for the selector (only for admin/team_leader/coordinator)
  const {
    data: allUsers = []
  } = useQuery<{ id: string; first_name: string; last_name: string; avatar_url: string | null }[]>({
    queryKey: ['all-users-for-calendar'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, avatar_url')
        .eq('approved', true)
        .is('deleted_at', null)
        .order('first_name', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!canViewOtherUsers
  });

  // Determine which user's calendar to show
  const viewingUserId = selectedUserId || currentUser?.id;
  const isViewingOtherUser = selectedUserId !== null && selectedUserId !== currentUser?.id;
  
  // Check if user can edit other users' calendars (admin and team_leader only)
  const canEditOtherUsers = userRole && CALENDAR_EDITOR_ROLES.includes(userRole);
  const isReadOnly = isViewingOtherUser && !canEditOtherUsers;

  // Get user's contract data for the viewing user
  const {
    data: userContractData
  } = useQuery<{ contract_hours: number | null; contract_hours_period: string | null }>({
    queryKey: ['user-contract-data', viewingUserId],
    queryFn: async () => {
      if (!viewingUserId) return { contract_hours: null, contract_hours_period: null };
      const { data, error } = await supabase
        .from('profiles')
        .select('contract_hours, contract_hours_period')
        .eq('id', viewingUserId)
        .single();
      if (error) throw error;
      return data || { contract_hours: null, contract_hours_period: null };
    },
    enabled: !!viewingUserId
  });

  // Calculate weekly contract hours
  const weeklyContractHours = useMemo(() => {
    if (!userContractData?.contract_hours) return 0;
    switch (userContractData.contract_hours_period) {
      case 'daily':
        return userContractData.contract_hours * 5;
      case 'weekly':
        return userContractData.contract_hours;
      case 'monthly':
        return userContractData.contract_hours / 4;
      default:
        return userContractData.contract_hours / 4;
    }
  }, [userContractData]);

  // Get the selected user's info for display
  const selectedUserInfo = useMemo(() => {
    if (!selectedUserId || selectedUserId === currentUser?.id) return null;
    return allUsers.find(u => u.id === selectedUserId);
  }, [selectedUserId, currentUser?.id, allUsers]);

  // Get activity categories from database (all categories, visible to all roles)
  const {
    data: activityCategories = []
  } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['activity-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activity_categories')
        .select('id, name')
        .order('name', { ascending: true });
      if (error) throw error;
      return data || [];
    }
  });

  // Get user's assigned activities (from activity_time_tracking assignments with joined budget_items)
  const {
    data: activities = []
  } = useQuery<Activity[]>({
    queryKey: ['user-activities', viewingUserId],
    queryFn: async () => {
      if (!viewingUserId) return [];
      
      // Get activities directly assigned to the user from budget_items
      const { data: assignedActivities, error: assignedError } = await supabase
        .from('budget_items')
        .select(`
          id,
          activity_name,
          category,
          hours_worked,
          total_cost,
          project_id,
          assignee_id,
          is_product,
          projects:project_id (
            name,
            billing_type,
            status
          )
        `)
        .eq('assignee_id', viewingUserId)
        .neq('is_product', true);
      
      if (assignedError) throw assignedError;
      
      // Get time tracking data for calculating hours AND for finding activities with existing schedules
      const { data: timeTrackingData, error: timeError } = await supabase
        .from('activity_time_tracking')
        .select(`
          budget_item_id,
          scheduled_start_time,
          scheduled_end_time,
          actual_start_time,
          actual_end_time,
          google_event_id,
          budget_items:budget_item_id (
            id,
            activity_name,
            category,
            hours_worked,
            total_cost,
            project_id,
            assignee_id,
            is_product,
            projects:project_id (
              name,
              billing_type,
              status
            )
          )
        `)
        .eq('user_id', viewingUserId);
      
      if (timeError) throw timeError;
      
      // Track which activities have non-google assignments (real schedules)
      const activitiesWithRealSchedules = new Set<string>();
      (timeTrackingData || []).forEach(tracking => {
        const budgetItem = (tracking as any).budget_items;
        if (budgetItem && !tracking.google_event_id) {
          activitiesWithRealSchedules.add(budgetItem.id);
        }
      });
      
      // Calculate hours per activity from time tracking
      const activityHoursMap = new Map<string, { confirmed: number; planned: number }>();
      
      (timeTrackingData || []).forEach(tracking => {
        const budgetItemId = tracking.budget_item_id;
        if (!activityHoursMap.has(budgetItemId)) {
          activityHoursMap.set(budgetItemId, { confirmed: 0, planned: 0 });
        }
        
        const hours = activityHoursMap.get(budgetItemId)!;
        
        // Calculate hours from scheduled times
        if (tracking.scheduled_start_time && tracking.scheduled_end_time) {
          const startParts = tracking.scheduled_start_time.split(':');
          const endParts = tracking.scheduled_end_time.split(':');
          const startMinutes = parseInt(startParts[0]) * 60 + parseInt(startParts[1]);
          const endMinutes = parseInt(endParts[0]) * 60 + parseInt(endParts[1]);
          const scheduledHours = (endMinutes - startMinutes) / 60;
          
          // If confirmed (has actual_start_time and actual_end_time), add to confirmed
          if (tracking.actual_start_time && tracking.actual_end_time) {
            hours.confirmed += scheduledHours;
          } else {
            // Otherwise add to planned
            hours.planned += scheduledHours;
          }
        }
      });
      
      // Build activities map - combine assigned activities + activities with existing schedules
      const activityMap = new Map<string, Activity>();
      
      // First, add activities directly assigned to the user
      (assignedActivities || []).forEach(budgetItem => {
        // Exclude import category and products
        if (budgetItem.category?.toLowerCase() === 'import') return;
        
        const project = (budgetItem as any).projects;
        // Only include activities from active projects (not archived)
        if (project?.status === 'archiviato') return;
        
        const hoursData = activityHoursMap.get(budgetItem.id) || { confirmed: 0, planned: 0 };
        activityMap.set(budgetItem.id, {
          id: budgetItem.id,
          activity_name: budgetItem.activity_name,
          category: budgetItem.category,
          hours_worked: budgetItem.hours_worked,
          total_cost: budgetItem.total_cost,
          project_id: budgetItem.project_id || '',
          assignee_id: budgetItem.assignee_id || '',
          project_name: project?.name || 'Progetto sconosciuto',
          confirmed_hours: hoursData.confirmed,
          planned_hours: hoursData.planned,
          billing_type: project?.billing_type
        });
      });
      
      // Then, add activities with FUTURE schedules (even if user is no longer assigned)
      // Only show unassigned activities if they have upcoming/today schedules
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split('T')[0];
      
      (timeTrackingData || []).forEach(tracking => {
        const budgetItem = (tracking as any).budget_items;
        const scheduledDate = (tracking as any).scheduled_date;
        
        // Exclude products, import category, duplicates, and activities that only have Google event assignments
        if (budgetItem && 
            !budgetItem.is_product && 
            budgetItem.category?.toLowerCase() !== 'import' && 
            !activityMap.has(budgetItem.id) &&
            activitiesWithRealSchedules.has(budgetItem.id)) {
          
          // For unassigned activities, only show if there are future/today schedules
          if (scheduledDate && scheduledDate < todayStr) {
            return; // Skip past schedules for unassigned activities
          }
          
          const project = budgetItem.projects;
          // Only include activities from active projects (not archived)
          if (project?.status === 'archiviato') return;
          
          const hoursData = activityHoursMap.get(budgetItem.id) || { confirmed: 0, planned: 0 };
          activityMap.set(budgetItem.id, {
            id: budgetItem.id,
            activity_name: budgetItem.activity_name,
            category: budgetItem.category,
            hours_worked: budgetItem.hours_worked,
            total_cost: budgetItem.total_cost,
            project_id: budgetItem.project_id,
            assignee_id: budgetItem.assignee_id,
            project_name: project?.name || 'Progetto sconosciuto',
            confirmed_hours: hoursData.confirmed,
            planned_hours: hoursData.planned,
            billing_type: project?.billing_type
          });
        }
      });
      
      return Array.from(activityMap.values());
    },
    enabled: !!viewingUserId
  });

  // Get completed activities for the user
  const {
    data: completedActivitiesData = []
  } = useQuery<{ budget_item_id: string; completed_at: string }[]>({
    queryKey: ['user-completed-activities', viewingUserId],
    queryFn: async () => {
      if (!viewingUserId) return [];
      const { data, error } = await supabase
        .from('user_activity_completions')
        .select('budget_item_id, completed_at')
        .eq('user_id', viewingUserId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!viewingUserId
  });

  // Extract just the IDs for filtering
  const completedActivities = useMemo(() => {
    return completedActivitiesData.map(d => d.budget_item_id);
  }, [completedActivitiesData]);

  // Filter out completed activities
  const activeActivities = useMemo(() => {
    return activities.filter(a => !completedActivities.includes(a.id));
  }, [activities, completedActivities]);

  // Get completed activities with full info including completion date
  const completedActivitiesWithInfo = useMemo(() => {
    return activities
      .filter(a => completedActivities.includes(a.id))
      .map(a => {
        const completionData = completedActivitiesData.find(c => c.budget_item_id === a.id);
        return {
          ...a,
          completed_at: completionData?.completed_at || null
        };
      });
  }, [activities, completedActivities, completedActivitiesData]);

  // Get time tracking for current week
  const {
    data: timeTracking = []
  } = useQuery<TimeTracking[]>({
    queryKey: ['time-tracking', viewingUserId, format(currentWeekStart, 'yyyy-MM-dd')],
    queryFn: async () => {
      if (!viewingUserId) return [];
      const startDate = format(currentWeekStart, 'yyyy-MM-dd');
      const endDate = format(addDays(currentWeekStart, 6), 'yyyy-MM-dd');
      const {
        data,
        error
      } = await supabase.from('activity_time_tracking').select(`
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
              name,
              billing_type
            )
          )
        `).eq('user_id', viewingUserId).gte('scheduled_date', startDate).lte('scheduled_date', endDate);
      if (error) throw error;
      return (data || []).map(item => ({
        ...item,
        activity: item.budget_items ? {
          ...(item as any).budget_items,
          project_name: (item as any).budget_items?.projects?.name || 'Progetto sconosciuto',
          billing_type: (item as any).budget_items?.projects?.billing_type
        } : undefined
      }));
    },
    enabled: !!viewingUserId
  });

  // Get all projects where the user is a team member, project leader, or account
  // For privileged roles (admin, finance, team_leader, coordinator, account), load ALL approved projects
  const canViewAllProjects = userRole && ['admin', 'finance', 'team_leader', 'coordinator', 'account'].includes(userRole);
  
  const {
    data: accessibleProjects = []
  } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['accessible-projects-for-google', currentUser?.id, canViewAllProjects],
    queryFn: async () => {
      if (!currentUser?.id) return [];
      
      // Privileged roles see all approved projects
      if (canViewAllProjects) {
        const { data, error } = await supabase
          .from('projects')
          .select('id, name')
          .eq('status', 'approvato')
          .order('name', { ascending: true });
        if (error) throw error;
        return data || [];
      }
      
      // Members: only projects they are assigned to
      const { data: leaderProjects, error: leaderError } = await supabase
        .from('projects')
        .select('id, name')
        .eq('status', 'approvato')
        .or(`project_leader_id.eq.${currentUser.id},account_user_id.eq.${currentUser.id}`)
        .order('name', { ascending: true });
      
      if (leaderError) throw leaderError;
      
      const { data: memberProjects, error: memberError } = await supabase
        .from('project_members')
        .select('project_id, projects:project_id(id, name, status)')
        .eq('user_id', currentUser.id);
      
      if (memberError) throw memberError;
      
      const projectsMap = new Map<string, { id: string; name: string }>();
      
      (leaderProjects || []).forEach(p => {
        projectsMap.set(p.id, { id: p.id, name: p.name });
      });
      
      (memberProjects || []).forEach(m => {
        const proj = (m as any).projects;
        if (proj && proj.status === 'approvato') {
          projectsMap.set(proj.id, { id: proj.id, name: proj.name });
        }
      });
      
      return Array.from(projectsMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    },
    enabled: !!currentUser?.id
  });

  // Get activities for accessible projects (for Google Calendar conversion)
  const {
    data: accessibleActivities = []
  } = useQuery<{ id: string; activity_name: string; project_id: string; project_name: string; category: string; hours_worked: number }[]>({
    queryKey: ['accessible-activities-for-google', accessibleProjects],
    queryFn: async () => {
      if (accessibleProjects.length === 0) return [];
      
      const projectIds = accessibleProjects.map(p => p.id);
      
      const { data, error } = await supabase
        .from('budget_items')
        .select(`
          id,
          activity_name,
          category,
          hours_worked,
          project_id,
          is_product,
          projects:project_id(name)
        `)
        .in('project_id', projectIds)
        .eq('is_product', false)
        .neq('category', 'Import')
        .order('activity_name', { ascending: true });
      
      if (error) throw error;
      
      return (data || []).map(item => ({
        id: item.id,
        activity_name: item.activity_name,
        project_id: item.project_id,
        project_name: (item as any).projects?.name || 'Progetto sconosciuto',
        category: item.category,
        hours_worked: item.hours_worked
      }));
    },
    enabled: accessibleProjects.length > 0
  });

  // Fetch Google Calendar events and sync linked entries
  const {
    data: googleEvents = []
  } = useQuery<GoogleEvent[]>({
    queryKey: ['google-calendar-events', format(currentWeekStart, 'yyyy-MM-dd'), isGoogleConnected],
    queryFn: async () => {
      if (!isGoogleConnected) return [];
      const {
        data: {
          session
        }
      } = await supabase.auth.getSession();
      if (!session) return [];
      const startDate = currentWeekStart.toISOString();
      const endDate = addDays(currentWeekStart, 7).toISOString();
      try {
        const response = await fetch(`https://dmwyqyqaseyuybqfawvk.supabase.co/functions/v1/google-calendar-events?action=events&timeMin=${encodeURIComponent(startDate)}&timeMax=${encodeURIComponent(endDate)}`, {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          }
        });
        const data = await response.json();
        if (!data.connected || !data.events) return [];
        
        const events: GoogleEvent[] = data.events;
        
        // Sync linked activity_time_tracking entries with updated Google events
        // Only sync title and date (event moved to different day), NOT times
        // Times are intentionally NOT synced because users may adjust duration locally
        if (events.length > 0 && currentUser?.id) {
          const eventIds = events.map(e => e.id);
          const { data: linkedEntries } = await supabase
            .from('activity_time_tracking')
            .select('id, google_event_id, google_event_title, scheduled_date')
            .eq('user_id', currentUser.id)
            .in('google_event_id', eventIds);
          
          if (linkedEntries && linkedEntries.length > 0) {
            let hasUpdates = false;
            for (const entry of linkedEntries) {
              const gEvent = events.find(e => e.id === entry.google_event_id);
              if (!gEvent) continue;
              
              const eventStart = parseISO(gEvent.start);
              const newDate = format(eventStart, 'yyyy-MM-dd');
              const newTitle = gEvent.title || '';
              
              // Only sync title and date changes (not times)
              if (
                entry.google_event_title !== newTitle ||
                entry.scheduled_date !== newDate
              ) {
                hasUpdates = true;
                await supabase
                  .from('activity_time_tracking')
                  .update({
                    google_event_title: newTitle,
                    scheduled_date: newDate,
                    notes: newTitle,
                  })
                  .eq('id', entry.id);
              }
            }
            if (hasUpdates) {
              queryClient.invalidateQueries({ queryKey: ['time-tracking'] });
            }
          }
        }
        
        return events;
      } catch (error) {
        console.error('Error fetching Google events:', error);
        return [];
      }
    },
    enabled: isGoogleConnected
  });

  // Link Google event to activity mutation
  const convertGoogleEventMutation = useMutation({
    mutationFn: async ({
      event,
      budgetItemId,
      customDate,
      customStartTime,
      customEndTime
    }: {
      event: GoogleEvent;
      budgetItemId: string;
      customDate?: string;
      customStartTime?: string;
      customEndTime?: string;
    }) => {
      if (!currentUser?.id) throw new Error('No user');
      
      // Use custom values if provided, otherwise fallback to event values
      const eventStart = parseISO(event.start);
      const eventEnd = parseISO(event.end);
      const scheduledDate = customDate || format(eventStart, 'yyyy-MM-dd');
      const scheduledStartTime = customStartTime || (event.allDay ? '09:00' : format(eventStart, 'HH:mm'));
      const scheduledEndTime = customEndTime || (event.allDay ? '10:00' : format(eventEnd, 'HH:mm'));
      
      const {
        error
      } = await supabase.from('activity_time_tracking').insert({
        budget_item_id: budgetItemId,
        user_id: currentUser.id,
        scheduled_date: scheduledDate,
        scheduled_start_time: scheduledStartTime,
        scheduled_end_time: scheduledEndTime,
        notes: event.title || '',
        google_event_id: event.id,
        google_event_title: event.title
      });
      if (error) throw error;
      
      return event.id;
    },
    onSuccess: (googleEventId) => {
      logAction({
        actionType: 'create',
        actionDescription: 'Collegato evento Google a time entry',
        entityType: 'timesheet',
      });
      // Hide the Google event after linking
      handleHideGoogleEvent(googleEventId);
      queryClient.invalidateQueries({ queryKey: ['time-tracking'] });
      queryClient.invalidateQueries({ queryKey: ['user-activities'] });
      toast.success('Evento Google collegato all\'attività');
    },
    onError: error => {
      console.error('Error linking Google event:', error);
      toast.error('Errore durante il collegamento');
    }
  });
  const scheduleActivityMutation = useMutation({
    mutationFn: async (data: {
      budget_item_id: string;
      scheduled_date: string;
      scheduled_start_time: string;
      scheduled_end_time: string;
      notes?: string;
      recurrence?: RecurrenceData;
    }) => {
      const {
        recurrence,
        ...baseData
      } = data;

      // Generate dates for recurring activities
      const datesToCreate: string[] = [data.scheduled_date];
      if (recurrence?.is_recurring && recurrence.recurrence_type !== 'none') {
        const startDate = parseISO(data.scheduled_date);
        let currentDate = startDate;
        
        const interval = recurrence.recurrence_interval || 1;
        const daysOfWeek = recurrence.recurrence_days_of_week || [];
        
        const getNextDate = (date: Date): Date => {
          switch (recurrence.recurrence_type) {
            case 'daily':
              return addDays(date, interval);
            case 'weekly':
              // For weekly, we advance by 1 day and check if it matches selected days
              return addDays(date, 1);
            case 'monthly':
              return addMonths(date, 1);
            default:
              return addDays(date, 7);
          }
        };
        
        const shouldIncludeDate = (date: Date): boolean => {
          if (recurrence.recurrence_type === 'weekly' && daysOfWeek.length > 0) {
            return daysOfWeek.includes(date.getDay());
          }
          return true;
        };
        
        if (recurrence.recurrence_end_date) {
          const endDate = parseISO(recurrence.recurrence_end_date);
          while (currentDate < endDate) {
            currentDate = getNextDate(currentDate);
            if (currentDate <= endDate && shouldIncludeDate(currentDate)) {
              datesToCreate.push(format(currentDate, 'yyyy-MM-dd'));
            }
          }
        } else if (recurrence.recurrence_count) {
          let count = 1; // Start from 1 because we already have the first date
          while (count < recurrence.recurrence_count) {
            currentDate = getNextDate(currentDate);
            if (shouldIncludeDate(currentDate)) {
              datesToCreate.push(format(currentDate, 'yyyy-MM-dd'));
              count++;
            }
            // Safety limit to prevent infinite loops
            if (datesToCreate.length > 365) break;
          }
        }
      }

      // Insert the first activity (parent)
      const {
        data: parentActivity,
        error: parentError
      } = await supabase.from('activity_time_tracking').insert({
        budget_item_id: baseData.budget_item_id,
        scheduled_date: datesToCreate[0],
        scheduled_start_time: baseData.scheduled_start_time,
        scheduled_end_time: baseData.scheduled_end_time,
        notes: baseData.notes,
        user_id: viewingUserId,
        is_recurring: recurrence?.is_recurring || false,
        recurrence_type: recurrence?.recurrence_type || 'none',
        recurrence_end_date: recurrence?.recurrence_end_date || null,
        recurrence_count: recurrence?.recurrence_count || null
      }).select('id').single();
      if (parentError) throw parentError;

      // Insert child activities for recurring
      if (datesToCreate.length > 1 && parentActivity) {
        const childActivities = datesToCreate.slice(1).map(date => ({
          budget_item_id: baseData.budget_item_id,
          scheduled_date: date,
          scheduled_start_time: baseData.scheduled_start_time,
          scheduled_end_time: baseData.scheduled_end_time,
          notes: baseData.notes,
          user_id: viewingUserId,
          is_recurring: true,
          recurrence_type: recurrence?.recurrence_type || 'none',
          recurrence_parent_id: parentActivity.id
        }));
        const {
          error: childError
        } = await supabase.from('activity_time_tracking').insert(childActivities);
        if (childError) throw childError;
      }
    },
    onSuccess: () => {
      logAction({
        actionType: 'create',
        actionDescription: 'Pianificata nuova time entry',
        entityType: 'timesheet',
      });
      queryClient.invalidateQueries({ queryKey: ['time-tracking'] });
      queryClient.invalidateQueries({ queryKey: ['user-activities'] });
      toast.success('Attività pianificata');
    },
    onError: error => {
      console.error('Error scheduling activity:', error);
      toast.error('Errore durante la pianificazione');
    }
  });
  const updateTrackingTimeMutation = useMutation({
    mutationFn: async ({
      trackingId,
      startTime,
      endTime,
      isConfirmed,
      scheduledDate
    }: {
      trackingId: string;
      startTime: string;
      endTime: string;
      isConfirmed?: boolean;
      scheduledDate?: string;
    }) => {
      const updateData: Record<string, any> = {
        scheduled_start_time: startTime,
        scheduled_end_time: endTime
      };
      
      // If the activity is confirmed, also update actual times with proper timezone
      if (isConfirmed && scheduledDate) {
        updateData.actual_start_time = createLocalISOString(scheduledDate, startTime);
        updateData.actual_end_time = createLocalISOString(scheduledDate, endTime);
      }
      
      const {
        error
      } = await supabase.from('activity_time_tracking').update(updateData).eq('id', trackingId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-tracking'] });
      queryClient.invalidateQueries({ queryKey: ['user-activities'] });
    },
    onError: error => {
      console.error('Error updating tracking time:', error);
      toast.error('Errore durante l\'aggiornamento');
    }
  });
  const moveTrackingMutation = useMutation({
    mutationFn: async ({
      trackingId,
      newDate,
      newStartTime,
      newEndTime,
      isConfirmed
    }: {
      trackingId: string;
      newDate: string;
      newStartTime: string;
      newEndTime: string;
      isConfirmed?: boolean;
    }) => {
      const updateData: Record<string, any> = {
        scheduled_date: newDate,
        scheduled_start_time: newStartTime,
        scheduled_end_time: newEndTime
      };
      
      // If the activity is confirmed, also update actual times with proper timezone
      if (isConfirmed) {
        updateData.actual_start_time = createLocalISOString(newDate, newStartTime);
        updateData.actual_end_time = createLocalISOString(newDate, newEndTime);
      }
      
      const {
        error
      } = await supabase.from('activity_time_tracking').update(updateData).eq('id', trackingId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-tracking'] });
      queryClient.invalidateQueries({ queryKey: ['user-activities'] });
      toast.success('Attività spostata');
    },
    onError: error => {
      console.error('Error moving tracking:', error);
      toast.error('Errore durante lo spostamento');
    }
  });
  const updateTrackingDetailMutation = useMutation({
    mutationFn: async ({
      trackingId,
      updates
    }: {
      trackingId: string;
      updates: Partial<TimeTracking>;
    }) => {
      const {
        error
      } = await supabase.from('activity_time_tracking').update(updates).eq('id', trackingId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-tracking'] });
      queryClient.invalidateQueries({ queryKey: ['user-activities'] });
      toast.success('Attività aggiornata');
      setDetailDialogOpen(false);
    },
    onError: error => {
      console.error('Error updating tracking:', error);
      toast.error('Errore durante l\'aggiornamento');
    }
  });
  const deleteTrackingMutation = useMutation({
    mutationFn: async (trackingId: string) => {
      // Check if this activity is a parent of recurring children
      const { data: children } = await supabase
        .from('activity_time_tracking')
        .select('id')
        .eq('recurrence_parent_id', trackingId)
        .order('scheduled_date', { ascending: true });

      if (children && children.length > 0) {
        // This is a parent with children - reassign parent role to first child before deleting
        const newParentId = children[0].id;
        
        // Update the first child to become the new parent (remove its parent reference)
        const { error: promoteError } = await supabase
          .from('activity_time_tracking')
          .update({ recurrence_parent_id: null })
          .eq('id', newParentId);
        if (promoteError) throw promoteError;

        // Point remaining children to the new parent
        if (children.length > 1) {
          const otherChildIds = children.slice(1).map(c => c.id);
          const { error: rerouteError } = await supabase
            .from('activity_time_tracking')
            .update({ recurrence_parent_id: newParentId })
            .in('id', otherChildIds);
          if (rerouteError) throw rerouteError;
        }
      }

      // Now safe to delete - no cascade will happen
      const { error } = await supabase
        .from('activity_time_tracking')
        .delete()
        .eq('id', trackingId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-tracking'] });
      queryClient.invalidateQueries({ queryKey: ['user-activities'] });
      toast.success('Attività eliminata');
      setDetailDialogOpen(false);
    },
    onError: error => {
      console.error('Error deleting tracking:', error);
      toast.error('Errore durante l\'eliminazione');
    }
  });
  const duplicateTrackingMutation = useMutation({
    mutationFn: async (tracking: TimeTracking) => {
      const {
        error
      } = await supabase.from('activity_time_tracking').insert({
        budget_item_id: tracking.budget_item_id,
        user_id: currentUser?.id,
        scheduled_date: tracking.scheduled_date,
        scheduled_start_time: tracking.scheduled_start_time,
        scheduled_end_time: tracking.scheduled_end_time,
        notes: tracking.notes
      });
      if (error) throw error;
    },
    onSuccess: () => {
      logAction({
        actionType: 'create',
        actionDescription: 'Duplicata time entry',
        entityType: 'timesheet',
      });
      queryClient.invalidateQueries({ queryKey: ['time-tracking'] });
      queryClient.invalidateQueries({ queryKey: ['user-activities'] });
      toast.success('Attività duplicata');
    },
    onError: error => {
      console.error('Error duplicating tracking:', error);
      toast.error('Errore durante la duplicazione');
    }
  });
  const confirmTrackingMutation = useMutation({
    mutationFn: async (tracking: TimeTracking) => {
      if (!tracking.scheduled_date || !tracking.scheduled_start_time || !tracking.scheduled_end_time) {
        throw new Error('Missing scheduled times');
      }

      // Convert scheduled times to actual times with proper timezone
      const scheduledDate = tracking.scheduled_date;
      const startTime = tracking.scheduled_start_time.substring(0, 5); // Get HH:mm
      const endTime = tracking.scheduled_end_time.substring(0, 5); // Get HH:mm
      
      const {
        error
      } = await supabase.from('activity_time_tracking').update({
        actual_start_time: createLocalISOString(scheduledDate, startTime),
        actual_end_time: createLocalISOString(scheduledDate, endTime)
      }).eq('id', tracking.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-tracking'] });
      queryClient.invalidateQueries({ queryKey: ['user-activities'] });
      toast.success('Attività confermata - ore aggiunte al conteggio');
    },
    onError: error => {
      console.error('Error confirming tracking:', error);
      toast.error('Errore durante la conferma');
    }
  });
  const unconfirmTrackingMutation = useMutation({
    mutationFn: async (tracking: TimeTracking) => {
      const {
        error
      } = await supabase.from('activity_time_tracking').update({
        actual_start_time: null,
        actual_end_time: null
      }).eq('id', tracking.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-tracking'] });
      queryClient.invalidateQueries({ queryKey: ['user-activities'] });
      toast.success('Conferma annullata');
    },
    onError: error => {
      console.error('Error unconfirming tracking:', error);
      toast.error('Errore durante l\'annullamento');
    }
  });
  const deleteAllRecurringMutation = useMutation({
    mutationFn: async (tracking: TimeTracking) => {
      // Get the parent ID - if this is a child, use its parent_id, otherwise use its own id
      const parentId = tracking.recurrence_parent_id || tracking.id;

      // Delete the parent activity (children will be cascade deleted due to FK)
      const {
        error: parentError
      } = await supabase.from('activity_time_tracking').delete().eq('id', parentId);
      if (parentError) throw parentError;

      // Also delete any children that reference this as parent
      const {
        error: childError
      } = await supabase.from('activity_time_tracking').delete().eq('recurrence_parent_id', parentId);
      if (childError) throw childError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-tracking'] });
      queryClient.invalidateQueries({ queryKey: ['user-activities'] });
      toast.success('Tutte le ricorrenze eliminate');
    },
    onError: error => {
      console.error('Error deleting recurring activities:', error);
      toast.error('Errore durante l\'eliminazione');
    }
  });

  // Complete activity mutation
  const completeActivityMutation = useMutation({
    mutationFn: async (budgetItemId: string) => {
      if (!viewingUserId) throw new Error('User not authenticated');
      const { error } = await supabase
        .from('user_activity_completions')
        .upsert({
          user_id: viewingUserId,
          budget_item_id: budgetItemId,
          completed_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,budget_item_id'
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-completed-activities'] });
      queryClient.invalidateQueries({ queryKey: ['user-activities'] });
      toast.success('Attività completata');
    },
    onError: error => {
      console.error('Error completing activity:', error);
      toast.error('Errore durante il completamento');
    }
  });

  // Restore activity mutation
  const restoreActivityMutation = useMutation({
    mutationFn: async (budgetItemId: string) => {
      if (!viewingUserId) throw new Error('User not authenticated');
      const { error } = await supabase
        .from('user_activity_completions')
        .delete()
        .eq('user_id', viewingUserId)
        .eq('budget_item_id', budgetItemId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-completed-activities'] });
      queryClient.invalidateQueries({ queryKey: ['user-activities'] });
      toast.success('Attività ripristinata');
    },
    onError: error => {
      console.error('Error restoring activity:', error);
      toast.error('Errore durante il ripristino');
    }
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const {
      active,
      over,
      delta
    } = event;
    setActiveId(null);
    console.log('Drag end:', {
      active: active?.id,
      over: over?.id,
      overData: over?.data?.current,
      delta
    });
    if (!over) {
      console.log('No drop target detected');
      return;
    }
    const dropData = over.data.current as {
      date: Date;
      hour: number;
      slotRef?: React.RefObject<HTMLDivElement>;
    };
    if (!dropData || !dropData.date) {
      console.log('Invalid drop data:', dropData);
      return;
    }

    // For scheduled activities, use delta to calculate new position from original
    // For new activities from sidebar, use mouse position relative to slot
    let minuteOffset = 0;
    
    if (active.data.current?.type === 'scheduled') {
      // Moving existing scheduled activity - use the snapped delta
      const tracking = active.data.current.tracking as TimeTracking;
      if (tracking.scheduled_start_time) {
        const originalStartMinutes = parseInt(tracking.scheduled_start_time.split(':')[0]) * 60 + 
                                     parseInt(tracking.scheduled_start_time.split(':')[1]);
        // Delta.y is in pixels, snapped to 15px by modifier. 1px = 1 minute.
        const deltaMinutes = Math.round(delta.y);
        const newStartMinutes = originalStartMinutes + deltaMinutes;
        // Snap to 15 minutes
        const snappedStartMinutes = Math.round(newStartMinutes / 15) * 15;
        
        // Calculate which hour slot the activity will land in
        const newHour = Math.floor(snappedStartMinutes / 60);
        minuteOffset = snappedStartMinutes % 60;
        
        // Override dropData.hour with calculated hour from delta
        // This makes the drop position consistent with visual feedback
        const endMinutes = parseInt(tracking.scheduled_end_time!.split(':')[0]) * 60 + 
                          parseInt(tracking.scheduled_end_time!.split(':')[1]);
        const duration = endMinutes - originalStartMinutes;
        
        const newEndMinutes = snappedStartMinutes + duration;
        const newStartHours = Math.floor(snappedStartMinutes / 60);
        const newStartMins = snappedStartMinutes % 60;
        const newEndHours = Math.floor(newEndMinutes / 60);
        const newEndMins = newEndMinutes % 60;
        const newStartTime = `${newStartHours.toString().padStart(2, '0')}:${newStartMins.toString().padStart(2, '0')}`;
        const newEndTime = `${newEndHours.toString().padStart(2, '0')}:${newEndMins.toString().padStart(2, '0')}`;
        
        // Check if dropping on a closure day
        const closureDay = isClosureDay(dropData.date);
        if (closureDay) {
          toast.error(`Non puoi pianificare attività il ${format(dropData.date, 'd MMMM', { locale: it })}`, {
            description: `${closureDay.name} - Giorno di chiusura aziendale`
          });
          return;
        }
        
        console.log('Moving activity with delta:', {
          originalStartMinutes,
          deltaMinutes,
          snappedStartMinutes,
          date: format(dropData.date, 'yyyy-MM-dd'),
          newStartTime,
          newEndTime
        });
        
        moveTrackingMutation.mutate({
          trackingId: tracking.id,
          newDate: format(dropData.date, 'yyyy-MM-dd'),
          newStartTime,
          newEndTime,
          isConfirmed: !!(tracking.actual_start_time && tracking.actual_end_time)
        });
        return;
      }
    }
    
    // For new activities from sidebar, use mouse position relative to slot
    if (lastMousePositionRef.current && dropData.slotRef?.current) {
      const rect = dropData.slotRef.current.getBoundingClientRect();
      const relativeY = lastMousePositionRef.current.clientY - rect.top;
      // Snap to 15 minutes (1px = 1 minute since HOUR_HEIGHT = 60)
      minuteOffset = Math.max(0, Math.min(45, Math.floor(relativeY / 15) * 15));
    }

    // Check if dropping on a closure day
    const closureDay = isClosureDay(dropData.date);
    if (closureDay) {
      toast.error(`Non puoi pianificare attività il ${format(dropData.date, 'd MMMM', { locale: it })}`, {
        description: `${closureDay.name} - Giorno di chiusura aziendale`
      });
      return;
    }

    // Scheduling new activity from sidebar
    const activity = active.data.current?.activity as Activity;
    if (!activity) return;
    const durationHours = config.defaultSlotDuration / 60;
    // Use precise minute offset for better positioning
    const startMinutes = dropData.hour * 60 + minuteOffset;
    const startHour = Math.floor(startMinutes / 60);
    const startMins = startMinutes % 60;
    const startTime = `${startHour.toString().padStart(2, '0')}:${startMins.toString().padStart(2, '0')}`;
    const endMinutesTotal = startMinutes + config.defaultSlotDuration;
    const endHour = Math.floor(endMinutesTotal / 60);
    const endMins = endMinutesTotal % 60;
    const endTime = `${endHour.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`;
    
    // Check if scheduling would exceed budget (not for interno/consumptive)
    const isInternoOrConsumptive = activity.billing_type === 'interno' || activity.billing_type === 'consumptive';
    const totalScheduledHours = activity.confirmed_hours + activity.planned_hours + durationHours;
    if (!isInternoOrConsumptive && totalScheduledHours > activity.hours_worked) {
      const overage = formatHours(totalScheduledHours - activity.hours_worked);
      toast.warning(`Attenzione: questa pianificazione supererà il budget di ${overage}`, {
        description: `Budget: ${formatHours(activity.hours_worked)} | Totale dopo pianificazione: ${formatHours(totalScheduledHours)}`
      });
    }
    
    scheduleActivityMutation.mutate({
      budget_item_id: activity.id,
      scheduled_date: format(dropData.date, 'yyyy-MM-dd'),
      scheduled_start_time: startTime,
      scheduled_end_time: endTime
    });
  };

  // Get unique projects and categories for filters
  const uniqueProjects = useMemo(() => {
    const projects = activities.map(a => ({
      id: a.project_id,
      name: a.project_name
    }));
    const uniqueMap = new Map(projects.map(p => [p.id, p]));
    return Array.from(uniqueMap.values()).sort((a, b) => a.name.localeCompare(b.name, 'it'));
  }, [activities]);
  const uniqueCategories = useMemo(() => {
    return Array.from(new Set(activities.map(a => a.category)));
  }, [activities]);

  // Filter activities based on selected filters and exclude completed
  const filteredActivities = useMemo(() => {
    return activeActivities.filter(activity => {
      const matchesProject = selectedProject === 'all' || activity.project_id === selectedProject;
      const matchesCategory = selectedCategory === 'all' || activity.category === selectedCategory;
      const matchesSearch = !activitySearchQuery || 
        activity.activity_name.toLowerCase().includes(activitySearchQuery.toLowerCase()) ||
        activity.project_name.toLowerCase().includes(activitySearchQuery.toLowerCase());
      return matchesProject && matchesCategory && matchesSearch;
    });
  }, [activeActivities, selectedProject, selectedCategory, activitySearchQuery]);
  const handleOpenDetail = (tracking: TimeTracking, duplicateMode = false) => {
    setSelectedTracking(tracking);
    setIsDuplicateMode(duplicateMode);
    setDetailForm({
      scheduled_date: duplicateMode ? '' : (tracking.scheduled_date || ''),
      scheduled_start_time: tracking.scheduled_start_time || '',
      scheduled_end_time: tracking.scheduled_end_time || '',
      notes: tracking.notes || '',
      selectedProject: tracking.activity?.project_id || '',
      selectedActivity: tracking.budget_item_id || ''
    });
    setDetailProjectSearch('');
    setDetailDialogOpen(true);
  };
  // Validate that end time is after start time
  const isTimeRangeValid = useMemo(() => {
    if (!detailForm.scheduled_start_time || !detailForm.scheduled_end_time) return true;
    const [startH, startM] = detailForm.scheduled_start_time.split(':').map(Number);
    const [endH, endM] = detailForm.scheduled_end_time.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    return endMinutes > startMinutes;
  }, [detailForm.scheduled_start_time, detailForm.scheduled_end_time]);

  const handleSaveDetail = () => {
    if (!selectedTracking) return;
    if (!isTimeRangeValid) {
      toast.error('L\'ora di fine deve essere successiva all\'ora di inizio');
      return;
    }
    if (!detailForm.selectedActivity) {
      toast.error('Seleziona un\'attività');
      return;
    }
    if (!detailForm.scheduled_date) {
      toast.error('Seleziona una data');
      return;
    }

    if (isDuplicateMode) {
      // In duplicate mode, create a new entry instead of updating
      duplicateTrackingMutation.mutate({
        ...selectedTracking,
        scheduled_date: detailForm.scheduled_date,
        scheduled_start_time: detailForm.scheduled_start_time,
        scheduled_end_time: detailForm.scheduled_end_time,
        notes: detailForm.notes || null,
        budget_item_id: detailForm.selectedActivity,
      } as TimeTracking);
      setDetailDialogOpen(false);
      setIsDuplicateMode(false);
      return;
    }
    
    // Check if activity is confirmed (has actual times)
    const isConfirmed = selectedTracking.actual_start_time && selectedTracking.actual_end_time;
    
    const updates: Partial<TimeTracking> = {
      scheduled_date: detailForm.scheduled_date,
      scheduled_start_time: detailForm.scheduled_start_time,
      scheduled_end_time: detailForm.scheduled_end_time,
      notes: detailForm.notes || null,
      budget_item_id: detailForm.selectedActivity
    };
    
    // If confirmed, also update actual times to keep tracked time in sync
    if (isConfirmed && detailForm.scheduled_date) {
      updates.actual_start_time = createLocalISOString(detailForm.scheduled_date, detailForm.scheduled_start_time);
      updates.actual_end_time = createLocalISOString(detailForm.scheduled_date, detailForm.scheduled_end_time);
    }
    
    updateTrackingDetailMutation.mutate({
      trackingId: selectedTracking.id,
      updates
    });
  };
  const handleDeleteTracking = () => {
    if (!selectedTracking) return;
    if (confirm('Sei sicuro di voler eliminare questa attività?')) {
      deleteTrackingMutation.mutate(selectedTracking.id);
    }
  };

  // Handle hiding Google Calendar events
  const handleHideGoogleEvent = useCallback((eventId: string) => {
    setHiddenGoogleEvents(prev => {
      const updated = [...prev, eventId];
      localStorage.setItem('hiddenGoogleEvents', JSON.stringify(updated));
      return updated;
    });
    toast.success('Evento nascosto dal calendario');
  }, []);

  // Find active item for drag overlay
  const activeActivity = activeId ? activities.find(a => a.id === activeId) : null;
  const activeScheduledTracking = activeId?.startsWith('scheduled-') ? timeTracking.find(t => `scheduled-${t.id}` === activeId) : null;

  // Calculate daily totals (planned and confirmed separately)
  const dailyTotals = useMemo(() => {
    return weekDays.map(day => {
      const dayActivities = timeTracking.filter(t => t.scheduled_date && isSameDay(parseISO(t.scheduled_date), day));
      let plannedMinutes = 0;
      let confirmedMinutes = 0;
      dayActivities.forEach(t => {
        if (!t.scheduled_start_time || !t.scheduled_end_time) return;
        const startMinutes = parseInt(t.scheduled_start_time.split(':')[0]) * 60 + parseInt(t.scheduled_start_time.split(':')[1]);
        const endMinutes = parseInt(t.scheduled_end_time.split(':')[0]) * 60 + parseInt(t.scheduled_end_time.split(':')[1]);
        const duration = endMinutes - startMinutes;
        plannedMinutes += duration;

        // If activity is confirmed (has actual_start_time and actual_end_time)
        if (t.actual_start_time && t.actual_end_time) {
          confirmedMinutes += duration;
        }
      });
      return {
        planned: plannedMinutes / 60,
        confirmed: confirmedMinutes / 60
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
    const top = relativeHour * hourHeight + currentMinutes / 60 * hourHeight;
    const dayIndex = weekDays.findIndex(day => isSameDay(day, now));
    return {
      top,
      dayIndex
    };
  }, [currentTime, weekDays, visibleHours, hourHeight]);

  // Calculate weekly totals
  const weeklyTotals = useMemo(() => {
    return dailyTotals.reduce((acc, day) => ({
      planned: acc.planned + day.planned,
      confirmed: acc.confirmed + day.confirmed
    }), {
      planned: 0,
      confirmed: 0
    });
  }, [dailyTotals]);
  return <div className="h-screen flex flex-col">
      <div className="container mx-auto px-6 py-3">
        
        {/* Row 2: User selector, Compare, Hours Summary, Date navigation, Settings - all in one row */}
        <div className="flex items-center justify-between mb-2 gap-4 flex-wrap">
          <div className="flex items-center gap-4 flex-wrap">
            {/* User selector - Only for admin/team_leader/coordinator */}
            {canViewOtherUsers && allUsers.length > 0 && (
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <Select 
                  value={selectedUserId || currentUser?.id || ''} 
                  onValueChange={(value) => setSelectedUserId(value === currentUser?.id ? null : value)}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Seleziona utente" />
                  </SelectTrigger>
                  <SelectContent>
                    {allUsers.map(user => (
                      <SelectItem key={user.id} value={user.id}>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-5 w-5">
                            <AvatarImage src={user.avatar_url || undefined} />
                            <AvatarFallback className="text-[10px]">
                              {(user.first_name?.charAt(0) || '') + (user.last_name?.charAt(0) || '')}
                            </AvatarFallback>
                          </Avatar>
                          <span>
                            {user.first_name} {user.last_name}
                            {user.id === currentUser?.id && ' (tu)'}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isViewingOtherUser && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setSelectedUserId(null)}
                  >
                    Torna al mio
                  </Button>
                )}
              </div>
            )}
            
            {/* Compare calendars button */}
            {canViewOtherUsers && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowMultiUserView(true)}
                className="gap-2"
              >
                <LayoutGrid className="h-4 w-4" />
                Confronta
              </Button>
            )}
            
            {/* Weekly Summary */}
            <div className="flex items-center gap-3 bg-muted/50 rounded-lg px-3 py-1.5 border">
              <div className="text-center">
                <div className="text-[10px] text-muted-foreground">Pianificate</div>
                <div className="text-sm font-bold">{formatHours(weeklyTotals.planned)}</div>
              </div>
              <div className="w-px h-6 bg-border" />
              <div className="text-center">
                <div className="text-[10px] text-muted-foreground flex items-center gap-1 justify-center">
                  <CheckCircle className="h-2.5 w-2.5 text-green-600" />
                  Confermate
                </div>
                <div className="text-sm font-bold text-green-600">{formatHours(weeklyTotals.confirmed)}</div>
              </div>
              {weeklyTotals.planned > 0 && <>
                  <div className="w-px h-6 bg-border" />
                  <div className="flex flex-col items-center gap-0.5 min-w-[80px]">
                    <div className="text-[10px] text-muted-foreground">Completamento</div>
                    <Progress value={weeklyTotals.confirmed / weeklyTotals.planned * 100} className="h-1.5 w-full" />
                    <div className="text-xs font-bold">
                      {(weeklyTotals.confirmed / weeklyTotals.planned * 100).toFixed(0)}%
                    </div>
                  </div>
                </>}
              {weeklyContractHours > 0 && <>
                  <div className="w-px h-6 bg-border" />
                  <div className="flex flex-col items-center gap-0.5 min-w-[80px]">
                    <div className="text-[10px] text-muted-foreground">vs Contratto</div>
                    <Progress value={Math.min((weeklyTotals.confirmed / weeklyContractHours) * 100, 100)} className="h-1.5 w-full" />
                    <div className="text-xs font-bold">
                      {Math.round((weeklyTotals.confirmed / weeklyContractHours) * 100)}%
                    </div>
                  </div>
                </>}
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Date navigation */}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentWeekStart(subWeeks(currentWeekStart, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="text-sm font-medium min-w-[160px] text-center">
                {format(currentWeekStart, 'd MMM', {
                locale: it
              })} - {format(addDays(currentWeekStart, config.numberOfDays - 1), 'd MMM yyyy', {
                locale: it
              })}
              </div>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentWeekStart(addWeeks(currentWeekStart, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button size="sm" onClick={() => setCurrentWeekStart(startOfWeek(new Date(), {
              weekStartsOn: config.weekStartsOn as 0 | 1 | 2 | 3 | 4 | 5 | 6
            }))}>
                Oggi
              </Button>
            </div>
            
            {/* Zoom controls */}
            <div className="flex items-center gap-1 border rounded-lg px-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={async () => {
                        const currentIndex = ZOOM_LEVELS.indexOf(config.zoomLevel || DEFAULT_HOUR_HEIGHT);
                        if (currentIndex > 0) {
                          const newConfig = { ...config, zoomLevel: ZOOM_LEVELS[currentIndex - 1] };
                          await saveConfig(newConfig);
                        }
                      }}
                      disabled={ZOOM_LEVELS.indexOf(config.zoomLevel || DEFAULT_HOUR_HEIGHT) === 0}
                    >
                      <ZoomOut className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Riduci zoom</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <span className="text-xs text-muted-foreground w-12 text-center">
                {Math.round(((config.zoomLevel || DEFAULT_HOUR_HEIGHT) / 60) * 100)}%
              </span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={async () => {
                        const currentIndex = ZOOM_LEVELS.indexOf(config.zoomLevel || DEFAULT_HOUR_HEIGHT);
                        if (currentIndex < ZOOM_LEVELS.length - 1) {
                          const newConfig = { ...config, zoomLevel: ZOOM_LEVELS[currentIndex + 1] };
                          await saveConfig(newConfig);
                        }
                      }}
                      disabled={ZOOM_LEVELS.indexOf(config.zoomLevel || DEFAULT_HOUR_HEIGHT) === ZOOM_LEVELS.length - 1}
                    >
                      <ZoomIn className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Ingrandisci zoom</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            
            {/* Sidebar toggle */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setIsSidebarVisible(!isSidebarVisible)}
                  >
                    {isSidebarVisible ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {isSidebarVisible ? 'Nascondi attività assegnate' : 'Mostra attività assegnate'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            {/* Settings */}
            <CalendarSettings 
              config={config} 
              onConfigChange={handleConfigChange} 
              onGoogleConnectionChange={setIsGoogleConnected}
              onRestoreHiddenEvents={() => setHiddenGoogleEvents([])}
            />
          </div>
        </div>
        
        {/* Row 3: Category Legend */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <span className="text-xs text-muted-foreground">Categorie:</span>
          {activityCategories.map((cat) => (
            <div key={cat.id} className="flex items-center gap-1.5">
              <div className={`w-3 h-3 rounded ${getDynamicCategorySolidColor(cat.name)}`}></div>
              <span className="text-xs text-muted-foreground">{cat.name}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[snapTo15MinModifier]} onDragEnd={isReadOnly ? () => {} : handleDragEnd} onDragStart={e => {
          setActiveId(e.active.id as string);
          // Calculate and store the initial offset for scheduled activities
          if (e.active.data.current?.type === 'scheduled' && lastMousePositionRef.current) {
            const tracking = e.active.data.current.tracking as TimeTracking;
            if (tracking.scheduled_start_time) {
              // Find the element being dragged to get its position
              const draggedElement = document.querySelector(`[data-tracking-id="${tracking.id}"]`);
              if (draggedElement) {
                const rect = draggedElement.getBoundingClientRect();
                // Store the offset from the top of the activity to where the mouse grabbed it, snapped to 15px
                const rawOffset = lastMousePositionRef.current.clientY - rect.top;
                dragStartOffsetRef.current = Math.round(rawOffset / 15) * 15;
              }
            }
          } else {
            dragStartOffsetRef.current = 0;
          }
        }}>
          <div className="flex h-full">
            {/* Sidebar con attività */}
            {isSidebarVisible && (
              <Card className={`w-72 m-4 mt-0 flex-shrink-0 overflow-hidden flex flex-col ${isReadOnly ? 'opacity-60' : ''}`}>
                <CardHeader className="px-3 py-2">
                  <CardTitle className="text-sm">
                    Attività assegnate
                    {isReadOnly && <Badge variant="secondary" className="ml-2 text-[10px]">Sola lettura</Badge>}
                    {isViewingOtherUser && !isReadOnly && <Badge variant="default" className="ml-2 text-[10px]">Gestione</Badge>}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto flex flex-col gap-2 px-3 pb-3 pt-0">
                  {/* Ricerca e Filtri */}
                  <div className="space-y-2 pb-2 border-b">
                    <div className="relative">
                      <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        placeholder="Cerca attività..."
                        value={activitySearchQuery}
                        onChange={(e) => setActivitySearchQuery(e.target.value)}
                        className="pl-7 h-8 text-xs"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Progetto</Label>
                      <Popover open={projectFilterOpen} onOpenChange={setProjectFilterOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={projectFilterOpen}
                            className="w-full mt-1 justify-between font-normal"
                          >
                            <span className="truncate">
                              {selectedProject === 'all'
                                ? 'Tutti i progetti'
                                : uniqueProjects.find(p => p.id === selectedProject)?.name || 'Seleziona progetto'}
                            </span>
                            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[280px] p-0" align="start">
                          <Command shouldFilter={false}>
                            <CommandInput
                              placeholder="Cerca progetto..."
                              value={projectFilterSearch}
                              onValueChange={setProjectFilterSearch}
                            />
                            <CommandList>
                              <CommandEmpty>Nessun progetto trovato</CommandEmpty>
                              <CommandGroup>
                                <CommandItem
                                  value="all"
                                  onSelect={() => {
                                    setSelectedProject('all');
                                    setProjectFilterOpen(false);
                                    setProjectFilterSearch('');
                                  }}
                                >
                                  <CheckCircle className={`mr-2 h-4 w-4 ${selectedProject === 'all' ? 'opacity-100' : 'opacity-0'}`} />
                                  Tutti i progetti
                                </CommandItem>
                                {uniqueProjects
                                  .filter(p => !projectFilterSearch || p.name.toLowerCase().includes(projectFilterSearch.toLowerCase()))
                                  .map(project => (
                                    <CommandItem
                                      key={project.id}
                                      value={project.id}
                                      onSelect={() => {
                                        setSelectedProject(project.id);
                                        setProjectFilterOpen(false);
                                        setProjectFilterSearch('');
                                      }}
                                    >
                                      <CheckCircle className={`mr-2 h-4 w-4 ${selectedProject === project.id ? 'opacity-100' : 'opacity-0'}`} />
                                      <span className="truncate">{project.name}</span>
                                    </CommandItem>
                                  ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                    {selectedProject !== 'all' && <Button variant="outline" size="sm" className="w-full" onClick={() => {
                      setSelectedProject('all');
                    }}>
                      Rimuovi filtro
                    </Button>}
                  </div>

                  {/* Lista attività */}
                  {filteredActivities.length === 0 ? <p className="text-center text-muted-foreground py-8 text-sm">
                      {activeActivities.length === 0 ? 'Nessuna attività assegnata' : 'Nessuna attività corrisponde ai filtri'}
                    </p> : <div>
                      {filteredActivities.map(activity => <DraggableActivity key={activity.id} activity={activity} onComplete={(id) => completeActivityMutation.mutate(id)} />)}
                    </div>}

                  {/* Sezione attività completate */}
                  {completedActivitiesWithInfo.length > 0 && (
                    <Collapsible className="border-t pt-3">
                      <CollapsibleTrigger className="flex items-center justify-between w-full text-sm font-medium text-muted-foreground hover:text-foreground transition-colors py-2">
                        <span className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          Attività completate ({completedActivitiesWithInfo.length})
                        </span>
                        <ChevronDown className="h-4 w-4 transition-transform duration-200 [&[data-state=open]>svg]:rotate-180" />
                      </CollapsibleTrigger>
                      <CollapsibleContent className="space-y-2 pt-2">
                        {completedActivitiesWithInfo.map(activity => (
                          <div
                            key={activity.id}
                            className="p-3 border rounded-lg bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
                          >
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-medium text-sm truncate text-green-800 dark:text-green-200">
                                  {activity.activity_name}
                                </span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 flex-shrink-0"
                                  onClick={() => restoreActivityMutation.mutate(activity.id)}
                                  title="Ripristina attività"
                                >
                                  <RotateCcw className="h-4 w-4 text-muted-foreground hover:text-orange-600" />
                                </Button>
                              </div>
                              <Badge variant="secondary" className="w-fit text-xs">
                                {activity.category}
                              </Badge>
                              <span className="text-xs text-muted-foreground">{activity.project_name}</span>
                              {activity.completed_at && (
                                <span className="text-xs text-green-600 dark:text-green-400">
                                  Completata il {format(parseISO(activity.completed_at), 'd MMM yyyy, HH:mm', { locale: it })}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </CollapsibleContent>
                    </Collapsible>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Calendario settimanale */}
            <div className="flex-1 overflow-auto mr-6">
              <div className="inline-block min-w-full">
                {/* Header giorni */}
                <div className="flex sticky top-0 bg-background/80 backdrop-blur-sm z-30 border-b shadow-md">
                  <div className="w-16 flex-shrink-0 border-r" />
                  {weekDays.map((day, dayIndex) => {
                    const closureDay = closureDaysMap.get(format(day, 'yyyy-MM-dd'));
                    return (
                      <div 
                        key={day.toISOString()} 
                        className={`flex-1 min-w-[120px] p-2 text-center border-r ${
                          closureDay 
                            ? 'bg-red-50 dark:bg-red-950/30' 
                            : isSameDay(day, new Date()) 
                              ? 'bg-primary/5' 
                              : ''
                        }`}
                      >
                        <div className="text-xs text-muted-foreground">
                          {format(day, 'EEE', { locale: it })}
                        </div>
                        <div className={`text-lg font-semibold ${
                          closureDay 
                            ? 'text-red-600 dark:text-red-400' 
                            : isSameDay(day, new Date()) 
                              ? 'text-primary' 
                              : ''
                        }`}>
                          {format(day, 'd')}
                        </div>
                        {/* Closure day badge */}
                        {closureDay && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="mt-1 inline-flex items-center gap-1 bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 rounded-full px-2 py-0.5 text-[10px] font-medium">
                                  <CalendarOff className="h-2.5 w-2.5" />
                                  <span className="truncate max-w-[80px]">{closureDay.name}</span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{closureDay.name}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        {/* Daily totals under date */}
                        {!closureDay && (
                          <div className="mt-1 text-xs">
                            <span className="text-muted-foreground font-medium">
                              {formatHours(dailyTotals[dayIndex]?.planned ?? 0)}
                            </span>
                            {dailyTotals[dayIndex]?.confirmed > 0 && (
                              <span className="text-green-600 font-medium ml-1 inline-flex items-center gap-0.5">
                                <CheckCircle className="h-2.5 w-2.5" />
                                {formatHours(dailyTotals[dayIndex]?.confirmed ?? 0)}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Griglia oraria */}
                <div className="relative" data-calendar-grid>
                  {visibleHours.map((hour, index) => <div key={hour} className="flex" style={{ height: `${hourHeight}px` }}>
                      <div className="w-16 flex-shrink-0 border-r text-xs text-muted-foreground text-right pr-2 pt-1">
                        {hour.toString().padStart(2, '0')}:00
                      </div>
                      {weekDays.map((day, dayIndex) => {
                    const dayTracking = timeTracking.filter(t => t.scheduled_date && isSameDay(parseISO(t.scheduled_date), day));
                    const closureDayInfo = closureDaysMap.get(format(day, 'yyyy-MM-dd'));
                    const isClosureDaySlot = !!closureDayInfo;

                    // Calculate drag-create preview for this day
                    const isDragCreatingThisDay = dragCreateState.isCreating && dragCreateState.startDate && isSameDay(dragCreateState.startDate, day);
                    return <div key={`${day.toISOString()}-${hour}`} className={`flex-1 min-w-[120px] relative ${isClosureDaySlot ? 'bg-red-100/60 dark:bg-red-950/40' : ''}`}>
                            {/* Closure day overlay with diagonal stripes */}
                            {isClosureDaySlot && (
                              <div 
                                className="absolute inset-0 pointer-events-none z-[5] opacity-30"
                                style={{
                                  backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 8px, rgba(239, 68, 68, 0.3) 8px, rgba(239, 68, 68, 0.3) 16px)',
                                }}
                              />
                            )}
                            <TimeSlot date={day} hour={hour} hourHeight={hourHeight} onDragCreateStart={handleDragCreateStart} onDragCreateMove={() => {}} onDragCreateEnd={handleDragCreateEnd} isDragCreating={dragCreateState.isCreating} />
                            {index === 0 && (() => {
                              const overlapPositions = calculateOverlapPositions(dayTracking);
                              return dayTracking.map(tracking => (
                                <ScheduledActivity 
                                  key={tracking.id} 
                                  tracking={tracking} 
                                  workDayStartHour={visibleHours[0]} 
                                  hourHeight={hourHeight}
                                  overlapPosition={overlapPositions.get(tracking.id)}
                                  onSaveResize={(id, start, end, isConfirmed, scheduledDate) => updateTrackingTimeMutation.mutate({
                                    trackingId: id,
                                    startTime: start,
                                    endTime: end,
                                    isConfirmed,
                                    scheduledDate
                                  })} 
                                  onOpenDetail={handleOpenDetail} 
                                  onDuplicate={t => handleOpenDetail(t, true)} 
                                  onConfirm={t => confirmTrackingMutation.mutate(t)} 
                                  onUnconfirm={t => unconfirmTrackingMutation.mutate(t)} 
                                  onDelete={t => deleteTrackingMutation.mutate(t.id)} 
                                  onDeleteAllRecurring={t => deleteAllRecurringMutation.mutate(t)} 
                                  onCompleteActivity={(budgetItemId) => completeActivityMutation.mutate(budgetItemId)} 
                                />
                              ));
                            })()}
                            {/* Drag-create preview */}
                            {index === 0 && isDragCreatingThisDay && (() => {
                        const workDayStartMinutes = visibleHours[0] * 60;
                        const startMins = Math.min(dragCreateState.startMinutes, dragCreateState.currentMinutes);
                        const endMins = Math.max(dragCreateState.startMinutes, dragCreateState.currentMinutes);
                        const top = (startMins - workDayStartMinutes) / 60 * hourHeight;
                        const height = (endMins - startMins) / 60 * hourHeight;
                        const startH = Math.floor(startMins / 60);
                        const startM = startMins % 60;
                        const endH = Math.floor(endMins / 60);
                        const endM = endMins % 60;
                        return <div className="absolute left-1 right-1 bg-primary/30 border-2 border-primary border-dashed rounded-md pointer-events-none z-30 flex flex-col items-center justify-center" style={{
                          top: `${top}px`,
                          height: `${Math.max(height, 15)}px`
                        }}>
                                  <span className="text-xs font-medium text-primary-foreground bg-primary px-2 py-0.5 rounded">
                                    {`${startH.toString().padStart(2, '0')}:${startM.toString().padStart(2, '0')} - ${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`}
                                  </span>
                                </div>;
                      })()}
                            {/* Google Calendar events - only show when viewing own calendar */}
                            {index === 0 && !isViewingOtherUser && googleEvents
                              .filter(event => {
                                const eventDate = parseISO(event.start);
                                // Hide if manually hidden OR if already linked to an activity
                                const isLinkedToActivity = timeTracking.some(t => t.google_event_id === event.id);
                                return isSameDay(eventDate, day) && !hiddenGoogleEvents.includes(event.id) && !isLinkedToActivity;
                              })
                              .map(event => (
                                <GoogleCalendarEvent 
                                  key={event.id} 
                                  event={event} 
                                  workDayStartHour={visibleHours[0]}
                                  hourHeight={hourHeight}
                                  projects={accessibleProjects} 
                                  activities={accessibleActivities}
                                  onConvertToActivity={(e, budgetItemId, customDate, customStartTime, customEndTime) => convertGoogleEventMutation.mutate({
                                    event: e,
                                    budgetItemId,
                                    customDate,
                                    customStartTime,
                                    customEndTime
                                  })}
                                  onHideEvent={handleHideGoogleEvent}
                                />
                              ))}
                            {/* Current time indicator */}
                            {index === 0 && currentTimeIndicator && currentTimeIndicator.dayIndex === dayIndex && <div className="absolute left-0 right-0 z-20 flex items-center pointer-events-none" style={{
                        top: `${currentTimeIndicator.top}px`
                      }}>
                                <div className="w-2 h-2 rounded-full bg-red-500 -ml-1" />
                                <div className="flex-1 h-0.5 bg-red-500" />
                              </div>}
                          </div>;
                  })}
                    </div>)}

                </div>
              </div>
            </div>
          </div>

          {/* Activity Detail Dialog */}
          <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{isDuplicateMode ? 'Duplica Attività' : 'Dettagli Attività'}</DialogTitle>
              </DialogHeader>
              {selectedTracking && <div className="space-y-4 py-4">
                  {/* Show Google event title if linked */}
                  {selectedTracking.google_event_title && (
                    <div>
                      <Label className="text-sm font-semibold flex items-center gap-2">
                        Evento Google
                        <Badge variant="outline" className="bg-orange-100 dark:bg-orange-900/50 border-orange-300 text-orange-700 dark:text-orange-300 text-xs">
                          Google
                        </Badge>
                      </Label>
                      <p className="text-sm mt-1">{selectedTracking.google_event_title}</p>
                    </div>
                  )}
                  {/* Project selector with search */}
                  <div>
                    <Label>Progetto</Label>
                    <Select 
                      value={detailForm.selectedProject} 
                      onValueChange={(v) => {
                        setDetailForm(prev => ({
                          ...prev,
                          selectedProject: v,
                          selectedActivity: ''
                        }));
                        setDetailProjectSearch('');
                      }}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Seleziona un progetto" />
                      </SelectTrigger>
                      <SelectContent>
                        <div className="px-2 pb-2">
                          <div className="relative">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              placeholder="Cerca progetto..."
                              value={detailProjectSearch}
                              onChange={(e) => setDetailProjectSearch(e.target.value)}
                              className="pl-8 h-8"
                              onClick={(e) => e.stopPropagation()}
                              onKeyDown={(e) => e.stopPropagation()}
                            />
                          </div>
                        </div>
                        {accessibleProjects
                          .filter(p => !detailProjectSearch || p.name.toLowerCase().includes(detailProjectSearch.toLowerCase()))
                          .map(project => (
                            <SelectItem key={project.id} value={project.id}>
                              {project.name}
                            </SelectItem>
                          ))
                        }
                        {accessibleProjects.filter(p => !detailProjectSearch || p.name.toLowerCase().includes(detailProjectSearch.toLowerCase())).length === 0 && (
                          <div className="py-2 px-2 text-sm text-muted-foreground text-center">
                            Nessun progetto trovato
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Activity selector */}
                  {detailForm.selectedProject && (
                    <div>
                      <Label>Attività</Label>
                      <Select 
                        value={detailForm.selectedActivity} 
                        onValueChange={(v) => setDetailForm(prev => ({ ...prev, selectedActivity: v }))}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Seleziona un'attività" />
                        </SelectTrigger>
                        <SelectContent>
                          {accessibleActivities
                            .filter(a => a.project_id === detailForm.selectedProject)
                            .map(activity => (
                              <SelectItem key={activity.id} value={activity.id}>
                                <div className="flex items-center gap-2">
                                  <span>{activity.activity_name}</span>
                                  <Badge variant="secondary" className="text-xs">
                                    {activity.category}
                                  </Badge>
                                </div>
                              </SelectItem>
                            ))
                          }
                          {accessibleActivities.filter(a => a.project_id === detailForm.selectedProject).length === 0 && (
                            <div className="p-2 text-sm text-muted-foreground text-center">
                              Nessuna attività in questo progetto
                            </div>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div>
                    <Label htmlFor="detail-date">Data</Label>
                    <Input id="detail-date" type="date" value={detailForm.scheduled_date} onChange={e => setDetailForm({
                  ...detailForm,
                  scheduled_date: e.target.value
                })} className="mt-1" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="detail-start">Ora inizio</Label>
                      <TimeSlotSelect
                        id="detail-start"
                        value={detailForm.scheduled_start_time}
                        onChange={(value) => setDetailForm({
                          ...detailForm,
                          scheduled_start_time: value
                        })}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="detail-end">Ora fine</Label>
                      <TimeSlotSelect
                        id="detail-end"
                        value={detailForm.scheduled_end_time}
                        onChange={(value) => setDetailForm({
                          ...detailForm,
                          scheduled_end_time: value
                        })}
                        className="mt-1"
                      />
                    </div>
                  </div>
                  {!isTimeRangeValid && detailForm.scheduled_start_time && detailForm.scheduled_end_time && (
                    <p className="text-sm text-destructive">
                      L'ora di fine deve essere successiva all'ora di inizio
                    </p>
                  )}
                  <div>
                    <Label htmlFor="detail-notes">Descrizione</Label>
                    <Textarea id="detail-notes" value={detailForm.notes} onChange={e => setDetailForm({
                  ...detailForm,
                  notes: e.target.value
                })} placeholder="Inserisci una descrizione (opzionale)..." className="mt-1" rows={3} />
                  </div>
                  {selectedTracking.actual_start_time && <div>
                      <Label className="text-sm font-semibold">Tempo tracciato</Label>
                      <p className="text-sm mt-1">
                        Inizio: {selectedTracking.actual_start_time ? format(new Date(selectedTracking.actual_start_time), 'HH:mm', {
                    locale: it
                  }) : '-'}
                      </p>
                      {selectedTracking.actual_end_time && <p className="text-sm">
                          Fine: {format(new Date(selectedTracking.actual_end_time), 'HH:mm', {
                    locale: it
                  })}
                        </p>}
                    </div>}
                  <div className="flex justify-between pt-4 border-t">
                    {!isDuplicateMode && (
                      <Button variant="destructive" size="sm" onClick={handleDeleteTracking}>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Elimina
                      </Button>
                    )}
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => { setDetailDialogOpen(false); setIsDuplicateMode(false); }}>
                        Annulla
                      </Button>
                      <Button onClick={handleSaveDetail} disabled={!isTimeRangeValid || !detailForm.selectedActivity || !detailForm.scheduled_date}>
                        {isDuplicateMode ? 'Duplica' : 'Salva'}
                      </Button>
                    </div>
                  </div>
                </div>}
            </DialogContent>
          </Dialog>

          <DragOverlay>
            {activeActivity && <div className="p-3 border rounded-sm bg-background shadow-lg opacity-90">
                <div className="flex flex-col gap-1">
                  <span className="font-medium text-sm">{activeActivity.activity_name}</span>
                  <Badge variant="secondary" className="w-fit text-xs">
                    {activeActivity.category}
                  </Badge>
                </div>
              </div>}
            {activeScheduledTracking?.activity && <div className="p-3 border-l-4 border-primary rounded-sm bg-primary/10 shadow-lg opacity-90 min-w-[150px]">
                <div className="flex flex-col gap-1">
                  <span className="font-medium text-sm">{activeScheduledTracking.activity.activity_name}</span>
                  <span className="text-xs text-muted-foreground">{activeScheduledTracking.activity.project_name}</span>
                  <span className="text-xs">
                    {activeScheduledTracking.scheduled_start_time?.substring(0, 5)} - {activeScheduledTracking.scheduled_end_time?.substring(0, 5)}
                  </span>
                </div>
              </div>}
          </DragOverlay>
        </DndContext>

        {/* Create Manual Activity Dialog */}
        <CreateManualActivityDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} initialDate={createDialogData.date} initialStartTime={createDialogData.startTime} initialEndTime={createDialogData.endTime} onSubmit={data => {
        scheduleActivityMutation.mutate({
          budget_item_id: data.budget_item_id,
          scheduled_date: data.scheduled_date,
          scheduled_start_time: data.scheduled_start_time,
          scheduled_end_time: data.scheduled_end_time,
          notes: data.notes,
          recurrence: data.recurrence
        });
      }} />
      </div>
      
      {/* Multi-user calendar view */}
      {showMultiUserView && (
        <MultiUserCalendarView
          onClose={() => setShowMultiUserView(false)}
          weekStartsOn={config.weekStartsOn as 0 | 1 | 2 | 3 | 4 | 5 | 6}
        />
      )}
    </div>;
}