import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { differenceInDays, parseISO, isAfter, format, startOfMonth, endOfMonth, eachMonthOfInterval } from 'date-fns';
import { it } from 'date-fns/locale';
import { TrendingUp, Clock, Target, Euro, Calendar, AlertTriangle, Bell } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts';
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart';
import { ProjectAdditionalCosts } from './ProjectAdditionalCosts';

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

  // Fetch additional costs
  const { data: additionalCosts } = useQuery({
    queryKey: ['project-additional-costs', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_additional_costs')
        .select('*')
        .eq('project_id', projectId);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!projectId
  });

  // Calculate total additional costs
  const totalAdditionalCosts = additionalCosts?.reduce((sum, cost) => sum + Number(cost.amount || 0), 0) || 0;

  // Calculate metrics
  // External costs (products) - costi esterni
  const externalCosts = budgetItems
    ?.filter(item => item.is_product)
    .reduce((sum, item) => sum + Number(item.total_cost || 0), 0) || 0;

  // Budget attività (solo attività, esclusi prodotti)
  const activitiesBudget = budgetItems
    ?.filter(item => !item.is_product)
    .reduce((sum, item) => sum + Number(item.total_cost || 0), 0) || 0;

  // Target Budget = budget attività - margine - spese aggiuntive (calcolato solo sulle attività)
  const targetBudget = (activitiesBudget * (1 - (marginPercentage || 0) / 100)) - totalAdditionalCosts;

  // Create a map of budget item hourly rates
  const budgetItemRates = new Map(
    budgetItems?.map(item => [item.id, Number(item.hourly_rate || 0)]) || []
  );

  // Create a map of budget item categories
  const budgetItemCategories = new Map(
    budgetItems?.map(item => [item.id, item.category]) || []
  );

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

  // Calculate confirmed hours and CONFIRMED COSTS from time tracking
  // Consumo budget = ore confermate × tariffa oraria dell'attività
  const confirmedData = timeTracking?.reduce((acc, track) => {
    if (track.actual_start_time && track.actual_end_time) {
      const start = new Date(track.actual_start_time);
      const end = new Date(track.actual_end_time);
      const hours = Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60));
      const hourlyRate = budgetItemRates.get(track.budget_item_id) || 0;
      const cost = hours * hourlyRate;
      
      return {
        hours: acc.hours + hours,
        cost: acc.cost + cost
      };
    }
    return acc;
  }, { hours: 0, cost: 0 }) || { hours: 0, cost: 0 };

  const confirmedHours = confirmedData.hours;
  const confirmedCosts = confirmedData.cost;

  // Calculate confirmed hours breakdown by category
  const confirmedByCategory = timeTracking?.reduce((acc, track) => {
    if (track.actual_start_time && track.actual_end_time) {
      const start = new Date(track.actual_start_time);
      const end = new Date(track.actual_end_time);
      const hours = Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60));
      const hourlyRate = budgetItemRates.get(track.budget_item_id) || 0;
      const cost = hours * hourlyRate;
      const category = budgetItemCategories.get(track.budget_item_id) || 'Altro';
      
      if (!acc[category]) {
        acc[category] = { hours: 0, cost: 0 };
      }
      acc[category].hours += hours;
      acc[category].cost += cost;
    }
    return acc;
  }, {} as Record<string, { hours: number; cost: number }>) || {};

  // Category colors mapping
  const categoryColors: Record<string, string> = {
    'Management': 'bg-blue-500',
    'Design': 'bg-purple-500',
    'Dev': 'bg-green-500',
    'Content': 'bg-orange-500',
    'Support': 'bg-gray-500',
    'Altro': 'bg-slate-400'
  };

  // Budget consumption = confirmed costs only (products don't affect budget consumption)
  // Il consumo del budget è dato solo dalle ore confermate
  const totalSpent = confirmedCosts;
  const consumptionPercentage = targetBudget > 0 ? (totalSpent / targetBudget) * 100 : 0;
  const remainingPercentage = 100 - consumptionPercentage;

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

  // Generate chart data based on confirmed activities over time
  const generateChartData = () => {
    if (!start || !end) return [];
    
    const months = eachMonthOfInterval({ start, end });
    
    // Calculate cumulative confirmed costs per month
    let cumulativeCost = 0;
    
    return months.map((month) => {
      const monthStart = startOfMonth(month);
      const monthEnd = endOfMonth(month);
      
      // Sum confirmed costs for activities in this month
      const monthCosts = timeTracking
        ?.filter(track => {
          if (!track.actual_end_time) return false;
          const trackDate = new Date(track.actual_end_time);
          return trackDate >= monthStart && trackDate <= monthEnd;
        })
        .reduce((sum, track) => {
          if (track.actual_start_time && track.actual_end_time) {
            const startTime = new Date(track.actual_start_time);
            const endTime = new Date(track.actual_end_time);
            const hours = Math.max(0, (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60));
            const hourlyRate = budgetItemRates.get(track.budget_item_id) || 0;
            return sum + (hours * hourlyRate);
          }
          return sum;
        }, 0) || 0;
      
      cumulativeCost += monthCosts;
      
      return {
        month: format(month, 'MMM yyyy', { locale: it }),
        date: format(month, 'dd/MM/yyyy', { locale: it }),
        cumulativo: cumulativeCost,
        target: targetBudget
      };
    });
  };

  const chartData = generateChartData();

  // Alert thresholds
  const THRESHOLD_WARNING = 80;
  const THRESHOLD_CRITICAL = 100;
  
  const alerts = [];
  
  if (consumptionPercentage >= THRESHOLD_CRITICAL) {
    alerts.push({
      type: 'critical',
      title: 'Budget Superato',
      message: `Il budget ha superato il limite del ${THRESHOLD_CRITICAL}%. Consumo attuale: ${consumptionPercentage.toFixed(1)}%`
    });
  } else if (consumptionPercentage >= THRESHOLD_WARNING) {
    alerts.push({
      type: 'warning',
      title: 'Attenzione Budget',
      message: `Il consumo del budget ha raggiunto l'${consumptionPercentage.toFixed(1)}%. Soglia di attenzione: ${THRESHOLD_WARNING}%`
    });
  }
  
  if (isOverdue) {
    alerts.push({
      type: 'critical',
      title: 'Progetto Scaduto',
      message: `La data di fine progetto è stata superata di ${Math.abs(daysRemaining)} giorni.`
    });
  } else if (daysRemaining > 0 && daysRemaining <= 7) {
    alerts.push({
      type: 'warning',
      title: 'Scadenza Imminente',
      message: `Mancano solo ${daysRemaining} giorni alla scadenza del progetto.`
    });
  }
  
  if (!isUnderBudget && timeProgress > 0) {
    const projectedFinal = (totalSpent / timeProgress) * 100;
    if (projectedFinal > targetBudget * 1.1) {
      alerts.push({
        type: 'warning',
        title: 'Proiezione Costi Elevata',
        message: `La proiezione dei costi a fine progetto (${formatCurrency(projectedFinal)}) supera il target del 10%.`
      });
    }
  }

  const chartConfig = {
    cumulativo: {
      label: "Consumo Budget",
      color: "hsl(var(--primary))",
    },
    target: {
      label: "Target Budget",
      color: "hsl(0, 84%, 60%)",
    },
  };

  return (
    <div className="space-y-4">
      {/* Budget Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert, index) => (
            <Alert key={index} variant={alert.type === 'critical' ? 'destructive' : 'default'} className={alert.type === 'warning' ? 'border-yellow-500 bg-yellow-500/10' : ''}>
              {alert.type === 'critical' ? (
                <AlertTriangle className="h-4 w-4" />
              ) : (
                <Bell className="h-4 w-4 text-yellow-600" />
              )}
              <AlertTitle className={alert.type === 'warning' ? 'text-yellow-600' : ''}>{alert.title}</AlertTitle>
              <AlertDescription className={alert.type === 'warning' ? 'text-yellow-600/80' : ''}>{alert.message}</AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* Budget Consumption Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Euro className="h-5 w-5 text-primary" />
              Andamento Consumo Budget
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="month" 
                    className="text-xs" 
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    label={{ value: `${start ? format(start, 'dd/MM/yyyy', { locale: it }) : ''} - ${end ? format(end, 'dd/MM/yyyy', { locale: it }) : ''}`, position: 'bottom', offset: -5, fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  />
                  <YAxis 
                    domain={[0, Math.max(targetBudget * 1.2, totalSpent * 1.2)]}
                    tickFormatter={(value) => `€${(value / 1000).toFixed(0)}k`} 
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    label={{ value: 'Budget (€)', angle: -90, position: 'insideLeft', fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  />
                  <Tooltip 
                    content={({ active, payload, label }) => {
                      if (!active || !payload) return null;
                      return (
                        <div className="bg-background border rounded-lg p-3 shadow-lg">
                          <p className="font-medium mb-2">{label}</p>
                          {payload.map((entry: any, index: number) => (
                            <p key={index} className="text-sm" style={{ color: entry.color }}>
                              {entry.name}: {formatCurrency(entry.value)}
                            </p>
                          ))}
                        </div>
                      );
                    }}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="target" 
                    name="Target Budget" 
                    stroke="hsl(0, 84%, 60%)" 
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="cumulativo" 
                    name="Consumo Budget" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

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
          {/* Budget Overview */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Budget Attività (vendita)</span>
              <span className="font-semibold">{formatCurrency(activitiesBudget)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Target Budget (margine {marginPercentage || 0}%)</span>
              <span className="font-medium">{formatCurrency(targetBudget)}</span>
            </div>
            {totalAdditionalCosts > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Spese Aggiuntive</span>
                <span className="font-medium text-destructive">-{formatCurrency(totalAdditionalCosts)}</span>
              </div>
            )}
            {externalCosts > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Prodotti</span>
                <span className="font-medium">{formatCurrency(externalCosts)}</span>
              </div>
            )}
          </div>

          {/* Budget Remaining Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Budget Rimanente</span>
              <span className={`font-semibold ${remainingPercentage < 0 ? 'text-destructive' : remainingPercentage < 20 ? 'text-yellow-500' : 'text-green-500'}`}>
                {remainingPercentage.toFixed(1)}%
              </span>
            </div>
            
            {/* Custom progress bar with target indicator */}
            <div className="relative">
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                {/* Consumed portion */}
                <div 
                  className={`h-full transition-all ${consumptionPercentage > 100 ? 'bg-destructive' : consumptionPercentage > 80 ? 'bg-yellow-500' : 'bg-primary'}`}
                  style={{ width: `${Math.min(100, consumptionPercentage)}%` }}
                />
              </div>
              {/* Target budget indicator line */}
              <div 
                className="absolute top-0 h-3 w-0.5 bg-green-600"
                style={{ left: '100%', transform: 'translateX(-100%)' }}
                title="Target Budget"
              />
            </div>
            
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Consumato: {formatCurrency(totalSpent)}</span>
              <span>Rimanente: {formatCurrency(Math.max(0, targetBudget - totalSpent))}</span>
            </div>
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
                Costi Confermati
              </div>
              <p className="text-lg font-semibold text-green-600">{formatCurrency(confirmedCosts)}</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Euro className="h-4 w-4" />
                Costi Esterni
              </div>
              <p className="text-lg font-semibold">{formatCurrency(externalCosts)}</p>
            </div>
          </div>

          {/* Budget Breakdown */}
          <div className="pt-2 border-t">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Budget Attività</span>
              <span className="font-medium">{formatCurrency(activitiesBudget)}</span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-muted-foreground">Budget Rimanente</span>
              <span className={`font-medium ${targetBudget - totalSpent < 0 ? 'text-destructive' : 'text-green-600'}`}>
                {formatCurrency(targetBudget - totalSpent)}
              </span>
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

      {/* Category Breakdown Card */}
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Breakdown Ore Confermate per Categoria
          </CardTitle>
        </CardHeader>
        <CardContent>
          {Object.keys(confirmedByCategory).length > 0 ? (
            <>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {Object.entries(confirmedByCategory)
                  .sort((a, b) => b[1].hours - a[1].hours)
                  .map(([category, data]) => {
                    const percentage = confirmedHours > 0 ? (data.hours / confirmedHours) * 100 : 0;
                    const colorClass = categoryColors[category] || 'bg-slate-400';
                    
                    return (
                      <div key={category} className="p-4 rounded-lg border bg-card">
                        <div className="flex items-center gap-2 mb-3">
                          <div className={`w-3 h-3 rounded-full ${colorClass}`} />
                          <span className="font-medium">{category}</span>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Ore</span>
                            <span className="font-semibold">{formatHours(data.hours)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Costi</span>
                            <span className="font-semibold">{formatCurrency(data.cost)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">% del totale</span>
                            <span className="font-semibold">{percentage.toFixed(1)}%</span>
                          </div>
                          
                          <Progress value={percentage} className={`h-2 [&>div]:${colorClass}`} />
                        </div>
                      </div>
                    );
                  })}
              </div>
              
              {/* Summary row */}
              <div className="mt-4 pt-4 border-t flex flex-wrap gap-6 justify-center">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Totale Ore Confermate</p>
                  <p className="text-xl font-bold text-green-600">{formatHours(confirmedHours)}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Totale Costi Confermati</p>
                  <p className="text-xl font-bold">{formatCurrency(confirmedCosts)}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Categorie Attive</p>
                  <p className="text-xl font-bold">{Object.keys(confirmedByCategory).length}</p>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Clock className="h-12 w-12 text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">
                Nessuna attività confermata ancora.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Le ore confermate appariranno qui quando il team confermerà le attività dal calendario.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
      </div>

      {/* Additional Costs Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Euro className="h-5 w-5 text-primary" />
            Gestione Spese Aggiuntive
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ProjectAdditionalCosts projectId={projectId} />
        </CardContent>
      </Card>
    </div>
  );
};
