import { useEffect, useState } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { DEFAULT_TASK_STATUS } from '@/lib/projectTaskSort';
import type { BudgetActivityOption, ProjectTaskInput } from '@/hooks/useProjectTasks';

interface Props {
  activityOptions: BudgetActivityOption[];
  /** Attività attiva nel filtro del pannello ('all' se nessuna) */
  preferredActivityId?: string;
  onCreate: (input: ProjectTaskInput, onDone: () => void) => void;
  isSaving?: boolean;
}

/** Aggiunta rapida: titolo + Invio. Attività e assegnatario precompilati. */
export const QuickAddTaskInput = ({ activityOptions, preferredActivityId, onCreate, isSaving }: Props) => {
  const [title, setTitle] = useState('');
  const [activityId, setActivityId] = useState('');
  const [assignToMe, setAssignToMe] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  useEffect(() => {
    if (preferredActivityId && preferredActivityId !== 'all' && activityOptions.some((o) => o.id === preferredActivityId)) {
      setActivityId(preferredActivityId);
    } else if (activityOptions.length === 1) {
      setActivityId(activityOptions[0].id);
    } else if (!activityOptions.some((o) => o.id === activityId)) {
      setActivityId('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preferredActivityId, activityOptions]);

  if (activityOptions.length === 0) return null;

  const submit = () => {
    const t = title.trim();
    if (!t || !activityId || isSaving) return;
    const ids = assignToMe && userId ? [userId] : [];
    onCreate(
      {
        title: t,
        status: DEFAULT_TASK_STATUS,
        priority: 'medium',
        budget_item_id: activityId,
        assignee_ids: ids,
        assignee_id: ids[0] || null,
      },
      () => setTitle('')
    );
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 p-2">
      <div className="relative flex-1">
        {isSaving ? (
          <Loader2 className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <Plus className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        )}
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
          placeholder={activityId ? 'Aggiungi una task: scrivi il titolo e premi Invio' : "Scegli l'attività, poi scrivi il titolo"}
          className="h-9 pl-8 bg-background"
          aria-label="Titolo nuova task"
        />
      </div>
      {activityOptions.length > 1 && (
        <Select value={activityId} onValueChange={setActivityId}>
          <SelectTrigger className="h-9 sm:w-[200px] bg-background"><SelectValue placeholder="Attività" /></SelectTrigger>
          <SelectContent className="max-h-72">
            {activityOptions.map((o) => (
              <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <div className="flex items-center gap-1.5 shrink-0 px-1">
        <Checkbox id="quick-assign-me" checked={assignToMe} onCheckedChange={(v) => setAssignToMe(!!v)} />
        <Label htmlFor="quick-assign-me" className="text-xs text-muted-foreground">Assegna a me</Label>
      </div>
    </div>
  );
};
