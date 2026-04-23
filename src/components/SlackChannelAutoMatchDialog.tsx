import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Loader2,
  Sparkles,
  AlertTriangle,
  Hash,
  Lock,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';

interface Candidate {
  channel_id: string;
  channel_name: string;
  is_private: boolean;
  score: number;
  confidence: 'high' | 'medium' | 'low' | 'none';
}

interface Suggestion {
  project_id: string;
  project_name: string;
  client_name: string | null;
  project_type: string | null;
  candidates: Candidate[];
  best_confidence: 'high' | 'medium' | 'low' | 'none';
}

interface Selection {
  enabled: boolean;
  channel_id: string | null;
  channel_name: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAfterSave?: () => void;
}

const CONF_BADGE: Record<
  Candidate['confidence'],
  { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }
> = {
  high: { label: 'alta', variant: 'default' },
  medium: { label: 'media', variant: 'secondary' },
  low: { label: 'bassa', variant: 'outline' },
  none: { label: '—', variant: 'outline' },
};

export const SlackChannelAutoMatchDialog = ({
  open,
  onOpenChange,
  onAfterSave,
}: Props) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [totals, setTotals] = useState<{ projects: number; channels: number } | null>(
    null,
  );
  const [selections, setSelections] = useState<Record<string, Selection>>({});
  const [search, setSearch] = useState('');
  const [filterConf, setFilterConf] = useState<{
    high: boolean;
    medium: boolean;
    low: boolean;
    none: boolean;
  }>({ high: true, medium: true, low: false, none: false });
  const [saving, setSaving] = useState(false);

  const loadSuggestions = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: invokeErr } = await supabase.functions.invoke(
        'suggest-slack-channels-for-projects',
        { body: {} },
      );
      if (invokeErr) throw new Error(invokeErr.message);
      if (!data?.ok) {
        throw new Error(data?.error || 'Errore di analisi');
      }
      const sugg = (data.suggestions || []) as Suggestion[];
      setSuggestions(sugg);
      setTotals({ projects: data.total_projects, channels: data.total_channels });

      // Pre-select high-confidence top candidates
      const initial: Record<string, Selection> = {};
      for (const s of sugg) {
        const top = s.candidates[0];
        const isHigh = s.best_confidence === 'high';
        initial[s.project_id] = {
          enabled: !!top && isHigh,
          channel_id: top?.channel_id ?? null,
          channel_name: top?.channel_name ?? null,
        };
      }
      setSelections(initial);
    } catch (e: any) {
      setError(e.message || 'Errore imprevisto');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadSuggestions();
    } else {
      setSuggestions([]);
      setSelections({});
      setSearch('');
      setError(null);
      setTotals(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return suggestions.filter((s) => {
      if (!filterConf[s.best_confidence]) return false;
      if (!q) return true;
      return (
        s.project_name.toLowerCase().includes(q) ||
        (s.client_name || '').toLowerCase().includes(q) ||
        s.candidates.some((c) => c.channel_name.toLowerCase().includes(q))
      );
    });
  }, [suggestions, search, filterConf]);

  const selectedCount = useMemo(
    () =>
      Object.values(selections).filter(
        (s) => s.enabled && s.channel_id,
      ).length,
    [selections],
  );

  const toggleAll = (enabled: boolean) => {
    setSelections((prev) => {
      const next = { ...prev };
      for (const s of filtered) {
        if (next[s.project_id] && next[s.project_id].channel_id) {
          next[s.project_id] = { ...next[s.project_id], enabled };
        }
      }
      return next;
    });
  };

  const updateChannel = (
    projectId: string,
    channelId: string,
    channelName: string,
  ) => {
    setSelections((prev) => ({
      ...prev,
      [projectId]: { enabled: true, channel_id: channelId, channel_name: channelName },
    }));
  };

  const toggleEnabled = (projectId: string, enabled: boolean) => {
    setSelections((prev) => ({
      ...prev,
      [projectId]: { ...prev[projectId], enabled },
    }));
  };

  const handleSave = async () => {
    const toSave = Object.entries(selections).filter(
      ([, sel]) => sel.enabled && sel.channel_id && sel.channel_name,
    );
    if (toSave.length === 0) {
      toast.info('Nessuna associazione selezionata');
      return;
    }
    setSaving(true);
    let ok = 0;
    let fail = 0;
    // Run in chunks of 10 in parallel
    const chunks: typeof toSave[] = [];
    for (let i = 0; i < toSave.length; i += 10) {
      chunks.push(toSave.slice(i, i + 10));
    }
    for (const chunk of chunks) {
      const results = await Promise.all(
        chunk.map(([projectId, sel]) =>
          supabase
            .from('projects')
            .update({
              slack_channel_id: sel.channel_id,
              slack_channel_name: sel.channel_name,
            })
            .eq('id', projectId)
            .then(({ error }) => ({ projectId, error })),
        ),
      );
      for (const r of results) {
        if (r.error) {
          fail += 1;
          console.error('Update failed for', r.projectId, r.error);
        } else {
          ok += 1;
        }
      }
    }
    setSaving(false);
    if (fail === 0) {
      toast.success(`${ok} canali Slack associati con successo`);
    } else {
      toast.warning(`${ok} salvati, ${fail} errori — controlla la console`);
    }
    onAfterSave?.();
    // Remove saved projects from the local list
    setSuggestions((prev) =>
      prev.filter((s) => !(selections[s.project_id]?.enabled && selections[s.project_id]?.channel_id)),
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Auto-associa canali Slack ai progetti
          </DialogTitle>
          <DialogDescription>
            Suggerimenti basati sul nome del cliente e sulle parole chiave del progetto.
            Rivedi e conferma prima di salvare.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p className="text-sm">
              Analisi canali Slack e progetti in corso…
            </p>
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Errore</AlertTitle>
            <AlertDescription className="space-y-2">
              <p>{error}</p>
              <Button size="sm" variant="outline" onClick={loadSuggestions}>
                <RefreshCw className="h-3 w-3 mr-1" /> Riprova
              </Button>
            </AlertDescription>
          </Alert>
        ) : (
          <>
            {totals && (
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="text-muted-foreground">
                  {totals.projects} progetti senza canale · {totals.channels} canali Slack
                </span>
                <Button size="sm" variant="ghost" onClick={loadSuggestions}>
                  <RefreshCw className="h-3 w-3 mr-1" /> Ricalcola
                </Button>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <Input
                placeholder="Cerca progetto, cliente o canale…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 min-w-[200px]"
              />
              <div className="flex flex-wrap items-center gap-3 text-xs">
                {(['high', 'medium', 'low', 'none'] as const).map((k) => (
                  <label key={k} className="flex items-center gap-1.5 cursor-pointer">
                    <Checkbox
                      checked={filterConf[k]}
                      onCheckedChange={(v) =>
                        setFilterConf((p) => ({ ...p, [k]: !!v }))
                      }
                    />
                    {k === 'high' && 'alta'}
                    {k === 'medium' && 'media'}
                    {k === 'low' && 'bassa'}
                    {k === 'none' && 'nessun match'}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>{filtered.length} progetti visibili</span>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => toggleAll(true)}>
                  Seleziona tutti
                </Button>
                <Button size="sm" variant="ghost" onClick={() => toggleAll(false)}>
                  Deseleziona tutti
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto border rounded-md divide-y min-h-[200px]">
              {filtered.length === 0 ? (
                <p className="text-sm text-muted-foreground p-8 text-center">
                  {suggestions.length === 0
                    ? 'Nessun progetto senza canale Slack 🎉'
                    : 'Nessun progetto corrisponde ai filtri attuali'}
                </p>
              ) : (
                filtered.map((s) => {
                  const sel = selections[s.project_id];
                  const top = s.candidates[0];
                  const conf = CONF_BADGE[s.best_confidence];
                  return (
                    <div
                      key={s.project_id}
                      className="flex items-start gap-3 p-3 hover:bg-accent/30 transition-colors"
                    >
                      <Checkbox
                        checked={!!sel?.enabled && !!sel?.channel_id}
                        disabled={!sel?.channel_id}
                        onCheckedChange={(v) => toggleEnabled(s.project_id, !!v)}
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm truncate">
                            {s.project_name}
                          </span>
                          <Badge variant={conf.variant} className="text-[10px]">
                            {conf.label}
                            {top && s.best_confidence !== 'none' ? ` · ${top.score}` : ''}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          Cliente: {s.client_name || '—'}
                          {s.project_type ? ` · ${s.project_type}` : ''}
                        </p>
                        {s.candidates.length > 0 ? (
                          <Select
                            value={sel?.channel_id ?? undefined}
                            onValueChange={(v) => {
                              const c = s.candidates.find((x) => x.channel_id === v);
                              if (c) updateChannel(s.project_id, c.channel_id, c.channel_name);
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs max-w-md">
                              <SelectValue placeholder="Seleziona canale…" />
                            </SelectTrigger>
                            <SelectContent>
                              {s.candidates.map((c) => (
                                <SelectItem key={c.channel_id} value={c.channel_id}>
                                  <span className="flex items-center gap-1.5">
                                    {c.is_private ? (
                                      <Lock className="h-3 w-3" />
                                    ) : (
                                      <Hash className="h-3 w-3" />
                                    )}
                                    {c.channel_name}
                                    <span className="text-muted-foreground ml-1">
                                      ({c.score})
                                    </span>
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <p className="text-xs italic text-muted-foreground">
                            Nessun canale corrispondente trovato
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}

        <DialogFooter className="gap-2">
          <div className="flex-1 text-xs text-muted-foreground self-center">
            {selectedCount > 0 && (
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-green-600" />
                {selectedCount} associazioni pronte da salvare
              </span>
            )}
          </div>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Chiudi
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || selectedCount === 0 || loading}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvataggio…
              </>
            ) : (
              `Conferma ${selectedCount} associazion${selectedCount === 1 ? 'e' : 'i'}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
