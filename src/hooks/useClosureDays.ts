import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, isSameDay, parseISO } from 'date-fns';

interface ClosureDay {
  date: string;
  name: string;
  isRecurring: boolean;
}

interface ClosureDaysSettings {
  closureDays: ClosureDay[];
}

/**
 * Calcola la data di Pasqua per un dato anno usando l'algoritmo di Gauss/Anonymous
 * Restituisce una data in formato Date
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

/**
 * Calcola Pasquetta (lunedì dopo Pasqua)
 */
export function calculateEasterMondayDate(year: number): Date {
  const easter = calculateEasterDate(year);
  return new Date(easter.getTime() + 24 * 60 * 60 * 1000);
}

export interface ClosureDayInfo {
  date: Date;
  name: string;
  dateString: string; // YYYY-MM-DD format
}

/**
 * Hook che restituisce i giorni di chiusura per un range di date
 */
export function useClosureDays() {
  const { data: settings, isLoading } = useQuery({
    queryKey: ['app-settings', 'closure_days'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('*')
        .eq('setting_key', 'closure_days')
        .maybeSingle();

      if (error) throw error;
      return data;
    }
  });

  /**
   * Calcola tutti i giorni di chiusura per un dato anno
   */
  const getClosureDaysForYear = (year: number): ClosureDayInfo[] => {
    const result: ClosureDayInfo[] = [];
    
    if (settings?.setting_value) {
      const value = settings.setting_value as unknown as ClosureDaysSettings;
      const closureDays = value.closureDays || [];

      closureDays.forEach(day => {
        if (day.isRecurring) {
          // Formato MM-DD
          const [month, dayNum] = day.date.split('-');
          const date = new Date(year, parseInt(month) - 1, parseInt(dayNum));
          result.push({
            date,
            name: day.name,
            dateString: format(date, 'yyyy-MM-dd')
          });
        } else {
          // Formato YYYY-MM-DD - solo se corrisponde all'anno
          const date = parseISO(day.date);
          if (date.getFullYear() === year) {
            result.push({
              date,
              name: day.name,
              dateString: day.date
            });
          }
        }
      });
    }

    // Aggiungi Pasqua e Pasquetta (calcolate dinamicamente)
    const easter = calculateEasterDate(year);
    const easterMonday = calculateEasterMondayDate(year);
    
    result.push({
      date: easter,
      name: 'Pasqua',
      dateString: format(easter, 'yyyy-MM-dd')
    });
    
    result.push({
      date: easterMonday,
      name: 'Pasquetta',
      dateString: format(easterMonday, 'yyyy-MM-dd')
    });

    return result;
  };

  /**
   * Verifica se una data specifica è un giorno di chiusura
   */
  const isClosureDay = (date: Date): ClosureDayInfo | null => {
    const year = date.getFullYear();
    const closureDays = getClosureDaysForYear(year);
    
    return closureDays.find(d => isSameDay(d.date, date)) || null;
  };

  /**
   * Ottiene i giorni di chiusura per un array di date
   */
  const getClosureDaysForDates = (dates: Date[]): Map<string, ClosureDayInfo> => {
    const result = new Map<string, ClosureDayInfo>();
    
    // Raccogli tutti gli anni unici dalle date
    const years = new Set(dates.map(d => d.getFullYear()));
    
    // Calcola tutti i giorni di chiusura per ogni anno
    const allClosureDays: ClosureDayInfo[] = [];
    years.forEach(year => {
      allClosureDays.push(...getClosureDaysForYear(year));
    });

    // Mappa per dateString
    dates.forEach(date => {
      const closure = allClosureDays.find(d => isSameDay(d.date, date));
      if (closure) {
        result.set(format(date, 'yyyy-MM-dd'), closure);
      }
    });

    return result;
  };

  return {
    isLoading,
    isClosureDay,
    getClosureDaysForYear,
    getClosureDaysForDates
  };
}
