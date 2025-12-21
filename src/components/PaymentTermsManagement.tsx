import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, GripVertical } from "lucide-react";
import { z } from "zod";

const paymentTermSchema = z.object({
  value: z.string().trim().min(1, "Il valore è obbligatorio").max(100, "Il valore è troppo lungo"),
  label: z.string().trim().min(1, "L'etichetta è obbligatoria").max(100, "L'etichetta è troppo lunga"),
  display_order: z.number().int().min(0, "L'ordine deve essere positivo"),
  is_active: z.boolean(),
});

interface PaymentTerm {
  id: string;
  value: string;
  label: string;
  display_order: number;
  is_active: boolean;
}

export const PaymentTermsManagement = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTerm, setEditingTerm] = useState<PaymentTerm | null>(null);
  const [formData, setFormData] = useState({
    value: "",
    label: "",
    display_order: 0,
    is_active: true,
  });

  const { data: paymentTerms = [], isLoading } = useQuery({
    queryKey: ["payment-terms-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_terms")
        .select("*")
        .order("display_order");

      if (error) throw error;
      return data as PaymentTerm[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: Omit<PaymentTerm, "id">) => {
      const { error } = await supabase.from("payment_terms").insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment-terms-admin"] });
      queryClient.invalidateQueries({ queryKey: ["payment-terms"] });
      toast({ title: "Termine di pagamento creato" });
      closeDialog();
    },
    onError: (error: Error) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: PaymentTerm) => {
      const { error } = await supabase.from("payment_terms").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment-terms-admin"] });
      queryClient.invalidateQueries({ queryKey: ["payment-terms"] });
      toast({ title: "Termine di pagamento aggiornato" });
      closeDialog();
    },
    onError: (error: Error) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("payment_terms").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment-terms-admin"] });
      queryClient.invalidateQueries({ queryKey: ["payment-terms"] });
      toast({ title: "Termine di pagamento eliminato" });
    },
    onError: (error: Error) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingTerm(null);
    setFormData({ value: "", label: "", display_order: 0, is_active: true });
  };

  const openCreateDialog = () => {
    const maxOrder = paymentTerms.length > 0 
      ? Math.max(...paymentTerms.map(t => t.display_order)) + 1 
      : 0;
    setFormData({ value: "", label: "", display_order: maxOrder, is_active: true });
    setEditingTerm(null);
    setDialogOpen(true);
  };

  const openEditDialog = (term: PaymentTerm) => {
    setEditingTerm(term);
    setFormData({
      value: term.value,
      label: term.label,
      display_order: term.display_order,
      is_active: term.is_active,
    });
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const result = paymentTermSchema.safeParse(formData);
    if (!result.success) {
      toast({
        title: "Errore di validazione",
        description: result.error.errors.map(e => e.message).join(", "),
        variant: "destructive",
      });
      return;
    }

    const validatedData: Omit<PaymentTerm, "id"> = {
      value: result.data.value,
      label: result.data.label,
      display_order: result.data.display_order,
      is_active: result.data.is_active,
    };

    if (editingTerm) {
      updateMutation.mutate({ id: editingTerm.id, ...validatedData });
    } else {
      createMutation.mutate(validatedData);
    }
  };

  const handleDelete = (term: PaymentTerm) => {
    if (confirm(`Eliminare il termine di pagamento "${term.label}"?`)) {
      deleteMutation.mutate(term.id);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/4"></div>
            <div className="h-10 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Termini di Pagamento</CardTitle>
        <Button onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Aggiungi
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">Ordine</TableHead>
              <TableHead>Valore</TableHead>
              <TableHead>Etichetta</TableHead>
              <TableHead className="w-24">Attivo</TableHead>
              <TableHead className="w-24">Azioni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paymentTerms.map((term) => (
              <TableRow key={term.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                    {term.display_order}
                  </div>
                </TableCell>
                <TableCell className="font-mono text-sm">{term.value}</TableCell>
                <TableCell>{term.label}</TableCell>
                <TableCell>
                  <Switch
                    checked={term.is_active}
                    onCheckedChange={(checked) => {
                      updateMutation.mutate({ ...term, is_active: checked });
                    }}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(term)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(term)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {paymentTerms.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  Nessun termine di pagamento configurato
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingTerm ? "Modifica Termine di Pagamento" : "Nuovo Termine di Pagamento"}
              </DialogTitle>
              <DialogDescription>
                {editingTerm ? "Modifica i dati del termine di pagamento" : "Inserisci i dati per il nuovo termine di pagamento"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="value">Valore *</Label>
                <Input
                  id="value"
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                  placeholder="30gg DF"
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Valore tecnico salvato nel database
                </p>
              </div>
              <div>
                <Label htmlFor="label">Etichetta *</Label>
                <Input
                  id="label"
                  value={formData.label}
                  onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                  placeholder="30 giorni data fattura"
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Testo visualizzato nell'interfaccia
                </p>
              </div>
              <div>
                <Label htmlFor="display_order">Ordine di visualizzazione</Label>
                <Input
                  id="display_order"
                  type="number"
                  min="0"
                  value={formData.display_order}
                  onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label htmlFor="is_active">Attivo</Label>
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={closeDialog}>
                  Annulla
                </Button>
                <Button type="submit">
                  {editingTerm ? "Salva" : "Crea"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};
