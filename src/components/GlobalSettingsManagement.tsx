import { useState, useEffect } from 'react';
import { calculateSafeHours } from '@/lib/timeUtils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Settings, Save, AlertTriangle, Info, Euro, RefreshCw, Package } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CompanyClosureDaysManagement } from './CompanyClosureDaysManagement';

interface PackProgressResult {
  project_id: string;
  project_name: string;
  old_progress: number;
  new_progress: number;
  planned_hours: number;
  confirmed_hours: number;
}

interface ProjectionThresholds {
  warning: number;
  critical: number;
}

interface OverheadsSetting {
  amount: number;
}


export const GlobalSettingsManagement = () => {
  const queryClient = useQueryClient();
  const [warningThreshold, setWarningThreshold] = useState<number>(10);
  const [criticalThreshold, setCriticalThreshold] = useState<number>(25);
  const [overheadsAmount, setOverheadsAmount] = useState<number>(0);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [recalculateResults, setRecalculateResults] = useState<PackProgressResult[] | null>(null);

  // Fetch global settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ['app-settings', 'projection_thresholds'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('*')
        .eq('setting_key', 'projection_thresholds')
        .maybeSingle();

      if (error) throw error;
      return data;
    }
  });

  // Fetch overheads setting
  const { data: overheadsSetting, isLoading: isLoadingOverheads } = useQuery({
    queryKey: ['app-settings', 'overheads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('*')
        .eq('setting_key', 'overheads')
        .maybeSingle();

      if (error) throw error;
      return data;
    }
  });

  // Fetch Make webhook setting
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

  // Update local state when settings are loaded
  useEffect(() => {
    if (settings?.setting_value) {
      const value = settings.setting_value as unknown as ProjectionThresholds;
      setWarningThreshold(value.warning || 10);
      setCriticalThreshold(value.critical || 25);
    }
  }, [settings]);

  // Update overheads state when loaded
  useEffect(() => {
    if (overheadsSetting?.setting_value) {
      const value = overheadsSetting.setting_value as unknown as OverheadsSetting;
      setOverheadsAmount(value.amount || 0);
    }
  }, [overheadsSetting]);

  // Update Make webhook state when loaded
  useEffect(() => {
    if (makeWebhookSetting?.setting_value) {
      const value = makeWebhookSetting.setting_value as unknown as WebhookSetting;
      setMakeWebhookUrl(value.url || '');
    }
  }, [makeWebhookSetting]);

  // Save thresholds mutation
  const saveMutation = useMutation({
    mutationFn: async (thresholds: ProjectionThresholds) => {
      const settingValue = { warning: thresholds.warning, critical: thresholds.critical };
      
      if (settings?.id) {
        // Update existing
        const { error } = await supabase
          .from('app_settings')
          .update({ 
            setting_value: settingValue,
            description: 'Soglie default alert proiezione budget'
          })
          .eq('id', settings.id);
        
        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from('app_settings')
          .insert({ 
            setting_key: 'projection_thresholds',
            setting_value: settingValue,
            description: 'Soglie default alert proiezione budget'
          });
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app-settings'] });
      toast.success('Impostazioni salvate con successo');
    },
    onError: (error) => {
      console.error('Error saving settings:', error);
      toast.error('Errore durante il salvataggio delle impostazioni');
    }
  });

  // Save overheads mutation
  const saveOverheadsMutation = useMutation({
    mutationFn: async (amount: number) => {
      const settingValue = { amount };
      
      if (overheadsSetting?.id) {
        // Update existing
        const { error } = await supabase
          .from('app_settings')
          .update({ 
            setting_value: settingValue,
            description: 'Importo overheads da aggiungere al costo orario'
          })
          .eq('id', overheadsSetting.id);
        
        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from('app_settings')
          .insert({ 
            setting_key: 'overheads',
            setting_value: settingValue,
            description: 'Importo overheads da aggiungere al costo orario'
          });
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app-settings'] });
      toast.success('Overheads salvato con successo');
    },
    onError: (error) => {
      console.error('Error saving overheads:', error);
      toast.error('Errore durante il salvataggio degli overheads');
    }
  });

  // Save Make webhook mutation
  const saveMakeWebhookMutation = useMutation({
    mutationFn: async (url: string) => {
      const settingValue = { url };
      
      if (makeWebhookSetting?.id) {
        // Update existing
        const { error } = await supabase
          .from('app_settings')
          .update({ 
            setting_value: settingValue,
            description: 'Webhook URL Make per progetti completati'
          })
          .eq('id', makeWebhookSetting.id);
        
        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from('app_settings')
          .insert({ 
            setting_key: 'make_webhook_project_completed',
            setting_value: settingValue,
            description: 'Webhook URL Make per progetti completati'
          });
        
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

  const handleSave = () => {
    if (warningThreshold >= criticalThreshold) {
      toast.error('La soglia warning deve essere inferiore alla soglia critica');
      return;
    }
    
    if (warningThreshold < 0 || criticalThreshold < 0) {
      toast.error('Le soglie devono essere valori positivi');
      return;
    }

    saveMutation.mutate({
      warning: warningThreshold,
      critical: criticalThreshold
    });
  };

  const handleSaveOverheads = () => {
    if (overheadsAmount < 0) {
      toast.error('L\'importo overheads deve essere un valore positivo');
      return;
    }
    saveOverheadsMutation.mutate(overheadsAmount);
  };

  const handleSaveMakeWebhook = () => {
    saveMakeWebhookMutation.mutate(makeWebhookUrl);
  };

  const handleRecalculatePackProgress = async () => {
    setIsRecalculating(true);
    setRecalculateResults(null);
    
    try {
      const { data, error } = await supabase.rpc('recalculate_all_pack_projects_progress');
      
      if (error) throw error;
      
      const results = data as PackProgressResult[];
      setRecalculateResults(results);
      
      const updatedCount = results.filter(r => r.old_progress !== r.new_progress).length;
      
      if (updatedCount > 0) {
        toast.success(`Ricalcolo completato: ${updatedCount} progetti aggiornati`);
      } else {
        toast.info('Ricalcolo completato: nessun progetto da aggiornare');
      }
      
      // Invalida le query dei progetti per aggiornare l'interfaccia
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['approved-projects'] });
    } catch (error) {
      console.error('Error recalculating pack progress:', error);
      toast.error('Errore durante il ricalcolo del progresso');
    } finally {
      setIsRecalculating(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Calendario - Giorni di chiusura */}
      <CompanyClosureDaysManagement />

      {/* Overheads */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Euro className="h-5 w-5 text-primary" />
            Overheads
          </CardTitle>
          <CardDescription>
            Importo da aggiungere al costo orario degli utenti per il calcolo dei budget di progetto
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              L'importo overheads viene sommato al costo orario di ogni utente quando si calcolano i costi effettivi del progetto.
              Ad esempio, se un utente ha un costo orario di 50€ e l'overheads è 10€, il costo effettivo sarà 60€/ora.
            </AlertDescription>
          </Alert>

          <div className="space-y-2 max-w-xs">
            <Label htmlFor="overheadsAmount">Importo Overheads (€/ora)</Label>
            <Input
              id="overheadsAmount"
              type="number"
              min="0"
              step="0.01"
              value={overheadsAmount}
              onChange={(e) => setOverheadsAmount(Number(e.target.value))}
              placeholder="0.00"
            />
            <p className="text-xs text-muted-foreground">
              Importo in euro da aggiungere al costo orario di ogni utente
            </p>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSaveOverheads} disabled={saveOverheadsMutation.isPending}>
              <Save className="h-4 w-4 mr-2" />
              {saveOverheadsMutation.isPending ? 'Salvataggio...' : 'Salva Overheads'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Soglie Alert Proiezione Budget */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Soglie Alert Proiezione Budget
          </CardTitle>
          <CardDescription>
            Configura le soglie di default per gli alert di proiezione budget sui nuovi progetti
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Queste soglie vengono applicate come default ai nuovi progetti. 
              Ogni progetto può sovrascriverle con valori personalizzati nella sezione "Soglie Alert Budget".
            </AlertDescription>
          </Alert>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="warningThreshold">Soglia warning (%)</Label>
              <Input
                id="warningThreshold"
                type="number"
                min="0"
                max="100"
                value={warningThreshold}
                onChange={(e) => setWarningThreshold(Number(e.target.value))}
                placeholder="10"
              />
              <p className="text-xs text-muted-foreground">
                Alert giallo quando la proiezione supera il target di questa percentuale
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="criticalThreshold">Soglia critica (%)</Label>
              <Input
                id="criticalThreshold"
                type="number"
                min="0"
                max="100"
                value={criticalThreshold}
                onChange={(e) => setCriticalThreshold(Number(e.target.value))}
                placeholder="25"
              />
              <p className="text-xs text-muted-foreground">
                Alert rosso quando la proiezione supera il target di questa percentuale
              </p>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              <Save className="h-4 w-4 mr-2" />
              {saveMutation.isPending ? 'Salvataggio...' : 'Salva Impostazioni'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Ricalcola Progresso Progetti Pack */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Ricalcolo Progresso Progetti Pack
          </CardTitle>
          <CardDescription>
            Ricalcola il progresso di tutti i progetti con billing type "pack" basandosi sulle ore confermate
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Il progresso dei progetti pack viene calcolato come: (ore confermate / ore pianificate) × 100.
              Usa questo pulsante se noti discrepanze nei valori di progresso visualizzati.
            </AlertDescription>
          </Alert>

          <Button 
            onClick={handleRecalculatePackProgress} 
            disabled={isRecalculating}
            variant="outline"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRecalculating ? 'animate-spin' : ''}`} />
            {isRecalculating ? 'Ricalcolo in corso...' : 'Ricalcola Progresso'}
          </Button>

          {recalculateResults && recalculateResults.length > 0 && (
            <div className="mt-4 border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-2 font-medium">Progetto</th>
                    <th className="text-right p-2 font-medium">Ore Plan.</th>
                    <th className="text-right p-2 font-medium">Ore Conf.</th>
                    <th className="text-right p-2 font-medium">Vecchio %</th>
                    <th className="text-right p-2 font-medium">Nuovo %</th>
                  </tr>
                </thead>
                <tbody>
                  {recalculateResults.map((result) => (
                    <tr 
                      key={result.project_id} 
                      className={`border-t ${result.old_progress !== result.new_progress ? 'bg-amber-50 dark:bg-amber-900/10' : ''}`}
                    >
                      <td className="p-2 truncate max-w-[200px]" title={result.project_name}>
                        {result.project_name}
                      </td>
                      <td className="text-right p-2">{Number(result.planned_hours).toFixed(2)}</td>
                      <td className="text-right p-2">{Number(result.confirmed_hours).toFixed(2)}</td>
                      <td className="text-right p-2">{result.old_progress}%</td>
                      <td className={`text-right p-2 font-medium ${result.new_progress > 100 ? 'text-red-600' : ''}`}>
                        {result.new_progress}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {recalculateResults && recalculateResults.length === 0 && (
            <p className="text-muted-foreground text-sm">
              Nessun progetto pack trovato.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Webhook Make - Progetto Completato */}
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

      {/* Integrazione Fatture in Cloud - in fondo */}
      <FattureInCloudIntegration />
    </div>
  );
};
