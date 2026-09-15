import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Ban, RotateCcw } from 'lucide-react';
import { format } from 'date-fns';

interface ExclusionRow {
  id: string;
  deal_name: string;
  client_name: string | null;
  created_at: string;
}

export const HubSpotBudgetExclusions = () => {
  const queryClient = useQueryClient();

  const { data: exclusions = [], isLoading } = useQuery({
    queryKey: ['hubspot-budget-exclusions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hubspot_budget_exclusions')
        .select('id, deal_name, client_name, created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as ExclusionRow[];
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('hubspot_budget_exclusions')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hubspot-budget-exclusions'] });
      toast.success('Trattativa riammessa: il budget tornerà alla prossima sincronizzazione');
    },
    onError: (error) => {
      console.error('Error removing exclusion:', error);
      toast.error('Errore durante la rimozione dell\'esclusione');
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Ban className="h-5 w-5 text-primary" />
          Trattative escluse dalla sincronizzazione
        </CardTitle>
        <CardDescription>
          Queste trattative non generano più un budget, anche se restano nel foglio alimentato da HubSpot.
          Riammettendole, il budget verrà ricreato alla sincronizzazione successiva.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Caricamento…</p>
        ) : exclusions.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nessuna trattativa esclusa.</p>
        ) : (
          <ul className="divide-y">
            {exclusions.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-4 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium break-words">{row.deal_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.client_name ? `${row.client_name} · ` : ''}
                    escluso il {format(new Date(row.created_at), 'dd/MM/yyyy')}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => removeMutation.mutate(row.id)}
                  disabled={removeMutation.isPending}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Riammetti
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};
