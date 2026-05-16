import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Calendar as CalendarIcon, Info, Plus, Trash2, Play, RefreshCw } from 'lucide-react';

const OFF_PROJECT_ID = '648c175f-d8ed-49fd-867a-1aa6c1d7d913'; // Larin OFF

type Settings = {
  enabled: boolean;
  detection: { organizer_email_patterns: string[]; keywords: string[] };
  slack_channel: string;
  default_times: { start: string; end: string };
};

const DEFAULT_SETTINGS: Settings = {
  enabled: false,
  detection: { organizer_email_patterns: ['@jethr.com', '@jethr.io', 'jethr'], keywords: ['ferie', 'permesso', 'malattia', 'rol', 'banca ore'] },
  slack_channel: '',
  default_times: { start: '09:00', end: '18:00' },
};

export const JethrIntegration = () => {
  const qc = useQueryClient();
  const [s, setS] = useState<Settings>(DEFAULT_SETTINGS);
  const [running, setRunning] = useState(false);

  // Load settings
  const { data: settingsRows } = useQuery({
    queryKey: ['app-settings', 'jethr'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('setting_key, setting_value, id')
        .in('setting_key', ['jethr_enabled', 'jethr_detection', 'jethr_slack_channel', 'jethr_default_times']);
      if (error) throw error;
      return data || [];
    },
  });

  useEffect(() => {
    if (!settingsRows) return;
    const map: Record<string, any> = {};
    settingsRows.forEach((r: any) => { map[r.setting_key] = r.setting_value; });
    setS({
      enabled: map.jethr_enabled === true,
      detection: map.jethr_detection || DEFAULT_SETTINGS.detection,
      slack_channel: typeof map.jethr_slack_channel === 'string' ? map.jethr_slack_channel : '',
      default_times: map.jethr_default_times || DEFAULT_SETTINGS.default_times,
    });
  }, [settingsRows]);

  // Budget items for the OFF project
  const { data: offItems } = useQuery({
    queryKey: ['jethr-off-budget-items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('budget_items')
        .select('id, activity_name, category')
        .eq('project_id', OFF_PROJECT_ID)
        .order('activity_name');
      if (error) throw error;
      return data || [];
    },
  });

  // Mappings
  const { data: mappings } = useQuery({
    queryKey: ['jethr-mappings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jethr_absence_mappings')
        .select('*')
        .order('priority');
      if (error) throw error;
      return data || [];
    },
  });

  const saveSettings = useMutation({
    mutationFn: async () => {
      const upserts: { key: string; value: any }[] = [
        { key: 'jethr_enabled', value: s.enabled },
        { key: 'jethr_detection', value: s.detection },
        { key: 'jethr_slack_channel', value: s.slack_channel },
        { key: 'jethr_default_times', value: s.default_times },
      ];
      for (const u of upserts) {
        const row = (settingsRows || []).find((r: any) => r.setting_key === u.key);
        if (row) {
          const { error } = await supabase.from('app_settings').update({ setting_value: u.value }).eq('id', row.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('app_settings').insert({ setting_key: u.key, setting_value: u.value });
          if (error) throw error;
        }
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['app-settings', 'jethr'] }); toast.success('Impostazioni JetHr salvate'); },
    onError: (e: any) => toast.error(`Errore: ${e.message}`),
  });

  const addMapping = useMutation({
    mutationFn: async () => {
      const firstItem = offItems?.[0];
      if (!firstItem) throw new Error('Crea prima un\'attività nel progetto OFF');
      const { error } = await supabase.from('jethr_absence_mappings').insert({
        keyword: '',
        budget_item_id: firstItem.id,
        priority: ((mappings?.length || 0) + 1) * 10,
        is_default: false,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['jethr-mappings'] }),
    onError: (e: any) => toast.error(e.message),
  });

  const updateMapping = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: any }) => {
      const { error } = await supabase.from('jethr_absence_mappings').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['jethr-mappings'] }),
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMapping = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('jethr_absence_mappings').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['jethr-mappings'] }),
    onError: (e: any) => toast.error(e.message),
  });

  const runNow = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke('jethr-auto-link-events', { body: {} });
      if (error) throw error;
      toast.success(`Sincronizzazione completata: ${data?.processed ?? 0} eventi processati`);
    } catch (e: any) {
      toast.error(`Errore: ${e.message}`);
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarIcon className="h-5 w-5 text-primary" />
          JetHr — Assenze da Google Calendar
        </CardTitle>
        <CardDescription>
          Riconosce gli eventi creati da JetHr nel Google Calendar degli utenti, li pianifica automaticamente sul progetto "Larin OFF" e notifica un canale Slack.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Richiede che ogni utente abbia collegato Google Calendar a TimeTrap e che JetHr scriva sul suo calendario.
            Il job gira automaticamente ogni 10 minuti.
          </AlertDescription>
        </Alert>

        <div className="flex items-center justify-between">
          <div>
            <Label>Integrazione attiva</Label>
            <p className="text-xs text-muted-foreground">Se disattivata, il job salta tutti gli eventi.</p>
          </div>
          <Switch checked={s.enabled} onCheckedChange={(v) => setS({ ...s, enabled: v })} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Pattern email organizer (uno per riga)</Label>
            <textarea
              className="w-full min-h-[80px] rounded-md border bg-background p-2 text-sm"
              value={(s.detection.organizer_email_patterns || []).join('\n')}
              onChange={(e) => setS({ ...s, detection: { ...s.detection, organizer_email_patterns: e.target.value.split('\n').map(x => x.trim()).filter(Boolean) } })}
              placeholder="@jethr.com&#10;@jethr.io"
            />
          </div>
          <div className="space-y-2">
            <Label>Keyword nel titolo/descrizione (uno per riga)</Label>
            <textarea
              className="w-full min-h-[80px] rounded-md border bg-background p-2 text-sm"
              value={(s.detection.keywords || []).join('\n')}
              onChange={(e) => setS({ ...s, detection: { ...s.detection, keywords: e.target.value.split('\n').map(x => x.trim()).filter(Boolean) } })}
              placeholder="ferie&#10;permesso&#10;malattia"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Canale Slack</Label>
            <Input value={s.slack_channel} onChange={(e) => setS({ ...s, slack_channel: e.target.value })} placeholder="#assenze-jethr o C0123ABC" />
          </div>
          <div className="space-y-2">
            <Label>Orario inizio (all-day)</Label>
            <Input type="time" value={s.default_times.start} onChange={(e) => setS({ ...s, default_times: { ...s.default_times, start: e.target.value } })} />
          </div>
          <div className="space-y-2">
            <Label>Orario fine (all-day)</Label>
            <Input type="time" value={s.default_times.end} onChange={(e) => setS({ ...s, default_times: { ...s.default_times, end: e.target.value } })} />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <Label>Mappature keyword → attività progetto OFF</Label>
            <Button variant="outline" size="sm" onClick={() => addMapping.mutate()}>
              <Plus className="h-4 w-4 mr-1" /> Aggiungi
            </Button>
          </div>
          <div className="space-y-2">
            {(mappings || []).map((m: any) => (
              <div key={m.id} className="grid grid-cols-12 gap-2 items-center p-2 border rounded-md">
                <Input
                  className="col-span-4"
                  placeholder="keyword (es. ferie)"
                  defaultValue={m.keyword}
                  onBlur={(e) => e.target.value !== m.keyword && updateMapping.mutate({ id: m.id, patch: { keyword: e.target.value } })}
                  disabled={m.is_default}
                />
                <Select value={m.budget_item_id} onValueChange={(v) => updateMapping.mutate({ id: m.id, patch: { budget_item_id: v } })}>
                  <SelectTrigger className="col-span-4"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(offItems || []).map((bi) => (
                      <SelectItem key={bi.id} value={bi.id}>{bi.activity_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  className="col-span-2"
                  type="number"
                  defaultValue={m.priority}
                  onBlur={(e) => Number(e.target.value) !== m.priority && updateMapping.mutate({ id: m.id, patch: { priority: Number(e.target.value) } })}
                />
                <div className="col-span-1 flex items-center gap-1">
                  <Switch checked={m.is_default} onCheckedChange={(v) => updateMapping.mutate({ id: m.id, patch: { is_default: v, keyword: v ? '(default)' : m.keyword } })} />
                </div>
                <Button variant="ghost" size="icon" className="col-span-1" onClick={() => deleteMapping.mutate(m.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {(!mappings || mappings.length === 0) && (
              <p className="text-xs text-muted-foreground">Nessuna mappatura. Aggiungine almeno una.</p>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            La prima keyword (per priorità) che matcha il titolo dell'evento vince. Marca una mappatura come <b>default</b> per usarla come fallback.
          </p>
        </div>

        <div className="flex items-center justify-between pt-2 border-t">
          <Button variant="outline" onClick={runNow} disabled={running}>
            {running ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
            Sincronizza ora
          </Button>
          <Button onClick={() => saveSettings.mutate()} disabled={saveSettings.isPending}>
            {saveSettings.isPending ? 'Salvataggio...' : 'Salva impostazioni'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
