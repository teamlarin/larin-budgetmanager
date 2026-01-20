import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ChartContainer, ChartTooltip } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis } from 'recharts';
import { Users, ArrowRight, AlertTriangle } from 'lucide-react';

interface UserWorkloadSummary {
  userId: string;
  fullName: string;
  plannedHours: number;
  capacityHours: number;
  utilizationPercentage: number;
}

interface WorkloadSummaryWidgetProps {
  data: UserWorkloadSummary[];
  isLoading?: boolean;
}

const chartConfig = {
  pianificate: { label: 'Pianificate', color: 'hsl(var(--primary))' },
  capacita: { label: 'Capacità', color: 'hsl(var(--muted))' }
};

export const WorkloadSummaryWidget = ({ data, isLoading }: WorkloadSummaryWidgetProps) => {
  const navigate = useNavigate();

  const overloadedUsers = data.filter(u => u.utilizationPercentage > 100);
  const avgUtilization = data.length > 0 
    ? Math.round(data.reduce((sum, u) => sum + u.utilizationPercentage, 0) / data.length) 
    : 0;

  // Top 5 users by utilization for chart
  const chartData = data
    .slice(0, 5)
    .map(user => ({
      name: user.fullName.split(' ')[0],
      fullName: user.fullName,
      pianificate: user.plannedHours,
      capacita: user.capacityHours,
      utilizzo: user.utilizationPercentage
    }));

  const getUtilizationColor = (percentage: number) => {
    if (percentage > 100) return 'text-destructive';
    if (percentage >= 80) return 'text-primary';
    return 'text-muted-foreground';
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
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
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Carico di lavoro team
          </CardTitle>
          <CardDescription>Panoramica settimanale del carico per persona</CardDescription>
        </div>
        <Button variant="ghost" size="sm" onClick={() => navigate('/workload')}>
          Dettagli
          <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </CardHeader>
      <CardContent>
        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center">
            <div className="text-2xl font-bold">{data.length}</div>
            <div className="text-xs text-muted-foreground">Utenti</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{avgUtilization}%</div>
            <div className="text-xs text-muted-foreground">Utilizzo medio</div>
          </div>
          <div className="text-center">
            <div className={`text-2xl font-bold ${overloadedUsers.length > 0 ? 'text-destructive' : ''}`}>
              {overloadedUsers.length}
            </div>
            <div className="text-xs text-muted-foreground">Sovraccarichi</div>
          </div>
        </div>

        {/* Alert for overloaded users */}
        {overloadedUsers.length > 0 && (
          <div className="flex items-center gap-2 p-2 mb-4 rounded-md bg-destructive/10 text-destructive text-sm">
            <AlertTriangle className="h-4 w-4" />
            <span>{overloadedUsers.map(u => u.fullName.split(' ')[0]).join(', ')} oltre capacità</span>
          </div>
        )}

        {/* Chart */}
        {chartData.length > 0 ? (
          <ChartContainer config={chartConfig} className="h-[180px]">
            <BarChart data={chartData} layout="vertical">
              <XAxis type="number" hide />
              <YAxis 
                dataKey="name" 
                type="category" 
                width={60}
                tick={{ fontSize: 11 }}
              />
              <ChartTooltip 
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="rounded-lg border bg-background p-2 shadow-sm">
                        <div className="font-medium text-sm">{data.fullName}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          <div>Pianificate: {data.pianificate}h</div>
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
            </BarChart>
          </ChartContainer>
        ) : (
          <div className="h-[180px] flex items-center justify-center text-muted-foreground text-sm">
            Nessun dato disponibile
          </div>
        )}

        {/* Top utilization list */}
        <div className="mt-4 space-y-2">
          {data.slice(0, 3).map((user) => (
            <div key={user.userId} className="flex items-center justify-between text-sm">
              <span className="truncate flex-1">{user.fullName}</span>
              <div className="flex items-center gap-2 ml-2">
                <Progress 
                  value={Math.min(user.utilizationPercentage, 100)} 
                  className="h-2 w-16" 
                />
                <span className={`font-medium w-10 text-right ${getUtilizationColor(user.utilizationPercentage)}`}>
                  {user.utilizationPercentage}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
