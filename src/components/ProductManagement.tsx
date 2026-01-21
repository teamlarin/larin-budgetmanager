import { useState, useEffect, useMemo } from "react";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Trash2, Plus, Copy, Pencil, Package, Upload, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { ProductFormDialog } from "./ProductFormDialog";

interface Product {
  id: string;
  code: string;
  name: string;
  description?: string;
  category: string;
  net_price: number;
  gross_price: number;
  created_at: string;
}

interface PaymentSplit {
  id: string;
  product_id: string;
  payment_mode_id: string;
  payment_term_id: string | null;
  percentage: number;
  display_order: number;
}

interface PaymentMode {
  id: string;
  label: string;
}

interface PaymentTerm {
  id: string;
  label: string;
}

export const ProductManagement = () => {
  const { toast } = useToast();
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteProductId, setDeleteProductId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 30;

  const totalPages = Math.ceil(allProducts.length / ITEMS_PER_PAGE);
  const products = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return allProducts.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [allProducts, currentPage]);

  // Fetch all product payment splits
  const { data: allPaymentSplits = [] } = useQuery<PaymentSplit[]>({
    queryKey: ['all-product-payment-splits'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_payment_splits')
        .select('*')
        .order('display_order');

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch payment modes
  const { data: paymentModes = [] } = useQuery<PaymentMode[]>({
    queryKey: ['payment-modes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_modes')
        .select('id, label')
        .eq('is_active', true)
        .order('display_order');

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch payment terms
  const { data: paymentTerms = [] } = useQuery<PaymentTerm[]>({
    queryKey: ['payment-terms'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_terms')
        .select('id, label')
        .eq('is_active', true)
        .order('display_order');

      if (error) throw error;
      return data || [];
    },
  });

  // Group payment splits by product_id
  const paymentSplitsByProduct = useMemo(() => {
    const grouped: Record<string, PaymentSplit[]> = {};
    allPaymentSplits.forEach(split => {
      if (!grouped[split.product_id]) {
        grouped[split.product_id] = [];
      }
      grouped[split.product_id].push(split);
    });
    return grouped;
  }, [allPaymentSplits]);

  const getPaymentModeLabel = (modeId: string) => {
    const mode = paymentModes.find(m => m.id === modeId);
    return mode?.label || '-';
  };

  const getPaymentTermLabel = (termId: string | null) => {
    if (!termId) return '-';
    const term = paymentTerms.find(t => t.id === termId);
    return term?.label || '-';
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        title: "Errore",
        description: "Impossibile caricare i prodotti",
        variant: "destructive",
      });
    } else {
      setAllProducts(data || []);
    }
    setLoading(false);
  };

  const handleProductFormSuccess = () => {
    loadProducts();
    setEditingProduct(null);
  };

  const handleDelete = async () => {
    if (!deleteProductId) return;

    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", deleteProductId);

    if (error) {
      toast({
        title: "Errore",
        description: "Impossibile eliminare il prodotto",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Prodotto eliminato",
      description: "Il prodotto è stato rimosso con successo",
    });

    setDeleteProductId(null);
    loadProducts();
  };

  const handleDuplicate = async (product: Product) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Create a new code by appending a number
    let newCode = `${product.code}_copia`;
    let counter = 1;
    
    // Check if code exists and increment counter if needed
    while (allProducts.some(p => p.code === newCode)) {
      newCode = `${product.code}_copia_${counter}`;
      counter++;
    }

    const { error } = await supabase.from("products").insert({
      user_id: user.id,
      code: newCode,
      name: `${product.name} (Copia)`,
      description: product.description,
      category: product.category,
      net_price: product.net_price,
      gross_price: product.gross_price,
    });

    if (error) {
      toast({
        title: "Errore",
        description: "Impossibile duplicare il prodotto",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Prodotto duplicato",
      description: "Il prodotto è stato duplicato con successo",
    });

    loadProducts();
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
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
              // Map Excel columns to our database fields
              const code = row['Codice'] || row['codice'] || '';
              const name = row['Nome prodotto/servizio'] || row['nome'] || row['name'] || '';
              const description = row['Descrizione'] || row['descrizione'] || row['description'] || '';
              const category = row['Categoria'] || row['categoria'] || row['category'] || '';
              const netPrice = parsePrice(row['Prezzo netto'] || row['prezzo_netto'] || row['net_price'] || '0');
              const grossPrice = parsePrice(row['Prezzo lordo'] || row['prezzo_lordo'] || row['gross_price'] || '0');

              if (!code || !name || !category) {
                errors.push(`Riga saltata: mancano dati obbligatori (codice: ${code || 'vuoto'})`);
                errorCount++;
                continue;
              }

              // Check if product already exists
              const { data: existingProduct } = await supabase
                .from('products')
                .select('id')
                .eq('user_id', user.id)
                .eq('code', code)
                .maybeSingle();

              if (existingProduct) {
                // Update existing product
                const { error } = await supabase
                  .from('products')
                  .update({
                    name,
                    description: description || null,
                    category,
                    net_price: netPrice,
                    gross_price: grossPrice,
                  })
                  .eq('id', existingProduct.id);

                if (error) {
                  errors.push(`Errore aggiornamento ${code}: ${error.message}`);
                  errorCount++;
                } else {
                  importedCount++;
                }
              } else {
                // Insert new product
                const { error } = await supabase.from('products').insert({
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
          if (importedCount > 0) {
            toast({
              title: "Importazione completata",
              description: `${importedCount} prodotti importati/aggiornati${errorCount > 0 ? `, ${errorCount} errori` : ''}`,
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
              description: `${errorCount} righe non importate. Controlla il formato del file.`,
              variant: "destructive",
            });
          }

          setImportDialogOpen(false);
          loadProducts();
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
          <p className="text-center text-muted-foreground">Caricamento prodotti...</p>
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
                <Package className="h-5 w-5" />
                Gestione Prodotti
              </CardTitle>
              <CardDescription>
                Totale: {allProducts.length} {allProducts.length === 1 ? 'prodotto' : 'prodotti'}
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
                    <DialogTitle>Importa Prodotti</DialogTitle>
                    <DialogDescription>
                      Carica un file Excel (.xlsx) o CSV con i tuoi prodotti.
                      <br />
                      <br />
                      Il file deve contenere le colonne: Codice, Nome prodotto/servizio, Descrizione, Categoria, Prezzo netto, Prezzo lordo
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
                      I prodotti con lo stesso codice verranno aggiornati automaticamente.
                    </p>
                  </div>
                </DialogContent>
              </Dialog>
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Nuovo prodotto
              </Button>
          </div>
        </div>
        </CardHeader>
        <CardContent>
          {allProducts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nessun prodotto disponibile. Crea il tuo primo prodotto per iniziare.
            </div>
          ) : (
            <>
              <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Codice</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Modalità di Pagamento</TableHead>
                  <TableHead className="text-right">Prezzo Netto</TableHead>
                  <TableHead className="text-right">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">{product.code}</TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{product.name}</div>
                        {product.description && (
                          <div className="text-sm text-muted-foreground line-clamp-1">
                            {product.description}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{product.category}</TableCell>
                    <TableCell>
                      {paymentSplitsByProduct[product.id]?.length > 0 ? (
                        <div className="flex flex-col gap-1">
                          {paymentSplitsByProduct[product.id].map((split, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs font-medium">
                                {split.percentage}%
                              </Badge>
                              <span className="text-sm">
                                {getPaymentModeLabel(split.payment_mode_id)}
                                {split.payment_term_id && (
                                  <span className="text-muted-foreground"> · {getPaymentTermLabel(split.payment_term_id)}</span>
                                )}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      €{product.net_price.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(product)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Modifica
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDuplicate(product)}>
                            <Copy className="mr-2 h-4 w-4" />
                            Duplica
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => setDeleteProductId(product.id)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Elimina
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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

      <AlertDialog open={!!deleteProductId} onOpenChange={() => setDeleteProductId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sei sicuro?</AlertDialogTitle>
            <AlertDialogDescription>
              Questa azione non può essere annullata. Il prodotto verrà eliminato permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Elimina</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ProductFormDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingProduct(null);
        }}
        editingProduct={editingProduct}
        onSuccess={handleProductFormSuccess}
      />
    </>
  );
};
