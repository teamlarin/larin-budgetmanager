import { useState, useEffect, useMemo } from "react";
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
import { Trash2, Edit, Plus, X, Check } from "lucide-react";
import { AREA_LABELS, getAreaColor, getAreaLabel } from "@/lib/areaColors";

interface Level {
  id: string;
  name: string;
  area: string;
  hourly_rate: number;
}

interface ActivityCategory {
  id: string;
  name: string;
  areas: string[];
}

type LevelArea = "marketing" | "tech" | "branding" | "sales";

const AREAS: { value: LevelArea; label: string }[] = [
  { value: "marketing", label: AREA_LABELS.marketing },
  { value: "tech", label: AREA_LABELS.tech },
  { value: "branding", label: AREA_LABELS.branding },
  { value: "sales", label: AREA_LABELS.sales },
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
  area: LevelArea;
  template_data: TemplateActivity[];
}

interface Service {
  id: string;
  name: string;
  code: string;
  budget_template_id: string | null;
}

const categoryColors: string[] = [
  'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
  'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
];

const getCategoryColor = (categoryName: string): string => {
  let hash = 0;
  for (let i = 0; i < categoryName.length; i++) {
    hash = categoryName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % categoryColors.length;
  return categoryColors[index];
};

export const BudgetTemplateManagement = () => {
  const [allTemplates, setAllTemplates] = useState<BudgetTemplate[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [categories, setCategories] = useState<ActivityCategory[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<BudgetTemplate | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    area: "" as LevelArea | "",
  });
  const [activities, setActivities] = useState<TemplateActivity[]>([]);
  const [newActivity, setNewActivity] = useState({
    activityName: "",
    category: "",
    levelId: "",
    hours: 0,
  });
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);

  const totalPages = Math.ceil(allTemplates.length / ITEMS_PER_PAGE);
  const templates = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return allTemplates.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [allTemplates, currentPage]);

  useEffect(() => {
    fetchTemplates();
    fetchLevels();
    fetchCategories();
    fetchServices();
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

    setLevels(data || []);
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

  const fetchServices = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("services")
      .select("id, name, code, budget_template_id")
      .not("budget_template_id", "is", null)
      .order("name");

    if (error) {
      console.error("Error fetching services:", error);
      return;
    }

    setServices(data || []);
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

    if (!formData.area) {
      toast({
        title: "Errore",
        description: "Seleziona un'area per il modello",
        variant: "destructive",
      });
      return;
    }

    const templateData = {
      name: formData.name,
      description: formData.description,
      area: formData.area as LevelArea,
      template_data: activities as any,
    };

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

      toast({
        title: "Successo",
        description: "Modello aggiornato con successo",
      });
    } else {
      const { error } = await supabase
        .from("budget_templates")
        .insert([{ ...templateData, user_id: user.id }]);

      if (error) {
        toast({
          title: "Errore",
          description: "Impossibile creare il modello",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Successo",
        description: "Modello creato con successo",
      });
    }

    setDialogOpen(false);
    resetForm();
    fetchTemplates();
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
      area: template.area,
    });
    setActivities(template.template_data || []);
    setDialogOpen(true);
  };

  const resetForm = () => {
    setEditingTemplate(null);
    setFormData({
      name: "",
      description: "",
      area: "",
    });
    setActivities([]);
    setNewActivity({
      activityName: "",
      category: "",
      levelId: "",
      hours: 0,
    });
    setEditingActivityId(null);
  };

  if (loading) {
    return <div>Caricamento...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Modelli di Budget</h3>
          <p className="text-sm text-muted-foreground">
            Totale: {allTemplates.length} {allTemplates.length === 1 ? 'modello' : 'modelli'}
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nuovo Modello
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingTemplate ? "Modifica Modello" : "Nuovo Modello"}</DialogTitle>
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
                  <Label htmlFor="area">Area *</Label>
                  <Select
                    value={formData.area}
                    onValueChange={(value) => setFormData({ ...formData, area: value as LevelArea })}
                    required
                  >
                    <SelectTrigger id="area">
                      <SelectValue placeholder="Seleziona area" />
                    </SelectTrigger>
                    <SelectContent>
                      {AREAS.map((area) => (
                        <SelectItem key={area.value} value={area.value}>
                          {area.label}
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
                {editingTemplate && services.filter(s => s.budget_template_id === editingTemplate.id).length > 0 && (
                  <div>
                    <Label>Servizi associati</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {services
                        .filter(s => s.budget_template_id === editingTemplate.id)
                        .map(service => (
                          <Badge key={service.id} variant="secondary">
                            {service.code} - {service.name}
                          </Badge>
                        ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <Label className="text-base font-semibold">Attività</Label>
                </div>

                {activities.length > 0 && (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Attività</TableHead>
                          <TableHead>Categoria</TableHead>
                          <TableHead>Figura</TableHead>
                          <TableHead>Ore</TableHead>
                          <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {activities.map((activity) => {
                          const isEditing = editingActivityId === activity.id;
                          return (
                            <TableRow key={activity.id}>
                              <TableCell className="font-medium">
                                {isEditing ? (
                                  <Input
                                    value={activity.activityName}
                                    onChange={(e) => handleUpdateActivity(activity.id, 'activityName', e.target.value)}
                                  />
                                ) : (
                                  activity.activityName
                                )}
                              </TableCell>
                              <TableCell>
                                {isEditing ? (
                                  <Select
                                    value={activity.category}
                                    onValueChange={(value) => handleUpdateActivity(activity.id, 'category', value)}
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {categories
                                        .filter((cat) => formData.area && cat.areas.includes(formData.area))
                                        .map((cat) => (
                                          <SelectItem key={cat.id} value={cat.name}>
                                            {cat.name}
                                          </SelectItem>
                                        ))}
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <Badge className={getCategoryColor(activity.category)}>
                                    {activity.category}
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                {isEditing ? (
                                  <Select
                                    value={activity.levelId}
                                    onValueChange={(value) => handleUpdateActivity(activity.id, 'levelId', value)}
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
                                    onChange={(e) => handleUpdateActivity(activity.id, 'hours', parseFloat(e.target.value) || 0)}
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
                                      onClick={handleSaveActivity}
                                    >
                                      <Check className="h-4 w-4" />
                                    </Button>
                                  ) : (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleEditActivity(activity)}
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                  )}
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleRemoveActivity(activity.id)}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}

                <Card>
                  <CardContent className="pt-6">
                    <div className="space-y-4">
                      <h4 className="text-sm font-medium">Aggiungi Attività</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                          <Label htmlFor="activityName">Nome Attività</Label>
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
                            disabled={!formData.area}
                          >
                            <SelectTrigger id="category">
                              <SelectValue placeholder={!formData.area ? "Seleziona prima un'area" : "Seleziona categoria"} />
                            </SelectTrigger>
                            <SelectContent>
                              {categories
                                .filter((cat) => formData.area && cat.areas.includes(formData.area))
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

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Area</TableHead>
                <TableHead>Ore totali</TableHead>
                <TableHead>Costo totale</TableHead>
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
                  
                  const associatedServices = services.filter(s => s.budget_template_id === template.id);
                  
                  return (
                    <TableRow key={template.id}>
                      <TableCell className="font-medium">{template.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={getAreaColor(template.area)}>
                          {getAreaLabel(template.area)}
                        </Badge>
                      </TableCell>
                      <TableCell>{totalHours}h</TableCell>
                      <TableCell>€{totalCost.toFixed(2)}</TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {template.template_data?.length || 0} attività
                        </span>
                      </TableCell>
                      <TableCell>
                        {associatedServices.length > 0 ? (
                          <div className="flex flex-col gap-1">
                            {associatedServices.map(service => (
                              <Badge key={service.id} variant="secondary" className="text-xs">
                                {service.code} - {service.name}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(template)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(template.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
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