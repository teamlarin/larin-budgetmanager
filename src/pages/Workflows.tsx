import { useState, useEffect, useMemo } from 'react';
import { GitBranch, Plus, Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ActiveFlowsList } from '@/components/workflows/ActiveFlowsList';
import { FlowDetailView } from '@/components/workflows/FlowDetailView';
import { TemplateManagement } from '@/components/workflows/TemplateManagement';
import { CreateFlowDialog } from '@/components/workflows/CreateFlowDialog';
import { CreateTemplateDialog } from '@/components/workflows/CreateTemplateDialog';
import { useWorkflowTemplates, useWorkflowFlows } from '@/hooks/useWorkflows';
import { useApprovedProfiles } from '@/hooks/useProfiles';
import type { WorkflowTemplate } from '@/types/workflow';
import { supabase } from '@/integrations/supabase/client';

const TEMPLATE_MANAGER_ROLES = ['admin', 'finance', 'team_leader', 'coordinator'];

const Workflows = () => {
  const { templates, loading: tplLoading, saveTemplate, deleteTemplate } = useWorkflowTemplates();
  const { flows, loading: flowsLoading, createFlow, toggleTask, updateFlowName, updateTaskAssignee, updateTaskDueDate, fetchTaskComments, addTaskComment } = useWorkflowFlows();
  const profiles = useApprovedProfiles();

  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [showCreateFlow, setShowCreateFlow] = useState(false);
  const [showCreateTemplate, setShowCreateTemplate] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<WorkflowTemplate | null>(null);
  const [showAllFlows, setShowAllFlows] = useState(false);

  useEffect(() => {
    const fetchRole = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setCurrentUserId(session.user.id);
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

  const isAdmin = userRole === 'admin';
  const canManageTemplates = userRole ? TEMPLATE_MANAGER_ROLES.includes(userRole) : false;

  const isInvolved = (flow: typeof flows[number]) =>
    !!currentUserId && (
      flow.ownerId === currentUserId ||
      flow.tasks.some(t => t.assigneeId === currentUserId)
    );

  const visibleFlows = useMemo(() => {
    if (isAdmin && showAllFlows) return flows;
    return flows.filter(isInvolved);
  }, [flows, isAdmin, showAllFlows, currentUserId]);

  const activeFlows = useMemo(() => visibleFlows.filter(f => !f.completedAt), [visibleFlows]);
  const archivedFlows = useMemo(
    () =>
      [...visibleFlows.filter(f => !!f.completedAt)]
        .sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || '')),
    [visibleFlows],
  );

  const selectedFlow = flows.find(f => f.id === selectedFlowId) || null;
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
          onUpdateTaskDueDate={updateTaskDueDate}
          fetchTaskComments={fetchTaskComments}
          addTaskComment={addTaskComment}
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
          <div className="flex items-center justify-between flex-wrap gap-3">
            <TabsList>
              <TabsTrigger value="active">
                I miei Flussi Attivi {activeFlows.length > 0 && <span className="ml-1.5 text-xs opacity-70">({activeFlows.length})</span>}
              </TabsTrigger>
              <TabsTrigger value="archive">
                Archivio {archivedFlows.length > 0 && <span className="ml-1.5 text-xs opacity-70">({archivedFlows.length})</span>}
              </TabsTrigger>
              {canManageTemplates && (
                <TabsTrigger value="templates">Gestione Modelli</TabsTrigger>
              )}
            </TabsList>
            {isAdmin && (
              <div className="flex items-center gap-2">
                <Switch id="show-all" checked={showAllFlows} onCheckedChange={setShowAllFlows} />
                <Label htmlFor="show-all" className="text-sm cursor-pointer">Mostra tutti i flussi</Label>
              </div>
            )}
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

          <TabsContent value="archive">
            <ActiveFlowsList
              flows={archivedFlows}
              onSelectFlow={(flow) => setSelectedFlowId(flow.id)}
              archived
            />
          </TabsContent>

          {canManageTemplates && (
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
