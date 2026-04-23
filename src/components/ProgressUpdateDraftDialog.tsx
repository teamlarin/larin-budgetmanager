import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Hash, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { publishProgressUpdate } from '@/lib/progressUpdates';

export interface ProgressUpdateDraft {
  id: string;
  project_id: string;
  draft_content: string;
  slack_messages_count: number | null;
  drive_docs_count?: number | null;
  gmail_messages_count?: number | null;
  sources_used?: string[] | null;
  week_start: string;
  status: 'pending' | 'published' | 'discarded';
  created_at: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: ProgressUpdateDraft | null;
  projectName: string;
  slackChannelName?: string | null;
  currentProgress: number;
  clientName?: string | null;
  projectLeaderId?: string | null;
  accountUserId?: string | null;
  projectBillingType?: string | null;
  onPublished?: () => void;
  onDiscarded?: () => void;
}

const AUTO_PROGRESS_TYPES = ['recurring', 'pack', 'interno', 'consumptive'];

export const ProgressUpdateDraftDialog = ({
  open,
  onOpenChange,
  draft,
  projectName,
  slackChannelName,
  currentProgress,
  clientName,
  projectLeaderId,
  accountUserId,
  projectBillingType,
  onPublished,
  onDiscarded,
}: Props) => {
  const [progress, setProgress] = useState<number>(currentProgress);
  const [updateText, setUpdateText] = useState<string>('');
  const [roadblocksText, setRoadblocksText] = useState<string>('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [isDiscarding, setIsDiscarding] = useState(false);

  const isAutoProgress = !!projectBillingType
    && AUTO_PROGRESS_TYPES.includes(projectBillingType);

  useEffect(() => {
    if (open && draft) {
      setProgress(currentProgress);
      setUpdateText(draft.draft_content);
      setRoadblocksText('');
    }
  }, [open, draft, currentProgress]);

  if (!draft) return null;

  const handlePublish = async () => {
    setIsPublishing(true);
    try {
      const { progressUpdateId } = await publishProgressUpdate({
        projectId: draft.project_id,
        projectName,
        progress,
        updateText,
        roadblocksText,
        clientName,
        projectLeaderId,
        accountUserId,
        projectBillingType,
      });

      const { data: { user } } = await supabase.auth.getUser();
      const { error: draftErr } = await supabase
        .from('project_update_drafts')
        .update({
          status: 'published',
          published_progress_update_id: progressUpdateId,
          reviewed_at: new Date().toISOString(),
          reviewed_by: user?.id,
        })
        .eq('id', draft.id);
      if (draftErr) throw draftErr;

      toast.success('Progress update pubblicato');
      onPublished?.();
      onOpenChange(false);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Errore nella pubblicazione');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleDiscard = async () => {
    setIsDiscarding(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('project_update_drafts')
        .update({
          status: 'discarded',
          reviewed_at: new Date().toISOString(),
          reviewed_by: user?.id,
        })
        .eq('id', draft.id);
      if (error) throw error;
      toast.success('Bozza scartata');
      onDiscarded?.();
      onOpenChange(false);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Errore nello scarto');
    } finally {
      setIsDiscarding(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Bozza Progress Update
          </DialogTitle>
          <div className="space-y-1.5 pt-1">
            <p className="text-sm font-medium truncate">{projectName}</p>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className="text-xs">
                {format(new Date(draft.created_at), "d MMM yyyy", { locale: it })}
              </Badge>
              {slackChannelName && (
                <Badge variant="outline" className="text-xs gap-1">
                  <Hash className="h-3 w-3" />
                  {slackChannelName}
                </Badge>
              )}
              {(() => {
                const parts: string[] = [];
                if (draft.slack_messages_count) parts.push(`${draft.slack_messages_count} Slack`);
                if (draft.drive_docs_count) parts.push(`${draft.drive_docs_count} Meet`);
                if (draft.gmail_messages_count) parts.push(`${draft.gmail_messages_count} email`);
                if (parts.length === 0) return null;
                return (
                  <span className="text-xs text-muted-foreground">
                    Generata da {parts.join(' · ')}
                  </span>
                );
              })()}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="draft-progress">Progresso (%)</Label>
            <Input
              id="draft-progress"
              type="number"
              min={0}
              max={100}
              value={progress}
              onChange={(e) => setProgress(Number(e.target.value))}
              disabled={isAutoProgress}
            />
            {isAutoProgress && (
              <p className="text-xs text-muted-foreground">
                Progresso calcolato automaticamente per questa tipologia di progetto
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="draft-update">Update</Label>
            <Textarea
              id="draft-update"
              value={updateText}
              onChange={(e) => setUpdateText(e.target.value)}
              rows={6}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Modifica liberamente prima di pubblicare. L'AI può sbagliare.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="draft-roadblocks">Roadblocks</Label>
            <Textarea
              id="draft-roadblocks"
              placeholder="Eventuali blocchi o criticità (opzionale)..."
              value={roadblocksText}
              onChange={(e) => setRoadblocksText(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="ghost"
            onClick={handleDiscard}
            disabled={isPublishing || isDiscarding}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Scarta bozza
          </Button>
          <Button
            onClick={handlePublish}
            disabled={isPublishing || isDiscarding || !updateText.trim()}
          >
            {isPublishing ? 'Pubblicazione...' : 'Pubblica update'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
