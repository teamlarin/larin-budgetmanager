import { useState, useEffect, useMemo } from "react";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Trash2, Edit, Plus, Users, Folder, Search, CreditCard, MoreHorizontal, CheckSquare, ArrowUpDown } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ClientImport } from "./ClientImport";
import { ContactImport } from "./ContactImport";
import { ClientContactsDialog } from "./ClientContactsDialog";
import { DriveFolderSelector } from "./DriveFolderSelector";
import { ClientPaymentSplitsDialog } from "./ClientPaymentSplitsDialog";
import { AutoLinkDriveFoldersDialog } from "./AutoLinkDriveFoldersDialog";
import { MergeClientsDialog } from "./MergeClientsDialog";

import { FolderSearch, Users as UsersIcon } from "lucide-react";
import { z } from "zod";
import { useActionLogger } from "@/hooks/useActionLogger";

interface Client {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  default_payment_terms: string | null;
  drive_folder_id: string | null;
  drive_folder_name: string | null;
  account_user_id: string | null;
  strategic_level: number | null;
}

interface UserProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
}

interface PaymentSplitDisplay {
  client_id: string;
  percentage: number;
  payment_mode: { label: string } | null;
  payment_term: { label: string } | null;
}

const clientSchema = z.object({
  name: z.string()
    .trim()
    .min(1, "Il nome è obbligatorio")
    .max(100, "Il nome deve essere meno di 100 caratteri"),
  email: z.string()
    .trim()
    .email("Email non valida")
    .max(255, "Email troppo lunga")
    .optional()
    .or(z.literal('')),
  phone: z.string()
    .trim()
    .max(20, "Numero troppo lungo")
    .optional()
    .or(z.literal('')),
  notes: z.string()
    .trim()
    .max(2000, "Note devono essere meno di 2000 caratteri")
    .optional()
    .or(z.literal(''))
});

const STRATEGIC_LEVELS = [
  { value: 1, label: 'Alto' },
  { value: 2, label: 'Medio' },
  { value: 3, label: 'Basso' },
];

