import { isWithinInterval, parseISO } from 'date-fns';

export interface ClosureDay {
  date: string;
  name: string;
  isRecurring: boolean;
}

export interface ClosureDaysSettings {
  closureDays: ClosureDay[];
}

/**
 * Calcola la data di Pasqua per un dato anno usando l'algoritmo di Gauss/Anonymous.
 */
export function calculateEasterDate(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

/** Calcola Pasquetta (lunedì dopo Pasqua). */
export function calculateEasterMondayDate(year: number): Date {
  const easter = calculateEasterDate(year);
  return new Date(easter.getTime() + 24 * 60 * 60 * 1000);
}

/**
 * Restituisce tutte le date di chiusura (configurate + Pasqua + Pasquetta)
 * comprese in un intervallo [start, end] (estremi inclusi).
 */
export function getClosureDatesForRange(
  start: Date,
  end: Date,
  settings: ClosureDaysSettings | null | undefined
): Date[] {
  const result: Date[] = [];
  const startYear = start.getFullYear();
  const endYear = end.getFullYear();

  for (let year = startYear; year <= endYear; year++) {
    if (settings?.closureDays) {
      for (const day of settings.closureDays) {
        let date: Date | null = null;
        if (day.isRecurring) {
          const [month, dayNum] = day.date.split('-');
          date = new Date(year, parseInt(month, 10) - 1, parseInt(dayNum, 10));
        } else {
          const parsed = parseISO(day.date);
          if (parsed.getFullYear() === year) {
            date = parsed;
          }
        }
        if (date && isWithinInterval(date, { start, end })) {
          result.push(date);
        }
      }
    }

    const easter = calculateEasterDate(year);
    const easterMonday = calculateEasterMondayDate(year);
    if (isWithinInterval(easter, { start, end })) result.push(easter);
    if (isWithinInterval(easterMonday, { start, end })) result.push(easterMonday);
  }

  return result;
}

/** True se la data cade su un giorno lavorativo (lun-ven). */
export function isBusinessDay(date: Date): boolean {
  const dow = date.getDay();
  return dow >= 1 && dow <= 5;
}

/**
 * Numero di giorni di chiusura che cadono su giorni lavorativi nell'intervallo.
 * I giorni non lavorativi (weekend) vengono ignorati perché non tolgono capacità.
 */
export function countBusinessClosureDays(
  start: Date,
  end: Date,
  settings: ClosureDaysSettings | null | undefined
): number {
  return getClosureDatesForRange(start, end, settings).filter(isBusinessDay).length;
}
