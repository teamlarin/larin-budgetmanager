import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  FolderOpen, 
  CalendarClock,
  RefreshCw,
  Package
} from 'lucide-react';
import { WorkloadSummaryWidget } from './WorkloadSummaryWidget';

interface UserWorkloadSummary {
  userId: string;
  fullName: string;
  plannedHours: number;
  capacityHours: number;
  utilizationPercentage: number;
}

interface AdminOperationsDashboardProps {
  stats: {
    projectsExpiringThisMonth: number;
    projectsStartingThisMonth: number;
    openProjects: number;
    startingProjects: number;
    recurringProjects: number;
    packProjects: number;
    activeProjects: number;
    totalUsers: number;
  };
  teamWorkload?: UserWorkloadSummary[];
  workloadLoading?: boolean;
}

export const AdminOperationsDashboard = ({
  stats,
  teamWorkload = [],
  workloadLoading = false
}: AdminOperationsDashboardProps) => {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-8 w-1 rounded-full" style={{ backgroundColor: 'hsl(var(--primary))' }} />
        <h2 className="text-xl font-semibold">Area Progetti e Risorse</h2>
      </div>

      {/* Projects & Resources Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card variant="stats">
          <CardHeader variant="stats">
            <CardTitle className="text-sm font-medium">Progetti in scadenza</CardTitle>
            <CalendarClock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent variant="stats">
            <div className="text-2xl font-bold">
              {stats.projectsExpiringThisMonth}
              <span className="text-base font-normal text-muted-foreground">/{stats.openProjects}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              su progetti aperti
            </p>
          </CardContent>
        </Card>

        <Card variant="stats">
          <CardHeader variant="stats">
            <CardTitle className="text-sm font-medium">Progetti in partenza</CardTitle>
            <FolderOpen className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent variant="stats">
            <div className="text-2xl font-bold">
              {stats.projectsStartingThisMonth}
              <span className="text-base font-normal text-muted-foreground">/{stats.startingProjects}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              in partenza questo mese
            </p>
          </CardContent>
        </Card>

        <Card variant="stats">
          <CardHeader variant="stats">
            <CardTitle className="text-sm font-medium">Progetti Recurring</CardTitle>
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent variant="stats">
            <div className="text-2xl font-bold">{stats.recurringProjects}</div>
            <p className="text-xs text-muted-foreground">progetti aperti recurring</p>
          </CardContent>
        </Card>

        <Card variant="stats">
          <CardHeader variant="stats">
            <CardTitle className="text-sm font-medium">Progetti Pack</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent variant="stats">
            <div className="text-2xl font-bold">{stats.packProjects}</div>
            <p className="text-xs text-muted-foreground">
              progetti aperti pack
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Team Workload Widget */}
      <WorkloadSummaryWidget data={teamWorkload} isLoading={workloadLoading} />
    </section>
  );
};
