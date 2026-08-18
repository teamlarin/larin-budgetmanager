import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProjectTaskFormSheet } from './ProjectTaskFormSheet';
import {
  useProjectTasks,
  useProjectTeam,
  useBudgetActivityOptions,
  useMyTaskProjects,
  type ProjectTaskInput,
} from '@/hooks/useProjectTasks';
import { cn } from '@/lib/utils';

interface Props {
  /** Se presente, la task viene creata direttamente su questo progetto */
  projectId?: string;
  label?: string;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  size?: 'default' | 'sm' | 'icon';
  className?: string;
  iconOnly?: boolean;
}

export const QuickTaskButton = ({
  projectId: fixedProjectId,
  label = 'Nuova task',
  variant = 'outline',
  size = 'sm',
  className,
  iconOnly = false,
}: Props) => {
  const [open, setOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [resetSignal, setResetSignal] = useState(0);

  const needsProjectPicker = !fixedProjectId;
  const { projects } = useMyTaskProjects(open && needsProjectPicker);
  const activeProjectId = fixedProjectId || selectedProject;

  const { createTask } = useProjectTasks(activeProjectId);
  const { profiles } = useProjectTeam(activeProjectId);
  const activityOptions = useBudgetActivityOptions(activeProjectId);

  const handleSubmit = (input: ProjectTaskInput, options?: { keepOpen?: boolean }) => {
    if (!activeProjectId) return;
    createTask.mutate(input, {
      onSuccess: () => {
        if (options?.keepOpen) setResetSignal((v) => v + 1);
        else setOpen(false);
      },
    });
  };

  return (
    <>
      <Button
        variant={variant}
        size={iconOnly ? 'icon' : size}
        className={cn(className)}
        onClick={() => setOpen(true)}
        aria-label={label}
      >
        <Plus className={cn('h-4 w-4', !iconOnly && 'mr-2')} />
        {!iconOnly && label}
      </Button>

      <ProjectTaskFormSheet
        open={open}
        onOpenChange={(o) => { setOpen(o); if (!o) setSelectedProject(''); }}
        task={null}
        teamProfiles={profiles}
        activityOptions={activityOptions}
        onSubmit={handleSubmit}
        isSaving={createTask.isPending}
        projectOptions={needsProjectPicker ? projects : undefined}
        projectId={needsProjectPicker ? selectedProject : fixedProjectId}
        onProjectChange={setSelectedProject}
        showCreateAnother
        resetSignal={resetSignal}
      />
    </>
  );
};
