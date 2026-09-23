import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DELIVERABLE_OWNER_LABELS,
  type DeliverableActivityOption,
  type DeliverableOwnerSide,
} from '@/hooks/useProjectRetrospective';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Attività previste non ancora presenti nel registro. */
  activities: DeliverableActivityOption[];
  isSaving?: boolean;
  onConfirm: (input: {
    activityIds: string[];
    ownerSide: DeliverableOwnerSide;
    plannedDate: string | null;
  }) => void;
}

/** Selezione delle attività a budget da trasformare in consegne/milestone. */
export const GenerateDeliverablesDialog = ({
  open,
  onOpenChange,
  activities,
  isSaving,
  onConfirm,
}: Props) => {
  const [selected, setSelected] = useState<string[]>([]);
  const [ownerSide, setOwnerSide] = useState<DeliverableOwnerSide>('larin');
  const [plannedDate, setPlannedDate] = useState('');

  const toggle = (id: string) =>
    setSelected(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          setSelected([]);
          setPlannedDate('');
        }
      }}
    >
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Genera consegne dalle attività</DialogTitle>
          <DialogDescription>
            Seleziona le attività previste che rappresentano una consegna o una milestone.
          </DialogDescription>
        </DialogHeader>

        {activities.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Tutte le attività del progetto sono già presenti nel registro consegne.
          </p>
        ) : (
          <ScrollArea className="max-h-[280px] rounded-md border p-2">
            <div className="space-y-2">
              {activities.map((a) => (
                <label
                  key={a.id}
                  className="flex cursor-pointer items-start gap-3 rounded-md p-2 hover:bg-muted/50"
                >
                  <Checkbox checked={selected.includes(a.id)} onCheckedChange={() => toggle(a.id)} />
                  <span className="min-w-0">
                    <span className="block break-words text-sm font-medium">{a.activity_name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {[a.category, a.hours_worked ? `${a.hours_worked} h` : null]
                        .filter(Boolean)
                        .join(' • ')}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </ScrollArea>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Assegnazione</Label>
            <Select value={ownerSide} onValueChange={(v) => setOwnerSide(v as DeliverableOwnerSide)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(DELIVERABLE_OWNER_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Data prevista (opzionale)</Label>
            <Input type="date" value={plannedDate} onChange={(e) => setPlannedDate(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button
            disabled={selected.length === 0 || isSaving}
            onClick={() =>
              onConfirm({ activityIds: selected, ownerSide, plannedDate: plannedDate || null })
            }
          >
            Aggiungi {selected.length > 0 ? `(${selected.length})` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
