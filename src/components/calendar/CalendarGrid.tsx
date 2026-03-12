import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { CheckCircle, CalendarOff } from 'lucide-react';
import { format, isSameDay, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import { formatHours } from '@/lib/utils';
import { GoogleCalendarEvent, GoogleEvent } from '@/components/GoogleCalendarEvent';
import { ScheduledActivity, TimeSlot, calculateOverlapPositions } from './ScheduledActivity';
import { TimeTracking, DragCreateState } from './calendarTypes';
import { ClosureDayInfo } from '@/hooks/useClosureDays';

interface CalendarGridProps {
  weekDays: Date[];
  visibleHours: number[];
  hourHeight: number;
  timeTracking: TimeTracking[];
  dailyTotals: { planned: number; confirmed: number }[];
  closureDaysMap: Map<string, ClosureDayInfo>;
  currentTimeIndicator: { top: number; dayIndex: number } | null;
  dragCreateState: DragCreateState;
  handleDragCreateStart: (date: Date, hour: number, minutes: number) => void;
  handleDragCreateEnd: () => void;
  // ScheduledActivity callbacks
  onSaveResize: (id: string, startTime: string, endTime: string, isConfirmed?: boolean, scheduledDate?: string) => void;
  onOpenDetail: (tracking: TimeTracking) => void;
  onDuplicate: (tracking: TimeTracking) => void;
  onConfirm: (tracking: TimeTracking) => void;
  onUnconfirm: (tracking: TimeTracking) => void;
  onDelete: (tracking: TimeTracking) => void;
  onDeleteAllRecurring: (tracking: TimeTracking) => void;
  onCompleteActivity: (budgetItemId: string) => void;
  // Google Calendar
  isViewingOtherUser: boolean;
  googleEvents: GoogleEvent[];
  hiddenGoogleEvents: string[];
  accessibleProjects: { id: string; name: string }[];
  accessibleActivities: { id: string; activity_name: string; project_id: string; project_name: string; category: string; hours_worked: number }[];
  onConvertGoogleEvent: (event: GoogleEvent, budgetItemId: string, customDate?: string, customStartTime?: string, customEndTime?: string) => void;
  onHideGoogleEvent: (eventId: string) => void;
}

export function CalendarGrid({
  weekDays,
  visibleHours,
  hourHeight,
  timeTracking,
  dailyTotals,
  closureDaysMap,
  currentTimeIndicator,
  dragCreateState,
  handleDragCreateStart,
  handleDragCreateEnd,
  onSaveResize,
  onOpenDetail,
  onDuplicate,
  onConfirm,
  onUnconfirm,
  onDelete,
  onDeleteAllRecurring,
  onCompleteActivity,
  isViewingOtherUser,
  googleEvents,
  hiddenGoogleEvents,
  accessibleProjects,
  accessibleActivities,
  onConvertGoogleEvent,
  onHideGoogleEvent,
}: CalendarGridProps) {
  return (
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
          {visibleHours.map((hour, index) => (
            <div key={hour} className="flex" style={{ height: `${hourHeight}px` }}>
              <div className="w-16 flex-shrink-0 border-r text-xs text-muted-foreground text-right pr-2 pt-1">
                {hour.toString().padStart(2, '0')}:00
              </div>
              {weekDays.map((day, dayIndex) => {
                const dayTracking = timeTracking.filter(t => t.scheduled_date && isSameDay(parseISO(t.scheduled_date), day));
                const closureDayInfo = closureDaysMap.get(format(day, 'yyyy-MM-dd'));
                const isClosureDaySlot = !!closureDayInfo;
                const isDragCreatingThisDay = dragCreateState.isCreating && dragCreateState.startDate && isSameDay(dragCreateState.startDate, day);

                return (
                  <div key={`${day.toISOString()}-${hour}`} className={`flex-1 min-w-[120px] relative ${isClosureDaySlot ? 'bg-red-100/60 dark:bg-red-950/40' : ''}`}>
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
                          onSaveResize={onSaveResize}
                          onOpenDetail={onOpenDetail}
                          onDuplicate={onDuplicate}
                          onConfirm={onConfirm}
                          onUnconfirm={onUnconfirm}
                          onDelete={onDelete}
                          onDeleteAllRecurring={onDeleteAllRecurring}
                          onCompleteActivity={onCompleteActivity}
                        />
                      ));
                    })()}
                    {/* Drag-create preview */}
                    {index === 0 && isDragCreatingThisDay && (() => {
                      const workDayStartMinutes = visibleHours[0] * 60;
                      const startMins = Math.min(dragCreateState.startMinutes, dragCreateState.currentMinutes);
                      const endMins = Math.max(dragCreateState.startMinutes, dragCreateState.currentMinutes);
                      const previewTop = (startMins - workDayStartMinutes) / 60 * hourHeight;
                      const previewHeight = (endMins - startMins) / 60 * hourHeight;
                      const startH = Math.floor(startMins / 60);
                      const startM = startMins % 60;
                      const endH = Math.floor(endMins / 60);
                      const endM = endMins % 60;
                      return (
                        <div
                          className="absolute left-1 right-1 bg-primary/30 border-2 border-primary border-dashed rounded-md pointer-events-none z-30 flex flex-col items-center justify-center"
                          style={{ top: `${previewTop}px`, height: `${Math.max(previewHeight, 15)}px` }}
                        >
                          <span className="text-xs font-medium text-primary-foreground bg-primary px-2 py-0.5 rounded">
                            {`${startH.toString().padStart(2, '0')}:${startM.toString().padStart(2, '0')} - ${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`}
                          </span>
                        </div>
                      );
                    })()}
                    {/* Google Calendar events */}
                    {index === 0 && !isViewingOtherUser && googleEvents
                      .filter(event => {
                        const eventDate = parseISO(event.start);
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
                          onConvertToActivity={(e, budgetItemId, customDate, customStartTime, customEndTime) => onConvertGoogleEvent(e, budgetItemId, customDate, customStartTime, customEndTime)}
                          onHideEvent={onHideGoogleEvent}
                        />
                      ))}
                    {/* Current time indicator */}
                    {index === 0 && currentTimeIndicator && currentTimeIndicator.dayIndex === dayIndex && (
                      <div className="absolute left-0 right-0 z-20 flex items-center pointer-events-none" style={{ top: `${currentTimeIndicator.top}px` }}>
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
  );
}
