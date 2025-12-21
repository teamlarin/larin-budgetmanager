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
  payment_terms: z.string().trim().max(500, "Le modalità di pagamento sono troppo lunghe").optional(),
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

export const ServiceFormDialog = ({
  open,
  onOpenChange,
  editingService,
  onSuccess,
}: ServiceFormDialogProps) => {
  const { toast } = useToast();
  const [budgetTemplates, setBudgetTemplates] = useState<BudgetTemplate[]>([]);
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    description: "",
    category: "",
    net_price: "",
    gross_price: "",
    budget_template_id: "",
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
    loadBudgetTemplates();
  }, []);

  useEffect(() => {
    if (editingService) {
      setFormData({
        code: editingService.code,
        name: editingService.name,
        description: editingService.description || "",
        category: editingService.category,
        net_price: editingService.net_price.toString(),
        gross_price: editingService.gross_price.toString(),
        budget_template_id: editingService.budget_template_id || "",
        payment_terms: (editingService as any).payment_terms || "",
      });
    } else {
      resetForm();
    }
  }, [editingService, open]);

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
      payment_terms: "",
    });
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
      payment_terms: result.data.payment_terms || null,
    };

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

      toast({
        title: "Servizio aggiornato",
        description: "Il servizio è stato modificato con successo",
      });
    } else {
      // Create new service
      const { error } = await supabase.from("services").insert(serviceData);

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

      toast({
        title: "Servizio creato",
        description: "Il servizio è stato creato con successo",
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