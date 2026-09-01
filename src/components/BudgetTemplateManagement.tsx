import { useState, useEffect, useMemo } from "react";
import { formatHours } from '@/lib/utils';
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Trash2, Edit, Plus, X, Check, Search, ArrowUpDown, ArrowUp, ArrowDown, Copy, MoreHorizontal, GripVertical } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DISCIPLINE_LABELS, getDisciplineColor, getDisciplineLabel } from "@/lib/disciplineColors";
import { getDisciplineAreas, fetchDisciplineMappings } from "@/lib/areaMapping";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';

interface Level {
  id: string;
  name: string;
  areas: string[];
  hourly_rate: number;
}

interface ActivityCategory {
  id: string;
  name: string;
  areas: string[];
}

type Discipline = 
  | "content_creation_storytelling"
  | "paid_advertising_media_buying"
  | "website_landing_page_development"
  | "brand_identity_visual_design"
  | "social_media_management"
  | "email_marketing_automation"
  | "seo_content_optimization"
  | "crm_customer_data_platform"
  | "software_development_integration"
  | "ai_implementation_automation"
  | "strategic_consulting";

const DISCIPLINES: { value: Discipline; label: string }[] = [
  { value: "content_creation_storytelling", label: DISCIPLINE_LABELS.content_creation_storytelling },
  { value: "paid_advertising_media_buying", label: DISCIPLINE_LABELS.paid_advertising_media_buying },
  { value: "website_landing_page_development", label: DISCIPLINE_LABELS.website_landing_page_development },
  { value: "brand_identity_visual_design", label: DISCIPLINE_LABELS.brand_identity_visual_design },
  { value: "social_media_management", label: DISCIPLINE_LABELS.social_media_management },
  { value: "email_marketing_automation", label: DISCIPLINE_LABELS.email_marketing_automation },
  { value: "seo_content_optimization", label: DISCIPLINE_LABELS.seo_content_optimization },
  { value: "crm_customer_data_platform", label: DISCIPLINE_LABELS.crm_customer_data_platform },
  { value: "software_development_integration", label: DISCIPLINE_LABELS.software_development_integration },
  { value: "ai_implementation_automation", label: DISCIPLINE_LABELS.ai_implementation_automation },
  { value: "strategic_consulting", label: DISCIPLINE_LABELS.strategic_consulting },
];

interface TemplateActivity {
  id: string;
  activityName: string;
  category: string;
  levelId: string;
  levelName: string;
  hours: number;
}

interface BudgetTemplate {
  id: string;
  name: string;
  description: string | null;
  discipline: Discipline;
  template_data: TemplateActivity[];
}

interface CatalogProduct {
  id: string;
  name: string;
  code: string;
  net_price: number;
}

// Collegamento modello -> prodotti di listino: i prodotti collegati vengono
// riportati nel budget quando si applica il modello e finiscono poi
// nell'offerta generata dal budget.
interface TemplateProductLink {
  budget_template_id: string;
  product_id: string;
}

import { getDynamicCategoryColor } from '@/lib/categoryColors';

interface SortableActivityRowProps {
  activity: TemplateActivity;
  isEditing: boolean;
  onEdit: () => void;
  onSave: () => void;
  onRemove: () => void;
  onUpdate: (field: keyof TemplateActivity, value: string | number) => void;
  levels: Level[];
  categories: ActivityCategory[];
  discipline: Discipline | "";
}

