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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { useReassign } from '@/hooks/useTeamWeek';

export interface ReassignTarget {
  kind: 'task' | 'entries';
  label: string;
  fromUserId: string;
  taskId?: string;
  entryIds?: string[];
}

interface ReassignDialogProps {
  target: ReassignTarget | null;
  people: { userId: string; fullName: string }[];
  onOpenChange: (open: boolean) => void;
}

export const ReassignDialog = ({ target, people, onOpenChange }: ReassignDialogProps) => {
  const [toUserId, setToUserId] = useState<string>('');
  const { reassignTask, reassignEntries } = useReassign();
  const pending = reassignTask.isPending || reassignEntries.isPending;

  const candidates = people.filter(p => p.userId !== target?.fromUserId);

  const handleConfirm = async () => {
    if (!target || !toUserId) return;
    try {
      if (target.kind === 'task' && target.taskId) {
        await reassignTask.mutateAsync({ taskId: target.taskId, toUserId });
      } else if (target.kind === 'entries' && target.entryIds) {
        await reassignEntries.mutateAsync({ entryIds: target.entryIds, toUserId });
      }
      toast({ title: 'Riassegnato', description: target.label });
      setToUserId('');
      onOpenChange(false);
    } catch (e: any) {
      toast({
        title: 'Riassegnazione non riuscita',
        description: e?.message || 'Errore inatteso',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={!!target} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Riassegna</DialogTitle>
          <DialogDescription>
            {target?.kind === 'task'
              ? `La task «${target?.label}» passerà alla persona scelta.`
              : `Gli slot pianificati di «${target?.label}» in questa settimana passeranno alla persona scelta.`}
          </DialogDescription>
        </DialogHeader>

        <Select value={toUserId} onValueChange={setToUserId}>
          <SelectTrigger>
            <SelectValue placeholder="Scegli la persona" />
          </SelectTrigger>
          <SelectContent>
            {candidates.map(p => (
              <SelectItem key={p.userId} value={p.userId}>
                {p.fullName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Annulla
          </Button>
          <Button onClick={handleConfirm} disabled={!toUserId || pending}>
            {pending ? 'Riassegno…' : 'Conferma riassegnazione'}
          </Button>
        </DialogFooter>
      </DialogContent>

    </Dialog>
  );
};
