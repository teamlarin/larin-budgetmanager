import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Plus, Copy, Pencil, Package, Upload } from "lucide-react";
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
import { z } from "zod";
import * as XLSX from "xlsx";

const productSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Il codice è obbligatorio")
    .max(50, "Il codice è troppo lungo"),
  name: z
    .string()
    .trim()
    .min(1, "Il nome prodotto è obbligatorio")
    .max(200, "Il nome è troppo lungo"),
  description: z.string().trim().max(1000, "La descrizione è troppo lunga").optional(),
  category: z
    .string()
    .trim()
    .min(1, "La categoria è obbligatoria")
    .max(100, "La categoria è troppo lunga"),
  net_price: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Il prezzo deve essere un numero valido con massimo 2 decimali")
    .refine((val) => parseFloat(val) >= 0, "Il prezzo netto non può essere negativo"),
  gross_price: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Il prezzo deve essere un numero valido con massimo 2 decimali")
    .refine((val) => parseFloat(val) >= 0, "Il prezzo lordo non può essere negativo"),
});

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

export const ProductManagement = () => {
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteProductId, setDeleteProductId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    description: "",
    category: "",
    net_price: "",
    gross_price: "",
  });

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
      setProducts(data || []);
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = productSchema.safeParse(formData);
    if (!result.success) {
      const errors = result.error.errors.map((e) => e.message).join(", ");
      toast({
        title: "Errore di validazione",
        description: errors,
        variant: "destructive",
      });
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({
        title: "Errore",
        description: "Utente non autenticato",
        variant: "destructive",
      });
      return;
    }

    const productData = {
      user_id: user.id,
      code: result.data.code,
      name: result.data.name,
      description: result.data.description || null,
      category: result.data.category,
      net_price: parseFloat(result.data.net_price),
      gross_price: parseFloat(result.data.gross_price),
    };

    if (editingProduct) {
      // Update existing product
      const { error } = await supabase
        .from("products")
        .update(productData)
        .eq("id", editingProduct.id);

      if (error) {
        toast({
          title: "Errore",
          description: error.message || "Impossibile aggiornare il prodotto",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Prodotto aggiornato",
        description: "Il prodotto è stato modificato con successo",
      });
    } else {
      // Create new product
      const { error } = await supabase.from("products").insert(productData);

      if (error) {
        if (error.code === "23505") {
          toast({
            title: "Errore",
            description: "Un prodotto con questo codice esiste già",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Errore",
            description: error.message || "Impossibile creare il prodotto",
            variant: "destructive",
          });
        }
        return;
      }

      toast({
        title: "Prodotto creato",
        description: "Il prodotto è stato creato con successo",
      });
    }

    setDialogOpen(false);
    resetForm();
    loadProducts();
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
    while (products.some(p => p.code === newCode)) {
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
    setFormData({
      code: product.code,
      name: product.name,
      description: product.description || "",
      category: product.category,
      net_price: product.net_price.toString(),
      gross_price: product.gross_price.toString(),
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      code: "",
      name: "",
      description: "",
      category: "",
      net_price: "",
      gross_price: "",
    });
    setEditingProduct(null);
  };

  const handleDialogOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      resetForm();
    }
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
                Crea e gestisci i prodotti del tuo catalogo
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
              <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Nuovo Prodotto
                  </Button>
                </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>
                    {editingProduct ? "Modifica Prodotto" : "Crea Nuovo Prodotto"}
                  </DialogTitle>
                  <DialogDescription>
                    {editingProduct
                      ? "Modifica i dati del prodotto"
                      : "Inserisci i dati per creare un nuovo prodotto"}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="code">Codice *</Label>
                      <Input
                        id="code"
                        value={formData.code}
                        onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                        placeholder="PRD-001"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="category">Categoria *</Label>
                      <Input
                        id="category"
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        placeholder="Elettronica"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="name">Nome Prodotto *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Nome del prodotto"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="description">Descrizione</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Descrizione del prodotto"
                      rows={3}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="net_price">Prezzo Netto (€) *</Label>
                      <Input
                        id="net_price"
                        type="text"
                        value={formData.net_price}
                        onChange={(e) => setFormData({ ...formData, net_price: e.target.value })}
                        placeholder="99.99"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="gross_price">Prezzo Lordo (€) *</Label>
                      <Input
                        id="gross_price"
                        type="text"
                        value={formData.gross_price}
                        onChange={(e) => setFormData({ ...formData, gross_price: e.target.value })}
                        placeholder="122.00"
                        required
                      />
                    </div>
                  </div>
                  <Button type="submit" className="w-full">
                    {editingProduct ? "Salva Modifiche" : "Crea Prodotto"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
        </CardHeader>
        <CardContent>
          {products.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nessun prodotto disponibile. Crea il tuo primo prodotto per iniziare.
            </div>
          ) : (
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
                    <TableCell className="text-right">
                      €{product.net_price.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      €{product.gross_price.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(product)}
                          title="Modifica"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDuplicate(product)}
                          title="Duplica"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteProductId(product.id)}
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
    </>
  );
};
