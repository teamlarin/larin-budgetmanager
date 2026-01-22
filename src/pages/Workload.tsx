import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, format, differenceInBusinessDays, eachDayOfInterval, isWeekend } from 'date-fns';
import { it } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from 'recharts';
import { Users, Clock, TrendingUp, AlertTriangle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatHours } from '@/lib/utils';

type UserArea = 'tech' | 'marketing' | 'branding' | 'sales' | 'struttura' | 'ai';

interface UserWorkload {
  userId: string;
  fullName: string;
  title: string | null;
  area: string | null;
  contractHours: number;
  contractPeriod: string;
  plannedHours: number;
  confirmedHours: number;
  capacityHours: number;
  utilizationPercentage: number;
  targetProductivity: number;
  billableHours: number;
  billablePercentage: number;
}

const calculateCapacityHours = (
  contractHours: number, 
  contractPeriod: string, 
  startDate: Date, 
  endDate: Date
): number => {
  const businessDays = eachDayOfInterval({ start: startDate, end: endDate })
    .filter(day => !isWeekend(day)).length;
  
  switch (contractPeriod) {
    case 'daily':
      return contractHours * businessDays;
    case 'weekly':
      return contractHours * (businessDays / 5);
    case 'monthly':
      return contractHours * (businessDays / 22);
    default:
      return contractHours * (businessDays / 22);
  }
};

