import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { NewRoadblockInput, ProjectRoadblock } from '@/lib/projectRoadblocks';

export const useProjectRoadblocks = (projectId: string) => {
  const queryClient = useQueryClient();
  const queryKey = ['project-roadblocks', projectId];

  const query = useQuery({
    queryKey,
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_roadblocks')
        .select('*')
        .eq('project_id', projectId)
        .order('opened_at', { ascending: false });
      if (error) throw error;
      return (data || []) as ProjectRoadblock[];
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const createRoadblock = useMutation({
    mutationFn: async (input: NewRoadblockInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('project_roadblocks').insert({
        project_id: projectId,
        description: input.description.trim(),
        blocker_type: input.blocker_type,
        waiting_on_who: input.waiting_on_who?.trim() || null,
        waiting_on_what: input.waiting_on_what?.trim() || null,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const resolveRoadblock = useMutation({
    mutationFn: async ({ id, note }: { id: string; note?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('project_roadblocks')
        .update({
          resolved_at: new Date().toISOString(),
          resolution_note: note?.trim() || null,
          resolved_by: user?.id ?? null,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const reopenRoadblock = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('project_roadblocks')
        .update({ resolved_at: null, resolution_note: null, resolved_by: null })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const roadblocks = query.data || [];

  return {
    roadblocks,
    openRoadblocks: roadblocks.filter((r) => !r.resolved_at),
    resolvedRoadblocks: roadblocks.filter((r) => !!r.resolved_at),
    isLoading: query.isLoading,
    refetch: query.refetch,
    createRoadblock,
    resolveRoadblock,
    reopenRoadblock,
  };
};
