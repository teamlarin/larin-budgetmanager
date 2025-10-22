import { useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { BudgetStatusBadge } from './BudgetStatusBadge';

interface BudgetStatusSelectorProps {
  projectId: string;
  currentStatus: 'in_attesa' | 'approvato' | 'rifiutato';
  onStatusChange?: () => void;
}

export const BudgetStatusSelector = ({
  projectId,
  currentStatus,
  onStatusChange,
}: BudgetStatusSelectorProps) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const { toast } = useToast();

  const handleStatusChange = async (newStatus: string) => {
    if (newStatus !== 'in_attesa' && newStatus !== 'approvato' && newStatus !== 'rifiutato') {
      return;
    }
    
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('projects')
        .update({ status: newStatus as 'in_attesa' | 'approvato' | 'rifiutato' })
        .eq('id', projectId);

      if (error) throw error;

      toast({
        title: 'Stato aggiornato',
        description: 'Lo stato del budget è stato modificato con successo.',
      });

      onStatusChange?.();
    } catch (error) {
      console.error('Error updating status:', error);
      toast({
        title: 'Errore',
        description: 'Si è verificato un errore durante l\'aggiornamento dello stato.',
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">Stato:</span>
      <Select
        value={currentStatus}
        onValueChange={handleStatusChange}
        disabled={isUpdating}
      >
        <SelectTrigger className="w-[150px]">
          <SelectValue>
            <BudgetStatusBadge status={currentStatus} />
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="in_attesa">
            <BudgetStatusBadge status="in_attesa" />
          </SelectItem>
          <SelectItem value="approvato">
            <BudgetStatusBadge status="approvato" />
          </SelectItem>
          <SelectItem value="rifiutato">
            <BudgetStatusBadge status="rifiutato" />
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
};
