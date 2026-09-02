import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ActivityTaskSelect } from './ActivityTaskSelect';
import { ProjectTaskFormSheet } from '@/components/project-tasks/ProjectTaskFormSheet';
import {
  useProjectTasks,
  useProjectTeam,
  useBudgetActivityOptions,
  type ProjectTaskInput,
} from '@/hooks/useProjectTasks';

interface Props {
  projectId?: string | null;
  budgetItemId?: string | null;
  value: string | null;
  onChange: (taskId: string | null) => void;
  enabled?: boolean;
}

/**
 * Campo task facoltativo con creazione rapida:
 * select delle task aperte collegate all'attività + CTA "Nuova task"
 * con progetto e attività prevista già preselezionati.
 */
export function ActivityTaskField({ projectId, budgetItemId, value, onChange, enabled = true }: Props) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const queryClient = useQueryClient();

  const { createTask } = useProjectTasks(projectId || '');
  const { profiles } = useProjectTeam(projectId || '');
  const activityOptions = useBudgetActivityOptions(projectId || '');

  if (!budgetItemId) return null;

  const handleSubmit = (input: ProjectTaskInput) => {
    createTask.mutate(input, {
      onSuccess: (created: any) => {
        setSheetOpen(false);
        queryClient.invalidateQueries({ queryKey: ['activity-tasks', budgetItemId] });
        if (created?.id) onChange(created.id);
      },
    });
  };

  return (
    <div className="space-y-2">
      <ActivityTaskSelect
        budgetItemId={budgetItemId}
        value={value}
        onChange={onChange}
        enabled={enabled}
      />
      <Button type="button" variant="outline" size="sm" onClick={() => setSheetOpen(true)}>
        <Plus className="h-4 w-4 mr-2" />
        Nuova task
      </Button>

      <ProjectTaskFormSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        task={null}
        teamProfiles={profiles}
        activityOptions={activityOptions}
        onSubmit={handleSubmit}
        isSaving={createTask.isPending}
        initialBudgetItemId={budgetItemId}
      />
    </div>
  );
}
