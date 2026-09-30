import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, CheckCircle2, ExternalLink, Plus, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { ProgressUpdateDialog } from '@/components/ProgressUpdateDialog';
import { useLeaderProjectsControl, type LeaderProject } from '@/hooks/useLeaderProjectsControl';
import {
  ROADBLOCK_TYPE_LABELS,
  ROADBLOCK_TYPE_OPTIONS,
  daysOpen,
  getHealthMeta,
  type NewRoadblockInput,
  type RoadblockType,
} from '@/lib/projectRoadblocks';
import { getAreaLabel } from '@/lib/areaColors';

interface Props {
  userId: string;
}

const emptyBlock = (): NewRoadblockInput & { projectId: string } => ({
  projectId: '',
  description: '',
  blocker_type: 'informazioni',
  waiting_on_who: '',
  waiting_on_what: '',
});

export const LeaderControlView = ({ userId }: Props) => {
  const navigate = useNavigate();
  const {
    projects,
    openRoadblocks,
    resolvedRoadblocks,
    updatesDueCount,
    isLoading,
    resolveRoadblock,
    createRoadblock,
  } = useLeaderProjectsControl(userId);

  const [updateTarget, setUpdateTarget] = useState<LeaderProject | null>(null);
  const [applyDraft, setApplyDraft] = useState(false);
  const [showResolved, setShowResolved] = useState(false);
  const [newBlock, setNewBlock] = useState<(NewRoadblockInput & { projectId: string }) | null>(null);
  const [resolveTarget, setResolveTarget] = useState<{ id: string; description: string } | null>(null);
  const [resolveNote, setResolveNote] = useState('');

  const updatedCount = projects.length - updatesDueCount;
  const list = useMemo(() => (showResolved ? resolvedRoadblocks : openRoadblocks), [showResolved, openRoadblocks, resolvedRoadblocks]);

  const openUpdate = (project: LeaderProject, withDraft: boolean) => {
    setApplyDraft(withDraft);
    setUpdateTarget(project);
  };

  const handleCreateBlock = async () => {
    if (!newBlock?.projectId || !newBlock.description.trim()) {
      toast.error('Scegli il progetto e descrivi il blocco');
      return;
    }
    try {
      await createRoadblock.mutateAsync({
        projectId: newBlock.projectId,
        input: {
          description: newBlock.description,
          blocker_type: newBlock.blocker_type,
          waiting_on_who: newBlock.waiting_on_who,
          waiting_on_what: newBlock.waiting_on_what,
        },
      });
      toast.success('Blocco segnalato');
      setNewBlock(null);
    } catch (e: any) {
      toast.error(e?.message || 'Errore durante il salvataggio');
    }
  };

  const handleResolve = async () => {
    if (!resolveTarget) return;
    try {
      await resolveRoadblock.mutateAsync({ id: resolveTarget.id, note: resolveNote });
      toast.success('Blocco risolto');
      setResolveTarget(null);
      setResolveNote('');
    } catch (e: any) {
      toast.error(e?.message || 'Errore durante il salvataggio');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          Non risulti project leader di progetti attivi.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI bar */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Progetti che guidi</p>
            <p className="text-2xl font-bold">{projects.length}</p>
          </CardContent>
        </Card>
        <Card className={updatesDueCount > 0 ? 'border-l-4 border-l-destructive' : ''}>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Update da fare questa settimana</p>
            <p className="text-2xl font-bold">{updatesDueCount}</p>
            <p className="text-xs text-muted-foreground mt-1">{updatedCount} già aggiornati</p>
          </CardContent>
        </Card>
        <Card className={openRoadblocks.length > 0 ? 'border-l-4 border-l-warning' : ''}>
          <CardContent className="p-4 flex items-start justify-between gap-2">
            <div>
              <p className="text-xs text-muted-foreground">Blocchi aperti</p>
              <p className="text-2xl font-bold">{openRoadblocks.length}</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => setNewBlock(emptyBlock())}>
              <Plus className="h-4 w-4 mr-1" /> Segnala
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Update progetti */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Update progetti</CardTitle>
          <CardDescription>Pubblica l’aggiornamento settimanale senza entrare nel progetto.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {projects.map((p) => {
              const health = p.lastUpdateHealth ? getHealthMeta(p.lastUpdateHealth) : null;
              return (
                <div key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium break-words">{p.name}</span>
                      {p.area && (
                        <Badge variant="outline" className="text-[10px]">{getAreaLabel(p.area as any)}</Badge>
                      )}
                      {p.openRoadblocksCount > 0 && (
                        <Badge variant="outline" className="text-[10px] border-destructive/40 text-destructive">
                          {p.openRoadblocksCount} blocchi
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {p.clientName || '—'}
                      {p.endDate ? ` · fine ${format(new Date(p.endDate), 'd MMM yyyy', { locale: it })}` : ''}
                      {` · ${p.progress}%`}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {p.updateDue ? (
                      <Badge variant="outline" className="border-destructive/40 bg-destructive/10 text-destructive text-[11px]">
                        Da fare
                        {p.daysSinceUpdate !== null ? ` · ${p.daysSinceUpdate}g` : ''}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className={`text-[11px] ${health?.badge ?? ''}`}>
                        {health?.label ?? 'Aggiornato'}
                        {p.lastUpdateAt ? ` · ${format(new Date(p.lastUpdateAt), 'd MMM', { locale: it })}` : ''}
                      </Badge>
                    )}
                    {p.hasPendingDraft && (
                      <Badge variant="outline" className="text-[11px] border-primary/40 bg-primary/10 text-primary">
                        <Sparkles className="h-3 w-3 mr-1" /> Bozza AI
                      </Badge>
                    )}
                    <Button size="sm" onClick={() => openUpdate(p, p.hasPendingDraft)}>
                      {p.hasPendingDraft ? 'Usa bozza' : 'Fai update'}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Apri progetto"
                      onClick={() => navigate(`/projects/${p.id}/canvas`)}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Blocchi */}
      <Card>
        <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              Blocchi {showResolved ? 'risolti' : 'aperti'}
            </CardTitle>
            <CardDescription>Risolvi o segnala un blocco su tutti i progetti che guidi.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="show-resolved" className="text-xs text-muted-foreground">Risolti</Label>
            <Switch id="show-resolved" checked={showResolved} onCheckedChange={setShowResolved} />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {list.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              {showResolved ? 'Nessun blocco risolto.' : 'Nessun blocco aperto.'}
            </p>
          ) : (
            <div className="divide-y">
              {list.map((r) => (
                <div key={r.id} className="flex flex-wrap items-start gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary" className="text-[10px]">{ROADBLOCK_TYPE_LABELS[r.blocker_type as RoadblockType]}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {r._projectName}{r._clientName ? ` · ${r._clientName}` : ''}
                      </span>
                    </div>
                    <p className="text-sm break-words whitespace-pre-wrap">{r.description}</p>
                    {(r.waiting_on_who || r.waiting_on_what) && (
                      <p className="text-xs text-muted-foreground">
                        In attesa di {r.waiting_on_who || '—'}
                        {r.waiting_on_what ? ` · ${r.waiting_on_what}` : ''}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {r.resolved_at
                        ? `Risolto il ${format(new Date(r.resolved_at), 'd MMM yyyy', { locale: it })}`
                        : `Aperto da ${daysOpen(r.opened_at)} giorni`}
                      {r.resolution_note ? ` · ${r.resolution_note}` : ''}
                    </p>
                  </div>
                  {!r.resolved_at && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setResolveNote('');
                        setResolveTarget({ id: r.id, description: r.description });
                      }}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1" /> Risolvi
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {updateTarget && (
        <ProgressUpdateDialog
          open={!!updateTarget}
          onOpenChange={(open) => !open && setUpdateTarget(null)}
          projectId={updateTarget.id}
          projectName={updateTarget.name}
          currentProgress={updateTarget.progress}
          clientName={updateTarget.clientName ?? undefined}
          projectLeaderId={userId}
          accountUserId={updateTarget.accountUserId}
          projectBillingType={updateTarget.billingType}
          slackChannelName={updateTarget.slackChannelName}
          autoApplyDraft={applyDraft}
          onSaved={() => setUpdateTarget(null)}
        />
      )}

      {/* Nuovo blocco */}
      <Dialog open={!!newBlock} onOpenChange={(open) => !open && setNewBlock(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Segnala un blocco</DialogTitle>
            <DialogDescription>Verrà aggiunto ai blocchi aperti del progetto scelto.</DialogDescription>
          </DialogHeader>
          {newBlock && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Progetto</Label>
                <Select
                  value={newBlock.projectId}
                  onValueChange={(v) => setNewBlock({ ...newBlock, projectId: v })}
                >
                  <SelectTrigger><SelectValue placeholder="Scegli un progetto" /></SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tipo di blocco</Label>
                <Select
                  value={newBlock.blocker_type}
                  onValueChange={(v) => setNewBlock({ ...newBlock, blocker_type: v as RoadblockType })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROADBLOCK_TYPE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Descrizione</Label>
                <Textarea
                  rows={3}
                  placeholder="Cosa sta bloccando il lavoro..."
                  value={newBlock.description}
                  onChange={(e) => setNewBlock({ ...newBlock, description: e.target.value })}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>In attesa di (chi)</Label>
                  <Input
                    value={newBlock.waiting_on_who || ''}
                    onChange={(e) => setNewBlock({ ...newBlock, waiting_on_who: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Su cosa</Label>
                  <Input
                    value={newBlock.waiting_on_what || ''}
                    onChange={(e) => setNewBlock({ ...newBlock, waiting_on_what: e.target.value })}
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewBlock(null)}>Annulla</Button>
            <Button onClick={handleCreateBlock} disabled={createRoadblock.isPending}>Segnala blocco</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Risolvi blocco */}
      <Dialog open={!!resolveTarget} onOpenChange={(open) => !open && setResolveTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Risolvi blocco</DialogTitle>
            <DialogDescription className="break-words">{resolveTarget?.description}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Nota di risoluzione (opzionale)</Label>
            <Textarea rows={3} value={resolveNote} onChange={(e) => setResolveNote(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveTarget(null)}>Annulla</Button>
            <Button onClick={handleResolve} disabled={resolveRoadblock.isPending}>Segna come risolto</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
