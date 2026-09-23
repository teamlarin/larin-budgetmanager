import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2, BookOpen } from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { getProfileDisplayName, type UserProfile } from '@/types/workflow';
import {
  RETRO_ACTION_STATUS_LABELS,
  type RetroActionStatus,
  type RetrospectiveAction,
} from '@/hooks/useProjectRetrospective';

interface Props {
  actions: RetrospectiveAction[];
  profiles: UserProfile[];
  canManage: boolean;
  onCreate: (input: Partial<RetrospectiveAction>) => void;
  onUpdate: (input: Partial<RetrospectiveAction> & { id: string }) => void;
  onDelete: (id: string) => void;
}

const NONE = '__none__';

/** Azioni di miglioramento uscite dalla retrospettiva (owner e scadenza opzionali). */
export const RetrospectiveActionsCard = ({
  actions, profiles, canManage, onCreate, onUpdate, onDelete,
}: Props) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [ownerId, setOwnerId] = useState<string>(NONE);
  const [dueDate, setDueDate] = useState('');
  const [playbook, setPlaybook] = useState(false);

  const nameOf = (id: string | null) => {
    if (!id) return null;
    const p = profiles.find((x) => x.id === id);
    return p ? getProfileDisplayName(p) : null;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Azioni e processi da aggiornare</CardTitle>
        <CardDescription>
          Le soluzioni concordate nell&apos;incontro. Priorit\u00e0 e pianificazione si definiscono con
          Head of Operations e Team Leader.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {actions.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nessuna azione registrata.</p>
        ) : (
          <div className="space-y-2">
            {actions.map((a) => (
              <div key={a.id} className="rounded-md border p-3 space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 space-y-1">
                    <p className="font-medium break-words">{a.title}</p>
                    {a.description && (
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words">
                        {a.description}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {nameOf(a.owner_id) && <span>Owner: {nameOf(a.owner_id)}</span>}
                      {a.due_date && (
                        <span>Scadenza: {format(new Date(a.due_date), 'd MMM yyyy', { locale: it })}</span>
                      )}
                      {a.updates_playbook && (
                        <Badge variant="outline" className="gap-1">
                          <BookOpen className="h-3 w-3" />
                          Playbook
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Select
                      value={a.status}
                      disabled={!canManage}
                      onValueChange={(v) => onUpdate({ id: a.id, status: v as RetroActionStatus })}
                    >
                      <SelectTrigger className="w-[160px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(RETRO_ACTION_STATUS_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {canManage && (
                      <Button variant="ghost" size="icon" onClick={() => onDelete(a.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {canManage && (
          <div className="rounded-md border border-dashed p-3 space-y-3">
            <Input
              placeholder="Titolo azione (es. Aggiornare checklist QA)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <Textarea
              rows={2}
              placeholder="Dettagli (opzionale)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <div className="grid gap-2 sm:grid-cols-3">
              <Select value={ownerId} onValueChange={setOwnerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Owner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Nessun owner</SelectItem>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{getProfileDisplayName(p)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              <div className="flex items-center gap-2">
                <Checkbox
                  id="retro-playbook"
                  checked={playbook}
                  onCheckedChange={(v) => setPlaybook(v === true)}
                />
                <Label htmlFor="retro-playbook" className="text-sm">Aggiorna playbook</Label>
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                variant="outline"
                disabled={!title.trim()}
                onClick={() => {
                  onCreate({
                    title: title.trim(),
                    description: description.trim() || null,
                    owner_id: ownerId === NONE ? null : ownerId,
                    due_date: dueDate || null,
                    updates_playbook: playbook,
                  });
                  setTitle('');
                  setDescription('');
                  setOwnerId(NONE);
                  setDueDate('');
                  setPlaybook(false);
                }}
              >
                <Plus className="h-4 w-4 mr-1" />
                Aggiungi azione
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
