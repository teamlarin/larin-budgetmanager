import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { WorkflowTemplate, UserProfile } from '@/types/workflow';
import { getProfileDisplayName } from '@/types/workflow';

interface CreateFlowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: WorkflowTemplate[];
  profiles: UserProfile[];
  onCreateFlow: (templateId: string, customName: string, ownerId: string) => void;
}

export const CreateFlowDialog = ({ open, onOpenChange, templates, profiles, onCreateFlow }: CreateFlowDialogProps) => {
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [customName, setCustomName] = useState('');
  const [ownerId, setOwnerId] = useState('');

  const handleTemplateChange = (id: string) => {
    setSelectedTemplateId(id);
    const tpl = templates.find(t => t.id === id);
    if (tpl && !customName.trim()) {
      setCustomName(tpl.name);
    }
  };

  const handleCreate = () => {
    if (!selectedTemplateId || !customName.trim() || !ownerId) return;
    onCreateFlow(selectedTemplateId, customName.trim(), ownerId);
    setSelectedTemplateId('');
    setCustomName('');
    setOwnerId('');
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
            <Select value={selectedTemplateId} onValueChange={handleTemplateChange}>
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
            <Label>Titolo del flusso</Label>
            <Input
              placeholder="Es. Onboarding Mario Rossi - Marzo 2025"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Owner del flusso</Label>
            <Select value={ownerId} onValueChange={setOwnerId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleziona responsabile..." />
              </SelectTrigger>
              <SelectContent>
                {profiles.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {getProfileDisplayName(p)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Le singole task erediteranno questo owner, ma potranno essere riassegnate.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annulla</Button>
          <Button onClick={handleCreate} disabled={!selectedTemplateId || !customName.trim() || !ownerId}>
            Crea Flusso
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
