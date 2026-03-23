import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface ProductServiceCategory {
  id: string;
  name: string;
  created_at: string;
}

export const ProductServiceCategoryManagement = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ProductServiceCategory | null>(null);
  const [name, setName] = useState("");

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["product-service-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_service_categories")
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      return data as ProductServiceCategory[];
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      toast({ variant: "destructive", title: "Errore", description: "Il nome è obbligatorio" });
      return;
    }

    try {
      if (editingCategory) {
        const { error } = await supabase
          .from("product_service_categories")
          .update({ name: trimmed })
          .eq("id", editingCategory.id);
        if (error) throw error;
        toast({ title: "Successo", description: "Categoria aggiornata" });
      } else {
        const { error } = await supabase
          .from("product_service_categories")
          .insert([{ name: trimmed }]);
        if (error) throw error;
        toast({ title: "Successo", description: "Categoria creata" });
      }
      setIsDialogOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["product-service-categories"] });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Errore", description: error.message });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Sei sicuro di voler eliminare questa categoria?")) return;
    try {
      const { error } = await supabase
        .from("product_service_categories")
        .delete()
        .eq("id", id);
      if (error) throw error;
      toast({ title: "Successo", description: "Categoria eliminata" });
      queryClient.invalidateQueries({ queryKey: ["product-service-categories"] });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Errore", description: error.message });
    }
  };

  const handleEdit = (cat: ProductServiceCategory) => {
    setEditingCategory(cat);
    setName(cat.name);
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setName("");
    setEditingCategory(null);
  };

  if (isLoading) return <div className="text-center p-8">Caricamento...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Categorie Prodotti / Servizi</h2>
          <p className="text-muted-foreground">
            Totale: {categories.length} {categories.length === 1 ? "categoria" : "categorie"}
          </p>
        </div>
        <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Nuova Categoria
        </Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead className="text-right">Azioni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.length === 0 ? (
              <TableRow>
                <TableCell colSpan={2} className="text-center text-muted-foreground">
                  Nessuna categoria trovata. Crea la tua prima categoria!
                </TableCell>
              </TableRow>
            ) : (
              categories.map((cat) => (
                <TableRow key={cat.id}>
                  <TableCell className="font-medium">{cat.name}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(cat)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(cat.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>{editingCategory ? "Modifica Categoria" : "Nuova Categoria"}</DialogTitle>
              <DialogDescription>Categoria per prodotti e servizi</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="cat-name">Nome Categoria *</Label>
                <Input
                  id="cat-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="es. Consulenza, Elettronica..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setIsDialogOpen(false); resetForm(); }}>
                Annulla
              </Button>
              <Button type="submit">
                {editingCategory ? "Salva Modifiche" : "Crea Categoria"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
