import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Tiene il calendario sincronizzato in tempo reale tra utenti.
 *
 * Ascolta le modifiche su `activity_time_tracking` (pianificazioni) e
 * `project_tasks` (task) e invalida le query interessate, così che gli slot
 * pianificati da un'altra persona — e i relativi conflitti — compaiano subito.
 * Gli aggiornamenti sono debounced per evitare raffiche di refetch.
 */
export function useCalendarRealtime(enabled: boolean = true) {
  const queryClient = useQueryClient();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const invalidateSoon = (keys: string[]) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        keys.forEach(key => queryClient.invalidateQueries({ queryKey: [key] }));
      }, 400);
    };

    const channel = supabase
      .channel('calendar-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'activity_time_tracking' },
        () => {
          invalidateSoon([
            'time-tracking',
            'user-activities',
            'multi-user-time-tracking',
            'weekly-planning',
          ]);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'project_tasks' },
        () => {
          invalidateSoon(['calendar-plannable-tasks', 'activity-tasks', 'my-tasks']);
        }
      )
      .subscribe();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      supabase.removeChannel(channel);
    };
  }, [enabled, queryClient]);
}
