import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Returns true if the current authenticated user can publish a progress update
 * for the given project. Authorized:
 *   - admins
 *   - team_leaders
 *   - the project's project_leader
 *
 * If `projectLeaderId` is provided we can short-circuit the leader check on the client.
 * The role check is done with a single query cached across the app.
 */
export const useCanUpdateProjectProgress = (
  projectId?: string | null,
  projectLeaderId?: string | null,
): boolean => {
  const { data: ctx } = useQuery({
    queryKey: ['progress-update-permission-context'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id ?? null;
      if (!userId) return { userId: null as string | null, isAdminOrTL: false };

      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .in('role', ['admin', 'team_leader']);

      return {
        userId,
        isAdminOrTL: !!roles && roles.length > 0,
      };
    },
  });

  if (!ctx?.userId || !projectId) return false;
  if (ctx.isAdminOrTL) return true;
  if (projectLeaderId && projectLeaderId === ctx.userId) return true;
  return false;
};
