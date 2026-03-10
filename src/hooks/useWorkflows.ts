import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { WorkflowTemplate, WorkflowTaskTemplate, ActiveFlow, ActiveTask, UserProfile, } from '@/types/workflow';
import { getProfileDisplayName } from '@/types/workflow';
import { toast } from 'sonner';

// ── helpers ──────────────────────────────────────────────
const profileCache = new Map<string, UserProfile>();

async function resolveProfiles(ids: string[]): Promise<Map<string, string>> {
  const missing = ids.filter(id => id && !profileCache.has(id));
  if (missing.length) {
    const { data } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, email')
      .in('id', missing);
    data?.forEach(p => profileCache.set(p.id, p as UserProfile));
  }
  const map = new Map<string, string>();
  ids.forEach(id => {
    const p = profileCache.get(id);
    map.set(id, p ? getProfileDisplayName(p) : 'Utente');
  });
  return map;
}

// ── Templates ────────────────────────────────────────────
export function useWorkflowTemplates() {
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    const { data: tplRows, error } = await supabase
      .from('workflow_templates')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) { toast.error('Errore caricamento modelli'); setLoading(false); return; }

    const tplIds = (tplRows || []).map(t => t.id);
    let taskRows: any[] = [];
    if (tplIds.length) {
      const { data } = await supabase
        .from('workflow_task_templates')
        .select('*')
        .in('template_id', tplIds)
        .order('display_order');
      taskRows = data || [];
    }

    const result: WorkflowTemplate[] = (tplRows || []).map(t => ({
      id: t.id,
      name: t.name,
      description: t.description || '',
      createdAt: t.created_at,
      updatedAt: t.updated_at,
      tasks: taskRows
        .filter(tk => tk.template_id === t.id)
        .map(tk => ({
          id: tk.id,
          title: tk.title,
          order: tk.display_order,
          dependsOn: tk.depends_on_task_id,
          description: tk.description || '',
        })),
    }));
    setTemplates(result);
    setLoading(false);
  }, []);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const saveTemplate = async (template: WorkflowTemplate, isNew: boolean) => {
    if (isNew) {
      const { data: { session } } = await supabase.auth.getSession();
      const { data: tpl, error } = await supabase
        .from('workflow_templates')
        .insert({ name: template.name, description: template.description, created_by: session?.user.id })
        .select()
        .single();
      if (error || !tpl) { toast.error('Errore creazione modello'); return; }

      if (template.tasks.length) {
        // First pass: insert tasks without dependencies to get real IDs
        const tempToReal = new Map<string, string>();
        for (const task of template.tasks) {
          const { data: inserted } = await supabase
            .from('workflow_task_templates')
            .insert({
              template_id: tpl.id,
              title: task.title,
              description: task.description || '',
              display_order: task.order,
              depends_on_task_id: null,
            })
            .select()
            .single();
          if (inserted) tempToReal.set(task.id, inserted.id);
        }
        // Second pass: update dependencies
        for (const task of template.tasks) {
          if (task.dependsOn && tempToReal.has(task.dependsOn)) {
            const realId = tempToReal.get(task.id);
            const realDepId = tempToReal.get(task.dependsOn);
            if (realId && realDepId) {
              await supabase
                .from('workflow_task_templates')
                .update({ depends_on_task_id: realDepId })
                .eq('id', realId);
            }
          }
        }
      }
    } else {
      await supabase
        .from('workflow_templates')
        .update({ name: template.name, description: template.description })
        .eq('id', template.id);

      // Delete old tasks and re-insert
      await supabase
        .from('workflow_task_templates')
        .delete()
        .eq('template_id', template.id);

      if (template.tasks.length) {
        const tempToReal = new Map<string, string>();
        for (const task of template.tasks) {
          const { data: inserted } = await supabase
            .from('workflow_task_templates')
            .insert({
              template_id: template.id,
              title: task.title,
              description: task.description || '',
              display_order: task.order,
              depends_on_task_id: null,
            })
            .select()
            .single();
          if (inserted) tempToReal.set(task.id, inserted.id);
        }
        for (const task of template.tasks) {
          if (task.dependsOn && tempToReal.has(task.dependsOn)) {
            const realId = tempToReal.get(task.id);
            const realDepId = tempToReal.get(task.dependsOn);
            if (realId && realDepId) {
              await supabase
                .from('workflow_task_templates')
                .update({ depends_on_task_id: realDepId })
                .eq('id', realId);
            }
          }
        }
      }
    }
    toast.success(isNew ? 'Modello creato' : 'Modello aggiornato');
    await fetchTemplates();
  };

  const deleteTemplate = async (id: string) => {
    const { error } = await supabase.from('workflow_templates').delete().eq('id', id);
    if (error) { toast.error('Errore eliminazione modello'); return; }
    toast.success('Modello eliminato');
    await fetchTemplates();
  };

  return { templates, loading, saveTemplate, deleteTemplate, refetch: fetchTemplates };
}

