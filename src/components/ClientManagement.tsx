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
import { Trash2, Edit, Plus, Users, Folder, Search, CreditCard } from "lucide-react";
import { ClientImport } from "./ClientImport";
import { ClientContactsDialog } from "./ClientContactsDialog";
import { DriveFolderSelector } from "./DriveFolderSelector";
import { ClientPaymentSplitsDialog } from "./ClientPaymentSplitsDialog";
import { z } from "zod";

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
  const ITEMS_PER_PAGE = 50;
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    notes: "",
    default_payment_terms: "",
    account_user_id: "",
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
    if (!searchQuery.trim()) return allClients;
    const query = searchQuery.toLowerCase();
    return allClients.filter(client => 
      client.name.toLowerCase().includes(query) ||
      client.email?.toLowerCase().includes(query) ||
      client.phone?.toLowerCase().includes(query)
    );
  }, [allClients, searchQuery]);

  const totalPages = Math.ceil(filteredClients.length / ITEMS_PER_PAGE);
  const clients = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredClients.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredClients, currentPage]);

  useEffect(() => {
    fetchClients();
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
        account_user_id: formData.account_user_id || null,
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
        account_user_id: formData.account_user_id || null,
        strategic_level: formData.strategic_level,
        user_id: user.id
      };
      const { error } = await supabase
        .from("clients")
        .insert([insertData]);

      if (error) {
        toast({
          title: "Errore",
          description: "Impossibile creare il cliente",
          variant: "destructive",
        });
        return;
      }

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

    toast({
      title: "Successo",
      description: "Cliente eliminato con successo",
    });

    fetchClients();
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setFormData({
      name: client.name,
      email: client.email || "",
      phone: client.phone || "",
      notes: client.notes || "",
      default_payment_terms: client.default_payment_terms || "",
      account_user_id: client.account_user_id || "",
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
      account_user_id: "",
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
      <ClientImport onImportComplete={fetchClients} />
      
      <div className="flex justify-between items-center gap-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold">Gestione Clienti</h3>
          <p className="text-sm text-muted-foreground">
            Totale: {filteredClients.length} {filteredClients.length === 1 ? 'cliente' : 'clienti'}
            {searchQuery && ` (filtrati da ${allClients.length})`}
          </p>
        </div>
        <div className="flex items-center gap-4">
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
                    <SelectItem value="">Nessuno</SelectItem>
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
                💡 Per configurare le modalità di pagamento predefinite, salva prima il cliente e poi clicca sul pulsante "Configura" nella colonna "Modalità Pagamento" della tabella.
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
                <TableHead>Ragione Sociale</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Livello</TableHead>
                <TableHead>Contatti</TableHead>
                <TableHead>Cartella Drive</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Modalità Pagamento</TableHead>
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
                      <TableCell className="font-medium">{client.name}</TableCell>
                      <TableCell>
                        {getAccountName(client.account_user_id) || <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell>
                        {getStrategicLevelBadge(client.strategic_level)}
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
                        />
                      </TableCell>
                      <TableCell>{client.email || "-"}</TableCell>
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
                            <div className="flex flex-wrap gap-1">
                              {clientSplits.map((split, idx) => (
                                <Badge key={idx} variant="outline" className="text-xs">
                                  {split.payment_mode?.label} {split.percentage}%
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">Configura</span>
                          )}
                        </Button>
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(client)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(client.id)}
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
    </div>
  );
};