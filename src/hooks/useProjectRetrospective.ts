import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type RetrospectiveStatus = 'bozza' | 'questionario_inviato' | 'incontro_fissato' | 'completata';

export const RETRO_STATUS_LABELS: Record<RetrospectiveStatus, string> = {
  bozza: 'Bozza',
  questionario_inviato: 'Questionario inviato',
  incontro_fissato: 'Incontro fissato',
  completata: 'Completata',
};

export const RETRO_STATUS_ORDER: RetrospectiveStatus[] = [
  'bozza',
  'questionario_inviato',
  'incontro_fissato',
  'completata',
];

export type RetroActionStatus = 'da_pianificare' | 'pianificata' | 'in_corso' | 'completata' | 'annullata';

export const RETRO_ACTION_STATUS_LABELS: Record<RetroActionStatus, string> = {
  da_pianificare: 'Da pianificare',
  pianificata: 'Pianificata',
  in_corso: 'In corso',
  completata: 'Completata',
  annullata: 'Annullata',
};

export interface RetrospectiveMetrics {
  residualMarginPct?: number | null;
  targetMarginPct?: number | null;
  plannedHours?: number | null;
  actualHours?: number | null;
  deliverablesOnTime?: number | null;
  deliverablesTotal?: number | null;
  customerSatisfaction?: number | null;
  capturedAt?: string;
}

export interface ProjectRetrospective {
  id: string;
  project_id: string;
  status: RetrospectiveStatus;
  meeting_at: string | null;
  meeting_link: string | null;
  facilitator_id: string | null;
  summary: string | null;
  key_points: string | null;
  metrics: RetrospectiveMetrics;
  survey_sent_at: string | null;
  completed_at: string | null;
  created_by: string | null;
}

export interface RetrospectiveSurvey {
  id: string;
  retrospective_id: string;
  user_id: string;
  answer_structure: string | null;
  answer_communication: string | null;
  answer_client: string | null;
  answer_golden_lesson: string | null;
  submitted_at: string | null;
}

export interface ProjectDeliverable {
  id: string;
  project_id: string;
  name: string;
  planned_date: string | null;
  actual_date: string | null;
  notes: string | null;
}

export interface RetrospectiveAction {
  id: string;
  retrospective_id: string;
  title: string;
  description: string | null;
  owner_id: string | null;
  due_date: string | null;
  status: RetroActionStatus;
  updates_playbook: boolean;
  target_project_id: string | null;
}

export const SURVEY_QUESTIONS = [
  {
    field: 'answer_structure' as const,
    label: 'Struttura del progetto',
    question: 'Cosa ha funzionato nella struttura del progetto? Cosa non ha funzionato?',
  },
  {
    field: 'answer_communication' as const,
    label: 'Comunicazione interna',
    question: 'Cos\u2019ha funzionato nella comunicazione all\u2019interno del team Larin? Cosa non ha funzionato?',
  },
  {
    field: 'answer_client' as const,
    label: 'Rapporto con il cliente',
    question: 'Cos\u2019ha funzionato nel rapporto con il cliente? Cosa non ha funzionato?',
  },
  {
    field: 'answer_golden_lesson' as const,
    label: 'L\u2019insegnamento d\u2019oro',
    question:
      'Se potessi tornare al giorno uno di questo progetto con la consapevolezza di oggi, qual \u00e8 l\u2019unica cosa che faresti diversamente?',
  },
];

/** Consegne del progetto (registro per il calcolo della puntualit\u00e0). */
export function useProjectDeliverables(projectId: string) {
  const queryClient = useQueryClient();
  const key = ['project-deliverables', projectId];

  const { data, isLoading } = useQuery({
    queryKey: key,
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_deliverables')
        .select('*')
        .eq('project_id', projectId)
        .order('planned_date', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data || []) as ProjectDeliverable[];
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: key });

  const createDeliverable = useMutation({
    mutationFn: async (input: Partial<ProjectDeliverable>) => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase.from('project_deliverables').insert({
        project_id: projectId,
        name: input.name || 'Consegna',
        planned_date: input.planned_date || null,
        actual_date: input.actual_date || null,
        notes: input.notes || null,
        created_by: auth.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success('Consegna aggiunta');
    },
    onError: (e: any) => toast.error(e.message || 'Errore nel salvataggio'),
  });

  const updateDeliverable = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<ProjectDeliverable> & { id: string }) => {
      const { error } = await supabase.from('project_deliverables').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: any) => toast.error(e.message || 'Errore nel salvataggio'),
  });

  const deleteDeliverable = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('project_deliverables').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success('Consegna eliminata');
    },
    onError: (e: any) => toast.error(e.message || 'Errore nell\u2019eliminazione'),
  });

  return { deliverables: data ?? [], isLoading, createDeliverable, updateDeliverable, deleteDeliverable };
}

