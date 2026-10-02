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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OPERATIONS_PERIOD_LABELS, closedPeriodRange, type OperationsPeriod } from '@/lib/operationsMetrics';
import { formatAreaLabel } from '@/lib/satisfactionLabels';
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
  // La customer satisfaction è in tempo reale: tutto l'anno, mese in corso incluso.
  const satisfactionRange = useMemo(
    () =>
      year === null
        ? null
        : {
            start: new Date(year, 0, 1),
            end: new Date(year, 11, 31),
            empty: false,
            canPrev: false,
            canNext: false,
          },
    [year]
  );
  const { data: satisfactionRows = [], isLoading: isLoadingSatisfaction, isError: satisfactionError } =
    useCustomerSatisfaction(satisfactionRange);

  const [satisfactionMonth, setSatisfactionMonth] = useState<string>('all');
  const [satisfactionArea, setSatisfactionArea] = useState<string>('all');

  const satisfactionMonths = useMemo(() => {
    const keys = new Set<string>();
    for (const row of satisfactionRows) {
      if (row.filledAt) keys.add(row.filledAt.slice(0, 7));
    }
    return Array.from(keys)
      .sort((a, b) => b.localeCompare(a))
      .map((value) => ({
        value,
        label: format(new Date(`${value}-01T00:00:00`), 'LLLL yyyy', { locale: it }),
      }));
  }, [satisfactionRows]);

  const satisfactionAreas = useMemo(() => {
    const keys = new Set<string>();
    for (const row of satisfactionRows) {
      if (row.area) keys.add(row.area);
    }
    return Array.from(keys).sort((a, b) => a.localeCompare(b, 'it'));
  }, [satisfactionRows]);

  const filteredSatisfactionRows = useMemo(
    () =>
      satisfactionRows.filter((row) => {
        if (satisfactionMonth !== 'all' && (row.filledAt ?? '').slice(0, 7) !== satisfactionMonth) return false;
        if (satisfactionArea !== 'all' && row.area !== satisfactionArea) return false;
        return true;
      }),
    [satisfactionRows, satisfactionMonth, satisfactionArea]
  );

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
              {satisfactionRows.length > 0 && (
                <div className="mb-5 flex flex-wrap items-center gap-3">
                  <Select value={satisfactionMonth} onValueChange={setSatisfactionMonth}>
                    <SelectTrigger className="w-[190px]">
                      <SelectValue placeholder="Mese" />
                    </SelectTrigger>
                    <SelectContent className="z-50 border bg-background">
                      <SelectItem value="all">Tutti i mesi</SelectItem>
                      {satisfactionMonths.map((month) => (
                        <SelectItem key={month.value} value={month.value} className="capitalize">
                          {month.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={satisfactionArea} onValueChange={setSatisfactionArea}>
                    <SelectTrigger className="w-[190px]">
                      <SelectValue placeholder="Area" />
                    </SelectTrigger>
                    <SelectContent className="z-50 border bg-background">
                      <SelectItem value="all">Tutte le aree</SelectItem>
                      {satisfactionAreas.map((area) => (
                        <SelectItem key={area} value={area}>
                          {formatAreaLabel(area)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {(satisfactionMonth !== 'all' || satisfactionArea !== 'all') && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSatisfactionMonth('all');
                        setSatisfactionArea('all');
                      }}
                    >
                      Azzera filtri
                    </Button>
                  )}
                </div>
              )}
              <SatisfactionSummary rows={filteredSatisfactionRows} isError={satisfactionError} />
              {filteredSatisfactionRows.length > 0 && (
                <DetailPanel label="Vedi le risposte">
                  <SatisfactionSection rows={filteredSatisfactionRows} isError={satisfactionError} />
                </DetailPanel>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
