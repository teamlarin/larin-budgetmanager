import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

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
  payment_terms: z.string().trim().max(500, "Le modalità di pagamento sono troppo lunghe").optional(),
});

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
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    description: "",
    category: "",
    net_price: "",
    gross_price: "",
    payment_terms: "",
  });

  const { data: paymentTermsOptions = [] } = useQuery({
    queryKey: ['payment-terms'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_terms')
        .select('*')
        .eq('is_active', true)
        .order('display_order');

      if (error) throw error;
      return data.map((pt: { value: string; label: string }) => ({ value: pt.value, label: pt.label }));
    },
  });

  useEffect(() => {
    if (editingProduct) {
      setFormData({
        code: editingProduct.code,
        name: editingProduct.name,
        description: editingProduct.description || "",
        category: editingProduct.category,
        net_price: editingProduct.net_price.toString(),
        gross_price: editingProduct.gross_price.toString(),
        payment_terms: (editingProduct as any).payment_terms || "",
      });
    } else {
      resetForm();
    }
  }, [editingProduct, open]);

  const resetForm = () => {
    setFormData({
      code: "",
      name: "",
      description: "",
      category: "",
      net_price: "",
      gross_price: "",
      payment_terms: "",
    });
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
      payment_terms: result.data.payment_terms || null,
    };

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

      toast({
        title: "Prodotto aggiornato",
        description: "Il prodotto è stato modificato con successo",
      });
    } else {
      // Create new product
      const { error } = await supabase.from("products").insert(productData);

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

      toast({
        title: "Prodotto creato",
        description: "Il prodotto è stato creato con successo",
      });
    }

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
      <DialogContent className="max-w-2xl">
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
              <Input
                id="category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                placeholder="Elettronica"
                required
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
          <div>
            <Label htmlFor="payment_terms">Modalità di Pagamento</Label>
            <Select
              value={formData.payment_terms || "none"}
              onValueChange={(value) => setFormData({ ...formData, payment_terms: value === "none" ? "" : value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleziona modalità di pagamento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nessuno</SelectItem>
                {paymentTermsOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="net_price">Prezzo Netto (€) *</Label>
              <Input
                id="net_price"
                type="text"
                value={formData.net_price}
                onChange={(e) => setFormData({ ...formData, net_price: e.target.value })}
                placeholder="99.99"
                required
              />
            </div>
            <div>
              <Label htmlFor="gross_price">Prezzo Lordo (€) *</Label>
              <Input
                id="gross_price"
                type="text"
                value={formData.gross_price}
                onChange={(e) => setFormData({ ...formData, gross_price: e.target.value })}
                placeholder="122.00"
                required
              />
            </div>
          </div>
          <Button type="submit" className="w-full">
            {editingProduct ? "Salva Modifiche" : "Crea Prodotto"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
