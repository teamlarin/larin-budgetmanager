import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clock, Users, Download, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { eachDayOfInterval, isWeekend, format, isSameDay, parseISO, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns';
import { it } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

interface ClosureDay {
  date: string;
  name: string;
  isRecurring: boolean;
}

interface ClosureDaysSettings {
  closureDays: ClosureDay[];
}

// Calculate Easter date for a given year
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
  contractHours: number;
  contractType: string;
  contractHoursPeriod: string;
}

interface UserHoursSummaryProps {
  usersData: UserHoursData[];
  periodLabel: string;
  dateFrom: Date;
  dateTo: Date;
  onPeriodChange?: (from: Date, to: Date) => void;
}

type ContractFilter = 'all' | 'employees' | 'freelance';

export const UserHoursSummary = ({ usersData, periodLabel, dateFrom, dateTo, onPeriodChange }: UserHoursSummaryProps) => {
  const { toast } = useToast();
  const [closureDays, setClosureDays] = useState<Date[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<Date>(startOfMonth(dateFrom));
  const [exporting, setExporting] = useState<string | null>(null);
  const [contractFilter, setContractFilter] = useState<ContractFilter>('all');

  useEffect(() => {
    setSelectedMonth(startOfMonth(dateFrom));
  }, [dateFrom]);

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
        
        // Get all years in range
        const years = new Set<number>();
        const allDays = eachDayOfInterval({ start: dateFrom, end: dateTo });
        allDays.forEach(d => years.add(d.getFullYear()));

        years.forEach(year => {
          // Add configured closure days
          days.forEach(day => {
            if (day.isRecurring) {
              const [month, dayNum] = day.date.split('-');
              result.push(new Date(year, parseInt(month) - 1, parseInt(dayNum)));
            } else {
              const date = parseISO(day.date);
              if (date.getFullYear() === year) {
                result.push(date);
              }
            }
          });

          // Add Easter and Easter Monday
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

  const formatHours = (hours: number) => {
    return hours.toFixed(1).replace('.', ',');
  };

  const getPercentage = (confirmed: number, contract: number) => {
    if (contract === 0) return 0;
    return Math.min((confirmed / contract) * 100, 100);
  };

  const getContractTypeLabel = (type: string) => {
    switch (type) {
      case 'full-time':
        return 'Dipendente FT';
      case 'part-time':
        return 'Dipendente PT';
      case 'freelance':
        return 'Freelance';
      default:
        return type;
    }
  };

  // Calculate working days in the period (excluding weekends and holidays)
  const calculateWorkingDays = () => {
    const allDays = eachDayOfInterval({ start: dateFrom, end: dateTo });
    return allDays.filter(day => {
      // Exclude weekends
      if (isWeekend(day)) return false;
      // Exclude closure days
      if (closureDays.some(cd => isSameDay(cd, day))) return false;
      return true;
    }).length;
  };

  const workingDays = calculateWorkingDays();

  // Calculate expected contract hours for the period based on contract type and hours
  const calculateExpectedHours = (user: UserHoursData) => {
    const { contractHours, contractHoursPeriod } = user;
    
    switch (contractHoursPeriod) {
      case 'daily':
        return contractHours * workingDays;
      case 'weekly':
        // Approximate weeks in the period
        const weeks = workingDays / 5;
        return contractHours * weeks;
      case 'monthly':
        // Calculate proportion of working days in period vs standard month (22 days)
        const standardMonthDays = 22;
        return (contractHours / standardMonthDays) * workingDays;
      default:
        return contractHours;
    }
  };

  // Filter users by contract type
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

  // Generate month options (last 12 months)
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const date = subMonths(new Date(), i);
    return {
      value: format(date, 'yyyy-MM'),
      label: format(date, 'MMMM yyyy', { locale: it })
    };
  });

  const handleMonthChange = (value: string) => {
    const [year, month] = value.split('-').map(Number);
    const newFrom = new Date(year, month - 1, 1);
    const newTo = endOfMonth(newFrom);
    setSelectedMonth(newFrom);
    if (onPeriodChange) {
      onPeriodChange(newFrom, newTo);
    }
  };

  const handlePrevMonth = () => {
    const newFrom = startOfMonth(subMonths(selectedMonth, 1));
    const newTo = endOfMonth(newFrom);
    setSelectedMonth(newFrom);
    if (onPeriodChange) {
      onPeriodChange(newFrom, newTo);
    }
  };

  const handleNextMonth = () => {
    const newFrom = startOfMonth(addMonths(selectedMonth, 1));
    const newTo = endOfMonth(newFrom);
    setSelectedMonth(newFrom);
    if (onPeriodChange) {
      onPeriodChange(newFrom, newTo);
    }
  };

  const isCurrentMonth = format(selectedMonth, 'yyyy-MM') === format(new Date(), 'yyyy-MM');

  // Export user hours to CSV
  const handleExportUser = async (user: typeof usersWithExpectedHours[0]) => {
    setExporting(user.id);
    
    try {
      const fromDateStr = format(dateFrom, 'yyyy-MM-dd');
      const toDateStr = format(dateTo, 'yyyy-MM-dd');

      // Fetch detailed time entries for this user
      const { data: timeEntries, error } = await supabase
        .from('activity_time_tracking')
        .select(`
          *,
          budget_items(
            activity_name,
            category,
            projects:project_id(name)
          )
        `)
        .eq('user_id', user.id)
        .gte('scheduled_date', fromDateStr)
        .lte('scheduled_date', toDateStr)
        .not('actual_start_time', 'is', null)
        .not('actual_end_time', 'is', null)
        .order('scheduled_date', { ascending: true });

      if (error) throw error;

      // Build CSV content
      const headers = ['Data', 'Progetto', 'Attività', 'Categoria', 'Ora Inizio', 'Ora Fine', 'Ore', 'Note'];
      const rows = timeEntries?.map(entry => {
        const startTime = entry.actual_start_time ? new Date(entry.actual_start_time) : null;
        const endTime = entry.actual_end_time ? new Date(entry.actual_end_time) : null;
        const hours = startTime && endTime 
          ? ((endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60)).toFixed(2)
          : '0';

        return [
          entry.scheduled_date || '',
          entry.budget_items?.projects?.name || '',
          entry.budget_items?.activity_name || '',
          entry.budget_items?.category || '',
          startTime ? format(startTime, 'HH:mm') : '',
          endTime ? format(endTime, 'HH:mm') : '',
          hours,
          entry.notes || ''
        ].map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',');
      }) || [];

      // Add summary row
      rows.push('');
      rows.push(`"Totale ore confermate","","","","","","${formatHours(user.confirmedHours)}",""`);
      rows.push(`"Ore previste da contratto","","","","","","${formatHours(user.expectedHours)}",""`);
      rows.push(`"Completamento","","","","","","${user.expectedHours > 0 ? Math.round((user.confirmedHours / user.expectedHours) * 100) : 0}%",""`);

      const csvContent = [headers.join(','), ...rows].join('\n');
      
      // Create and download file
      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ore_${user.name.replace(/\s+/g, '_')}_${format(dateFrom, 'yyyy-MM')}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Export completato",
        description: `Ore di ${user.name} esportate con successo`,
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Errore export",
        description: "Impossibile esportare le ore",
        variant: "destructive",
      });
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
            <Button 
              variant="outline" 
              size="icon" 
              onClick={handlePrevMonth}
              className="h-8 w-8"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Select 
              value={format(selectedMonth, 'yyyy-MM')} 
              onValueChange={handleMonthChange}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button 
              variant="outline" 
              size="icon" 
              onClick={handleNextMonth}
              disabled={isCurrentMonth}
              className="h-8 w-8"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Select 
              value={contractFilter} 
              onValueChange={(value: ContractFilter) => setContractFilter(value)}
            >
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
            {/* Summary */}
            <div className="grid grid-cols-3 gap-4 mb-4 p-3 bg-muted/50 rounded-lg">
              <div>
                <p className="text-xs text-muted-foreground">Ore Confermate</p>
                <p className="text-lg font-bold">{formatHours(totalConfirmed)}h</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Ore Previste</p>
                <p className="text-lg font-bold">{formatHours(totalExpected)}h</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Completamento</p>
                <p className="text-lg font-bold">
                  {totalExpected > 0 ? Math.round((totalConfirmed / totalExpected) * 100) : 0}%
                </p>
              </div>
            </div>

            {/* Users Table */}
            <div className="max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Utente</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Confermate</TableHead>
                    <TableHead className="text-right">Previste</TableHead>
                    <TableHead className="w-[150px]">Progresso</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usersWithExpectedHours.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {getContractTypeLabel(user.contractType)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatHours(user.confirmedHours)}h
                      </TableCell>
                      <TableCell className="text-right">
                        {formatHours(user.expectedHours)}h
                      </TableCell>
                      <TableCell>
                        <Progress 
                          value={getPercentage(user.confirmedHours, user.expectedHours)} 
                          className="h-2"
                        />
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
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
