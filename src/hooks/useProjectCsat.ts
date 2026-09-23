import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { normalizeProjectName } from '@/lib/operationsMetrics';

export interface ProjectCsatResponse {
  filledAt: string | null;
  contactName: string;
  nps: number | null;
  appreciated: string;
  improvements: string;
  notes: string;
}

export interface ProjectCsatSummary {
  responses: ProjectCsatResponse[];
  averageNps: number | null;
  latestNps: number | null;
  latestFilledAt: string | null;
}

/**
 * Soddisfazione cliente letta in diretta dal foglio Google CSAT e filtrata
 * sul progetto corrente (match sul nome normalizzato del progetto, con
 * fallback sul nome del cliente quando il foglio riporta solo quello).
 */
export function useProjectCsat(projectName?: string | null, clientName?: string | null) {
  return useQuery({
    queryKey: ['project-csat-sheet', projectName ?? '', clientName ?? ''],
    enabled: !!projectName,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<ProjectCsatSummary> => {
      const { data, error } = await supabase.functions.invoke('customer-satisfaction-sheet');
      if (error) throw error;
      const rows = ((data as any)?.rows ?? []) as any[];

      const target = normalizeProjectName(projectName);
      const targetClient = normalizeProjectName(clientName ?? '');

      const matched = rows.filter((row) => {
        const rowProject = normalizeProjectName(String(row.project ?? ''));
        if (rowProject && target && rowProject === target) return true;
        if (rowProject && target && (rowProject.includes(target) || target.includes(rowProject))) return true;
        // Senza nome progetto nel foglio, accetto la corrispondenza sul cliente.
        if (!rowProject && targetClient) {
          return normalizeProjectName(String(row.client ?? '')) === targetClient;
        }
        return false;
      });

      const responses: ProjectCsatResponse[] = matched
        .map((row) => ({
          filledAt: row.filled_at ? String(row.filled_at) : null,
          contactName: String(row.contact ?? '').trim(),
          nps:
            row.nps === null || row.nps === undefined || row.nps === ''
              ? null
              : Number(row.nps),
          appreciated: String(row.appreciated ?? '').trim(),
          improvements: String(row.improvements ?? '').trim(),
          notes: String(row.notes ?? '').trim(),
        }))
        .sort((a, b) => (b.filledAt ?? '').localeCompare(a.filledAt ?? ''));

      const scores = responses
        .map((r) => r.nps)
        .filter((n): n is number => n !== null && Number.isFinite(n));

      const latest = responses.find((r) => r.nps !== null && Number.isFinite(r.nps)) ?? null;

      return {
        responses,
        averageNps: scores.length
          ? Math.round((scores.reduce((s, n) => s + n, 0) / scores.length) * 10) / 10
          : null,
        latestNps: latest?.nps ?? null,
        latestFilledAt: latest?.filledAt ?? null,
      };
    },
  });
}
