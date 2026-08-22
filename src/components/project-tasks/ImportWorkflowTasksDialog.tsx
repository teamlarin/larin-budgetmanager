import { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PRIORITY_LABELS, type ProjectTaskPriority } from '@/lib/projectTaskSort';
import type {
  BudgetActivityOption, ImportWorkflowTasksInput, WorkflowImportOption,
} from '@/hooks/useProjectTasks';

const NONE = '__none__';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workflowOptions: WorkflowImportOption[];
  activityOptions: BudgetActivityOption[];
  onImport: (input: ImportWorkflowTasksInput) => void;
  isImporting?: boolean;
}

export const ImportWorkflowTasksDialog = ({
  open, onOpenChange, workflowOptions, activityOptions, onImport, isImporting,
}: Props) => {
  const [selected, setSelected] = useState<string>('');
  const [priority, setPriority] = useState<ProjectTaskPriority>('medium');
  const [activityId, setActivityId] = useState<string>(NONE);

  useEffect(() => {
    if (!open) return;
    setSelected('');
    setPriority('medium');
    setActivityId(NONE);
  }, [open]);

  const handleImport = () => {
    if (!selected || activityId === NONE) return;
    const [kind, workflowId] = selected.split(':') as ['flow' | 'template', string];
    onImport({
      kind,
      workflowId,
      priority,
      budgetItemId: activityId,
    });
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Importa task da workflow</DialogTitle>
          <DialogDescription>
            Le task del workflow selezionato vengono create come task indipendenti di questo progetto.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Workflow</Label>
            <Select value={selected} onValueChange={setSelected}>
              <SelectTrigger><SelectValue placeholder="Seleziona un workflow" /></SelectTrigger>
              <SelectContent className="max-h-72">
                {workflowOptions.length === 0 && (
                  <SelectItem value="__empty__" disabled>Nessun workflow disponibile</SelectItem>
                )}
                {workflowOptions.map((o) => (
                  <SelectItem key={`${o.kind}:${o.id}`} value={`${o.kind}:${o.id}`}>
                    {o.name} — {o.taskCount} task {o.kind === 'template' ? '(template)' : '(flow)'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Priorità delle task importate</Label>
            <Select value={priority} onValueChange={(v) => setPriority(v as ProjectTaskPriority)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(PRIORITY_LABELS) as ProjectTaskPriority[]).map((p) => (
                  <SelectItem key={p} value={p}>{PRIORITY_LABELS[p]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>
              Attività prevista collegata <span className="text-destructive">*</span>
            </Label>
            <Select value={activityId} onValueChange={setActivityId}>
              <SelectTrigger><SelectValue placeholder="Seleziona un'attività" /></SelectTrigger>
              <SelectContent className="max-h-72">
                {activityOptions.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name}{o.category ? ` — ${o.category}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {activityOptions.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Nessuna attività prevista nel progetto: creane una prima di importare le task.
              </p>
            )}
          </div>

        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annulla</Button>
          <Button onClick={handleImport} disabled={!selected || isImporting}>
            {isImporting ? 'Importazione...' : 'Importa task'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
