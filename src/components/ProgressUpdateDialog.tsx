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
  clientName?: string;
  projectLeaderId?: string | null;
  accountUserId?: string | null;
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

      // Get user profile for Slack notification
      const { data: profile } = await supabase
        .from('profiles')
        .select('first_name, last_name')
        .eq('id', user.id)
        .maybeSingle();

      const userName = profile?.first_name
        ? `${profile.first_name}${profile.last_name ? ' ' + profile.last_name : ''}`
        : undefined;

      // Always save progress update entry to track every change
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

      // Fetch project leader and account names for Slack
      let projectLeaderName: string | undefined;
      let accountName: string | undefined;

      if (projectLeaderId) {
        const { data: leaderProfile } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('id', projectLeaderId)
          .maybeSingle();
        if (leaderProfile?.first_name) {
          projectLeaderName = `${leaderProfile.first_name}${leaderProfile.last_name ? ' ' + leaderProfile.last_name : ''}`;
        }
      }

      if (accountUserId) {
        const { data: accountProfile } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('id', accountUserId)
          .maybeSingle();
        if (accountProfile?.first_name) {
          accountName = `${accountProfile.first_name}${accountProfile.last_name ? ' ' + accountProfile.last_name : ''}`;
        }
      }

      // Send Slack notification (fire-and-forget)
      supabase.functions.invoke('send-slack-notification', {
        body: {
          project_name: projectName,
          progress: newProgress,
          update_text: updateText.trim() || undefined,
          roadblocks_text: roadblocksText.trim() || undefined,
          user_name: userName,
          client_name: clientName || undefined,
          project_leader_name: projectLeaderName,
          account_name: accountName,
        },
      }).then(({ error }) => {
        if (error) console.error('Slack notification error:', error);
      });

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
