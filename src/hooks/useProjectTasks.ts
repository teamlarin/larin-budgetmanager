import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import {
  nextRecurrenceDate,
  seriesIdOf,
  shouldGenerateNextOccurrence,
  SERIES_PROPAGATED_FIELDS,
  type RecurrenceEditScope,
  type ProjectTask,
  type ProjectTaskPriority,
  type ProjectTaskRecurrence,
  type ProjectTaskStatus,
} from '@/lib/projectTaskSort';
import { getProfileDisplayName, type UserProfile } from '@/types/workflow';

export interface ProjectTaskInput {
  title: string;
  description?: string | null;
  assignee_id?: string | null;
  status?: ProjectTaskStatus;
  priority?: ProjectTaskPriority;
  due_date?: string | null;
  budget_item_id?: string | null;
  recurrence_rule?: ProjectTaskRecurrence;
  recurrence_interval?: number;
  recurrence_end_date?: string | null;
}

export interface BudgetActivityOption {
  id: string;
  name: string;
  category: string | null;
}

export interface WorkflowImportOption {
  id: string;
  kind: 'flow' | 'template';
  name: string;
  taskCount: number;
}

export interface WorkflowImportTask {
  title: string;
  description: string | null;
  assignee_id: string | null;
  due_date: string | null;
}


