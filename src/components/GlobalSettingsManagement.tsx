import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Settings, Save, AlertTriangle, Info, Euro } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CompanyClosureDaysManagement } from './CompanyClosureDaysManagement';
import { TimesheetImport } from './TimesheetImport';
import { FattureInCloudIntegration } from './FattureInCloudIntegration';

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

      {/* Importa Timesheet */}
      <TimesheetImport onImportComplete={() => {}} />

      {/* Integrazione Fatture in Cloud - in fondo */}
      <FattureInCloudIntegration />
    </div>
  );
};
