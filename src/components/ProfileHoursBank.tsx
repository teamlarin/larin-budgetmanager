import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Clock, TrendingUp, ArrowLeftRight, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { calculateSafeHours } from '@/lib/timeUtils';
import { formatHours } from '@/lib/utils';
import { eachDayOfInterval, isWeekend, format, isSameDay, parseISO, endOfMonth, startOfYear, max as dateMax, min as dateMin, isAfter, isBefore } from 'date-fns';
import { it } from 'date-fns/locale';

interface ClosureDay {
  date: string;
  name: string;
  isRecurring: boolean;
}

interface ContractPeriod {
  start_date: string;
  end_date: string | null;
  contract_hours: number;
  contract_hours_period: string;
  contract_type: string;
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
  closureDayDefs.forEach(day => {
    if (day.isRecurring) {
      const [month, dayNum] = day.date.split('-');
      result.push(new Date(year, parseInt(month) - 1, parseInt(dayNum)));
    } else {
      const date = parseISO(day.date);
      if (date.getFullYear() === year) result.push(date);
    }
  });
  const easter = calculateEasterDate(year);
  const easterMonday = new Date(easter.getTime() + 24 * 60 * 60 * 1000);
  result.push(easter, easterMonday);
  return result;
}

function calculateWorkingDaysForInterval(from: Date, to: Date, closureDates: Date[]): number {
  const allDays = eachDayOfInterval({ start: from, end: to });
  return allDays.filter(day => {
    if (isWeekend(day)) return false;
    if (closureDates.some(cd => isSameDay(cd, day))) return false;
    return true;
  }).length;
}

const formatHoursDisplay = (hours: number) => formatHours(hours).replace('.', ',');

