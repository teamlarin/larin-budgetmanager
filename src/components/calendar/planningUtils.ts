import { addDays, format, getDay, isBefore, startOfDay } from 'date-fns';

export interface PlanSlot {
  scheduled_date: string;
  scheduled_start_time: string;
  scheduled_end_time: string;
}

export interface BusyInterval {
  start: number; // minutes from midnight
  end: number;
}

const toMinutes = (time: string): number => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m || 0);
};

const toTime = (minutes: number): string => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

export const minutesFromTimes = (start?: string | null, end?: string | null): number => {
  if (!start || !end) return 0;
  return Math.max(0, toMinutes(end.substring(0, 5)) - toMinutes(start.substring(0, 5)));
};

/**
 * Builds the list of days in a week where activities can be planned.
 * Skips weekends (when hidden), closure days and past days for the current week.
 */
export function getPlannableDays(options: {
  weekStart: Date;
  numberOfDays: number;
  showWeekends: boolean;
  isClosureDay: (date: Date) => unknown;
  skipPastDays?: boolean;
}): Date[] {
  const { weekStart, numberOfDays, showWeekends, isClosureDay, skipPastDays = true } = options;
  const today = startOfDay(new Date());
  const days: Date[] = [];
  for (let i = 0; i < numberOfDays; i++) {
    const day = addDays(weekStart, i);
    const dow = getDay(day);
    if (!showWeekends && (dow === 0 || dow === 6)) continue;
    if (isClosureDay(day)) continue;
    if (skipPastDays && isBefore(day, today)) continue;
    days.push(day);
  }
  return days;
}

/**
 * Distributes a total amount of minutes across the given days, appending each
 * chunk after the busy intervals already present on that day and respecting the
 * configured work day boundaries.
 */
export function distributeMinutesAcrossDays(options: {
  totalMinutes: number;
  days: Date[];
  workDayStart: string;
  workDayEnd: string;
  busyByDate: Map<string, BusyInterval[]>;
}): { slots: PlanSlot[]; unallocatedMinutes: number } {
  const { totalMinutes, days, workDayStart, workDayEnd, busyByDate } = options;
  const dayStart = toMinutes(workDayStart);
  const dayEnd = toMinutes(workDayEnd);
  const slots: PlanSlot[] = [];
  let remaining = Math.max(0, Math.round(totalMinutes / 15) * 15);

  for (const day of days) {
    if (remaining <= 0) break;
    const dateStr = format(day, 'yyyy-MM-dd');
    const busy = (busyByDate.get(dateStr) || []).slice().sort((a, b) => a.start - b.start);
    let cursor = dayStart;
    for (const interval of busy) {
      if (interval.end > cursor) cursor = Math.max(cursor, interval.end);
    }
    cursor = Math.max(cursor, dayStart);
    const available = dayEnd - cursor;
    if (available < 15) continue;
    const take = Math.min(remaining, available);
    slots.push({
      scheduled_date: dateStr,
      scheduled_start_time: toTime(cursor),
      scheduled_end_time: toTime(cursor + take),
    });
    busyByDate.set(dateStr, [...busy, { start: cursor, end: cursor + take }]);
    remaining -= take;
  }

  return { slots, unallocatedMinutes: remaining };
}

/** Builds the busy intervals map from existing trackings of the week. */
export function buildBusyMap(
  trackings: { scheduled_date: string | null; scheduled_start_time: string | null; scheduled_end_time: string | null }[]
): Map<string, BusyInterval[]> {
  const map = new Map<string, BusyInterval[]>();
  trackings.forEach(t => {
    if (!t.scheduled_date || !t.scheduled_start_time || !t.scheduled_end_time) return;
    const start = toMinutes(t.scheduled_start_time.substring(0, 5));
    const end = toMinutes(t.scheduled_end_time.substring(0, 5));
    if (end <= start) return;
    const list = map.get(t.scheduled_date) || [];
    list.push({ start, end });
    map.set(t.scheduled_date, list);
  });
  return map;
}
