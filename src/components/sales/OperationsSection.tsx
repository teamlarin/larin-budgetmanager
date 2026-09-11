/**
 * Tab "Progetti e operations" del cruscotto: efficienza produttiva del team
 * (utilizzo, scostamento ore, consegne in tempo, capacità residua) e
 * soddisfazione dei clienti letta dal foglio Google.
 */
import { useState } from 'react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OPERATIONS_PERIOD_LABELS, operationsPeriodRange, type OperationsPeriod } from '@/lib/operationsMetrics';
import { UtilizationSection } from './UtilizationSection';
import { ScopeCreepTable } from './ScopeCreepTable';
import { OnTimeDeliverySection } from './OnTimeDeliverySection';
import { RemainingCapacitySection } from './RemainingCapacitySection';
import { SatisfactionSection } from './SatisfactionSection';
import { useCustomerSatisfaction, useOnTimeDelivery, useScopeCreep, useTeamUtilization } from './useOperationsData';

const CardSkeleton = () => <div className="h-40 animate-pulse rounded-md bg-muted" />;

export function OperationsSection({ year }: { year: number | null }) {
  const [period, setPeriod] = useState<OperationsPeriod>('month');

  const { data: utilization, isLoading: isLoadingUtilization } = useTeamUtilization(year, period);
  const { data: scopeRows = [], isLoading: isLoadingScope } = useScopeCreep(year, period);
  const { data: deliveryRows = [], isLoading: isLoadingDelivery } = useOnTimeDelivery(year, period);
  const { data: satisfactionRows = [], isLoading: isLoadingSatisfaction, isError: satisfactionError } =
    useCustomerSatisfaction(year, period);

  const range = year !== null ? operationsPeriodRange(period, year) : null;
  const rangeLabel = range
    ? `${format(range.start, 'd MMM', { locale: it })} – ${format(range.end, 'd MMM yyyy', { locale: it })}`
    : '';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={period} onValueChange={(value) => setPeriod(value as OperationsPeriod)}>
          <TabsList>
            {(Object.keys(OPERATIONS_PERIOD_LABELS) as OperationsPeriod[]).map((key) => (
              <TabsTrigger key={key} value={key}>{OPERATIONS_PERIOD_LABELS[key]}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <p className="text-sm text-muted-foreground">{rangeLabel}</p>
      </div>

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
          <CardDescription>Ore preventivate contro ore effettivamente lavorate su ogni progetto</CardDescription>
        </CardHeader>
        <CardContent>{isLoadingScope ? <CardSkeleton /> : <ScopeCreepTable rows={scopeRows} />}</CardContent>
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
          <CardTitle>Customer satisfaction per progetto</CardTitle>
          <CardDescription>Risposte raccolte nel database condiviso, aggiornate in diretta</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingSatisfaction ? <CardSkeleton /> : <SatisfactionSection rows={satisfactionRows} isError={satisfactionError} />}
        </CardContent>
      </Card>
    </div>
  );
}
