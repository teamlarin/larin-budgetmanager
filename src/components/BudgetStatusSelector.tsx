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
import { useQuoteGeneration } from '@/hooks/useQuoteGeneration';

type BudgetStatus = 'bozza' | 'in_attesa' | 'in_revisione' | 'approvato' | 'rifiutato';

interface BudgetStatusSelectorProps {
  projectId: string;
  projectName: string;
  currentStatus: BudgetStatus;
  onStatusChange?: () => void;
  tableName?: 'projects' | 'budgets';
  disabled?: boolean;
}

export const BudgetStatusSelector = ({
  projectId,
  projectName,
  currentStatus,
  onStatusChange,
  tableName = 'projects',
  disabled = false,
}: BudgetStatusSelectorProps) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const { toast } = useToast();
  const { generateQuote, checkExistingQuote } = useQuoteGeneration();

  const allStatuses: BudgetStatus[] = ['bozza', 'in_attesa', 'in_revisione', 'approvato', 'rifiutato'];

  const handleStatusChange = async (newStatus: string) => {
    if (!allStatuses.includes(newStatus as BudgetStatus)) return;
    
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from(tableName)
        .update({ status: newStatus as BudgetStatus })
        .eq('id', projectId);

      if (error) throw error;

      // If status changed to approved, generate quote if not exists
      if (newStatus === 'approvato') {
        const hasExistingQuote = await checkExistingQuote(projectId);
        
        if (!hasExistingQuote) {
          await generateQuote({
            budgetId: projectId,
            showSuccessToast: true,
          });
        }
      }

      // Send email notification if status changed to approved or rejected
      if (newStatus === 'approvato' || newStatus === 'rifiutato') {
        try {
          const { error: emailError } = await supabase.functions.invoke('send-budget-notification', {
            body: {
              projectId,
              projectName,
              status: newStatus,
            },
          });

          if (emailError) {
            console.error('Error sending email notification:', emailError);
          }
        } catch (emailError) {
          console.error('Error invoking email function:', emailError);
        }
      }

      // Send notification when budget is sent for review
      if (newStatus === 'in_revisione') {
        try {
          await supabase.functions.invoke('send-budget-notification', {
            body: {
              projectId,
              projectName,
              status: 'in_revisione',
            },
          });
        } catch (emailError) {
          console.error('Error sending review notification:', emailError);
        }
      }

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
        disabled={isUpdating || disabled}
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue>
            <BudgetStatusBadge status={currentStatus} />
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {allStatuses.map((status) => (
            <SelectItem key={status} value={status}>
              <BudgetStatusBadge status={status} />
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
