import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const STORAGE_KEY = 'changelog:lastSeenAt';

export function getChangelogLastSeen(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function markChangelogAsSeen(latestCreatedAt?: string) {
  try {
    const value = latestCreatedAt ?? new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, value);
    window.dispatchEvent(new CustomEvent('changelog-seen'));
  } catch {
    // ignore
  }
}

/**
 * Conta le voci del changelog con created_at successivo all'ultimo accesso
 * dell'utente alla sezione "Novità" in /help.
 */
export function useUnreadChangelog() {
  return useQuery({
    queryKey: ['changelog-unread-count'],
    queryFn: async () => {
      const lastSeen = getChangelogLastSeen();
      let query = supabase
        .from('changelog')
        .select('id, created_at', { count: 'exact', head: false })
        .order('created_at', { ascending: false })
        .limit(50);

      if (lastSeen) {
        query = query.gt('created_at', lastSeen);
      }

      const { data, error, count } = await query;
      if (error) throw error;

      return {
        count: count ?? data?.length ?? 0,
        latestCreatedAt: data?.[0]?.created_at ?? null,
      };
    },
    staleTime: 5 * 60 * 1000, // 5 min
    refetchOnWindowFocus: false,
  });
}
