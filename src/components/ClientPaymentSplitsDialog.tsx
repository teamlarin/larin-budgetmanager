import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, CreditCard } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface PaymentSplit {
  id?: string;
  percentage: string;
  payment_term_id: string;
}

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
  const [paymentSplits, setPaymentSplits] = useState<PaymentSplit[]>([]);
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

  // Fetch existing payment splits for this client
  const { data: existingSplits = [], isLoading } = useQuery({
    queryKey: ['client-payment-splits', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_payment_splits')
        .select('*')
        .eq('client_id', clientId)
        .order('display_order');

      if (error) throw error;
      return data || [];
    },
    enabled: open && !!clientId,
  });

  // Update local state when existing splits are loaded
  useEffect(() => {
    if (open && existingSplits.length > 0) {
      setPaymentSplits(existingSplits.map(split => ({
        id: split.id,
        percentage: split.percentage.toString(),
        payment_term_id: split.payment_term_id || "",
      })));
    } else if (open && existingSplits.length === 0) {
      setPaymentSplits([]);
    }
  }, [existingSplits, open]);

  const addPaymentSplit = () => {
    setPaymentSplits([...paymentSplits, {
      percentage: "",
      payment_term_id: "",
    }]);
  };

  const removePaymentSplit = (index: number) => {
    setPaymentSplits(paymentSplits.filter((_, i) => i !== index));
  };

  const updatePaymentSplit = (index: number, field: keyof PaymentSplit, value: string) => {
    const updated = [...paymentSplits];
    updated[index] = { ...updated[index], [field]: value };
    setPaymentSplits(updated);
  };

  const getTotalPercentage = () => {
    return paymentSplits.reduce((sum, split) => sum + (parseFloat(split.percentage) || 0), 0);
  };

  const validatePaymentSplits = (): boolean => {
    if (paymentSplits.length === 0) return true;

    for (const split of paymentSplits) {
      if (!split.percentage || !split.payment_term_id) {
        toast({
          title: "Errore",
          description: "Tutti i campi devono essere compilati",
          variant: "destructive",
        });
        return false;
      }
      const pct = parseFloat(split.percentage);
      if (isNaN(pct) || pct <= 0 || pct > 100) {
        toast({
          title: "Errore",
          description: "Le percentuali devono essere tra 1 e 100",
          variant: "destructive",
        });
        return false;
      }
    }

    const total = getTotalPercentage();
    if (Math.abs(total - 100) > 0.01) {
      toast({
        title: "Errore",
        description: `La somma delle percentuali deve essere 100% (attuale: ${total}%)`,
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const handleSave = async () => {
    if (!validatePaymentSplits()) return;
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

      // Insert new splits
      if (paymentSplits.length > 0) {
        const splitsToInsert = paymentSplits.map((split, index) => ({
          client_id: clientId,
          payment_mode_id: defaultPaymentMode.id, // Use default payment mode
          percentage: parseFloat(split.percentage),
          payment_term_id: split.payment_term_id || null,
          display_order: index,
        }));

        const { error } = await supabase
          .from('client_payment_splits')
          .insert(splitsToInsert);

        if (error) throw error;
      }

      queryClient.invalidateQueries({ queryKey: ['client-payment-splits'] });
      queryClient.invalidateQueries({ queryKey: ['all-client-payment-splits'] });
      
      toast({
        title: "Salvato",
        description: "Modalità di pagamento predefinite salvate con successo",
      });
      
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message || "Impossibile salvare le modalità di pagamento",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
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
            <div className="flex items-center justify-between">
              <Label className="text-base font-medium">Configurazione termini</Label>
              <Button type="button" variant="outline" size="sm" onClick={addPaymentSplit}>
                <Plus className="h-4 w-4 mr-1" />
                Aggiungi
              </Button>
            </div>

            {paymentSplits.length === 0 ? (
              <div className="py-6 text-center text-muted-foreground border-2 border-dashed rounded-lg">
                <p>Nessun termine di pagamento configurato.</p>
                <p className="text-sm">Clicca "Aggiungi" per definire i termini predefiniti.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {paymentSplits.map((split, index) => (
                  <Card key={index} className="bg-muted/30">
                    <CardContent className="p-3">
                      <div className="grid grid-cols-[1fr_80px_auto] gap-2 items-end">
                        <div>
                          <Label className="text-xs">Termini</Label>
                          <Select
                            value={split.payment_term_id}
                            onValueChange={(value) => updatePaymentSplit(index, 'payment_term_id', value)}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Seleziona..." />
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
                        <div>
                          <Label className="text-xs">%</Label>
                          <Input
                            type="number"
                            min="1"
                            max="100"
                            className="h-9"
                            value={split.percentage}
                            onChange={(e) => updatePaymentSplit(index, 'percentage', e.target.value)}
                            placeholder="50"
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9"
                          onClick={() => removePaymentSplit(index)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                <div className="flex justify-end">
                  <span className={`text-sm font-medium ${Math.abs(getTotalPercentage() - 100) < 0.01 ? 'text-green-600' : 'text-destructive'}`}>
                    Totale: {getTotalPercentage()}%
                  </span>
                </div>
              </div>
            )}

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
