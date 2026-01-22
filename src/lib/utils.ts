import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formats hours for display as hours and minutes.
 * Converts decimal hours to "Xh Ym" format.
 * @param hours - The number of hours (decimal) to format
 * @returns Formatted string with hours and minutes (e.g., "3h 30m")
 */
export function formatHours(hours: number): string {
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  
  if (h === 0) {
    return `${m}m`;
  }
  if (m === 0) {
    return `${h}h`;
  }
  return `${h}h ${m}m`;
}

/**
 * Formats hours for display as hours and minutes (same as formatHours).
 * Kept for backward compatibility.
 * @param hours - The number of hours (decimal) to format
 * @returns Formatted string with hours and minutes (e.g., "3h 30m")
 */
export function formatHoursLocale(hours: number): string {
  return formatHours(hours);
}

/**
 * Formats hours as decimal for data exports and calculations.
 * @param hours - The number of hours to format
 * @returns Formatted string with 2 decimal places (e.g., "3.50")
 */
export function formatHoursDecimal(hours: number): string {
  return hours.toFixed(2);
}

/**
 * Formats hours as decimal with Italian locale (comma separator) for exports.
 * @param hours - The number of hours to format
 * @returns Formatted string with comma separator (e.g., "3,50")
 */
export function formatHoursDecimalLocale(hours: number): string {
  return hours.toFixed(2).replace('.', ',');
}
