import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { Plus, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useProductServiceCategories } from "@/hooks/useProductServiceCategories";

const serviceSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Il codice è obbligatorio")
    .max(50, "Il codice è troppo lungo"),
  name: z
    .string()
    .trim()
    .min(1, "Il nome servizio è obbligatorio")
    .max(200, "Il nome è troppo lungo"),
  description: z.string().trim().max(1000, "La descrizione è troppo lunga").optional(),
  category: z
    .string()
    .trim()
    .min(1, "La categoria è obbligatoria")
    .max(100, "La categoria è troppo lunga"),
  net_price: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Il prezzo deve essere un numero valido con massimo 2 decimali")
    .refine((val) => parseFloat(val) >= 0, "Il prezzo netto non può essere negativo"),
  gross_price: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Il prezzo deve essere un numero valido con massimo 2 decimali")
    .refine((val) => parseFloat(val) >= 0, "Il prezzo lordo non può essere negativo"),
});

interface Service {
  id: string;
  code: string;
  name: string;
  description?: string;
  category: string;
  net_price: number;
  gross_price: number;
  budget_template_id?: string;
}

interface PaymentSplit {
  id?: string;
  payment_mode_id: string;
  percentage: string;
  payment_term_id: string;
}

interface ServiceFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingService: Service | null;
  onSuccess: () => void;
}

