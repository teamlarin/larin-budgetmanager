import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { startOfWeek, endOfWeek, addWeeks, format, eachDayOfInterval, isWeekend } from 'date-fns';
import { it } from 'date-fns/locale';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Users, ArrowRight, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { calculateSafeHours } from '@/lib/timeUtils';
import { formatHours } from '@/lib/utils';

const EXCLUDED_AREAS = ['struttura', 'sales'];

const getAreaLabel = (area: string | null | undefined) => {
  if (!area) return '';
  const map: Record<string, string> = {
    tech: 'Tech', marketing: 'Marketing', branding: 'Branding',
    sales: 'Sales', struttura: 'Struttura', ai: 'AI',
  };
  return map[area] || area;
};

export const WorkloadSummaryWidget = () => {
  const navigate = useNavigate();
  const [weekOffset, setWeekOffset] = useState(0);

  const now = new Date();
  const weekStart = startOfWeek(addWeeks(now, weekOffset), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(addWeeks(now, weekOffset), { weekStartsOn: 1 });
  const weekLabel = `Settimana del ${format(weekStart, 'd MMM', { locale: it })}`;

  const { data, isLoading } = useQuery({
    queryKey: ['workload-weekly', weekOffset],
    queryFn: async () => {
      const fromStr = format(weekStart, 'yyyy-MM-dd');
      const toStr = format(weekEnd, 'yyyy-MM-dd');

      const { data: users } = await supabase
        .from('profiles')
        .select('id, full_name, first_name, last_name, contract_hours, contract_hours_period, title, area')
        .eq('approved', true)
        .is('deleted_at', null);

      if (!users) return [];

      // Paginated time entries
      let timeEntries: any[] = [];
      const pageSize = 1000;
      let offset = 0;
      let hasMore = true;
      while (hasMore) {
        const { data: page } = await supabase
          .from('activity_time_tracking')
          .select('user_id, scheduled_start_time, scheduled_end_time, actual_start_time, actual_end_time, scheduled_date')
          .gte('scheduled_date', fromStr)
          .lte('scheduled_date', toStr)
          .order('id')
          .range(offset, offset + pageSize - 1);
        if (page && page.length > 0) {
          timeEntries = [...timeEntries, ...page];
          offset += pageSize;
          hasMore = page.length === pageSize;
        } else {
          hasMore = false;
        }
      }

      const businessDays = eachDayOfInterval({ start: weekStart, end: weekEnd })
        .filter(day => !isWeekend(day)).length;

      const calculateCapacity = (hours: number, period: string) => {
        switch (period) {
          case 'daily': return hours * businessDays;
          case 'weekly': return hours;
          case 'monthly': return hours / 4;
          default: return hours / 4;
        }
      };

      const workloadMap: Record<string, any> = {};
      users.filter(u => !EXCLUDED_AREAS.includes(u.area || '')).forEach(user => {
        const fullName = user.full_name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Utente';
        const capacity = calculateCapacity(user.contract_hours || 0, user.contract_hours_period || 'monthly');
        workloadMap[user.id] = {
          userId: user.id, fullName, title: user.title, area: user.area,
          plannedHours: 0, confirmedHours: 0,
          capacityHours: Math.round(capacity * 10) / 10,
          utilizationPercentage: 0,
        };
      });

      timeEntries.forEach(entry => {
        if (!workloadMap[entry.user_id]) return;
        if (entry.scheduled_start_time && entry.scheduled_end_time) {
          workloadMap[entry.user_id].plannedHours += calculateSafeHours(entry.scheduled_start_time, entry.scheduled_end_time, true);
        }
        if (entry.actual_start_time && entry.actual_end_time) {
          workloadMap[entry.user_id].confirmedHours += calculateSafeHours(entry.actual_start_time, entry.actual_end_time);
        }
      });

      Object.values(workloadMap).forEach((u: any) => {
        u.plannedHours = Math.round(u.plannedHours * 10) / 10;
        u.confirmedHours = Math.round(u.confirmedHours * 10) / 10;
        u.utilizationPercentage = u.capacityHours > 0
          ? Math.round((u.plannedHours / u.capacityHours) * 100)
          : 0;
      });

      return Object.values(workloadMap).sort((a: any, b: any) => b.utilizationPercentage - a.utilizationPercentage);
    },
  });

  const users = (data || []) as any[];
  const overloadedUsers = users.filter(u => u.utilizationPercentage > 100);
  const totalPlanned = users.reduce((s, u) => s + u.plannedHours, 0);
  const totalConfirmed = users.reduce((s, u) => s + u.confirmedHours, 0);

  const getBarColor = (pct: number) => {
    if (pct > 100) return 'bg-destructive';
    if (pct >= 80) return 'bg-amber-500';
    if (pct < 50) return 'bg-blue-400';
    return 'bg-primary';
  };

  const getTextColor = (pct: number) => {
    if (pct > 100) return 'text-destructive';
    if (pct >= 80) return 'text-amber-600';
    if (pct < 50) return 'text-blue-500';
    return 'text-foreground';
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-5 w-5" />
            Carico di lavoro team
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center text-muted-foreground">
            Caricamento...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-5 w-5" />
            Carico di lavoro team
          </CardTitle>
          <CardDescription>{weekLabel}</CardDescription>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setWeekOffset(o => o - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setWeekOffset(0)} disabled={weekOffset === 0}>
            Oggi
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setWeekOffset(o => o + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate('/workload')} className="ml-2">
            Dettagli <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Summary stats */}
        <div className="grid grid-cols-4 gap-4 mb-4">
          <div className="text-center">
            <div className="text-2xl font-bold">{users.length}</div>
            <div className="text-xs text-muted-foreground">Utenti</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{formatHours(totalPlanned)}</div>
            <div className="text-xs text-muted-foreground">Pianificate</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{formatHours(totalConfirmed)}</div>
            <div className="text-xs text-muted-foreground">Confermate</div>
          </div>
          <div className="text-center">
            <div className={`text-2xl font-bold ${overloadedUsers.length > 0 ? 'text-destructive' : ''}`}>
              {overloadedUsers.length}
            </div>
            <div className="text-xs text-muted-foreground">Sovraccarichi</div>
          </div>
        </div>

        {/* Alert */}
        {overloadedUsers.length > 0 && (
          <div className="flex items-center gap-2 p-2 mb-4 rounded-md bg-destructive/10 text-destructive text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{overloadedUsers.map(u => u.fullName.split(' ')[0]).join(', ')} oltre capacità</span>
          </div>
        )}

        {/* User list */}
        <div className="space-y-3">
          {users.map((user) => {
            const pct = user.utilizationPercentage;
            const clampedPct = Math.min(pct, 100);
            return (
              <div key={user.userId} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-medium truncate">{user.fullName}</span>
                    {(user.title || user.area) && (
                      <span className="text-xs text-muted-foreground truncate hidden sm:inline">
                        {user.title}{user.title && user.area ? ' · ' : ''}{user.area ? getAreaLabel(user.area) : ''}
                      </span>
                    )}
                    {pct > 100 && (
                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">Sovraccarico</Badge>
                    )}
                    {pct < 50 && user.capacityHours > 0 && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-blue-500 border-blue-300">Scarico</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs whitespace-nowrap ml-2">
                    <span className="text-muted-foreground">{formatHours(user.plannedHours)}/{formatHours(user.capacityHours)}</span>
                    <span className={`font-semibold w-10 text-right ${getTextColor(pct)}`}>{pct}%</span>
                  </div>
                </div>
                <Progress
                  value={clampedPct}
                  className="h-2"
                  indicatorClassName={getBarColor(pct)}
                />
              </div>
            );
          })}
        </div>

        {users.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">Nessun utente trovato</p>
        )}
      </CardContent>
    </Card>
  );
};
