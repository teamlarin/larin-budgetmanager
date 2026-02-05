import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { toast } from "@/hooks/use-toast";
import { Search, Trash2, ArrowUpDown, MoreHorizontal, Pencil, Copy } from "lucide-react";
import { ContactImport } from "./ContactImport";

interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  is_primary: boolean;
  client_id: string;
  client: {
    id: string;
    name: string;
    account_user_id: string | null;
  } | null;
}

interface Client {
  id: string;
  name: string;
  account_user_id: string | null;
}

interface UserProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
}

const ITEMS_PER_PAGE = 50;

export const ContactManagement = () => {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [accountFilter, setAccountFilter] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [deleteContactId, setDeleteContactId] = useState<string | null>(null);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [editForm, setEditForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    role: '',
  });

  // Fetch users for account display and filter
  const { data: users = [] } = useQuery<UserProfile[]>({
    queryKey: ['users-for-contact-account'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .eq('approved', true)
        .is('deleted_at', null)
        .order('first_name');
      
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch all clients for filter and inline edit
  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ['clients-for-contacts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, account_user_id')
        .order('name');
      
      if (error) throw error;
      return data || [];
    },
  });

  const { data: contacts = [], isLoading, refetch } = useQuery({
    queryKey: ["all-contacts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_contacts")
        .select(`
          id,
          first_name,
          last_name,
          email,
          phone,
          role,
          is_primary,
          client_id,
          client:clients(id, name, account_user_id)
        `)
        .order("last_name", { ascending: true });

      if (error) throw error;
      return data as Contact[];
    },
  });

  const getUserName = (userId: string | null) => {
    if (!userId) return null;
    const user = users.find(u => u.id === userId);
    return user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : null;
  };

  const filteredContacts = useMemo(() => {
    let filtered = contacts;

    // Filter by client
    if (clientFilter !== 'all') {
      filtered = filtered.filter(c => c.client_id === clientFilter);
    }

    // Filter by account
    if (accountFilter !== 'all') {
      if (accountFilter === 'none') {
        filtered = filtered.filter(c => !c.client?.account_user_id);
      } else {
        filtered = filtered.filter(c => c.client?.account_user_id === accountFilter);
      }
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.first_name?.toLowerCase().includes(query) ||
          c.last_name?.toLowerCase().includes(query) ||
          c.email?.toLowerCase().includes(query) ||
          c.role?.toLowerCase().includes(query) ||
          c.client?.name?.toLowerCase().includes(query)
      );
    }

    // Sort by company name
    filtered = [...filtered].sort((a, b) => {
      const nameA = a.client?.name || '';
      const nameB = b.client?.name || '';
      const comparison = nameA.localeCompare(nameB, 'it');
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [contacts, searchQuery, clientFilter, accountFilter, sortOrder]);

  const totalPages = Math.ceil(filteredContacts.length / ITEMS_PER_PAGE);
  const paginatedContacts = filteredContacts.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleInlineUpdate = async (
    contactId: string, 
    field: 'role' | 'client_id', 
    value: string | null
  ) => {
    const { error } = await supabase
      .from("client_contacts")
      .update({ [field]: value })
      .eq("id", contactId);

    if (error) {
      toast({
        title: "Errore",
        description: "Impossibile aggiornare il contatto",
        variant: "destructive",
      });
      return;
    }

    queryClient.invalidateQueries({ queryKey: ["all-contacts"] });
  };

  const handleOpenEdit = (contact: Contact) => {
    setEditingContact(contact);
    setEditForm({
      first_name: contact.first_name,
      last_name: contact.last_name,
      email: contact.email || '',
      phone: contact.phone || '',
      role: contact.role || '',
    });
  };

  const handleSaveEdit = async () => {
    if (!editingContact) return;

    const { error } = await supabase
      .from("client_contacts")
      .update({
        first_name: editForm.first_name,
        last_name: editForm.last_name,
        email: editForm.email || null,
        phone: editForm.phone || null,
        role: editForm.role || null,
      })
      .eq("id", editingContact.id);

    if (error) {
      toast({
        title: "Errore",
        description: "Impossibile aggiornare il contatto",
        variant: "destructive",
      });
      return;
    }

    toast({ title: "Contatto aggiornato" });
    setEditingContact(null);
    queryClient.invalidateQueries({ queryKey: ["all-contacts"] });
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
      return;
    }

    toast({ title: "Contatto eliminato" });
    setDeleteContactId(null);
    queryClient.invalidateQueries({ queryKey: ["all-contacts"] });
  };

  const handleDuplicateContact = async (contact: Contact) => {
    const { error } = await supabase
      .from("client_contacts")
      .insert({
        first_name: contact.first_name,
        last_name: contact.last_name + " (copia)",
        email: contact.email,
        phone: contact.phone,
        role: contact.role,
        client_id: contact.client_id,
        is_primary: false,
      });

    if (error) {
      toast({
        title: "Errore",
        description: "Impossibile duplicare il contatto",
        variant: "destructive",
      });
      return;
    }

    toast({ title: "Contatto duplicato" });
    queryClient.invalidateQueries({ queryKey: ["all-contacts"] });
  };

  const toggleContactSelection = (id: string) => {
    setSelectedContacts((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const toggleAllContactsOnPage = () => {
    const allOnPageSelected = paginatedContacts.every((c) =>
      selectedContacts.has(c.id)
    );
    if (allOnPageSelected) {
      setSelectedContacts((prev) => {
        const newSet = new Set(prev);
        paginatedContacts.forEach((c) => newSet.delete(c.id));
        return newSet;
      });
    } else {
      setSelectedContacts((prev) => {
        const newSet = new Set(prev);
        paginatedContacts.forEach((c) => newSet.add(c.id));
        return newSet;
      });
    }
  };

  const handleBulkDelete = async () => {
    const contactIds = Array.from(selectedContacts);

    const { error } = await supabase
      .from("client_contacts")
      .delete()
      .in("id", contactIds);

    if (error) {
      toast({
        title: "Errore",
        description: "Impossibile eliminare i contatti selezionati",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Contatti eliminati",
      description: `${contactIds.length} contatt${contactIds.length === 1 ? "o eliminato" : "i eliminati"} con successo`,
    });

    setSelectedContacts(new Set());
    setBulkDeleteDialogOpen(false);
    refetch();
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-muted rounded w-1/3"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h3 className="text-lg font-semibold">Tutti i Contatti</h3>
          <p className="text-sm text-muted-foreground">
            Totale: {filteredContacts.length} contatt{filteredContacts.length === 1 ? "o" : "i"}
            {(searchQuery || clientFilter !== 'all' || accountFilter !== 'all') && ` (filtrati da ${contacts.length})`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Filters */}
          <Select value={clientFilter} onValueChange={(v) => { setClientFilter(v); setCurrentPage(1); }}>
            <SelectTrigger className="w-[160px] h-9">
              <SelectValue placeholder="Azienda..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutte le aziende</SelectItem>
              {clients.map((client) => (
                <SelectItem key={client.id} value={client.id}>
                  {client.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={accountFilter} onValueChange={(v) => { setAccountFilter(v); setCurrentPage(1); }}>
            <SelectTrigger className="w-[160px] h-9">
              <SelectValue placeholder="Account..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti gli account</SelectItem>
              <SelectItem value="none">Nessun account</SelectItem>
              {users.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.first_name || ''} {user.last_name || ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cerca contatto..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-9"
            />
          </div>
          {selectedContacts.size > 0 && (
            <Button
              variant="destructive"
              onClick={() => setBulkDeleteDialogOpen(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Elimina ({selectedContacts.size})
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={
                      paginatedContacts.length > 0 &&
                      paginatedContacts.every((c) => selectedContacts.has(c.id))
                    }
                    onCheckedChange={toggleAllContactsOnPage}
                  />
                </TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Cognome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Telefono</TableHead>
                <TableHead>Ruolo</TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 -ml-2 font-medium"
                    onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                  >
                    Azienda
                    <ArrowUpDown className="ml-1 h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead>Account</TableHead>
                <TableHead className="w-12">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedContacts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground">
                    {searchQuery || clientFilter !== 'all' || accountFilter !== 'all' 
                      ? "Nessun contatto trovato" 
                      : "Nessun contatto disponibile"}
                  </TableCell>
                </TableRow>
              ) : (
                paginatedContacts.map((contact) => (
                  <TableRow key={contact.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedContacts.has(contact.id)}
                        onCheckedChange={() => toggleContactSelection(contact.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{contact.first_name}</span>
                        {contact.is_primary && (
                          <Badge variant="secondary" className="text-xs">P</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{contact.last_name}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">{contact.email || '-'}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">{contact.phone || '-'}</span>
                    </TableCell>
                    <TableCell>
                      <Input
                        value={contact.role || ''}
                        onChange={(e) => handleInlineUpdate(contact.id, 'role', e.target.value || null)}
                        className="h-8 w-[100px] text-sm"
                        placeholder="-"
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={contact.client_id}
                        onValueChange={(value) => handleInlineUpdate(contact.id, 'client_id', value)}
                      >
                        <SelectTrigger className="h-8 w-[140px] text-xs">
                          <SelectValue placeholder="Azienda..." />
                        </SelectTrigger>
                        <SelectContent>
                          {clients.map((client) => (
                            <SelectItem key={client.id} value={client.id}>
                              {client.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {getUserName(contact.client?.account_user_id || null) || '-'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleOpenEdit(contact)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Modifica
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDuplicateContact(contact)}>
                            <Copy className="h-4 w-4 mr-2" />
                            Duplica
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => setDeleteContactId(contact.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Elimina
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 px-6 pb-6">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
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
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Import section */}
      <div className="max-w-md">
        <ContactImport onImportComplete={refetch} />
      </div>

      {/* Bulk Delete Dialog */}
      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Conferma eliminazione</AlertDialogTitle>
            <AlertDialogDescription>
              Stai per eliminare {selectedContacts.size} contatt
              {selectedContacts.size === 1 ? "o" : "i"}. Questa azione è irreversibile.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Elimina {selectedContacts.size} contatt{selectedContacts.size === 1 ? "o" : "i"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Single Delete Dialog */}
      <AlertDialog open={!!deleteContactId} onOpenChange={(open) => !open && setDeleteContactId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Conferma eliminazione</AlertDialogTitle>
            <AlertDialogDescription>
              Stai per eliminare questo contatto. Questa azione è irreversibile.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteContact}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingContact} onOpenChange={(open) => !open && setEditingContact(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifica contatto</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-first-name">Nome</Label>
                <Input
                  id="edit-first-name"
                  value={editForm.first_name}
                  onChange={(e) => setEditForm(prev => ({ ...prev, first_name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-last-name">Cognome</Label>
                <Input
                  id="edit-last-name"
                  value={editForm.last_name}
                  onChange={(e) => setEditForm(prev => ({ ...prev, last_name: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-phone">Telefono</Label>
              <Input
                id="edit-phone"
                value={editForm.phone}
                onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-role">Ruolo</Label>
              <Input
                id="edit-role"
                value={editForm.role}
                onChange={(e) => setEditForm(prev => ({ ...prev, role: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingContact(null)}>
              Annulla
            </Button>
            <Button onClick={handleSaveEdit}>
              Salva
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
