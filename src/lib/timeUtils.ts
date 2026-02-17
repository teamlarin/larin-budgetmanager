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
