import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { startOfWeek, endOfWeek, addWeeks, format, eachDayOfInterval, isWeekend, startOfMonth, endOfMonth, isSameDay, parseISO, isAfter, isBefore, max as dateMax, min as dateMin } from 'date-fns';
import { it } from 'date-fns/locale';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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

// --- Closure days helpers ---
interface ClosureDay {
  date: string;
  name: string;
  isRecurring: boolean;
}

function calculateEasterDate(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function getClosureDatesForYear(year: number, closureDayDefs: ClosureDay[]): Date[] {
  const result: Date[] = [];
  closureDayDefs.forEach(d => {
    if (d.isRecurring) {
      const [month, dayNum] = d.date.split('-');
      result.push(new Date(year, parseInt(month) - 1, parseInt(dayNum)));
    } else {
      const date = parseISO(d.date);
      if (date.getFullYear() === year) result.push(date);
    }
  });
  const easter = calculateEasterDate(year);
  result.push(easter);
  result.push(new Date(easter.getTime() + 24 * 60 * 60 * 1000)); // Easter Monday
  return result;
}

function calculateWorkingDaysForInterval(from: Date, to: Date, closureDates: Date[]): number {
  return eachDayOfInterval({ start: from, end: to }).filter(day => {
    if (isWeekend(day)) return false;
    if (closureDates.some(cd => isSameDay(cd, day))) return false;
    return true;
  }).length;
}

interface ContractPeriod {
  user_id: string;
  start_date: string;
  end_date: string | null;
  contract_hours: number;
  contract_hours_period: string;
  contract_type: string;
}

interface WorkloadSummaryWidgetProps {
  filterUserIds?: string[];
}

export const WorkloadSummaryWidget = ({ filterUserIds }: WorkloadSummaryWidgetProps = {}) => {
  const navigate = useNavigate();
  const [weekOffset, setWeekOffset] = useState(0);
  const [closureDayDefs, setClosureDayDefs] = useState<ClosureDay[]>([]);

  const now = new Date();
  const weekStart = startOfWeek(addWeeks(now, weekOffset), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(addWeeks(now, weekOffset), { weekStartsOn: 1 });
  const weekLabel = `${format(weekStart, 'd MMM', { locale: it })} – ${format(weekEnd, 'd MMM yyyy', { locale: it })}`;

  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const monthLabel = format(now, 'MMMM yyyy', { locale: it });

  // Load closure days
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('*')
        .eq('setting_key', 'closure_days')
        .maybeSingle();
      if (data?.setting_value) {
        const value = data.setting_value as unknown as { closureDays: ClosureDay[] };
        setClosureDayDefs(value.closureDays || []);
      }
    };
    load();
  }, []);

  const closureDates = useMemo(() => {
    return getClosureDatesForYear(now.getFullYear(), closureDayDefs);
  }, [now.getFullYear(), closureDayDefs]);

  // Weekly workload query
  const { data, isLoading } = useQuery({
    queryKey: ['workload-weekly', weekOffset, filterUserIds?.join(',')],
    queryFn: async () => {
      const fromStr = format(weekStart, 'yyyy-MM-dd');
      const toStr = format(weekEnd, 'yyyy-MM-dd');

      let usersQuery = supabase
        .from('profiles')
        .select('id, full_name, first_name, last_name, contract_hours, contract_hours_period, contract_type, title, area, level_id, levels:level_id(name)')
        .eq('approved', true)
        .is('deleted_at', null);

      if (filterUserIds && filterUserIds.length > 0) {
        usersQuery = usersQuery.in('id', filterUserIds);
      }

      const { data: users } = await usersQuery;
      if (!users) return [];

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
        const levelName = (user as any).levels?.name || null;
        workloadMap[user.id] = {
          userId: user.id, fullName, title: user.title, area: user.area,
          levelName,
          contractType: user.contract_type || 'full-time',
          contractHours: user.contract_hours || 0,
          contractHoursPeriod: user.contract_hours_period || 'monthly',
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

  // Monthly confirmed hours query
  const { data: monthlyHoursData } = useQuery({
    queryKey: ['workload-monthly-confirmed', format(monthStart, 'yyyy-MM'), filterUserIds?.join(',')],
    queryFn: async () => {
      const fromStr = format(monthStart, 'yyyy-MM-dd');
      const toStr = format(monthEnd, 'yyyy-MM-dd');

      let allEntries: any[] = [];
      const pageSize = 1000;
      let offset = 0;
      let hasMore = true;
      while (hasMore) {
        const { data: page } = await supabase
          .from('activity_time_tracking')
          .select('user_id, actual_start_time, actual_end_time, budget_items:budget_item_id(activity_name, projects:project_id(name))')
          .gte('scheduled_date', fromStr)
          .lte('scheduled_date', toStr)
          .not('actual_start_time', 'is', null)
          .not('actual_end_time', 'is', null)
          .order('id')
          .range(offset, offset + pageSize - 1);
        if (page && page.length > 0) {
          allEntries = [...allEntries, ...page];
          offset += pageSize;
          hasMore = page.length === pageSize;
        } else {
          hasMore = false;
        }
      }

      const hoursMap: Record<string, { confirmed: number; bancaOre: number }> = {};
      allEntries.forEach(e => {
        if (!e.actual_start_time || !e.actual_end_time) return;
        const hours = calculateSafeHours(e.actual_start_time, e.actual_end_time);
        const projectName = (e.budget_items as any)?.projects?.name || '';
        const activityName = (e.budget_items as any)?.activity_name || '';
        const isOffProject = /off/i.test(projectName);

        if (!hoursMap[e.user_id]) hoursMap[e.user_id] = { confirmed: 0, bancaOre: 0 };

        if (isOffProject && /banca\s*ore/i.test(activityName)) {
          hoursMap[e.user_id].bancaOre += hours;
          return;
        }
        if (isOffProject) {
          // Still count as confirmed for non-banca-ore OFF entries
          hoursMap[e.user_id].confirmed += hours;
          return;
        }
        hoursMap[e.user_id].confirmed += hours;
      });
      return hoursMap;
    },
  });

  // Contract periods query
  const { data: contractPeriods = [] } = useQuery({
    queryKey: ['workload-contract-periods'],
    queryFn: async () => {
      const { data } = await supabase
        .from('user_contract_periods')
        .select('user_id, start_date, end_date, contract_hours, contract_hours_period, contract_type');
      return (data || []) as ContractPeriod[];
    },
  });

  // Adjustments query for current month
  const { data: adjustmentsMap = {} } = useQuery({
    queryKey: ['workload-month-adjustments', format(monthStart, 'yyyy-MM')],
    queryFn: async () => {
      const monthKey = format(monthStart, 'yyyy-MM-dd');
      const { data } = await supabase
        .from('user_hours_adjustments' as any)
        .select('user_id, adjustment_hours')
        .eq('month', monthKey);
      const map: Record<string, number> = {};
      (data || []).forEach((row: any) => { map[row.user_id] = Number(row.adjustment_hours); });
      return map;
    },
  });

  const contractPeriodsMap = useMemo(() => {
    const map: Record<string, ContractPeriod[]> = {};
    contractPeriods.forEach(cp => {
      if (!map[cp.user_id]) map[cp.user_id] = [];
      map[cp.user_id].push(cp);
    });
    return map;
  }, [contractPeriods]);

  const calculateContractWorkingDays = (userId: string, intervalStart: Date, intervalEnd: Date): number => {
    const periods = contractPeriodsMap[userId];
    if (!periods || periods.length === 0) {
      return calculateWorkingDaysForInterval(intervalStart, intervalEnd, closureDates);
    }
    let totalDays = 0;
    for (const period of periods) {
      const pStart = parseISO(period.start_date);
      const pEnd = period.end_date ? parseISO(period.end_date) : new Date(2099, 11, 31);
      const overlapStart = dateMax([intervalStart, pStart]);
      const overlapEnd = dateMin([intervalEnd, pEnd]);
      if (isAfter(overlapStart, overlapEnd)) continue;
      totalDays += calculateWorkingDaysForInterval(overlapStart, overlapEnd, closureDates);
    }
    return totalDays;
  };

  const getContractDataForDate = (userId: string, contractHours: number, contractPeriod: string, date: Date): { hours: number; period: string } => {
    const periods = contractPeriodsMap[userId];
    if (!periods || periods.length === 0) {
      return { hours: contractHours, period: contractPeriod };
    }
    for (const period of periods) {
      const pStart = parseISO(period.start_date);
      const pEnd = period.end_date ? parseISO(period.end_date) : new Date(2099, 11, 31);
      if (!isBefore(date, pStart) && !isAfter(date, pEnd)) {
        return { hours: Number(period.contract_hours), period: period.contract_hours_period };
      }
    }
    return { hours: contractHours, period: contractPeriod };
  };

  const calculateExpectedHours = (userId: string, contractHours: number, contractPeriod: string, contractType: string): number => {
    if (contractType === 'consuntivo') return 0;
    const contractData = getContractDataForDate(userId, contractHours, contractPeriod, monthStart);
    const userDays = calculateContractWorkingDays(userId, monthStart, monthEnd);
    if (userDays === 0) return 0;
    const totalMonthDays = calculateWorkingDaysForInterval(monthStart, monthEnd, closureDates);
    switch (contractData.period) {
      case 'daily': return contractData.hours * userDays;
      case 'weekly': return contractData.hours * (userDays / 5);
      case 'monthly': return totalMonthDays > 0 ? contractData.hours * (userDays / totalMonthDays) : 0;
      default: return totalMonthDays > 0 ? contractData.hours * (userDays / totalMonthDays) : 0;
    }
  };

  const users = (data || []) as any[];
  const overloadedUsers = users.filter(u => u.utilizationPercentage > 100);
  const usersWithCapacity = users.filter(u => u.capacityHours > 0);
  const avgPlanning = usersWithCapacity.length > 0
    ? Math.round(usersWithCapacity.reduce((s, u) => s + u.utilizationPercentage, 0) / usersWithCapacity.length)
    : 0;
  const totalFreeHours = users.reduce((s, u) => s + Math.max(0, u.capacityHours - u.plannedHours), 0);

  // Calculate monthly balance per user
  const monthlyBalanceMap = useMemo(() => {
    const map: Record<string, { confirmed: number; expected: number; balance: number; isConsuntivo: boolean }> = {};
    users.forEach((u: any) => {
      const monthHours = monthlyHoursData?.[u.userId] || { confirmed: 0, bancaOre: 0 };
      const isConsuntivo = u.contractType === 'consuntivo';
      const expected = calculateExpectedHours(u.userId, u.contractHours, u.contractHoursPeriod, u.contractType);
      const adj = adjustmentsMap[u.userId] || 0;
      const confirmed = monthHours.confirmed + adj;
      const balance = confirmed - expected - monthHours.bancaOre;
      map[u.userId] = { confirmed, expected, balance: Math.round(balance * 10) / 10, isConsuntivo };
    });
    return map;
  }, [users, monthlyHoursData, adjustmentsMap, closureDates, contractPeriodsMap]);

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

  const getBalanceColor = (balance: number) => {
    if (balance < -5) return 'text-destructive';
    if (balance < 0) return 'text-amber-600';
    if (balance > 5) return 'text-emerald-600';
    return 'text-muted-foreground';
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
            <div className="text-2xl font-bold">{avgPlanning}%</div>
            <div className="text-xs text-muted-foreground">% Pianificazione</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{formatHours(totalFreeHours)}</div>
            <div className="text-xs text-muted-foreground">Ore libere</div>
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
            const mb = monthlyBalanceMap[user.userId];
            return (
              <div key={user.userId} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-medium truncate">{user.fullName}</span>
                     {(user.title || user.area || user.levelName) && (
                      <span className="text-xs text-muted-foreground truncate hidden sm:inline">
                        {user.title}{user.title && (user.area || user.levelName) ? ' · ' : ''}
                        {user.area ? getAreaLabel(user.area) : ''}
                        {user.area && user.levelName ? ' · ' : ''}
                        {user.levelName || ''}
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
                    {mb && !mb.isConsuntivo && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className={`font-medium ${getBalanceColor(mb.balance)}`}>
                              {mb.balance >= 0 ? '+' : ''}{formatHours(mb.balance)}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            <p className="text-xs">
                              Saldo {monthLabel}: {formatHours(mb.confirmed)} confermate / {formatHours(mb.expected)} previste
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
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
