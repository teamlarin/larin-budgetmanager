import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Cloud, CheckCircle2, XCircle, RefreshCw, Trash2, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

interface Subscription {
  id: string;
  sink: string;
  types: string[];
  status: string;
}

export const FattureInCloudIntegration = () => {
  const queryClient = useQueryClient();
  const [isRegistering, setIsRegistering] = useState(false);

  // Check existing subscriptions
  const { data: subscriptionsData, isLoading, refetch } = useQuery({
    queryKey: ['fic-subscriptions'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Non autenticato');

      const { data, error } = await supabase.functions.invoke('fatture-in-cloud-register-webhook', {
        body: { action: 'check' }
      });

      if (error) throw error;
      return data;
    },
    retry: false
  });

  // Register webhook mutation
  const registerMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('fatture-in-cloud-register-webhook', {
        body: { action: 'register' }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fic-subscriptions'] });
      toast.success('Webhook registrato con successo! I fornitori verranno sincronizzati automaticamente.');
    },
    onError: (error: Error) => {
      console.error('Error registering webhook:', error);
      toast.error(`Errore: ${error.message}`);
    }
  });

  // Delete subscription mutation
  const deleteMutation = useMutation({
    mutationFn: async (subscriptionId: string) => {
      const { data, error } = await supabase.functions.invoke('fatture-in-cloud-register-webhook', {
        body: { action: 'delete', subscriptionId }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fic-subscriptions'] });
      toast.success('Subscription eliminata');
    },
    onError: (error: Error) => {
      toast.error(`Errore: ${error.message}`);
    }
  });

  const subscriptions: Subscription[] = subscriptionsData?.subscriptions || [];
  const hasSupplierWebhook = subscriptions.some(
    (sub) => sub.types?.some(t => t.includes('suppliers'))
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Cloud className="h-5 w-5 text-primary" />
          Integrazione Fatture in Cloud
        </CardTitle>
        <CardDescription>
          Sincronizza automaticamente i fornitori da Fatture in Cloud
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertDescription>
            Quando attivi l'integrazione, ogni nuovo fornitore creato o modificato in Fatture in Cloud 
            verrà automaticamente sincronizzato con il database di questo software.
          </AlertDescription>
        </Alert>

        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Verifica stato integrazione...
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <span className="font-medium">Stato:</span>
              {hasSupplierWebhook ? (
                <Badge variant="default" className="bg-green-600">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Attivo
                </Badge>
              ) : (
                <Badge variant="secondary">
                  <XCircle className="h-3 w-3 mr-1" />
                  Non configurato
                </Badge>
              )}
            </div>

            {subscriptions.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Webhook attivi:</p>
                {subscriptions.map((sub) => (
                  <div 
                    key={sub.id} 
                    className="flex items-center justify-between p-2 bg-muted rounded-md text-sm"
                  >
                    <div>
                      <span className="font-mono text-xs">{sub.id}</span>
                      <div className="text-muted-foreground text-xs">
                        {sub.types?.join(', ')}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteMutation.mutate(sub.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              {!hasSupplierWebhook && (
                <Button 
                  onClick={() => registerMutation.mutate()}
                  disabled={registerMutation.isPending}
                >
                  {registerMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Registrazione...
                    </>
                  ) : (
                    <>
                      <Cloud className="h-4 w-4 mr-2" />
                      Attiva sincronizzazione fornitori
                    </>
                  )}
                </Button>
              )}
              <Button 
                variant="outline"
                onClick={() => refetch()}
                disabled={isLoading}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Aggiorna stato
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
