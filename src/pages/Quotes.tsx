import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { FileText, Eye, Trash2, Download, Search, ArrowUpDown, Edit, MoreVertical } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { generatePdfQuote } from '@/lib/generatePdfQuote';
import { useState, useMemo, useEffect } from 'react';
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { hasPermission } from '@/lib/permissions';
import { QuoteStatusSelector } from '@/components/QuoteStatusSelector';

type Quote = {
  id: string;
  project_id: string;
  quote_number: string;
  total_amount: number;
  discount_percentage: number;
  margin_percentage: number;
  discounted_total: number;
  status: string;
  generated_at: string;
  projects: {
    name: string;
    clients: {
      name: string;
    } | null;
  } | null;
};

const Quotes = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [downloadingQuote, setDownloadingQuote] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<'quote_number' | 'generated_at' | 'total_amount' | 'discounted_total' | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [userRole, setUserRole] = useState<'admin' | 'account' | 'finance' | 'team_leader' | 'member' | null>(null);
  const ITEMS_PER_PAGE = 20;

  useEffect(() => {
    const fetchUserRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      setUserRole(roleData?.role as 'admin' | 'account' | 'finance' | 'team_leader' | 'member' | null);
    };

    fetchUserRole();
  }, []);

  const { data: allQuotes = [], isLoading, refetch } = useQuery<Quote[]>({
    queryKey: ['quotes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quotes')
        .select(`
          *,
          projects (
            name,
            clients (
              name
            )
          )
        `)
        .order('generated_at', { ascending: false });

      if (error) throw error;
      return data as Quote[];
    },
  });

  // Filter and sort quotes
  const filteredAndSortedQuotes = useMemo(() => {
    let filtered = allQuotes;

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = allQuotes.filter(quote => 
        quote.quote_number.toLowerCase().includes(term) ||
        quote.projects?.name.toLowerCase().includes(term) ||
        quote.projects?.clients?.name?.toLowerCase().includes(term)
      );
    }

    // Apply sorting
    if (sortField) {
      filtered = [...filtered].sort((a, b) => {
        let aValue: any;
        let bValue: any;

        if (sortField === 'quote_number') {
          aValue = a.quote_number;
          bValue = b.quote_number;
        } else if (sortField === 'generated_at') {
          aValue = new Date(a.generated_at).getTime();
          bValue = new Date(b.generated_at).getTime();
        } else if (sortField === 'total_amount') {
          aValue = a.total_amount;
          bValue = b.total_amount;
        } else if (sortField === 'discounted_total') {
          aValue = a.discounted_total;
          bValue = b.discounted_total;
        }

        if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [allQuotes, searchTerm, sortField, sortDirection]);

  const totalPages = Math.ceil(filteredAndSortedQuotes.length / ITEMS_PER_PAGE);
  const quotes = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredAndSortedQuotes.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredAndSortedQuotes, currentPage]);

  const handleDownloadPdf = async (quote: Quote) => {
    setDownloadingQuote(quote.id);
    try {
      // Fetch project details
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select(`
          *,
          clients (*),
          account_profile:profiles!projects_account_user_id_fkey (
            first_name,
            last_name
          )
        `)
        .eq('id', quote.project_id)
        .single();

      if (projectError) throw projectError;

      // Fetch budget items (only products)
      const { data: budgetItems, error: itemsError } = await supabase
        .from('budget_items')
        .select('*')
        .eq('project_id', quote.project_id)
        .eq('is_product', true)
        .order('display_order');

      if (itemsError) throw itemsError;

      // Fetch services linked to the budget template
      let services: any[] = [];
      if (project.budget_template_id) {
        const { data: servicesData, error: servicesError } = await supabase
          .from('services')
          .select('*')
          .eq('budget_template_id', project.budget_template_id);
        
        if (!servicesError && servicesData) {
          // Calculate products total
          const productsTotal = (budgetItems || []).reduce((sum: number, item: any) => 
            sum + Number(item.total_cost), 0
          );
          
          // Service price = total budget minus products
          const servicePrice = project.total_budget - productsTotal;
          
          // Override service price with calculated value
          services = servicesData.map(service => ({
            ...service,
            gross_price: servicePrice,
            net_price: servicePrice / 1.22
          }));
        }
      }

      await generatePdfQuote({
        project,
        budgetItems: budgetItems || [],
        services: services || [],
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
      setDownloadingQuote(null);
    }
  };

  const handleDelete = async (quoteId: string) => {
    if (!confirm('Sei sicuro di voler eliminare questo preventivo?')) {
      return;
    }

    const { error } = await supabase
      .from('quotes')
      .delete()
      .eq('id', quoteId);

    if (error) {
      toast({
        title: 'Errore',
        description: 'Errore durante l\'eliminazione del preventivo.',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Preventivo eliminato',
      description: 'Il preventivo è stato eliminato con successo.',
    });
    refetch();
  };

  const handleSort = (field: 'quote_number' | 'generated_at' | 'total_amount' | 'discounted_total') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection(field === 'generated_at' ? 'desc' : 'asc');
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

  return (
    <div className="container mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-foreground mb-2">Preventivi</h1>
        <p className="text-muted-foreground">
          Gestisci e visualizza tutti i preventivi generati
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">
              Totale: {filteredAndSortedQuotes.length} {filteredAndSortedQuotes.length === 1 ? 'preventivo' : 'preventivi'}
              {searchTerm && ` (${allQuotes.length} totali)`}
            </p>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cerca per numero preventivo, cliente o progetto..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-10"
            />
          </div>
        </CardHeader>
        <CardContent>
          {filteredAndSortedQuotes.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {searchTerm ? 'Nessun preventivo trovato con i criteri di ricerca.' : 'Nessun preventivo generato ancora.'}
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-lg border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSort('quote_number')}
                          className="h-8 px-2 hover:bg-transparent"
                        >
                          N° Preventivo
                          <ArrowUpDown className="ml-2 h-4 w-4" />
                        </Button>
                      </TableHead>
                      <TableHead>Progetto</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSort('generated_at')}
                          className="h-8 px-2 hover:bg-transparent"
                        >
                          Data Generazione
                          <ArrowUpDown className="ml-2 h-4 w-4" />
                        </Button>
                      </TableHead>
                      <TableHead className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSort('total_amount')}
                          className="h-8 px-2 hover:bg-transparent"
                        >
                          Importo
                          <ArrowUpDown className="ml-2 h-4 w-4" />
                        </Button>
                      </TableHead>
                      <TableHead className="text-right">Sconto</TableHead>
                      <TableHead className="text-right">Margine</TableHead>
                      <TableHead className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSort('discounted_total')}
                          className="h-8 px-2 hover:bg-transparent"
                        >
                          Totale
                          <ArrowUpDown className="ml-2 h-4 w-4" />
                        </Button>
                      </TableHead>
                      <TableHead>Stato</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {quotes.map((quote) => (
                      <TableRow key={quote.id}>
                        <TableCell className="font-medium">{quote.quote_number}</TableCell>
                        <TableCell>{quote.projects?.name || '-'}</TableCell>
                        <TableCell>{quote.projects?.clients?.name || '-'}</TableCell>
                        <TableCell>
                          {format(new Date(quote.generated_at), 'dd MMM yyyy HH:mm', { locale: it })}
                        </TableCell>
                        <TableCell className="text-right">
                          €{quote.total_amount.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                          {quote.discount_percentage}%
                        </TableCell>
                        <TableCell className="text-right">
                          {quote.margin_percentage}%
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          €{quote.discounted_total.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <QuoteStatusSelector
                            quoteId={quote.id}
                            projectId={quote.project_id}
                            currentStatus={quote.status as 'draft' | 'sent' | 'approved' | 'rejected'}
                            onStatusChange={refetch}
                          />
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-background">
                              <DropdownMenuItem onClick={() => navigate(`/quotes/${quote.id}`)} disabled={!hasPermission(userRole, 'canEditQuotes')}>
                                <Edit className="h-4 w-4 mr-2" />
                                Modifica
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDownloadPdf(quote)} disabled={!hasPermission(userRole, 'canDownloadQuotes')}>
                                <Download className="h-4 w-4 mr-2" />
                                Scarica PDF
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => navigate(`/projects/${quote.project_id}`)}>
                                <Eye className="h-4 w-4 mr-2" />
                                Visualizza progetto
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleDelete(quote.id)}
                                className="text-destructive focus:text-destructive"
                                disabled={!hasPermission(userRole, 'canDeleteQuotes')}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Elimina
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            
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
    </div>
  );
};

export default Quotes;
