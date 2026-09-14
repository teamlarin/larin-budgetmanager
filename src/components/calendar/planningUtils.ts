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

export interface SlotLike {
  id: string;
  scheduled_date?: string | null;
  scheduled_start_time?: string | null;
  scheduled_end_time?: string | null;
}

/**
 * Returns the first slot that overlaps the given time range on the same day.
 * Two slots overlap when they share at least one minute (touching edges are OK).
 */
export function findOverlappingSlot<T extends SlotLike>(
  slots: T[],
  target: { date: string; startTime: string; endTime: string; excludeIds?: string[] }
): T | null {
  const start = toMinutes(target.startTime.substring(0, 5));
  const end = toMinutes(target.endTime.substring(0, 5));
  const exclude = new Set(target.excludeIds ?? []);

  return (
    slots.find(slot => {
      if (exclude.has(slot.id)) return false;
      if (!slot.scheduled_date || !slot.scheduled_start_time || !slot.scheduled_end_time) return false;
      if (slot.scheduled_date.substring(0, 10) !== target.date.substring(0, 10)) return false;
      const s = toMinutes(slot.scheduled_start_time.substring(0, 5));
      const e = toMinutes(slot.scheduled_end_time.substring(0, 5));
      return start < e && end > s;
    }) ?? null
  );
}

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
 * Distributes minutes evenly across the given days.
 *
 * Each day is capped at the person's contractual daily minutes (`dailyCapMinutes`,
 * already occupied time included) and always stays inside the configured work day
 * boundaries. The allocation is balanced (water-filling) so the hours spread over
 * the whole week instead of filling the first days to the brim.
 */
export function distributeMinutesAcrossDays(options: {
  totalMinutes: number;
  days: Date[];
  workDayStart: string;
  workDayEnd: string;
  busyByDate: Map<string, BusyInterval[]>;
  /** Ore giornaliere da contratto in minuti; se assente vale l'orario di fine giornata. */
  dailyCapMinutes?: number;
}): { slots: PlanSlot[]; unallocatedMinutes: number } {
  const { totalMinutes, days, workDayStart, workDayEnd, busyByDate, dailyCapMinutes } = options;
  const dayStart = toMinutes(workDayStart);
  const dayEnd = toMinutes(workDayEnd);
  const slots: PlanSlot[] = [];
  const total = Math.max(0, Math.round(totalMinutes / 15) * 15);
  if (total === 0 || days.length === 0) return { slots, unallocatedMinutes: total };

  // Cursore e capacità disponibile per ogni giorno
  const dayInfos = days.map(day => {
    const dateStr = format(day, 'yyyy-MM-dd');
    const busy = (busyByDate.get(dateStr) || []).slice().sort((a, b) => a.start - b.start);
    let cursor = dayStart;
    let busyMinutes = 0;
    for (const interval of busy) {
      busyMinutes += Math.max(0, interval.end - interval.start);
      if (interval.end > cursor) cursor = interval.end;
    }
    cursor = Math.max(cursor, dayStart);
    let capacity = dayEnd - cursor;
    if (dailyCapMinutes && dailyCapMinutes > 0) {
      capacity = Math.min(capacity, dailyCapMinutes - busyMinutes);
    }
    capacity = Math.floor(Math.max(0, capacity) / 15) * 15;
    return { dateStr, busy, cursor, capacity };
  });

  const amounts = balancedAllocation(total, dayInfos.map(d => d.capacity));

  dayInfos.forEach((info, index) => {
    const take = amounts[index];
    if (take < 15) return;
    slots.push({
      scheduled_date: info.dateStr,
      scheduled_start_time: toTime(info.cursor),
      scheduled_end_time: toTime(info.cursor + take),
    });
    busyByDate.set(info.dateStr, [...info.busy, { start: info.cursor, end: info.cursor + take }]);
  });

  const allocated = amounts.reduce((sum, m) => sum + (m >= 15 ? m : 0), 0);
  return { slots, unallocatedMinutes: Math.max(0, total - allocated) };
}

/**
 * Spreads `total` minutes over the given capacities in 15-minute steps, keeping
 * the daily amounts as even as possible (never exceeding a day's capacity).
 */
function balancedAllocation(total: number, capacities: number[]): number[] {
  const amounts = capacities.map(() => 0);
  let remaining = total;
  let openDays = capacities.filter(c => c >= 15).length;

  while (remaining >= 15 && openDays > 0) {
    // Quota per giorno aperto in questo passaggio, minimo un quarto d'ora
    const perDay = Math.max(15, Math.floor(remaining / openDays / 15) * 15);
    let progressed = false;
    for (let i = 0; i < capacities.length && remaining >= 15; i++) {
      const free = capacities[i] - amounts[i];
      if (free < 15) continue;
      const take = Math.min(perDay, free, remaining);
      if (take < 15) continue;
      amounts[i] += take;
      remaining -= take;
      progressed = true;
    }
    openDays = capacities.filter((c, i) => c - amounts[i] >= 15).length;
    if (!progressed) break;
  }

  return amounts;
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
