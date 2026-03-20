import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  FolderOpen, 
  CalendarClock,
  RefreshCw,
  Package,
  AlertTriangle
} from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { WorkloadSummaryWidget } from './WorkloadSummaryWidget';

interface ProjectInfo {
  id: string;
  name: string;
  project_status?: string;
  billing_type?: string;
  start_date?: string | null;
  end_date?: string | null;
  progress?: number | null;
  clients?: { name: string } | null;
}

interface UserWorkloadSummary {
  userId: string;
  fullName: string;
  plannedHours: number;
  confirmedHours?: number;
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
  projectLists?: {
    expiringThisMonth: ProjectInfo[];
    startingThisMonth: ProjectInfo[];
    recurring: ProjectInfo[];
    pack: ProjectInfo[];
  };
  criticalProjects?: ProjectInfo[];
  teamWorkload?: UserWorkloadSummary[];
  workloadLoading?: boolean;
}

export const AdminOperationsDashboard = ({
  stats,
  projectLists,
  criticalProjects = [],
  teamWorkload = [],
  workloadLoading = false
}: AdminOperationsDashboardProps) => {
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogTitle, setDialogTitle] = useState('');
  const [dialogProjects, setDialogProjects] = useState<ProjectInfo[]>([]);

  const getDisplayProgress = (project: ProjectInfo): number | null => {
    const isRecurring = project.billing_type === 'recurring';
    const isPack = project.billing_type === 'pack';
    const isInterno = project.billing_type === 'interno';
    const isConsumptive = project.billing_type === 'consumptive';

    if (isInterno || isConsumptive) return null;

    if (isRecurring && project.start_date && project.end_date) {
      const today = new Date();
      const start = new Date(project.start_date);
      const end = new Date(project.end_date);
      const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
      const daysElapsed = Math.ceil((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      return Math.min(100, Math.max(0, Math.round((daysElapsed / totalDays) * 100)));
    }

    if (isPack) return project.progress ?? 0;

    return project.progress ?? null;
  };

  const openProjectsDialog = (title: string, projects: ProjectInfo[]) => {
    setDialogTitle(title);
    setDialogProjects(
      [...projects].sort((a, b) => (getDisplayProgress(a) ?? 0) - (getDisplayProgress(b) ?? 0))
    );
    setDialogOpen(true);
  };

  // Overloaded users (>= 120%)
  const overloadedUsers = teamWorkload.filter(u => u.utilizationPercentage >= 120);

  // Check if there are any critical alerts
  const hasCriticalAlerts = criticalProjects.length > 0 || overloadedUsers.length > 0;

  return (
    <div className="space-y-8">
      {/* === SEZIONE PROGETTI === */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-1 rounded-full" style={{ backgroundColor: 'hsl(var(--primary))' }} />
          <h2 className="text-xl font-semibold">Progetti</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card 
            variant="stats" 
            className="cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => projectLists && openProjectsDialog('Progetti in scadenza questo mese', projectLists.expiringThisMonth)}
          >
            <CardHeader variant="stats">
              <CardTitle className="text-sm font-medium">Progetti in scadenza</CardTitle>
              <CalendarClock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent variant="stats">
              <div className="text-2xl font-bold">
                {stats.projectsExpiringThisMonth}
                <span className="text-base font-normal text-muted-foreground">/{stats.openProjects}</span>
              </div>
              <p className="text-xs text-muted-foreground">su progetti aperti</p>
            </CardContent>
          </Card>

          <Card 
            variant="stats"
            className="cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => projectLists && openProjectsDialog('Progetti in partenza questo mese', projectLists.startingThisMonth)}
          >
            <CardHeader variant="stats">
              <CardTitle className="text-sm font-medium">Progetti in partenza</CardTitle>
              <FolderOpen className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent variant="stats">
              <div className="text-2xl font-bold">
                {stats.projectsStartingThisMonth}
                <span className="text-base font-normal text-muted-foreground">/{stats.startingProjects}</span>
              </div>
              <p className="text-xs text-muted-foreground">in partenza questo mese</p>
            </CardContent>
          </Card>

          <Card 
            variant="stats"
            className="cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => projectLists && openProjectsDialog('Progetti Recurring', projectLists.recurring)}
          >
            <CardHeader variant="stats">
              <CardTitle className="text-sm font-medium">Progetti Recurring</CardTitle>
              <RefreshCw className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent variant="stats">
              <div className="text-2xl font-bold">{stats.recurringProjects}</div>
              <p className="text-xs text-muted-foreground">progetti aperti recurring</p>
            </CardContent>
          </Card>

          <Card 
            variant="stats"
            className="cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => projectLists && openProjectsDialog('Progetti Pack', projectLists.pack)}
          >
            <CardHeader variant="stats">
              <CardTitle className="text-sm font-medium">Progetti Pack</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent variant="stats">
              <div className="text-2xl font-bold">{stats.packProjects}</div>
              <p className="text-xs text-muted-foreground">progetti aperti pack</p>
            </CardContent>
          </Card>
        </div>

        {/* Critical Projects */}
        {criticalProjects.length > 0 && (
          <Card className="border-destructive/50">
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <CardTitle>Progetti a rischio</CardTitle>
              </div>
              <CardDescription>Progetti che richiedono attenzione immediata</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {criticalProjects.map(project => (
                  <div
                    key={project.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-destructive/30 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => navigate(`/projects/${project.id}/canvas`)}
                  >
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium truncate block">{project.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {[
                          project.clients?.name,
                          project.end_date && `Scad. ${format(new Date(project.end_date), 'd MMM', { locale: it })}`
                        ].filter(Boolean).join(' · ')}
                      </span>
                    </div>
                    <span className="text-sm font-semibold text-destructive ml-2">
                      {project.progress ?? 0}%
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </section>

      {/* === SEZIONE TEAM === */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-1 rounded-full" style={{ backgroundColor: 'hsl(var(--chart-2))' }} />
          <h2 className="text-xl font-semibold">Team</h2>
        </div>

        {/* Overloaded Users */}
        {overloadedUsers.length > 0 && (
          <Card className="border-destructive/50">
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <CardTitle>Utenti sovraccarichi</CardTitle>
              </div>
              <CardDescription>Membri del team oltre la capacità</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {overloadedUsers.map(user => (
                  <div
                    key={user.userId}
                    className="flex items-center justify-between p-3 rounded-lg border border-destructive/30"
                  >
                    <span className="text-sm font-medium">{user.fullName}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {user.plannedHours}h / {user.capacityHours}h
                      </span>
                      <span className="text-sm font-semibold text-destructive">
                        {user.utilizationPercentage}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <WorkloadSummaryWidget data={teamWorkload} isLoading={workloadLoading} />
      </section>

      {/* Projects Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
          </DialogHeader>
          {dialogProjects.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Nessun progetto</p>
          ) : (
            <div className="divide-y">
              {dialogProjects.map((project) => (
                <div
                  key={project.id}
                  className="flex items-center justify-between py-2 px-1 cursor-pointer transition-colors hover:bg-muted/50 rounded"
                  onClick={() => {
                    setDialogOpen(false);
                    navigate(`/projects/${project.id}/canvas`);
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium truncate block">{project.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {[
                        project.clients?.name,
                        project.end_date && `Scad. ${format(new Date(project.end_date), 'd MMM', { locale: it })}`,
                        !project.end_date && project.start_date && `Inizio ${format(new Date(project.start_date), 'd MMM', { locale: it })}`
                      ].filter(Boolean).join(' · ')}
                    </span>
                  </div>
                  {(() => {
                    const displayProgress = getDisplayProgress(project);
                    return displayProgress != null ? (
                      <span className="text-xs text-muted-foreground ml-2">{displayProgress}%</span>
                    ) : null;
                  })()}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