export function useProjectTasks(projectId: string) {
  const queryClient = useQueryClient();
  const queryKey = ['project-tasks', projectId];

  const { data: tasks = [], isLoading } = useQuery({
    queryKey,
    enabled: !!projectId,
    queryFn: async (): Promise<ProjectTask[]> => {
      const { data, error } = await supabase
        .from('project_tasks')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as ProjectTask[];
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const createTask = useMutation({
    mutationFn: async (input: ProjectTaskInput) => {
      const title = input.title.trim();
      if (!title) throw new Error('Il titolo è obbligatorio');
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from('project_tasks').insert({
        project_id: projectId,
        title,
        description: input.description?.trim() || null,
        assignee_id: input.assignee_id || null,
        status: input.status || 'todo',
        priority: input.priority || 'medium',
        due_date: input.due_date || null,
        budget_item_id: input.budget_item_id || null,
        recurrence_rule: input.recurrence_rule || 'none',
        recurrence_interval: input.recurrence_interval || 1,
        recurrence_end_date: input.recurrence_end_date || null,
        created_by: userData?.user?.id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: 'Task creata' });
    },
    onError: (e: Error) => toast({ title: 'Errore', description: e.message, variant: 'destructive' }),
  });

  /** Genera l'occorrenza successiva di una task ricorrente completata */
  const generateNextOccurrence = async (taskId: string) => {
    const { data: task } = await supabase
      .from('project_tasks')
      .select('*')
      .eq('id', taskId)
      .maybeSingle();
    if (!task) return false;
    const t = task as ProjectTask;
    const today = format(new Date(), 'yyyy-MM-dd');
    if (!shouldGenerateNextOccurrence(t, today)) return false;

    const nextDue = nextRecurrenceDate(t.due_date || today, t.recurrence_rule, t.recurrence_interval);
    // evita duplicati: non generare se esiste già un'occorrenza con la stessa scadenza
    const parentId = t.recurrence_parent_id || t.id;
    const { data: existing } = await supabase
      .from('project_tasks')
      .select('id')
      .eq('project_id', t.project_id)
      .eq('recurrence_parent_id', parentId)
      .eq('due_date', nextDue)
      .limit(1);
    if (existing && existing.length > 0) return false;

    const { error } = await supabase.from('project_tasks').insert({
      project_id: t.project_id,
      title: t.title,
      description: t.description,
      assignee_id: t.assignee_id,
      status: 'todo',
      priority: t.priority,
      due_date: nextDue,
      budget_item_id: t.budget_item_id,
      recurrence_rule: t.recurrence_rule,
      recurrence_interval: t.recurrence_interval,
      recurrence_end_date: t.recurrence_end_date,
      recurrence_parent_id: parentId,
      created_by: t.created_by,
    });
    if (error) throw error;
    return true;
  };

  const updateTask = useMutation({
    mutationFn: async ({ id, scope, ...updates }: Partial<ProjectTaskInput> & { id: string; scope?: RecurrenceEditScope }) => {
      const payload: {
        title?: string;
        description?: string | null;
        assignee_id?: string | null;
        status?: ProjectTaskStatus;
        priority?: ProjectTaskPriority;
        due_date?: string | null;
        budget_item_id?: string | null;
        completed_at?: string | null;
        recurrence_rule?: ProjectTaskRecurrence;
        recurrence_interval?: number;
        recurrence_end_date?: string | null;
      } = { ...updates };
      if (typeof payload.title === 'string') {
        const t = payload.title.trim();
        if (!t) throw new Error('Il titolo è obbligatorio');
        payload.title = t;
      }
      if (updates.status) {
        payload.completed_at = updates.status === 'done' ? new Date().toISOString() : null;
      }

      // Ambito ricorrenza: propaga i campi di serie alle occorrenze future
      let futureUpdated = 0;
      if (scope && scope !== 'single') {
        const { data: current } = await supabase
          .from('project_tasks')
          .select('id, project_id, due_date, created_at, recurrence_parent_id')
          .eq('id', id)
          .maybeSingle();

        if (current) {
          const seriesId = seriesIdOf(current as { id: string; recurrence_parent_id: string | null });
          const { data: siblings } = await supabase
            .from('project_tasks')
            .select('id, due_date, created_at')
            .eq('project_id', current.project_id)
            .or(`id.eq.${seriesId},recurrence_parent_id.eq.${seriesId}`);

          const futureIds = (siblings || [])
            .filter((s) => {
              if (s.id === id) return false;
              if (current.due_date && s.due_date) return s.due_date > current.due_date;
              return new Date(s.created_at).getTime() > new Date(current.created_at).getTime();
            })
            .map((s) => s.id);

          const seriesPayload: Record<string, unknown> = {};
          SERIES_PROPAGATED_FIELDS.forEach((field) => {
            if (field in payload) seriesPayload[field] = (payload as Record<string, unknown>)[field];
          });

          if (futureIds.length > 0 && Object.keys(seriesPayload).length > 0) {
            const { error: seriesError } = await supabase
              .from('project_tasks')
              .update(seriesPayload as never)
              .in('id', futureIds);
            if (seriesError) throw seriesError;
            futureUpdated = futureIds.length;
          }
        }
      }

      if (scope !== 'future_only') {
        const { error } = await supabase.from('project_tasks').update(payload).eq('id', id);
        if (error) throw error;
      }

      if (scope !== 'future_only' && updates.status === 'done') {
        const generated = await generateNextOccurrence(id);
        return { generated, futureUpdated };
      }
      return { generated: false, futureUpdated };
    },
    onSuccess: (res) => {
      invalidate();
      if (res?.generated) toast({ title: 'Task ricorrente', description: 'Generata la prossima occorrenza.' });
      else if (res?.futureUpdated) {
        toast({
          title: 'Task aggiornata',
          description: `Modifiche applicate anche a ${res.futureUpdated} occorrenze future.`,
        });
      }
    },
    onError: (e: Error) => toast({ title: 'Errore', description: e.message, variant: 'destructive' }),
  });

  /** Azioni multiple: cambia stato o priorità su più task */
  const bulkUpdateTasks = useMutation({
    mutationFn: async ({
      ids,
      status,
      priority,
    }: { ids: string[]; status?: ProjectTaskStatus; priority?: ProjectTaskPriority }) => {
      if (ids.length === 0) return { generated: 0 };
      const payload: {
        status?: ProjectTaskStatus;
        priority?: ProjectTaskPriority;
        completed_at?: string | null;
      } = {};
      if (status) {
        payload.status = status;
        payload.completed_at = status === 'done' ? new Date().toISOString() : null;
      }
      if (priority) payload.priority = priority;
      const { error } = await supabase.from('project_tasks').update(payload).in('id', ids);
      if (error) throw error;

      let generated = 0;
      if (status === 'done') {
        for (const id of ids) {
          if (await generateNextOccurrence(id)) generated += 1;
        }
      }
      return { generated };
    },
    onSuccess: (res) => {
      invalidate();
      toast({
        title: 'Task aggiornate',
        description: res.generated > 0 ? `${res.generated} occorrenze ricorrenti generate.` : undefined,
      });
    },
    onError: (e: Error) => toast({ title: 'Errore', description: e.message, variant: 'destructive' }),
  });

  const bulkDeleteTasks = useMutation({
    mutationFn: async (ids: string[]) => {
      if (ids.length === 0) return;
      const { error } = await supabase.from('project_tasks').delete().in('id', ids);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: 'Task eliminate' });
    },
    onError: (e: Error) => toast({ title: 'Errore', description: e.message, variant: 'destructive' }),
  });

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('project_tasks').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: 'Task eliminata' });
    },
    onError: (e: Error) => toast({ title: 'Errore', description: e.message, variant: 'destructive' }),
  });

  return { tasks, isLoading, createTask, updateTask, deleteTask, bulkUpdateTasks, bulkDeleteTasks };
}

/** Team di progetto: project_members ∪ project leader */
export function useProjectTeam(projectId: string) {
  const { data } = useQuery({
    queryKey: ['project-task-team', projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const [{ data: project }, { data: members }] = await Promise.all([
        supabase.from('projects').select('project_leader_id').eq('id', projectId).maybeSingle(),
        supabase.from('project_members').select('user_id').eq('project_id', projectId),
      ]);

      const ids = new Set<string>();
      if (project?.project_leader_id) ids.add(project.project_leader_id);
      (members || []).forEach((m) => m.user_id && ids.add(m.user_id));

      let profiles: UserProfile[] = [];
      if (ids.size > 0) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, email')
          .in('id', Array.from(ids));
        profiles = ((profs || []) as UserProfile[]).sort((a, b) =>
          getProfileDisplayName(a).localeCompare(getProfileDisplayName(b))
        );
      }

      return {
        leaderId: project?.project_leader_id || null,
        memberIds: Array.from(ids),
        profiles,
      };
    },
  });

  return {
    leaderId: data?.leaderId ?? null,
    memberIds: data?.memberIds ?? [],
    profiles: data?.profiles ?? [],
  };
}

