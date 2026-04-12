import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { RefreshCw, Plus, Trash2, FileSpreadsheet } from 'lucide-react';

interface OwnerMapping {
  id: string;
  hubspot_owner_id: string;
  user_id: string;
}

interface Profile {
  id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

export const GoogleSheetSyncSettings = () => {
  const [mappings, setMappings] = useState<OwnerMapping[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncingBudgets, setSyncingBudgets] = useState(false);
  const [newOwnerId, setNewOwnerId] = useState('');
  const [newUserId, setNewUserId] = useState('');
  const [lastResult, setLastResult] = useState<any>(null);
  const [lastBudgetResult, setLastBudgetResult] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [mappingsRes, profilesRes] = await Promise.all([
      supabase.from('hubspot_owner_mappings' as any).select('*'),
      supabase.from('profiles').select('id, full_name, first_name, last_name, email').eq('approved', true).is('deleted_at', null),
    ]);
    if (mappingsRes.data) setMappings(mappingsRes.data as any);
    if (profilesRes.data) setProfiles(profilesRes.data);
  };

  const addMapping = async () => {
    if (!newOwnerId || !newUserId) return;
    const { error } = await (supabase as any).from('hubspot_owner_mappings').insert({
      hubspot_owner_id: newOwnerId,
      user_id: newUserId,
    });
    if (error) {
      toast({ title: 'Errore', description: error.message, variant: 'destructive' });
    } else {
      setNewOwnerId('');
      setNewUserId('');
      loadData();
    }
  };

  const deleteMapping = async (id: string) => {
    await (supabase as any).from('hubspot_owner_mappings').delete().eq('id', id);
    loadData();
  };

  const triggerSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-google-sheet');
      if (error) throw error;
      setLastResult(data);
      toast({
        title: 'Sincronizzazione completata',
        description: `${data.clients_created} clienti creati, ${data.clients_updated} aggiornati, ${data.contacts_created} contatti creati`,
      });
    } catch (error: any) {
      toast({ title: 'Errore', description: error.message, variant: 'destructive' });
    } finally {
      setSyncing(false);
    }
  };

  const triggerBudgetSync = async () => {
    setSyncingBudgets(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-budget-drafts');
      if (error) throw error;
      setLastBudgetResult(data);
      toast({
        title: 'Sincronizzazione trattative completata',
        description: `${data.budgets_created} bozze create, ${data.budgets_updated} aggiornate, ${data.budgets_skipped} invariate`,
      });
    } catch (error: any) {
      toast({ title: 'Errore', description: error.message, variant: 'destructive' });
    } finally {
      setSyncingBudgets(false);
    }
  };

  const getProfileName = (userId: string) => {
    const p = profiles.find(pr => pr.id === userId);
    if (!p) return userId;
    return p.full_name || `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.email || userId;
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="py-4 px-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-base">Sync Google Sheet</CardTitle>
                <CardDescription className="text-xs">
                  Sincronizzazione automatica clienti/contatti dal foglio Google condiviso
                </CardDescription>
              </div>
            </div>
            <Button onClick={triggerSync} disabled={syncing} size="sm">
              <RefreshCw className={`h-4 w-4 mr-1 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Sincronizzazione...' : 'Sincronizza ora'}
            </Button>
          </div>
        </CardHeader>
        {lastResult && (
          <CardContent className="py-3 px-5 pt-0">
            <div className="text-xs text-muted-foreground bg-muted/50 rounded-md p-2 space-y-0.5">
              <p>Righe elaborate: {lastResult.total_rows}</p>
              <p>Clienti creati: {lastResult.clients_created} | Aggiornati: {lastResult.clients_updated}</p>
              <p>Contatti creati: {lastResult.contacts_created} | Duplicati ignorati: {lastResult.contacts_skipped}</p>
            </div>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader className="py-4 px-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-base">Sync Trattative → Bozze Budget</CardTitle>
                <CardDescription className="text-xs">
                  Crea bozze di budget dal foglio 3 (trattative HubSpot). Automatico 3x al giorno.
                </CardDescription>
              </div>
            </div>
            <Button onClick={triggerBudgetSync} disabled={syncingBudgets} size="sm">
              <RefreshCw className={`h-4 w-4 mr-1 ${syncingBudgets ? 'animate-spin' : ''}`} />
              {syncingBudgets ? 'Sincronizzazione...' : 'Sincronizza ora'}
            </Button>
          </div>
        </CardHeader>
        {lastBudgetResult && (
          <CardContent className="py-3 px-5 pt-0">
            <div className="text-xs text-muted-foreground bg-muted/50 rounded-md p-2 space-y-0.5">
              <p>Righe elaborate: {lastBudgetResult.total_rows}</p>
              <p>Bozze create: {lastBudgetResult.budgets_created} | Aggiornate: {lastBudgetResult.budgets_updated}</p>
              <p>Invariate: {lastBudgetResult.budgets_skipped}</p>
            </div>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader className="py-4 px-5">
          <CardTitle className="text-sm">Mapping Proprietari HubSpot</CardTitle>
          <CardDescription className="text-xs">
            Associa gli ID proprietario HubSpot agli utenti del sistema
          </CardDescription>
        </CardHeader>
        <CardContent className="py-3 px-5 pt-0 space-y-3">
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Label className="text-xs">ID HubSpot Owner</Label>
              <Input
                value={newOwnerId}
                onChange={(e) => setNewOwnerId(e.target.value)}
                placeholder="es. 57375667"
                className="h-8 text-xs"
              />
            </div>
            <div className="flex-1">
              <Label className="text-xs">Utente</Label>
              <Select value={newUserId} onValueChange={setNewUserId}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Seleziona utente" />
                </SelectTrigger>
                <SelectContent>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="text-xs">
                      {p.full_name || `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" onClick={addMapping} disabled={!newOwnerId || !newUserId} className="h-8">
              <Plus className="h-3 w-3" />
            </Button>
          </div>

          {mappings.length > 0 && (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs py-2">ID HubSpot</TableHead>
                    <TableHead className="text-xs py-2">Utente</TableHead>
                    <TableHead className="text-xs py-2 w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mappings.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="text-xs py-1.5 font-mono">{m.hubspot_owner_id}</TableCell>
                      <TableCell className="text-xs py-1.5">{getProfileName(m.user_id)}</TableCell>
                      <TableCell className="py-1.5">
                        <Button variant="ghost" size="sm" onClick={() => deleteMapping(m.id)} className="h-6 w-6 p-0">
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
