import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { differenceInDays, startOfWeek } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import type { NewRoadblockInput, ProjectRoadblock, ProjectUpdateHealth } from '@/lib/projectRoadblocks';

export interface LeaderProject {
  id: string;
  name: string;
  clientName: string | null;
  area: string | null;
  endDate: string | null;
  projectStatus: string | null;
  billingType: string | null;
  progress: number;
  slackChannelName: string | null;
  accountUserId: string | null;
  lastUpdateAt: string | null;
  lastUpdateHealth: ProjectUpdateHealth | null;
  lastUpdateProgress: number | null;
  /** true quando non esiste un update pubblicato nella settimana corrente */
  updateDue: boolean;
  daysSinceUpdate: number | null;
  hasPendingDraft: boolean;
  openRoadblocksCount: number;
}

export interface LeaderRoadblock extends ProjectRoadblock {
  _projectName: string;
  _clientName: string | null;
}

const ACTIVE_STATUSES = ['aperto'] as const;

export const useLeaderProjectsControl = (userId?: string | null, hideInternal?: boolean) => {
  const queryClient = useQueryClient();
  const queryKey = ['leader-projects-control', userId];

  const query = useQuery({
    queryKey,
    enabled: !!userId,
    queryFn: async () => {
      const { data: projects, error } = await supabase
        .from('projects')
        .select(
          'id, name, area, end_date, project_status, billing_type, progress, slack_channel_name, account_user_id, clients(name)'
        )
        .eq('project_leader_id', userId!)
        .eq('status', 'approvato')
        .in('project_status', ACTIVE_STATUSES);
      if (error) throw error;
      if (!projects?.length) {
        return { projects: [] as LeaderProject[], roadblocks: [] as LeaderRoadblock[], resolved: [] as LeaderRoadblock[] };
      }

      const ids = projects.map((p) => p.id);

      const [updatesRes, draftsRes, roadblocksRes] = await Promise.all([
        supabase
          .from('project_progress_updates')
          .select('project_id, created_at, health_status, progress_value')
          .in('project_id', ids)
          .order('created_at', { ascending: false }),
        supabase
          .from('project_update_drafts')
          .select('project_id')
          .in('project_id', ids)
          .eq('status', 'pending'),
        supabase
          .from('project_roadblocks')
          .select('*')
          .in('project_id', ids)
          .order('opened_at', { ascending: false }),
      ]);

      const latestByProject = new Map<string, any>();
      (updatesRes.data || []).forEach((u: any) => {
        if (!latestByProject.has(u.project_id)) latestByProject.set(u.project_id, u);
      });

      const pendingDrafts = new Set((draftsRes.data || []).map((d: any) => d.project_id));

      const projectMeta = new Map(
        projects.map((p: any) => [p.id, { name: p.name, clientName: p.clients?.name ?? null }])
      );

      const allRoadblocks = (roadblocksRes.data || []).map((r: any) => ({
        ...r,
        _projectName: projectMeta.get(r.project_id)?.name ?? 'Progetto',
        _clientName: projectMeta.get(r.project_id)?.clientName ?? null,
      })) as LeaderRoadblock[];

      const openCountByProject = new Map<string, number>();
      allRoadblocks
        .filter((r) => !r.resolved_at)
        .forEach((r) => openCountByProject.set(r.project_id, (openCountByProject.get(r.project_id) || 0) + 1));

      const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });

      const mapped: LeaderProject[] = projects.map((p: any) => {
        const last = latestByProject.get(p.id);
        const lastAt = last?.created_at ?? null;
        return {
          id: p.id,
          name: p.name,
          clientName: p.clients?.name ?? null,
          area: p.area ?? null,
          endDate: p.end_date ?? null,
          projectStatus: p.project_status ?? null,
          billingType: p.billing_type ?? null,
          progress: p.progress ?? 0,
          slackChannelName: p.slack_channel_name ?? null,
          accountUserId: p.account_user_id ?? null,
          lastUpdateAt: lastAt,
          lastUpdateHealth: (last?.health_status as ProjectUpdateHealth) ?? null,
          lastUpdateProgress: last?.progress_value ?? null,
          updateDue: !lastAt || new Date(lastAt) < weekStart,
          daysSinceUpdate: lastAt ? differenceInDays(new Date(), new Date(lastAt)) : null,
          hasPendingDraft: pendingDrafts.has(p.id),
          openRoadblocksCount: openCountByProject.get(p.id) || 0,
        };
      });

      const totalCount = mapped.length;

      mapped.sort((a, b) => {
        if (a.updateDue !== b.updateDue) return a.updateDue ? -1 : 1;
        return (b.openRoadblocksCount - a.openRoadblocksCount) || a.name.localeCompare(b.name);
      });

      return {
        projects: mapped,
        totalCount,
        roadblocks: allRoadblocks.filter((r) => !r.resolved_at),
        resolved: allRoadblocks.filter((r) => !!r.resolved_at),
      };
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey });
    queryClient.invalidateQueries({ queryKey: ['project-roadblocks'] });
  };

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

  const createRoadblock = useMutation({
    mutationFn: async ({ projectId, input }: { projectId: string; input: NewRoadblockInput }) => {
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

  const data = query.data;
  const isInternal = (p: LeaderProject) =>
    String(p.area ?? '').trim().toLowerCase() === 'interno' ||
    String(p.billingType ?? '').trim().toLowerCase() === 'interno';
  const visibleProjects = (data?.projects ?? []).filter((p) => !hideInternal || !isInternal(p));

  return {
    projects: visibleProjects,
    totalCount: data?.totalCount ?? 0,
    openRoadblocks: data?.roadblocks ?? [],
    resolvedRoadblocks: data?.resolved ?? [],
    updatesDueCount: visibleProjects.filter((p) => p.updateDue).length,
    isLoading: query.isLoading,
    refetch: query.refetch,
    resolveRoadblock,
    createRoadblock,
  };
};
