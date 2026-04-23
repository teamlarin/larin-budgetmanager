import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  CONTRACT_TYPES,
  DIPENDENTI_TYPES,
  COEFFICIENTS,
  HrEmployee,
  fmtEuro,
} from '@/lib/hrCalculations';
import { Trash2 } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: HrEmployee | null;
  duplicate?: boolean;
  onSaved: () => void;
  teamSuggestions: string[];
}

const EMPTY: Partial<HrEmployee> = {
  azienda: 'Larin',
  stato: 'confermato',
  contratto: 'Impiegato',
  orario: 'FT',
  data_inizio: new Date().toISOString().split('T')[0],
  data_fine: '2099-12-31',
  ral: 0,
};

export function HrEmployeeDialog({ open, onOpenChange, employee, duplicate, onSaved, teamSuggestions }: Props) {
  const { toast } = useToast();
  const [form, setForm] = useState<Partial<HrEmployee>>(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (employee) {
      const base = { ...employee };
      if (duplicate) {
        delete (base as any).id;
        base.data_inizio = new Date().toISOString().split('T')[0];
        base.data_fine = '2099-12-31';
        base.ral = 0;
      }
      setForm(base);
    } else {
      setForm(EMPTY);
    }
  }, [open, employee, duplicate]);

  const isDip = DIPENDENTI_TYPES.includes(form.contratto || '');
  const isPT = isDip && form.orario === 'PT';

  const calc = useMemo(() => {
    const coeff = COEFFICIENTS[form.contratto || '']?.coeff ?? 1;
    const ral = +(form.ral || 0);
    const costoAnnuale = ral * coeff;
    const costoMensile = costoAnnuale / 12;
    const bpAnnuali = (+(form.bp_unitario || 0)) * 200;
    const bpMensili = bpAnnuali / 12;
    const fringe = +(form.fringe_annuale || 0);
    const totaleMensile = costoMensile + bpMensili + fringe / 12;
    const totaleAnnuale = costoAnnuale + bpAnnuali + fringe;
    return { coeff, costoAnnuale, costoMensile, bpMensili, totaleMensile, totaleAnnuale };
  }, [form.contratto, form.ral, form.bp_unitario, form.fringe_annuale]);

  const update = (field: keyof HrEmployee, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!form.contratto || !form.data_inizio) {
      toast({ title: 'Campi mancanti', description: 'Contratto e data inizio sono obbligatori', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const payload: any = {
      azienda: form.azienda || null,
      cognome: form.cognome || null,
      nome: form.nome || null,
      job_title: form.job_title || null,
      team: form.team || null,
      contratto: form.contratto,
      stato: form.stato || 'confermato',
      ral: +(form.ral || 0),
      ore_freelance: form.ore_freelance ? +form.ore_freelance : null,
      bp_unitario: form.bp_unitario ? +form.bp_unitario : null,
      fringe_annuale: form.fringe_annuale ? +form.fringe_annuale : null,
      orario: isDip ? form.orario || 'FT' : null,
      pt_perc: isPT && form.pt_perc ? +form.pt_perc : null,
      data_nascita: form.data_nascita || null,
      data_inizio_collaborazione: form.data_inizio_collaborazione || null,
      data_inizio: form.data_inizio,
      data_fine: form.data_fine || '2099-12-31',
      sesso: form.sesso || null,
    };
    let error;
    if (employee?.id && !duplicate) {
      ({ error } = await supabase.from('hr_employees').update(payload).eq('id', employee.id));
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      payload.created_by = user?.id;
      ({ error } = await supabase.from('hr_employees').insert(payload));
    }
    setSaving(false);
    if (error) {
      toast({ title: 'Errore', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Salvato', description: 'Record HR salvato correttamente' });
    onSaved();
    onOpenChange(false);
  };

  const handleDelete = async () => {
    if (!employee?.id) return;
    if (!confirm('Eliminare definitivamente questo record HR?')) return;
    const { error } = await supabase.from('hr_employees').delete().eq('id', employee.id);
    if (error) {
      toast({ title: 'Errore', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Eliminato' });
    onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {employee && !duplicate ? `Modifica: ${employee.cognome || ''} ${employee.nome || ''}` :
             duplicate ? `Duplica: ${employee?.cognome || ''} ${employee?.nome || ''}` : 'Aggiungi persona'}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Stato</Label>
            <Select value={form.stato} onValueChange={v => update('stato', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="confermato">✅ Confermato</SelectItem>
                <SelectItem value="pianificato">📋 Pianificato</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Tipologia Contrattuale</Label>
            <Select value={form.contratto} onValueChange={v => update('contratto', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CONTRACT_TYPES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Azienda</Label>
            <Input value={form.azienda || ''} onChange={e => update('azienda', e.target.value)} placeholder="Larin" />
          </div>
          <div>
            <Label>Sesso</Label>
            <Select value={form.sesso || 'none'} onValueChange={v => update('sesso', v === 'none' ? null : v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">–</SelectItem>
                <SelectItem value="M">M</SelectItem>
                <SelectItem value="F">F</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Cognome</Label>
            <Input value={form.cognome || ''} onChange={e => update('cognome', e.target.value.toUpperCase())} placeholder="ROSSI" />
          </div>
          <div>
            <Label>Nome</Label>
            <Input value={form.nome || ''} onChange={e => update('nome', e.target.value)} placeholder="Mario" />
          </div>
          <div>
            <Label>Job Title</Label>
            <Input value={form.job_title || ''} onChange={e => update('job_title', e.target.value)} />
          </div>
          <div>
            <Label>Team</Label>
            <Input
              value={form.team || ''}
              onChange={e => update('team', e.target.value)}
              list="team-suggestions"
              placeholder="es. Tech"
            />
            <datalist id="team-suggestions">
              {teamSuggestions.map(t => <option key={t} value={t} />)}
            </datalist>
          </div>
          <div>
            <Label>Data di Nascita</Label>
            <Input type="date" value={form.data_nascita || ''} onChange={e => update('data_nascita', e.target.value)} />
          </div>
          <div>
            <Label>Inizio Collaborazione</Label>
            <Input type="date" value={form.data_inizio_collaborazione || ''} onChange={e => update('data_inizio_collaborazione', e.target.value)} />
          </div>
          <div>
            <Label>Data Inizio Rapporto *</Label>
            <Input type="date" value={form.data_inizio || ''} onChange={e => update('data_inizio', e.target.value)} />
          </div>
          <div>
            <Label>Data Fine Rapporto</Label>
            <Input type="date" value={form.data_fine || ''} onChange={e => update('data_fine', e.target.value)} />
          </div>

          {isDip && (
            <div>
              <Label>Orario</Label>
              <Select value={form.orario || 'FT'} onValueChange={v => update('orario', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="FT">Full Time</SelectItem>
                  <SelectItem value="PT">Part Time</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          {isPT && (
            <div>
              <Label>% Part Time</Label>
              <Input type="number" min={1} max={99} value={form.pt_perc || ''} onChange={e => update('pt_perc', e.target.value)} placeholder="es. 75" />
            </div>
          )}

          <div className="col-span-2 border-t pt-3 mt-2 text-xs font-bold uppercase tracking-wider text-primary">Costi</div>

          <div>
            <Label>RAL / Costo Freelance Annuale (€)</Label>
            <Input type="number" step="0.01" value={form.ral || ''} onChange={e => update('ral', e.target.value)} />
          </div>
          <div>
            <Label>Ore Freelance mensili (P.IVA / Rit.Acc.)</Label>
            <Input type="number" step="1" value={form.ore_freelance || ''} onChange={e => update('ore_freelance', e.target.value)} />
          </div>
          <div>
            <Label>Buoni Pasto Unitario (€/giorno)</Label>
            <Input type="number" step="0.01" value={form.bp_unitario || ''} onChange={e => update('bp_unitario', e.target.value)} />
          </div>
          <div>
            <Label>Fringe Benefit Annuale (€)</Label>
            <Input type="number" step="0.01" value={form.fringe_annuale || ''} onChange={e => update('fringe_annuale', e.target.value)} />
          </div>
        </div>

        <Card className="p-4 mt-4 bg-muted/40">
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div><div className="text-muted-foreground uppercase">Coefficiente</div><div className="font-bold text-base">{calc.coeff.toFixed(2)}</div></div>
            <div><div className="text-muted-foreground uppercase">Costo Az. Annuale</div><div className="font-bold text-base">{fmtEuro(calc.costoAnnuale)}</div></div>
            <div><div className="text-muted-foreground uppercase">Costo Az. Mensile</div><div className="font-bold text-base">{fmtEuro(calc.costoMensile)}</div></div>
            <div><div className="text-muted-foreground uppercase">BP Mensili</div><div className="font-bold text-base">{fmtEuro(calc.bpMensili)}</div></div>
            <div><div className="text-muted-foreground uppercase">Tot. Mensile</div><div className="font-bold text-base text-primary">{fmtEuro(calc.totaleMensile)}</div></div>
            <div><div className="text-muted-foreground uppercase">Tot. Annuale</div><div className="font-bold text-base text-primary">{fmtEuro(calc.totaleAnnuale)}</div></div>
          </div>
        </Card>

        <DialogFooter className="gap-2">
          {employee?.id && !duplicate && (
            <Button variant="destructive" onClick={handleDelete}><Trash2 className="h-4 w-4 mr-1" />Elimina</Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annulla</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Salvataggio...' : 'Salva'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
