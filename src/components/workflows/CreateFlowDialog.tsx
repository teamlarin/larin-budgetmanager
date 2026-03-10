import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { WorkflowTemplate } from '@/types/workflow';

interface CreateFlowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: WorkflowTemplate[];
  onCreateFlow: (templateId: string, assignedTo: string, assignedToId: string) => void;
}

export const CreateFlowDialog = ({ open, onOpenChange, templates, onCreateFlow }: CreateFlowDialogProps) => {
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [assignedTo, setAssignedTo] = useState('');

  const handleCreate = () => {
    if (!selectedTemplateId || !assignedTo.trim()) return;
    onCreateFlow(selectedTemplateId, assignedTo.trim(), `user-${Date.now()}`);
    setSelectedTemplateId('');
    setAssignedTo('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nuovo Flusso</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Modello</Label>
            <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleziona un modello..." />
              </SelectTrigger>
              <SelectContent>
                {templates.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Assegnato a</Label>
            <Input
              placeholder="Nome della persona..."
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annulla</Button>
          <Button onClick={handleCreate} disabled={!selectedTemplateId || !assignedTo.trim()}>
            Crea Flusso
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