export const ProfileHoursBank = () => {
  const now = new Date();
  const year = now.getFullYear();
  const currentMonth = now.getMonth();
  const [closureDayDefs, setClosureDayDefs] = useState<ClosureDay[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserId(user.id);

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

  const closureDates = useMemo(() => getClosureDatesForYear(year, closureDayDefs), [year, closureDayDefs]);

  // Profile data
  const { data: profile } = useQuery({
    queryKey: ['profile-hours-bank-profile', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('contract_hours, contract_hours_period, contract_type')
        .eq('id', userId!)
        .single();
      return data;
    },
  });

  // Contract periods
  const { data: contractPeriods = [] } = useQuery({
    queryKey: ['profile-hours-bank-contracts', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from('user_contract_periods')
        .select('start_date, end_date, contract_hours, contract_hours_period, contract_type')
        .eq('user_id', userId!);
      return (data || []) as ContractPeriod[];
    },
  });

  // YTD confirmed hours by month
  const { data: monthlyConfirmed = {} } = useQuery({
    queryKey: ['profile-hours-bank-ytd', userId, year],
    enabled: !!userId,
    queryFn: async () => {
      const fromStr = `${year}-01-01`;
      const toStr = format(endOfMonth(new Date(year, currentMonth, 1)), 'yyyy-MM-dd');
      let allEntries: any[] = [];
      let offset = 0;
      let hasMore = true;
      while (hasMore) {
        const { data: page } = await supabase
          .from('activity_time_tracking')
          .select('actual_start_time, actual_end_time, scheduled_date')
          .eq('user_id', userId!)
          .gte('scheduled_date', fromStr)
          .lte('scheduled_date', toStr)
          .not('actual_start_time', 'is', null)
          .not('actual_end_time', 'is', null)
          .order('id')
          .range(offset, offset + 999);
        if (page && page.length > 0) {
          allEntries = [...allEntries, ...page];
          offset += 1000;
          hasMore = page.length === 1000;
        } else {
          hasMore = false;
        }
      }
      const map: Record<string, number> = {};
      allEntries.forEach(e => {
        if (e.actual_start_time && e.actual_end_time) {
          const hours = calculateSafeHours(e.actual_start_time, e.actual_end_time);
          const monthKey = e.scheduled_date.substring(0, 7);
          map[monthKey] = (map[monthKey] || 0) + hours;
        }
      });
      return map;
    },
  });

  // Adjustments
  const { data: adjustments = {} } = useQuery({
    queryKey: ['profile-hours-bank-adjustments', userId, year],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from('user_hours_adjustments' as any)
        .select('month, adjustment_hours, reason')
        .eq('user_id', userId!)
        .gte('month', `${year}-01-01`)
        .lte('month', `${year}-12-31`);
      const map: Record<string, number> = {};
      (data || []).forEach((row: any) => {
        const key = typeof row.month === 'string' ? row.month.substring(0, 7) : format(new Date(row.month), 'yyyy-MM');
        map[key] = Number(row.adjustment_hours);
      });
      return map;
    },
  });

  // Carryover
  const { data: carryover = 0 } = useQuery({
    queryKey: ['profile-hours-bank-carryover', userId, year],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from('user_hours_carryover' as any)
        .select('carryover_hours')
        .eq('user_id', userId!)
        .eq('year', year)
        .maybeSingle();
      return data ? Number((data as any).carryover_hours) : 0;
    },
  });

  // Calculate expected hours per month
  const getContractDataForDate = (date: Date): { hours: number; period: string } | null => {
    if (contractPeriods.length > 0) {
      for (const p of contractPeriods) {
        const pStart = parseISO(p.start_date);
        const pEnd = p.end_date ? parseISO(p.end_date) : new Date(2099, 11, 31);
        if (!isBefore(date, pStart) && !isAfter(date, pEnd)) {
          return { hours: Number(p.contract_hours), period: p.contract_hours_period };
        }
      }
      return null;
    }
    if (profile) {
      return { hours: Number(profile.contract_hours || 0), period: profile.contract_hours_period || 'monthly' };
    }
    return null;
  };

  const calculateContractWorkingDays = (intervalStart: Date, intervalEnd: Date): number => {
    if (contractPeriods.length === 0) {
      return calculateWorkingDaysForInterval(intervalStart, intervalEnd, closureDates);
    }
    let totalDays = 0;
    for (const p of contractPeriods) {
      const pStart = parseISO(p.start_date);
      const pEnd = p.end_date ? parseISO(p.end_date) : new Date(2099, 11, 31);
      const overlapStart = dateMax([intervalStart, pStart]);
      const overlapEnd = dateMin([intervalEnd, pEnd]);
      if (isAfter(overlapStart, overlapEnd)) continue;
      totalDays += calculateWorkingDaysForInterval(overlapStart, overlapEnd, closureDates);
    }
    return totalDays;
  };

  const calculateExpectedHoursForMonth = (monthStart: Date, monthEnd: Date): number => {
    const contractData = getContractDataForDate(monthStart);
    if (!contractData) return 0;
    const userDays = calculateContractWorkingDays(monthStart, monthEnd);
    if (userDays === 0) return 0;
    const totalMonthDays = calculateWorkingDaysForInterval(monthStart, monthEnd, closureDates);
    switch (contractData.period) {
      case 'daily': return contractData.hours * userDays;
      case 'weekly': return contractData.hours * (userDays / 5);
      case 'monthly': return totalMonthDays > 0 ? contractData.hours * (userDays / totalMonthDays) : 0;
      default: return totalMonthDays > 0 ? contractData.hours * (userDays / totalMonthDays) : 0;
    }
  };

  // Build monthly rows
  const rows = useMemo(() => {
    const result: { key: string; label: string; confirmed: number; adjustment: number; expected: number }[] = [];
    for (let m = 0; m <= currentMonth; m++) {
      const key = format(new Date(year, m, 1), 'yyyy-MM');
      const mStart = new Date(year, m, 1);
      const mEnd = endOfMonth(mStart);
      result.push({
        key,
        label: format(mStart, 'MMMM', { locale: it }),
        confirmed: monthlyConfirmed[key] || 0,
        adjustment: adjustments[key] || 0,
        expected: calculateExpectedHoursForMonth(mStart, mEnd),
      });
    }
    return result;
  }, [year, currentMonth, monthlyConfirmed, adjustments, closureDates, contractPeriods, profile]);

  const ytdConfirmed = rows.reduce((s, r) => s + r.confirmed + r.adjustment, 0);
  const ytdExpected = rows.reduce((s, r) => s + r.expected, 0);
  const ytdBalance = ytdConfirmed - ytdExpected + carryover;

  if (!userId) return null;

  const renderBalance = (value: number) => (
    <span className={`font-medium ${value > 0 ? 'text-primary' : value < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
      {value > 0 ? '+' : ''}{formatHoursDisplay(value)}
    </span>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Banca Ore {year}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-lg border bg-card p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">Ore Confermate</p>
            <p className="text-lg font-bold">{formatHoursDisplay(ytdConfirmed)}</p>
          </div>
          <div className="rounded-lg border bg-card p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">Ore Previste</p>
            <p className="text-lg font-bold">{formatHoursDisplay(ytdExpected)}</p>
          </div>
          <div className="rounded-lg border bg-card p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">Riporto</p>
            <p className="text-lg font-bold">{renderBalance(carryover)}</p>
          </div>
          <div className="rounded-lg border bg-card p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">Saldo Anno</p>
            <p className="text-lg font-bold">{renderBalance(ytdBalance)}</p>
          </div>
        </div>

        {/* Monthly table */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mese</TableHead>
              <TableHead className="text-right">Confermate</TableHead>
              <TableHead className="text-right">Rettifica</TableHead>
              <TableHead className="text-right">Totale</TableHead>
              <TableHead className="text-right">Previste</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(row => {
              const total = row.confirmed + row.adjustment;
              const balance = total - row.expected;
              return (
                <TableRow key={row.key}>
                  <TableCell className="capitalize text-sm">{row.label}</TableCell>
                  <TableCell className="text-right text-sm">{formatHours(row.confirmed)}</TableCell>
                  <TableCell className="text-right text-sm">
                    {row.adjustment !== 0 ? (
                      <span className={row.adjustment > 0 ? 'text-primary' : 'text-destructive'}>
                        {row.adjustment > 0 ? '+' : ''}{formatHoursDisplay(row.adjustment)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium">{formatHours(total)}</TableCell>
                  <TableCell className="text-right text-sm">{formatHours(row.expected)}</TableCell>
                  <TableCell className="text-right text-sm">{renderBalance(balance)}</TableCell>
                </TableRow>
              );
            })}
            {/* Totals row */}
            <TableRow className="font-bold border-t-2">
              <TableCell className="text-sm">Totale YTD</TableCell>
              <TableCell className="text-right text-sm">{formatHours(rows.reduce((s, r) => s + r.confirmed, 0))}</TableCell>
              <TableCell className="text-right text-sm">
                {rows.reduce((s, r) => s + r.adjustment, 0) !== 0
                  ? renderBalance(rows.reduce((s, r) => s + r.adjustment, 0))
                  : <span className="text-muted-foreground">—</span>
                }
              </TableCell>
              <TableCell className="text-right text-sm">{formatHours(ytdConfirmed)}</TableCell>
              <TableCell className="text-right text-sm">{formatHours(ytdExpected)}</TableCell>
              <TableCell className="text-right text-sm">{renderBalance(ytdConfirmed - ytdExpected)}</TableCell>
            </TableRow>
            {/* Carryover + final balance row */}
            {carryover !== 0 && (
              <TableRow className="font-bold">
                <TableCell className="text-sm" colSpan={5}>+ Riporto anno precedente</TableCell>
                <TableCell className="text-right text-sm">{renderBalance(carryover)}</TableCell>
              </TableRow>
            )}
            <TableRow className="font-bold bg-muted/30">
              <TableCell className="text-sm" colSpan={5}>Saldo Anno Finale</TableCell>
              <TableCell className="text-right text-sm text-base">{renderBalance(ytdBalance)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
