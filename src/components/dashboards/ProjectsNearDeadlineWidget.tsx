import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CalendarClock, ArrowRight, AlertTriangle } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { it } from 'date-fns/locale';

interface ProjectNearDeadline {
  id: string;
  name: string;
  client_name?: string;
  end_date: string;
  progress?: number;
  project_status?: string;
}

interface ProjectsNearDeadlineWidgetProps {
  projects: ProjectNearDeadline[];
  isLoading?: boolean;
}

export const ProjectsNearDeadlineWidget = ({ projects, isLoading }: ProjectsNearDeadlineWidgetProps) => {
  const navigate = useNavigate();

  const getDaysRemaining = (endDate: string) => {
    const end = new Date(endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return differenceInDays(end, today);
  };

  const getUrgencyBadge = (daysRemaining: number) => {
    if (daysRemaining < 0) {
      return <Badge variant="destructive">Scaduto</Badge>;
    }
    if (daysRemaining === 0) {
      return <Badge variant="destructive">Oggi</Badge>;
    }
    if (daysRemaining <= 3) {
      return <Badge variant="destructive">{daysRemaining}g</Badge>;
    }
    if (daysRemaining <= 7) {
      return <Badge variant="secondary">{daysRemaining}g</Badge>;
    }
    return <Badge variant="outline">{daysRemaining}g</Badge>;
  };

  const getProjectStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      'in_partenza': 'In Partenza',
      'aperto': 'Aperto',
      'da_fatturare': 'Da Fatturare',
      'completato': 'Completato'
    };
    return labels[status] || status;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5" />
            Progetti in scadenza
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[150px] flex items-center justify-center text-muted-foreground">
            Caricamento...
          </div>
        </CardContent>
      </Card>
    );
  }

  // Sort projects by days remaining (most urgent first)
  const sortedProjects = [...projects].sort((a, b) => {
    const daysA = getDaysRemaining(a.end_date);
    const daysB = getDaysRemaining(b.end_date);
    return daysA - daysB;
  });

  const urgentCount = sortedProjects.filter(p => getDaysRemaining(p.end_date) <= 3).length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5" />
            Progetti in scadenza
            {urgentCount > 0 && (
              <Badge variant="destructive" className="ml-2">
                {urgentCount} urgenti
              </Badge>
            )}
          </CardTitle>
          <CardDescription>Progetti con scadenza nei prossimi 14 giorni</CardDescription>
        </div>
        <Button variant="ghost" size="sm" onClick={() => navigate('/projects')}>
          Tutti
          <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </CardHeader>
      <CardContent>
        {sortedProjects.length === 0 ? (
          <div className="h-[100px] flex flex-col items-center justify-center text-muted-foreground text-sm">
            <CalendarClock className="h-8 w-8 mb-2 opacity-50" />
            Nessun progetto in scadenza
          </div>
        ) : (
          <div className="space-y-3">
            {sortedProjects.slice(0, 5).map((project) => {
              const daysRemaining = getDaysRemaining(project.end_date);
              const isUrgent = daysRemaining <= 3;
              
              return (
                <div
                  key={project.id}
                  className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors hover:bg-muted/50 ${
                    isUrgent ? 'border-destructive/50 bg-destructive/5' : ''
                  }`}
                  onClick={() => navigate(`/projects/${project.id}/canvas`)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {isUrgent && <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0" />}
                      <span className="font-medium truncate">{project.name}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      {project.client_name && <span>{project.client_name}</span>}
                      {project.client_name && <span>·</span>}
                      <span>{format(new Date(project.end_date), 'd MMM yyyy', { locale: it })}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    {project.progress !== undefined && (
                      <span className="text-xs text-muted-foreground">{project.progress}%</span>
                    )}
                    {getUrgencyBadge(daysRemaining)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