interface BudgetTemplate {
  id: string;
  name: string;
  discipline: string;
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

export const ServiceFormDialog = ({
  open,
  onOpenChange,
  editingService,
  onSuccess,
}: ServiceFormDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [budgetTemplates, setBudgetTemplates] = useState<BudgetTemplate[]>([]);
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    description: "",
    category: "",
    net_price: "",
    gross_price: "",
    budget_template_id: "",
  });
  const [paymentSplits, setPaymentSplits] = useState<PaymentSplit[]>([]);

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

  // Fetch existing payment splits when editing
  const { data: existingSplits = [] } = useQuery({
    queryKey: ['service-payment-splits', editingService?.id],
    queryFn: async () => {
      if (!editingService?.id) return [];
      const { data, error } = await supabase
        .from('service_payment_splits')
        .select('*')
        .eq('service_id', editingService.id)
        .order('display_order');

      if (error) throw error;
      return data || [];
    },
    enabled: !!editingService?.id,
  });

  useEffect(() => {
    loadBudgetTemplates();
  }, []);

  useEffect(() => {
    if (editingService) {
      const grossPrice = (editingService.net_price * 1.22).toFixed(2);
      setFormData({
        code: editingService.code,
        name: editingService.name,
        description: editingService.description || "",
        category: editingService.category,
        net_price: editingService.net_price.toString(),
        gross_price: grossPrice,
        budget_template_id: editingService.budget_template_id || "",
      });
    } else {
      resetForm();
    }
  }, [editingService, open]);

  // Update payment splits when existing splits are loaded
  useEffect(() => {
    if (existingSplits.length > 0) {
      setPaymentSplits(existingSplits.map(split => ({
        id: split.id,
        payment_mode_id: split.payment_mode_id,
        percentage: split.percentage.toString(),
        payment_term_id: split.payment_term_id || "",
      })));
    } else if (!editingService) {
      setPaymentSplits([]);
    }
  }, [existingSplits, editingService]);

  const loadBudgetTemplates = async () => {
    const { data } = await supabase
      .from("budget_templates")
      .select("id, name, discipline")
      .order("name");
    
    if (data) {
      setBudgetTemplates(data);
    }
  };

  const resetForm = () => {
    setFormData({
      code: "",
      name: "",
      description: "",
      category: "",
      net_price: "",
      gross_price: "",
      budget_template_id: "",
    });
    setPaymentSplits([]);
  };

  const addPaymentSplit = () => {
    setPaymentSplits([...paymentSplits, {
      payment_mode_id: "",
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

  const validatePaymentSplits = (): boolean => {
    if (paymentSplits.length === 0) return true;

    // Check all fields are filled
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

    // Check total is 100%
    const total = paymentSplits.reduce((sum, split) => sum + (parseFloat(split.percentage) || 0), 0);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = serviceSchema.safeParse(formData);
    if (!result.success) {
      const errors = result.error.errors.map((e) => e.message).join(", ");
      toast({
        title: "Errore di validazione",
        description: errors,
        variant: "destructive",
      });
      return;
    }

    if (!validatePaymentSplits()) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({
        title: "Errore",
        description: "Utente non autenticato",
        variant: "destructive",
      });
      return;
    }

    const serviceData = {
      user_id: user.id,
      code: result.data.code,
      name: result.data.name,
      description: result.data.description || null,
      category: result.data.category,
      net_price: parseFloat(result.data.net_price),
      gross_price: parseFloat(result.data.gross_price),
      budget_template_id: formData.budget_template_id || null,
      payment_terms: null, // Clear old field since we're using splits
    };

    let serviceId: string;

    if (editingService) {
      // Update existing service
      const { error } = await supabase
        .from("services")
        .update(serviceData)
        .eq("id", editingService.id);

      if (error) {
        toast({
          title: "Errore",
          description: error.message || "Impossibile aggiornare il servizio",
          variant: "destructive",
        });
        return;
      }
      serviceId = editingService.id;

      // Delete existing splits and recreate
      await supabase
        .from("service_payment_splits")
        .delete()
        .eq("service_id", serviceId);

      toast({
        title: "Servizio aggiornato",
        description: "Il servizio è stato modificato con successo",
      });
    } else {
      // Create new service
      const { data, error } = await supabase
        .from("services")
        .insert(serviceData)
        .select()
        .single();

      if (error) {
        if (error.code === "23505") {
          toast({
            title: "Errore",
            description: "Un servizio con questo codice esiste già",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Errore",
            description: error.message || "Impossibile creare il servizio",
            variant: "destructive",
          });
        }
        return;
      }
      serviceId = data.id;

      toast({
        title: "Servizio creato",
        description: "Il servizio è stato creato con successo",
      });
    }

    // Insert payment splits
    if (paymentSplits.length > 0) {
      const splitsToInsert = paymentSplits.map((split, index) => ({
        service_id: serviceId,
        payment_mode_id: split.payment_mode_id,
        percentage: parseFloat(split.percentage),
        payment_term_id: split.payment_term_id || null,
        display_order: index,
      }));

      const { error: splitsError } = await supabase
        .from("service_payment_splits")
        .insert(splitsToInsert);

      if (splitsError) {
        console.error("Error inserting payment splits:", splitsError);
        toast({
          title: "Attenzione",
          description: "Servizio salvato ma errore nel salvataggio delle modalità di pagamento",
          variant: "destructive",
        });
      }
    }

    queryClient.invalidateQueries({ queryKey: ['service-payment-splits'] });
    onSuccess();
    onOpenChange(false);
    resetForm();
  };

  const handleDialogOpenChange = (open: boolean) => {
    onOpenChange(open);
    if (!open) {
      resetForm();
    }
  };

  const getTotalPercentage = () => {
    return paymentSplits.reduce((sum, split) => sum + (parseFloat(split.percentage) || 0), 0);
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingService ? "Modifica servizio" : "Crea nuovo servizio"}
          </DialogTitle>
          <DialogDescription>
            {editingService
              ? "Modifica i dati del servizio"
              : "Inserisci i dati per creare un nuovo servizio"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="code">Codice *</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="SRV-001"
                required
              />
            </div>
            <div>
              <Label htmlFor="category">Categoria *</Label>
              <Input
                id="category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                placeholder="Consulenza"
                required
              />
            </div>
          </div>
          <div>
            <Label htmlFor="name">Nome Servizio *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Nome del servizio"
              required
            />
          </div>
          <div>
            <Label htmlFor="description">Descrizione</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Descrizione del servizio"
              rows={3}
            />
          </div>
          
          {/* Payment Splits Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-medium">Modalità e termini di pagamento</Label>
              <Button type="button" variant="outline" size="sm" onClick={addPaymentSplit}>
                <Plus className="h-4 w-4 mr-1" />
                Aggiungi
              </Button>
            </div>
            
            {paymentSplits.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nessuna modalità di pagamento configurata. Clicca "Aggiungi" per definire le modalità.
              </p>
            ) : (
              <div className="space-y-2">
                {paymentSplits.map((split, index) => (
                  <Card key={index} className="bg-muted/30">
                    <CardContent className="p-3">
                      <div className="grid grid-cols-[1fr_80px_1fr_auto] gap-2 items-end">
                        <div>
                          <Label className="text-xs">Modalità</Label>
                          <Select
                            value={split.payment_mode_id}
                            onValueChange={(value) => updatePaymentSplit(index, 'payment_mode_id', value)}
                          >
                            <SelectTrigger className="h-9">
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
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="net_price">Prezzo Netto (€) *</Label>
              <Input
                id="net_price"
                type="text"
                value={formData.net_price}
                onChange={(e) => {
                  const netPrice = e.target.value;
                  const grossPrice = netPrice ? (parseFloat(netPrice) * 1.22).toFixed(2) : "";
                  setFormData({ ...formData, net_price: netPrice, gross_price: grossPrice });
                }}
                placeholder="99.99"
                required
              />
            </div>
            <div>
              <Label htmlFor="gross_price">Prezzo Lordo (€) <span className="text-muted-foreground text-xs">(IVA 22%)</span></Label>
              <Input
                id="gross_price"
                type="text"
                value={formData.gross_price}
                disabled
                className="bg-muted"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="budget_template_id">Template di Budget (Opzionale)</Label>
            <Select
              value={formData.budget_template_id || undefined}
              onValueChange={(value) => setFormData({ ...formData, budget_template_id: value === "none" ? "" : value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Nessun template" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nessun template</SelectItem>
                {budgetTemplates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name} ({template.discipline})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" className="w-full">
            {editingService ? "Salva Modifiche" : "Crea Servizio"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
