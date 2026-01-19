import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2, Building2, Users, ArrowRight, Settings2 } from "lucide-react";

interface FieldMapping {
  id: string;
  entity_type: "company" | "contact";
  hubspot_field: string;
  hubspot_field_label: string | null;
  local_field: string;
  local_field_label: string | null;
  is_active: boolean;
}

const CLIENT_FIELDS = [
  { value: "name", label: "Ragione Sociale" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Telefono" },
  { value: "notes", label: "Note" },
  { value: "default_payment_terms", label: "Termini di pagamento" },
];

const CONTACT_FIELDS = [
  { value: "first_name", label: "Nome" },
  { value: "last_name", label: "Cognome" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Telefono" },
  { value: "role", label: "Ruolo" },
  { value: "notes", label: "Note" },
];

export const HubSpotFieldMappings = () => {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMapping, setEditingMapping] = useState<FieldMapping | null>(null);
  const [formData, setFormData] = useState({
    entity_type: "company" as "company" | "contact",
    hubspot_field: "",
    hubspot_field_label: "",
    local_field: "",
    local_field_label: "",
  });

  const { data: mappings = [], isLoading } = useQuery({
    queryKey: ["hubspot-field-mappings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hubspot_field_mappings")
        .select("*")
        .order("entity_type")
        .order("hubspot_field");
      
      if (error) throw error;
      return data as FieldMapping[];
    },
  });

  const companyMappings = mappings.filter(m => m.entity_type === "company");
  const contactMappings = mappings.filter(m => m.entity_type === "contact");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.hubspot_field || !formData.local_field) {
      toast({
        title: "Errore",
        description: "Compila tutti i campi obbligatori",
        variant: "destructive",
      });
      return;
    }

    const localFields = formData.entity_type === "company" ? CLIENT_FIELDS : CONTACT_FIELDS;
    const localFieldInfo = localFields.find(f => f.value === formData.local_field);

    const mappingData = {
      entity_type: formData.entity_type,
      hubspot_field: formData.hubspot_field,
      hubspot_field_label: formData.hubspot_field_label || formData.hubspot_field,
      local_field: formData.local_field,
      local_field_label: localFieldInfo?.label || formData.local_field,
    };

    if (editingMapping) {
      const { error } = await supabase
        .from("hubspot_field_mappings")
        .update(mappingData)
        .eq("id", editingMapping.id);

      if (error) {
        toast({
          title: "Errore",
          description: "Impossibile aggiornare la mappatura",
          variant: "destructive",
        });
        return;
      }

      toast({ title: "Mappatura aggiornata" });
    } else {
      const { error } = await supabase
        .from("hubspot_field_mappings")
        .insert(mappingData);

      if (error) {
        if (error.code === "23505") {
          toast({
            title: "Errore",
            description: "Esiste già una mappatura per questo campo HubSpot",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Errore",
            description: "Impossibile creare la mappatura",
            variant: "destructive",
          });
        }
        return;
      }

      toast({ title: "Mappatura creata" });
    }

    setDialogOpen(false);
    resetForm();
    queryClient.invalidateQueries({ queryKey: ["hubspot-field-mappings"] });
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from("hubspot_field_mappings")
      .delete()
      .eq("id", id);

    if (error) {
      toast({
        title: "Errore",
        description: "Impossibile eliminare la mappatura",
        variant: "destructive",
      });
      return;
    }

    toast({ title: "Mappatura eliminata" });
    queryClient.invalidateQueries({ queryKey: ["hubspot-field-mappings"] });
  };

  const handleToggleActive = async (mapping: FieldMapping) => {
    const { error } = await supabase
      .from("hubspot_field_mappings")
      .update({ is_active: !mapping.is_active })
      .eq("id", mapping.id);

    if (error) {
      toast({
        title: "Errore",
        description: "Impossibile aggiornare lo stato",
        variant: "destructive",
      });
      return;
    }

    queryClient.invalidateQueries({ queryKey: ["hubspot-field-mappings"] });
  };

  const handleEdit = (mapping: FieldMapping) => {
    setEditingMapping(mapping);
    setFormData({
      entity_type: mapping.entity_type,
      hubspot_field: mapping.hubspot_field,
      hubspot_field_label: mapping.hubspot_field_label || "",
      local_field: mapping.local_field,
      local_field_label: mapping.local_field_label || "",
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setEditingMapping(null);
    setFormData({
      entity_type: "company",
      hubspot_field: "",
      hubspot_field_label: "",
      local_field: "",
      local_field_label: "",
    });
  };

  const renderMappingTable = (items: FieldMapping[], entityType: "company" | "contact") => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Campo HubSpot</TableHead>
          <TableHead></TableHead>
          <TableHead>Campo Locale</TableHead>
          <TableHead className="w-24 text-center">Attivo</TableHead>
          <TableHead className="w-20"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.length === 0 ? (
          <TableRow>
            <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
              Nessuna mappatura configurata
            </TableCell>
          </TableRow>
        ) : (
          items.map((mapping) => (
            <TableRow key={mapping.id} className={!mapping.is_active ? "opacity-50" : ""}>
              <TableCell>
                <div>
                  <p className="font-medium">{mapping.hubspot_field_label || mapping.hubspot_field}</p>
                  <p className="text-xs text-muted-foreground font-mono">{mapping.hubspot_field}</p>
                </div>
              </TableCell>
              <TableCell className="text-center">
                <ArrowRight className="h-4 w-4 text-muted-foreground mx-auto" />
              </TableCell>
              <TableCell>
                <div>
                  <p className="font-medium">{mapping.local_field_label || mapping.local_field}</p>
                  <p className="text-xs text-muted-foreground font-mono">{mapping.local_field}</p>
                </div>
              </TableCell>
              <TableCell className="text-center">
                <Switch
                  checked={mapping.is_active}
                  onCheckedChange={() => handleToggleActive(mapping)}
                />
              </TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEdit(mapping)}
                  >
                    <Settings2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(mapping.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );

  const localFields = formData.entity_type === "company" ? CLIENT_FIELDS : CONTACT_FIELDS;

  if (isLoading) {
    return <div className="p-4 text-muted-foreground">Caricamento mappature...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Mappatura Campi</CardTitle>
            <CardDescription>
              Configura quali campi HubSpot corrispondono ai campi del gestionale
            </CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Nuova mappatura
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingMapping ? "Modifica mappatura" : "Nuova mappatura"}
                </DialogTitle>
                <DialogDescription>
                  Configura la corrispondenza tra un campo HubSpot e un campo locale
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label>Tipo entità</Label>
                  <Select
                    value={formData.entity_type}
                    onValueChange={(value: "company" | "contact") => 
                      setFormData({ ...formData, entity_type: value, local_field: "" })
                    }
                    disabled={!!editingMapping}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="company">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4" />
                          Azienda → Cliente
                        </div>
                      </SelectItem>
                      <SelectItem value="contact">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          Contatto → Contatto
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Campo HubSpot (API name) *</Label>
                    <Input
                      value={formData.hubspot_field}
                      onChange={(e) => setFormData({ ...formData, hubspot_field: e.target.value })}
                      placeholder="es. custom_field_1"
                      required
                    />
                  </div>
                  <div>
                    <Label>Etichetta HubSpot</Label>
                    <Input
                      value={formData.hubspot_field_label}
                      onChange={(e) => setFormData({ ...formData, hubspot_field_label: e.target.value })}
                      placeholder="es. Campo personalizzato 1"
                    />
                  </div>
                </div>

                <div>
                  <Label>Campo locale *</Label>
                  <Select
                    value={formData.local_field}
                    onValueChange={(value) => setFormData({ ...formData, local_field: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona campo..." />
                    </SelectTrigger>
                    <SelectContent>
                      {localFields.map((field) => (
                        <SelectItem key={field.value} value={field.value}>
                          {field.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button type="submit" className="w-full">
                  {editingMapping ? "Aggiorna" : "Crea mappatura"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="companies">
          <TabsList>
            <TabsTrigger value="companies" className="gap-2">
              <Building2 className="h-4 w-4" />
              Aziende
              <Badge variant="secondary" className="ml-1">{companyMappings.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="contacts" className="gap-2">
              <Users className="h-4 w-4" />
              Contatti
              <Badge variant="secondary" className="ml-1">{contactMappings.length}</Badge>
            </TabsTrigger>
          </TabsList>
          <TabsContent value="companies" className="mt-4">
            {renderMappingTable(companyMappings, "company")}
          </TabsContent>
          <TabsContent value="contacts" className="mt-4">
            {renderMappingTable(contactMappings, "contact")}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
