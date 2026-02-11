import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ProgressUpdateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
  currentProgress: number;
  onSaved: (newProgress: number) => void;
}

export const ProgressUpdateDialog = ({
  open,
  onOpenChange,
  projectId,
  projectName,
  currentProgress,
  onSaved,
}: ProgressUpdateDialogProps) => {
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
    const newProgress = Math.max(0, Math.min(100, progress));
    setIsSaving(true);
    try {
      // Update project progress
      const { error: projectError } = await supabase
        .from('projects')
        .update({ progress: newProgress })
        .eq('id', projectId);

      if (projectError) throw projectError;

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Utente non autenticato');

      // Save progress update entry if there's text
      if (updateText.trim() || roadblocksText.trim()) {
        const { error: updateError } = await supabase
          .from('project_progress_updates')
          .insert({
            project_id: projectId,
            user_id: user.id,
            progress_value: newProgress,
            update_text: updateText.trim() || null,
            roadblocks_text: roadblocksText.trim() || null,
          });

        if (updateError) throw updateError;
      }

      toast.success('Progresso aggiornato');
      onSaved(newProgress);
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving progress update:', error);
      toast.error("Errore nell'aggiornamento del progresso");
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
              autoFocus
            />
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
