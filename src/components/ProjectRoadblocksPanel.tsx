import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AlertTriangle, CheckCircle2, ChevronDown, Clock, Plus, RotateCcw } from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { toast } from 'sonner';
import { useProjectRoadblocks } from '@/hooks/useProjectRoadblocks';
import {
  ROADBLOCK_TYPE_LABELS,
  ROADBLOCK_TYPE_OPTIONS,
  daysOpen,
  type RoadblockType,
} from '@/lib/projectRoadblocks';

interface ProjectRoadblocksPanelProps {
  projectId: string;
  canManage: boolean;
}

export const ProjectRoadblocksPanel = ({ projectId, canManage }: ProjectRoadblocksPanelProps) => {
  const { openRoadblocks, resolvedRoadblocks, isLoading, createRoadblock, resolveRoadblock, reopenRoadblock } =
    useProjectRoadblocks(projectId);

  const [showForm, setShowForm] = useState(false);
  const [description, setDescription] = useState('');
  const [blockerType, setBlockerType] = useState<RoadblockType>('informazioni');
  const [waitingWho, setWaitingWho] = useState('');
  const [waitingWhat, setWaitingWhat] = useState('');
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');

  const handleCreate = async () => {
    if (!description.trim()) {
      toast.error('Descrivi il blocco');
      return;
    }
    try {
      await createRoadblock.mutateAsync({
        description,
        blocker_type: blockerType,
        waiting_on_who: waitingWho,
        waiting_on_what: waitingWhat,
      });
      setDescription('');
      setBlockerType('informazioni');
      setWaitingWho('');
      setWaitingWhat('');
      setShowForm(false);
      toast.success('Blocco aperto');
    } catch (e: any) {
      toast.error(e?.message || 'Errore nel salvataggio del blocco');
    }
  };

  const handleResolve = async (id: string) => {
    try {
      await resolveRoadblock.mutateAsync({ id, note: resolutionNote });
      setResolvingId(null);
      setResolutionNote('');
      toast.success('Blocco risolto');
    } catch (e: any) {
      toast.error(e?.message || 'Errore nella chiusura del blocco');
    }
  };

  if (isLoading) return null;
  if (openRoadblocks.length === 0 && resolvedRoadblocks.length === 0 && !canManage) return null;

  return (
    <Card className={openRoadblocks.length > 0 ? 'border-destructive/40' : undefined}>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className={`h-4 w-4 ${openRoadblocks.length > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
          Roadblock
          {openRoadblocks.length > 0 && (
            <Badge variant="destructive" className="text-xs">{openRoadblocks.length} aperti</Badge>
          )}
        </CardTitle>
        {canManage && (
          <Button size="sm" variant="outline" onClick={() => setShowForm(v => !v)}>
            <Plus className="h-4 w-4 mr-1" />
            Nuovo blocco
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {showForm && canManage && (
          <div className="rounded-md border p-3 space-y-2">
            <div className="space-y-1">
              <Label className="text-xs">Descrizione</Label>
              <Textarea
                rows={2}
                placeholder="Cosa sta bloccando il lavoro..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <Select value={blockerType} onValueChange={(v) => setBlockerType(v as RoadblockType)}>
                <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROADBLOCK_TYPE_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input className="text-xs" placeholder="In attesa di (chi)" value={waitingWho} onChange={(e) => setWaitingWho(e.target.value)} />
              <Input className="text-xs" placeholder="Su cosa" value={waitingWhat} onChange={(e) => setWaitingWhat(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>Annulla</Button>
              <Button size="sm" onClick={handleCreate} disabled={createRoadblock.isPending}>Apri blocco</Button>
            </div>
          </div>
        )}

        {openRoadblocks.length === 0 && (
          <p className="text-sm text-muted-foreground flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            Nessun blocco aperto
          </p>
        )}

        {openRoadblocks.map(rb => (
          <div key={rb.id} className="rounded-md border border-destructive/30 bg-destructive/5 p-3 space-y-2">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs">{ROADBLOCK_TYPE_LABELS[rb.blocker_type]}</Badge>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Aperto dal {format(new Date(rb.opened_at), 'd MMM yyyy', { locale: it })} · {daysOpen(rb.opened_at)} g
                </span>
              </div>
              {canManage && resolvingId !== rb.id && (
                <Button size="sm" variant="outline" onClick={() => { setResolvingId(rb.id); setResolutionNote(''); }}>
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                  Segna come risolto
                </Button>
              )}
            </div>
            <p className="text-sm whitespace-pre-wrap">{rb.description}</p>
            {rb.waiting_on_who && (
              <Badge variant="secondary" className="text-xs">
                In attesa di: {rb.waiting_on_who}{rb.waiting_on_what ? ` su ${rb.waiting_on_what}` : ''}
              </Badge>
            )}
            {resolvingId === rb.id && (
              <div className="space-y-2 pt-1">
                <Textarea
                  rows={2}
                  placeholder="Nota di chiusura (facoltativa)"
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                />
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setResolvingId(null)}>Annulla</Button>
                  <Button size="sm" onClick={() => handleResolve(rb.id)} disabled={resolveRoadblock.isPending}>
                    Conferma risoluzione
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}

        {resolvedRoadblocks.length > 0 && (
          <Collapsible>
            <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <ChevronDown className="h-3.5 w-3.5" />
              Blocchi risolti ({resolvedRoadblocks.length})
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2 pt-2">
              {resolvedRoadblocks.map(rb => (
                <div key={rb.id} className="rounded-md border p-3 space-y-1">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-xs">{ROADBLOCK_TYPE_LABELS[rb.blocker_type]}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(rb.opened_at), 'd MMM', { locale: it })} →{' '}
                        {rb.resolved_at ? format(new Date(rb.resolved_at), 'd MMM yyyy', { locale: it }) : ''}
                      </span>
                    </div>
                    {canManage && (
                      <Button size="sm" variant="ghost" onClick={() => reopenRoadblock.mutate(rb.id)}>
                        <RotateCcw className="h-3.5 w-3.5 mr-1" />
                        Riapri
                      </Button>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{rb.description}</p>
                  {rb.resolution_note && (
                    <p className="text-xs text-muted-foreground italic">Chiusura: {rb.resolution_note}</p>
                  )}
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
};
