import { useMemo, useState } from 'react';
import { Line, LineChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { Settings2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/utils';
import { sumTargetToMonth } from '@/lib/salesMetrics';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { StatTile } from './StatTile';
import type { RevenueMonthRow, RevenueTargetRow } from './types';

const MONTHS = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
const chartConfig = {
  actual: { label: 'Fatturato effettivo', color: 'hsl(var(--primary))' },
  forecast: { label: 'Fatturato previsto', color: 'hsl(var(--chart-2))' },
  target: { label: 'Target', color: 'hsl(var(--muted-foreground))' },
} satisfies ChartConfig;

interface Props {
  year: number;
  revenue: RevenueMonthRow[];
  targets: RevenueTargetRow[];
  canEditTargets: boolean;
}

export function RevenueHealthSection({ year, revenue, targets, canEditTargets }: Props) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<number[]>([]);
  const targetByMonth = new Map(targets.map((row) => [Number(row.month), Number(row.amount)]));
  const totals = useMemo(() => revenue.reduce((acc, row) => ({
    actual: acc.actual + Number(row.actual), forecast: acc.forecast + Number(row.forecast), collected: acc.collected + Number(row.collected),
  }), { actual: 0, forecast: 0, collected: 0 }), [revenue]);
  const annualTarget = targets.reduce((sum, row) => sum + Number(row.amount), 0);
  const attainment = annualTarget > 0 ? totals.actual / annualTarget * 100 : null;
  const currentMonth = year === new Date().getFullYear() ? new Date().getMonth() + 1 : year < new Date().getFullYear() ? 12 : 0;
  const targetToDate = sumTargetToMonth(targets, currentMonth);
  const chartData = useMemo(() => {
    let actual = 0; let forecast = 0; let target = 0;
    return Array.from({ length: 12 }, (_, index) => {
      const row = revenue.find((item) => Number(item.month) === index + 1);
      actual += Number(row?.actual ?? 0);
      forecast += Number(row?.forecast ?? 0);
      target += Number(targetByMonth.get(index + 1) ?? 0);
      return { month: MONTHS[index], actual, forecast, target };
    });
  }, [revenue, targets]);

  const openEditor = () => {
    setDraft(Array.from({ length: 12 }, (_, index) => targetByMonth.get(index + 1) ?? 0));
    setOpen(true);
  };
  const saveTargets = async () => {
    setSaving(true);
    const rows = draft.map((amount, index) => ({ year, month: index + 1, amount: Number(amount) || 0 }));
    const { error } = await supabase.from('sales_revenue_targets').upsert(rows, { onConflict: 'year,month' });
    setSaving(false);
    if (error) {
      toast.error('Impossibile salvare i target di fatturato.');
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ['sales-revenue-health', year] });
    setOpen(false);
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Fatturato effettivo" value={formatCurrency(totals.actual)} hint={`Incassato ${formatCurrency(totals.collected)}`} />
        <StatTile label="Fatturato previsto" value={formatCurrency(totals.forecast)} hint="Emesso e pianificato" />
        <StatTile label="Target annuale" value={annualTarget ? formatCurrency(annualTarget) : 'Non impostato'} hint={attainment === null ? undefined : `${attainment.toFixed(1).replace('.', ',')}% raggiunto`} />
        <StatTile label="Scostamento alla data" value={targetToDate ? formatCurrency(totals.actual - targetToDate) : '—'} hint={targetToDate ? `Target maturato ${formatCurrency(targetToDate)}` : undefined} />
      </div>
      <div className="flex justify-end">
        {canEditTargets && <Button variant="outline" size="sm" onClick={openEditor}><Settings2 className="mr-2 h-4 w-4" />Imposta target</Button>}
      </div>
      <ChartContainer config={chartConfig} className="h-[280px] w-full aspect-auto">
        <LineChart data={chartData} margin={{ left: 8, right: 16 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="month" tickLine={false} axisLine={false} />
          <YAxis tickFormatter={(value) => `€${Math.round(value / 1000)}k`} tickLine={false} axisLine={false} width={52} />
          <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatCurrency(Number(value))} />} />
          <Line dataKey="actual" stroke="var(--color-actual)" strokeWidth={2.5} dot={false} />
          <Line dataKey="forecast" stroke="var(--color-forecast)" strokeWidth={2} strokeDasharray="6 4" dot={false} />
          <Line dataKey="target" stroke="var(--color-target)" strokeWidth={2} dot={false} />
        </LineChart>
      </ChartContainer>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader><DialogTitle>Target mensili {year}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {MONTHS.map((month, index) => <div key={month} className="space-y-1.5"><Label htmlFor={`target-${index}`}>{month}</Label><Input id={`target-${index}`} type="number" min="0" step="100" value={draft[index] ?? 0} onChange={(event) => setDraft((current) => current.map((value, i) => i === index ? Number(event.target.value) : value))} /></div>)}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Annulla</Button><Button onClick={saveTargets} disabled={saving}>{saving ? 'Salvataggio…' : 'Salva target'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}