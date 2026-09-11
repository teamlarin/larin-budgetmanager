/**
 * Tab "Progetti e operations" del cruscotto: efficienza produttiva del team
 * (utilizzo, scostamento ore, consegne in tempo, capacità residua) e
 * soddisfazione dei clienti letta dal foglio Google.
 *
 * Il mese in corso è sempre escluso: le attività non sono ancora del tutto
 * pianificate o confermate e falserebbero i conteggi.
 */
import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OPERATIONS_PERIOD_LABELS, closedPeriodRange, type OperationsPeriod } from '@/lib/operationsMetrics';
import { UtilizationSection } from './UtilizationSection';
import { ScopeCreepSummary } from './ScopeCreepSummary';
import { ScopeCreepTable } from './ScopeCreepTable';
import { OnTimeDeliverySection } from './OnTimeDeliverySection';
import { RemainingCapacitySection } from './RemainingCapacitySection';
import { SatisfactionSummary } from './SatisfactionSummary';
import { SatisfactionSection } from './SatisfactionSection';
import { useCustomerSatisfaction, useOnTimeDelivery, useScopeCreep, useTeamUtilization } from './useOperationsData';

const CardSkeleton = () => <div className="h-40 animate-pulse rounded-md bg-muted" />;

function periodLabel(period: OperationsPeriod, start: Date, end: Date) {
  if (period === 'month') return format(start, 'LLLL yyyy', { locale: it });
  if (period === 'year') return `${format(start, 'LLLL', { locale: it })} – ${format(end, 'LLLL yyyy', { locale: it })}`;
  return `${format(start, 'LLLL', { locale: it })} – ${format(end, 'LLLL yyyy', { locale: it })}`;
}

function DetailPanel({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mt-5 space-y-4 border-t pt-4">
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="px-0 text-muted-foreground hover:text-foreground">
          {open ? 'Nascondi' : label}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>{children}</CollapsibleContent>
    </Collapsible>
  );
}

export function OperationsSection({ year }: { year: number | null }) {
  const [period, setPeriod] = useState<OperationsPeriod>('month');
  const [offset, setOffset] = useState(0);

  const range = useMemo(
    () => (year === null ? null : closedPeriodRange(period, year, offset)),
    [year, period, offset]
  );

  const { data: utilization, isLoading: isLoadingUtilization } = useTeamUtilization(range);
  const { data: scopeRows = [], isLoading: isLoadingScope } = useScopeCreep(range);
  const { data: deliveryRows = [], isLoading: isLoadingDelivery } = useOnTimeDelivery(range);
  const { data: satisfactionRows = [], isLoading: isLoadingSatisfaction, isError: satisfactionError } =
    useCustomerSatisfaction(range);

  const changePeriod = (value: OperationsPeriod) => {
    setPeriod(value);
    setOffset(0);
  };

  if (range?.empty) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Per {year} non c'è ancora nessun mese chiuso: i dati compaiono dal mese successivo.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={period} onValueChange={(value) => changePeriod(value as OperationsPeriod)}>
          <TabsList>
            {(Object.keys(OPERATIONS_PERIOD_LABELS) as OperationsPeriod[]).map((key) => (
              <TabsTrigger key={key} value={key}>{OPERATIONS_PERIOD_LABELS[key]}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          {period !== 'year' && (
            <Button
              variant="outline"
              size="icon"
              aria-label="Periodo precedente"
              disabled={!range?.canPrev}
              onClick={() => setOffset((value) => value + 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
          <span className="min-w-40 text-center text-sm font-medium capitalize">
            {range ? periodLabel(period, range.start, range.end) : ''}
          </span>
          {period !== 'year' && (
            <>
              <Button
                variant="outline"
                size="icon"
                aria-label="Periodo successivo"
                disabled={!range?.canNext}
                onClick={() => setOffset((value) => Math.max(0, value - 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              {offset > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setOffset(0)}>Ultimo chiuso</Button>
              )}
            </>
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Il mese in corso è escluso dai conteggi perché non ancora completo.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Tasso di utilizzo del team</CardTitle>
          <CardDescription>Ore fatturabili erogate sulle ore lavorabili nette (assenze escluse)</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingUtilization || !utilization ? <CardSkeleton /> : <UtilizationSection data={utilization} />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Deviazione del budget ore</CardTitle>
          <CardDescription>Ore preventivate contro ore effettivamente lavorate sui progetti</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingScope ? (
            <CardSkeleton />
          ) : (
            <>
              <ScopeCreepSummary rows={scopeRows} />
              <DetailPanel label="Vedi dettaglio progetti">
                <ScopeCreepTable rows={scopeRows} />
              </DetailPanel>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Consegne in tempo</CardTitle>
          <CardDescription>Progetti completati entro la data di fine prevista nel periodo</CardDescription>
        </CardHeader>
        <CardContent>{isLoadingDelivery ? <CardSkeleton /> : <OnTimeDeliverySection rows={deliveryRows} />}</CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Capacità residua</CardTitle>
          <CardDescription>Ore ancora disponibili nel periodo e saturazione per area</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingUtilization || !utilization ? <CardSkeleton /> : <RemainingCapacitySection data={utilization} />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Customer satisfaction</CardTitle>
          <CardDescription>Risposte raccolte nel database condiviso, aggiornate in diretta</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingSatisfaction ? (
            <CardSkeleton />
          ) : (
            <>
              <SatisfactionSummary rows={satisfactionRows} isError={satisfactionError} />
              {satisfactionRows.length > 0 && (
                <DetailPanel label="Vedi le risposte">
                  <SatisfactionSection rows={satisfactionRows} isError={satisfactionError} />
                </DetailPanel>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
