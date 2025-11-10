import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Save, Download, Plus, Trash2, Edit, Check, X } from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { generatePdfQuote } from '@/lib/generatePdfQuote';

const QuoteDetail = () => {
  const { quoteId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [discount, setDiscount] = useState(0);
  const [margin, setMargin] = useState(0);
  const [status, setStatus] = useState('draft');
  const [isSaving, setIsSaving] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [editingProducts, setEditingProducts] = useState<any[]>([]);
  const [editingServices, setEditingServices] = useState<any[]>([]);

  const { data: quote, isLoading, refetch } = useQuery({
    queryKey: ['quote', quoteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quotes')
        .select(`
          *,
          projects (
            *,
            clients (*)
          )
        `)
        .eq('id', quoteId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!quoteId,
  });

  const { data: products = [] } = useQuery({
    queryKey: ['quote-products', quote?.project_id],
    queryFn: async () => {
      if (!quote?.project_id) return [];
      
      const { data, error } = await supabase
        .from('budget_items')
        .select('*')
        .eq('project_id', quote.project_id)
        .eq('is_product', true)
        .order('display_order');

      if (error) throw error;
      return data;
    },
    enabled: !!quote?.project_id,
  });

  const { data: services = [] } = useQuery({
    queryKey: ['quote-services', quote?.projects?.budget_template_id],
    queryFn: async () => {
      if (!quote?.projects?.budget_template_id) return [];
      
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('budget_template_id', quote.projects.budget_template_id);

      if (error) throw error;
      return data;
    },
    enabled: !!quote?.projects?.budget_template_id,
  });

  useEffect(() => {
    if (quote) {
      setDiscount(quote.discount_percentage || 0);
      setMargin(quote.margin_percentage || 0);
      setStatus(quote.status || 'draft');
    }
  }, [quote]);

  useEffect(() => {
    if (products.length > 0) {
      setEditingProducts([...products]);
    }
  }, [products]);

  useEffect(() => {
    if (services.length > 0) {
      setEditingServices([...services]);
    }
  }, [services]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Save products
      for (const product of editingProducts) {
        const { error } = await supabase
          .from('budget_items')
          .update({
            hours_worked: product.hours_worked,
            hourly_rate: product.hourly_rate,
            total_cost: product.hours_worked * product.hourly_rate,
          })
          .eq('id', product.id);
        
        if (error) throw error;
      }

      // Save services
      for (const service of editingServices) {
        const { error } = await supabase
          .from('services')
          .update({
            gross_price: service.gross_price,
          })
          .eq('id', service.id);
        
        if (error) throw error;
      }

      // Calculate totals
      const productsTotal = editingProducts.reduce((sum: number, item: any) => 
        sum + Number(item.hours_worked * item.hourly_rate), 0
      );
      
      const servicesTotal = editingServices.reduce((sum: number, service: any) => 
        sum + Number(service.gross_price || 0), 0
      );
      
      const totalAmount = productsTotal + servicesTotal;
      const discountedTotal = totalAmount * (1 - discount / 100);

      const { error } = await supabase
        .from('quotes')
        .update({
          discount_percentage: discount,
          margin_percentage: margin,
          status: status,
          total_amount: totalAmount,
          discounted_total: discountedTotal,
        })
        .eq('id', quoteId);

      if (error) throw error;

      toast({
        title: 'Modifiche salvate',
        description: 'Il preventivo è stato aggiornato con successo.',
      });
      
      setIsEditing(false);
      refetch();
    } catch (error) {
      console.error('Error saving quote:', error);
      toast({
        title: 'Errore',
        description: 'Errore durante il salvataggio delle modifiche.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const updateProduct = (id: string, field: string, value: any) => {
    setEditingProducts(prev => prev.map(p => {
      if (p.id === id) {
        const updated = { ...p, [field]: value };
        if (field === 'hours_worked' || field === 'hourly_rate') {
          updated.total_cost = updated.hours_worked * updated.hourly_rate;
        }
        return updated;
      }
      return p;
    }));
  };

  const updateService = (id: string, field: string, value: any) => {
    setEditingServices(prev => prev.map(s => 
      s.id === id ? { ...s, [field]: value } : s
    ));
  };

  const removeProduct = async (id: string) => {
    try {
      const { error } = await supabase
        .from('budget_items')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setEditingProducts(prev => prev.filter(p => p.id !== id));
      toast({
        title: 'Prodotto rimosso',
        description: 'Il prodotto è stato rimosso dal preventivo.',
      });
    } catch (error) {
      console.error('Error removing product:', error);
      toast({
        title: 'Errore',
        description: 'Errore durante la rimozione del prodotto.',
        variant: 'destructive',
      });
    }
  };

  const handleDownloadPdf = async () => {
    if (!quote) return;
    
    setIsDownloading(true);
    try {
      await generatePdfQuote({
        project: quote.projects,
        budgetItems: products,
        services: services,
      });

      toast({
        title: 'PDF scaricato',
        description: 'Il preventivo è stato scaricato con successo.',
      });
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast({
        title: 'Errore',
        description: 'Errore durante il download del PDF.',
        variant: 'destructive',
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap = {
      draft: { label: 'Bozza', variant: 'secondary' as const },
      sent: { label: 'Inviato', variant: 'default' as const },
      approved: { label: 'Approvato', variant: 'default' as const },
      rejected: { label: 'Rifiutato', variant: 'destructive' as const },
    };

    const config = statusMap[status as keyof typeof statusMap] || statusMap.draft;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-48"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">Preventivo non trovato</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const productsTotal = editingProducts.reduce((sum: number, item: any) => 
    sum + Number(item.hours_worked * item.hourly_rate), 0
  );
  
  const servicesTotal = editingServices.reduce((sum: number, service: any) => 
    sum + Number(service.gross_price || 0), 0
  );
  
  const totalAmount = productsTotal + servicesTotal;
  const discountAmount = totalAmount * (discount / 100);
  const discountedTotal = totalAmount - discountAmount;

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/quotes')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Torna ai preventivi
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{quote.quote_number}</h1>
            <p className="text-sm text-muted-foreground">
              Generato il {format(new Date(quote.generated_at), 'dd MMMM yyyy HH:mm', { locale: it })}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleDownloadPdf}
            disabled={isDownloading}
          >
            <Download className="h-4 w-4 mr-2" />
            Scarica PDF
          </Button>
          {isEditing ? (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditing(false);
                  setDiscount(quote.discount_percentage || 0);
                  setMargin(quote.margin_percentage || 0);
                  setStatus(quote.status || 'draft');
                  setEditingProducts([...products]);
                  setEditingServices([...services]);
                }}
              >
                <X className="h-4 w-4 mr-2" />
                Annulla
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                <Check className="h-4 w-4 mr-2" />
                {isSaving ? 'Salvataggio...' : 'Salva'}
              </Button>
            </>
          ) : (
            <Button onClick={() => setIsEditing(true)}>
              <Edit className="h-4 w-4 mr-2" />
              Modifica
            </Button>
          )}
        </div>
      </div>

      {/* Project Info */}
      <Card>
        <CardHeader>
          <CardTitle>Informazioni Progetto</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-muted-foreground">Progetto</Label>
              <p className="font-medium">{quote.projects?.name || '-'}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Cliente</Label>
              <p className="font-medium">{quote.projects?.clients?.name || '-'}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Stato</Label>
              {isEditing ? (
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Bozza</SelectItem>
                    <SelectItem value="sent">Inviato</SelectItem>
                    <SelectItem value="approved">Approvato</SelectItem>
                    <SelectItem value="rejected">Rifiutato</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                getStatusBadge(status)
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Services */}
      {editingServices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Servizi</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Codice</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Descrizione</TableHead>
                  <TableHead className="text-right">Prezzo Lordo</TableHead>
                  {isEditing && <TableHead className="w-[50px]"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {editingServices.map((service: any) => (
                  <TableRow key={service.id}>
                    <TableCell className="font-medium">{service.code}</TableCell>
                    <TableCell>{service.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {service.description || '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      {isEditing ? (
                        <Input
                          type="number"
                          value={service.gross_price}
                          onChange={(e) => updateService(service.id, 'gross_price', Number(e.target.value))}
                          className="w-24 text-right"
                          min="0"
                          step="0.01"
                        />
                      ) : (
                        `€${Number(service.gross_price || 0).toFixed(2)}`
                      )}
                    </TableCell>
                    {isEditing && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (confirm('Sei sicuro di voler rimuovere questo servizio?')) {
                              setEditingServices(prev => prev.filter(s => s.id !== service.id));
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Products */}
      {editingProducts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Prodotti</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Prezzo Unitario</TableHead>
                  <TableHead className="text-right">Quantità</TableHead>
                  <TableHead className="text-right">Totale</TableHead>
                  {isEditing && <TableHead className="w-[50px]"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {editingProducts.map((product: any) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">{product.activity_name}</TableCell>
                    <TableCell>{product.category}</TableCell>
                    <TableCell className="text-right">
                      {isEditing ? (
                        <Input
                          type="number"
                          value={product.hourly_rate}
                          onChange={(e) => updateProduct(product.id, 'hourly_rate', Number(e.target.value))}
                          className="w-24 text-right"
                          min="0"
                          step="0.01"
                        />
                      ) : (
                        `€${Number(product.hourly_rate).toFixed(2)}`
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {isEditing ? (
                        <Input
                          type="number"
                          value={product.hours_worked}
                          onChange={(e) => updateProduct(product.id, 'hours_worked', Number(e.target.value))}
                          className="w-20 text-right"
                          min="0"
                          step="0.1"
                        />
                      ) : (
                        product.hours_worked
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      €{Number(product.hours_worked * product.hourly_rate).toFixed(2)}
                    </TableCell>
                    {isEditing && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (confirm('Sei sicuro di voler rimuovere questo prodotto?')) {
                              removeProduct(product.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Totals */}
      <Card>
        <CardHeader>
          <CardTitle>Riepilogo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotale Servizi</span>
              <span className="font-medium">€{servicesTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotale Prodotti</span>
              <span className="font-medium">€{productsTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Sconto</span>
              {isEditing ? (
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={discount}
                    onChange={(e) => setDiscount(Number(e.target.value))}
                    className="w-20 text-right"
                    min="0"
                    max="100"
                  />
                  <span>%</span>
                </div>
              ) : (
                <span className="font-medium">{discount}% (-€{discountAmount.toFixed(2)})</span>
              )}
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Margine</span>
              {isEditing ? (
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={margin}
                    onChange={(e) => setMargin(Number(e.target.value))}
                    className="w-20 text-right"
                    min="0"
                    max="100"
                  />
                  <span>%</span>
                </div>
              ) : (
                <span className="font-medium">{margin}%</span>
              )}
            </div>
            <div className="border-t pt-2 mt-2">
              <div className="flex justify-between text-lg font-bold">
                <span>Totale</span>
                <span>€{discountedTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default QuoteDetail;
