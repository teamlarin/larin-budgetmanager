import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Eye, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

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

  const { data: quotes = [], isLoading, refetch } = useQuery<Quote[]>({
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
    <div className="container mx-auto p-6 space-y-6">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-foreground mb-2">Preventivi</h1>
        <p className="text-muted-foreground">
          Gestisci tutti i preventivi generati
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Elenco Preventivi
          </CardTitle>
        </CardHeader>
        <CardContent>
          {quotes.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                Nessun preventivo generato ancora.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N° Preventivo</TableHead>
                  <TableHead>Progetto</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Data Generazione</TableHead>
                  <TableHead className="text-right">Importo</TableHead>
                  <TableHead className="text-right">Sconto</TableHead>
                  <TableHead className="text-right">Margine</TableHead>
                  <TableHead className="text-right">Totale</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead className="text-right">Azioni</TableHead>
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
                    <TableCell>{getStatusBadge(quote.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/projects/${quote.project_id}`)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(quote.id)}
                        >
                          <Trash2 className="h-4 w-4" />
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
    </div>
  );
};

export default Quotes;
