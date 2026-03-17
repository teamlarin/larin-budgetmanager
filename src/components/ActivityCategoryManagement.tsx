import { useState, useEffect, useMemo } from "react";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { AREA_LABELS, getAreaColor, getAreaLabel } from "@/lib/areaColors";

interface ActivityCategory {
  id: string;
  name: string;
  areas: LevelArea[];
  created_at: string;
  updated_at: string;
}

type LevelArea = "marketing" | "tech" | "branding" | "sales" | "interno" | "ai";

const AREAS: { value: LevelArea; label: string }[] = [
  { value: "marketing", label: AREA_LABELS.marketing },
  { value: "tech", label: AREA_LABELS.tech },
  { value: "branding", label: AREA_LABELS.branding },
  { value: "sales", label: AREA_LABELS.sales },
  { value: "ai", label: AREA_LABELS.ai },
  { value: "interno", label: AREA_LABELS.interno },
];

export const ActivityCategoryManagement = () => {
  const { toast } = useToast();
  const [allCategories, setAllCategories] = useState<ActivityCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ActivityCategory | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;
  const [formData, setFormData] = useState({
    name: "",
    areas: [] as LevelArea[],
  });

  const totalPages = Math.ceil(allCategories.length / ITEMS_PER_PAGE);
  const categories = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return allCategories.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [allCategories, currentPage]);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("activity_categories")
        .select("*")
        .eq("user_id", user.id)
        .order("name", { ascending: true });

      if (error) throw error;
      setAllCategories(data || []);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Errore",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast({
        variant: "destructive",
        title: "Errore",
        description: "Il nome della categoria è obbligatorio",
      });
      return;
    }

    if (formData.areas.length === 0) {
      toast({
        variant: "destructive",
        title: "Errore",
        description: "Seleziona almeno un'area",
      });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (editingCategory) {
        const { error } = await supabase
          .from("activity_categories")
          .update({
            name: formData.name,
            areas: formData.areas,
          })
          .eq("id", editingCategory.id);

        if (error) throw error;
        toast({
          title: "Successo",
          description: "Categoria aggiornata con successo",
        });
      } else {
        const { error } = await supabase
          .from("activity_categories")
          .insert([{
            user_id: user.id,
            name: formData.name,
            areas: formData.areas,
          }]);

        if (error) throw error;
        toast({
          title: "Successo",
          description: "Categoria creata con successo",
        });
      }

      setIsDialogOpen(false);
      resetForm();
      fetchCategories();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Errore",
        description: error.message,
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Sei sicuro di voler eliminare questa categoria?")) return;

    try {
      const { error } = await supabase
        .from("activity_categories")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast({
        title: "Successo",
        description: "Categoria eliminata con successo",
      });
      fetchCategories();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Errore",
        description: error.message,
      });
    }
  };

  const handleEdit = (category: ActivityCategory) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      areas: category.areas,
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({ name: "", areas: [] as LevelArea[] });
    setEditingCategory(null);
  };

  const handleAreaToggle = (areaValue: LevelArea) => {
    setFormData((prev) => ({
      ...prev,
      areas: prev.areas.includes(areaValue)
        ? prev.areas.filter((a) => a !== areaValue)
        : [...prev.areas, areaValue],
    }));
  };

  if (loading) {
    return <div className="text-center p-8">Caricamento...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Categorie Attività</h2>
          <p className="text-muted-foreground">
            Totale: {allCategories.length} {allCategories.length === 1 ? 'categoria' : 'categorie'}
          </p>
        </div>
        <Button
          onClick={() => {
            resetForm();
            setIsDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Nuova Categoria
        </Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Aree Assegnate</TableHead>
              <TableHead className="text-right">Azioni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground">
                  Nessuna categoria trovata. Crea la tua prima categoria!
                </TableCell>
              </TableRow>
            ) : (
              categories.map((category) => (
                <TableRow key={category.id}>
                  <TableCell className="font-medium">{category.name}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {category.areas.map((area) => (
                        <Badge
                          key={area}
                          variant="outline"
                          className={getAreaColor(area as LevelArea)}
                        >
                          {getAreaLabel(area as LevelArea)}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(category)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(category.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        
        {totalPages > 1 && (
          <div className="p-4">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious 
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                  />
                </PaginationItem>
                
                {[...Array(totalPages)].map((_, i) => {
                  const page = i + 1;
                  if (page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1)) {
                    return (
                      <PaginationItem key={page}>
                        <PaginationLink
                          onClick={() => setCurrentPage(page)}
                          isActive={currentPage === page}
                          className="cursor-pointer"
                        >
                          {page}
                        </PaginationLink>
                      </PaginationItem>
                    );
                  } else if (page === currentPage - 2 || page === currentPage + 2) {
                    return <PaginationEllipsis key={page} />;
                  }
                  return null;
                })}
                
                <PaginationItem>
                  <PaginationNext 
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>
                {editingCategory ? "Modifica Categoria" : "Nuova Categoria"}
              </DialogTitle>
              <DialogDescription>
                Inserisci i dettagli della categoria attività
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome Categoria *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="es. Management, Design, Development..."
                />
              </div>

              <div className="space-y-2">
                <Label>Aree Assegnate *</Label>
                <div className="space-y-2">
                  {AREAS.map((area) => (
                    <div key={area.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`area-${area.value}`}
                        checked={formData.areas.includes(area.value)}
                        onCheckedChange={() => handleAreaToggle(area.value)}
                      />
                      <Label
                        htmlFor={`area-${area.value}`}
                        className="font-normal cursor-pointer"
                      >
                        {area.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsDialogOpen(false);
                  resetForm();
                }}
              >
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