// ── Active Flows ─────────────────────────────────────────
export function useWorkflowFlows() {
  const [flows, setFlows] = useState<ActiveFlow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFlows = useCallback(async () => {
    setLoading(true);
    const { data: flowRows, error } = await supabase
      .from('workflow_flows')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) { toast.error('Errore caricamento flussi'); setLoading(false); return; }

    const flowIds = (flowRows || []).map(f => f.id);
    let taskRows: any[] = [];
    if (flowIds.length) {
      const { data } = await supabase
        .from('workflow_flow_tasks')
        .select('*')
        .in('flow_id', flowIds)
        .order('display_order');
      taskRows = data || [];
    }

    // Resolve profile names
    const profileIds = new Set<string>();
    flowRows?.forEach(f => { profileIds.add(f.owner_id); });
    taskRows.forEach(t => { if (t.assignee_id) profileIds.add(t.assignee_id); });
    const names = await resolveProfiles(Array.from(profileIds));

    const result: ActiveFlow[] = (flowRows || []).map(f => ({
      id: f.id,
      templateId: f.template_id,
      templateName: f.template_name,
      customName: f.custom_name,
      ownerId: f.owner_id,
      ownerName: names.get(f.owner_id) || 'Utente',
      createdAt: f.created_at,
      completedAt: f.completed_at,
      tasks: taskRows
        .filter(t => t.flow_id === f.id)
        .map(t => ({
          id: t.id,
          taskTemplateId: t.task_template_id,
          title: t.title,
          order: t.display_order,
          dependsOn: t.depends_on_task_id,
          isCompleted: t.is_completed,
          completedAt: t.completed_at,
          description: t.description || '',
          assigneeId: t.assignee_id,
          assigneeName: t.assignee_id ? (names.get(t.assignee_id) || null) : null,
        })),
    }));
    setFlows(result);
    setLoading(false);
  }, []);

  useEffect(() => { fetchFlows(); }, [fetchFlows]);

  const createFlow = async (
    template: { id: string; name: string; tasks: WorkflowTaskTemplate[] },
    customName: string,
    ownerId: string,
  ) => {
    const { data: { session } } = await supabase.auth.getSession();
    const { data: flow, error } = await supabase
      .from('workflow_flows')
      .insert({
        template_id: template.id,
        template_name: template.name,
        custom_name: customName,
        owner_id: ownerId,
        created_by: session?.user.id,
      })
      .select()
      .single();
    if (error || !flow) { toast.error('Errore creazione flusso'); return; }

    // Insert tasks - need to map template task IDs to real flow task IDs for dependencies
    const tempToReal = new Map<string, string>();
    for (const t of template.tasks.sort((a, b) => a.order - b.order)) {
      const { data: inserted } = await supabase
        .from('workflow_flow_tasks')
        .insert({
          flow_id: flow.id,
          task_template_id: t.id,
          title: t.title,
          description: t.description || '',
          display_order: t.order,
          depends_on_task_id: null,
          assignee_id: null,
        })
        .select()
        .single();
      if (inserted) tempToReal.set(t.id, inserted.id);
    }
    // Update dependencies
    for (const t of template.tasks) {
      if (t.dependsOn && tempToReal.has(t.dependsOn)) {
        const realId = tempToReal.get(t.id);
        const realDepId = tempToReal.get(t.dependsOn);
        if (realId && realDepId) {
          await supabase
            .from('workflow_flow_tasks')
            .update({ depends_on_task_id: realDepId })
            .eq('id', realId);
        }
      }
    }

    toast.success('Flusso creato');
    await fetchFlows();
  };

  const toggleTask = async (flowId: string, taskId: string) => {
    const flow = flows.find(f => f.id === flowId);
    if (!flow) return;
    const task = flow.tasks.find(t => t.id === taskId);
    if (!task) return;

    const nowCompleted = !task.isCompleted;

    // Update this task
    await supabase
      .from('workflow_flow_tasks')
      .update({
        is_completed: nowCompleted,
        completed_at: nowCompleted ? new Date().toISOString() : null,
      })
      .eq('id', taskId);

    // Cascade uncheck dependents if unchecking
    if (!nowCompleted) {
      const uncheckIds = collectDependents(flow.tasks, taskId);
      for (const id of uncheckIds) {
        await supabase
          .from('workflow_flow_tasks')
          .update({ is_completed: false, completed_at: null })
          .eq('id', id);
      }
    }

    // Check if all complete
    await fetchFlows();
    // Re-check completion after refetch
    const updatedFlow = flows.find(f => f.id === flowId);
    if (updatedFlow) {
      const allComplete = updatedFlow.tasks.every(t =>
        t.id === taskId ? nowCompleted : t.isCompleted
      );
      await supabase
        .from('workflow_flows')
        .update({ completed_at: allComplete ? new Date().toISOString() : null })
        .eq('id', flowId);
    }
    await fetchFlows();
  };

  const updateFlowName = async (flowId: string, newName: string) => {
    await supabase.from('workflow_flows').update({ custom_name: newName }).eq('id', flowId);
    setFlows(prev => prev.map(f => f.id === flowId ? { ...f, customName: newName } : f));
  };

  const updateTaskAssignee = async (flowId: string, taskId: string, assigneeId: string | null) => {
    await supabase.from('workflow_flow_tasks').update({ assignee_id: assigneeId }).eq('id', taskId);
    await fetchFlows();
  };

  return { flows, loading, createFlow, toggleTask, updateFlowName, updateTaskAssignee, refetch: fetchFlows };
}

function collectDependents(tasks: ActiveTask[], parentId: string): string[] {
  const result: string[] = [];
  for (const t of tasks) {
    if (t.dependsOn === parentId && t.isCompleted) {
      result.push(t.id);
      result.push(...collectDependents(tasks, t.id));
    }
  }
  return result;
}
