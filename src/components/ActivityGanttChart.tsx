import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { format, addDays, differenceInDays, startOfDay, isWithinInterval } from 'date-fns';
import { it } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { CalendarDays } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ActivityGanttChartProps {
  projectId: string;
  projectStartDate?: string | null;
}

interface BudgetItem {
  id: string;
  activity_name: string;
  category: string;
  hours_worked: number;
  duration_days: number | null;
  display_order: number;
}

const categoryColors: Record<string, string> = {
  Management: 'bg-blue-500',
  Design: 'bg-purple-500',
  Dev: 'bg-green-500',
  Content: 'bg-orange-500',
  Support: 'bg-gray-500',
  Altro: 'bg-slate-500',
};

export const ActivityGanttChart = ({ projectId, projectStartDate }: ActivityGanttChartProps) => {
  const { data: activities = [], isLoading } = useQuery<BudgetItem[]>({
    queryKey: ['budget-items-gantt', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('budget_items')
        .select('id, activity_name, category, hours_worked, duration_days, display_order')
        .eq('project_id', projectId)
        .eq('is_product', false)
        .order('display_order', { ascending: true });

      if (error) throw error;
      return data || [];
    },
  });

  // Filter activities with duration
  const activitiesWithDuration = activities.filter(a => a.duration_days && a.duration_days > 0);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-muted rounded w-1/3"></div>
            <div className="h-40 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (activitiesWithDuration.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Timeline Attività
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            Nessuna attività con durata impostata. Imposta la durata in giorni per visualizzare la timeline.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Calculate timeline based on activities
  const startDate = projectStartDate ? startOfDay(new Date(projectStartDate)) : startOfDay(new Date());
  
  // Calculate cumulative start dates for activities (sequential)
  let cumulativeDays = 0;
  const activitiesWithDates = activitiesWithDuration.map(activity => {
    const activityStart = addDays(startDate, cumulativeDays);
    const activityEnd = addDays(activityStart, (activity.duration_days || 1) - 1);
    const result = {
      ...activity,
      startDate: activityStart,
      endDate: activityEnd,
      startDay: cumulativeDays,
    };
    cumulativeDays += activity.duration_days || 1;
    return result;
  });

  const totalDays = cumulativeDays;
  const endDate = addDays(startDate, totalDays - 1);

  // Generate week markers
  const weeks: { start: Date; label: string }[] = [];
  let currentWeekStart = startDate;
  while (currentWeekStart <= endDate) {
    weeks.push({
      start: currentWeekStart,
      label: format(currentWeekStart, 'dd MMM', { locale: it }),
    });
    currentWeekStart = addDays(currentWeekStart, 7);
  }

  // Calculate today's position
  const today = startOfDay(new Date());
  const todayPosition = differenceInDays(today, startDate);
  const showTodayMarker = todayPosition >= 0 && todayPosition < totalDays;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5" />
          Timeline Attività
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Legend */}
          <div className="flex flex-wrap gap-3 mb-4">
            {Object.entries(categoryColors).map(([cat, color]) => (
              <div key={cat} className="flex items-center gap-1.5 text-xs">
                <div className={`w-3 h-3 rounded ${color}`}></div>
                <span className="text-muted-foreground">{cat}</span>
              </div>
            ))}
          </div>

          {/* Timeline header */}
          <div className="relative">
            <div className="flex border-b border-border pb-2 mb-2 overflow-x-auto">
              <div className="w-48 flex-shrink-0 text-sm font-medium text-muted-foreground">
                Attività
              </div>
              <div className="flex-1 relative min-w-[500px]">
                <div className="flex">
                  {weeks.map((week, i) => (
                    <div
                      key={i}
                      className="text-xs text-muted-foreground"
                      style={{ width: `${(7 / totalDays) * 100}%`, minWidth: '60px' }}
                    >
                      {week.label}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Activities */}
            <div className="space-y-2 overflow-x-auto">
              {activitiesWithDates.map((activity) => {
                const barColor = categoryColors[activity.category] || categoryColors.Altro;
                const barWidth = ((activity.duration_days || 1) / totalDays) * 100;
                const barLeft = (activity.startDay / totalDays) * 100;

                return (
                  <div key={activity.id} className="flex items-center min-h-[36px]">
                    <div className="w-48 flex-shrink-0 pr-4">
                      <p className="text-sm font-medium truncate" title={activity.activity_name}>
                        {activity.activity_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {activity.duration_days}g • {activity.hours_worked}h
                      </p>
                    </div>
                    <div className="flex-1 relative h-8 bg-muted/30 rounded min-w-[500px]">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div
                              className={`absolute h-6 top-1 rounded ${barColor} opacity-80 hover:opacity-100 transition-opacity cursor-pointer`}
                              style={{
                                left: `${barLeft}%`,
                                width: `${Math.max(barWidth, 2)}%`,
                              }}
                            >
                              <span className="text-xs text-white font-medium px-2 truncate block leading-6">
                                {activity.activity_name}
                              </span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="space-y-1">
                              <p className="font-medium">{activity.activity_name}</p>
                              <p className="text-xs">
                                {format(activity.startDate, 'dd MMM yyyy', { locale: it })} - {format(activity.endDate, 'dd MMM yyyy', { locale: it })}
                              </p>
                              <p className="text-xs">Durata: {activity.duration_days} giorni • {activity.hours_worked}h</p>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>

                      {/* Today marker */}
                      {showTodayMarker && (
                        <div
                          className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10"
                          style={{ left: `${(todayPosition / totalDays) * 100}%` }}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Summary */}
            <div className="mt-6 pt-4 border-t border-border">
              <div className="flex flex-wrap gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Inizio:</span>{' '}
                  <span className="font-medium">{format(startDate, 'dd MMM yyyy', { locale: it })}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Fine prevista:</span>{' '}
                  <span className="font-medium">{format(endDate, 'dd MMM yyyy', { locale: it })}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Durata totale:</span>{' '}
                  <span className="font-medium">{totalDays} giorni</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Ore totali:</span>{' '}
                  <span className="font-medium">{activitiesWithDuration.reduce((sum, a) => sum + a.hours_worked, 0)}h</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
