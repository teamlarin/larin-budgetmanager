import { useState, useEffect } from 'react';
import { GitBranch, Plus, Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ActiveFlowsList } from '@/components/workflows/ActiveFlowsList';
import { FlowDetailView } from '@/components/workflows/FlowDetailView';
import { TemplateManagement } from '@/components/workflows/TemplateManagement';
import { CreateFlowDialog } from '@/components/workflows/CreateFlowDialog';
import { CreateTemplateDialog } from '@/components/workflows/CreateTemplateDialog';
import { useWorkflowTemplates, useWorkflowFlows } from '@/hooks/useWorkflows';
import { useApprovedProfiles } from '@/hooks/useProfiles';
import type { WorkflowTemplate } from '@/types/workflow';
import { supabase } from '@/integrations/supabase/client';

const Workflows = () => {
  const { templates, loading: tplLoading, saveTemplate, deleteTemplate } = useWorkflowTemplates();
  const { flows, loading: flowsLoading, createFlow, toggleTask, updateFlowName, updateTaskAssignee, updateTaskDueDate, fetchTaskComments, addTaskComment } = useWorkflowFlows();
  const profiles = useApprovedProfiles();

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

  const handleCreateFlow = async (templateId: string, customName: string, ownerId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (!template) return;
    await createFlow(template, customName, ownerId);
  };

  const handleSaveTemplate = async (template: WorkflowTemplate) => {
    const isNew = !templates.some(t => t.id === template.id);
    await saveTemplate(template, isNew);
  };

  const selectedFlow = flows.find(f => f.id === selectedFlowId) || null;
  const isAdmin = userRole === 'admin';
  const loading = tplLoading || flowsLoading;

  if (selectedFlow) {
    return (
      <div className="page-container stack-lg">
        <FlowDetailView
          flow={selectedFlow}
          profiles={profiles}
          onBack={() => setSelectedFlowId(null)}
          onToggleTask={toggleTask}
          onUpdateFlowName={updateFlowName}
          onUpdateTaskAssignee={updateTaskAssignee}
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

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
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
                flows={flows}
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
                  onDelete={(id) => deleteTemplate(id)}
                  onDuplicate={(template) => {
                    const duplicate: WorkflowTemplate = {
                      ...template,
                      id: crypto.randomUUID(),
                      name: `${template.name} (copia)`,
                      tasks: template.tasks.map(t => ({ ...t, id: crypto.randomUUID() })),
                    };
                    // Remap dependsOn references
                    const idMap = new Map(template.tasks.map((t, i) => [t.id, duplicate.tasks[i].id]));
                    duplicate.tasks = duplicate.tasks.map(t => ({
                      ...t,
                      dependsOn: t.dependsOn ? idMap.get(t.dependsOn) || null : null,
                    }));
                    saveTemplate(duplicate, true);
                  }}
                />
              </div>
            </TabsContent>
          )}
        </Tabs>
      )}

      <CreateFlowDialog
        open={showCreateFlow}
        onOpenChange={setShowCreateFlow}
        templates={templates}
        profiles={profiles}
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
