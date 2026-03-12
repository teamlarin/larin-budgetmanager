import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Badge } from '@/components/ui/badge';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger, ContextMenuSeparator } from '@/components/ui/context-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Clock, Trash2, Copy, Edit, CheckCircle, Repeat } from 'lucide-react';
import { getCategoryBadgeColor, getCategoryBorderColor } from '@/lib/categoryColors';
import { isBefore } from 'date-fns';
import { TimeTracking } from './calendarTypes';

// ─── TimeSlot ────────────────────────────────────────────────────────────────

interface TimeSlotProps {
  date: Date;
  hour: number;
  hourHeight: number;
  onDragCreateStart: (date: Date, hour: number, minutes: number) => void;
  onDragCreateMove: (minutes: number) => void;
  onDragCreateEnd: () => void;
  isDragCreating: boolean;
}

import { format } from 'date-fns';

export function TimeSlot({
  date,
  hour,
  hourHeight,
  onDragCreateStart,
  onDragCreateMove,
  onDragCreateEnd,
  isDragCreating
}: TimeSlotProps) {
  const slotRef = useRef<HTMLDivElement>(null);

  const getMinuteOffsetFromEvent = useCallback((clientY: number) => {
    const rect = slotRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    const relativeY = clientY - rect.top;
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
    if (active) return;
    e.preventDefault();
    const rect = slotRef.current?.getBoundingClientRect();
    if (!rect) return;
    const relativeY = e.clientY - rect.top;
    const minuteOffset = Math.floor(relativeY / hourHeight * 60 / 15) * 15;
    const minutes = hour * 60 + minuteOffset;
    onDragCreateStart(date, hour, minutes);
  };

  return (
    <div
      ref={node => {
        setNodeRef(node);
        (slotRef as any).current = node;
      }}
      onMouseDown={handleMouseDown}
      style={{ height: `${hourHeight}px` }}
      className={`border-t border-l transition-colors relative ${isOver ? 'bg-primary/20 ring-2 ring-primary ring-inset' : 'hover:bg-muted/30'} ${active ? 'z-0' : ''} ${isDragCreating ? 'cursor-ns-resize' : 'cursor-pointer'}`}
    />
  );
}

// ─── calculateOverlapPositions ───────────────────────────────────────────────

export function calculateOverlapPositions(trackings: TimeTracking[]): Map<string, { column: number; totalColumns: number }> {
  const positions = new Map<string, { column: number; totalColumns: number }>();

  const validTrackings = trackings
    .filter(t => t.scheduled_start_time && t.scheduled_end_time)
    .sort((a, b) => a.scheduled_start_time!.localeCompare(b.scheduled_start_time!));

  if (validTrackings.length === 0) return positions;

  const toMinutes = (time: string) => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  };

  const groups: TimeTracking[][] = [];
  let currentGroup: TimeTracking[] = [];
  let groupEndTime = 0;

  for (const tracking of validTrackings) {
    const startMins = toMinutes(tracking.scheduled_start_time!);
    const endMins = toMinutes(tracking.scheduled_end_time!);

    if (currentGroup.length === 0 || startMins < groupEndTime) {
      currentGroup.push(tracking);
      groupEndTime = Math.max(groupEndTime, endMins);
    } else {
      if (currentGroup.length > 0) groups.push(currentGroup);
      currentGroup = [tracking];
      groupEndTime = endMins;
    }
  }
  if (currentGroup.length > 0) groups.push(currentGroup);

  for (const group of groups) {
    const columns: { endTime: number }[] = [];

    for (const tracking of group) {
      const startMins = toMinutes(tracking.scheduled_start_time!);
      const endMins = toMinutes(tracking.scheduled_end_time!);

      let assignedColumn = -1;
      for (let i = 0; i < columns.length; i++) {
        if (columns[i].endTime <= startMins) {
          assignedColumn = i;
          columns[i].endTime = endMins;
          break;
        }
      }

      if (assignedColumn === -1) {
        assignedColumn = columns.length;
        columns.push({ endTime: endMins });
      }

      positions.set(tracking.id, { column: assignedColumn, totalColumns: 0 });
    }

    const totalColumns = columns.length;
    for (const tracking of group) {
      const pos = positions.get(tracking.id)!;
      pos.totalColumns = totalColumns;
    }
  }

  return positions;
}

// ─── ScheduledActivity ───────────────────────────────────────────────────────

interface ScheduledActivityProps {
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
}

