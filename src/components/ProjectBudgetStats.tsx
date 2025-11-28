import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { differenceInDays, parseISO, isAfter, isBefore } from 'date-fns';
import { TrendingUp, Clock, Target, Euro, Calendar, AlertTriangle } from 'lucide-react';

interface ProjectBudgetStatsProps {
  projectId: string;
  totalBudget: number;
  totalHours: number;
  marginPercentage: number;
  startDate?: string;
  endDate?: string;
}

export const ProjectBudgetStats = ({
  projectId,
  totalBudget,
  totalHours,
  marginPercentage,
  startDate,
  endDate
}: ProjectBudgetStatsProps) => {
  // Fetch budget items for external costs
  const { data: budgetItems } = useQuery({
    queryKey: ['budget-items-stats', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('budget_items')
        .select('*')
        .eq('project_id', projectId);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!projectId
  });

  // Fetch time tracking for planned and confirmed hours
  const { data: timeTracking } = useQuery({
    queryKey: ['time-tracking-stats', projectId],
    queryFn: async () => {
      // Get all budget item IDs for this project
      const { data: items } = await supabase
        .from('budget_items')
        .select('id')
        .eq('project_id', projectId);
      
      if (!items || items.length === 0) return [];

      const itemIds = items.map(item => item.id);
      
      const { data, error } = await supabase
        .from('activity_time_tracking')
        .select('*')
        .in('budget_item_id', itemIds);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!projectId
  });

  // Calculate metrics
  const targetBudget = totalBudget * (1 - (marginPercentage || 0) / 100);
  
  // External costs (products)
  const externalCosts = budgetItems
    ?.filter(item => item.is_product)
    .reduce((sum, item) => sum + Number(item.total_cost || 0), 0) || 0;

  // Activity costs (non-products)
  const activityCosts = budgetItems
    ?.filter(item => !item.is_product)
    .reduce((sum, item) => sum + Number(item.total_cost || 0), 0) || 0;

  // Calculate planned hours from time tracking
  const plannedHours = timeTracking?.reduce((sum, track) => {
    if (track.scheduled_start_time && track.scheduled_end_time) {
      const start = track.scheduled_start_time.split(':').map(Number);
      const end = track.scheduled_end_time.split(':').map(Number);
      const hours = (end[0] + end[1]/60) - (start[0] + start[1]/60);
      return sum + Math.max(0, hours);
    }
    return sum;
  }, 0) || 0;

  // Calculate confirmed hours from time tracking (activities with actual_end_time)
  const confirmedHours = timeTracking?.reduce((sum, track) => {
    if (track.actual_start_time && track.actual_end_time) {
      const start = new Date(track.actual_start_time);
      const end = new Date(track.actual_end_time);
      const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      return sum + Math.max(0, hours);
    }
    return sum;
  }, 0) || 0;

  // Budget consumption percentage
  const totalSpent = activityCosts + externalCosts;
  const consumptionPercentage = targetBudget > 0 ? (totalSpent / targetBudget) * 100 : 0;

  // Forecast calculations
  const today = new Date();
  const start = startDate ? parseISO(startDate) : null;
  const end = endDate ? parseISO(endDate) : null;
  
  let timeProgress = 0;
  let daysRemaining = 0;
  let totalDays = 0;
  let isOverdue = false;
  let expectedBudgetAtDate = 0;

  if (start && end) {
    totalDays = differenceInDays(end, start);
    const daysElapsed = differenceInDays(today, start);
    daysRemaining = differenceInDays(end, today);
    timeProgress = totalDays > 0 ? Math.min(100, Math.max(0, (daysElapsed / totalDays) * 100)) : 0;
    isOverdue = isAfter(today, end);
    expectedBudgetAtDate = targetBudget * (timeProgress / 100);
  }

  // Variance analysis
  const budgetVariance = expectedBudgetAtDate - totalSpent;
  const isUnderBudget = budgetVariance >= 0;

  const formatCurrency = (value: number) => 
    `€${value.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const formatHours = (value: number) => 
    `${value.toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}h`;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Budget Consumption Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Project Budget Consumption
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Target Budget */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Target Budget (margine {marginPercentage || 0}%)</span>
              <span className="font-semibold">{formatCurrency(targetBudget)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Budget Totale</span>
              <span className="font-medium">{formatCurrency(totalBudget)}</span>
            </div>
          </div>

          {/* Consumption Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Consumo Budget</span>
              <span className={`font-semibold ${consumptionPercentage > 100 ? 'text-destructive' : consumptionPercentage > 80 ? 'text-yellow-500' : 'text-green-500'}`}>
                {consumptionPercentage.toFixed(1)}%
              </span>
            </div>
            <Progress 
              value={Math.min(100, consumptionPercentage)} 
              className={consumptionPercentage > 100 ? '[&>div]:bg-destructive' : consumptionPercentage > 80 ? '[&>div]:bg-yellow-500' : ''}
            />
            <p className="text-xs text-muted-foreground">
              {formatCurrency(totalSpent)} / {formatCurrency(targetBudget)}
            </p>
          </div>

          {/* Hours Breakdown */}
          <div className="grid grid-cols-2 gap-4 pt-2 border-t">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                Ore Confermate
              </div>
              <p className="text-lg font-semibold text-green-600">{formatHours(confirmedHours)}</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                Ore Pianificate
              </div>
              <p className="text-lg font-semibold text-blue-600">{formatHours(plannedHours)}</p>
            </div>
          </div>

          {/* Costs Breakdown */}
          <div className="grid grid-cols-2 gap-4 pt-2 border-t">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Euro className="h-4 w-4" />
                Costi Attività
              </div>
              <p className="text-lg font-semibold">{formatCurrency(activityCosts)}</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Euro className="h-4 w-4" />
                Costi Esterni
              </div>
              <p className="text-lg font-semibold">{formatCurrency(externalCosts)}</p>
            </div>
          </div>

          {/* Hours vs Budget */}
          <div className="pt-2 border-t">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Ore Totali Previste</span>
              <span className="font-medium">{formatHours(totalHours)}</span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-muted-foreground">Ore Rimanenti da Pianificare</span>
              <span className="font-medium">{formatHours(Math.max(0, totalHours - plannedHours))}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Budget Forecast Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Project Budget Forecast
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Time Progress */}
          {start && end ? (
            <>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Avanzamento Temporale</span>
                  <span className={`font-semibold ${isOverdue ? 'text-destructive' : ''}`}>
                    {timeProgress.toFixed(1)}%
                  </span>
                </div>
                <Progress 
                  value={Math.min(100, timeProgress)} 
                  className={isOverdue ? '[&>div]:bg-destructive' : ''}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{totalDays} giorni totali</span>
                  <span>{daysRemaining > 0 ? `${daysRemaining} giorni rimanenti` : isOverdue ? 'Scaduto' : 'Ultimo giorno'}</span>
                </div>
              </div>

              {/* Variance Analysis */}
              <div className="space-y-3 pt-2 border-t">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Analisi Varianza</span>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Budget Atteso ad Oggi</p>
                    <p className="text-lg font-semibold">{formatCurrency(expectedBudgetAtDate)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Budget Effettivo</p>
                    <p className="text-lg font-semibold">{formatCurrency(totalSpent)}</p>
                  </div>
                </div>

                <div className={`flex items-center gap-2 p-3 rounded-lg ${isUnderBudget ? 'bg-green-500/10' : 'bg-destructive/10'}`}>
                  {isUnderBudget ? (
                    <>
                      <TrendingUp className="h-5 w-5 text-green-600" />
                      <div>
                        <p className="text-sm font-medium text-green-600">Sotto Budget</p>
                        <p className="text-xs text-green-600/80">Risparmio: {formatCurrency(Math.abs(budgetVariance))}</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-5 w-5 text-destructive" />
                      <div>
                        <p className="text-sm font-medium text-destructive">Sopra Budget</p>
                        <p className="text-xs text-destructive/80">Eccesso: {formatCurrency(Math.abs(budgetVariance))}</p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Forecast */}
              <div className="space-y-3 pt-2 border-t">
                <p className="text-sm text-muted-foreground">Proiezione a Fine Progetto</p>
                
                {timeProgress > 0 && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Costo Stimato Finale</span>
                      <span className="font-semibold">
                        {formatCurrency(timeProgress > 0 ? (totalSpent / timeProgress) * 100 : totalSpent)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Varianza Stimata</span>
                      <span className={`font-semibold ${
                        ((totalSpent / timeProgress) * 100) <= targetBudget ? 'text-green-600' : 'text-destructive'
                      }`}>
                        {formatCurrency(targetBudget - ((totalSpent / timeProgress) * 100))}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Calendar className="h-12 w-12 text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">
                Imposta le date di inizio e fine progetto per visualizzare il forecast
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
