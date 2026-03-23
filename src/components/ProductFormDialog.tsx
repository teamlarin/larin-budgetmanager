import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { Plus, Trash2 } from "lucide-react";
import { useProductServiceCategories } from "@/hooks/useProductServiceCategories";

const productSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Il codice è obbligatorio")
    .max(50, "Il codice è troppo lungo"),
  name: z
    .string()
    .trim()
    .min(1, "Il nome prodotto è obbligatorio")
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

interface PaymentSplit {
  id?: string;
  payment_mode_id: string;
  percentage: string;
  payment_term_id: string;
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

interface Product {
  id: string;
  code: string;
  name: string;
  description?: string;
  category: string;
  net_price: number;
  gross_price: number;
}

interface ProductFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingProduct: Product | null;
  onSuccess: () => void;
}

export const ProductFormDialog = ({
  open,
  onOpenChange,
  editingProduct,
  onSuccess,
}: ProductFormDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    description: "",
    category: "",
    net_price: "",
    gross_price: "",
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

  // Fetch existing payment splits for this product
  const { data: existingSplits = [] } = useQuery({
    queryKey: ['product-payment-splits', editingProduct?.id],
    queryFn: async () => {
      if (!editingProduct?.id) return [];
      const { data, error } = await supabase
        .from('product_payment_splits')
        .select('*')
        .eq('product_id', editingProduct.id)
        .order('display_order');

      if (error) throw error;
      return data || [];
    },
    enabled: !!editingProduct?.id && open,
  });

  useEffect(() => {
    if (editingProduct) {
      const grossPrice = (editingProduct.net_price * 1.22).toFixed(2);
      setFormData({
        code: editingProduct.code,
        name: editingProduct.name,
        description: editingProduct.description || "",
        category: editingProduct.category,
        net_price: editingProduct.net_price.toString(),
        gross_price: grossPrice,
      });
    } else {
      resetForm();
    }
  }, [editingProduct, open]);

  useEffect(() => {
    if (open && existingSplits.length > 0) {
      setPaymentSplits(existingSplits.map(split => ({
        id: split.id,
        payment_mode_id: split.payment_mode_id,
        percentage: split.percentage.toString(),
        payment_term_id: split.payment_term_id || "",
      })));
    } else if (open && !editingProduct) {
      setPaymentSplits([]);
    }
  }, [existingSplits, open, editingProduct]);

  const resetForm = () => {
    setFormData({
      code: "",
      name: "",
      description: "",
      category: "",
      net_price: "",
      gross_price: "",
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = productSchema.safeParse(formData);
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

    const productData = {
      user_id: user.id,
      code: result.data.code,
      name: result.data.name,
      description: result.data.description || null,
      category: result.data.category,
      net_price: parseFloat(result.data.net_price),
      gross_price: parseFloat(result.data.gross_price),
    };

    let productId = editingProduct?.id;

    if (editingProduct) {
      // Update existing product
      const { error } = await supabase
        .from("products")
        .update(productData)
        .eq("id", editingProduct.id);

      if (error) {
        toast({
          title: "Errore",
          description: error.message || "Impossibile aggiornare il prodotto",
          variant: "destructive",
        });
        return;
      }
    } else {
      // Create new product
      const { data: newProduct, error } = await supabase
        .from("products")
        .insert(productData)
        .select('id')
        .single();

      if (error) {
        if (error.code === "23505") {
          toast({
            title: "Errore",
            description: "Un prodotto con questo codice esiste già",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Errore",
            description: error.message || "Impossibile creare il prodotto",
            variant: "destructive",
          });
        }
        return;
      }

      productId = newProduct.id;
    }

    // Handle payment splits
    if (productId) {
      // Delete existing payment splits
      await supabase
        .from('product_payment_splits')
        .delete()
        .eq('product_id', productId);

      // Insert new payment splits
      if (paymentSplits.length > 0) {
        const splitsToInsert = paymentSplits.map((split, index) => ({
          product_id: productId,
          payment_mode_id: split.payment_mode_id,
          percentage: parseFloat(split.percentage),
          payment_term_id: split.payment_term_id || null,
          display_order: index,
        }));

        const { error: splitsError } = await supabase
          .from('product_payment_splits')
          .insert(splitsToInsert);

        if (splitsError) {
          console.error('Error saving payment splits:', splitsError);
        }
      }
    }

    queryClient.invalidateQueries({ queryKey: ['product-payment-splits'] });
    queryClient.invalidateQueries({ queryKey: ['all-product-payment-splits'] });

    toast({
      title: editingProduct ? "Prodotto aggiornato" : "Prodotto creato",
      description: editingProduct 
        ? "Il prodotto è stato modificato con successo"
        : "Il prodotto è stato creato con successo",
    });

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

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingProduct ? "Modifica prodotto" : "Crea nuovo prodotto"}
          </DialogTitle>
          <DialogDescription>
            {editingProduct
              ? "Modifica i dati del prodotto"
              : "Inserisci i dati per creare un nuovo prodotto"}
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
                placeholder="PRD-001"
                required
              />
            </div>
            <div>
              <Label htmlFor="category">Categoria *</Label>
              <CategorySelect
                value={formData.category}
                onChange={(val) => setFormData({ ...formData, category: val })}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="name">Nome Prodotto *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Nome del prodotto"
              required
            />
          </div>
          <div>
            <Label htmlFor="description">Descrizione</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Descrizione del prodotto"
              rows={3}
            />
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

          {/* Payment Splits Section */}
          <div className="space-y-3 pt-4 border-t">
            <div className="flex items-center justify-between">
              <Label className="text-base font-medium">Modalità di Pagamento</Label>
              <Button type="button" variant="outline" size="sm" onClick={addPaymentSplit}>
                <Plus className="h-4 w-4 mr-1" />
                Aggiungi
              </Button>
            </div>

            {paymentSplits.length === 0 ? (
              <div className="py-4 text-center text-muted-foreground text-sm border-2 border-dashed rounded-lg">
                Nessuna modalità configurata. Clicca "Aggiungi" per definire le modalità.
              </div>
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

          <Button type="submit" className="w-full">
            {editingProduct ? "Salva Modifiche" : "Crea Prodotto"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};