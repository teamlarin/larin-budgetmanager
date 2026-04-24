import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Sparkles, Hash } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
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
  slackChannelName?: string | null;
}

interface DraftRow {
  id: string;
  draft_content: string;
  slack_messages_count: number | null;
  drive_docs_count: number | null;
  gmail_messages_count: number | null;
  created_at: string;
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
  slackChannelName,
}: ProgressUpdateDialogProps) => {
  const queryClient = useQueryClient();
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
  const [draftApplied, setDraftApplied] = useState(false);

  const { data: draft } = useQuery<DraftRow | null>({
    queryKey: ['progress-update-draft', projectId],
    enabled: open && !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_update_drafts')
        .select('id, draft_content, slack_messages_count, drive_docs_count, gmail_messages_count, created_at')
        .eq('project_id', projectId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as DraftRow | null) || null;
    },
  });

  useEffect(() => {
    if (open) {
      setProgress(currentProgress);
      setUpdateText('');
      setRoadblocksText('');
      setDraftApplied(false);
    }
  }, [open, currentProgress]);

  const handleUseDraft = () => {
    if (!draft) return;
    setUpdateText(draft.draft_content || '');
    setDraftApplied(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { newProgress, progressUpdateId } = await publishProgressUpdate({
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

      // If user used the AI draft, mark it as published so it doesn't reappear
      if (draftApplied && draft?.id) {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          await supabase
            .from('project_update_drafts')
            .update({
              status: 'published',
              published_progress_update_id: progressUpdateId,
              reviewed_at: new Date().toISOString(),
              reviewed_by: user?.id,
            })
            .eq('id', draft.id);
          queryClient.invalidateQueries({ queryKey: ['progress-update-draft', projectId] });
        } catch (e) {
          console.warn('Could not mark draft as published:', e);
        }
      }

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

  const draftSourcesLabel = (() => {
    if (!draft) return null;
    const parts: string[] = [];
    if (draft.slack_messages_count) parts.push(`${draft.slack_messages_count} Slack`);
    if (draft.drive_docs_count) parts.push(`${draft.drive_docs_count} Meet`);
    if (draft.gmail_messages_count) parts.push(`${draft.gmail_messages_count} email`);
    return parts.length > 0 ? parts.join(' · ') : null;
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Aggiorna progresso</DialogTitle>
          <p className="text-sm text-muted-foreground truncate">{projectName}</p>
        </DialogHeader>

        {draft && (
          <div className="rounded-md border border-primary/40 bg-primary/5 p-3 space-y-2">
            <div className="flex items-start gap-2">
              <Sparkles className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0 space-y-0.5">
                <p className="text-sm font-medium">
                  {draftApplied ? 'Bozza AI applicata' : 'Bozza AI disponibile'}
                </p>
                <p className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
                  <span>{format(new Date(draft.created_at), "d MMM yyyy", { locale: it })}</span>
                  {draftSourcesLabel && <span>· {draftSourcesLabel}</span>}
                  {slackChannelName && (
                    <span className="inline-flex items-center gap-0.5">
                      · <Hash className="h-3 w-3" />{slackChannelName}
                    </span>
                  )}
                </p>
              </div>
              {!draftApplied && (
                <Button size="sm" variant="outline" onClick={handleUseDraft}>
                  Usa bozza
                </Button>
              )}
            </div>
          </div>
        )}

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
              rows={draftApplied ? 6 : 3}
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
