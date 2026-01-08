import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Users, Star } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ClientContact {
  id: string;
  client_id: string;
  first_name: string;
  last_name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  is_primary: boolean;
}

interface ClientContactsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  clientName: string;
}

export const ClientContactsDialog = ({
  open,
  onOpenChange,
  clientId,
  clientName,
}: ClientContactsDialogProps) => {
  const { toast } = useToast();
  const [contacts, setContacts] = useState<ClientContact[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingContact, setEditingContact] = useState<ClientContact | null>(null);
  const [deleteContactId, setDeleteContactId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    role: "",
    email: "",
    phone: "",
    notes: "",
    is_primary: false,
  });

  useEffect(() => {
    if (open) {
      loadContacts();
    }
  }, [open, clientId]);

  const loadContacts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("client_contacts")
      .select("*")
      .eq("client_id", clientId)
      .order("is_primary", { ascending: false })
      .order("last_name");

    if (error) {
      console.error("Error loading contacts:", error);
      toast({
        title: "Errore",
        description: "Impossibile caricare i contatti",
        variant: "destructive",
      });
    } else {
      setContacts(data || []);
    }
    setLoading(false);
  };

  const resetForm = () => {
    setFormData({
      first_name: "",
      last_name: "",
      role: "",
      email: "",
      phone: "",
      notes: "",
      is_primary: false,
    });
    setShowForm(false);
    setEditingContact(null);
  };

  const handleSaveContact = async () => {
    if (!formData.first_name.trim() || !formData.last_name.trim()) {
      toast({
        title: "Errore",
        description: "Nome e cognome sono obbligatori",
        variant: "destructive",
      });
      return;
    }

    // If setting as primary, unset other primary contacts
    if (formData.is_primary) {
      await supabase
        .from("client_contacts")
        .update({ is_primary: false })
        .eq("client_id", clientId)
        .neq("id", editingContact?.id || "");
    }

    const contactData = {
      client_id: clientId,
      first_name: formData.first_name.trim(),
      last_name: formData.last_name.trim(),
      role: formData.role.trim() || null,
      email: formData.email.trim() || null,
      phone: formData.phone.trim() || null,
      notes: formData.notes.trim() || null,
      is_primary: formData.is_primary,
    };

    let error;
    if (editingContact) {
      const { error: updateError } = await supabase
        .from("client_contacts")
        .update(contactData)
        .eq("id", editingContact.id);
      error = updateError;
    } else {
      const { error: insertError } = await supabase
        .from("client_contacts")
        .insert(contactData);
      error = insertError;
    }

    if (error) {
      toast({
        title: "Errore",
        description: "Impossibile salvare il contatto",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: editingContact ? "Contatto aggiornato" : "Contatto creato",
      description: "Le modifiche sono state salvate",
    });

    resetForm();
    loadContacts();
  };

  const handleDeleteContact = async () => {
    if (!deleteContactId) return;

    const { error } = await supabase
      .from("client_contacts")
      .delete()
      .eq("id", deleteContactId);

    if (error) {
      toast({
        title: "Errore",
        description: "Impossibile eliminare il contatto",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Contatto eliminato",
        description: "Il contatto è stato rimosso",
      });
      loadContacts();
    }
    setDeleteContactId(null);
  };

  const handleEditContact = (contact: ClientContact) => {
    setFormData({
      first_name: contact.first_name,
      last_name: contact.last_name,
      role: contact.role || "",
      email: contact.email || "",
      phone: contact.phone || "",
      notes: contact.notes || "",
      is_primary: contact.is_primary,
    });
    setEditingContact(contact);
    setShowForm(true);
  };

  const handleSetPrimary = async (contactId: string) => {
    // Unset all primary
    await supabase
      .from("client_contacts")
      .update({ is_primary: false })
      .eq("client_id", clientId);

    // Set new primary
    const { error } = await supabase
      .from("client_contacts")
      .update({ is_primary: true })
      .eq("id", contactId);

    if (error) {
      toast({
        title: "Errore",
        description: "Impossibile impostare il contatto principale",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Contatto principale aggiornato",
      });
      loadContacts();
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Contatti - {clientName}
            </DialogTitle>
            <DialogDescription>
              Gestisci i contatti associati a questo cliente
            </DialogDescription>
          </DialogHeader>

          {!showForm ? (
            <>
              <div className="flex justify-end mb-4">
                <Button onClick={() => setShowForm(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nuovo Contatto
                </Button>
              </div>

              {loading ? (
                <p className="text-center text-muted-foreground py-8">Caricamento...</p>
              ) : contacts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nessun contatto registrato.</p>
                  <p className="text-sm">Aggiungi un contatto per iniziare.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Ruolo</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Telefono</TableHead>
                      <TableHead className="text-right">Azioni</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contacts.map((contact) => (
                      <TableRow key={contact.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {contact.first_name} {contact.last_name}
                            </span>
                            {contact.is_primary && (
                              <Badge variant="default" className="text-xs">
                                <Star className="h-3 w-3 mr-1" />
                                Principale
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{contact.role || "-"}</TableCell>
                        <TableCell>
                          {contact.email ? (
                            <a href={`mailto:${contact.email}`} className="text-primary hover:underline">
                              {contact.email}
                            </a>
                          ) : "-"}
                        </TableCell>
                        <TableCell>
                          {contact.phone ? (
                            <a href={`tel:${contact.phone}`} className="text-primary hover:underline">
                              {contact.phone}
                            </a>
                          ) : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {!contact.is_primary && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleSetPrimary(contact.id)}
                                title="Imposta come principale"
                              >
                                <Star className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditContact(contact)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteContactId(contact.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium">
                  {editingContact ? "Modifica Contatto" : "Nuovo Contatto"}
                </h3>
                <Button variant="outline" onClick={resetForm}>
                  Annulla
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="first_name">Nome *</Label>
                  <Input
                    id="first_name"
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="last_name">Cognome *</Label>
                  <Input
                    id="last_name"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="role">Ruolo</Label>
                <Input
                  id="role"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  placeholder="es. Responsabile Marketing, CEO, etc."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Telefono</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="notes">Note</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={2}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is_primary"
                  checked={formData.is_primary}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_primary: checked as boolean })}
                />
                <Label htmlFor="is_primary" className="cursor-pointer">
                  Contatto principale
                </Label>
              </div>

              <Button onClick={handleSaveContact} className="w-full">
                {editingContact ? "Aggiorna Contatto" : "Crea Contatto"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteContactId} onOpenChange={() => setDeleteContactId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare questo contatto?</AlertDialogTitle>
            <AlertDialogDescription>
              Questa azione non può essere annullata. Il contatto verrà eliminato permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteContact} className="bg-destructive hover:bg-destructive/90">
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
