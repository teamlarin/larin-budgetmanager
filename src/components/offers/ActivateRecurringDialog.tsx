import { useEffect, useMemo, useState } from 'react';
import { addMonths, addDays, format, startOfMonth } from 'date-fns';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { periodicityLabels, friendlySubscriptionError, type SubscriptionPeriodicity } from '@/components/subscriptions/types';

type ProjectMode = 'new' | 'linked' | 'none';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  offer: {
    id: string;
    title: string | null;
    year: number;
    number: number;
    client_id: string | null;
    clientName: string | null;
    project_id: string | null;
    projectName: string | null;
  };
  /** Quota ricorrente (annua o totale di contratto) calcolata dalle righe. */
  recurringTotal: number;
  recurringProductId: string | null;
  vatRate: number;
  onActivated: () => void;
}

const periodsPerYear: Record<SubscriptionPeriodicity, number> = { mensile: 12, trimestrale: 4, annuale: 1 };

export const ActivateRecurringDialog = ({
  open, onOpenChange, offer, recurringTotal, recurringProductId, vatRate, onActivated,
}: Props) => {
  const defaultStart = format(startOfMonth(addMonths(new Date(), 1)), 'yyyy-MM-dd');
  const [projectMode, setProjectMode] = useState<ProjectMode>('new');
  const [projectName, setProjectName] = useState('');
  const [projectStart, setProjectStart] = useState(defaultStart);
  const [projectEnd, setProjectEnd] = useState('');
  const [csatAuto, setCsatAuto] = useState(true);

  const [description, setDescription] = useState('');
  const [periodicity, setPeriodicity] = useState<SubscriptionPeriodicity>('mensile');
  const [startDate, setStartDate] = useState(defaultStart);
  const [amount, setAmount] = useState('');
  const [autoRenew, setAutoRenew] = useState(true);
  const [noticeDays, setNoticeDays] = useState('60');
  const [documentKind, setDocumentKind] = useState<'fattura' | 'proforma'>('fattura');
  const [saving, setSaving] = useState(false);

  const baseName = useMemo(() => {
    const title = offer.title || `Offerta ${offer.number}/${offer.year}`;
    return offer.clientName ? `${offer.clientName} – ${title}` : title;
  }, [offer]);

  useEffect(() => {
    if (!open) return;
    const start = defaultStart;
    setProjectMode('new');
    setProjectName(`${baseName} ${start.slice(0, 4)}`);
    setProjectStart(start);
    setProjectEnd(format(addDays(addMonths(new Date(start), 12), -1), 'yyyy-MM-dd'));
    setCsatAuto(true);
    setDescription(offer.title || baseName);
    setPeriodicity('mensile');
    setStartDate(start);
    setAmount((Math.round((recurringTotal / 12) * 100) / 100).toFixed(2));
    setAutoRenew(true);
    setNoticeDays('60');
    setDocumentKind('fattura');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handlePeriodicity = (p: SubscriptionPeriodicity) => {
    setPeriodicity(p);
    setAmount((Math.round((recurringTotal / periodsPerYear[p]) * 100) / 100).toFixed(2));
  };

  const handleProjectStart = (v: string) => {
    setProjectStart(v);
    if (v) setProjectEnd(format(addDays(addMonths(new Date(v), 12), -1), 'yyyy-MM-dd'));
  };

  const handleSubmit = async () => {
    const amountValue = parseFloat(amount);
    if (!offer.client_id) { toast.error("L'offerta non ha un cliente collegato."); return; }
    if (!description.trim()) { toast.error("Indica la descrizione dell'abbonamento."); return; }
    if (!amountValue || amountValue <= 0) { toast.error('Indica un canone maggiore di zero.'); return; }
    if (projectMode === 'new' && (!projectName.trim() || !projectStart || !projectEnd)) {
      toast.error('Indica nome e date del progetto annuale.'); return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Utente non autenticato');

      let projectId: string | null = null;
      if (projectMode === 'linked') {
        projectId = offer.project_id;
      } else if (projectMode === 'new') {
        const { data: proj, error: projErr } = await supabase
          .from('projects')
          .insert({
            name: projectName.trim(),
            project_type: 'Ricorrente',
            client_id: offer.client_id,
            billing_type: 'recurring',
            start_date: projectStart,
            end_date: projectEnd,
            total_budget: Math.round(recurringTotal * 100) / 100,
            customer_satisfaction_auto: csatAuto,
            status: 'approvato',
            project_status: 'in_partenza',
            status_changed_at: new Date().toISOString(),
            manual_quote_number: `${offer.number}/${offer.year}`,
            user_id: user.id,
          })
          .select('id')
          .single();
        if (projErr) throw projErr;
        projectId = proj.id;
      }

      const { data: sub, error: subErr } = await (supabase.from as any)('subscriptions')
        .insert({
          client_id: offer.client_id,
          offer_id: offer.id,
          project_id: projectId,
          product_id: recurringProductId,
          description: description.trim(),
          periodicity,
          start_date: startDate,
          end_date: null,
          auto_renew: autoRenew,
          notice_days: noticeDays ? parseInt(noticeDays, 10) : null,
          document_kind: documentKind,
          generate_days_before: 15,
          created_by: user.id,
        })
        .select('id')
        .single();
      if (subErr) throw subErr;

      const { error: amtErr } = await (supabase.from as any)('subscription_amounts').insert({
        subscription_id: sub.id,
        amount: amountValue,
        vat_rate: vatRate || 22,
        valid_from: startDate,
        note: `Da offerta ${offer.number}/${offer.year}`,
        created_by: user.id,
      });
      if (amtErr) throw amtErr;

      toast.success(projectId && projectMode === 'new' ? 'Progetto annuale e abbonamento attivati.' : 'Abbonamento attivato.');
      onOpenChange(false);
      onActivated();
    } catch (error) {
      console.error('Error activating recurring offer:', error);
      const e = error as { code?: string; message?: string };
      toast.error('Attivazione non riuscita', { description: friendlySubscriptionError({ code: e.code, message: e.message || '' }) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(n) => { if (!saving) onOpenChange(n); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Attiva canone ricorrente</DialogTitle>
          <DialogDescription>
            Quota ricorrente dell'offerta: €{recurringTotal.toFixed(2)}. Attiva il progetto operativo (ore, task, CSAT)
            e l'abbonamento (fatture, rinnovi, disdette) in un solo passaggio.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Progetto operativo</h3>
            <Select value={projectMode} onValueChange={(v) => setProjectMode(v as ProjectMode)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="new">Crea progetto annuale ricorrente</SelectItem>
                {offer.project_id && (
                  <SelectItem value="linked">Collega al progetto dell'offerta ({offer.projectName || 'progetto'})</SelectItem>
                )}
                <SelectItem value="none">Nessun progetto (canone puro, es. hosting o licenze)</SelectItem>
              </SelectContent>
            </Select>
            {projectMode === 'new' && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1 sm:col-span-2">
                  <Label>Nome progetto</Label>
                  <Input value={projectName} onChange={(e) => setProjectName(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Inizio</Label>
                  <Input type="date" value={projectStart} onChange={(e) => handleProjectStart(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Fine</Label>
                  <Input type="date" value={projectEnd} onChange={(e) => setProjectEnd(e.target.value)} />
                </div>
                <div className="flex items-center gap-2 sm:col-span-2">
                  <Switch checked={csatAuto} onCheckedChange={setCsatAuto} id="csat-auto" />
                  <Label htmlFor="csat-auto">Customer satisfaction trimestrale automatica</Label>
                </div>
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Abbonamento</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2">
                <Label>Descrizione</Label>
                <Input value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Periodicità</Label>
                <Select value={periodicity} onValueChange={(v) => handlePeriodicity(v as SubscriptionPeriodicity)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(periodicityLabels) as SubscriptionPeriodicity[]).map((p) => (
                      <SelectItem key={p} value={p}>{periodicityLabels[p]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Canone per periodo (€)</Label>
                <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Decorrenza</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Preavviso disdetta (giorni)</Label>
                <Input type="number" min="0" value={noticeDays} onChange={(e) => setNoticeDays(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Documento</Label>
                <Select value={documentKind} onValueChange={(v) => setDocumentKind(v as 'fattura' | 'proforma')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fattura">Fattura</SelectItem>
                    <SelectItem value="proforma">Proforma</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Switch checked={autoRenew} onCheckedChange={setAutoRenew} id="auto-renew" />
                <Label htmlFor="auto-renew">Rinnovo tacito</Label>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Il canone è stimato dividendo la quota ricorrente per il numero di periodi in un anno: verificalo prima di confermare.
            </p>
          </section>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Annulla</Button>
          <Button onClick={handleSubmit} disabled={saving}>{saving ? 'Attivazione…' : 'Attiva'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
