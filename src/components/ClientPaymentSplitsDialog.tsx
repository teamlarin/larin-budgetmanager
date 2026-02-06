import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { CreditCard } from "lucide-react";

interface PaymentTerm {
  id: string;
  value: string;
  label: string;
}

interface ClientPaymentSplitsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  clientName: string;
}

export const ClientPaymentSplitsDialog = ({
  open,
  onOpenChange,
  clientId,
  clientName,
}: ClientPaymentSplitsDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTermId, setSelectedTermId] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  // Fetch the first payment mode to use as default (required by DB schema)
  const { data: defaultPaymentMode } = useQuery({
    queryKey: ['default-payment-mode'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_modes')
        .select('id')
        .eq('is_active', true)
        .order('display_order')
        .limit(1)
        .single();

      if (error) throw error;
      return data;
    },
  });

  // Fetch payment terms
  const { data: paymentTerms = [] } = useQuery<PaymentTerm[]>({
    queryKey: ['payment-terms'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_terms')
        .select('id, value, label')
        .eq('is_active', true)
        .order('display_order');

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch existing payment split for this client (we only use the first one now)
  const { data: existingSplits = [], isLoading } = useQuery({
    queryKey: ['client-payment-splits', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_payment_splits')
        .select('*')
        .eq('client_id', clientId)
        .order('display_order')
        .limit(1);

      if (error) throw error;
      return data || [];
    },
    enabled: open && !!clientId,
  });

  // Update local state when existing split is loaded
  useEffect(() => {
    if (open && existingSplits.length > 0) {
      setSelectedTermId(existingSplits[0].payment_term_id || "");
    } else if (open) {
      setSelectedTermId("");
    }
  }, [existingSplits, open]);

  const handleSave = async () => {
    if (!defaultPaymentMode?.id) {
      toast({
        title: "Errore",
        description: "Nessuna modalità di pagamento disponibile",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);

    try {
      // Delete existing splits
      await supabase
        .from('client_payment_splits')
        .delete()
        .eq('client_id', clientId);

      // Insert new split if a term is selected
      if (selectedTermId) {
        const { error } = await supabase
          .from('client_payment_splits')
          .insert({
            client_id: clientId,
            payment_mode_id: defaultPaymentMode.id,
            percentage: 100, // Always 100% since we only have one term
            payment_term_id: selectedTermId,
            display_order: 0,
          });

        if (error) throw error;
      }

      queryClient.invalidateQueries({ queryKey: ['client-payment-splits'] });
      queryClient.invalidateQueries({ queryKey: ['all-client-payment-splits'] });
      
      toast({
        title: "Salvato",
        description: "Termini di pagamento predefiniti salvati con successo",
      });
      
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message || "Impossibile salvare i termini di pagamento",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Termini di Pagamento Predefiniti
          </DialogTitle>
          <DialogDescription>
            Configura i termini di pagamento predefiniti per <strong>{clientName}</strong>. 
            Verranno applicati automaticamente ai nuovi preventivi.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground">Caricamento...</div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label>Termini di pagamento</Label>
              <Select
                value={selectedTermId}
                onValueChange={setSelectedTermId}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Seleziona termini di pagamento..." />
                </SelectTrigger>
                <SelectContent>
                  {paymentTerms.map((term) => (
                    <SelectItem key={term.id} value={term.id}>
                      {term.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 justify-end pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Annulla
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? "Salvataggio..." : "Salva"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
