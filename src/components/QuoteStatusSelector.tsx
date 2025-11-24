import { useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2 } from 'lucide-react';

interface QuoteStatusSelectorProps {
  quoteId: string;
  projectId: string;
  currentStatus: 'draft' | 'sent' | 'approved' | 'rejected';
  onStatusChange?: () => void;
}

const statusConfig = {
  draft: { label: 'Bozza', variant: 'secondary' as const },
  sent: { label: 'Inviato', variant: 'default' as const },
  approved: { label: 'Approvato', variant: 'green' as const },
  rejected: { label: 'Rifiutato', variant: 'destructive' as const },
};

export const QuoteStatusSelector = ({
  quoteId,
  projectId,
  currentStatus,
  onStatusChange,
}: QuoteStatusSelectorProps) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const { toast } = useToast();

  const handleStatusChange = async (newStatus: string) => {
    if (!['draft', 'sent', 'approved', 'rejected'].includes(newStatus)) {
      return;
    }

    // Show confirmation dialog for approval
    if (newStatus === 'approved') {
      setPendingStatus(newStatus);
      setShowConfirmDialog(true);
      return;
    }

    // For other statuses, update directly
    await updateStatus(newStatus);
  };

  const updateStatus = async (newStatus: string) => {
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

  const handleConfirmApproval = async () => {
    if (pendingStatus) {
      await updateStatus(pendingStatus);
      setPendingStatus(null);
    }
    setShowConfirmDialog(false);
  };

  const handleCancelApproval = () => {
    setPendingStatus(null);
    setShowConfirmDialog(false);
  };

  const config = statusConfig[currentStatus];

  return (
    <>
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
            <Badge variant="green">Approvato</Badge>
          </SelectItem>
          <SelectItem value="rejected">
            <Badge variant="destructive">Rifiutato</Badge>
          </SelectItem>
        </SelectContent>
      </Select>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Conferma approvazione preventivo
            </AlertDialogTitle>
            <AlertDialogDescription>
              Sei sicuro di voler approvare questo preventivo? Il progetto associato verrà automaticamente impostato come "Approvato" e apparirà nella lista dei progetti.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelApproval}>
              Annulla
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmApproval}
              className="bg-green-600 hover:bg-green-700"
            >
              Conferma approvazione
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