const Workload = () => {
  const [period, setPeriod] = useState<'weekly' | 'monthly'>('weekly');
  const [areaFilter, setAreaFilter] = useState<UserArea | 'all'>('all');
  
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  
  const startDate = period === 'weekly' ? weekStart : monthStart;
  const endDate = period === 'weekly' ? weekEnd : monthEnd;

  const { data: workloadData, isLoading } = useQuery({
    queryKey: ['team-workload', period, startDate.toISOString(), endDate.toISOString()],
    queryFn: async () => {
      // Get all approved users with their contract info
      const { data: users } = await supabase
        .from('profiles')
        .select('id, full_name, first_name, last_name, contract_hours, contract_hours_period, target_productivity_percentage, title, area')
        .eq('approved', true)
        .is('deleted_at', null);

      if (!users) return [];

      const fromDateStr = format(startDate, 'yyyy-MM-dd');
      const toDateStr = format(endDate, 'yyyy-MM-dd');

      // Get time tracking entries for all users in the period
      const { data: timeEntries } = await supabase
        .from('activity_time_tracking')
        .select('user_id, scheduled_start_time, scheduled_end_time, actual_start_time, actual_end_time, budget_items(projects:project_id(is_billable))')
        .gte('scheduled_date', fromDateStr)
        .lte('scheduled_date', toDateStr);

      // Calculate workload per user
      const workloadMap: Record<string, UserWorkload> = {};

      users.forEach(user => {
        const fullName = user.full_name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Utente';
        const contractHours = user.contract_hours || 0;
        const contractPeriod = user.contract_hours_period || 'monthly';
        const capacityHours = calculateCapacityHours(contractHours, contractPeriod, startDate, endDate);

        workloadMap[user.id] = {
          userId: user.id,
          fullName,
          title: user.title || null,
          area: user.area || null,
          contractHours,
          contractPeriod,
          plannedHours: 0,
          confirmedHours: 0,
          capacityHours: Math.round(capacityHours * 10) / 10,
          utilizationPercentage: 0,
          targetProductivity: user.target_productivity_percentage ?? 80,
          billableHours: 0,
          billablePercentage: 0
        };
      });

      // Aggregate hours from time entries
      timeEntries?.forEach(entry => {
        const userId = entry.user_id;
        if (!workloadMap[userId]) return;

        // Planned hours
        if (entry.scheduled_start_time && entry.scheduled_end_time) {
          const start = new Date(`2000-01-01T${entry.scheduled_start_time}`);
          const end = new Date(`2000-01-01T${entry.scheduled_end_time}`);
          const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
          workloadMap[userId].plannedHours += hours;
        }

        // Confirmed hours
        if (entry.actual_start_time && entry.actual_end_time) {
          const start = new Date(entry.actual_start_time);
          const end = new Date(entry.actual_end_time);
          const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
          workloadMap[userId].confirmedHours += hours;

          // Billable hours
          if (entry.budget_items?.projects?.is_billable) {
            workloadMap[userId].billableHours += hours;
          }
        }
      });

      // Calculate percentages
      Object.values(workloadMap).forEach(user => {
        user.plannedHours = Math.round(user.plannedHours * 10) / 10;
        user.confirmedHours = Math.round(user.confirmedHours * 10) / 10;
        user.billableHours = Math.round(user.billableHours * 10) / 10;
        
        user.utilizationPercentage = user.capacityHours > 0 
          ? Math.round((user.plannedHours / user.capacityHours) * 100) 
          : 0;
        
        user.billablePercentage = user.confirmedHours > 0 
          ? Math.round((user.billableHours / user.confirmedHours) * 100) 
          : 0;
      });

      return Object.values(workloadMap).sort((a, b) => b.utilizationPercentage - a.utilizationPercentage);
    }
  });

  const getUtilizationColor = (percentage: number) => {
    if (percentage > 100) return 'text-destructive';
    if (percentage >= 80) return 'text-primary';
    if (percentage >= 50) return 'text-warning';
    return 'text-muted-foreground';
  };

  const getAreaLabel = (area: string | null) => {
    if (!area) return '-';
    switch (area) {
      case 'tech': return 'Tech';
      case 'marketing': return 'Marketing';
      case 'branding': return 'Branding';
      case 'sales': return 'Sales';
      case 'struttura': return 'Struttura';
      case 'ai': return 'AI';
      default: return area;
    }
  };

  const getUtilizationBadge = (percentage: number) => {
    if (percentage > 100) return <Badge variant="destructive">Sovraccarico</Badge>;
    if (percentage >= 80) return <Badge variant="default">Ottimale</Badge>;
    if (percentage >= 50) return <Badge variant="secondary">Medio</Badge>;
    return <Badge variant="outline">Basso</Badge>;
  };

  // Filter data by area
  const filteredWorkloadData = useMemo(() => {
    if (!workloadData) return [];
    if (areaFilter === 'all') return workloadData;
    return workloadData.filter(user => user.area === areaFilter);
  }, [workloadData, areaFilter]);

  const chartData = filteredWorkloadData?.map(user => ({
    name: user.fullName.split(' ')[0],
    fullName: user.fullName,
    pianificate: user.plannedHours,
    confermate: user.confirmedHours,
    capacita: user.capacityHours,
    utilizzo: user.utilizationPercentage
  })) || [];

  const chartConfig = {
    pianificate: { label: 'Pianificate', color: 'hsl(var(--primary))' },
    confermate: { label: 'Confermate', color: 'hsl(var(--secondary))' },
    capacita: { label: 'Capacità', color: 'hsl(var(--muted))' }
  };

  // Summary stats (based on filtered data)
  const totalUsers = filteredWorkloadData?.length || 0;
  const overloadedUsers = filteredWorkloadData?.filter(u => u.utilizationPercentage > 100).length || 0;
  const avgUtilization = totalUsers > 0 
    ? Math.round(filteredWorkloadData!.reduce((sum, u) => sum + u.utilizationPercentage, 0) / totalUsers) 
    : 0;
  const totalPlannedHours = filteredWorkloadData?.reduce((sum, u) => sum + u.plannedHours, 0) || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Carico di Lavoro</h1>
        <p className="text-muted-foreground">Visualizza il carico di lavoro settimanale e mensile per persona</p>
      </div>

      {/* Period selector */}
      <Tabs value={period} onValueChange={(v) => setPeriod(v as 'weekly' | 'monthly')}>
        <TabsList>
          <TabsTrigger value="weekly">Settimana corrente</TabsTrigger>
          <TabsTrigger value="monthly">Mese corrente</TabsTrigger>
        </TabsList>

        <div className="flex items-center justify-between mt-4">
          <div className="text-sm text-muted-foreground">
            Periodo: {format(startDate, 'd MMM', { locale: it })} - {format(endDate, 'd MMM yyyy', { locale: it })}
          </div>
          <Select value={areaFilter} onValueChange={(v) => setAreaFilter(v as UserArea | 'all')}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filtra per area" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutte le aree</SelectItem>
              <SelectItem value="tech">Tech</SelectItem>
              <SelectItem value="marketing">Marketing</SelectItem>
              <SelectItem value="branding">Branding</SelectItem>
              <SelectItem value="sales">Sales</SelectItem>
              <SelectItem value="struttura">Struttura</SelectItem>
              <SelectItem value="ai">AI</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
          <Card variant="stats">
            <CardHeader variant="stats">
              <CardTitle className="text-sm font-medium">Utenti totali</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent variant="stats">
              <div className="text-2xl font-bold">{totalUsers}</div>
              <p className="text-xs text-muted-foreground">utenti approvati</p>
            </CardContent>
          </Card>

          <Card variant="stats">
            <CardHeader variant="stats">
              <CardTitle className="text-sm font-medium">Ore pianificate totali</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent variant="stats">
              <div className="text-2xl font-bold">{formatHours(totalPlannedHours)}</div>
              <p className="text-xs text-muted-foreground">nel periodo</p>
            </CardContent>
          </Card>

          <Card variant="stats">
            <CardHeader variant="stats">
              <CardTitle className="text-sm font-medium">Utilizzo medio</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent variant="stats">
              <div className="text-2xl font-bold">{avgUtilization}%</div>
              <div className="flex items-center gap-2 mt-1">
                <Progress value={Math.min(avgUtilization, 100)} className="h-2 flex-1" />
              </div>
            </CardContent>
          </Card>

          <Card variant="stats" className={overloadedUsers > 0 ? 'border-destructive' : ''}>
            <CardHeader variant="stats">
              <CardTitle className="text-sm font-medium">Sovraccarichi</CardTitle>
              <AlertTriangle className={`h-4 w-4 ${overloadedUsers > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
            </CardHeader>
            <CardContent variant="stats">
              <div className={`text-2xl font-bold ${overloadedUsers > 0 ? 'text-destructive' : ''}`}>{overloadedUsers}</div>
              <p className="text-xs text-muted-foreground">utenti oltre capacità</p>
            </CardContent>
          </Card>
        </div>

        {/* Chart */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Ore per persona</CardTitle>
            <CardDescription>Confronto tra ore pianificate, confermate e capacità contrattuale</CardDescription>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-[300px]">
                <BarChart data={chartData} layout="vertical">
                  <XAxis type="number" />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    width={100}
                    tick={{ fontSize: 12 }}
                  />
                  <ChartTooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="rounded-lg border bg-background p-2 shadow-sm">
                            <div className="font-medium">{data.fullName}</div>
                            <div className="text-xs text-muted-foreground mt-1">
                              <div>Pianificate: {data.pianificate}h</div>
                              <div>Confermate: {data.confermate}h</div>
                              <div>Capacità: {data.capacita}h</div>
                              <div>Utilizzo: {data.utilizzo}%</div>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="capacita" name="Capacità" fill="hsl(var(--muted))" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="pianificate" name="Pianificate" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="confermate" name="Confermate" fill="hsl(var(--secondary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ChartContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                {isLoading ? 'Caricamento...' : 'Nessun dato disponibile'}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Detailed Table */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Dettaglio per persona</CardTitle>
            <CardDescription>Tutte le metriche di carico per ogni membro del team</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Titolo / Area</TableHead>
                  <TableHead className="text-right">Capacità</TableHead>
                  <TableHead className="text-right">Pianificate</TableHead>
                  <TableHead className="text-right">Confermate</TableHead>
                  <TableHead className="text-right">Utilizzo</TableHead>
                  <TableHead className="text-right">Ore Billable</TableHead>
                  <TableHead className="text-right">% Billable</TableHead>
                  <TableHead className="text-center">Stato</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      Caricamento...
                    </TableCell>
                  </TableRow>
                ) : filteredWorkloadData?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      Nessun utente trovato
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredWorkloadData?.map((user) => (
                    <TableRow key={user.userId}>
                      <TableCell className="font-medium">{user.fullName}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {user.title || <span className="text-muted-foreground">-</span>}
                        </div>
                        {user.area && (
                          <Badge variant="outline" className="mt-1">{getAreaLabel(user.area)}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{user.capacityHours}h</TableCell>
                      <TableCell className="text-right">{user.plannedHours}h</TableCell>
                      <TableCell className="text-right">{user.confirmedHours}h</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Progress 
                            value={Math.min(user.utilizationPercentage, 100)} 
                            className="h-2 w-16" 
                          />
                          <span className={`font-medium ${getUtilizationColor(user.utilizationPercentage)}`}>
                            {user.utilizationPercentage}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{user.billableHours}h</TableCell>
                      <TableCell className="text-right">
                        <span className={user.billablePercentage >= user.targetProductivity ? 'text-primary' : 'text-muted-foreground'}>
                          {user.billablePercentage}%
                        </span>
                        <span className="text-xs text-muted-foreground ml-1">/ {user.targetProductivity}%</span>
                      </TableCell>
                      <TableCell className="text-center">
                        {getUtilizationBadge(user.utilizationPercentage)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </Tabs>
    </div>
  );
};

export default Workload;
