import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { calculateSafeHours } from '@/lib/timeUtils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clock, Users, Download, ChevronLeft, ChevronRight, Filter, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { eachDayOfInterval, isWeekend, format, isSameDay, parseISO, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns';
import { it } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { formatHours } from '@/lib/utils';

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

type ContractFilter = 'all' | 'employees' | 'freelance';

const EXCLUDED_AREAS = ['struttura', 'sales'];

export const UserHoursSummary = () => {
  const { toast } = useToast();
  const [closureDays, setClosureDays] = useState<Date[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<Date>(startOfMonth(new Date()));
  const [exporting, setExporting] = useState<string | null>(null);
  const [contractFilter, setContractFilter] = useState<ContractFilter>('all');

  const dateFrom = selectedMonth;
  const dateTo = endOfMonth(selectedMonth);

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
          .select('user_id, scheduled_start_time, scheduled_end_time, actual_start_time, actual_end_time, budget_items(project_id, projects:project_id(is_billable))')
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

      const userHoursMap: Record<string, { total: number; billable: number }> = {};
      allTimeEntries.forEach(e => {
        if (e.actual_start_time && e.actual_end_time) {
          const hours = calculateSafeHours(e.actual_start_time, e.actual_end_time);
          if (!userHoursMap[e.user_id]) {
            userHoursMap[e.user_id] = { total: 0, billable: 0 };
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

  useEffect(() => {
    const loadClosureDays = async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('*')
        .eq('setting_key', 'closure_days')
        .maybeSingle();

      if (data?.setting_value) {
        const value = data.setting_value as unknown as ClosureDaysSettings;
        const days = value.closureDays || [];
        const result: Date[] = [];
        const years = new Set<number>();
        const allDays = eachDayOfInterval({ start: dateFrom, end: dateTo });
        allDays.forEach(d => years.add(d.getFullYear()));

        years.forEach(year => {
          days.forEach(day => {
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
        });

        setClosureDays(result);
      }
    };
    loadClosureDays();
  }, [dateFrom, dateTo]);

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
      default: return type;
    }
  };

  const calculateWorkingDays = () => {
    const allDays = eachDayOfInterval({ start: dateFrom, end: dateTo });
    return allDays.filter(day => {
      if (isWeekend(day)) return false;
      if (closureDays.some(cd => isSameDay(cd, day))) return false;
      return true;
    }).length;
  };

  const workingDays = calculateWorkingDays();

  const calculateExpectedHours = (user: UserHoursData) => {
    const { contractHours, contractHoursPeriod } = user;
    switch (contractHoursPeriod) {
      case 'daily': return contractHours * workingDays;
      case 'weekly': return contractHours * (workingDays / 5);
      case 'monthly': return contractHours;
      default: return contractHours;
    }
  };

  const filteredUsersData = usersData.filter(user => {
    if (contractFilter === 'all') return true;
    if (contractFilter === 'employees') return user.contractType === 'full-time' || user.contractType === 'part-time';
    if (contractFilter === 'freelance') return user.contractType === 'freelance';
    return true;
  });

  const usersWithExpectedHours = filteredUsersData.map(user => ({
    ...user,
    expectedHours: calculateExpectedHours(user)
  }));

  const totalConfirmed = usersWithExpectedHours.reduce((sum, u) => sum + u.confirmedHours, 0);
  const totalExpected = usersWithExpectedHours.reduce((sum, u) => sum + u.expectedHours, 0);

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
            <div className="grid grid-cols-5 gap-4 mb-4 p-3 bg-muted/50 rounded-lg">
              <div>
                <p className="text-xs text-muted-foreground">Ore Confermate</p>
                <p className="text-lg font-bold">{formatHours(totalConfirmed)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Ore Previste</p>
                <p className="text-lg font-bold">{formatHours(totalExpected)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Saldo</p>
                <p className={`text-lg font-bold ${totalConfirmed - totalExpected > 0 ? 'text-primary' : totalConfirmed - totalExpected < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {totalConfirmed - totalExpected > 0 ? '+' : ''}{formatHoursDisplay(totalConfirmed - totalExpected)}
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
                  <TrendingUp className="h-3 w-3" /> Produttività Billable Media
                </p>
                <p className="text-lg font-bold">
                  {usersWithExpectedHours.length > 0
                    ? Math.round(usersWithExpectedHours.reduce((sum, u) => sum + u.actualProductivity, 0) / usersWithExpectedHours.length)
                    : 0}%
                </p>
              </div>
            </div>

            <div className="max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Utente</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Confermate</TableHead>
                    <TableHead className="text-right">Previste</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                    <TableHead className="w-[120px]">Progresso</TableHead>
                    <TableHead className="text-center">Prod. Billable</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usersWithExpectedHours.map((user) => {
                    const isAboveTarget = user.actualProductivity >= user.targetProductivity;
                    const isNearTarget = user.actualProductivity >= user.targetProductivity * 0.8;
                    return (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.name}</TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {getContractTypeLabel(user.contractType)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">{formatHours(user.confirmedHours)}</TableCell>
                        <TableCell className="text-right">{formatHours(user.expectedHours)}</TableCell>
                        <TableCell>
                          <Progress value={getPercentage(user.confirmedHours, user.expectedHours)} className="h-2" />
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
                            onClick={() => handleExportUser(user)}
                            disabled={exporting === user.id}
                            title="Esporta ore"
                            className="h-8 w-8"
                          >
                            <Download className={`h-4 w-4 ${exporting === user.id ? 'animate-pulse' : ''}`} />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
