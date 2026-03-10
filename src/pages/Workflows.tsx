import { useState, useEffect } from 'react';
import { GitBranch, Plus } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ActiveFlowsList } from '@/components/workflows/ActiveFlowsList';
import { FlowDetailView } from '@/components/workflows/FlowDetailView';
import { TemplateManagement } from '@/components/workflows/TemplateManagement';
import { CreateFlowDialog } from '@/components/workflows/CreateFlowDialog';
import { CreateTemplateDialog } from '@/components/workflows/CreateTemplateDialog';
import { mockTemplates as initialTemplates, mockActiveFlows } from '@/data/workflowMockData';
import type { ActiveFlow, WorkflowTemplate } from '@/types/workflow';
import { supabase } from '@/integrations/supabase/client';

const Workflows = () => {
  const [templates, setTemplates] = useState<WorkflowTemplate[]>(initialTemplates);
  const [activeFlows, setActiveFlows] = useState<ActiveFlow[]>(mockActiveFlows);
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [showCreateFlow, setShowCreateFlow] = useState(false);
  const [showCreateTemplate, setShowCreateTemplate] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<WorkflowTemplate | null>(null);

  useEffect(() => {
    const fetchRole = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', session.user.id)
          .maybeSingle();
        setUserRole(data?.role || null);
      }
    };
    fetchRole();
  }, []);

  const handleToggleTask = (flowId: string, taskTemplateId: string) => {
    setActiveFlows(prev =>
      prev.map(flow => {
        if (flow.id !== flowId) return flow;
        const updatedTasks = flow.tasks.map(task => {
          if (task.taskTemplateId !== taskTemplateId) return task;
          const nowCompleted = !task.isCompleted;
          return {
            ...task,
            isCompleted: nowCompleted,
            completedAt: nowCompleted ? new Date().toISOString() : null,
          };
        });
        const uncheckDependents = (tasks: typeof updatedTasks, uncheckedId: string): typeof updatedTasks => {
          return tasks.map(t => {
            if (t.dependsOn === uncheckedId && t.isCompleted) {
              const updated = { ...t, isCompleted: false, completedAt: null };
              tasks = uncheckDependents(tasks, t.taskTemplateId);
              return updated;
            }
            return t;
          });
        };
        const toggledTask = updatedTasks.find(t => t.taskTemplateId === taskTemplateId);
        let finalTasks = updatedTasks;
        if (toggledTask && !toggledTask.isCompleted) {
          finalTasks = uncheckDependents(updatedTasks, taskTemplateId);
        }
        const allComplete = finalTasks.every(t => t.isCompleted);
        return {
          ...flow,
          tasks: finalTasks,
          completedAt: allComplete ? new Date().toISOString() : null,
        };
      })
    );
  };

  const handleUpdateFlowName = (flowId: string, newName: string) => {
    setActiveFlows(prev => prev.map(f => f.id === flowId ? { ...f, customName: newName } : f));
  };

  const handleUpdateTaskAssignee = (flowId: string, taskTemplateId: string, assigneeName: string | null) => {
    setActiveFlows(prev =>
      prev.map(flow => {
        if (flow.id !== flowId) return flow;
        return {
          ...flow,
          tasks: flow.tasks.map(t =>
            t.taskTemplateId === taskTemplateId
              ? { ...t, assigneeName, assigneeId: assigneeName ? `user-${Date.now()}` : null }
              : t
          ),
        };
      })
    );
  };

  const handleCreateFlow = (templateId: string, customName: string, ownerName: string, ownerId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (!template) return;
    const newFlow: ActiveFlow = {
      id: `af-${Date.now()}`,
      templateId: template.id,
      templateName: template.name,
      customName,
      ownerName,
      ownerId,
      tasks: template.tasks.map(t => ({
        taskTemplateId: t.id,
        title: t.title,
        order: t.order,
        dependsOn: t.dependsOn,
        isCompleted: false,
        completedAt: null,
        description: t.description,
        assigneeName: null,
        assigneeId: null,
      })),
      createdAt: new Date().toISOString(),
      completedAt: null,
    };
    setActiveFlows(prev => [newFlow, ...prev]);
  };

  const handleSaveTemplate = (template: WorkflowTemplate) => {
    setTemplates(prev => {
      const idx = prev.findIndex(t => t.id === template.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = template;
        return updated;
      }
      return [template, ...prev];
    });
  };

  const handleDeleteTemplate = (templateId: string) => {
    setTemplates(prev => prev.filter(t => t.id !== templateId));
  };

  const selectedFlow = activeFlows.find(f => f.id === selectedFlowId) || null;
  const isAdmin = userRole === 'admin';

  if (selectedFlow) {
    return (
      <div className="page-container stack-lg">
        <FlowDetailView
          flow={selectedFlow}
          onBack={() => setSelectedFlowId(null)}
          onToggleTask={handleToggleTask}
          onUpdateFlowName={handleUpdateFlowName}
          onUpdateTaskAssignee={handleUpdateTaskAssignee}
        />
      </div>
    );
  }

  return (
    <div className="page-container stack-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <GitBranch className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Flussi</h1>
            <p className="text-sm text-muted-foreground">Gestisci workflow e processi aziendali</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="active" className="w-full">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="active">I miei Flussi Attivi</TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="templates">Gestione Modelli</TabsTrigger>
            )}
          </TabsList>
        </div>

        <TabsContent value="active">
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => setShowCreateFlow(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Nuovo Flusso
              </Button>
            </div>
            <ActiveFlowsList
              flows={activeFlows}
              onSelectFlow={(flow) => setSelectedFlowId(flow.id)}
            />
          </div>
        </TabsContent>

        {isAdmin && (
          <TabsContent value="templates">
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button onClick={() => { setEditingTemplate(null); setShowCreateTemplate(true); }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nuovo Modello
                </Button>
              </div>
              <TemplateManagement
                templates={templates}
                onEdit={(template) => { setEditingTemplate(template); setShowCreateTemplate(true); }}
                onDelete={handleDeleteTemplate}
              />
            </div>
          </TabsContent>
        )}
      </Tabs>

      <CreateFlowDialog
        open={showCreateFlow}
        onOpenChange={setShowCreateFlow}
        templates={templates}
        onCreateFlow={handleCreateFlow}
      />

      <CreateTemplateDialog
        open={showCreateTemplate}
        onOpenChange={setShowCreateTemplate}
        template={editingTemplate}
        onSave={handleSaveTemplate}
      />
    </div>
  );
};

export default Workflows;
