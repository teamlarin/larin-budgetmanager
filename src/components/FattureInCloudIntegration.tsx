import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Cloud, CheckCircle2, XCircle, RefreshCw, Trash2, Loader2, Link2, Unlink } from 'lucide-react';
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

  // Handle OAuth callback URL params
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('fic_connected') === 'true') {
      toast.success('Account Fatture in Cloud collegato con successo!');
      window.history.replaceState({}, '', window.location.pathname);
      queryClient.invalidateQueries({ queryKey: ['fic-connection'] });
      queryClient.invalidateQueries({ queryKey: ['fic-subscriptions'] });
    }
    const ficError = urlParams.get('fic_error');
    if (ficError) {
      const errorMessages: Record<string, string> = {
        access_denied: "Autorizzazione negata. L'utente ha rifiutato il consenso.",
        authorization_failed: 'Collegamento non riuscito. Riprova.',
      };
      toast.error(errorMessages[ficError] || `Errore collegamento: ${ficError}`);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [queryClient]);

  // Check connection status
  const { data: connectionData, isLoading: isCheckingConnection } = useQuery({
    queryKey: ['fic-connection'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('fatture-in-cloud-oauth', {
        body: { action: 'check-connection' },
      });
      if (error) throw error;
      return data as { connected: boolean; companyName?: string };
    },
    retry: false,
  });

  // Check subscriptions (only when connected)
  const { data: subscriptionsData, isLoading: isLoadingSubscriptions, refetch } = useQuery({
    queryKey: ['fic-subscriptions'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('fatture-in-cloud-register-webhook', {
        body: { action: 'check' },
      });
      if (error) throw error;
      return data;
    },
    enabled: connectionData?.connected === true,
    retry: false,
  });

  // Connect
  const connectMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('fatture-in-cloud-oauth', {
        body: { action: 'get-auth-url', appUrl: window.location.origin + window.location.pathname },
      });
      if (error) throw error;
      return data as { authUrl: string };
    },
    onSuccess: (data) => { window.location.href = data.authUrl; },
    onError: (error: Error) => { toast.error(`Errore: ${error.message}`); },
  });

  // Disconnect
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('fatture-in-cloud-oauth', {
        body: { action: 'disconnect' },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fic-connection'] });
      queryClient.invalidateQueries({ queryKey: ['fic-subscriptions'] });
      toast.success('Account scollegato');
    },
    onError: (error: Error) => { toast.error(`Errore: ${error.message}`); },
  });

  // Register webhook
  const registerMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('fatture-in-cloud-register-webhook', {
        body: { action: 'register' },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fic-subscriptions'] });
      toast.success('Webhook registrato! I fornitori verranno sincronizzati automaticamente.');
    },
    onError: (error: Error) => { toast.error(`Errore: ${error.message}`); },
  });

  // Delete subscription
  const deleteMutation = useMutation({
    mutationFn: async (subscriptionId: string) => {
      const { data, error } = await supabase.functions.invoke('fatture-in-cloud-register-webhook', {
        body: { action: 'delete', subscriptionId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fic-subscriptions'] });
      toast.success('Webhook rimosso');
    },
    onError: (error: Error) => { toast.error(`Errore: ${error.message}`); },
  });

  const isConnected = connectionData?.connected === true;
  const subscriptions: Subscription[] = subscriptionsData?.subscriptions || [];
  const hasSupplierWebhook = subscriptions.some((sub) => sub.types?.some((t) => t.includes('suppliers')));
  const isLoading = isCheckingConnection || isLoadingSubscriptions;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Cloud className="h-5 w-5 text-primary" />
          Integrazione Fatture in Cloud
        </CardTitle>
        <CardDescription>
          Sincronizza fornitori e invia preventivi a Fatture in Cloud
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertDescription>
            Collega il tuo account Fatture in Cloud per sincronizzare automaticamente
            i fornitori e inviare preventivi direttamente dalla piattaforma.
          </AlertDescription>
        </Alert>

        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Verifica stato integrazione...
          </div>
        ) : (
          <>
            {/* Connection Status */}
            <div className="flex items-center gap-2">
              <span className="font-medium">Account:</span>
              {isConnected ? (
                <Badge variant="default" className="bg-green-600">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Collegato{connectionData?.companyName ? ` (${connectionData.companyName})` : ''}
                </Badge>
              ) : (
                <Badge variant="secondary">
                  <XCircle className="h-3 w-3 mr-1" />
                  Non collegato
                </Badge>
              )}
            </div>

            {/* Webhook Status */}
            {isConnected && (
              <div className="flex items-center gap-2">
                <span className="font-medium">Sincronizzazione:</span>
                {hasSupplierWebhook ? (
                  <Badge variant="default" className="bg-green-600">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Attiva
                  </Badge>
                ) : (
                  <Badge variant="secondary">
                    <XCircle className="h-3 w-3 mr-1" />
                    Non attiva
                  </Badge>
                )}
              </div>
            )}

            {/* Active webhooks */}
            {subscriptions.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Webhook attivi:</p>
                {subscriptions.map((sub) => (
                  <div key={sub.id} className="flex items-center justify-between p-2 bg-muted rounded-md text-sm">
                    <div>
                      <span className="font-mono text-xs">{sub.id}</span>
                      <div className="text-muted-foreground text-xs">{sub.types?.join(', ')}</div>
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

            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              {!isConnected ? (
                <Button onClick={() => connectMutation.mutate()} disabled={connectMutation.isPending}>
                  {connectMutation.isPending ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Collegamento...</>
                  ) : (
                    <><Link2 className="h-4 w-4 mr-2" />Collega account Fatture in Cloud</>
                  )}
                </Button>
              ) : (
                <>
                  {!hasSupplierWebhook && (
                    <Button onClick={() => registerMutation.mutate()} disabled={registerMutation.isPending}>
                      {registerMutation.isPending ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Attivazione...</>
                      ) : (
                        <><Cloud className="h-4 w-4 mr-2" />Attiva sincronizzazione</>
                      )}
                    </Button>
                  )}
                  <Button variant="outline" onClick={() => disconnectMutation.mutate()} disabled={disconnectMutation.isPending}>
                    <Unlink className="h-4 w-4 mr-2" />
                    Scollega account
                  </Button>
                </>
              )}
              <Button
                variant="outline"
                onClick={() => {
                  queryClient.invalidateQueries({ queryKey: ['fic-connection'] });
                  refetch();
                }}
                disabled={isLoading}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Aggiorna
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
