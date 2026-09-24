import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sparkles, Hash, Plus, Trash2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { publishProgressUpdate } from '@/lib/progressUpdates';
import {
  HEALTH_OPTIONS,
  ROADBLOCK_TYPE_OPTIONS,
  ROADBLOCK_TYPE_LABELS,
  daysOpen,
  type NewRoadblockInput,
  type ProjectUpdateHealth,
  type RoadblockType,
} from '@/lib/projectRoadblocks';
import { useProjectRoadblocks } from '@/hooks/useProjectRoadblocks';

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

interface SuggestedRoadblock {
  description: string;
  blocker_type: RoadblockType;
  waiting_on_who?: string | null;
  waiting_on_what?: string | null;
}

interface DraftRow {
  id: string;
  draft_content: string;
  suggested_health: ProjectUpdateHealth | null;
  suggested_roadblocks: SuggestedRoadblock[];
  slack_messages_count: number | null;
  drive_docs_count: number | null;
  gmail_messages_count: number | null;
  created_at: string;
}


const emptyRoadblock = (): NewRoadblockInput => ({
  description: '',
  blocker_type: 'informazioni',
  waiting_on_who: '',
  waiting_on_what: '',
});

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
  const [healthStatus, setHealthStatus] = useState<ProjectUpdateHealth>('in_linea');
  const [newRoadblocks, setNewRoadblocks] = useState<NewRoadblockInput[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [draftApplied, setDraftApplied] = useState(false);
  const [draftDismissed, setDraftDismissed] = useState(false);
  const [usedSuggestions, setUsedSuggestions] = useState<number[]>([]);

  const { openRoadblocks } = useProjectRoadblocks(projectId);

  const { data: draft } = useQuery<DraftRow | null>({
    queryKey: ['progress-update-draft', projectId],
    enabled: open && !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_update_drafts')
        .select('id, draft_content, suggested_health, suggested_roadblocks, slack_messages_count, drive_docs_count, gmail_messages_count, created_at')
        .eq('project_id', projectId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const raw = data as any;
      return {
        ...raw,
        suggested_roadblocks: Array.isArray(raw.suggested_roadblocks)
          ? (raw.suggested_roadblocks as SuggestedRoadblock[])
          : [],
      } as DraftRow;
    },
  });

  const suggestedRoadblocks = draft?.suggested_roadblocks || [];

  useEffect(() => {
    if (open) {
      setProgress(currentProgress);
      setUpdateText('');
      setNewRoadblocks([]);
      setDraftApplied(false);
      setDraftDismissed(false);
      setUsedSuggestions([]);
    }
  }, [open, currentProgress]);

  const hasBlockers = openRoadblocks.length > 0 || newRoadblocks.some(r => r.description.trim());

  // Con blocchi aperti lo stato non può restare "In linea"
  useEffect(() => {
    if (open && hasBlockers && healthStatus === 'in_linea') {
      setHealthStatus('attenzione');
    }
  }, [open, hasBlockers, healthStatus]);

  const addSuggestedRoadblock = (index: number) => {
    const suggestion = suggestedRoadblocks[index];
    if (!suggestion) return;
    setNewRoadblocks(prev => [
      ...prev,
      {
        description: suggestion.description,
        blocker_type: suggestion.blocker_type,
        waiting_on_who: suggestion.waiting_on_who || '',
        waiting_on_what: suggestion.waiting_on_what || '',
      },
    ]);
    setUsedSuggestions(prev => [...prev, index]);
  };

  const handleUseDraft = () => {
    if (!draft) return;
    setUpdateText(draft.draft_content || '');
    if (draft.suggested_health) setHealthStatus(draft.suggested_health);
    if (suggestedRoadblocks.length > 0) {
      setNewRoadblocks(prev => [
        ...prev,
        ...suggestedRoadblocks.map(s => ({
          description: s.description,
          blocker_type: s.blocker_type,
          waiting_on_who: s.waiting_on_who || '',
          waiting_on_what: s.waiting_on_what || '',
        })),
      ]);
      setUsedSuggestions(suggestedRoadblocks.map((_, i) => i));
    }
    setDraftApplied(true);
  };

  const handleUseSummaryOnly = () => {
    if (!draft) return;
    setUpdateText(draft.draft_content || '');
    setDraftApplied(true);
  };

  const markDraft = async (status: 'dismissed' | 'superseded' | 'published', progressUpdateId?: string) => {
    if (!draft?.id) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase
        .from('project_update_drafts')
        .update({
          status,
          published_progress_update_id: progressUpdateId ?? null,
          reviewed_at: new Date().toISOString(),
          reviewed_by: user?.id,
        })
        .eq('id', draft.id);
      queryClient.invalidateQueries({ queryKey: ['progress-update-draft', projectId] });
    } catch (e) {
      console.warn('Could not update draft status:', e);
    }
  };

  const handleDismissDraft = async () => {
    setDraftDismissed(true);
    await markDraft('dismissed');
    toast.success('Bozza scartata');
  };


  const updateRoadblock = (index: number, patch: Partial<NewRoadblockInput>) => {
    setNewRoadblocks(prev => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { newProgress, progressUpdateId } = await publishProgressUpdate({
        projectId,
        projectName,
        progress,
        updateText,
        healthStatus,
        newRoadblocks: newRoadblocks.filter(r => r.description.trim()),
        clientName,
        projectLeaderId,
        accountUserId,
        projectBillingType,
      });

      // Archivia la bozza: pubblicata se usata, superata se ignorata
      if (draft?.id && !draftDismissed) {
        await markDraft(draftApplied ? 'published' : 'superseded', progressUpdateId);
      }


      queryClient.invalidateQueries({ queryKey: ['project-roadblocks', projectId] });
      toast.success('Aggiornamento pubblicato');
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
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuovo aggiornamento</DialogTitle>
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
            <Label>Stato di salute</Label>
            <div className="grid grid-cols-3 gap-2">
              {HEALTH_OPTIONS.map(option => {
                const isSelected = healthStatus === option.value;
                const isDisabled = hasBlockers && option.value === 'in_linea';
                return (
                  <button
                    key={option.value}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => setHealthStatus(option.value)}
                    className={`rounded-md border p-2 text-left transition-colors ${
                      isSelected ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
                    } ${isDisabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                  >
                    <span className="flex items-center gap-1.5 text-xs font-medium">
                      <span className={`h-2.5 w-2.5 rounded-full ${option.dot}`} />
                      {option.label}
                    </span>
                    <span className="mt-1 block text-[10px] leading-tight text-muted-foreground">
                      {option.description}
                    </span>
                  </button>
                );
              })}
            </div>
            {hasBlockers && (
              <p className="text-xs text-muted-foreground">
                Ci sono blocchi aperti: lo stato non può essere "In linea".
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="progress">Progresso (%)</Label>
            <Input
              id="progress"
              type="number"
              min={0}
              max={100}
              value={progress}
              onChange={(e) => setProgress(Number(e.target.value))}
              disabled={isAutoProgress}
            />
            {isAutoProgress && (
              <p className="text-xs text-muted-foreground">{autoProgressLabel}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="update">Sintesi</Label>
            <Textarea
              id="update"
              placeholder="Dove siamo, come procede il rapporto con il cliente e l'andamento rispetto all'obiettivo (meglio con numeri)..."
              value={updateText}
              onChange={(e) => setUpdateText(e.target.value)}
              rows={draftApplied ? 6 : 4}
            />
          </div>

          {openRoadblocks.length > 0 && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 space-y-2">
              <p className="text-xs font-medium text-destructive flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Blocchi già aperti ({openRoadblocks.length})
              </p>
              <ul className="space-y-1">
                {openRoadblocks.map(rb => (
                  <li key={rb.id} className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{ROADBLOCK_TYPE_LABELS[rb.blocker_type]}</span>
                    {' · '}{rb.description}
                    {' · '}aperto da {daysOpen(rb.opened_at)} g
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Nuovi roadblock</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setNewRoadblocks(prev => [...prev, emptyRoadblock()])}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Aggiungi blocco
              </Button>
            </div>

            {newRoadblocks.map((rb, index) => (
              <div key={index} className="rounded-md border p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <Textarea
                    placeholder="Cosa sta bloccando il lavoro..."
                    value={rb.description}
                    onChange={(e) => updateRoadblock(index, { description: e.target.value })}
                    rows={2}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => setNewRoadblocks(prev => prev.filter((_, i) => i !== index))}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <Select
                    value={rb.blocker_type}
                    onValueChange={(v) => updateRoadblock(index, { blocker_type: v as RoadblockType })}
                  >
                    <SelectTrigger className="text-xs">
                      <SelectValue placeholder="Tipo di blocco" />
                    </SelectTrigger>
                    <SelectContent>
                      {ROADBLOCK_TYPE_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="In attesa di (chi)"
                    value={rb.waiting_on_who || ''}
                    onChange={(e) => updateRoadblock(index, { waiting_on_who: e.target.value })}
                    className="text-xs"
                  />
                  <Input
                    placeholder="Su cosa"
                    value={rb.waiting_on_what || ''}
                    onChange={(e) => updateRoadblock(index, { waiting_on_what: e.target.value })}
                    className="text-xs"
                  />
                </div>
              </div>
            ))}
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
