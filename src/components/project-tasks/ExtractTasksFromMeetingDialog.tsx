import { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import { Loader2, Sparkles, FileText } from 'lucide-react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getProfileDisplayName, type UserProfile } from '@/types/workflow';
import { DEFAULT_TASK_STATUS, PRIORITY_LABELS, type ProjectTaskPriority } from '@/lib/projectTaskSort';
import type { BudgetActivityOption, ProjectTaskInput } from '@/hooks/useProjectTasks';

const NONE = '__none__';

interface Suggestion {
  title: string;
  description: string | null;
  assignee_id: string | null;
  due_date: string | null;
  budget_item_id: string | null;
  priority: ProjectTaskPriority;
  quote: string | null;
  selected: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  projectId: string;
  teamProfiles: UserProfile[];
  activityOptions: BudgetActivityOption[];
  createTask: (input: ProjectTaskInput) => Promise<unknown>;
}

async function readError(error: any): Promise<string> {
  try {
    const body = await error?.context?.json?.();
    if (body?.error) return body.error;
  } catch { /* ignore */ }
  return error?.message || 'Errore';
}

export const ExtractTasksFromMeetingDialog = ({ open, onOpenChange, projectId, teamProfiles, activityOptions, createTask }: Props) => {
  const { toast } = useToast();
  const [tab, setTab] = useState<'drive' | 'text'>('drive');
  const [files, setFiles] = useState<{ id: string; name: string; modifiedTime?: string }[]>([]);
  const [filesReason, setFilesReason] = useState<string | null>(null);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [fileId, setFileId] = useState('');
  const [text, setText] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSuggestions(null);
    setFileId('');
    setLoadingFiles(true);
    supabase.functions
      .invoke('extract-tasks-from-transcript', { body: { action: 'list', projectId } })
      .then(async ({ data, error }) => {
        if (error) { setFilesReason(await readError(error)); setFiles([]); return; }
        setFiles(data?.files ?? []);
        setFilesReason(data?.reason ?? null);
        if (!data?.files?.length) setTab('text');
      })
      .finally(() => setLoadingFiles(false));
  }, [open, projectId]);

  const analyze = async () => {
    setAnalyzing(true);
    const { data, error } = await supabase.functions.invoke('extract-tasks-from-transcript', {
      body: {
        action: 'extract',
        projectId,
        ...(tab === 'drive' ? { fileId } : { text }),
        team: teamProfiles.map((p) => ({ id: p.id, name: getProfileDisplayName(p) })),
        activities: activityOptions.map((a) => ({ id: a.id, name: a.name })),
      },
    });
    setAnalyzing(false);
    if (error) { toast({ title: 'Analisi non riuscita', description: await readError(error), variant: 'destructive' }); return; }
    const list: Suggestion[] = (data?.tasks ?? []).map((t: any) => ({
      ...t,
      budget_item_id: t.budget_item_id ?? (activityOptions.length === 1 ? activityOptions[0].id : null),
      selected: true,
    }));
    if (list.length === 0) toast({ title: 'Nessuna task trovata', description: 'Nella riunione non risultano impegni operativi del team.' });
    setSuggestions(list);
  };

  const update = (i: number, patch: Partial<Suggestion>) =>
    setSuggestions((prev) => prev && prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));

  const selected = (suggestions ?? []).filter((s) => s.selected);
  const missingActivity = selected.some((s) => !s.budget_item_id);

  const importSelected = async () => {
    setImporting(true);
    let ok = 0;
    for (const s of selected) {
      try {
        await createTask({
          title: s.title,
          description: s.description,
          description_html: s.description ? `<p>${s.description}</p>` : null,
          assignee_ids: s.assignee_id ? [s.assignee_id] : [],
          assignee_id: s.assignee_id,
          status: DEFAULT_TASK_STATUS,
          priority: s.priority,
          due_date: s.due_date,
          budget_item_id: s.budget_item_id,
        });
        ok++;
      } catch { /* toast già mostrato dalla mutation */ }
    }
    setImporting(false);
    toast({ title: `${ok} task create dalla riunione` });
    if (ok === selected.length) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> Estrai task da riunione</DialogTitle>
          <DialogDescription>L'AI legge la trascrizione e propone le task del team. Controllale prima di importarle.</DialogDescription>
        </DialogHeader>

        {!suggestions ? (
          <div className="space-y-4">
            <Tabs value={tab} onValueChange={(v) => setTab(v as 'drive' | 'text')}>
              <TabsList>
                <TabsTrigger value="drive">Trascrizioni Meet</TabsTrigger>
                <TabsTrigger value="text">Incolla testo</TabsTrigger>
              </TabsList>
              <TabsContent value="drive" className="space-y-2">
                {loadingFiles ? (
                  <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Cerco nella cartella Drive del progetto...</p>
                ) : files.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {filesReason === 'no_folder' ? 'Il progetto non ha una cartella Drive collegata.' : 'Nessuna trascrizione trovata nella cartella Drive del progetto.'} Puoi incollare il testo nella scheda accanto.
                  </p>
                ) : (
                  <div className="space-y-1 max-h-72 overflow-y-auto">
                    {files.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setFileId(f.id)}
                        className={`w-full text-left flex items-start gap-2 rounded-md border p-2 text-sm transition-colors ${fileId === f.id ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted'}`}
                      >
                        <FileText className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                        <span className="flex-1 min-w-0 break-words">{f.name}</span>
                        {f.modifiedTime && (
                          <span className="text-xs text-muted-foreground shrink-0">{format(parseISO(f.modifiedTime), 'd MMM yyyy', { locale: it })}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </TabsContent>
              <TabsContent value="text">
                <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={10} placeholder="Incolla qui la trascrizione o gli appunti della call..." />
              </TabsContent>
            </Tabs>
            <DialogFooter>
              <Button onClick={analyze} disabled={analyzing || (tab === 'drive' ? !fileId : text.trim().length < 30)}>
                {analyzing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                {analyzing ? 'Analisi in corso...' : 'Analizza'}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-3">
            {suggestions.length === 0 && <p className="text-sm text-muted-foreground">Nessuna task proposta.</p>}
            {suggestions.map((s, i) => (
              <div key={i} className={`rounded-lg border p-3 space-y-2 ${s.selected ? 'border-border' : 'border-border opacity-50'}`}>
                <div className="flex items-start gap-2">
                  <Checkbox checked={s.selected} onCheckedChange={(v) => update(i, { selected: !!v })} className="mt-2.5" />
                  <Input value={s.title} onChange={(e) => update(i, { title: e.target.value })} className="flex-1" />
                </div>
                {s.quote && <p className="text-xs text-muted-foreground italic pl-6 break-words">“{s.quote}”</p>}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pl-6">
                  <Select value={s.assignee_id ?? NONE} onValueChange={(v) => update(i, { assignee_id: v === NONE ? null : v })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Nessun assegnatario</SelectItem>
                      {teamProfiles.map((p) => <SelectItem key={p.id} value={p.id}>{getProfileDisplayName(p)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input type="date" className="h-8 text-xs" value={s.due_date ?? ''} onChange={(e) => update(i, { due_date: e.target.value || null })} />
                  <Select value={s.budget_item_id ?? NONE} onValueChange={(v) => update(i, { budget_item_id: v === NONE ? null : v })}>
                    <SelectTrigger className={`h-8 text-xs ${!s.budget_item_id && s.selected ? 'border-destructive' : ''}`}><SelectValue /></SelectTrigger>
                    <SelectContent className="max-h-72">
                      <SelectItem value={NONE}>Scegli attività *</SelectItem>
                      {activityOptions.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={s.priority} onValueChange={(v) => update(i, { priority: v as ProjectTaskPriority })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(PRIORITY_LABELS) as ProjectTaskPriority[]).map((p) => <SelectItem key={p} value={p}>{PRIORITY_LABELS[p]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setSuggestions(null)}>Indietro</Button>
              <Button onClick={importSelected} disabled={importing || selected.length === 0 || missingActivity}>
                {importing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Importa {selected.length} task
              </Button>
            </DialogFooter>
            {missingActivity && <p className="text-xs text-destructive text-right">Scegli l'attività per tutte le task selezionate.</p>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