export function useProjectRetrospective(projectId: string) {
  const queryClient = useQueryClient();
  const retroKey = ['project-retrospective', projectId];

  const { data: retrospective, isLoading } = useQuery({
    queryKey: retroKey,
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_retrospectives')
        .select('*')
        .eq('project_id', projectId)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as ProjectRetrospective) || null;
    },
  });

  const retrospectiveId = retrospective?.id ?? null;

  const { data: surveys } = useQuery({
    queryKey: ['project-retrospective-surveys', retrospectiveId],
    enabled: !!retrospectiveId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_retrospective_surveys')
        .select('*')
        .eq('retrospective_id', retrospectiveId as string);
      if (error) throw error;
      return (data || []) as RetrospectiveSurvey[];
    },
  });

  const { data: actions } = useQuery({
    queryKey: ['project-retrospective-actions', retrospectiveId],
    enabled: !!retrospectiveId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_retrospective_actions')
        .select('*')
        .eq('retrospective_id', retrospectiveId as string)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as RetrospectiveAction[];
    },
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: retroKey });
    queryClient.invalidateQueries({ queryKey: ['project-retrospective-surveys', retrospectiveId] });
    queryClient.invalidateQueries({ queryKey: ['project-retrospective-actions', retrospectiveId] });
  };

  const startRetrospective = useMutation({
    mutationFn: async (metrics: RetrospectiveMetrics) => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase.from('project_retrospectives').insert({
        project_id: projectId,
        status: 'bozza',
        metrics: { ...metrics, capturedAt: new Date().toISOString() } as any,
        facilitator_id: auth.user?.id ?? null,
        created_by: auth.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll();
      toast.success('Retrospettiva avviata');
    },
    onError: (e: any) => toast.error(e.message || 'Errore nell\u2019avvio della retrospettiva'),
  });

  const updateRetrospective = useMutation({
    mutationFn: async (patch: Partial<ProjectRetrospective>) => {
      if (!retrospectiveId) throw new Error('Retrospettiva non trovata');
      const { error } = await supabase
        .from('project_retrospectives')
        .update(patch as any)
        .eq('id', retrospectiveId);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll();
      toast.success('Retrospettiva aggiornata');
    },
    onError: (e: any) => toast.error(e.message || 'Errore nell\u2019aggiornamento'),
  });

  const saveMySurvey = useMutation({
    mutationFn: async (answers: Partial<RetrospectiveSurvey>) => {
      if (!retrospectiveId) throw new Error('Retrospettiva non trovata');
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) throw new Error('Utente non autenticato');
      const { error } = await supabase.from('project_retrospective_surveys').upsert(
        {
          retrospective_id: retrospectiveId,
          user_id: userId,
          answer_structure: answers.answer_structure ?? null,
          answer_communication: answers.answer_communication ?? null,
          answer_client: answers.answer_client ?? null,
          answer_golden_lesson: answers.answer_golden_lesson ?? null,
          submitted_at: new Date().toISOString(),
        },
        { onConflict: 'retrospective_id,user_id' },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll();
      toast.success('Risposte inviate. Grazie!');
    },
    onError: (e: any) => toast.error(e.message || 'Errore nell\u2019invio delle risposte'),
  });

  const createAction = useMutation({
    mutationFn: async (input: Partial<RetrospectiveAction>) => {
      if (!retrospectiveId) throw new Error('Retrospettiva non trovata');
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase.from('project_retrospective_actions').insert({
        retrospective_id: retrospectiveId,
        title: input.title || 'Azione',
        description: input.description || null,
        owner_id: input.owner_id || null,
        due_date: input.due_date || null,
        status: (input.status as RetroActionStatus) || 'da_pianificare',
        updates_playbook: input.updates_playbook ?? false,
        target_project_id: input.target_project_id || null,
        created_by: auth.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll();
      toast.success('Azione aggiunta');
    },
    onError: (e: any) => toast.error(e.message || 'Errore nel salvataggio'),
  });

  const updateAction = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<RetrospectiveAction> & { id: string }) => {
      const { error } = await supabase
        .from('project_retrospective_actions')
        .update(patch as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidateAll,
    onError: (e: any) => toast.error(e.message || 'Errore nel salvataggio'),
  });

  const deleteAction = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('project_retrospective_actions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll();
      toast.success('Azione eliminata');
    },
    onError: (e: any) => toast.error(e.message || 'Errore nell\u2019eliminazione'),
  });

  return {
    retrospective: retrospective ?? null,
    surveys: surveys ?? [],
    actions: actions ?? [],
    isLoading,
    startRetrospective,
    updateRetrospective,
    saveMySurvey,
    createAction,
    updateAction,
    deleteAction,
  };
}
