import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, CreditCard } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface PaymentSplit {
  id?: string;
  payment_mode_id: string;
  percentage: string;
  payment_term_id: string;
  display_order: number;
}

interface PaymentMode {
  id: string;
  value: string;
  label: string;
}

interface PaymentTerm {
  id: string;
  value: string;
  label: string;
}

interface QuotePaymentSplitsSectionProps {
  quoteId: string;
  isEditing: boolean;
}

export const QuotePaymentSplitsSection = ({
  quoteId,
  isEditing,
}: QuotePaymentSplitsSectionProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [paymentSplits, setPaymentSplits] = useState<PaymentSplit[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch payment modes
  const { data: paymentModes = [] } = useQuery<PaymentMode[]>({
    queryKey: ['payment-modes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_modes')
        .select('id, value, label')
        .eq('is_active', true)
        .order('display_order');

      if (error) throw error;
      return data || [];
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

  // Fetch existing payment splits for this quote
  const { data: existingSplits = [], isLoading, refetch } = useQuery({
    queryKey: ['quote-payment-splits', quoteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quote_payment_splits')
        .select('*')
        .eq('quote_id', quoteId)
        .order('display_order');

      if (error) throw error;
      return data || [];
    },
    enabled: !!quoteId,
  });

  // Update local state when existing splits are loaded
  useEffect(() => {
    if (existingSplits.length > 0) {
      setPaymentSplits(existingSplits.map((split, index) => ({
        id: split.id,
        payment_mode_id: split.payment_mode_id,
        percentage: split.percentage.toString(),
        payment_term_id: split.payment_term_id || "",
        display_order: split.display_order ?? index,
      })));
    } else {
      setPaymentSplits([]);
    }
    setHasChanges(false);
  }, [existingSplits]);

  const getPaymentModeLabel = (modeId: string) => {
    const mode = paymentModes.find(m => m.id === modeId);
    return mode?.label || '-';
  };

  const getPaymentTermLabel = (termId: string) => {
    const term = paymentTerms.find(t => t.id === termId);
    return term?.label || '-';
  };

  const addPaymentSplit = () => {
    setPaymentSplits([...paymentSplits, {
      payment_mode_id: "",
      percentage: "",
      payment_term_id: "",
      display_order: paymentSplits.length,
    }]);
    setHasChanges(true);
  };

  const removePaymentSplit = (index: number) => {
    setPaymentSplits(paymentSplits.filter((_, i) => i !== index));
    setHasChanges(true);
  };

  const updatePaymentSplit = (index: number, field: keyof PaymentSplit, value: string | number) => {
    const updated = [...paymentSplits];
    updated[index] = { ...updated[index], [field]: value };
    setPaymentSplits(updated);
    setHasChanges(true);
  };

  const getTotalPercentage = () => {
    return paymentSplits.reduce((sum, split) => sum + (parseFloat(split.percentage) || 0), 0);
  };

  const validatePaymentSplits = (): boolean => {
    if (paymentSplits.length === 0) return true;

    for (const split of paymentSplits) {
      if (!split.payment_mode_id || !split.percentage || !split.payment_term_id) {
        toast({
          title: "Errore",
          description: "Tutti i campi delle modalità di pagamento devono essere compilati",
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

    setIsSaving(true);

    try {
      // Delete existing splits
      await supabase
        .from('quote_payment_splits')
        .delete()
        .eq('quote_id', quoteId);

      // Insert new splits
      if (paymentSplits.length > 0) {
        const splitsToInsert = paymentSplits.map((split, index) => ({
          quote_id: quoteId,
          payment_mode_id: split.payment_mode_id,
          percentage: parseFloat(split.percentage),
          payment_term_id: split.payment_term_id || null,
          display_order: index,
        }));

        const { error } = await supabase
          .from('quote_payment_splits')
          .insert(splitsToInsert);

        if (error) throw error;
      }

      queryClient.invalidateQueries({ queryKey: ['quote-payment-splits', quoteId] });
      
      toast({
        title: "Salvato",
        description: "Modalità di pagamento aggiornate con successo",
      });
      
      setHasChanges(false);
      refetch();
    } catch (error: any) {
      console.error('Error saving payment splits:', error);
      toast({
        title: "Errore",
        description: error.message || "Impossibile salvare le modalità di pagamento",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Modalità di Pagamento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse h-20 bg-muted rounded"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Modalità di Pagamento
          </CardTitle>
          {isEditing && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={addPaymentSplit}>
                <Plus className="h-4 w-4 mr-1" />
                Aggiungi
              </Button>
              {hasChanges && (
                <Button size="sm" onClick={handleSave} disabled={isSaving}>
                  {isSaving ? "Salvataggio..." : "Salva modifiche"}
                </Button>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {paymentSplits.length === 0 ? (
          <div className="py-6 text-center text-muted-foreground border-2 border-dashed rounded-lg">
            <p>Nessuna modalità di pagamento configurata.</p>
            {isEditing && <p className="text-sm">Clicca "Aggiungi" per definire le modalità.</p>}
          </div>
        ) : isEditing ? (
          <div className="space-y-3">
            {paymentSplits.map((split, index) => (
              <div key={index} className="grid grid-cols-[1fr_100px_1fr_auto] gap-3 items-end p-3 bg-muted/30 rounded-lg">
                <div>
                  <Label className="text-xs text-muted-foreground">Modalità</Label>
                  <Select
                    value={split.payment_mode_id}
                    onValueChange={(value) => updatePaymentSplit(index, 'payment_mode_id', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona..." />
                    </SelectTrigger>
                    <SelectContent>
                      {paymentModes.map((mode) => (
                        <SelectItem key={mode.id} value={mode.id}>
                          {mode.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Percentuale</Label>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      min="1"
                      max="100"
                      value={split.percentage}
                      onChange={(e) => updatePaymentSplit(index, 'percentage', e.target.value)}
                      placeholder="50"
                    />
                    <span className="text-muted-foreground">%</span>
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Termini</Label>
                  <Select
                    value={split.payment_term_id}
                    onValueChange={(value) => updatePaymentSplit(index, 'payment_term_id', value)}
                  >
                    <SelectTrigger>
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
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removePaymentSplit(index)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
            <div className="flex justify-end pt-2">
              <span className={`text-sm font-medium ${Math.abs(getTotalPercentage() - 100) < 0.01 ? 'text-green-600' : 'text-destructive'}`}>
                Totale: {getTotalPercentage()}%
              </span>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {paymentSplits.map((split, index) => (
              <Badge key={index} variant="secondary" className="text-sm py-1.5 px-3">
                {getPaymentModeLabel(split.payment_mode_id)} {split.percentage}% - {getPaymentTermLabel(split.payment_term_id)}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};