import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { 
  FolderOpen, 
  CalendarClock,
  RefreshCw,
  Package
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
  teamWorkload?: UserWorkloadSummary[];
  workloadLoading?: boolean;
}

export const AdminOperationsDashboard = ({
  stats,
  projectLists,
  teamWorkload = [],
  workloadLoading = false
}: AdminOperationsDashboardProps) => {
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogTitle, setDialogTitle] = useState('');
  const [dialogProjects, setDialogProjects] = useState<ProjectInfo[]>([]);

  const openProjectsDialog = (title: string, projects: ProjectInfo[]) => {
    setDialogTitle(title);
    setDialogProjects(projects);
    setDialogOpen(true);
  };

  const getStatusLabel = (status?: string) => {
    const labels: Record<string, string> = {
      'in_partenza': 'In Partenza',
      'aperto': 'Aperto',
      'da_fatturare': 'Da Fatturare',
      'completato': 'Completato'
    };
    return status ? labels[status] || status : '';
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-8 w-1 rounded-full" style={{ backgroundColor: 'hsl(var(--primary))' }} />
        <h2 className="text-xl font-semibold">Area Progetti e Risorse</h2>
      </div>

      {/* Projects & Resources Stats Grid */}
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
            <p className="text-xs text-muted-foreground">
              su progetti aperti
            </p>
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
            <p className="text-xs text-muted-foreground">
              in partenza questo mese
            </p>
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
            <p className="text-xs text-muted-foreground">
              progetti aperti pack
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Team Workload Widget */}
      <WorkloadSummaryWidget data={teamWorkload} isLoading={workloadLoading} />

      {/* Projects Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
          </DialogHeader>
          {dialogProjects.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Nessun progetto</p>
          ) : (
            <div className="space-y-2">
              {dialogProjects.map((project) => (
                <div
                  key={project.id}
                  className="flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors hover:bg-muted/50"
                  onClick={() => {
                    setDialogOpen(false);
                    navigate(`/projects/${project.id}/canvas`);
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <span className="font-medium truncate block">{project.name}</span>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                      {project.clients?.name && <span>{project.clients.name}</span>}
                      {project.end_date && (
                        <>
                          {project.clients?.name && <span>·</span>}
                          <span>Scad. {format(new Date(project.end_date), 'd MMM yyyy', { locale: it })}</span>
                        </>
                      )}
                      {project.start_date && !project.end_date && (
                        <>
                          {project.clients?.name && <span>·</span>}
                          <span>Inizio {format(new Date(project.start_date), 'd MMM yyyy', { locale: it })}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    {project.progress != null && (
                      <span className="text-xs text-muted-foreground">{project.progress}%</span>
                    )}
                    {project.project_status && (
                      <Badge variant="outline" className="text-xs">
                        {getStatusLabel(project.project_status)}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
};
