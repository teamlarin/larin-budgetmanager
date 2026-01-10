import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Edit, Plus, Trash2 } from "lucide-react";
import { DISCIPLINE_LABELS } from "@/lib/disciplineColors";
import { invalidateMappingsCache } from "@/lib/areaMapping";

type LevelArea = "marketing" | "tech" | "branding" | "sales" | "interno";

const LEVEL_AREAS: { value: LevelArea; label: string }[] = [
  { value: "marketing", label: "Marketing" },
  { value: "tech", label: "Tech" },
  { value: "branding", label: "Branding" },
  { value: "sales", label: "Sales" },
  { value: "interno", label: "Interno" },
];

interface DisciplineMapping {
  id: string;
  discipline: string;
  areas: LevelArea[];
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

export const DisciplineMappingManagement = () => {
  const [mappings, setMappings] = useState<DisciplineMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMapping, setEditingMapping] = useState<DisciplineMapping | null>(null);
  const [formData, setFormData] = useState({
    discipline: "" as Discipline | "",
    areas: [] as LevelArea[],
  });

  useEffect(() => {
    fetchMappings();
  }, []);

  const fetchMappings = async () => {
    const { data, error } = await supabase
      .from("discipline_area_mappings")
      .select("*")
      .order("discipline");

    if (error) {
      toast({
        title: "Errore",
        description: "Impossibile caricare i mapping",
        variant: "destructive",
      });
      return;
    }

    setMappings((data || []) as DisciplineMapping[]);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.discipline || formData.areas.length === 0) {
      toast({
        title: "Errore",
        description: "Seleziona una disciplina e almeno un'area",
        variant: "destructive",
      });
      return;
    }

    const mappingData = {
      discipline: formData.discipline,
      areas: formData.areas,
    };

    if (editingMapping) {
      const { error } = await supabase
        .from("discipline_area_mappings")
        .update(mappingData)
        .eq("id", editingMapping.id);

      if (error) {
        toast({
          title: "Errore",
          description: "Impossibile aggiornare il mapping",
          variant: "destructive",
        });
        return;
      }
    } else {
      const { error } = await supabase
        .from("discipline_area_mappings")
        .insert([mappingData]);

      if (error) {
        toast({
          title: "Errore",
          description: "Impossibile creare il mapping",
          variant: "destructive",
        });
        return;
      }
    }

    toast({
      title: "Successo",
      description: editingMapping ? "Mapping aggiornato con successo" : "Mapping creato con successo",
    });

    invalidateMappingsCache(); // Invalida la cache dopo le modifiche
    setDialogOpen(false);
    resetForm();
    fetchMappings();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from("discipline_area_mappings")
      .delete()
      .eq("id", id);

    if (error) {
      toast({
        title: "Errore",
        description: "Impossibile eliminare il mapping",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Successo",
      description: "Mapping eliminato con successo",
    });

    invalidateMappingsCache(); // Invalida la cache dopo l'eliminazione
    fetchMappings();
  };

  const handleEdit = (mapping: DisciplineMapping) => {
    setEditingMapping(mapping);
    setFormData({
      discipline: mapping.discipline as Discipline,
      areas: mapping.areas,
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setEditingMapping(null);
    setFormData({
      discipline: "",
      areas: [],
    });
  };

  const toggleArea = (area: LevelArea) => {
    if (formData.areas.includes(area)) {
      setFormData({
        ...formData,
        areas: formData.areas.filter(a => a !== area),
      });
    } else {
      setFormData({
        ...formData,
        areas: [...formData.areas, area],
      });
    }
  };

  const getDisciplineLabel = (discipline: string): string => {
    const found = DISCIPLINES.find(d => d.value === discipline);
    return found ? found.label : discipline;
  };

  const getAvailableDisciplines = () => {
    if (editingMapping) {
      return DISCIPLINES;
    }
    const usedDisciplines = mappings.map(m => m.discipline);
    return DISCIPLINES.filter(d => !usedDisciplines.includes(d.value));
  };

  if (loading) {
    return <div>Caricamento...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Mapping Discipline - Aree</CardTitle>
            <CardDescription>
              Gestisci le associazioni tra discipline e aree (marketing, tech, branding, sales)
            </CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nuovo Mapping
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingMapping ? "Modifica Mapping" : "Nuovo Mapping"}</DialogTitle>
                <DialogDescription>
                  {editingMapping ? "Modifica il mapping tra disciplina e aree" : "Crea un nuovo mapping tra disciplina e aree"}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="discipline">Disciplina *</Label>
                  <Select
                    value={formData.discipline}
                    onValueChange={(value) => setFormData({ ...formData, discipline: value as Discipline })}
                    disabled={!!editingMapping}
                  >
                    <SelectTrigger id="discipline">
                      <SelectValue placeholder="Seleziona disciplina" />
                    </SelectTrigger>
                    <SelectContent>
                      {getAvailableDisciplines().map((discipline) => (
                        <SelectItem key={discipline.value} value={discipline.value}>
                          {discipline.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Aree *</Label>
                  <p className="text-sm text-muted-foreground mb-2">
                    Seleziona una o più aree associate a questa disciplina
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {LEVEL_AREAS.map((area) => (
                      <label
                        key={area.value}
                        className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-2 rounded"
                      >
                        <input
                          type="checkbox"
                          checked={formData.areas.includes(area.value)}
                          onChange={() => toggleArea(area.value)}
                          className="h-4 w-4"
                        />
                        <span className="text-sm">{area.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <Button type="submit" className="w-full">
                  {editingMapping ? "Aggiorna Mapping" : "Crea Mapping"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Disciplina</TableHead>
              <TableHead>Aree</TableHead>
              <TableHead className="w-[100px]">Azioni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mappings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground">
                  Nessun mapping configurato
                </TableCell>
              </TableRow>
            ) : (
              mappings.map((mapping) => (
                <TableRow key={mapping.id}>
                  <TableCell className="font-medium">
                    {getDisciplineLabel(mapping.discipline)}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {mapping.areas.map((area) => (
                        <Badge key={area} variant="secondary">
                          {LEVEL_AREAS.find(a => a.value === area)?.label || area}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(mapping)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(mapping.id)}
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
      </CardContent>
    </Card>
  );
};
