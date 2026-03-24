import React, { useEffect, useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { calculateSafeHours } from '@/lib/timeUtils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Clock, Users, Download, ChevronLeft, ChevronRight, Filter, TrendingUp, ChevronDown, ChevronUp, Pencil } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { eachDayOfInterval, isWeekend, format, isSameDay, parseISO, startOfMonth, endOfMonth, subMonths, addMonths, startOfYear, max as dateMax, min as dateMin, isAfter, isBefore } from 'date-fns';
import { it } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { formatHours } from '@/lib/utils';
import { UserMonthlyDetail } from './UserMonthlyDetail';

interface ClosureDay {
  date: string;
  name: string;
  isRecurring: boolean;
}

interface ClosureDaysSettings {
  closureDays: ClosureDay[];
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
  result.push(easter);
  result.push(easterMonday);
  return result;
}

interface UserHoursData {
  id: string;
  name: string;
  confirmedHours: number;
  billableHours: number;
  actualProductivity: number;
  targetProductivity: number;
  contractHours: number;
  contractType: string;
  contractHoursPeriod: string;
}

interface ContractPeriod {
  user_id: string;
  start_date: string;
  end_date: string | null;
  contract_hours: number;
  contract_hours_period: string;
  contract_type: string;
}

type ContractFilter = 'all' | 'employees' | 'freelance' | 'consuntivo';

const EXCLUDED_AREAS = ['struttura', 'sales'];

function calculateWorkingDaysForInterval(from: Date, to: Date, closureDates: Date[]): number {
  const allDays = eachDayOfInterval({ start: from, end: to });
  return allDays.filter(day => {
    if (isWeekend(day)) return false;
    if (closureDates.some(cd => isSameDay(cd, day))) return false;
    return true;
  }).length;
}

export const UserHoursSummary = () => {
  const { toast } = useToast();
  const [closureDayDefs, setClosureDayDefs] = useState<ClosureDay[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<Date>(startOfMonth(new Date()));
  const [exporting, setExporting] = useState<string | null>(null);
  const [contractFilter, setContractFilter] = useState<ContractFilter>('all');
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);

  const dateFrom = selectedMonth;
  const dateTo = endOfMonth(selectedMonth);
  const yearStart = startOfYear(selectedMonth);

  // Compute closure dates for the year
  const closureDates = useMemo(() => {
    const year = selectedMonth.getFullYear();
    return getClosureDatesForYear(year, closureDayDefs);
  }, [selectedMonth, closureDayDefs]);

  // Self-contained data fetching
  const { data: usersData = [] } = useQuery({
    queryKey: ['user-hours-summary-widget', format(selectedMonth, 'yyyy-MM')],
    queryFn: async () => {
      const fromDateStr = format(dateFrom, 'yyyy-MM-dd');
      const toDateStr = format(dateTo, 'yyyy-MM-dd');

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, area, contract_type, contract_hours, contract_hours_period, target_productivity_percentage')
        .eq('approved', true)
        .is('deleted_at', null);

      let allTimeEntries: any[] = [];
      const pageSize = 1000;
      let offset = 0;
      let hasMore = true;
      while (hasMore) {
        const { data: page } = await supabase
          .from('activity_time_tracking')
          .select('user_id, scheduled_start_time, scheduled_end_time, actual_start_time, actual_end_time, budget_items(project_id, activity_name, projects:project_id(is_billable, name))')
          .gte('scheduled_date', fromDateStr)
          .lte('scheduled_date', toDateStr)
          .not('actual_start_time', 'is', null)
          .not('actual_end_time', 'is', null)
          .order('id')
          .range(offset, offset + pageSize - 1);
        if (page && page.length > 0) {
          allTimeEntries = [...allTimeEntries, ...page];
          offset += pageSize;
          hasMore = page.length === pageSize;
        } else {
          hasMore = false;
        }
      }

      // Build contract type map from profiles
      const contractTypeMap: Record<string, string> = {};
      profiles?.forEach(p => { contractTypeMap[p.id] = p.contract_type || 'full-time'; });

      const userHoursMap: Record<string, { total: number; billable: number; bancaOre: number }> = {};
      allTimeEntries.forEach(e => {
        if (e.actual_start_time && e.actual_end_time) {
          const hours = calculateSafeHours(e.actual_start_time, e.actual_end_time);
          const projectName = e.budget_items?.projects?.name || '';
          const activityName = e.budget_items?.activity_name || '';
          const isOffProject = /off/i.test(projectName);
          const userContractType = contractTypeMap[e.user_id] || 'full-time';
          const isNonEmployee = userContractType === 'freelance' || userContractType === 'consuntivo';

          // Skip all OFF hours for freelance/consuntivo
          if (isOffProject && isNonEmployee) return;

          if (!userHoursMap[e.user_id]) {
            userHoursMap[e.user_id] = { total: 0, billable: 0, bancaOre: 0 };
          }

          // Track banca ore separately for employees
          if (isOffProject && /banca\s*ore/i.test(activityName)) {
            userHoursMap[e.user_id].bancaOre += hours;
            return;
          }

          userHoursMap[e.user_id].total += hours;
          if (e.budget_items?.projects?.is_billable) {
            userHoursMap[e.user_id].billable += hours;
          }
        }
      });

      return (profiles?.filter(profile => !EXCLUDED_AREAS.includes(profile.area || '')).map(profile => {
        const hours = userHoursMap[profile.id] || { total: 0, billable: 0 };
        const actualProductivity = hours.total > 0 ? Math.round((hours.billable / hours.total) * 100) : 0;
        const targetProductivity = profile.target_productivity_percentage ?? 80;
        return {
          id: profile.id,
          name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Utente',
          confirmedHours: hours.total,
          billableHours: hours.billable,
          actualProductivity,
          targetProductivity,
          contractHours: Number(profile.contract_hours || 0),
          contractType: profile.contract_type || 'full-time',
          contractHoursPeriod: profile.contract_hours_period || 'monthly'
        };
      }).sort((a, b) => b.confirmedHours - a.confirmedHours)) || [];
    },
  });

  // YTD query: confirmed hours from Jan 1 to end of selected month, with scheduled_date for monthly grouping
  const { data: ytdData = { totals: {}, monthly: {} } } = useQuery({
    queryKey: ['user-hours-ytd', format(selectedMonth, 'yyyy-MM')],
    queryFn: async () => {
      const fromDateStr = format(yearStart, 'yyyy-MM-dd');
      const toDateStr = format(dateTo, 'yyyy-MM-dd');

      let allTimeEntries: any[] = [];
      const pageSize = 1000;
      let offset = 0;
      let hasMore = true;
      while (hasMore) {
        const { data: page } = await supabase
          .from('activity_time_tracking')
          .select('user_id, actual_start_time, actual_end_time, scheduled_date')
          .gte('scheduled_date', fromDateStr)
          .lte('scheduled_date', toDateStr)
          .not('actual_start_time', 'is', null)
          .not('actual_end_time', 'is', null)
          .order('id')
          .range(offset, offset + pageSize - 1);
        if (page && page.length > 0) {
          allTimeEntries = [...allTimeEntries, ...page];
          offset += pageSize;
          hasMore = page.length === pageSize;
        } else {
          hasMore = false;
        }
      }

      const totals: Record<string, number> = {};
      // monthly[userId][yyyy-MM] = hours
      const monthly: Record<string, Record<string, number>> = {};
      allTimeEntries.forEach(e => {
        if (e.actual_start_time && e.actual_end_time) {
          const hours = calculateSafeHours(e.actual_start_time, e.actual_end_time);
          totals[e.user_id] = (totals[e.user_id] || 0) + hours;
          if (e.scheduled_date) {
            const monthKey = e.scheduled_date.substring(0, 7); // yyyy-MM
            if (!monthly[e.user_id]) monthly[e.user_id] = {};
            monthly[e.user_id][monthKey] = (monthly[e.user_id][monthKey] || 0) + hours;
          }
        }
      });
      return { totals, monthly };
    },
  });

  const ytdHoursMap = ytdData.totals;
  const ytdMonthlyMap = ytdData.monthly;

  // Load adjustments for the year
  const { data: adjustmentsMap = {} } = useQuery({
    queryKey: ['user-hours-adjustments', selectedMonth.getFullYear()],
    queryFn: async () => {
      const yearStr = `${selectedMonth.getFullYear()}-01-01`;
      const yearEndStr = `${selectedMonth.getFullYear()}-12-31`;
      const { data } = await supabase
        .from('user_hours_adjustments' as any)
        .select('user_id, month, adjustment_hours, reason')
        .gte('month', yearStr)
        .lte('month', yearEndStr);

      // keyed by `userId:yyyy-MM`
      const map: Record<string, { hours: number; reason: string | null }> = {};
      (data || []).forEach((row: any) => {
        const monthKey = typeof row.month === 'string' ? row.month.substring(0, 7) : format(new Date(row.month), 'yyyy-MM');
        map[`${row.user_id}:${monthKey}`] = { hours: Number(row.adjustment_hours), reason: row.reason };
      });
      return map;
    },
  });

  // Load carryover for the year
  const queryClient = useQueryClient();
  const { data: carryoverMap = {} } = useQuery({
    queryKey: ['user-hours-carryover', selectedMonth.getFullYear()],
    queryFn: async () => {
      const year = selectedMonth.getFullYear();
      const { data } = await supabase
        .from('user_hours_carryover' as any)
        .select('user_id, carryover_hours, notes')
        .eq('year', year);

      const map: Record<string, { hours: number; notes: string | null }> = {};
      (data || []).forEach((row: any) => {
        map[row.user_id] = { hours: Number(row.carryover_hours), notes: row.notes };
      });
      return map;
    },
  });

  // Carryover edit state
  const [editingCarryoverUserId, setEditingCarryoverUserId] = useState<string | null>(null);
  const [editingCarryoverUserName, setEditingCarryoverUserName] = useState('');
  const [carryoverHours, setCarryoverHours] = useState('');
  const [carryoverNotes, setCarryoverNotes] = useState('');
  const [savingCarryover, setSavingCarryover] = useState(false);


  const { data: contractPeriods = [] } = useQuery({
    queryKey: ['user-contract-periods', selectedMonth.getFullYear()],
    queryFn: async () => {
      const { data } = await supabase
        .from('user_contract_periods')
        .select('user_id, start_date, end_date, contract_hours, contract_hours_period, contract_type');
      return (data || []) as ContractPeriod[];
    },
  });

  // Group contract periods by user
  const contractPeriodsMap = useMemo(() => {
    const map: Record<string, ContractPeriod[]> = {};
    contractPeriods.forEach(cp => {
      if (!map[cp.user_id]) map[cp.user_id] = [];
      map[cp.user_id].push(cp);
    });
    return map;
  }, [contractPeriods]);

  // Calculate working days for a user in a given interval, considering their contract periods
  const calculateContractWorkingDays = (userId: string, intervalStart: Date, intervalEnd: Date): number => {
    const periods = contractPeriodsMap[userId];
    if (!periods || periods.length === 0) {
      // No contract periods defined, use full interval (backwards compatible)
      return calculateWorkingDaysForInterval(intervalStart, intervalEnd, closureDates);
    }

    let totalDays = 0;
    for (const period of periods) {
      const pStart = parseISO(period.start_date);
      const pEnd = period.end_date ? parseISO(period.end_date) : new Date(2099, 11, 31);

      // Overlap between interval and contract period
      const overlapStart = dateMax([intervalStart, pStart]);
      const overlapEnd = dateMin([intervalEnd, pEnd]);

      if (isAfter(overlapStart, overlapEnd)) continue;

      totalDays += calculateWorkingDaysForInterval(overlapStart, overlapEnd, closureDates);
    }
    return totalDays;
  };

  // Get contract data for a user at a given date (from contract periods, fallback to profile)
  const getContractDataForDate = (user: UserHoursData, date: Date): { hours: number; period: string } | null => {
    const periods = contractPeriodsMap[user.id];
    if (!periods || periods.length === 0) {
      return { hours: user.contractHours, period: user.contractHoursPeriod };
    }
    for (const period of periods) {
      const pStart = parseISO(period.start_date);
      const pEnd = period.end_date ? parseISO(period.end_date) : new Date(2099, 11, 31);
      if (!isBefore(date, pStart) && !isAfter(date, pEnd)) {
        return { hours: Number(period.contract_hours), period: period.contract_hours_period };
      }
    }
    return null; // No active contract at this date
  };

  useEffect(() => {
    const loadClosureDays = async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('*')
        .eq('setting_key', 'closure_days')
        .maybeSingle();

      if (data?.setting_value) {
        const value = data.setting_value as unknown as ClosureDaysSettings;
        setClosureDayDefs(value.closureDays || []);
      }
    };
    loadClosureDays();
  }, []);

  // Load user role
  useEffect(() => {
    const loadRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);
      if (roles && roles.length > 0) {
        setUserRole(roles[0].role);
      }
    };
    loadRole();
  }, []);

  const formatHoursDisplay = (hours: number) => formatHours(hours).replace('.', ',');

  const getPercentage = (confirmed: number, contract: number) => {
    if (contract === 0) return 0;
    return Math.min((confirmed / contract) * 100, 100);
  };

  const getContractTypeLabel = (type: string) => {
    switch (type) {
      case 'full-time': return 'Dipendente FT';
      case 'part-time': return 'Dipendente PT';
      case 'freelance': return 'Freelance';
      case 'consuntivo': return 'Consuntivo';
      default: return type;
    }
  };

  const workingDays = useMemo(() => {
    return calculateWorkingDaysForInterval(dateFrom, dateTo, closureDates);
  }, [dateFrom, dateTo, closureDates]);

  const calculateExpectedHoursForUser = (user: UserHoursData, monthStart: Date, monthEnd: Date) => {
    // Consuntivo users have no expected hours
    if (user.contractType === 'consuntivo') return 0;
    const contractData = getContractDataForDate(user, monthStart);
    if (!contractData) return 0; // No active contract

    const userDays = calculateContractWorkingDays(user.id, monthStart, monthEnd);
    if (userDays === 0) return 0;

    const totalMonthDays = calculateWorkingDaysForInterval(monthStart, monthEnd, closureDates);

    switch (contractData.period) {
      case 'daily': return contractData.hours * userDays;
      case 'weekly': return contractData.hours * (userDays / 5);
      case 'monthly': return totalMonthDays > 0 ? contractData.hours * (userDays / totalMonthDays) : 0;
      default: return totalMonthDays > 0 ? contractData.hours * (userDays / totalMonthDays) : 0;
    }
  };

  // Calculate YTD expected hours: iterate each month from Jan to selected month
  const monthlyWorkingDaysArr = useMemo(() => {
    const year = selectedMonth.getFullYear();
    const endMonthIndex = selectedMonth.getMonth();
    const arr: { key: string; start: Date; end: Date; days: number }[] = [];
    for (let m = 0; m <= endMonthIndex; m++) {
      const mStart = new Date(year, m, 1);
      const mEnd = endOfMonth(mStart);
      arr.push({ key: format(mStart, 'yyyy-MM'), start: mStart, end: mEnd, days: calculateWorkingDaysForInterval(mStart, mEnd, closureDates) });
    }
    return arr;
  }, [selectedMonth, closureDates]);

  const calculateYtdExpectedHours = useMemo(() => {
    return (user: UserHoursData) => {
      let total = 0;
      for (const { start, end } of monthlyWorkingDaysArr) {
        total += calculateExpectedHoursForUser(user, start, end);
      }
      return total;
    };
  }, [monthlyWorkingDaysArr, contractPeriodsMap]);

  // Monthly expected hours map per user (for sub-component)
  const getMonthlyExpectedMap = (user: UserHoursData): Record<string, number> => {
    const map: Record<string, number> = {};
    for (const { key, start, end } of monthlyWorkingDaysArr) {
      map[key] = calculateExpectedHoursForUser(user, start, end);
    }
    return map;
  };

  // Get user adjustments map for sub-component
  const getUserAdjustmentsMap = (userId: string): Record<string, { hours: number; reason: string | null }> => {
    const map: Record<string, { hours: number; reason: string | null }> = {};
    const endMonthIndex = selectedMonth.getMonth();
    const year = selectedMonth.getFullYear();
    for (let m = 0; m <= endMonthIndex; m++) {
      const key = format(new Date(year, m, 1), 'yyyy-MM');
      const adj = adjustmentsMap[`${userId}:${key}`];
      if (adj) map[key] = adj;
    }
    return map;
  };

  // Total YTD adjustments per user
  const getUserYtdAdjustment = (userId: string): number => {
    let total = 0;
    const endMonthIndex = selectedMonth.getMonth();
    const year = selectedMonth.getFullYear();
    for (let m = 0; m <= endMonthIndex; m++) {
      const key = format(new Date(year, m, 1), 'yyyy-MM');
      const adj = adjustmentsMap[`${userId}:${key}`];
      if (adj) total += adj.hours;
    }
    return total;
  };

  // Current month adjustment
  const getUserMonthAdjustment = (userId: string): number => {
    const key = format(selectedMonth, 'yyyy-MM');
    return adjustmentsMap[`${userId}:${key}`]?.hours || 0;
  };

  const openCarryoverEdit = (userId: string, userName: string) => {
    const existing = carryoverMap[userId];
    setCarryoverHours(existing ? String(existing.hours) : '0');
    setCarryoverNotes(existing?.notes || '');
    setEditingCarryoverUserId(userId);
    setEditingCarryoverUserName(userName);
  };

  const handleSaveCarryover = async () => {
    if (!editingCarryoverUserId) return;
    setSavingCarryover(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non autenticato');

      const hours = parseFloat(carryoverHours) || 0;
      const { error } = await supabase
        .from('user_hours_carryover' as any)
        .upsert({
          user_id: editingCarryoverUserId,
          year: selectedMonth.getFullYear(),
          carryover_hours: hours,
          notes: carryoverNotes.trim() || null,
          created_by: user.id,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,year' });

      if (error) throw error;
      toast({ title: 'Riporto salvato', description: `Riporto per ${editingCarryoverUserName} aggiornato` });
      queryClient.invalidateQueries({ queryKey: ['user-hours-carryover'] });
      setEditingCarryoverUserId(null);
    } catch (err: any) {
      console.error('Carryover save error:', err);
      toast({ title: 'Errore', description: err.message || 'Impossibile salvare il riporto', variant: 'destructive' });
    } finally {
      setSavingCarryover(false);
    }
  };

  const filteredUsersData = usersData.filter(user => {
    if (contractFilter === 'all') return true;
    if (contractFilter === 'employees') return user.contractType === 'full-time' || user.contractType === 'part-time';
    if (contractFilter === 'freelance') return user.contractType === 'freelance';
    if (contractFilter === 'consuntivo') return user.contractType === 'consuntivo';
    return true;
  });

  const canEditAdjustments = userRole === 'admin' || userRole === 'finance';

  const usersWithExpectedHours = filteredUsersData.map(user => {
    const monthAdj = getUserMonthAdjustment(user.id);
    const ytdAdj = getUserYtdAdjustment(user.id);
    const carryover = carryoverMap[user.id]?.hours || 0;
    return {
      ...user,
      expectedHours: calculateExpectedHoursForUser(user, dateFrom, dateTo),
      ytdConfirmed: (ytdHoursMap[user.id] || 0) + ytdAdj,
      ytdExpected: calculateYtdExpectedHours(user),
      monthAdjustment: monthAdj,
      carryover,
    };
  });

  const totalConfirmed = usersWithExpectedHours.reduce((sum, u) => sum + u.confirmedHours + u.monthAdjustment, 0);
  const totalExpected = usersWithExpectedHours.reduce((sum, u) => sum + u.expectedHours, 0);
  const totalCarryover = usersWithExpectedHours.reduce((sum, u) => sum + u.carryover, 0);
  const totalYtdBalance = usersWithExpectedHours.reduce((sum, u) => sum + (u.ytdConfirmed - u.ytdExpected + u.carryover), 0);

  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const date = subMonths(new Date(), i);
    return { value: format(date, 'yyyy-MM'), label: format(date, 'MMMM yyyy', { locale: it }) };
  });

  const handleMonthChange = (value: string) => {
    const [year, month] = value.split('-').map(Number);
    setSelectedMonth(new Date(year, month - 1, 1));
  };

  const handlePrevMonth = () => setSelectedMonth(startOfMonth(subMonths(selectedMonth, 1)));
  const handleNextMonth = () => setSelectedMonth(startOfMonth(addMonths(selectedMonth, 1)));

  const isCurrentMonth = format(selectedMonth, 'yyyy-MM') === format(new Date(), 'yyyy-MM');

  const handleExportUser = async (user: typeof usersWithExpectedHours[0]) => {
    setExporting(user.id);
    try {
      const fromDateStr = format(dateFrom, 'yyyy-MM-dd');
      const toDateStr = format(dateTo, 'yyyy-MM-dd');

      const { data: timeEntries, error } = await supabase
        .from('activity_time_tracking')
        .select(`*, budget_items(activity_name, category, projects:project_id(name))`)
        .eq('user_id', user.id)
        .gte('scheduled_date', fromDateStr)
        .lte('scheduled_date', toDateStr)
        .not('actual_start_time', 'is', null)
        .not('actual_end_time', 'is', null)
        .order('scheduled_date', { ascending: true });

      if (error) throw error;

      const headers = ['Data', 'Progetto', 'Attività', 'Categoria', 'Ora Inizio', 'Ora Fine', 'Ore', 'Note'];
      const rows = timeEntries?.map(entry => {
        const startTime = entry.actual_start_time ? new Date(entry.actual_start_time) : null;
        const endTime = entry.actual_end_time ? new Date(entry.actual_end_time) : null;
        const hours = startTime && endTime
          ? calculateSafeHours(entry.actual_start_time!, entry.actual_end_time!).toFixed(2)
          : '0';
        return [
          entry.scheduled_date || '', entry.budget_items?.projects?.name || '',
          entry.budget_items?.activity_name || '', entry.budget_items?.category || '',
          startTime ? format(startTime, 'HH:mm') : '', endTime ? format(endTime, 'HH:mm') : '',
          hours, entry.notes || ''
        ].map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',');
      }) || [];

      rows.push('');
      rows.push(`"Totale ore confermate","","","","","","${formatHours(user.confirmedHours)}",""`);
      rows.push(`"Ore previste da contratto","","","","","","${formatHours(user.expectedHours)}",""`);
      rows.push(`"Completamento","","","","","","${user.expectedHours > 0 ? Math.round((user.confirmedHours / user.expectedHours) * 100) : 0}%",""`);

      const csvContent = [headers.join(','), ...rows].join('\n');
      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ore_${user.name.replace(/\s+/g, '_')}_${format(dateFrom, 'yyyy-MM')}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({ title: "Export completato", description: `Ore di ${user.name} esportate con successo` });
    } catch (error) {
      console.error('Export error:', error);
      toast({ title: "Errore export", description: "Impossibile esportare le ore", variant: "destructive" });
    } finally {
      setExporting(null);
    }
  };

  const renderBalance = (value: number) => (
    <span className={`font-medium ${value > 0 ? 'text-primary' : value < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
      {value > 0 ? '+' : ''}{formatHoursDisplay(value)}
    </span>
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Riepilogo Ore Team
            </CardTitle>
            <CardDescription>
              Ore confermate vs ore previste ({workingDays} giorni lavorativi)
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={handlePrevMonth} className="h-8 w-8">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Select value={format(selectedMonth, 'yyyy-MM')} onValueChange={handleMonthChange}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={handleNextMonth} disabled={isCurrentMonth} className="h-8 w-8">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Select value={contractFilter} onValueChange={(value: ContractFilter) => setContractFilter(value)}>
              <SelectTrigger className="w-[140px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti</SelectItem>
                <SelectItem value="employees">Dipendenti</SelectItem>
                <SelectItem value="freelance">Freelance</SelectItem>
                <SelectItem value="consuntivo">Consuntivo</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2 text-sm text-muted-foreground ml-2">
              <Users className="h-4 w-4" />
              {usersWithExpectedHours.length}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {usersWithExpectedHours.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nessun dato disponibile per il periodo selezionato
          </p>
        ) : (
          <>
            <div className="grid grid-cols-6 gap-4 mb-4 p-3 bg-muted/50 rounded-lg">
              <div>
                <p className="text-xs text-muted-foreground">Ore Confermate</p>
                <p className="text-lg font-bold">{formatHours(totalConfirmed)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Ore Previste</p>
                <p className="text-lg font-bold">{formatHours(totalExpected)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Saldo Mese</p>
                <p className={`text-lg font-bold ${totalConfirmed - totalExpected > 0 ? 'text-primary' : totalConfirmed - totalExpected < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {totalConfirmed - totalExpected > 0 ? '+' : ''}{formatHoursDisplay(totalConfirmed - totalExpected)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Saldo Anno</p>
                <p className={`text-lg font-bold ${totalYtdBalance > 0 ? 'text-primary' : totalYtdBalance < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {totalYtdBalance > 0 ? '+' : ''}{formatHoursDisplay(totalYtdBalance)}
                  {totalCarryover !== 0 && (
                    <span className="text-xs font-normal text-muted-foreground ml-1">(rip. {totalCarryover > 0 ? '+' : ''}{formatHoursDisplay(totalCarryover)})</span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Completamento</p>
                <p className="text-lg font-bold">
                  {totalExpected > 0 ? Math.round((totalConfirmed / totalExpected) * 100) : 0}%
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" /> Prod. Billable Media
                </p>
                <p className="text-lg font-bold">
                  {usersWithExpectedHours.length > 0
                    ? Math.round(usersWithExpectedHours.reduce((sum, u) => sum + u.actualProductivity, 0) / usersWithExpectedHours.length)
                    : 0}%
                </p>
              </div>
            </div>

            <div className="max-h-[500px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[30px]"></TableHead>
                    <TableHead>Utente</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Confermate</TableHead>
                    <TableHead className="text-right">Previste</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                    <TableHead className="text-right">Saldo Anno</TableHead>
                    <TableHead className="text-right">Riporto</TableHead>
                    <TableHead className="w-[120px]">Progresso</TableHead>
                    <TableHead className="text-center">Prod. Billable</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usersWithExpectedHours.map((user) => {
                    const isAboveTarget = user.actualProductivity >= user.targetProductivity;
                    const isNearTarget = user.actualProductivity >= user.targetProductivity * 0.8;
                    const adjustedConfirmed = user.confirmedHours + user.monthAdjustment;
                    const isConsuntivo = user.contractType === 'consuntivo';
                    const monthBalance = adjustedConfirmed - user.expectedHours;
                    const ytdBalance = user.ytdConfirmed - user.ytdExpected + user.carryover;
                    // Forecast: if current month, calculate expected remaining from tomorrow to end of month
                    let forecastBalance: number | null = null;
                    if (isCurrentMonth && !isConsuntivo) {
                      const today = new Date();
                      const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
                      const mEnd = endOfMonth(today);
                      if (tomorrow <= mEnd) {
                        const mStart = startOfMonth(today);
                        const fullMonthWorkingDays = calculateWorkingDaysForInterval(mStart, mEnd, closureDates);
                        const remainingWorkingDays = calculateWorkingDaysForInterval(tomorrow, mEnd, closureDates);
                        const expectedRemaining = fullMonthWorkingDays > 0
                          ? user.expectedHours * (remainingWorkingDays / fullMonthWorkingDays)
                          : 0;
                        forecastBalance = monthBalance + expectedRemaining;
                      } else {
                        forecastBalance = monthBalance;
                      }
                    }
                    const isExpanded = expandedUserId === user.id;
                    return (
                      <React.Fragment key={user.id}>
                          <TableRow className="cursor-pointer hover:bg-muted/50" onClick={() => setExpandedUserId(isExpanded ? null : user.id)}>
                            <TableCell className="px-2">
                              {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                            </TableCell>
                            <TableCell className="font-medium">{user.name}</TableCell>
                            <TableCell>
                              <span className="text-sm text-muted-foreground">
                                {getContractTypeLabel(user.contractType)}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              {formatHours(user.confirmedHours)}
                              {user.monthAdjustment !== 0 && (
                                <span className={`ml-1 text-xs ${user.monthAdjustment > 0 ? 'text-primary' : 'text-destructive'}`}>
                                  ({user.monthAdjustment > 0 ? '+' : ''}{formatHoursDisplay(user.monthAdjustment)})
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">{isConsuntivo ? <span className="text-muted-foreground">—</span> : formatHours(user.expectedHours)}</TableCell>
                            <TableCell className="text-right">
                              {isConsuntivo ? <span className="text-muted-foreground">—</span> : (
                                <>
                                  {renderBalance(monthBalance)}
                                  {forecastBalance !== null && (
                                    <span className="text-muted-foreground text-xs ml-1">
                                      (prev. {forecastBalance > 0 ? '+' : ''}{formatHoursDisplay(forecastBalance)})
                                    </span>
                                  )}
                                </>
                              )}
                            </TableCell>
                            <TableCell className="text-right">{isConsuntivo ? <span className="text-muted-foreground">—</span> : renderBalance(ytdBalance)}</TableCell>
                            
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                {user.carryover !== 0 ? (
                                  <span className={`text-sm ${user.carryover > 0 ? 'text-primary' : 'text-destructive'}`}>
                                    {user.carryover > 0 ? '+' : ''}{formatHoursDisplay(user.carryover)}
                                  </span>
                                ) : (
                                  <span className="text-sm text-muted-foreground">—</span>
                                )}
                                {canEditAdjustments && (
                                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); openCarryoverEdit(user.id, user.name); }}>
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {isConsuntivo ? <span className="text-muted-foreground text-xs">—</span> : <Progress value={getPercentage(adjustedConfirmed, user.expectedHours)} className="h-2" />}
                            </TableCell>
                            <TableCell className="text-center">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                                isAboveTarget
                                  ? 'bg-primary/10 text-primary'
                                  : isNearTarget
                                    ? 'bg-warning/10 text-warning'
                                    : 'bg-destructive/10 text-destructive'
                              }`}>
                                {user.actualProductivity}%
                                <span className="text-muted-foreground font-normal">/ {user.targetProductivity}%</span>
                              </span>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => { e.stopPropagation(); handleExportUser(user); }}
                                disabled={exporting === user.id}
                                title="Esporta ore"
                                className="h-8 w-8"
                              >
                                <Download className={`h-4 w-4 ${exporting === user.id ? 'animate-pulse' : ''}`} />
                              </Button>
                            </TableCell>
                          </TableRow>
                          {isExpanded && (
                            <TableRow>
                              <TableCell colSpan={11} className="p-3">
                                <UserMonthlyDetail
                                  userId={user.id}
                                  userName={user.name}
                                  selectedMonth={selectedMonth}
                                  monthlyConfirmed={ytdMonthlyMap[user.id] || {}}
                                  adjustments={getUserAdjustmentsMap(user.id)}
                                  monthlyExpected={getMonthlyExpectedMap(user)}
                                  canEdit={canEditAdjustments}
                                  isConsuntivo={isConsuntivo}
                                />
                              </TableCell>
                            </TableRow>
                          )}
                      </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>

      <Dialog open={!!editingCarryoverUserId} onOpenChange={(open) => !open && setEditingCarryoverUserId(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Riporto anno precedente — {editingCarryoverUserName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Anno</Label>
              <p className="text-sm text-muted-foreground">{selectedMonth.getFullYear()}</p>
            </div>
            <div>
              <Label htmlFor="carryover-hours">Ore riporto (+ o -)</Label>
              <Input
                id="carryover-hours"
                type="number"
                step="0.5"
                value={carryoverHours}
                onChange={(e) => setCarryoverHours(e.target.value)}
                placeholder="es. -16 oppure 8.5"
              />
            </div>
            <div>
              <Label htmlFor="carryover-notes">Note</Label>
              <Textarea
                id="carryover-notes"
                value={carryoverNotes}
                onChange={(e) => setCarryoverNotes(e.target.value)}
                placeholder="es. Saldo 2025 da compensare..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingCarryoverUserId(null)}>Annulla</Button>
            <Button onClick={handleSaveCarryover} disabled={savingCarryover}>
              {savingCarryover ? 'Salvataggio...' : 'Salva'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};