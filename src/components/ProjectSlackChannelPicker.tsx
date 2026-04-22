import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Hash, Lock, Slack as SlackIcon, Loader2, X, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SlackChannel {
  id: string;
  name: string;
  is_private: boolean;
  is_archived?: boolean;
}

interface Props {
  projectId: string;
  currentChannelId?: string | null;
  currentChannelName?: string | null;
  canEdit: boolean;
  onUpdated?: () => void;
}

export const ProjectSlackChannelPicker = ({
  projectId,
  currentChannelId,
  currentChannelName,
  canEdit,
  onUpdated,
}: Props) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  const { data, isFetching, refetch, error } = useQuery<{ channels: SlackChannel[] }>({
    queryKey: ['slack-channels'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('list-slack-channels');
      if (error) throw error;
      return data as { channels: SlackChannel[] };
    },
    enabled: open,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const filtered = useMemo(() => {
    const list = data?.channels || [];
    const q = search.trim().toLowerCase();
    if (!q) return list.slice(0, 200);
    return list.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 200);
  }, [data, search]);

  useEffect(() => {
    if (!open) setSearch('');
  }, [open]);

  const handleSelect = async (channel: SlackChannel) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('projects')
        .update({
          slack_channel_id: channel.id,
          slack_channel_name: channel.name,
        })
        .eq('id', projectId);
      if (error) throw error;
      toast.success(`Canale Slack collegato: #${channel.name}`);
      setOpen(false);
      onUpdated?.();
    } catch (err: any) {
      toast.error(err.message || 'Errore nel collegamento del canale');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('projects')
        .update({ slack_channel_id: null, slack_channel_name: null })
        .eq('id', projectId);
      if (error) throw error;
      toast.success('Canale Slack scollegato');
      onUpdated?.();
    } catch (err: any) {
      toast.error(err.message || 'Errore nello scollegamento');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Canale Slack</p>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {currentChannelId ? (
          <Badge variant="secondary" className="gap-1.5 px-2 py-1">
            <Hash className="h-3 w-3" />
            {currentChannelName || currentChannelId}
          </Badge>
        ) : (
          <span className="text-sm text-muted-foreground italic">
            Nessun canale collegato
          </span>
        )}
        {canEdit && (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setOpen(true)}
              disabled={saving}
            >
              <SlackIcon className="h-4 w-4 mr-1" />
              {currentChannelId ? 'Cambia canale' : 'Collega canale'}
            </Button>
            {currentChannelId && (
              <Button
                size="sm"
                variant="ghost"
                onClick={handleRemove}
                disabled={saving}
              >
                <X className="h-4 w-4 mr-1" />
                Rimuovi
              </Button>
            )}
          </>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SlackIcon className="h-4 w-4" />
              Seleziona canale Slack
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <Input
              placeholder="Cerca canale..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />

            {isFetching && (
              <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Caricamento canali...
              </div>
            )}

            {error && (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm space-y-2">
                <p className="text-destructive font-medium">
                  Impossibile caricare i canali
                </p>
                <p className="text-muted-foreground">
                  {(error as any)?.message ||
                    'Verifica che Slack sia collegato in Connettori con i permessi di lettura canali.'}
                </p>
                <Button size="sm" variant="outline" onClick={() => refetch()}>
                  <RefreshCw className="h-3 w-3 mr-1" /> Riprova
                </Button>
              </div>
            )}

            {!isFetching && !error && (
              <div className="max-h-72 overflow-y-auto border rounded-md divide-y">
                {filtered.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-4 text-center">
                    Nessun canale trovato
                  </p>
                ) : (
                  filtered.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleSelect(c)}
                      disabled={saving}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-left transition-colors disabled:opacity-50"
                    >
                      {c.is_private ? (
                        <Lock className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      ) : (
                        <Hash className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      )}
                      <span className="font-medium truncate">{c.name}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Annulla
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
