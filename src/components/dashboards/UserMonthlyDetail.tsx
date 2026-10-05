import { useState } from 'react';
import { format, startOfMonth } from 'date-fns';
import { it } from 'date-fns/locale';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Pencil } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { formatHours } from '@/lib/utils';

interface MonthlyRow {
  month: string; // yyyy-MM
  label: string;
  confirmed: number;
  adjustment: number;
  expected: number;
}

interface UserMonthlyDetailProps {
  userId: string;
  userName: string;
  selectedMonth: Date;
  monthlyConfirmed: Record<string, number>; // keyed by yyyy-MM
  adjustments: Record<string, { hours: number; reason: string | null }>; // keyed by yyyy-MM
  monthlyExpected: Record<string, number>; // keyed by yyyy-MM
  expectedOverrides?: Record<string, { hours: number; reason: string | null }>; // keyed by yyyy-MM
  canEdit: boolean;
  isConsuntivo?: boolean;
}

export const UserMonthlyDetail = ({
  userId,
  userName,
  selectedMonth,
  monthlyConfirmed,
  adjustments,
  monthlyExpected,
  expectedOverrides = {},
  canEdit,
  isConsuntivo = false,
}: UserMonthlyDetailProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingMonth, setEditingMonth] = useState<string | null>(null);
  const [adjHours, setAdjHours] = useState('');
  const [adjReason, setAdjReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingExpectedMonth, setEditingExpectedMonth] = useState<string | null>(null);
  const [expHours, setExpHours] = useState('');
  const [expReason, setExpReason] = useState('');
  const [savingExpected, setSavingExpected] = useState(false);

  const formatHoursDisplay = (hours: number) => formatHours(hours).replace('.', ',');

  const endMonthIndex = selectedMonth.getMonth();
  const year = selectedMonth.getFullYear();

  const rows: MonthlyRow[] = [];
  for (let m = 0; m <= endMonthIndex; m++) {
    const key = format(new Date(year, m, 1), 'yyyy-MM');
    rows.push({
      month: key,
      label: format(new Date(year, m, 1), 'MMMM', { locale: it }),
      confirmed: monthlyConfirmed[key] || 0,
      adjustment: adjustments[key]?.hours || 0,
      expected: monthlyExpected[key] || 0,
    });
  }

  const openEdit = (monthKey: string) => {
    const existing = adjustments[monthKey];
    setAdjHours(existing ? String(existing.hours) : '0');
    setAdjReason(existing?.reason || '');
    setEditingMonth(monthKey);
  };

  const openEditExpected = (monthKey: string) => {
    const existing = expectedOverrides[monthKey];
    setExpHours(existing ? String(existing.hours) : String(Math.round((monthlyExpected[monthKey] || 0) * 2) / 2));
    setExpReason(existing?.reason || '');
    setEditingExpectedMonth(monthKey);
  };

  const handleSave = async () => {
    if (!editingMonth) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non autenticato');

      const monthDate = `${editingMonth}-01`;
      const hours = parseFloat(adjHours) || 0;

      const { error } = await supabase
        .from('user_hours_adjustments' as any)
        .upsert({
          user_id: userId,
          month: monthDate,
          adjustment_hours: hours,
          reason: adjReason.trim() || null,
          created_by: user.id,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,month' });

      if (error) throw error;

      toast({ title: 'Rettifica salvata', description: `Rettifica per ${userName} aggiornata` });
      queryClient.invalidateQueries({ queryKey: ['user-hours-adjustments'] });
      queryClient.invalidateQueries({ queryKey: ['user-hours-ytd'] });
      setEditingMonth(null);
    } catch (err: any) {
      console.error('Adjustment save error:', err);
      toast({ title: 'Errore', description: err.message || 'Impossibile salvare la rettifica', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveExpected = async () => {
    if (!editingExpectedMonth) return;
    setSavingExpected(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non autenticato');

      const monthDate = `${editingExpectedMonth}-01`;
      const hours = parseFloat(expHours);
      if (isNaN(hours) || hours < 0) throw new Error('Inserisci un numero di ore valido');

      const { error } = await supabase
        .from('user_expected_hours_overrides' as any)
        .upsert({
          user_id: userId,
          month: monthDate,
          expected_hours: hours,
          reason: expReason.trim() || null,
          created_by: user.id,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,month' });

      if (error) throw error;

      toast({ title: 'Ore previste salvate', description: `Ore previste per ${userName} aggiornate` });
      queryClient.invalidateQueries({ queryKey: ['user-expected-hours-overrides'] });
      setEditingExpectedMonth(null);
    } catch (err: any) {
      console.error('Expected hours save error:', err);
      toast({ title: 'Errore', description: err.message || 'Impossibile salvare le ore previste', variant: 'destructive' });
    } finally {
      setSavingExpected(false);
    }
  };

  const handleRemoveExpected = async () => {
    if (!editingExpectedMonth) return;
    setSavingExpected(true);
    try {
      const monthDate = `${editingExpectedMonth}-01`;
      const { error } = await supabase
        .from('user_expected_hours_overrides' as any)
        .delete()
        .eq('user_id', userId)
        .eq('month', monthDate);

      if (error) throw error;

      toast({ title: 'Override rimosso', description: 'Le ore previste tornano al calcolo da contratto' });
      queryClient.invalidateQueries({ queryKey: ['user-expected-hours-overrides'] });
      setEditingExpectedMonth(null);
    } catch (err: any) {
      console.error('Expected hours delete error:', err);
      toast({ title: 'Errore', description: err.message || 'Impossibile rimuovere l\'override', variant: 'destructive' });
    } finally {
      setSavingExpected(false);
    }
  };

  const renderBalance = (value: number) => (
    <span className={`font-medium ${value > 0 ? 'text-primary' : value < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
      {value > 0 ? '+' : ''}{formatHoursDisplay(value)}
    </span>
  );

  return (
    <>
      <div className="bg-muted/30 p-3 rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mese</TableHead>
              <TableHead className="text-right">Confermate</TableHead>
              <TableHead className="text-right">Rettifica</TableHead>
              <TableHead className="text-right">Totale</TableHead>
              <TableHead className="text-right">Previste</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
              {canEdit && <TableHead className="w-[50px]"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(row => {
              const total = row.confirmed + row.adjustment;
              const balance = total - row.expected;
              return (
                <TableRow key={row.month}>
                  <TableCell className="capitalize text-sm">{row.label}</TableCell>
                  <TableCell className="text-right text-sm">{formatHours(row.confirmed)}</TableCell>
                  <TableCell className="text-right text-sm">
                    {row.adjustment !== 0 ? (
                      <span className={row.adjustment > 0 ? 'text-primary' : 'text-destructive'}>
                        {row.adjustment > 0 ? '+' : ''}{formatHoursDisplay(row.adjustment)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium">{formatHours(total)}</TableCell>
                  <TableCell className="text-right text-sm">
                    {isConsuntivo ? <span className="text-muted-foreground">—</span> : (
                      <div className="flex items-center justify-end gap-1">
                        <span className={expectedOverrides[row.month] ? 'text-primary font-medium' : ''} title={expectedOverrides[row.month]?.reason || (expectedOverrides[row.month] ? 'Valore impostato manualmente' : undefined)}>
                          {formatHours(row.expected)}{expectedOverrides[row.month] ? '*' : ''}
                        </span>
                        {canEdit && (
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEditExpected(row.month)}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-sm">{isConsuntivo ? <span className="text-muted-foreground">—</span> : renderBalance(balance)}</TableCell>
                  {canEdit && (
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEdit(row.month)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!editingMonth} onOpenChange={(open) => !open && setEditingMonth(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Rettifica ore — {userName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Mese</Label>
              <p className="text-sm text-muted-foreground capitalize">
                {editingMonth && format(new Date(`${editingMonth}-01`), 'MMMM yyyy', { locale: it })}
              </p>
            </div>
            <div>
              <Label htmlFor="adj-hours">Ore rettifica (+ o -)</Label>
              <Input
                id="adj-hours"
                type="number"
                step="0.5"
                value={adjHours}
                onChange={(e) => setAdjHours(e.target.value)}
                placeholder="es. -8 oppure 4.5"
              />
            </div>
            <div>
              <Label htmlFor="adj-reason">Motivazione</Label>
              <Textarea
                id="adj-reason"
                value={adjReason}
                onChange={(e) => setAdjReason(e.target.value)}
                placeholder="es. Permesso non registrato, straordinario..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingMonth(null)}>Annulla</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Salvataggio...' : 'Salva'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingExpectedMonth} onOpenChange={(open) => !open && setEditingExpectedMonth(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Ore previste — {userName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Mese</Label>
              <p className="text-sm text-muted-foreground capitalize">
                {editingExpectedMonth && format(new Date(`${editingExpectedMonth}-01`), 'MMMM yyyy', { locale: it })}
              </p>
            </div>
            <div>
              <Label htmlFor="exp-hours">Ore previste manuali</Label>
              <Input
                id="exp-hours"
                type="number"
                step="0.5"
                min="0"
                value={expHours}
                onChange={(e) => setExpHours(e.target.value)}
                placeholder="es. 120"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Sostituisce il calcolo automatico da contratto per questo mese.
              </p>
            </div>
            <div>
              <Label htmlFor="exp-reason">Motivazione</Label>
              <Textarea
                id="exp-reason"
                value={expReason}
                onChange={(e) => setExpReason(e.target.value)}
                placeholder="es. Chiusura aziendale, accordo particolare..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            {editingExpectedMonth && expectedOverrides[editingExpectedMonth] && (
              <Button variant="destructive" onClick={handleRemoveExpected} disabled={savingExpected} className="sm:mr-auto">
                Rimuovi override
              </Button>
            )}
            <Button variant="outline" onClick={() => setEditingExpectedMonth(null)}>Annulla</Button>
            <Button onClick={handleSaveExpected} disabled={savingExpected}>
              {savingExpected ? 'Salvataggio...' : 'Salva'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
