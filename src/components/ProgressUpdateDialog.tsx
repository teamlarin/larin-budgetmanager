import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { publishProgressUpdate } from '@/lib/progressUpdates';

interface ProgressUpdateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
  currentProgress: number;
  onSaved: (newProgress: number) => void;
  clientName?: string;
  projectLeaderId?: string | null;
  accountUserId?: string | null;
  projectBillingType?: string | null;
}

export const ProgressUpdateDialog = ({
  open,
  onOpenChange,
  projectId,
  projectName,
  currentProgress,
  onSaved,
  clientName,
  projectLeaderId,
  accountUserId,
  projectBillingType,
}: ProgressUpdateDialogProps) => {
  const autoProgressTypes = ['recurring', 'pack', 'interno', 'consumptive'];
  const isAutoProgress = !!projectBillingType && autoProgressTypes.includes(projectBillingType);
  const autoProgressLabel = projectBillingType === 'recurring'
    ? "Calcolato in base all'avanzamento temporale"
    : projectBillingType === 'pack'
      ? 'Calcolato in base alle ore confermate'
      : 'Progresso non applicabile per questa tipologia';
  const [progress, setProgress] = useState(currentProgress);
  const [updateText, setUpdateText] = useState('');
  const [roadblocksText, setRoadblocksText] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setProgress(currentProgress);
      setUpdateText('');
      setRoadblocksText('');
    }
  }, [open, currentProgress]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { newProgress } = await publishProgressUpdate({
        projectId,
        projectName,
        progress,
        updateText,
        roadblocksText,
        clientName,
        projectLeaderId,
        accountUserId,
        projectBillingType,
      });
      toast.success('Progresso aggiornato');
      onSaved(newProgress);
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error saving progress update:', error);
      toast.error(error?.message || "Errore nell'aggiornamento del progresso");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Aggiorna progresso</DialogTitle>
          <p className="text-sm text-muted-foreground truncate">{projectName}</p>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="progress">Progresso (%)</Label>
            <Input
              id="progress"
              type="number"
              min={0}
              max={100}
              value={progress}
              onChange={(e) => setProgress(Number(e.target.value))}
              autoFocus={!isAutoProgress}
              disabled={isAutoProgress}
            />
            {isAutoProgress && (
              <p className="text-xs text-muted-foreground">{autoProgressLabel}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="update">Update</Label>
            <Textarea
              id="update"
              placeholder="Descrivi lo stato di avanzamento..."
              value={updateText}
              onChange={(e) => setUpdateText(e.target.value)}
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="roadblocks">Roadblocks</Label>
            <Textarea
              id="roadblocks"
              placeholder="Eventuali blocchi o criticità..."
              value={roadblocksText}
              onChange={(e) => setRoadblocksText(e.target.value)}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Salvataggio...' : 'Salva'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
