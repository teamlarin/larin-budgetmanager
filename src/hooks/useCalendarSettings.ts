import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CalendarConfig } from '@/components/CalendarSettings';

const DEFAULT_CONFIG: CalendarConfig = {
  numberOfDays: 7,
  showWeekends: true,
  timezone: 'Europe/Rome',
  weekStartsOn: 1,
  workDayStart: '08:00',
  workDayEnd: '18:00',
  defaultSlotDuration: 60,
  zoomLevel: 60,
};

interface DbCalendarSettings {
  id: string;
  user_id: string;
  number_of_days: number;
  show_weekends: boolean;
  timezone: string;
  week_starts_on: number;
  work_day_start: string;
  work_day_end: string;
  default_slot_duration: number;
  zoom_level: number;
}

function dbToConfig(db: DbCalendarSettings): CalendarConfig {
  return {
    numberOfDays: db.number_of_days,
    showWeekends: db.show_weekends,
    timezone: db.timezone,
    weekStartsOn: db.week_starts_on,
    workDayStart: db.work_day_start,
    workDayEnd: db.work_day_end,
    defaultSlotDuration: db.default_slot_duration,
    zoomLevel: db.zoom_level,
  };
}

function configToDb(config: CalendarConfig) {
  return {
    number_of_days: config.numberOfDays,
    show_weekends: config.showWeekends,
    timezone: config.timezone,
    week_starts_on: config.weekStartsOn,
    work_day_start: config.workDayStart,
    work_day_end: config.workDayEnd,
    default_slot_duration: config.defaultSlotDuration,
    zoom_level: config.zoomLevel,
  };
}

export function useCalendarSettings() {
  const queryClient = useQueryClient();

  const { data: config, isLoading } = useQuery({
    queryKey: ['calendar-settings'],
    queryFn: async (): Promise<CalendarConfig> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return DEFAULT_CONFIG;

      const { data, error } = await supabase
        .from('user_calendar_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error loading calendar settings:', error);
        return DEFAULT_CONFIG;
      }

      if (!data) {
        // No settings yet, check localStorage for migration
        try {
          const saved = localStorage.getItem('calendarConfig');
          if (saved) {
            const parsed = JSON.parse(saved);
            const migratedConfig = { ...DEFAULT_CONFIG, ...parsed, weekStartsOn: 1 };
            // Save to database
            await supabase.from('user_calendar_settings').insert({
              user_id: user.id,
              ...configToDb(migratedConfig),
            });
            // Remove from localStorage after migration
            localStorage.removeItem('calendarConfig');
            return migratedConfig;
          }
        } catch (e) {
          console.error('Error migrating calendar settings:', e);
        }
        return DEFAULT_CONFIG;
      }

      return dbToConfig(data as DbCalendarSettings);
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const saveMutation = useMutation({
    mutationFn: async (newConfig: CalendarConfig) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const dbData = configToDb(newConfig);

      const { error } = await supabase
        .from('user_calendar_settings')
        .upsert({
          user_id: user.id,
          ...dbData,
        }, {
          onConflict: 'user_id',
        });

      if (error) throw error;
      return newConfig;
    },
    onSuccess: (newConfig) => {
      queryClient.setQueryData(['calendar-settings'], newConfig);
    },
  });

  return {
    config: config || DEFAULT_CONFIG,
    isLoading,
    saveConfig: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending,
  };
}
