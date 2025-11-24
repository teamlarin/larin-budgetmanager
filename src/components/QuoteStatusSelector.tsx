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
import { Badge } from '@/components/ui/badge';

interface QuoteStatusSelectorProps {
  quoteId: string;
  projectId: string;
  currentStatus: 'draft' | 'sent' | 'approved' | 'rejected';
  onStatusChange?: () => void;
}

const statusConfig = {
  draft: { label: 'Bozza', variant: 'secondary' as const },
  sent: { label: 'Inviato', variant: 'default' as const },
  approved: { label: 'Approvato', variant: 'default' as const },
  rejected: { label: 'Rifiutato', variant: 'destructive' as const },
};

export const QuoteStatusSelector = ({
  quoteId,
  projectId,
  currentStatus,
  onStatusChange,
}: QuoteStatusSelectorProps) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const { toast } = useToast();

  const handleStatusChange = async (newStatus: string) => {
    if (!['draft', 'sent', 'approved', 'rejected'].includes(newStatus)) {
      return;
    }
    
    setIsUpdating(true);
    try {
      // Update quote status
      const { error } = await supabase
        .from('quotes')
        .update({ status: newStatus })
        .eq('id', quoteId);

      if (error) throw error;

      // If approved, update project status
      if (newStatus === 'approved') {
        const { error: projectError } = await supabase
          .from('projects')
          .update({ 
            status: 'approvato',
            status_changed_at: new Date().toISOString()
          })
          .eq('id', projectId);

        if (projectError) throw projectError;

        toast({
          title: 'Preventivo approvato',
          description: 'Il progetto è stato aggiornato e apparirà nella lista progetti.',
        });
      } else {
        toast({
          title: 'Stato aggiornato',
          description: 'Lo stato del preventivo è stato modificato con successo.',
        });
      }

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

  const config = statusConfig[currentStatus];

  return (
    <Select
      value={currentStatus}
      onValueChange={handleStatusChange}
      disabled={isUpdating}
    >
      <SelectTrigger className="w-[130px]">
        <SelectValue>
          <Badge variant={config.variant}>{config.label}</Badge>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="draft">
          <Badge variant="secondary">Bozza</Badge>
        </SelectItem>
        <SelectItem value="sent">
          <Badge variant="default">Inviato</Badge>
        </SelectItem>
        <SelectItem value="approved">
          <Badge variant="default">Approvato</Badge>
        </SelectItem>
        <SelectItem value="rejected">
          <Badge variant="destructive">Rifiutato</Badge>
        </SelectItem>
      </SelectContent>
    </Select>
  );
};
