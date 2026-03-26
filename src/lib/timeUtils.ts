/**
 * Calculate hours between two time values, handling cross-midnight entries.
 * If end < start, assumes cross-midnight and adds 24h.
 * Caps at 16h max to prevent anomalous entries from distorting results.
 * 
 * @param startTime - Start time as Date, timestamp string, or time string (HH:mm)
 * @param endTime - End time as Date, timestamp string, or time string (HH:mm)
 * @param isTimeOnly - If true, treats inputs as time-only strings using a fixed date
 */
export function calculateSafeHours(
  startTime: Date | string,
  endTime: Date | string,
  isTimeOnly = false
): number {
  let start: Date;
  let end: Date;

  if (isTimeOnly) {
    start = new Date(`2000-01-01T${startTime}`);
    end = new Date(`2000-01-01T${endTime}`);
  } else {
    start = startTime instanceof Date ? startTime : new Date(startTime);
    end = endTime instanceof Date ? endTime : new Date(endTime);
  }

  let diffMs = end.getTime() - start.getTime();
  if (diffMs < 0) {
    // Cross-midnight: add 24 hours
    diffMs += 24 * 60 * 60 * 1000;
  }
  const hours = diffMs / (1000 * 60 * 60);
  // Cap at 16 hours to prevent anomalous entries
  return Math.min(hours, 16);
}

/**
 * Calculate duration in minutes between two time strings (HH:mm or HH:mm:ss),
 * handling cross-midnight entries. If end < start, assumes next day.
 * Caps at 16 hours (960 minutes).
 */
/**
 * Calculate temporal progress percentage for recurring projects.
 * Returns a value between 0 and 100 based on elapsed days vs total days.
 */
export function calculateTemporalProgress(startDate: string | null | undefined, endDate: string | null | undefined): number {
  if (!startDate || !endDate) return 0;
  const today = new Date();
  const start = new Date(startDate);
  const end = new Date(endDate);
  const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  const daysElapsed = Math.ceil((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return Math.min(100, Math.max(0, Math.round((daysElapsed / totalDays) * 100)));
}

export function calculateTimeMinutes(startTime: string, endTime: string): number {
  const startParts = startTime.split(':');
  const endParts = endTime.split(':');
  const startMinutes = parseInt(startParts[0]) * 60 + parseInt(startParts[1]);
  const endMinutes = parseInt(endParts[0]) * 60 + parseInt(endParts[1]);
  let duration = endMinutes - startMinutes;
  if (duration < 0) {
    duration += 24 * 60; // cross-midnight
  }
  return Math.min(duration, 16 * 60); // cap at 16h
}
