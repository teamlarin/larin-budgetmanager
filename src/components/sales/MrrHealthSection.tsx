import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatTile } from './StatTile';
import type { MrrClientRow, RecurringValueSummaryRow } from './types';

export function MrrHealthSection({ summary, clients, oneOffSold }: { summary: RecurringValueSummaryRow; clients: MrrClientRow[]; oneOffSold: number }) {
  const navigate = useNavigate();
  return <div className="space-y-5">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatTile label="MRR attivo" value={formatCurrency(Number(summary.ricorrente_mensile))} hint={`${summary.abbonamenti_attivi} abbonamenti attivi`} />
      <StatTile label="ARR equivalente" value={formatCurrency(Number(summary.ricorrente_annuo))} hint="MRR × 12" />
      <StatTile label="MRR a rischio (90 giorni)" value={formatCurrency(Number(summary.mensile_a_rischio_90_giorni))} />
      <StatTile label="Venduto una tantum" value={formatCurrency(oneOffSold)} hint="Offerte accettate nell'anno" />
    </div>
    <div className="overflow-hidden rounded-md border">
      <Table><TableHeader><TableRow><TableHead>Cliente</TableHead><TableHead className="text-right">Abbonamenti</TableHead><TableHead className="text-right">MRR</TableHead></TableRow></TableHeader>
      <TableBody>{clients.slice(0, 8).map((row) => <TableRow key={row.client_id}><TableCell className="font-medium">{row.client_name}</TableCell><TableCell className="text-right">{row.active_subscriptions}</TableCell><TableCell className="text-right font-medium">{formatCurrency(Number(row.mrr))}</TableCell></TableRow>)}</TableBody></Table>
    </div>
    <div className="flex justify-end"><Button variant="ghost" size="sm" onClick={() => navigate('/subscriptions')}>Gestisci abbonamenti<ArrowRight className="ml-2 h-4 w-4" /></Button></div>
  </div>;
}