export function ScheduledActivity({
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
}: ScheduledActivityProps) {
  const [isResizing, setIsResizing] = useState<'top' | 'bottom' | null>(null);
  const [localTimes, setLocalTimes] = useState<{ start: string; end: string } | null>(null);
  const [resizeStartData, setResizeStartData] = useState<{
    y: number;
    originalStartMinutes: number;
    originalEndMinutes: number;
  } | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  if (!tracking.scheduled_start_time || !tracking.scheduled_end_time || !tracking.activity) return null;

  const displayStartTime = localTimes?.start || tracking.scheduled_start_time;
  const displayEndTime = localTimes?.end || tracking.scheduled_end_time;
  const startMinutes = parseInt(displayStartTime.split(':')[0]) * 60 + parseInt(displayStartTime.split(':')[1]);
  const endMinutes = parseInt(displayEndTime.split(':')[0]) * 60 + parseInt(displayEndTime.split(':')[1]);

  const workDayStartMinutes = workDayStartHour * 60;
  const relativeStartMinutes = startMinutes - workDayStartMinutes;
  const top = relativeStartMinutes / 60 * hourHeight;
  const durationMins = endMinutes >= startMinutes ? endMinutes - startMinutes : (endMinutes + 24 * 60) - startMinutes;
  const height = Math.max(durationMins / 60 * hourHeight, 20);
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
    data: { tracking, type: 'scheduled' },
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
    setResizeStartData({ y: e.clientY, originalStartMinutes: origStart, originalEndMinutes: origEnd });
    setLocalTimes({ start: tracking.scheduled_start_time!, end: tracking.scheduled_end_time! });
  };

  useEffect(() => {
    if (!isResizing || !resizeStartData) return;
    const handleResizeMove = (e: MouseEvent) => {
      const deltaY = e.clientY - resizeStartData.y;
      const deltaMinutes = Math.round(deltaY / hourHeight * 60 / 15) * 15;

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
        onSaveResize(tracking.id, localTimes.start, localTimes.end, !!isCompleted, tracking.scheduled_date || undefined);
      }
      setIsResizing(null);
      setResizeStartData(null);
    };
    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
    return () => {
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeEnd);
    };
  }, [isResizing, resizeStartData, localTimes, tracking.id, tracking.scheduled_start_time, tracking.scheduled_end_time, onSaveResize]);

  useEffect(() => {
    setLocalTimes(null);
  }, [tracking.scheduled_start_time, tracking.scheduled_end_time]);

  const handleClick = (e: React.MouseEvent) => {
    if (isDragging || isResizing) return;
    e.stopPropagation();
    const updatedTracking = localTimes ? {
      ...tracking,
      scheduled_start_time: localTimes.start,
      scheduled_end_time: localTimes.end
    } : tracking;
    onOpenDetail(updatedTracking);
  };

  const canConfirm = useMemo(() => {
    if (!tracking.scheduled_date || !tracking.scheduled_end_time) return false;
    if (isCompleted) return false;
    const endTime = tracking.scheduled_end_time.substring(0, 5);
    const endDateTime = new Date(`${tracking.scheduled_date}T${endTime}:00`);
    return isBefore(endDateTime, now);
  }, [tracking.scheduled_date, tracking.scheduled_end_time, isCompleted, now]);

  const categoryBorderColor = getCategoryBorderColor(tracking.activity.category);
  const isShortActivity = durationMins < 45;
  const isVeryShortActivity = durationMins <= 15;
  const actualHeight = Math.max(height, 20);
  const resizeHandleHeight = isVeryShortActivity ? 'h-3' : 'h-2';
  const hasOverlap = overlapPosition && overlapPosition.totalColumns > 1;
  const columnWidth = hasOverlap ? `calc((100% - 8px) / ${overlapPosition.totalColumns})` : 'calc(100% - 8px)';
  const leftOffset = hasOverlap ? `calc(4px + ${overlapPosition.column} * (100% - 8px) / ${overlapPosition.totalColumns})` : '4px';

  const activityContent = (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      data-tracking-id={tracking.id}
      style={{
        ...style,
        top: `${top}px`,
        height: `${actualHeight}px`,
        left: leftOffset,
        width: columnWidth,
        pointerEvents: isDragging ? 'none' : 'auto',
        transition: isDragging ? 'none' : 'top 0.15s ease-out, height 0.15s ease-out, left 0.15s ease-out, width 0.15s ease-out'
      }}
      className={`absolute rounded-[2px] shadow-sm border-l-4 overflow-hidden select-none ${isDragging ? 'cursor-grabbing z-50 opacity-80 scale-[1.02]' : 'cursor-grab z-10'} ${categoryBorderColor} ${isCompleted ? 'bg-green-100 dark:bg-green-900/30' : isTrackingNow ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-card'} ${isVeryShortActivity ? 'group hover:z-30 hover:shadow-lg' : ''} ${hasOverlap ? 'hover:z-40 hover:shadow-md' : ''}`}
      onClick={handleClick}
    >
      <div className={`absolute top-0 left-0 right-0 ${resizeHandleHeight} cursor-ns-resize hover:bg-primary/30 z-20 ${isVeryShortActivity ? 'bg-primary/10' : ''}`} onMouseDown={e => handleResizeStart(e, 'top')} onPointerDown={e => e.stopPropagation()} />

      {tracking.google_event_id && !isCompleted && (
        <div className={`absolute top-1 ${tracking.is_recurring ? 'right-12' : 'right-6'} z-10`}>
          <Badge variant="outline" className="bg-yellow-100 dark:bg-yellow-900/50 border-yellow-400 text-yellow-700 dark:text-yellow-300 text-[10px] px-1.5 py-0 h-4">
            Google
          </Badge>
        </div>
      )}

      {tracking.is_recurring && (
        <div className={`absolute top-1 ${isCompleted ? 'right-20' : 'right-6'} z-10`}>
          <Badge variant="outline" className="bg-background/80 text-[10px] px-1.5 py-0 h-4 flex items-center gap-0.5">
            <Repeat className="h-2.5 w-2.5" />
          </Badge>
        </div>
      )}

      {isCompleted && (
        <div className="absolute top-1 right-1 z-10">
          <div className="bg-green-500 text-white rounded-full p-0.5">
            <Clock className="h-3 w-3" />
          </div>
        </div>
      )}

      <div className="flex flex-col h-full justify-between p-1.5 pt-2 pb-3">
        <div className="min-w-0">
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

      {canConfirm && !isCompleted && (
        <div
          className="absolute bottom-1.5 right-1.5 z-20 cursor-pointer rounded-full bg-green-500/20 hover:bg-green-500/40 p-0.5 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            onConfirm(tracking);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          title="Conferma tempo"
        >
          <CheckCircle className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
        </div>
      )}

      <div className={`absolute bottom-0 left-0 right-0 ${resizeHandleHeight} cursor-ns-resize hover:bg-primary/30 z-20 ${isVeryShortActivity ? 'bg-primary/10' : ''}`} onMouseDown={e => handleResizeStart(e, 'bottom')} onPointerDown={e => e.stopPropagation()} />
    </div>
  );

  const tooltipContent = (
    <div className="space-y-1 max-w-xs">
      {tracking.google_event_title && <div className="font-medium">{tracking.google_event_title}</div>}
      <div className="font-medium">{tracking.activity.activity_name}</div>
      <div className="text-muted-foreground">{tracking.activity.project_name}</div>
      <div className="flex items-center gap-1">
        <Clock className="h-3 w-3" />
        <span>{displayStartTime.substring(0, 5)} - {displayEndTime.substring(0, 5)}</span>
      </div>
      {tracking.notes && <div className="text-muted-foreground text-xs pt-1 border-t">{tracking.notes}</div>}
      <Badge className={`${getCategoryBadgeColor(tracking.activity.category)} mt-1`}>
        {tracking.activity.category}
      </Badge>
    </div>
  );

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

  return (
    <ContextMenu>
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
        {isCompleted ? (
          <ContextMenuItem onClick={() => onUnconfirm(tracking)}>
            <Clock className="h-4 w-4 mr-2" />
            Annulla conferma tempo
          </ContextMenuItem>
        ) : (
          <ContextMenuItem onClick={() => onConfirm(tracking)} disabled={!canConfirm} className={!canConfirm ? 'opacity-50 cursor-not-allowed' : ''}>
            <Clock className="h-4 w-4 mr-2" />
            Conferma tempo
          </ContextMenuItem>
        )}
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
        {tracking.is_recurring && (
          <ContextMenuItem onClick={() => onDeleteAllRecurring(tracking)} className="text-destructive focus:text-destructive">
            <Trash2 className="h-4 w-4 mr-2" />
            Elimina tutte le ricorrenze
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