/** Opzioni per collegare la task a un'attività prevista dal budget del progetto */
export function useBudgetActivityOptions(projectId: string) {
  const { data } = useQuery({
    queryKey: ['project-task-activity-options', projectId],
    enabled: !!projectId,
    queryFn: async (): Promise<BudgetActivityOption[]> => {
      const { data, error } = await supabase
        .from('budget_items')
        .select('id, activity_name, category, is_product, display_order')
        .eq('project_id', projectId)
        .order('display_order', { ascending: true });
      if (error) throw error;
      return (data || [])
        .filter((r) => !r.is_product)
        .map((r) => ({ id: r.id, name: r.activity_name, category: r.category }));
    },
  });
  return data ?? [];
}

/** Workflow disponibili da importare come task del progetto */
export function useWorkflowImportOptions(projectId: string) {
  const { data } = useQuery({
    queryKey: ['workflow-import-options', projectId],
    enabled: !!projectId,
    queryFn: async (): Promise<WorkflowImportOption[]> => {
      const [{ data: flows }, { data: templates }] = await Promise.all([
        supabase
          .from('workflow_flows')
          .select('id, custom_name, template_id, workflow_flow_tasks(id)')
          .order('created_at', { ascending: false })
          .limit(200),
        supabase
          .from('workflow_templates')
          .select('id, name, workflow_task_templates(id)')
          .order('name', { ascending: true })
          .limit(200),
      ]);

      const flowOptions: WorkflowImportOption[] = ((flows || []) as any[]).map((f) => ({
        id: f.id,
        kind: 'flow' as const,
        name: f.custom_name || 'Flow senza nome',
        taskCount: (f.workflow_flow_tasks || []).length,
      }));
      const templateOptions: WorkflowImportOption[] = ((templates || []) as any[]).map((t) => ({
        id: t.id,
        kind: 'template' as const,
        name: t.name,
        taskCount: (t.workflow_task_templates || []).length,
      }));
      return [...templateOptions, ...flowOptions].filter((o) => o.taskCount > 0);
    },
  });
  return data ?? [];
}

/** Legge le task di un workflow (flow o template) da importare */
export async function fetchWorkflowTasks(
  kind: 'flow' | 'template',
  id: string
): Promise<WorkflowImportTask[]> {
  if (kind === 'flow') {
    const { data, error } = await supabase
      .from('workflow_flow_tasks')
      .select('title, description, assignee_id, due_date, display_order')
      .eq('flow_id', id)
      .order('display_order', { ascending: true });
    if (error) throw error;
    return (data || []).map((t) => ({
      title: t.title,
      description: t.description ?? null,
      assignee_id: t.assignee_id ?? null,
      due_date: t.due_date ?? null,
    }));
  }
  const { data, error } = await supabase
    .from('workflow_task_templates')
    .select('title, description, display_order')
    .eq('template_id', id)
    .order('display_order', { ascending: true });
  if (error) throw error;
  return (data || []).map((t) => ({
    title: t.title,
    description: t.description ?? null,
    assignee_id: null,
    due_date: null,
  }));
}

export interface ImportWorkflowTasksInput {
  kind: 'flow' | 'template';
  workflowId: string;
  defaultAssigneeId?: string | null;
  defaultDueDate?: string | null;
  priority?: ProjectTaskPriority;
  budgetItemId?: string | null;
}

/** Importa tutte le task di un workflow come task operative del progetto */
export function useImportWorkflowTasks(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: ImportWorkflowTasksInput) => {
      const tasks = await fetchWorkflowTasks(input.kind, input.workflowId);
      if (tasks.length === 0) throw new Error('Il workflow selezionato non ha task');
      const { data: userData } = await supabase.auth.getUser();
      const rows = tasks.map((t) => ({
        project_id: projectId,
        title: t.title,
        description: t.description,
        assignee_id: t.assignee_id || input.defaultAssigneeId || null,
        status: 'todo',
        priority: input.priority || 'medium',
        due_date: t.due_date || input.defaultDueDate || null,
        budget_item_id: input.budgetItemId || null,
        recurrence_rule: 'none',
        recurrence_interval: 1,
        created_by: userData?.user?.id || null,
      }));
      const { error } = await supabase.from('project_tasks').insert(rows);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['project-tasks', projectId] });
      toast({ title: 'Task importate', description: `${count} task create dal workflow.` });
    },
    onError: (e: Error) => toast({ title: 'Errore', description: e.message, variant: 'destructive' }),
  });
}

