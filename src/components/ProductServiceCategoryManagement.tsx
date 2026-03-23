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
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Plus, Pencil, Trash2, ChevronRight, ChevronDown } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface Category {
  id: string;
  name: string;
  created_at: string;
}

interface Subcategory {
  id: string;
  name: string;
  category_id: string;
  created_at: string;
}

export const ProductServiceCategoryManagement = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Category dialog state
  const [isCatDialogOpen, setIsCatDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [catName, setCatName] = useState("");

  // Subcategory dialog state
  const [isSubDialogOpen, setIsSubDialogOpen] = useState(false);
  const [editingSubcategory, setEditingSubcategory] = useState<Subcategory | null>(null);
  const [subName, setSubName] = useState("");
  const [subParentId, setSubParentId] = useState("");

  // Expanded categories
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());

  const { data: categories = [], isLoading: loadingCats } = useQuery({
    queryKey: ["product-service-categories-mgmt"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_service_categories")
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      return data as Category[];
    },
  });

  const { data: subcategories = [], isLoading: loadingSubs } = useQuery({
    queryKey: ["product-service-subcategories-mgmt"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_service_subcategories")
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      return data as Subcategory[];
    },
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["product-service-categories-mgmt"] });
    queryClient.invalidateQueries({ queryKey: ["product-service-subcategories-mgmt"] });
    queryClient.invalidateQueries({ queryKey: ["product-service-categories"] });
  };

  const toggleExpand = (id: string) => {
    setExpandedCats((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // ---- Category CRUD ----
  const handleCatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = catName.trim();
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
      setIsCatDialogOpen(false);
      setCatName("");
      setEditingCategory(null);
      invalidateAll();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Errore", description: error.message });
    }
  };

  const handleCatDelete = async (id: string) => {
    if (!confirm("Sei sicuro di voler eliminare questa categoria e tutte le sue sotto-categorie?")) return;
    try {
      const { error } = await supabase.from("product_service_categories").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Successo", description: "Categoria eliminata" });
      invalidateAll();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Errore", description: error.message });
    }
  };

  // ---- Subcategory CRUD ----
  const handleSubSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = subName.trim();
    if (!trimmed) {
      toast({ variant: "destructive", title: "Errore", description: "Il nome è obbligatorio" });
      return;
    }
    try {
      if (editingSubcategory) {
        const { error } = await supabase
          .from("product_service_subcategories")
          .update({ name: trimmed })
          .eq("id", editingSubcategory.id);
        if (error) throw error;
        toast({ title: "Successo", description: "Sotto-categoria aggiornata" });
      } else {
        const { error } = await supabase
          .from("product_service_subcategories")
          .insert([{ name: trimmed, category_id: subParentId }]);
        if (error) throw error;
        toast({ title: "Successo", description: "Sotto-categoria creata" });
      }
      setIsSubDialogOpen(false);
      setSubName("");
      setEditingSubcategory(null);
      setSubParentId("");
      invalidateAll();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Errore", description: error.message });
    }
  };

  const handleSubDelete = async (id: string) => {
    if (!confirm("Sei sicuro di voler eliminare questa sotto-categoria?")) return;
    try {
      const { error } = await supabase.from("product_service_subcategories").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Successo", description: "Sotto-categoria eliminata" });
      invalidateAll();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Errore", description: error.message });
    }
  };

  if (loadingCats || loadingSubs) return <div className="text-center p-8">Caricamento...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Categorie Prodotti / Servizi</h2>
          <p className="text-muted-foreground">
            {categories.length} {categories.length === 1 ? "categoria" : "categorie"}, {subcategories.length} sotto-{subcategories.length === 1 ? "categoria" : "categorie"}
          </p>
        </div>
        <Button onClick={() => { setCatName(""); setEditingCategory(null); setIsCatDialogOpen(true); }}>
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
              categories.map((cat) => {
                const subs = subcategories.filter((s) => s.category_id === cat.id);
                const isExpanded = expandedCats.has(cat.id);
                return (
                  <Collapsible key={cat.id} asChild open={isExpanded} onOpenChange={() => toggleExpand(cat.id)}>
                    <>
                      <TableRow>
                        <TableCell className="font-medium">
                          <CollapsibleTrigger asChild>
                            <button className="flex items-center gap-2 hover:text-primary transition-colors text-left">
                              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              {cat.name}
                              {subs.length > 0 && (
                                <span className="text-xs text-muted-foreground">({subs.length})</span>
                              )}
                            </button>
                          </CollapsibleTrigger>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSubParentId(cat.id);
                                setSubName("");
                                setEditingSubcategory(null);
                                setIsSubDialogOpen(true);
                              }}
                              title="Aggiungi sotto-categoria"
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => { setEditingCategory(cat); setCatName(cat.name); setIsCatDialogOpen(true); }}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleCatDelete(cat.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      <CollapsibleContent asChild>
                        <>
                          {subs.map((sub) => (
                            <TableRow key={sub.id} className="bg-muted/30">
                              <TableCell className="pl-10 text-muted-foreground">
                                └ {sub.name}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-1">
                                  <Button variant="ghost" size="sm" onClick={() => { setEditingSubcategory(sub); setSubName(sub.name); setSubParentId(sub.category_id); setIsSubDialogOpen(true); }}>
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={() => handleSubDelete(sub.id)}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </>
                      </CollapsibleContent>
                    </>
                  </Collapsible>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Category Dialog */}
      <Dialog open={isCatDialogOpen} onOpenChange={setIsCatDialogOpen}>
        <DialogContent>
          <form onSubmit={handleCatSubmit}>
            <DialogHeader>
              <DialogTitle>{editingCategory ? "Modifica Categoria" : "Nuova Categoria"}</DialogTitle>
              <DialogDescription>Categoria per prodotti e servizi</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="cat-name">Nome Categoria *</Label>
                <Input id="cat-name" value={catName} onChange={(e) => setCatName(e.target.value)} placeholder="es. Consulenza, Elettronica..." />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCatDialogOpen(false)}>Annulla</Button>
              <Button type="submit">{editingCategory ? "Salva Modifiche" : "Crea Categoria"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Subcategory Dialog */}
      <Dialog open={isSubDialogOpen} onOpenChange={setIsSubDialogOpen}>
        <DialogContent>
          <form onSubmit={handleSubSubmit}>
            <DialogHeader>
              <DialogTitle>{editingSubcategory ? "Modifica Sotto-categoria" : "Nuova Sotto-categoria"}</DialogTitle>
              <DialogDescription>
                {categories.find((c) => c.id === subParentId)?.name ?? ""}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="sub-name">Nome Sotto-categoria *</Label>
                <Input id="sub-name" value={subName} onChange={(e) => setSubName(e.target.value)} placeholder="es. Strategica, Operativa..." />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsSubDialogOpen(false)}>Annulla</Button>
              <Button type="submit">{editingSubcategory ? "Salva Modifiche" : "Crea Sotto-categoria"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
