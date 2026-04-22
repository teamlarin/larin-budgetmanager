import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Sparkles, Hash, Loader2, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { toast } from 'sonner';
import { useRolePermissions } from '@/hooks/useRolePermissions';
import {
  ProgressUpdateDraftDialog,
  type ProgressUpdateDraft,
} from '@/components/ProgressUpdateDraftDialog';

interface Props {
  projectId: string;
  projectName: string;
  slackChannelName?: string | null;
  currentProgress: number;
  clientName?: string | null;
  projectLeaderId?: string | null;
  accountUserId?: string | null;
  projectBillingType?: string | null;
  onPublished?: () => void;
}

export const ProgressUpdateDraftBanner = ({
  projectId,
  projectName,
  slackChannelName,
  currentProgress,
  clientName,
  projectLeaderId,
  accountUserId,
  projectBillingType,
  onPublished,
}: Props) => {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const { isAdmin } = useRolePermissions();

  const { data: draft } = useQuery<ProgressUpdateDraft | null>({
    queryKey: ['progress-update-draft', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_update_drafts')
        .select('*')
        .eq('project_id', projectId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as ProgressUpdateDraft | null) || null;
    },
  });

  // Auto-open from notification deep-link (?draft=<id> or ?openDraft=1)
  useEffect(() => {
    const draftParam = searchParams.get('draft');
    const openParam = searchParams.get('openDraft');
    if (draft && (openParam === '1' || (draftParam && draftParam === draft.id))) {
      setDialogOpen(true);
    }
  }, [draft, searchParams]);

  const handleClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open && (searchParams.get('draft') || searchParams.get('openDraft'))) {
      const next = new URLSearchParams(searchParams);
      next.delete('draft');
      next.delete('openDraft');
      setSearchParams(next, { replace: true });
    }
  };

  const handlePublished = () => {
    queryClient.invalidateQueries({ queryKey: ['progress-update-draft', projectId] });
    queryClient.invalidateQueries({ queryKey: ['project-progress-updates', projectId] });
    onPublished?.();
  };

  const handleDiscarded = () => {
    queryClient.invalidateQueries({ queryKey: ['progress-update-draft', projectId] });
  };

  const handleGenerateNow = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        'generate-slack-progress-drafts',
        { body: { projectId, force: true } },
      );
      if (error) throw error;
      const stats = (data as any)?.stats;
      if (stats?.drafts_created > 0) {
        toast.success('Bozza generata!', {
          description: 'Aggiorno il banner...',
        });
        await queryClient.invalidateQueries({
          queryKey: ['progress-update-draft', projectId],
        });
      } else if (stats?.skipped_already_updated > 0) {
        toast.info('Update già pubblicato questa settimana');
      } else if (stats?.skipped_no_messages > 0) {
        toast.info('Pochi messaggi nel canale Slack negli ultimi 7 giorni');
      } else if (stats?.errors?.length > 0) {
        toast.error('Errore generazione', {
          description: stats.errors[0].error,
        });
      } else {
        toast.info('Nessuna bozza generata');
      }
    } catch (err: any) {
      toast.error('Errore', {
        description: err?.message || 'Generazione fallita',
      });
    } finally {
      setGenerating(false);
    }
  };

  // Admin-only manual trigger when no draft exists
  if (!draft) {
    if (!isAdmin || !slackChannelName) return null;
    return (
      <Card className="mb-4 border-dashed border-muted-foreground/30 bg-muted/20">
        <div className="p-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Wand2 className="h-3.5 w-3.5" />
            <span>Nessuna bozza AI · canale</span>
            <span className="inline-flex items-center gap-0.5 font-medium text-foreground">
              <Hash className="h-3 w-3" />{slackChannelName}
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleGenerateNow}
            disabled={generating}
          >
            {generating ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Generazione...
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" />
                Genera bozza ora
              </>
            )}
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card className="mb-4 border-primary/40 bg-primary/5">
        <div className="p-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div className="space-y-0.5">
              <p className="text-sm font-medium">
                Bozza AI pronta per il progress update
              </p>
              <p className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                <span>
                  {format(new Date(draft.created_at), "d MMM yyyy", { locale: it })}
                </span>
                {draft.slack_messages_count != null && (
                  <span>· {draft.slack_messages_count} messaggi Slack analizzati</span>
                )}
                {slackChannelName && (
                  <span className="inline-flex items-center gap-1">
                    · <Hash className="h-3 w-3" />{slackChannelName}
                  </span>
                )}
              </p>
            </div>
          </div>
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            Apri bozza →
          </Button>
        </div>
      </Card>

      <ProgressUpdateDraftDialog
        open={dialogOpen}
        onOpenChange={handleClose}
        draft={draft}
        projectName={projectName}
        slackChannelName={slackChannelName}
        currentProgress={currentProgress}
        clientName={clientName}
        projectLeaderId={projectLeaderId}
        accountUserId={accountUserId}
        projectBillingType={projectBillingType}
        onPublished={handlePublished}
        onDiscarded={handleDiscarded}
      />
    </>
  );
};