const SortableActivityRow = ({
  activity,
  isEditing,
  onEdit,
  onSave,
  onRemove,
  onUpdate,
  levels,
  categories,
  discipline
}: SortableActivityRowProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: activity.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <TableRow ref={setNodeRef} style={style} className={isDragging ? 'bg-muted' : ''}>
      <TableCell className="w-[40px]">
        <button
          type="button"
          className="cursor-grab touch-none p-1 hover:bg-muted rounded"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>
      </TableCell>
      <TableCell className="font-medium">
        {isEditing ? (
          <Input
            value={activity.activityName}
            onChange={(e) => onUpdate('activityName', e.target.value)}
          />
        ) : (
          activity.activityName
        )}
      </TableCell>
      <TableCell>
        {isEditing ? (
          <Select
            value={activity.category}
            onValueChange={(value) => onUpdate('category', value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {categories
                .filter((cat) => {
                  if (!discipline) return false;
                  const disciplineAreas = getDisciplineAreas(discipline);
                  return cat.areas.some(area => disciplineAreas.includes(area));
                })
                .map((cat) => (
                  <SelectItem key={cat.id} value={cat.name}>
                    {cat.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        ) : (
          <Badge className={getDynamicCategoryColor(activity.category)}>
            {activity.category}
          </Badge>
        )}
      </TableCell>
      <TableCell>
        {isEditing ? (
          <Select
            value={activity.levelId}
            onValueChange={(value) => onUpdate('levelId', value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {levels.map((level) => (
                <SelectItem key={level.id} value={level.id}>
                  {level.name} - €{level.hourly_rate}/h
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          activity.levelName
        )}
      </TableCell>
      <TableCell>
        {isEditing ? (
          <Input
            type="number"
            min="0"
            step="0.5"
            value={activity.hours}
            onChange={(e) => onUpdate('hours', parseFloat(e.target.value) || 0)}
          />
        ) : (
          `${activity.hours}h`
        )}
      </TableCell>
      <TableCell>
        <div className="flex gap-1">
          {isEditing ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onSave}
            >
              <Check className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onEdit}
            >
              <Edit className="h-4 w-4" />
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onRemove}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
};

export const BudgetTemplateManagement = () => {
  const [allTemplates, setAllTemplates] = useState<BudgetTemplate[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [categories, setCategories] = useState<ActivityCategory[]>([]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [productLinks, setProductLinks] = useState<TemplateProductLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<BudgetTemplate | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    discipline: "" as Discipline | "",
  });
  const [activities, setActivities] = useState<TemplateActivity[]>([]);
  const [newActivity, setNewActivity] = useState({
    activityName: "",
    category: "",
    levelId: "",
    hours: 0,
  });
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [disciplineFilter, setDisciplineFilter] = useState<Discipline | "all">("all");
  const [sortColumn, setSortColumn] = useState<"name" | "discipline" | "hours" | "cost" | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [productSearchQuery, setProductSearchQuery] = useState("");

  // Drag & drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      setActivities((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleSort = (column: "name" | "discipline" | "hours" | "cost") => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const filteredProducts = useMemo(() => {
    if (!productSearchQuery) return products;
    const q = productSearchQuery.toLowerCase();
    return products.filter(product =>
      product.name.toLowerCase().includes(q) ||
      (product.code || '').toLowerCase().includes(q)
    );
  }, [products, productSearchQuery]);

  const productIdsByTemplate = useMemo(() => {
    const map: Record<string, string[]> = {};
    productLinks.forEach(link => {
      map[link.budget_template_id] = [...(map[link.budget_template_id] || []), link.product_id];
    });
    return map;
  }, [productLinks]);

  const filteredAndSortedTemplates = useMemo(() => {
    let filtered = allTemplates;

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(template =>
        template.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply discipline filter
    if (disciplineFilter !== "all") {
      filtered = filtered.filter(template => template.discipline === disciplineFilter);
    }

    // Apply sorting
    if (sortColumn) {
      filtered = [...filtered].sort((a, b) => {
        let comparison = 0;

        if (sortColumn === "name") {
          comparison = a.name.localeCompare(b.name);
        } else if (sortColumn === "discipline") {
          comparison = getDisciplineLabel(a.discipline).localeCompare(getDisciplineLabel(b.discipline));
        } else if (sortColumn === "hours") {
          const aHours = a.template_data?.reduce((sum, activity) => sum + activity.hours, 0) || 0;
          const bHours = b.template_data?.reduce((sum, activity) => sum + activity.hours, 0) || 0;
          comparison = aHours - bHours;
        } else if (sortColumn === "cost") {
          const aCost = a.template_data?.reduce((sum, activity) => {
            const level = levels.find(l => l.id === activity.levelId);
            return sum + (activity.hours * (level?.hourly_rate || 0));
          }, 0) || 0;
          const bCost = b.template_data?.reduce((sum, activity) => {
            const level = levels.find(l => l.id === activity.levelId);
            return sum + (activity.hours * (level?.hourly_rate || 0));
          }, 0) || 0;
          comparison = aCost - bCost;
        }

        return sortDirection === "asc" ? comparison : -comparison;
      });
    }

    return filtered;
  }, [allTemplates, searchQuery, disciplineFilter, sortColumn, sortDirection, levels]);

  const totalPages = Math.ceil(filteredAndSortedTemplates.length / ITEMS_PER_PAGE);
  const templates = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredAndSortedTemplates.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredAndSortedTemplates, currentPage]);

  useEffect(() => {
    const loadData = async () => {
      await fetchDisciplineMappings(); // Carica i mapping all'avvio
      fetchTemplates();
      fetchLevels();
      fetchCategories();
      fetchProducts();
    };
    loadData();
  }, []);

  const fetchCategories = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("activity_categories")
      .select("*")
      .order("name");

    if (error) {
      toast({
        title: "Errore",
        description: "Impossibile caricare le categorie",
        variant: "destructive",
      });
      return;
    }

    setCategories(data || []);
  };

  const fetchLevels = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("levels")
      .select("*")
      .order("name");

    if (error) {
      toast({
        title: "Errore",
        description: "Impossibile caricare i livelli",
        variant: "destructive",
      });
      return;
    }

    setLevels((data || []) as unknown as Level[]);
  };

  const fetchTemplates = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("budget_templates")
      .select("*")
      .order("name");

    if (error) {
      toast({
        title: "Errore",
        description: "Impossibile caricare i modelli",
        variant: "destructive",
      });
      return;
    }

    setAllTemplates(data.map(t => ({
      ...t,
      template_data: (t.template_data as unknown as TemplateActivity[]) || []
    })) || []);
    setLoading(false);
  };

  const fetchProducts = async () => {
    const [{ data: productData, error: productError }, { data: linkData, error: linkError }] = await Promise.all([
      supabase.from("products").select("id, name, code, net_price").order("name"),
      supabase.from("budget_template_products").select("budget_template_id, product_id"),
    ]);

    if (productError) {
      console.error("Error fetching products:", productError);
    } else {
      setProducts(productData || []);
    }

    if (linkError) {
      console.error("Error fetching template products:", linkError);
    } else {
      setProductLinks(linkData || []);
    }
  };

  const handleAddActivity = () => {
    if (!newActivity.activityName || !newActivity.category || !newActivity.levelId || newActivity.hours <= 0) {
      toast({
        title: "Errore",
        description: "Compila tutti i campi dell'attività",
        variant: "destructive",
      });
      return;
    }

    const level = levels.find(l => l.id === newActivity.levelId);
    if (!level) return;

    const activity: TemplateActivity = {
      id: crypto.randomUUID(),
      activityName: newActivity.activityName,
      category: newActivity.category,
      levelId: newActivity.levelId,
      levelName: level.name,
      hours: newActivity.hours,
    };

    setActivities([...activities, activity]);
    setNewActivity({
      activityName: "",
      category: "",
      levelId: "",
      hours: 0,
    });
  };

  const handleRemoveActivity = (id: string) => {
    setActivities(activities.filter(a => a.id !== id));
  };

  const handleEditActivity = (activity: TemplateActivity) => {
    setEditingActivityId(activity.id);
  };

  const handleUpdateActivity = (id: string, field: keyof TemplateActivity, value: string | number) => {
    setActivities(activities.map(a => {
      if (a.id === id) {
        if (field === 'levelId') {
          const level = levels.find(l => l.id === value);
          return { ...a, levelId: value as string, levelName: level?.name || a.levelName };
        }
        return { ...a, [field]: value };
      }
      return a;
    }));
  };

  const handleSaveActivity = () => {
    setEditingActivityId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (!formData.discipline) {
      toast({
        title: "Errore",
        description: "Seleziona una disciplina per il modello",
        variant: "destructive",
      });
      return;
    }

    const templateData = {
      name: formData.name,
      description: formData.description,
      discipline: formData.discipline as Discipline,
      template_data: activities as any,
    };

    let templateId = editingTemplate?.id;

    if (editingTemplate) {
      const { error } = await supabase
        .from("budget_templates")
        .update(templateData)
        .eq("id", editingTemplate.id);

      if (error) {
        toast({
          title: "Errore",
          description: "Impossibile aggiornare il modello",
          variant: "destructive",
        });
        return;
      }
    } else {
      const { data: newTemplate, error } = await supabase
        .from("budget_templates")
        .insert([{ ...templateData, user_id: user.id }])
        .select()
        .single();

      if (error || !newTemplate) {
        toast({
          title: "Errore",
          description: "Impossibile creare il modello",
          variant: "destructive",
        });
        return;
      }
      
      templateId = newTemplate.id;
    }

    // Aggiorna i prodotti collegati
    if (templateId) {
      await supabase
        .from("budget_template_products")
        .delete()
        .eq("budget_template_id", templateId);

      if (selectedProductIds.length > 0) {
        const { error: productError } = await supabase
          .from("budget_template_products")
          .insert(selectedProductIds.map((productId, index) => ({
            budget_template_id: templateId as string,
            product_id: productId,
            quantity: 1,
            display_order: index,
          })));

        if (productError) {
          toast({
            title: "Avviso",
            description: "Modello salvato ma errore nel collegamento dei prodotti",
            variant: "destructive",
          });
        }
      }
    }

    toast({
      title: "Successo",
      description: editingTemplate ? "Modello aggiornato con successo" : "Modello creato con successo",
    });

    setDialogOpen(false);
    resetForm();
    fetchTemplates();
    fetchProducts();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from("budget_templates")
      .delete()
      .eq("id", id);

    if (error) {
      toast({
        title: "Errore",
        description: "Impossibile eliminare il modello",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Successo",
      description: "Modello eliminato con successo",
    });

    fetchTemplates();
  };

  const handleEdit = (template: BudgetTemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      description: template.description || "",
      discipline: template.discipline,
    });
    setActivities(template.template_data || []);
    
    // Carica i prodotti collegati a questo modello
    setSelectedProductIds(productIdsByTemplate[template.id] || []);
    
    setDialogOpen(true);
  };

  const handleDuplicate = (template: BudgetTemplate) => {
    setEditingTemplate(null); // Importante: null per creare un nuovo template
    setFormData({
      name: `${template.name} - Copia`,
      description: template.description || "",
      discipline: template.discipline,
    });
    // Duplica le attività con nuovi ID
    const duplicatedActivities = (template.template_data || []).map(activity => ({
      ...activity,
      id: crypto.randomUUID(), // Nuovo ID per ogni attività
    }));
    setActivities(duplicatedActivities);
    
    // Copia anche i prodotti collegati
    setSelectedProductIds(productIdsByTemplate[template.id] || []);
    
    setDialogOpen(true);
    
    toast({
      title: "Template copiato",
      description: "Modifica i dettagli e salva il nuovo template",
    });
  };

  const resetForm = () => {
    setEditingTemplate(null);
    setFormData({
      name: "",
      description: "",
      discipline: "",
    });
    setActivities([]);
    setNewActivity({
      activityName: "",
      category: "",
      levelId: "",
      hours: 0,
    });
    setEditingActivityId(null);
    setSelectedProductIds([]);
    setServiceSearchQuery("");
  };

  if (loading) {
    return <div>Caricamento...</div>;
  }

  const SortIcon = ({ column }: { column: "name" | "discipline" | "hours" | "cost" }) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="ml-2 h-4 w-4 inline-block" />;
    }
    return sortDirection === "asc" ? 
      <ArrowUp className="ml-2 h-4 w-4 inline-block" /> : 
      <ArrowDown className="ml-2 h-4 w-4 inline-block" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Modelli di Budget</h3>
          <p className="text-sm text-muted-foreground">
            Totale: {filteredAndSortedTemplates.length} {filteredAndSortedTemplates.length === 1 ? 'modello' : 'modelli'}
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nuovo modello
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingTemplate ? "Modifica modello" : "Nuovo modello"}</DialogTitle>
              <DialogDescription>
                {editingTemplate ? "Modifica i dettagli del modello" : "Crea un nuovo modello di budget"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Nome *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="discipline">Disciplina *</Label>
                  <Select
                    value={formData.discipline}
                    onValueChange={(value) => setFormData({ ...formData, discipline: value as Discipline })}
                    required
                  >
                    <SelectTrigger id="discipline">
                      <SelectValue placeholder="Seleziona disciplina" />
                    </SelectTrigger>
                    <SelectContent>
                      {DISCIPLINES.map((discipline) => (
                        <SelectItem key={discipline.value} value={discipline.value}>
                          {discipline.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="description">Descrizione</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                  />
                </div>
                <div>
                  <Label>Prodotti collegati</Label>
                  <p className="text-sm text-muted-foreground mb-2">
                    I prodotti collegati vengono aggiunti al budget quando si applica il modello e finiscono nell'offerta
                  </p>
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Cerca prodotto per nome o codice..."
                        value={productSearchQuery}
                        onChange={(e) => setProductSearchQuery(e.target.value)}
                        className="pl-8"
                      />
                    </div>
                    <div className="border rounded-lg p-3 space-y-2 max-h-[200px] overflow-y-auto">
                      {products.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          Nessun prodotto disponibile
                        </p>
                      ) : filteredProducts.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          Nessun prodotto trovato
                        </p>
                      ) : (
                        filteredProducts.map((product) => (
                          <label
                            key={product.id}
                            className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-2 rounded"
                          >
                            <input
                              type="checkbox"
                              checked={selectedProductIds.includes(product.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedProductIds([...selectedProductIds, product.id]);
                                } else {
                                  setSelectedProductIds(selectedProductIds.filter(id => id !== product.id));
                                }
                              }}
                              className="h-4 w-4"
                            />
                            <span className="text-sm">
                              {product.code ? `${product.code} - ` : ''}{product.name} · €{Number(product.net_price).toFixed(2)}
                            </span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <Label className="text-base font-semibold">Attività</Label>
                </div>

                {activities.length > 0 && (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                    modifiers={[restrictToVerticalAxis]}
                  >
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[40px]"></TableHead>
                            <TableHead>Attività</TableHead>
                            <TableHead>Categoria</TableHead>
                            <TableHead>Figura</TableHead>
                            <TableHead>Ore</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <SortableContext
                            items={activities.map(a => a.id)}
                            strategy={verticalListSortingStrategy}
                          >
                            {activities.map((activity) => (
                              <SortableActivityRow
                                key={activity.id}
                                activity={activity}
                                isEditing={editingActivityId === activity.id}
                                onEdit={() => handleEditActivity(activity)}
                                onSave={handleSaveActivity}
                                onRemove={() => handleRemoveActivity(activity.id)}
                                onUpdate={(field, value) => handleUpdateActivity(activity.id, field, value)}
                                levels={levels}
                                categories={categories}
                                discipline={formData.discipline}
                              />
                            ))}
                          </SortableContext>
                        </TableBody>
                      </Table>
                    </div>
                  </DndContext>
                )}

                <Card>
                  <CardContent className="pt-6">
                    <div className="space-y-4">
                      <h4 className="text-sm font-medium">Aggiungi attività</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                          <Label htmlFor="activityName">Nome attività</Label>
                          <Input
                            id="activityName"
                            value={newActivity.activityName}
                            onChange={(e) => setNewActivity({ ...newActivity, activityName: e.target.value })}
                            placeholder="Es. Project Management"
                          />
                        </div>
                        <div>
                          <Label htmlFor="category">Categoria</Label>
                          <Select
                            value={newActivity.category}
                            onValueChange={(value) => setNewActivity({ ...newActivity, category: value })}
                            disabled={!formData.discipline}
                          >
                            <SelectTrigger id="category">
                              <SelectValue placeholder={!formData.discipline ? "Seleziona prima una disciplina" : "Seleziona categoria"} />
                            </SelectTrigger>
                            <SelectContent>
                              {categories
                                .filter((cat) => {
                                  if (!formData.discipline) return false;
                                  const disciplineAreas = getDisciplineAreas(formData.discipline);
                                  return cat.areas.some(area => disciplineAreas.includes(area));
                                })
                                .map((cat) => (
                                  <SelectItem key={cat.id} value={cat.name}>
                                    {cat.name}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="level">Figura</Label>
                          <Select
                            value={newActivity.levelId}
                            onValueChange={(value) => setNewActivity({ ...newActivity, levelId: value })}
                          >
                            <SelectTrigger id="level">
                              <SelectValue placeholder="Seleziona figura" />
                            </SelectTrigger>
                            <SelectContent>
                              {levels.map((level) => (
                                <SelectItem key={level.id} value={level.id}>
                                  {level.name} - €{level.hourly_rate}/h
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="hours">Ore</Label>
                          <Input
                            id="hours"
                            type="number"
                            min="0"
                            step="0.5"
                            value={newActivity.hours || ""}
                            onChange={(e) => setNewActivity({ ...newActivity, hours: parseFloat(e.target.value) || 0 })}
                            placeholder="0"
                          />
                        </div>
                        <div className="flex items-end">
                          <Button
                            type="button"
                            onClick={handleAddActivity}
                            className="w-full"
                            variant="secondary"
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Aggiungi
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Button type="submit" className="w-full">
                {editingTemplate ? "Aggiorna Modello" : "Crea Modello"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cerca per nome..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="pl-9"
          />
        </div>
        <Select
          value={disciplineFilter}
          onValueChange={(value) => {
            setDisciplineFilter(value as Discipline | "all");
            setCurrentPage(1);
          }}
        >
          <SelectTrigger className="w-[300px]">
            <SelectValue placeholder="Filtra per disciplina" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutte le discipline</SelectItem>
            {DISCIPLINES.map((discipline) => (
              <SelectItem key={discipline.value} value={discipline.value}>
                {discipline.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead 
                  className="cursor-pointer select-none hover:bg-muted/50"
                  onClick={() => handleSort("name")}
                >
                  Nome
                  <SortIcon column="name" />
                </TableHead>
                <TableHead 
                  className="cursor-pointer select-none hover:bg-muted/50"
                  onClick={() => handleSort("discipline")}
                >
                  Disciplina
                  <SortIcon column="discipline" />
                </TableHead>
                <TableHead 
                  className="cursor-pointer select-none hover:bg-muted/50"
                  onClick={() => handleSort("hours")}
                >
                  Ore totali
                  <SortIcon column="hours" />
                </TableHead>
                <TableHead 
                  className="cursor-pointer select-none hover:bg-muted/50"
                  onClick={() => handleSort("cost")}
                >
                  Costo totale
                  <SortIcon column="cost" />
                </TableHead>
                <TableHead>Attività</TableHead>
                <TableHead>Servizi</TableHead>
                <TableHead className="text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    Nessun modello trovato
                  </TableCell>
                </TableRow>
              ) : (
                templates.map((template) => {
                  const totalHours = template.template_data?.reduce((sum, activity) => sum + activity.hours, 0) || 0;
                  const totalCost = template.template_data?.reduce((sum, activity) => {
                    const level = levels.find(l => l.id === activity.levelId);
                    return sum + (activity.hours * (level?.hourly_rate || 0));
                  }, 0) || 0;
                  
                  const associatedProducts = (productIdsByTemplate[template.id] || [])
                    .map(id => products.find(p => p.id === id))
                    .filter(Boolean) as CatalogProduct[];
                  
                  return (
                    <TableRow key={template.id}>
                      <TableCell className="font-medium">{template.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={getDisciplineColor(template.discipline)}>
                          {getDisciplineLabel(template.discipline)}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatHours(totalHours)}</TableCell>
                      <TableCell>€{totalCost.toFixed(2)}</TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {template.template_data?.length || 0} attività
                        </span>
                      </TableCell>
                      <TableCell>
                        {associatedProducts.length > 0 ? (
                          <div className="flex flex-col gap-1">
                            {associatedProducts.map(product => (
                              <Badge key={product.id} variant="secondary" className="text-xs">
                                {product.code ? `${product.code} - ` : ''}{product.name}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-popover">
                            <DropdownMenuItem onClick={() => handleEdit(template)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Modifica
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDuplicate(template)}>
                              <Copy className="h-4 w-4 mr-2" />
                              Duplica
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleDelete(template.id)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Elimina
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
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
        </CardContent>
      </Card>
    </div>
  );
};