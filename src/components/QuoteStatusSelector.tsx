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
  projectId: string | null;
  budgetId: string | null;
  currentStatus: 'draft' | 'sent' | 'approved' | 'rejected';
  onStatusChange?: () => void;
  readOnly?: boolean;
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
  budgetId,
  currentStatus,
  onStatusChange,
  readOnly = false,
}: QuoteStatusSelectorProps) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const { toast } = useToast();

  // If read-only, just show the badge
  if (readOnly) {
    const config = statusConfig[currentStatus];
    return <Badge variant={config.variant}>{config.label}</Badge>;
  }

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

      // If approved, create or update project
      if (newStatus === 'approved') {
        let finalProjectId = projectId;

        // If no project exists, create one from the budget
        if (!projectId && budgetId) {
          // Get budget data to create project
          const { data: budgetData, error: budgetError } = await supabase
            .from('budgets')
            .select('*')
            .eq('id', budgetId)
            .single();

          if (budgetError) throw budgetError;

          // Get current user
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw new Error('User not authenticated');

          // Create project from budget data
          const { data: newProject, error: projectCreateError } = await supabase
            .from('projects')
            .insert({
              name: budgetData.name,
              description: budgetData.description,
              project_type: budgetData.project_type,
              client_id: budgetData.client_id,
              client_contact_id: budgetData.client_contact_id,
              account_user_id: budgetData.account_user_id,
              brief_link: budgetData.brief_link,
              discount_percentage: budgetData.discount_percentage,
              margin_percentage: budgetData.margin_percentage,
              objective: budgetData.objective,
              payment_terms: budgetData.payment_terms,
              area: budgetData.area,
              discipline: budgetData.discipline,
              total_budget: budgetData.total_budget,
              total_hours: budgetData.total_hours,
              budget_template_id: budgetData.budget_template_id,
              drive_folder_id: budgetData.drive_folder_id,
              drive_folder_name: budgetData.drive_folder_name,
              status: 'approvato',
              project_status: 'in_partenza',
              status_changed_at: new Date().toISOString(),
              user_id: user.id,
            })
            .select('id')
            .single();

          if (projectCreateError) throw projectCreateError;

          finalProjectId = newProject.id;

          // Update quote with the new project_id
          await supabase
            .from('quotes')
            .update({ project_id: finalProjectId })
            .eq('id', quoteId);

          // Update budget with project_id link
          await supabase
            .from('budgets')
            .update({ 
              project_id: finalProjectId,
              status: 'approvato'
            })
            .eq('id', budgetId);

          // Copy budget items to the new project
          const { data: budgetItems } = await supabase
            .from('budget_items')
            .select('*')
            .eq('budget_id', budgetId);

          if (budgetItems && budgetItems.length > 0) {
            const projectItems = budgetItems.map(item => ({
              ...item,
              id: undefined, // Let DB generate new ID
              project_id: finalProjectId,
              budget_id: null, // Clear budget reference
              created_at: undefined,
              updated_at: undefined,
            }));

            await supabase
              .from('budget_items')
              .insert(projectItems);
          }

          toast({
            title: 'Preventivo approvato',
            description: 'Il progetto è stato creato con stato "In partenza" e apparirà nella lista progetti.',
          });
        } else if (projectId) {
          // Project already exists, just update status
          const { error: projectError } = await supabase
            .from('projects')
            .update({ 
              status: 'approvato',
              project_status: 'in_partenza',
              status_changed_at: new Date().toISOString()
            })
            .eq('id', projectId);

          if (projectError) throw projectError;

          toast({
            title: 'Preventivo approvato',
            description: 'Il progetto è stato aggiornato e apparirà nella lista progetti.',
          });
        }
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
