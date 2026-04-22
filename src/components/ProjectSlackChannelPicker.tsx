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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Hash,
  Lock,
  Slack as SlackIcon,
  Loader2,
  X,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
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

type VerifyCode =
  | 'slack_not_connected'
  | 'channel_not_found'
  | 'not_in_channel'
  | 'missing_scope'
  | 'channel_archived'
  | 'slack_api_error'
  | 'no_channel_linked';

interface VerifyResult {
  ok: boolean;
  code?: VerifyCode;
  message?: string;
  slack_error?: string;
  channel?: {
    id: string;
    name: string;
    is_private: boolean;
    is_archived: boolean;
    is_member: boolean;
  };
}

const ERROR_TITLES: Record<VerifyCode, string> = {
  slack_not_connected: 'Slack non collegato',
  channel_not_found: 'Canale non trovato',
  not_in_channel: 'Bot non presente nel canale',
  missing_scope: 'Permessi Slack insufficienti',
  channel_archived: 'Canale archiviato',
  slack_api_error: 'Errore di sincronizzazione Slack',
  no_channel_linked: 'Nessun canale collegato',
};

// Errors that can be solved by reconnecting Slack with more scopes
const SCOPE_RELATED_CODES: VerifyCode[] = [
  'slack_not_connected',
  'missing_scope',
];

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

  // List channels (only when dialog is open)
  const {
    data,
    isFetching,
    refetch,
    error: listError,
  } = useQuery<{ channels: SlackChannel[] }>({
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

  // Verify the currently linked channel (always, when one is set)
  const {
    data: verifyData,
    isFetching: isVerifying,
    refetch: refetchVerify,
  } = useQuery<VerifyResult>({
    queryKey: ['slack-channel-verify', projectId, currentChannelId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        'verify-slack-channel',
        { body: { channel_id: currentChannelId } },
      );
      if (error) {
        return {
          ok: false,
          code: 'slack_api_error',
          message: error.message || 'Errore di verifica',
        } as VerifyResult;
      }
      return data as VerifyResult;
    },
    enabled: !!currentChannelId,
    staleTime: 60 * 1000,
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
      // re-verify with new channel
      setTimeout(() => refetchVerify(), 250);
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

  // Parse list-channels error to show inside dialog with code-aware messaging
  const parsedListError = useMemo(() => {
    if (!listError) return null;
    const raw = (listError as any)?.message || String(listError);
    let code: VerifyCode = 'slack_api_error';
    let message = raw;
    try {
      // supabase.functions.invoke wraps errors as Error with message; try to read .context
      const ctx = (listError as any)?.context;
      if (ctx?.body) {
        const parsed = typeof ctx.body === 'string' ? JSON.parse(ctx.body) : ctx.body;
        if (parsed?.code) code = parsed.code;
        if (parsed?.error) message = parsed.error;
      }
    } catch {
      /* ignore */
    }
    if (/not connected|not configured|slack_not_connected/i.test(raw)) {
      code = 'slack_not_connected';
    } else if (/missing_scope|missing scope/i.test(raw)) {
      code = 'missing_scope';
    }
    return { code, message };
  }, [listError]);

  const verify = verifyData;
  const showVerifyError = !!currentChannelId && verify && !verify.ok;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Canale Slack</p>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {currentChannelId ? (
          <Badge
            variant={showVerifyError ? 'destructive' : 'secondary'}
            className="gap-1.5 px-2 py-1"
          >
            {showVerifyError ? (
              <AlertTriangle className="h-3 w-3" />
            ) : verify?.ok ? (
              <CheckCircle2 className="h-3 w-3" />
            ) : (
              <Hash className="h-3 w-3" />
            )}
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
            {currentChannelId && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => refetchVerify()}
                disabled={isVerifying}
                title="Verifica accesso canale"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${isVerifying ? 'animate-spin' : ''}`}
                />
              </Button>
            )}
          </>
        )}
      </div>

      {/* Inline verify alert (always visible when there is a problem) */}
      {showVerifyError && verify?.code && (
        <Alert variant="destructive" className="mt-1">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{ERROR_TITLES[verify.code]}</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>{verify.message}</p>
            {verify.slack_error && (
              <p className="text-xs opacity-75 font-mono">
                slack: {verify.slack_error}
              </p>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              {SCOPE_RELATED_CODES.includes(verify.code) && (
                <Button asChild size="sm" variant="outline">
                  <a href="/connectors" target="_blank" rel="noreferrer">
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Apri Connettori
                  </a>
                </Button>
              )}
              {(verify.code === 'channel_not_found' ||
                verify.code === 'channel_archived') &&
                canEdit && (
                  <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
                    Cambia canale
                  </Button>
                )}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => refetchVerify()}
                disabled={isVerifying}
              >
                <RefreshCw
                  className={`h-3 w-3 mr-1 ${isVerifying ? 'animate-spin' : ''}`}
                />
                Riprova
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

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

            {parsedListError && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>{ERROR_TITLES[parsedListError.code]}</AlertTitle>
                <AlertDescription className="space-y-2">
                  <p>{parsedListError.message}</p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {SCOPE_RELATED_CODES.includes(parsedListError.code) && (
                      <Button asChild size="sm" variant="outline">
                        <a href="/connectors" target="_blank" rel="noreferrer">
                          <ExternalLink className="h-3 w-3 mr-1" />
                          Apri Connettori
                        </a>
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => refetch()}>
                      <RefreshCw className="h-3 w-3 mr-1" /> Riprova
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {!isFetching && !parsedListError && (
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
                      {c.is_private && (
                        <Badge variant="outline" className="ml-auto text-[10px]">
                          privato
                        </Badge>
                      )}
                    </button>
                  ))
                )}
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Per i canali privati, invita il bot con{' '}
              <code className="text-[11px] bg-muted px-1 py-0.5 rounded">
                /invite @Lovable App
              </code>{' '}
              dal canale Slack.
            </p>
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