export const ClientManagement = () => {
  const { logAction } = useActionLogger();
  const [allClients, setAllClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [contactsDialogOpen, setContactsDialogOpen] = useState(false);
  const [selectedClientForContacts, setSelectedClientForContacts] = useState<Client | null>(null);
  const [paymentSplitsDialogOpen, setPaymentSplitsDialogOpen] = useState(false);
  const [selectedClientForPayments, setSelectedClientForPayments] = useState<Client | null>(null);
  const [contactCounts, setContactCounts] = useState<Record<string, number>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [strategicLevelFilter, setStrategicLevelFilter] = useState<string>('all');
  const [accountFilter, setAccountFilter] = useState<string>('all');
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set());
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [autoLinkDialogOpen, setAutoLinkDialogOpen] = useState(false);
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const ITEMS_PER_PAGE = 50;
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    notes: "",
    default_payment_terms: "",
    account_user_id: "none",
    strategic_level: 2,
  });

  // Fetch users for account selector
  const { data: users = [] } = useQuery<UserProfile[]>({
    queryKey: ['users-for-client-account'],
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

  const { data: paymentTermsOptions = [] } = useQuery({
    queryKey: ['payment-terms'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_terms')
        .select('*')
        .eq('is_active', true)
        .order('display_order');

      if (error) throw error;
      return data.map((pt: { value: string; label: string }) => ({ value: pt.value, label: pt.label }));
    },
  });

  // Fetch all client payment splits
  const { data: allPaymentSplits = [] } = useQuery<PaymentSplitDisplay[]>({
    queryKey: ['all-client-payment-splits'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_payment_splits')
        .select(`
          client_id,
          percentage,
          payment_mode:payment_modes(label),
          payment_term:payment_terms(label)
        `)
        .order('display_order');

      if (error) throw error;
      return (data || []) as PaymentSplitDisplay[];
    },
  });

  // Group payment splits by client_id
  const paymentSplitsByClient = useMemo(() => {
    const grouped: Record<string, PaymentSplitDisplay[]> = {};
    for (const split of allPaymentSplits) {
      if (!grouped[split.client_id]) {
        grouped[split.client_id] = [];
      }
      grouped[split.client_id].push(split);
    }
    return grouped;
  }, [allPaymentSplits]);

  const filteredClients = useMemo(() => {
    let filtered = allClients;
    
    // Filter by strategic level
    if (strategicLevelFilter !== 'all') {
      const levelValue = parseInt(strategicLevelFilter);
      filtered = filtered.filter(client => client.strategic_level === levelValue);
    }
    
    // Filter by account
    if (accountFilter !== 'all') {
      if (accountFilter === 'none') {
        filtered = filtered.filter(client => !client.account_user_id);
      } else {
        filtered = filtered.filter(client => client.account_user_id === accountFilter);
      }
    }
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(client => 
        client.name.toLowerCase().includes(query) ||
        client.email?.toLowerCase().includes(query) ||
        client.phone?.toLowerCase().includes(query)
      );
    }
    
    // Sort by name
    filtered = [...filtered].sort((a, b) => {
      const comparison = a.name.localeCompare(b.name, 'it');
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    
    return filtered;
  }, [allClients, searchQuery, strategicLevelFilter, accountFilter, sortOrder]);

  const totalPages = Math.ceil(filteredClients.length / ITEMS_PER_PAGE);
  const clients = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredClients.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredClients, currentPage]);

  useEffect(() => {
    fetchClients();
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();
      setIsAdmin(!!data);
    })();
  }, []);

  const fetchClients = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("clients")
      .select("id, name, email, phone, notes, default_payment_terms, drive_folder_id, drive_folder_name, account_user_id, strategic_level")
      .order("name");

    if (error) {
      toast({
        title: "Errore",
        description: "Impossibile caricare i clienti",
        variant: "destructive",
      });
      return;
    }

    setAllClients((data || []) as Client[]);
    
    // Fetch contact counts for each client
    if (data && data.length > 0) {
      const { data: contacts } = await supabase
        .from("client_contacts")
        .select("client_id");
      
      if (contacts) {
        const counts: Record<string, number> = {};
        contacts.forEach(c => {
          counts[c.client_id] = (counts[c.client_id] || 0) + 1;
        });
        setContactCounts(counts);
      }
    }
    
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form data
    const result = clientSchema.safeParse(formData);
    if (!result.success) {
      const errors = result.error.errors.map(e => e.message).join(", ");
      toast({
        title: "Errore di validazione",
        description: errors,
        variant: "destructive"
      });
      return;
    }
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (editingClient) {
      const updateData = {
        name: result.data.name,
        email: result.data.email || null,
        phone: result.data.phone || null,
        notes: result.data.notes || null,
        default_payment_terms: formData.default_payment_terms || null,
        account_user_id: formData.account_user_id === 'none' ? null : (formData.account_user_id || null),
        strategic_level: formData.strategic_level,
      };
      const { error } = await supabase
        .from("clients")
        .update(updateData)
        .eq("id", editingClient.id);

      if (error) {
        toast({
          title: "Errore",
          description: "Impossibile aggiornare il cliente",
          variant: "destructive",
        });
        return;
      }

      logAction({
        actionType: 'update',
        actionDescription: `Cliente "${result.data.name}" aggiornato`,
        entityType: 'client',
        entityId: editingClient.id,
      });
      toast({
        title: "Successo",
        description: "Cliente aggiornato con successo",
      });
    } else {
      const insertData = {
        name: result.data.name,
        email: result.data.email || null,
        phone: result.data.phone || null,
        notes: result.data.notes || null,
        default_payment_terms: formData.default_payment_terms || null,
        account_user_id: formData.account_user_id === 'none' ? null : (formData.account_user_id || null),
        strategic_level: formData.strategic_level,
        user_id: user.id
      };
      const { data: newClient, error } = await supabase
        .from("clients")
        .insert([insertData])
        .select()
        .single();

      if (error) {
        toast({
          title: "Errore",
          description: "Impossibile creare il cliente",
          variant: "destructive",
        });
        return;
      }

      logAction({
        actionType: 'create',
        actionDescription: `Nuovo cliente "${result.data.name}" creato`,
        entityType: 'client',
        entityId: newClient?.id,
      });
      toast({
        title: "Successo",
        description: "Cliente creato con successo",
      });
    }

    setDialogOpen(false);
    resetForm();
    fetchClients();
  };

  const handleDelete = async (id: string) => {
    // Find client name before deleting
    const clientToDelete = allClients.find(c => c.id === id);
    
    const { error } = await supabase
      .from("clients")
      .delete()
      .eq("id", id);

    if (error) {
      toast({
        title: "Errore",
        description: "Impossibile eliminare il cliente",
        variant: "destructive",
      });
      return;
    }

    logAction({
      actionType: 'delete',
      actionDescription: `Cliente "${clientToDelete?.name || id}" eliminato`,
      entityType: 'client',
      entityId: id,
    });
    toast({
      title: "Successo",
      description: "Cliente eliminato con successo",
    });

    fetchClients();
    setSelectedClients(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
  };

  const handleInlineUpdate = async (clientId: string, field: 'account_user_id' | 'strategic_level', value: string | number | null) => {
    const { error } = await supabase
      .from("clients")
      .update({ [field]: value })
      .eq("id", clientId);

    if (error) {
      toast({
        title: "Errore",
        description: "Impossibile aggiornare il cliente",
        variant: "destructive",
      });
      return;
    }

    // Update local state
    setAllClients(prev => prev.map(c => 
      c.id === clientId ? { ...c, [field]: value } : c
    ));
  };

  const handleBulkDelete = async () => {
    if (selectedClients.size === 0) return;
    
    const clientIds = Array.from(selectedClients);
    const clientNames = clientIds.map(id => allClients.find(c => c.id === id)?.name || id);
    
    // First delete related records that don't have cascade delete
    // Delete client payment splits
    await supabase
      .from("client_payment_splits")
      .delete()
      .in("client_id", clientIds);
    
    // Now delete clients
    const { error } = await supabase
      .from("clients")
      .delete()
      .in("id", clientIds);

    if (error) {
      // Check if it's a foreign key constraint error
      if (error.code === '23503') {
        toast({
          title: "Impossibile eliminare",
          description: "Alcuni clienti hanno budget o progetti collegati. Elimina prima i budget/progetti associati.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Errore",
          description: "Impossibile eliminare i clienti selezionati",
          variant: "destructive",
        });
      }
      return;
    }

    logAction({
      actionType: 'delete',
      actionDescription: `Eliminati ${clientIds.length} clienti: ${clientNames.slice(0, 3).join(', ')}${clientNames.length > 3 ? '...' : ''}`,
      entityType: 'client',
    });
    
    toast({
      title: "Successo",
      description: `${clientIds.length} clienti eliminati con successo`,
    });

    setSelectedClients(new Set());
    setBulkDeleteDialogOpen(false);
    fetchClients();
  };

  const toggleClientSelection = (clientId: string) => {
    setSelectedClients(prev => {
      const newSet = new Set(prev);
      if (newSet.has(clientId)) {
        newSet.delete(clientId);
      } else {
        newSet.add(clientId);
      }
      return newSet;
    });
  };

  const toggleAllClientsOnPage = () => {
    const allSelected = clients.every(c => selectedClients.has(c.id));
    setSelectedClients(prev => {
      const newSet = new Set(prev);
      if (allSelected) {
        clients.forEach(c => newSet.delete(c.id));
      } else {
        clients.forEach(c => newSet.add(c.id));
      }
      return newSet;
    });
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setFormData({
      name: client.name,
      email: client.email || "",
      phone: client.phone || "",
      notes: client.notes || "",
      default_payment_terms: client.default_payment_terms || "",
      account_user_id: client.account_user_id || "none",
      strategic_level: client.strategic_level || 2,
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setEditingClient(null);
    setFormData({
      name: "",
      email: "",
      phone: "",
      notes: "",
      default_payment_terms: "",
      account_user_id: "none",
      strategic_level: 2,
    });
  };

  const getStrategicLevelBadge = (level: number | null) => {
    const levelInfo = STRATEGIC_LEVELS.find(l => l.value === level) || STRATEGIC_LEVELS[1];
    const colorClass = level === 1 ? 'bg-green-500/10 text-green-700 border-green-500/20' :
                       level === 3 ? 'bg-orange-500/10 text-orange-700 border-orange-500/20' :
                                     'bg-blue-500/10 text-blue-700 border-blue-500/20';
    return <Badge variant="outline" className={colorClass}>{levelInfo.label}</Badge>;
  };

  const getAccountName = (accountUserId: string | null) => {
    if (!accountUserId) return null;
    const user = users.find(u => u.id === accountUserId);
    if (!user) return null;
    return `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'N/D';
  };

  if (loading) {
    return <div>Caricamento...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center gap-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold">Gestione Clienti</h3>
          <p className="text-sm text-muted-foreground">
            Totale: {filteredClients.length} {filteredClients.length === 1 ? 'cliente' : 'clienti'}
            {searchQuery && ` (filtrati da ${allClients.length})`}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Select
            value={accountFilter}
            onValueChange={(value) => {
              setAccountFilter(value);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Account" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti gli account</SelectItem>
              <SelectItem value="none">Senza account</SelectItem>
              {users.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.first_name || ''} {user.last_name || ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={strategicLevelFilter}
            onValueChange={(value) => {
              setStrategicLevelFilter(value);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Livello strategico" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti i livelli</SelectItem>
              {STRATEGIC_LEVELS.map((level) => (
                <SelectItem key={level.value} value={level.value.toString()}>
                  {level.value} - {level.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Cerca cliente..." 
              value={searchQuery} 
              onChange={e => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }} 
              className="pl-10" 
            />
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
          {selectedClients.size > 0 && (
            <Button 
              variant="destructive" 
              onClick={() => setBulkDeleteDialogOpen(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Elimina ({selectedClients.size})
            </Button>
          )}
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nuovo cliente
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingClient ? "Modifica cliente" : "Nuovo cliente"}</DialogTitle>
              <DialogDescription>
                {editingClient ? "Modifica i dettagli del cliente" : "Aggiungi un nuovo cliente"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Ragione Sociale *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
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
              <div>
                <Label htmlFor="account_user_id">Account di riferimento</Label>
                <Select
                  value={formData.account_user_id}
                  onValueChange={(value) => setFormData({ ...formData, account_user_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona account..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nessuno</SelectItem>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.first_name || ''} {user.last_name || ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="strategic_level">Livello strategico</Label>
                <Select
                  value={formData.strategic_level.toString()}
                  onValueChange={(value) => setFormData({ ...formData, strategic_level: parseInt(value) })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona livello..." />
                  </SelectTrigger>
                  <SelectContent>
                    {STRATEGIC_LEVELS.map((level) => (
                      <SelectItem key={level.value} value={level.value.toString()}>
                        {level.value} - {level.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="notes">Note</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                />
              </div>
              <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                💡 Per configurare i termini di pagamento predefiniti, salva prima il cliente e poi clicca sul pulsante "Configura" nella colonna "Termini Pagamento" della tabella.
              </p>
              <Button type="submit" className="w-full">
                {editingClient ? "Aggiorna" : "Crea"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox 
                    checked={clients.length > 0 && clients.every(c => selectedClients.has(c.id))}
                    onCheckedChange={toggleAllClientsOnPage}
                  />
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 -ml-2 font-medium"
                    onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                  >
                    Ragione Sociale
                    <ArrowUpDown className="ml-1 h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Livello</TableHead>
                <TableHead>Contatti</TableHead>
                <TableHead>Drive</TableHead>
                <TableHead>Termini Pagamento</TableHead>
                <TableHead className="text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    Nessun cliente trovato
                  </TableCell>
                </TableRow>
              ) : (
                clients.map((client) => {
                  const clientSplits = paymentSplitsByClient[client.id] || [];
                  const contactCount = contactCounts[client.id] || 0;
                  return (
                    <TableRow key={client.id}>
                      <TableCell>
                        <Checkbox 
                          checked={selectedClients.has(client.id)}
                          onCheckedChange={() => toggleClientSelection(client.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{client.name}</TableCell>
                      <TableCell>
                        <Select
                          value={client.account_user_id || "none"}
                          onValueChange={(value) => handleInlineUpdate(client.id, 'account_user_id', value === 'none' ? null : value)}
                        >
                          <SelectTrigger className="h-8 w-[140px] text-xs">
                            <SelectValue placeholder="Account..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">-</SelectItem>
                            {users.map((user) => (
                              <SelectItem key={user.id} value={user.id}>
                                {user.first_name || ''} {user.last_name || ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={client.strategic_level?.toString() || "2"}
                          onValueChange={(value) => handleInlineUpdate(client.id, 'strategic_level', parseInt(value))}
                        >
                          <SelectTrigger className="h-8 w-[100px] text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STRATEGIC_LEVELS.map((level) => (
                              <SelectItem key={level.value} value={level.value.toString()}>
                                {level.value} - {level.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2"
                          onClick={() => {
                            setSelectedClientForContacts(client);
                            setContactsDialogOpen(true);
                          }}
                        >
                          <Users className="h-4 w-4 mr-1" />
                          {contactCount > 0 ? (
                            <Badge variant="secondary" className="ml-1">
                              {contactCount}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </Button>
                      </TableCell>
                      <TableCell>
                        <DriveFolderSelector
                          clientId={client.id}
                          currentFolderId={client.drive_folder_id}
                          currentFolderName={client.drive_folder_name}
                          onFolderLinked={fetchClients}
                          compact
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 justify-start"
                          onClick={() => {
                            setSelectedClientForPayments(client);
                            setPaymentSplitsDialogOpen(true);
                          }}
                        >
                          <CreditCard className="h-4 w-4 mr-1" />
                          {clientSplits.length > 0 ? (
                            <Badge variant="outline" className="text-xs">
                              {clientSplits[0].payment_term?.label || '-'}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">Configura</span>
                          )}
                        </Button>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(client)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Modifica
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleDelete(client.id)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
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
            <div className="mt-4 px-6 pb-6">
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

      {selectedClientForContacts && (
        <ClientContactsDialog
          open={contactsDialogOpen}
          onOpenChange={(open) => {
            setContactsDialogOpen(open);
            if (!open) {
              fetchClients(); // Refresh contact counts when dialog closes
            }
          }}
          clientId={selectedClientForContacts.id}
          clientName={selectedClientForContacts.name}
        />
      )}

      {selectedClientForPayments && (
        <ClientPaymentSplitsDialog
          open={paymentSplitsDialogOpen}
          onOpenChange={setPaymentSplitsDialogOpen}
          clientId={selectedClientForPayments.id}
          clientName={selectedClientForPayments.name}
        />
      )}

      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Conferma eliminazione</AlertDialogTitle>
            <AlertDialogDescription>
              Stai per eliminare {selectedClients.size} client{selectedClients.size === 1 ? 'e' : 'i'}. 
              Questa azione è irreversibile.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Elimina {selectedClients.size} client{selectedClients.size === 1 ? 'e' : 'i'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Import section at bottom */}
      <div className="grid md:grid-cols-2 gap-4">
        <ClientImport onImportComplete={fetchClients} />
        <ContactImport onImportComplete={fetchClients} />
      </div>
    </div>
  );
};