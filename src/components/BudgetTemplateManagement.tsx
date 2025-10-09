import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Trash2, Edit, Plus } from "lucide-react";

interface BudgetTemplate {
  id: string;
  name: string;
  description: string | null;
  template_data: any;
}

export const BudgetTemplateManagement = () => {
  const [templates, setTemplates] = useState<BudgetTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<BudgetTemplate | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
  });

  useEffect(() => {
    fetchTemplates();
  }, []);

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

    setTemplates(data || []);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (editingTemplate) {
      const { error } = await supabase
        .from("budget_templates")
        .update(formData)
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
        .insert([{ ...formData, user_id: user.id, template_data: [] }]);

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
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setEditingTemplate(null);
    setFormData({
      name: "",
      description: "",
    });
  };

  if (loading) {
    return <div>Caricamento...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Modelli di Budget</h3>
          <p className="text-sm text-muted-foreground">Crea e gestisci modelli riutilizzabili</p>
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
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingTemplate ? "Modifica Modello" : "Nuovo Modello"}</DialogTitle>
              <DialogDescription>
                {editingTemplate ? "Modifica i dettagli del modello" : "Crea un nuovo modello di budget"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
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
                <Label htmlFor="description">Descrizione</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                />
              </div>
              <Button type="submit" className="w-full">
                {editingTemplate ? "Aggiorna" : "Crea"}
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
                <TableHead>Descrizione</TableHead>
                <TableHead className="text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    Nessun modello trovato
                  </TableCell>
                </TableRow>
              ) : (
                templates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell className="font-medium">{template.name}</TableCell>
                    <TableCell>{template.description || "-"}</TableCell>
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
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};