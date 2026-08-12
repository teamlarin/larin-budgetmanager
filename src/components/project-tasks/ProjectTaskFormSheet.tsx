import { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import { CalendarIcon, X } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { getProfileDisplayName, type UserProfile } from '@/types/workflow';
import {
  PRIORITY_LABELS,
  STATUS_LABELS,
  type ProjectTask,
  type ProjectTaskPriority,
  type ProjectTaskStatus,
} from '@/lib/projectTaskSort';
import type { ProjectTaskInput, WorkflowTaskOption } from '@/hooks/useProjectTasks';

const NONE = '__none__';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: ProjectTask | null;
  teamProfiles: UserProfile[];
  workflowOptions: WorkflowTaskOption[];
  onSubmit: (input: ProjectTaskInput) => void;
  isSaving?: boolean;
}

export const ProjectTaskFormSheet = ({
  open, onOpenChange, task, teamProfiles, workflowOptions, onSubmit, isSaving,
}: Props) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assigneeId, setAssigneeId] = useState<string>(NONE);
  const [status, setStatus] = useState<ProjectTaskStatus>('todo');
  const [priority, setPriority] = useState<ProjectTaskPriority>('medium');
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [workflowTaskId, setWorkflowTaskId] = useState<string>(NONE);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(task?.title || '');
    setDescription(task?.description || '');
    setAssigneeId(task?.assignee_id || NONE);
    setStatus(task?.status || 'todo');
    setPriority(task?.priority || 'medium');
    setDueDate(task?.due_date || null);
    setWorkflowTaskId(task?.workflow_flow_task_id || NONE);
    setError(null);
  }, [open, task]);

  const handleSubmit = () => {
    if (!title.trim()) {
      setError('Il titolo è obbligatorio');
      return;
    }
    onSubmit({
      title,
      description: description.trim() || null,
      assignee_id: assigneeId === NONE ? null : assigneeId,
      status,
      priority,
      due_date: dueDate,
      workflow_flow_task_id: workflowTaskId === NONE ? null : workflowTaskId,
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{task ? 'Modifica task' : 'Nuova task'}</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-1.5">
            <Label htmlFor="task-title">Titolo *</Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => { setTitle(e.target.value); setError(null); }}
              placeholder="Es. Preparare brief creativo"
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="task-desc">Descrizione</Label>
            <Textarea
              id="task-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Dettagli, link, note operative"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Stato</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as ProjectTaskStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(STATUS_LABELS) as ProjectTaskStatus[]).map((s) => (
                    <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Priorità</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as ProjectTaskPriority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(PRIORITY_LABELS) as ProjectTaskPriority[]).map((p) => (
                    <SelectItem key={p} value={p}>{PRIORITY_LABELS[p]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Assegnatario</Label>
            <Select value={assigneeId} onValueChange={setAssigneeId}>
              <SelectTrigger><SelectValue placeholder="Non assegnata" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Non assegnata</SelectItem>
                {teamProfiles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{getProfileDisplayName(p)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {teamProfiles.length === 0 && (
              <p className="text-xs text-muted-foreground">Nessun membro nel team di progetto.</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Scadenza</Label>
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn('flex-1 justify-start font-normal', !dueDate && 'text-muted-foreground')}>
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    {dueDate ? format(parseISO(dueDate), 'd MMMM yyyy', { locale: it }) : 'Nessuna scadenza'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dueDate ? parseISO(dueDate) : undefined}
                    onSelect={(d) => setDueDate(d ? format(d, 'yyyy-MM-dd') : null)}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              {dueDate && (
                <Button variant="ghost" size="icon" onClick={() => setDueDate(null)} aria-label="Rimuovi scadenza">
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Task di workflow collegata</Label>
            <Select value={workflowTaskId} onValueChange={setWorkflowTaskId}>
              <SelectTrigger><SelectValue placeholder="Nessun collegamento" /></SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value={NONE}>Nessun collegamento</SelectItem>
                {workflowOptions.map((o) => (
                  <SelectItem key={o.id} value={o.id}>{o.title} — {o.flowName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annulla</Button>
          <Button onClick={handleSubmit} disabled={isSaving}>
            {task ? 'Salva' : 'Crea task'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};
