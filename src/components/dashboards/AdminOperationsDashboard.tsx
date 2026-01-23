import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { 
  FolderOpen, 
  Users
} from 'lucide-react';
import { WorkloadSummaryWidget } from './WorkloadSummaryWidget';
import { DashboardDateFilter, DateRange } from '@/components/DashboardDateFilter';

interface UserWorkloadSummary {
  userId: string;
  fullName: string;
  plannedHours: number;
  capacityHours: number;
  utilizationPercentage: number;
}

interface AdminOperationsDashboardProps {
  stats: {
    totalProjects: number;
    activeProjects: number;
    totalUsers: number;
  };
  teamWorkload?: UserWorkloadSummary[];
  workloadLoading?: boolean;
  dateRange?: DateRange;
  onDateRangeChange?: (range: DateRange) => void;
}

export const AdminOperationsDashboard = ({
  stats,
  teamWorkload = [],
  workloadLoading = false,
  dateRange,
  onDateRangeChange
}: AdminOperationsDashboardProps) => {
  return (
    <section className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-1 rounded-full" style={{ backgroundColor: 'hsl(var(--primary))' }} />
          <h2 className="text-xl font-semibold">Area Progetti e Risorse</h2>
        </div>
        {dateRange && onDateRangeChange && (
          <DashboardDateFilter dateRange={dateRange} onDateRangeChange={onDateRangeChange} />
        )}
      </div>

      {/* Projects & Resources Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card variant="stats">
          <CardHeader variant="stats">
            <CardTitle className="text-sm font-medium">Progetti totali</CardTitle>
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent variant="stats">
            <div className="text-2xl font-bold">{stats.totalProjects}</div>
            <p className="text-xs text-muted-foreground">
              progetti nel sistema
            </p>
          </CardContent>
        </Card>

        <Card variant="stats">
          <CardHeader variant="stats">
            <CardTitle className="text-sm font-medium">Progetti attivi</CardTitle>
            <FolderOpen className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent variant="stats">
            <div className="text-2xl font-bold text-primary">{stats.activeProjects}</div>
            <div className="flex items-center gap-2 mt-1">
              <Progress 
                value={stats.totalProjects > 0 ? (stats.activeProjects / stats.totalProjects) * 100 : 0} 
                className="h-2 flex-1" 
              />
              <span className="text-xs text-muted-foreground">
                {stats.totalProjects > 0 ? Math.round((stats.activeProjects / stats.totalProjects) * 100) : 0}%
              </span>
            </div>
          </CardContent>
        </Card>

        <Card variant="stats">
          <CardHeader variant="stats">
            <CardTitle className="text-sm font-medium">Utenti</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent variant="stats">
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
            <p className="text-xs text-muted-foreground">utenti approvati</p>
          </CardContent>
        </Card>

        <Card variant="stats">
          <CardHeader variant="stats">
            <CardTitle className="text-sm font-medium">Risorse per progetto</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent variant="stats">
            <div className="text-2xl font-bold">
              {stats.activeProjects > 0 ? (stats.totalUsers / stats.activeProjects).toFixed(1) : '-'}
            </div>
            <p className="text-xs text-muted-foreground">
              media utenti/progetto attivo
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Team Workload Widget */}
      <WorkloadSummaryWidget data={teamWorkload} isLoading={workloadLoading} />
    </section>
  );
};
