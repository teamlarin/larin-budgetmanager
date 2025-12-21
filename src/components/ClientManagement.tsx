import { useState, useEffect, useMemo } from "react";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Trash2, Edit, Plus } from "lucide-react";
import { ClientImport } from "./ClientImport";
import { z } from "zod";

interface Client {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  default_payment_terms: string | null;
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
  address: z.string()
    .trim()
    .max(500, "Indirizzo deve essere meno di 500 caratteri")
    .optional()
    .or(z.literal('')),
  notes: z.string()
    .trim()
    .max(2000, "Note devono essere meno di 2000 caratteri")
    .optional()
    .or(z.literal(''))
});

export const ClientManagement = () => {
  const [allClients, setAllClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    notes: "",
    default_payment_terms: "",
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

  const totalPages = Math.ceil(allClients.length / ITEMS_PER_PAGE);
  const clients = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return allClients.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [allClients, currentPage]);

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .order("name");

    if (error) {
      toast({
        title: "Errore",
        description: "Impossibile caricare i clienti",
        variant: "destructive",
      });
      return;
    }

    setAllClients(data || []);
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
        address: result.data.address || null,
        notes: result.data.notes || null,
        default_payment_terms: formData.default_payment_terms || null,
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
        address: result.data.address || null,
        notes: result.data.notes || null,
        default_payment_terms: formData.default_payment_terms || null,
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
      address: client.address || "",
      notes: client.notes || "",
      default_payment_terms: client.default_payment_terms || "",
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setEditingClient(null);
    setFormData({
      name: "",
      email: "",
      phone: "",
      address: "",
      notes: "",
      default_payment_terms: "",
    });
  };

  if (loading) {
    return <div>Caricamento...</div>;
  }

  return (
    <div className="space-y-6">
      <ClientImport onImportComplete={fetchClients} />
      
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Gestione Clienti</h3>
          <p className="text-sm text-muted-foreground">
            Totale: {allClients.length} {allClients.length === 1 ? 'cliente' : 'clienti'}
          </p>
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
                <Label htmlFor="address">Indirizzo</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
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
              <div>
                <Label htmlFor="default_payment_terms">Termini di Pagamento Predefiniti</Label>
                <Select
                  value={formData.default_payment_terms || "none"}
                  onValueChange={(value) => setFormData({ ...formData, default_payment_terms: value === "none" ? "" : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona termini predefiniti" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nessuno</SelectItem>
                    {paymentTermsOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Verranno applicati automaticamente ai nuovi preventivi
                </p>
              </div>
              <Button type="submit" className="w-full">
                {editingClient ? "Aggiorna" : "Crea"}
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
                <TableHead>Ragione Sociale</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Telefono</TableHead>
                <TableHead className="text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Nessun cliente trovato
                  </TableCell>
                </TableRow>
              ) : (
                clients.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell className="font-medium">{client.name}</TableCell>
                    <TableCell>{client.email || "-"}</TableCell>
                    <TableCell>{client.phone || "-"}</TableCell>
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
                ))
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
    </div>
  );
};