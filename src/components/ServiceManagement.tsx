import { useState, useEffect, useMemo } from "react";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Plus, Copy, Pencil, Briefcase, Upload } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
import * as XLSX from "xlsx";
import { ServiceFormDialog } from "./ServiceFormDialog";

interface Service {
  id: string;
  code: string;
  name: string;
  description?: string;
  category: string;
  net_price: number;
  gross_price: number;
  budget_template_id?: string;
  created_at: string;
}

export const ServiceManagement = () => {
  const { toast } = useToast();
  const [allServices, setAllServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteServiceId, setDeleteServiceId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  const totalPages = Math.ceil(allServices.length / ITEMS_PER_PAGE);
  const services = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return allServices.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [allServices, currentPage]);

  useEffect(() => {
    loadServices();
  }, []);

  const loadServices = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("services")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        title: "Errore",
        description: "Impossibile caricare i servizi",
        variant: "destructive",
      });
    } else {
      setAllServices(data || []);
    }
    setLoading(false);
  };

  const handleServiceFormSuccess = () => {
    loadServices();
    setEditingService(null);
  };

  const handleDelete = async () => {
    if (!deleteServiceId) return;

    const { error } = await supabase
      .from("services")
      .delete()
      .eq("id", deleteServiceId);

    if (error) {
      toast({
        title: "Errore",
        description: "Impossibile eliminare il servizio",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Servizio eliminato",
      description: "Il servizio è stato rimosso con successo",
    });

    setDeleteServiceId(null);
    loadServices();
  };

  const handleDuplicate = async (service: Service) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Create a new code by appending a number
    let newCode = `${service.code}_copia`;
    let counter = 1;
    
    // Check if code exists and increment counter if needed
    while (allServices.some(s => s.code === newCode)) {
      newCode = `${service.code}_copia_${counter}`;
      counter++;
    }

    const { error } = await supabase.from("services").insert({
      user_id: user.id,
      code: newCode,
      name: `${service.name} (Copia)`,
      description: service.description,
      category: service.category,
      net_price: service.net_price,
      gross_price: service.gross_price,
      budget_template_id: service.budget_template_id,
    });

    if (error) {
      toast({
        title: "Errore",
        description: "Impossibile duplicare il servizio",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Servizio duplicato",
      description: "Il servizio è stato duplicato con successo",
    });

    loadServices();
  };

  const handleEdit = (service: Service) => {
    setEditingService(service);
    setDialogOpen(true);
  };

  const parsePrice = (priceStr: string): number => {
    if (!priceStr) return 0;
    // Remove currency symbols, spaces, and convert comma to dot
    const cleaned = priceStr.toString()
      .replace(/[€$£\s]/g, '')
      .replace(',', '.');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  };

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);

          const { data: { user } } = await supabase.auth.getUser();
          if (!user) {
            toast({
              title: "Errore",
              description: "Utente non autenticato",
              variant: "destructive",
            });
            return;
          }

          let importedCount = 0;
          let errorCount = 0;
          const errors: string[] = [];

          for (const row of jsonData as any[]) {
            try {
              // Map Excel columns to our database fields (compatible with product format)
              const code = row['Codice'] || row['codice'] || row['code'] || '';
              const name = row['Nome servizio'] || row['Nome prodotto/servizio'] || row['nome'] || row['name'] || '';
              const description = row['Descrizione'] || row['descrizione'] || row['description'] || '';
              const category = row['Categoria'] || row['categoria'] || row['category'] || '';
              const netPrice = parsePrice(row['Prezzo netto'] || row['prezzo_netto'] || row['net_price'] || '0');
              const grossPrice = parsePrice(row['Prezzo lordo'] || row['prezzo_lordo'] || row['gross_price'] || '0');

              if (!code || !name || !category) {
                errors.push(`Riga saltata: mancano dati obbligatori (codice: ${code || 'vuoto'})`);
                errorCount++;
                continue;
              }

              // Check if service already exists
              const { data: existingService } = await supabase
                .from('services')
                .select('id')
                .eq('user_id', user.id)
                .eq('code', code)
                .maybeSingle();

              if (existingService) {
                // Update existing service
                const { error } = await supabase
                  .from('services')
                  .update({
                    name,
                    description: description || null,
                    category,
                    net_price: netPrice,
                    gross_price: grossPrice,
                  })
                  .eq('id', existingService.id);

                if (error) {
                  errors.push(`Errore aggiornamento ${code}: ${error.message}`);
                  errorCount++;
                } else {
                  importedCount++;
                }
              } else {
                // Insert new service
                const { error } = await supabase.from('services').insert({
                  user_id: user.id,
                  code,
                  name,
                  description: description || null,
                  category,
                  net_price: netPrice,
                  gross_price: grossPrice,
                });

                if (error) {
                  errors.push(`Errore inserimento ${code}: ${error.message}`);
                  errorCount++;
                } else {
                  importedCount++;
                }
              }
            } catch (rowError) {
              errorCount++;
              errors.push(`Errore elaborazione riga: ${rowError}`);
            }
          }

          // Show results
          if (importedCount === 0 && errorCount === 0) {
            toast({
              title: "Nessun dato trovato",
              description: "Il file non contiene dati validi. Verifica che le colonne siano: Codice, Nome servizio (o Nome prodotto/servizio), Categoria",
              variant: "destructive",
            });
          } else if (importedCount > 0) {
            toast({
              title: "Importazione completata",
              description: `${importedCount} servizi importati/aggiornati${errorCount > 0 ? `, ${errorCount} errori` : ''}`,
            });
          }

          if (errors.length > 0 && errors.length <= 5) {
            errors.forEach(error => {
              toast({
                title: "Errore importazione",
                description: error,
                variant: "destructive",
              });
            });
          } else if (errors.length > 5) {
            toast({
              title: "Errori importazione",
              description: `${errorCount} righe non importate. Verifica che le colonne richieste siano presenti: Codice, Nome servizio, Categoria`,
              variant: "destructive",
            });
          }

          setImportDialogOpen(false);
          loadServices();
        } catch (parseError) {
          toast({
            title: "Errore",
            description: "Impossibile leggere il file. Assicurati che sia un file Excel o CSV valido.",
            variant: "destructive",
          });
        }
      };

      reader.readAsArrayBuffer(file);
    } catch (error) {
      toast({
        title: "Errore",
        description: "Errore durante la lettura del file",
        variant: "destructive",
      });
    }

    // Reset input
    event.target.value = '';
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8">
          <p className="text-center text-muted-foreground">Caricamento servizi...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="h-5 w-5" />
                Gestione Servizi
              </CardTitle>
              <CardDescription>
                Totale: {allServices.length} {allServices.length === 1 ? 'servizio' : 'servizi'}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Upload className="mr-2 h-4 w-4" />
                    Importa
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Importa Servizi</DialogTitle>
                    <DialogDescription>
                      Carica un file Excel (.xlsx) o CSV con i tuoi servizi.
                      <br />
                      <br />
                      <strong>Colonne richieste:</strong> Codice, Nome servizio (o Nome prodotto/servizio), Categoria
                      <br />
                      <strong>Colonne opzionali:</strong> Descrizione, Prezzo netto, Prezzo lordo
                      <br />
                      <br />
                      <em>Nota: Puoi usare lo stesso formato dei prodotti</em>
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="file-upload">Seleziona File</Label>
                      <Input
                        id="file-upload"
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        onChange={handleFileImport}
                        className="mt-2"
                      />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      I servizi con lo stesso codice verranno aggiornati automaticamente.
                    </p>
                  </div>
                </DialogContent>
              </Dialog>
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Nuovo Servizio
              </Button>
          </div>
        </div>
        </CardHeader>
        <CardContent>
          {allServices.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nessun servizio disponibile. Crea il tuo primo servizio per iniziare.
            </div>
          ) : (
            <>
              <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Codice</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Prezzo Netto</TableHead>
                  <TableHead className="text-right">Prezzo Lordo</TableHead>
                  <TableHead className="text-right">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {services.map((service) => (
                  <TableRow key={service.id}>
                    <TableCell className="font-medium">{service.code}</TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{service.name}</div>
                        {service.description && (
                          <div className="text-sm text-muted-foreground line-clamp-1">
                            {service.description}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{service.category}</TableCell>
                    <TableCell className="text-right">
                      €{service.net_price.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      €{service.gross_price.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(service)}
                          title="Modifica"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDuplicate(service)}
                          title="Duplica"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteServiceId(service.id)}
                          title="Elimina"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            
            {totalPages > 1 && (
              <div className="mt-4">
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
          </>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteServiceId} onOpenChange={() => setDeleteServiceId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sei sicuro?</AlertDialogTitle>
            <AlertDialogDescription>
              Questa azione non può essere annullata. Il servizio verrà eliminato permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Elimina</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ServiceFormDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingService(null);
        }}
        editingService={editingService}
        onSuccess={handleServiceFormSuccess}
      />
    </>
  );
};