import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Save, Info, Webhook, ExternalLink, Sparkles, Slack as SlackIcon } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FattureInCloudIntegration } from './FattureInCloudIntegration';
import { HubSpotIntegration } from './HubSpotIntegration';
import { GoogleSheetSyncSettings } from './GoogleSheetSyncSettings';
import { SlackChannelAutoMatchDialog } from './SlackChannelAutoMatchDialog';

interface WebhookSetting {
  url: string;
}

export const IntegrationsTab = () => {
  const queryClient = useQueryClient();
  const [makeWebhookUrl, setMakeWebhookUrl] = useState<string>('');
  const [slackMatchOpen, setSlackMatchOpen] = useState(false);

  const { data: makeWebhookSetting } = useQuery({
    queryKey: ['app-settings', 'make_webhook_project_completed'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('*')
        .eq('setting_key', 'make_webhook_project_completed')
        .maybeSingle();
      if (error) throw error;
      return data;
    }
  });

  useEffect(() => {
    if (makeWebhookSetting?.setting_value) {
      const value = makeWebhookSetting.setting_value as unknown as WebhookSetting;
      setMakeWebhookUrl(value.url || '');
    }
  }, [makeWebhookSetting]);

  const saveMakeWebhookMutation = useMutation({
    mutationFn: async (url: string) => {
      const settingValue = { url };
      if (makeWebhookSetting?.id) {
        const { error } = await supabase
          .from('app_settings')
          .update({ setting_value: settingValue, description: 'Webhook URL Make per progetti completati' })
          .eq('id', makeWebhookSetting.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('app_settings')
          .insert({ setting_key: 'make_webhook_project_completed', setting_value: settingValue, description: 'Webhook URL Make per progetti completati' });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app-settings'] });
      toast.success('Webhook Make salvato con successo');
    },
    onError: (error) => {
      console.error('Error saving Make webhook:', error);
      toast.error('Errore durante il salvataggio del webhook');
    }
  });

  const handleSaveMakeWebhook = () => {
    saveMakeWebhookMutation.mutate(makeWebhookUrl);
  };

  return (
    <div className="space-y-6">
      {/* Slack — Auto-associazione canali ai progetti */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SlackIcon className="h-5 w-5 text-primary" />
            Slack — Associa canali ai progetti
          </CardTitle>
          <CardDescription>
            Genera suggerimenti automatici di canali Slack per i progetti che non ne hanno uno collegato,
            basandosi su nome cliente e parole chiave del progetto. Tu confermi prima del salvataggio.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => setSlackMatchOpen(true)}>
            <Sparkles className="h-4 w-4 mr-2" />
            Avvia auto-associazione
          </Button>
        </CardContent>
      </Card>

      {/* HubSpot */}
      <HubSpotIntegration />

      {/* Google Sheet Sync */}
      <GoogleSheetSyncSettings />

      {/* Fatture in Cloud */}
      <FattureInCloudIntegration />

      {/* Webhook Make */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Webhook className="h-5 w-5 text-primary" />
            Webhook Make - Progetto Completato
          </CardTitle>
          <CardDescription>
            Configura l'URL del webhook Make per ricevere notifiche quando un progetto passa allo stato "completato"
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Quando un progetto cambia stato e passa a "completato", verrà inviata una richiesta POST a questo webhook
              con i dettagli del progetto (nome, cliente, account, budget, date, ecc.).
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="makeWebhookUrl">URL Webhook Make</Label>
            <Input
              id="makeWebhookUrl"
              type="url"
              value={makeWebhookUrl}
              onChange={(e) => setMakeWebhookUrl(e.target.value)}
              placeholder="https://hook.eu2.make.com/..."
            />
            <p className="text-xs text-muted-foreground">
              Incolla qui l'URL del webhook generato da Make (Integromat)
            </p>
          </div>

          <div className="flex items-center justify-between">
            <a
              href="https://www.make.com/en/help/tools/webhooks"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline flex items-center gap-1"
            >
              Come creare un webhook su Make
              <ExternalLink className="h-3 w-3" />
            </a>
            <Button onClick={handleSaveMakeWebhook} disabled={saveMakeWebhookMutation.isPending}>
              <Save className="h-4 w-4 mr-2" />
              {saveMakeWebhookMutation.isPending ? 'Salvataggio...' : 'Salva Webhook'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <SlackChannelAutoMatchDialog
        open={slackMatchOpen}
        onOpenChange={setSlackMatchOpen}
      />
    </div>
  );
};
