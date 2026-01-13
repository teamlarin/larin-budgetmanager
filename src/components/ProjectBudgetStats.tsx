import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { differenceInDays, parseISO, isAfter, format, startOfMonth, endOfMonth, eachMonthOfInterval } from 'date-fns';
import { it } from 'date-fns/locale';
import { TrendingUp, Clock, Target, Euro, Calendar, AlertTriangle, Bell, Edit2, Check, X, RotateCcw, Users } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts';
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart';
import { ProjectAdditionalCosts } from './ProjectAdditionalCosts';
import { toast } from 'sonner';
import { categoryColorsSolid, getCategorySolidColor } from '@/lib/categoryColors';
interface ProjectBudgetStatsProps {
  projectId: string;
  totalBudget: number;
  totalHours: number;
  marginPercentage: number;
  startDate?: string;
  endDate?: string;
  projectionWarningThreshold?: number;
  projectionCriticalThreshold?: number;
  manualActivitiesBudget?: number | null;
  onBudgetUpdate?: () => void;
}
export const ProjectBudgetStats = ({
  projectId,
  totalBudget,
  totalHours,
  marginPercentage,
  startDate,
  endDate,
  projectionWarningThreshold = 10,
  projectionCriticalThreshold = 25,
  manualActivitiesBudget,
  onBudgetUpdate
}: ProjectBudgetStatsProps) => {
  const queryClient = useQueryClient();
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [editBudgetValue, setEditBudgetValue] = useState('');
  // Fetch overheads setting
  const {
    data: overheadsData
  } = useQuery({
    queryKey: ['overheads-setting'],
    queryFn: async () => {
      const {
        data
      } = await supabase.from('app_settings').select('setting_value').eq('setting_key', 'overheads').maybeSingle();
      if (data?.setting_value && typeof data.setting_value === 'object' && 'amount' in data.setting_value) {
        return Number((data.setting_value as {
          amount: number;
        }).amount) || 0;
      }
      return 0;
    }
  });
  const overheadsAmount = overheadsData || 0;

  // Fetch budget items for external costs
  const {
    data: budgetItems
  } = useQuery({
    queryKey: ['budget-items-stats', projectId],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from('budget_items').select('*').eq('project_id', projectId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!projectId
  });

  // Fetch time tracking for planned and confirmed hours
  const {
    data: timeTracking
  } = useQuery({
    queryKey: ['time-tracking-stats', projectId],
    queryFn: async () => {
      // Get all budget item IDs for this project
      const {
        data: items
      } = await supabase.from('budget_items').select('id').eq('project_id', projectId);
      if (!items || items.length === 0) return [];
      const itemIds = items.map(item => item.id);
      const {
        data,
        error
      } = await supabase.from('activity_time_tracking').select('*').in('budget_item_id', itemIds);
      if (error) throw error;
      return data || [];
    },
    enabled: !!projectId
  });

  // Fetch user profiles for hourly rates and names
  const {
    data: userProfiles
  } = useQuery({
    queryKey: ['user-profiles-rates', projectId],
    queryFn: async () => {
      // Get unique user IDs from time tracking
      const userIds = [...new Set(timeTracking?.map(t => t.user_id) || [])];
      if (userIds.length === 0) return [];
      const {
        data,
        error
      } = await supabase.from('profiles').select('id, hourly_rate, first_name, last_name').in('id', userIds);
      if (error) throw error;
      return data || [];
    },
    enabled: !!timeTracking && timeTracking.length > 0
  });

  // Create a map of user hourly rates
  const userHourlyRates = new Map(userProfiles?.map(p => [p.id, Number(p.hourly_rate || 0)]) || []);

  // Create a map of user names
  const userNames = new Map(userProfiles?.map(p => [p.id, `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Utente sconosciuto']) || []);

  // Fetch additional costs
  const {
    data: additionalCosts
  } = useQuery({
    queryKey: ['project-additional-costs', projectId],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from('project_additional_costs').select('*').eq('project_id', projectId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!projectId
  });

  // Calculate total additional costs
  const totalAdditionalCosts = additionalCosts?.reduce((sum, cost) => sum + Number(cost.amount || 0), 0) || 0;

  // Calculate metrics
  // External costs (products) - costi esterni (lordi, come nell'edge function)
  // Allineato con calculate-project-margins che usa total_cost direttamente
  const productCosts = budgetItems?.filter(item => item.is_product).reduce((sum, item) => {
    return sum + Number(item.total_cost || 0);
  }, 0) || 0;

  // Total external costs = product costs + additional costs (from project_additional_costs table)
  const externalCosts = productCosts + totalAdditionalCosts;

  // Budget attività (solo attività, esclusi prodotti) - calcolato
  const calculatedActivitiesBudget = budgetItems?.filter(item => !item.is_product).reduce((sum, item) => sum + Number(item.total_cost || 0), 0) || 0;

  // Usa il budget manuale se presente, altrimenti quello calcolato
  const activitiesBudget = manualActivitiesBudget != null ? manualActivitiesBudget : calculatedActivitiesBudget;
  const hasManualBudget = manualActivitiesBudget != null;

  // Target Budget = budget attività - margine (calcolato solo sulle attività)
  // I costi esterni (inclusi additional costs) vengono conteggiati in totalSpent
  const targetBudget = activitiesBudget * (1 - (marginPercentage || 0) / 100);

  // Function to save manual budget
  const saveManualBudget = async (value: number | null) => {
    try {
      // Calculate the new total budget
      // total_budget = budget attività + costi esterni (prodotti lordi)
      const newActivitiesBudget = value ?? calculatedActivitiesBudget;
      const externalCostsGross = budgetItems?.filter(item => item.is_product).reduce((sum, item) => sum + Number(item.total_cost || 0), 0) || 0;
      const newTotalBudget = newActivitiesBudget + externalCostsGross;

      // Try to update budgets table first (new structure)
      const {
        error: budgetError
      } = await supabase.from('budgets').update({
        manual_activities_budget: value,
        total_budget: newTotalBudget
      }).eq('id', projectId);

      // If budgets update fails (maybe record doesn't exist), try projects table for backward compatibility
      if (budgetError) {
        const {
          error: projectError
        } = await supabase.from('projects').update({
          manual_activities_budget: value,
          total_budget: newTotalBudget
        }).eq('id', projectId);
        if (projectError) throw projectError;
      }
      toast.success(value !== null ? 'Budget attività aggiornato' : 'Budget manuale rimosso');
      setIsEditingBudget(false);
      setEditBudgetValue('');
      queryClient.invalidateQueries({
        queryKey: ['project-canvas', projectId]
      });
      queryClient.invalidateQueries({
        queryKey: ['budget', projectId]
      });
      onBudgetUpdate?.();
    } catch (error) {
      console.error('Error updating budget:', error);
      toast.error('Errore durante l\'aggiornamento del budget');
    }
  };
  const handleStartEditBudget = () => {
    setEditBudgetValue(activitiesBudget.toString());
    setIsEditingBudget(true);
  };
  const handleSaveBudget = () => {
    const value = parseFloat(editBudgetValue);
    if (isNaN(value) || value < 0) {
      toast.error('Inserisci un valore valido');
      return;
    }
    saveManualBudget(value);
  };
  const handleResetBudget = () => {
    saveManualBudget(null);
  };
  const handleCancelEdit = () => {
    setIsEditingBudget(false);
    setEditBudgetValue('');
  };

  // Create a map of budget item categories
  const budgetItemCategories = new Map(budgetItems?.map(item => [item.id, item.category]) || []);

  // Calculate planned hours from time tracking
  const plannedHours = timeTracking?.reduce((sum, track) => {
    if (track.scheduled_start_time && track.scheduled_end_time) {
      const start = track.scheduled_start_time.split(':').map(Number);
      const end = track.scheduled_end_time.split(':').map(Number);
      const hours = end[0] + end[1] / 60 - (start[0] + start[1] / 60);
      return sum + Math.max(0, hours);
    }
    return sum;
  }, 0) || 0;

  // Calculate confirmed hours and CONFIRMED COSTS from time tracking
  // Consumo budget = ore confermate × (tariffa oraria utente + overheads)
  const confirmedData = timeTracking?.reduce((acc, track) => {
    if (track.actual_start_time && track.actual_end_time) {
      const start = new Date(track.actual_start_time);
      const end = new Date(track.actual_end_time);
      const hours = Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60));
      const userHourlyRate = userHourlyRates.get(track.user_id) || 0;
      const cost = hours * (userHourlyRate + overheadsAmount);
      return {
        hours: acc.hours + hours,
        cost: acc.cost + cost
      };
    }
    return acc;
  }, {
    hours: 0,
    cost: 0
  }) || {
    hours: 0,
    cost: 0
  };
  const confirmedHours = confirmedData.hours;
  const confirmedCosts = confirmedData.cost;

  // Calculate confirmed hours breakdown by category
  const confirmedByCategory = timeTracking?.reduce((acc, track) => {
    if (track.actual_start_time && track.actual_end_time) {
      const start = new Date(track.actual_start_time);
      const end = new Date(track.actual_end_time);
      const hours = Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60));
      const userHourlyRate = userHourlyRates.get(track.user_id) || 0;
      const cost = hours * (userHourlyRate + overheadsAmount);
      const category = budgetItemCategories.get(track.budget_item_id) || 'Altro';
      if (!acc[category]) {
        acc[category] = {
          hours: 0,
          cost: 0
        };
      }
      acc[category].hours += hours;
      acc[category].cost += cost;
    }
    return acc;
  }, {} as Record<string, {
    hours: number;
    cost: number;
  }>) || {};

  // Calculate confirmed hours breakdown by user
  const confirmedByUser = timeTracking?.reduce((acc, track) => {
    if (track.actual_start_time && track.actual_end_time) {
      const start = new Date(track.actual_start_time);
      const end = new Date(track.actual_end_time);
      const hours = Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60));
      const userHourlyRate = userHourlyRates.get(track.user_id) || 0;
      const cost = hours * (userHourlyRate + overheadsAmount);
      const userName = userNames.get(track.user_id) || 'Utente sconosciuto';
      if (!acc[userName]) {
        acc[userName] = {
          hours: 0,
          cost: 0,
          hourlyRate: userHourlyRate
        };
      }
      acc[userName].hours += hours;
      acc[userName].cost += cost;
    }
    return acc;
  }, {} as Record<string, {
    hours: number;
    cost: number;
    hourlyRate: number;
  }>) || {};

  // Use centralized category colors

  // User colors - cycle through these colors for users
  const userColors = ['bg-indigo-500', 'bg-rose-500', 'bg-amber-500', 'bg-teal-500', 'bg-violet-500', 'bg-cyan-500', 'bg-pink-500', 'bg-lime-500'];

  // Budget consumption = confirmed costs + external costs (products + additional costs)
  // Il consumo del budget è dato dalle ore confermate + costi esterni
  const totalSpent = confirmedCosts + externalCosts;
  const consumptionPercentage = targetBudget > 0 ? totalSpent / targetBudget * 100 : 0;
  
  // Margine Residuo % = (Budget Totale - Costi Sostenuti) / Budget Totale × 100
  // Allineato con la formula usata nella lista progetti (edge function calculate-project-margins)
  const remainingPercentage = totalBudget > 0 ? ((totalBudget - totalSpent) / totalBudget) * 100 : 100;

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
    timeProgress = totalDays > 0 ? Math.min(100, Math.max(0, daysElapsed / totalDays * 100)) : 0;
    isOverdue = isAfter(today, end);
    expectedBudgetAtDate = targetBudget * (timeProgress / 100);
  }

  // Variance analysis
  const budgetVariance = expectedBudgetAtDate - totalSpent;
  const isUnderBudget = budgetVariance >= 0;
  const formatCurrency = (value: number) => `€${value.toLocaleString('it-IT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
  const formatHours = (value: number) => `${value.toLocaleString('it-IT', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  })}h`;

  // Calculate projection rate based on current consumption
  const daysElapsedSinceStart = start ? Math.max(1, differenceInDays(today, start)) : 1;
  const dailyRate = totalSpent / daysElapsedSinceStart;
  const projectedFinalCost = start && end ? dailyRate * differenceInDays(end, start) : totalSpent;

  // Generate chart data based on confirmed activities over time
  const generateChartData = () => {
    if (!start || !end) return [];
    const months = eachMonthOfInterval({
      start,
      end
    });

    // Calculate cumulative confirmed costs per month
    let cumulativeCost = 0;
    return months.map((month, index) => {
      const monthStart = startOfMonth(month);
      const monthEnd = endOfMonth(month);

      // Sum confirmed costs for activities in this month
      const monthCosts = timeTracking?.filter(track => {
        if (!track.actual_end_time) return false;
        const trackDate = new Date(track.actual_end_time);
        return trackDate >= monthStart && trackDate <= monthEnd;
      }).reduce((sum, track) => {
        if (track.actual_start_time && track.actual_end_time) {
          const startTime = new Date(track.actual_start_time);
          const endTime = new Date(track.actual_end_time);
          const hours = Math.max(0, (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60));
          const userHourlyRate = userHourlyRates.get(track.user_id) || 0;
          return sum + hours * (userHourlyRate + overheadsAmount);
        }
        return sum;
      }, 0) || 0;
      cumulativeCost += monthCosts;

      // Calculate projection: linear interpolation from 0 to projectedFinalCost
      const projectionValue = projectedFinalCost / (months.length - 1 || 1) * index;
      return {
        month: format(month, 'MMM yyyy', {
          locale: it
        }),
        date: format(month, 'dd/MM/yyyy', {
          locale: it
        }),
        cumulativo: cumulativeCost,
        target: targetBudget,
        proiezione: totalSpent > 0 ? projectionValue : null
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

  // Alert for projection exceeding target budget
  if (totalSpent > 0 && targetBudget > 0 && projectedFinalCost > 0) {
    const projectionExcessPercentage = (projectedFinalCost - targetBudget) / targetBudget * 100;
    if (projectionExcessPercentage >= projectionCriticalThreshold) {
      alerts.push({
        type: 'critical',
        title: 'Proiezione Budget Critica',
        message: `La proiezione a fine progetto (${formatCurrency(projectedFinalCost)}) supera il target di ${projectionExcessPercentage.toFixed(0)}% (soglia critica: ${projectionCriticalThreshold}%). Eccesso: ${formatCurrency(projectedFinalCost - targetBudget)}`
      });
    } else if (projectionExcessPercentage >= projectionWarningThreshold) {
      alerts.push({
        type: 'warning',
        title: 'Proiezione Budget Elevata',
        message: `La proiezione a fine progetto (${formatCurrency(projectedFinalCost)}) supera il target di ${projectionExcessPercentage.toFixed(0)}% (soglia warning: ${projectionWarningThreshold}%). Eccesso stimato: ${formatCurrency(projectedFinalCost - targetBudget)}`
      });
    }
  }
  const chartConfig = {
    cumulativo: {
      label: "Consumo Budget",
      color: "hsl(var(--primary))"
    },
    target: {
      label: "Target Budget",
      color: "hsl(0, 84%, 60%)"
    },
    proiezione: {
      label: "Proiezione Fine Progetto",
      color: "hsl(280, 70%, 50%)"
    }
  };
  return <div className="space-y-4">
      {/* Budget Alerts */}
      {alerts.length > 0 && <div className="space-y-2">
          {alerts.map((alert, index) => <Alert key={index} variant={alert.type === 'critical' ? 'destructive' : 'default'} className={alert.type === 'warning' ? 'border-yellow-500 bg-yellow-500/10' : ''}>
              {alert.type === 'critical' ? <AlertTriangle className="h-4 w-4" /> : <Bell className="h-4 w-4 text-yellow-600" />}
              <AlertTitle className={alert.type === 'warning' ? 'text-yellow-600' : ''}>{alert.title}</AlertTitle>
              <AlertDescription className={alert.type === 'warning' ? 'text-yellow-600/80' : ''}>{alert.message}</AlertDescription>
            </Alert>)}
        </div>}

      {/* Budget Consumption Chart */}
      {chartData.length > 0 && <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Euro className="h-5 w-5 text-primary" />
              Andamento Consumo Budget
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{
              top: 20,
              right: 30,
              left: 20,
              bottom: 5
            }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs" tick={{
                fill: 'hsl(var(--muted-foreground))'
              }} label={{
                value: `${start ? format(start, 'dd/MM/yyyy', {
                  locale: it
                }) : ''} - ${end ? format(end, 'dd/MM/yyyy', {
                  locale: it
                }) : ''}`,
                position: 'bottom',
                offset: -5,
                fill: 'hsl(var(--muted-foreground))',
                fontSize: 11
              }} />
                  <YAxis domain={[0, Math.max(targetBudget * 1.2, totalSpent * 1.2)]} tickFormatter={value => `€${(value / 1000).toFixed(0)}k`} className="text-xs" tick={{
                fill: 'hsl(var(--muted-foreground))'
              }} label={{
                value: 'Budget (€)',
                angle: -90,
                position: 'insideLeft',
                fill: 'hsl(var(--muted-foreground))',
                fontSize: 11
              }} />
                  <Tooltip content={({
                active,
                payload,
                label
              }) => {
                if (!active || !payload) return null;
                return <div className="bg-background border rounded-lg p-3 shadow-lg">
                          <p className="font-medium mb-2">{label}</p>
                          {payload.map((entry: any, index: number) => <p key={index} className="text-sm" style={{
                    color: entry.color
                  }}>
                              {entry.name}: {formatCurrency(entry.value)}
                            </p>)}
                        </div>;
              }} />
                  <Legend />
                  <Line type="monotone" dataKey="target" name="Target Budget" stroke="hsl(0, 84%, 60%)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="proiezione" name="Proiezione Fine Progetto" stroke="hsl(280, 70%, 50%)" strokeWidth={2} strokeDasharray="5 5" dot={false} connectNulls={false} />
                  <Line type="monotone" dataKey="cumulativo" name="Consumo Budget" stroke="hsl(var(--primary))" strokeWidth={2} dot={{
                fill: 'hsl(var(--primary))',
                strokeWidth: 2
              }} />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>}

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
            {/* Editable Budget Attività */}
            <div className="flex justify-between items-center text-sm">
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground">Budget attività (vendita)</span>
                {hasManualBudget && <span className="text-xs bg-yellow-500/20 text-yellow-600 px-1.5 py-0.5 rounded">Manuale</span>}
              </div>
              {isEditingBudget ? <div className="flex items-center gap-1">
                  <Input type="number" value={editBudgetValue} onChange={e => setEditBudgetValue(e.target.value)} className="h-7 w-28 text-right text-sm" min="0" step="100" />
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleSaveBudget}>
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleCancelEdit}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div> : <div className="flex items-center gap-1">
                  <span className="font-semibold">{formatCurrency(activitiesBudget)}</span>
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleStartEditBudget} title="Modifica budget">
                    <Edit2 className="h-3 w-3" />
                  </Button>
                  {hasManualBudget && <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleResetBudget} title="Ripristina valore calcolato">
                      <RotateCcw className="h-3 w-3" />
                    </Button>}
                </div>}
            </div>
            {hasManualBudget && <div className="flex justify-between text-xs">
                <span className="text-muted-foreground/70">Valore calcolato</span>
                <span className="text-muted-foreground/70">{formatCurrency(calculatedActivitiesBudget)}</span>
              </div>}
            {productCosts > 0 && <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Prodotti</span>
                <span className="font-medium">{formatCurrency(productCosts)}</span>
              </div>}
          </div>

          {/* Budget Remaining Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Budget rimanente</span>
              <span className={`font-semibold ${remainingPercentage < 0 ? 'text-destructive' : remainingPercentage < 20 ? 'text-yellow-500' : 'text-green-500'}`}>
                {remainingPercentage.toFixed(1)}%
              </span>
            </div>
            
            {/* Custom progress bar with target indicator */}
            <div className="relative">
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                {/* Consumed portion */}
                <div className={`h-full transition-all ${consumptionPercentage > 100 ? 'bg-destructive' : consumptionPercentage > 80 ? 'bg-yellow-500' : 'bg-primary'}`} style={{
                  width: `${Math.min(100, consumptionPercentage)}%`
                }} />
              </div>
              {/* Target budget indicator line */}
              <div className="absolute top-0 h-3 w-0.5 bg-green-600" style={{
                left: '100%',
                transform: 'translateX(-100%)'
              }} title="Target Budget" />
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
                Ore confermate
              </div>
              <p className="text-lg font-semibold text-green-600">{formatHours(confirmedHours)}</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                Ore pianificate
              </div>
              <p className="text-lg font-semibold text-blue-600">{formatHours(plannedHours)}</p>
            </div>
          </div>

          {/* Costs Breakdown */}
          <div className="grid grid-cols-2 gap-4 pt-2 border-t">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Euro className="h-4 w-4" />
                Costi attività confermate
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
              <span className="text-muted-foreground">Budget attività</span>
              <span className="font-medium">{formatCurrency(activitiesBudget)}</span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-muted-foreground">Costi sostenuti</span>
              <span className="font-medium">{formatCurrency(totalSpent)}</span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-muted-foreground">Budget rimanente</span>
              <span className={`font-medium ${(targetBudget - totalSpent) < 0 ? 'text-destructive' : 'text-green-600'}`}>
                {formatCurrency(targetBudget - totalSpent)}
              </span>
            </div>
          </div>

          {/* Hours vs Budget */}
          <div className="pt-2 border-t">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Ore totali previste</span>
              <span className="font-medium">{formatHours(totalHours)}</span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-muted-foreground">Ore rimanenti da pianificare</span>
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
          {start && end ? <>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Avanzamento Temporale</span>
                  <span className={`font-semibold ${isOverdue ? 'text-destructive' : ''}`}>
                    {timeProgress.toFixed(1)}%
                  </span>
                </div>
                <Progress value={Math.min(100, timeProgress)} className={isOverdue ? '[&>div]:bg-destructive' : ''} />
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
                  {isUnderBudget ? <>
                      <TrendingUp className="h-5 w-5 text-green-600" />
                      <div>
                        <p className="text-sm font-medium text-green-600">Sotto Budget</p>
                        <p className="text-xs text-green-600/80">Risparmio: {formatCurrency(Math.abs(budgetVariance))}</p>
                      </div>
                    </> : <>
                      <AlertTriangle className="h-5 w-5 text-destructive" />
                      <div>
                        <p className="text-sm font-medium text-destructive">Sopra Budget</p>
                        <p className="text-xs text-destructive/80">Eccesso: {formatCurrency(Math.abs(budgetVariance))}</p>
                      </div>
                    </>}
                </div>
              </div>

              {/* Forecast */}
              <div className="space-y-3 pt-2 border-t">
                <p className="text-sm text-muted-foreground">Proiezione a Fine Progetto</p>
                
                {timeProgress > 0 && <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Costo Stimato Finale</span>
                      <span className="font-semibold">
                        {formatCurrency(timeProgress > 0 ? totalSpent / timeProgress * 100 : totalSpent)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Varianza Stimata</span>
                      <span className={`font-semibold ${totalSpent / timeProgress * 100 <= targetBudget ? 'text-green-600' : 'text-destructive'}`}>
                        {formatCurrency(targetBudget - totalSpent / timeProgress * 100)}
                      </span>
                    </div>
                  </div>}
              </div>
            </> : <div className="flex flex-col items-center justify-center py-8 text-center">
              <Calendar className="h-12 w-12 text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">
                Imposta le date di inizio e fine progetto per visualizzare il forecast
              </p>
            </div>}
        </CardContent>
      </Card>

      {/* Category Breakdown Card */}
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Breakdown ore confermate per categoria
          </CardTitle>
        </CardHeader>
        <CardContent>
          {Object.keys(confirmedByCategory).length > 0 ? <>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {Object.entries(confirmedByCategory).sort((a, b) => b[1].hours - a[1].hours).map(([category, data]) => {
                const percentage = confirmedHours > 0 ? data.hours / confirmedHours * 100 : 0;
                const colorClass = getCategorySolidColor(category);
                return <div key={category} className="p-4 rounded-lg border bg-card">
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
                      </div>;
              })}
              </div>
              
              {/* Summary row */}
              <div className="mt-4 pt-4 border-t flex flex-wrap gap-6 justify-center">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Totale ore confermate</p>
                  <p className="text-xl font-bold text-green-600">{formatHours(confirmedHours)}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Totale costi confermati</p>
                  <p className="text-xl font-bold">{formatCurrency(confirmedCosts)}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Categorie Attive</p>
                  <p className="text-xl font-bold">{Object.keys(confirmedByCategory).length}</p>
                </div>
              </div>
            </> : <div className="flex flex-col items-center justify-center py-8 text-center">
              <Clock className="h-12 w-12 text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">
                Nessuna attività confermata ancora.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Le ore confermate appariranno qui quando il team confermerà le attività dal calendario.
              </p>
            </div>}
        </CardContent>
      </Card>

      {/* Breakdown by User */}
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Breakdown ore confermate per utente
          </CardTitle>
        </CardHeader>
        <CardContent>
          {Object.keys(confirmedByUser).length > 0 ? <>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {Object.entries(confirmedByUser).sort((a, b) => b[1].hours - a[1].hours).map(([userName, data], index) => {
                const percentage = confirmedHours > 0 ? data.hours / confirmedHours * 100 : 0;
                const colorClass = userColors[index % userColors.length];
                return <div key={userName} className="p-4 rounded-lg border bg-card">
                        <div className="flex items-center gap-2 mb-3">
                          <div className={`w-3 h-3 rounded-full ${colorClass}`} />
                          <span className="font-medium">{userName}</span>
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
                      </div>;
              })}
              </div>
              
              {/* Summary row */}
              <div className="mt-4 pt-4 border-t flex flex-wrap gap-6 justify-center">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Totale ore confermate</p>
                  <p className="text-xl font-bold text-green-600">{formatHours(confirmedHours)}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Totale costi confermati</p>
                  <p className="text-xl font-bold">{formatCurrency(confirmedCosts)}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Utenti Attivi</p>
                  <p className="text-xl font-bold">{Object.keys(confirmedByUser).length}</p>
                </div>
              </div>
            </> : <div className="flex flex-col items-center justify-center py-8 text-center">
              <Users className="h-12 w-12 text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">
                Nessuna attività confermata ancora.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Le ore confermate per utente appariranno qui quando il team confermerà le attività dal calendario.
              </p>
            </div>}
        </CardContent>
      </Card>
      </div>
    </div>;
};