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
import { Plus, Pencil, Trash2, Users, Star, Link, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
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
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [editingContact, setEditingContact] = useState<ClientContact | null>(null);
  const [deleteContactId, setDeleteContactId] = useState<string | null>(null);
  const [unlinkContactId, setUnlinkContactId] = useState<string | null>(null);
  const [availableContacts, setAvailableContacts] = useState<ClientContact[]>([]);
  const [selectedExistingContactId, setSelectedExistingContactId] = useState<string>("");

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
    // Query contacts via junction table
    const { data: assignments, error: assignError } = await (supabase as any)
      .from("client_contact_clients")
      .select("contact_id, is_primary")
      .eq("client_id", clientId);

    if (assignError) {
      console.error("Error loading assignments:", assignError);
      toast({
        title: "Errore",
        description: "Impossibile caricare i contatti",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    if (!assignments || assignments.length === 0) {
      setContacts([]);
      setLoading(false);
      return;
    }

    const contactIds = assignments.map((a: any) => a.contact_id);
    const primaryMap = new Map(assignments.map((a: any) => [a.contact_id, a.is_primary]));

    const { data: contactsData, error: contactsError } = await supabase
      .from("client_contacts")
      .select("id, first_name, last_name, role, email, phone, notes")
      .in("id", contactIds)
      .order("last_name");

    if (contactsError) {
      console.error("Error loading contacts:", contactsError);
      setLoading(false);
      return;
    }

    const enriched: ClientContact[] = (contactsData || []).map((c) => ({
      ...c,
      is_primary: (primaryMap.get(c.id) as boolean) || false,
    }));

    // Sort: primary first
    enriched.sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0));
    setContacts(enriched);
    setLoading(false);
  };

  const loadAvailableContacts = async () => {
    // Get contacts NOT associated with this client
    const { data: currentAssignments } = await (supabase as any)
      .from("client_contact_clients")
      .select("contact_id")
      .eq("client_id", clientId);

    const currentIds = (currentAssignments || []).map((a: any) => a.contact_id);

    let query = supabase
      .from("client_contacts")
      .select("id, first_name, last_name, role, email, phone, notes")
      .order("last_name");

    const { data, error } = await query;

    if (error) {
      console.error("Error loading available contacts:", error);
      return;
    }

    const filtered = (data || [])
      .filter((c) => !currentIds.includes(c.id))
      .map((c) => ({ ...c, is_primary: false }));

    setAvailableContacts(filtered);
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
    setShowLinkForm(false);
    setEditingContact(null);
    setSelectedExistingContactId("");
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

    // If setting as primary, unset other primary in junction table
    if (formData.is_primary) {
      await (supabase as any)
        .from("client_contact_clients")
        .update({ is_primary: false })
        .eq("client_id", clientId);
    }

    if (editingContact) {
      // Update contact data
      const { error: updateError } = await supabase
        .from("client_contacts")
        .update({
          first_name: formData.first_name.trim(),
          last_name: formData.last_name.trim(),
          role: formData.role.trim() || null,
          email: formData.email.trim() || null,
          phone: formData.phone.trim() || null,
          notes: formData.notes.trim() || null,
        })
        .eq("id", editingContact.id);

      if (updateError) {
        toast({ title: "Errore", description: "Impossibile salvare il contatto", variant: "destructive" });
        return;
      }

      // Update is_primary in junction table
      await (supabase as any)
        .from("client_contact_clients")
        .update({ is_primary: formData.is_primary })
        .eq("contact_id", editingContact.id)
        .eq("client_id", clientId);
    } else {
      // Create new contact
      const { data: newContact, error: insertError } = await supabase
        .from("client_contacts")
        .insert({
          client_id: clientId, // Keep for backward compat
          first_name: formData.first_name.trim(),
          last_name: formData.last_name.trim(),
          role: formData.role.trim() || null,
          email: formData.email.trim() || null,
          phone: formData.phone.trim() || null,
          notes: formData.notes.trim() || null,
          is_primary: formData.is_primary,
        })
        .select()
        .single();

      if (insertError) {
        toast({ title: "Errore", description: "Impossibile salvare il contatto", variant: "destructive" });
        return;
      }

      // Also insert into junction table
      await (supabase as any)
        .from("client_contact_clients")
        .insert({
          contact_id: newContact.id,
          client_id: clientId,
          is_primary: formData.is_primary,
        });
    }

    toast({
      title: editingContact ? "Contatto aggiornato" : "Contatto creato",
      description: "Le modifiche sono state salvate",
    });

    resetForm();
    loadContacts();
  };

  const handleLinkExistingContact = async () => {
    if (!selectedExistingContactId) return;

    const { error } = await (supabase as any)
      .from("client_contact_clients")
      .insert({
        contact_id: selectedExistingContactId,
        client_id: clientId,
        is_primary: false,
      });

    if (error) {
      if (error.code === '23505') {
        toast({ title: "Errore", description: "Questo contatto è già associato a questa azienda", variant: "destructive" });
      } else {
        toast({ title: "Errore", description: "Impossibile associare il contatto", variant: "destructive" });
      }
      return;
    }

    toast({ title: "Contatto associato", description: "Il contatto è stato collegato a questa azienda" });
    resetForm();
    loadContacts();
  };

  const handleUnlinkContact = async () => {
    if (!unlinkContactId) return;

    // Remove from junction table (don't delete the contact itself)
    const { error } = await (supabase as any)
      .from("client_contact_clients")
      .delete()
      .eq("contact_id", unlinkContactId)
      .eq("client_id", clientId);

    if (error) {
      toast({ title: "Errore", description: "Impossibile scollegare il contatto", variant: "destructive" });
    } else {
      toast({ title: "Contatto scollegato", description: "Il contatto è stato rimosso da questa azienda" });
      loadContacts();
    }
    setUnlinkContactId(null);
  };

  const handleDeleteContact = async () => {
    if (!deleteContactId) return;

    // Check if contact is linked to other clients
    const { data: otherAssignments } = await (supabase as any)
      .from("client_contact_clients")
      .select("id")
      .eq("contact_id", deleteContactId)
      .neq("client_id", clientId);

    if (otherAssignments && otherAssignments.length > 0) {
      // Contact is used elsewhere, just unlink from this client
      await (supabase as any)
        .from("client_contact_clients")
        .delete()
        .eq("contact_id", deleteContactId)
        .eq("client_id", clientId);

      toast({ title: "Contatto scollegato", description: "Il contatto è associato anche ad altre aziende, è stato solo scollegato da questa." });
    } else {
      // Contact is only linked here, delete it entirely
      const { error } = await supabase
        .from("client_contacts")
        .delete()
        .eq("id", deleteContactId);

      if (error) {
        toast({ title: "Errore", description: "Impossibile eliminare il contatto", variant: "destructive" });
      } else {
        toast({ title: "Contatto eliminato", description: "Il contatto è stato rimosso" });
      }
    }

    setDeleteContactId(null);
    loadContacts();
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
    // Unset all primary in junction table for this client
    await (supabase as any)
      .from("client_contact_clients")
      .update({ is_primary: false })
      .eq("client_id", clientId);

    // Set new primary
    const { error } = await (supabase as any)
      .from("client_contact_clients")
      .update({ is_primary: true })
      .eq("contact_id", contactId)
      .eq("client_id", clientId);

    if (error) {
      toast({ title: "Errore", description: "Impossibile impostare il contatto principale", variant: "destructive" });
    } else {
      toast({ title: "Contatto principale aggiornato" });
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

          {!showForm && !showLinkForm ? (
            <>
              <div className="flex justify-end gap-2 mb-4">
                <Button variant="outline" onClick={() => { setShowLinkForm(true); loadAvailableContacts(); }}>
                  <Link className="h-4 w-4 mr-2" />
                  Associa Esistente
                </Button>
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
                  <p className="text-sm">Aggiungi un contatto o associane uno esistente.</p>
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
                              onClick={() => setUnlinkContactId(contact.id)}
                              title="Scollega da questa azienda"
                            >
                              <Link className="h-4 w-4 text-muted-foreground" />
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
          ) : showLinkForm ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium">Associa Contatto Esistente</h3>
                <Button variant="outline" onClick={resetForm}>
                  Annulla
                </Button>
              </div>

              {availableContacts.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nessun contatto disponibile da associare.
                </p>
              ) : (
                <>
                  <div>
                    <Label>Seleziona un contatto</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          className="w-full justify-between mt-1"
                        >
                          <span className="truncate">
                            {selectedExistingContactId
                              ? (() => {
                                  const c = availableContacts.find(c => c.id === selectedExistingContactId);
                                  return c ? `${c.first_name} ${c.last_name}${c.role ? ` - ${c.role}` : ""}` : "Scegli contatto...";
                                })()
                              : "Scegli contatto..."}
                          </span>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[350px] p-0 bg-popover z-50" align="start">
                        <Command>
                          <CommandInput placeholder="Cerca contatto..." />
                          <CommandList>
                            <CommandEmpty>Nessun contatto trovato.</CommandEmpty>
                            <CommandGroup>
                              {availableContacts.map((c) => (
                                <CommandItem
                                  key={c.id}
                                  value={`${c.first_name} ${c.last_name} ${c.role || ""} ${c.email || ""}`}
                                  onSelect={() => setSelectedExistingContactId(c.id)}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      selectedExistingContactId === c.id ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  {c.first_name} {c.last_name}{c.role ? ` - ${c.role}` : ""}{c.email ? ` (${c.email})` : ""}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>

                  <Button
                    onClick={handleLinkExistingContact}
                    disabled={!selectedExistingContactId}
                    className="w-full"
                  >
                    Associa Contatto
                  </Button>
                </>
              )}
            </div>
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

      {/* Unlink confirmation */}
      <AlertDialog open={!!unlinkContactId} onOpenChange={() => setUnlinkContactId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Scollegare questo contatto?</AlertDialogTitle>
            <AlertDialogDescription>
              Il contatto verrà rimosso da questa azienda ma resterà disponibile nel sistema e associato ad altre aziende.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={handleUnlinkContact}>
              Scollega
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteContactId} onOpenChange={() => setDeleteContactId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare questo contatto?</AlertDialogTitle>
            <AlertDialogDescription>
              Se il contatto è associato anche ad altre aziende, verrà solo scollegato da questa. Altrimenti verrà eliminato permanentemente.
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
