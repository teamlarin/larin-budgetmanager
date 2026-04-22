import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { ArrowLeft, ExternalLink, Bot, BookOpen, ThumbsUp, ThumbsDown, Search } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { docSearchIndex } from '@/components/docs/docSearchIndex';
import { parseChatTurnId } from '@/lib/chatTurnId';

interface FeedbackRow {
  id: string;
  source: 'search' | 'chatbot' | string;
  helpful: boolean;
  query: string | null;
  context: string | null;
  comment: string | null;
  entity_id: string | null;
  entity_type: string | null;
  user_id: string | null;
  created_at: string;
}

const sectionTitleById = new Map(docSearchIndex.map((e) => [e.id, e.title] as const));

const HelpFeedback = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [sourceFilter, setSourceFilter] = useState<'all' | 'search' | 'chatbot'>('all');
  const [helpfulFilter, setHelpfulFilter] = useState<'all' | 'yes' | 'no'>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<FeedbackRow | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/auth');
        return;
      }
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();
      if (roleData?.role !== 'admin') {
        toast({ title: 'Accesso negato', description: 'Solo gli admin possono vedere i feedback.', variant: 'destructive' });
        navigate('/help');
        return;
      }
      setAuthorized(true);

      const { data, error } = await supabase
        .from('help_feedback')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) {
        toast({ title: 'Errore', description: 'Impossibile caricare i feedback.', variant: 'destructive' });
      } else {
        setRows((data ?? []) as FeedbackRow[]);
      }
      setLoading(false);
    })();
  }, [navigate, toast]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (sourceFilter !== 'all' && r.source !== sourceFilter) return false;
      if (helpfulFilter === 'yes' && !r.helpful) return false;
      if (helpfulFilter === 'no' && r.helpful) return false;
      if (search.trim()) {
        const s = search.toLowerCase();
        const hay = `${r.query ?? ''} ${r.context ?? ''} ${r.comment ?? ''} ${r.entity_id ?? ''}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [rows, sourceFilter, helpfulFilter, search]);

  const stats = useMemo(() => {
    const total = rows.length;
    const helpful = rows.filter((r) => r.helpful).length;
    const search = rows.filter((r) => r.source === 'search').length;
    const chatbot = rows.filter((r) => r.source === 'chatbot').length;
    return { total, helpful, notHelpful: total - helpful, search, chatbot };
  }, [rows]);

  const openDocSection = (entityId: string | null) => {
    if (!entityId) return;
    navigate(`/help#${entityId}`);
  };

  if (loading) {
    return (
      <div className="page-container">
        <p className="text-muted-foreground">Caricamento feedback…</p>
      </div>
    );
  }
  if (!authorized) return null;

  return (
    <div className="page-container stack-lg">
      <div className="page-header-with-actions">
        <div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/settings')} className="mb-2 -ml-2">
            <ArrowLeft className="h-4 w-4 mr-1" /> Impostazioni
          </Button>
          <h1 className="page-title">Feedback Guida e Assistente AI</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Visualizza i feedback inviati dagli utenti per migliorare contenuti e risposte.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Totale</p><p className="text-2xl font-semibold">{stats.total}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground flex items-center gap-1"><ThumbsUp className="h-3 w-3" /> Utili</p><p className="text-2xl font-semibold text-primary">{stats.helpful}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground flex items-center gap-1"><ThumbsDown className="h-3 w-3" /> Non utili</p><p className="text-2xl font-semibold text-destructive">{stats.notHelpful}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground flex items-center gap-1"><Search className="h-3 w-3" /> Ricerca</p><p className="text-2xl font-semibold">{stats.search}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground flex items-center gap-1"><Bot className="h-3 w-3" /> Chatbot</p><p className="text-2xl font-semibold">{stats.chatbot}</p></CardContent></Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs text-muted-foreground mb-1 block">Cerca testo</label>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Domanda, contesto, commento, id sezione…"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Origine</label>
            <Select value={sourceFilter} onValueChange={(v) => setSourceFilter(v as typeof sourceFilter)}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutte</SelectItem>
                <SelectItem value="search">Ricerca</SelectItem>
                <SelectItem value="chatbot">Chatbot</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Utile?</label>
            <Select value={helpfulFilter} onValueChange={(v) => setHelpfulFilter(v as typeof helpfulFilter)}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti</SelectItem>
                <SelectItem value="yes">Solo utili</SelectItem>
                <SelectItem value="no">Solo non utili</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* List */}
      <Card>
        <CardHeader><CardTitle className="text-base">Feedback ({filtered.length})</CardTitle></CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground text-center">Nessun feedback corrisponde ai filtri.</p>
          ) : (
            <ul className="divide-y">
              {filtered.map((r) => {
                const isSection = r.entity_type === 'doc_section';
                const isTurn = r.entity_type === 'chatbot_turn';
                const sectionTitle = isSection && r.entity_id ? sectionTitleById.get(r.entity_id) : null;
                return (
                  <li key={r.id} className="p-4 hover:bg-muted/50 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <Badge variant={r.source === 'chatbot' ? 'default' : 'secondary'} className="gap-1">
                            {r.source === 'chatbot' ? <Bot className="h-3 w-3" /> : <Search className="h-3 w-3" />}
                            {r.source}
                          </Badge>
                          {r.helpful ? (
                            <Badge variant="outline" className="gap-1 border-primary/40 text-primary">
                              <ThumbsUp className="h-3 w-3" /> Utile
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1 border-destructive/40 text-destructive">
                              <ThumbsDown className="h-3 w-3" /> Non utile
                            </Badge>
                          )}
                          {sectionTitle && (
                            <Badge variant="outline" className="gap-1">
                              <BookOpen className="h-3 w-3" /> {sectionTitle}
                            </Badge>
                          )}
                          {isTurn && r.entity_id && (
                            <Badge variant="outline" className="font-mono text-[10px]">
                              {r.entity_id.slice(-12)}
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground ml-auto">
                            {format(new Date(r.created_at), 'd MMM yyyy · HH:mm', { locale: it })}
                          </span>
                        </div>
                        {r.query && (
                          <p className="text-sm font-medium line-clamp-1">"{r.query}"</p>
                        )}
                        {r.comment && (
                          <p className="text-xs text-muted-foreground italic mt-1 line-clamp-2">💬 {r.comment}</p>
                        )}
                      </div>
                      <div className="flex flex-col gap-1 shrink-0">
                        <Button size="sm" variant="outline" onClick={() => setSelected(r)}>
                          Dettagli
                        </Button>
                        {isSection && r.entity_id && (
                          <Button size="sm" variant="ghost" onClick={() => openDocSection(r.entity_id)} className="gap-1">
                            <ExternalLink className="h-3 w-3" /> Apri sezione
                          </Button>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {selected.source === 'chatbot' ? <Bot className="h-4 w-4" /> : <Search className="h-4 w-4" />}
                  Feedback {selected.helpful ? '👍 utile' : '👎 non utile'}
                </DialogTitle>
                <DialogDescription>
                  {format(new Date(selected.created_at), "d MMMM yyyy 'alle' HH:mm", { locale: it })}
                </DialogDescription>
              </DialogHeader>

              <ScrollArea className="max-h-[60vh] pr-4">
                <div className="space-y-4">
                  {/* Entity reference */}
                  {selected.entity_type === 'doc_section' && selected.entity_id && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <BookOpen className="h-4 w-4" /> Sezione guida collegata
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm font-medium">
                          {sectionTitleById.get(selected.entity_id) ?? selected.entity_id}
                        </p>
                        <p className="text-xs text-muted-foreground font-mono mt-1">#{selected.entity_id}</p>
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-3 gap-1"
                          onClick={() => { openDocSection(selected.entity_id); setSelected(null); }}
                        >
                          <ExternalLink className="h-3 w-3" /> Apri nella guida
                        </Button>
                      </CardContent>
                    </Card>
                  )}

                  {selected.entity_type === 'chatbot_turn' && selected.entity_id && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Bot className="h-4 w-4" /> Turno chatbot
                        </CardTitle>
                        <CardDescription className="text-xs font-mono break-all">
                          {selected.entity_id}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="text-xs text-muted-foreground space-y-1">
                        {(() => {
                          const parsed = parseChatTurnId(selected.entity_id!);
                          if (!parsed) return <p>Formato id non riconosciuto.</p>;
                          return (
                            <>
                              <p><span className="font-medium">Conversazione:</span> {parsed.conversationId}</p>
                              <p><span className="font-medium">Turno n°:</span> {parsed.turnIndex}</p>
                              <p><span className="font-medium">Hash prompt:</span> {parsed.promptHash}</p>
                            </>
                          );
                        })()}
                      </CardContent>
                    </Card>
                  )}

                  {selected.query && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1">DOMANDA UTENTE</p>
                      <div className="p-3 rounded-md bg-muted text-sm">{selected.query}</div>
                    </div>
                  )}

                  {selected.context && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1">
                        {selected.source === 'chatbot' ? 'RISPOSTA DEL CHATBOT' : 'CONTESTO'}
                      </p>
                      <div className="p-3 rounded-md bg-muted text-sm prose prose-sm max-w-none dark:prose-invert prose-p:my-1 prose-a:text-primary">
                        {selected.source === 'chatbot' ? (
                          <ReactMarkdown>{selected.context}</ReactMarkdown>
                        ) : (
                          <p className="font-mono text-xs whitespace-pre-wrap">{selected.context}</p>
                        )}
                      </div>
                    </div>
                  )}

                  {selected.comment && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1">COMMENTO UTENTE</p>
                      <div className="p-3 rounded-md border border-dashed text-sm italic">
                        💬 {selected.comment}
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HelpFeedback;
