import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { classifyMargin, type MarginStatus } from '@/lib/projectCriticality';

export interface ProjectMarginData {
  residualMargin: number;
  laborCost: number;
  externalCost: number;
  totalCost: number;
  budget: number;
  targetBudget: number;
  confirmedHours: number;
  totalHours: number;
  projectType: string;
}

export type { MarginStatus };

export interface ProjectMarginRow extends ProjectMarginData {
  projectId: string;
  targetMargin: number;
  deltaVsTarget: number;
  status: MarginStatus;
}

// La classificazione del margine vive in src/lib/projectCriticality.ts:
// è la sorgente unica di criticità usata da dashboard, Progetti Approvati e focus score.
export { classifyMargin };

interface MarginsResponse {
  margins?: Record<string, ProjectMarginData>;
}

/**
 * Fetch and classify project margins for a set of project IDs via the
 * calculate-project-margins edge function. Additional metadata (target margin
 * from projects.margin_percentage) must be supplied by the caller since the
 * edge function only returns the residual margin.
 */
export function useTeamLeaderProjectMargins(
  projects: Array<{ id: string; margin_percentage?: number | null }>,
) {
  const projectIds = projects.map((p) => p.id).sort();
  const targetByProject = new Map(
    projects.map((p) => [p.id, Number(p.margin_percentage ?? 0)]),
  );

  return useQuery({
    queryKey: ['team-leader-project-margins', projectIds.join(',')],
    enabled: projectIds.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<Map<string, ProjectMarginRow>> => {
      const { data, error } = await supabase.functions.invoke<MarginsResponse>(
        'calculate-project-margins',
        { body: { project_ids: projectIds } },
      );
      if (error) {
        console.warn('calculate-project-margins failed', error);
        return new Map();
      }
      const raw = data?.margins || {};
      const out = new Map<string, ProjectMarginRow>();
      for (const [id, m] of Object.entries(raw)) {
        const targetMargin = targetByProject.get(id) ?? 0;
        const deltaVsTarget = Math.round((m.residualMargin - targetMargin) * 100) / 100;
        out.set(id, {
          projectId: id,
          ...m,
          targetMargin,
          deltaVsTarget,
          status: classifyMargin(m.residualMargin, targetMargin, m.budget),
        });
      }
      return out;
    },
  });
}
