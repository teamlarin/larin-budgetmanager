import { useMemo } from 'react';
import {
  useTeamLeaderProjectMargins,
  type ProjectMarginRow,
} from '@/hooks/useTeamLeaderProjectMargins';
import {
  evaluateProjectCriticality,
  groupProjectsByCriticality,
  type CriticalityProject,
  type CriticalitySignals,
} from '@/lib/projectCriticality';

export * from '@/lib/projectCriticality';

/**
 * Unisce progetti e margini (edge function calculate-project-margins) e
 * restituisce i segnali di criticità condivisi, già raggruppati.
 */
export function useProjectCriticality<T extends CriticalityProject>(projects: T[]) {
  const marginInputs = useMemo(
    () => projects.map((p) => ({ id: p.id, margin_percentage: p.margin_percentage })),
    [projects],
  );
  const { data: marginsMap, isLoading } = useTeamLeaderProjectMargins(marginInputs);

  const signals = useMemo(() => {
    const today = new Date();
    const map = new Map<string, CriticalitySignals>();
    for (const p of projects) {
      map.set(p.id, evaluateProjectCriticality(p, marginsMap?.get(p.id), today));
    }
    return map;
  }, [projects, marginsMap]);

  const groups = useMemo(() => groupProjectsByCriticality(projects, signals), [projects, signals]);

  return {
    signals,
    groups,
    margins: marginsMap ?? new Map<string, ProjectMarginRow>(),
    isLoading,
  };
}
