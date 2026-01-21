import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formats hours for display without rounding.
 * Hours are based on 15-minute increments: 0.25, 0.50, 0.75, etc.
 * Always shows 2 decimal places for consistency.
 * @param hours - The number of hours to format
 * @returns Formatted string with 2 decimal places (e.g., "3.25")
 */
export function formatHours(hours: number): string {
  return hours.toFixed(2)
}

/**
 * Formats hours for display with Italian locale (comma as decimal separator).
 * @param hours - The number of hours to format
 * @returns Formatted string with comma separator (e.g., "3,25")
 */
export function formatHoursLocale(hours: number): string {
  return hours.toFixed(2).replace('.', ',')
}
