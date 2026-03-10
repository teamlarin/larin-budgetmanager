import { useState, useEffect } from 'react';
import { GitBranch } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ActiveFlowsList } from '@/components/workflows/ActiveFlowsList';
import { FlowDetailView } from '@/components/workflows/FlowDetailView';
import { TemplateManagement } from '@/components/workflows/TemplateManagement';
import { mockTemplates, mockActiveFlows } from '@/data/workflowMockData';
import type { ActiveFlow } from '@/types/workflow';
import { supabase } from '@/integrations/supabase/client';

const Workflows = () => {
  const [activeFlows, setActiveFlows] = useState<ActiveFlow[]>(mockActiveFlows);
  const [selectedFlow, setSelectedFlow] = useState<ActiveFlow | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);

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
        // If unchecking a task, also uncheck all tasks that depend on it (cascade)
        const uncheckDependents = (tasks: typeof updatedTasks, uncheckedId: string): typeof updatedTasks => {
          return tasks.map(t => {
            if (t.dependsOn === uncheckedId && t.isCompleted) {
              const updated = { ...t, isCompleted: false, completedAt: null };
              // Recursively uncheck dependents
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
    // Also update selectedFlow if viewing it
    setSelectedFlow(prev => {
      if (!prev || prev.id !== flowId) return prev;
      const updated = activeFlows.find(f => f.id === flowId);
      // We need to recompute from the new state - use a timeout to sync
      return null; // Will be re-selected from updated state
    });
  };

  // Keep selectedFlow in sync
  useEffect(() => {
    if (selectedFlow) {
      const updated = activeFlows.find(f => f.id === selectedFlow.id);
      if (updated) {
        setSelectedFlow(updated);
      }
    }
  }, [activeFlows]);

  const isAdmin = userRole === 'admin';

  if (selectedFlow) {
    return (
      <div className="page-container stack-lg">
        <FlowDetailView
          flow={selectedFlow}
          onBack={() => setSelectedFlow(null)}
          onToggleTask={handleToggleTask}
        />
      </div>
    );
  }

  return (
    <div className="page-container stack-lg">
      <div className="flex items-center gap-3">
        <GitBranch className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Flussi</h1>
          <p className="text-sm text-muted-foreground">Gestisci workflow e processi aziendali</p>
        </div>
      </div>

      <Tabs defaultValue="active" className="w-full">
        <TabsList>
          <TabsTrigger value="active">I miei Flussi Attivi</TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="templates">Gestione Modelli</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="active">
          <ActiveFlowsList
            flows={activeFlows}
            onSelectFlow={setSelectedFlow}
          />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="templates">
            <TemplateManagement templates={mockTemplates} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default Workflows;
