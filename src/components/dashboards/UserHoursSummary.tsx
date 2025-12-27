import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Clock, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { eachDayOfInterval, isWeekend, format, isSameDay, parseISO } from 'date-fns';

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
}

export const UserHoursSummary = ({ usersData, periodLabel, dateFrom, dateTo }: UserHoursSummaryProps) => {
  const [closureDays, setClosureDays] = useState<Date[]>([]);

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

  const usersWithExpectedHours = usersData.map(user => ({
    ...user,
    expectedHours: calculateExpectedHours(user)
  }));

  const totalConfirmed = usersWithExpectedHours.reduce((sum, u) => sum + u.confirmedHours, 0);
  const totalExpected = usersWithExpectedHours.reduce((sum, u) => sum + u.expectedHours, 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Riepilogo Ore Team
            </CardTitle>
            <CardDescription>
              Ore confermate vs ore previste - {periodLabel} ({workingDays} giorni lavorativi)
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            {usersData.length} utenti
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {usersData.length === 0 ? (
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
