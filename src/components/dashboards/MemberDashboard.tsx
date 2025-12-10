import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Clock, 
  Calendar,
  CheckCircle,
  ArrowRight,
  FolderOpen
} from 'lucide-react';

interface Activity {
  id: string;
  activity_name: string;
  project_name: string;
  scheduled_date?: string;
  scheduled_start_time?: string;
  scheduled_end_time?: string;
  is_confirmed: boolean;
}

interface MemberDashboardProps {
  stats: {
    todayPlannedHours: number;
    todayConfirmedHours: number;
    weekPlannedHours: number;
    weekConfirmedHours: number;
    assignedProjects: number;
    pendingActivities: number;
  };
  todayActivities: Activity[];
  upcomingActivities: Activity[];
}

export const MemberDashboard = ({ stats, todayActivities, upcomingActivities }: MemberDashboardProps) => {
  const navigate = useNavigate();

  const formatTime = (time: string) => {
    return time.substring(0, 5);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">La Mia Dashboard</h1>
        <p className="text-muted-foreground mt-1">Le tue attività e il tuo tempo</p>
      </div>

      {/* Today Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ore Oggi</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.todayPlannedHours.toFixed(1)}h</div>
            <p className="text-xs text-muted-foreground">
              {stats.todayConfirmedHours.toFixed(1)}h confermate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ore Settimana</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.weekPlannedHours.toFixed(1)}h</div>
            <p className="text-xs text-muted-foreground">
              {stats.weekConfirmedHours.toFixed(1)}h confermate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Progetti Assegnati</CardTitle>
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.assignedProjects}</div>
            <p className="text-xs text-muted-foreground">
              progetti attivi
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Attività da Fare</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingActivities}</div>
            <p className="text-xs text-muted-foreground">
              da completare
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Today's Activities */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Attività di Oggi</CardTitle>
            <CardDescription>Le tue attività pianificate per oggi</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/calendar')}>
            Calendario <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          {todayActivities.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nessuna attività pianificata per oggi</p>
          ) : (
            <div className="space-y-3">
              {todayActivities.map((activity) => (
                <div 
                  key={activity.id} 
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div className="space-y-1">
                    <p className="font-medium">{activity.activity_name}</p>
                    <p className="text-sm text-muted-foreground">{activity.project_name}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {activity.scheduled_start_time && activity.scheduled_end_time && (
                      <span className="text-sm text-muted-foreground">
                        {formatTime(activity.scheduled_start_time)} - {formatTime(activity.scheduled_end_time)}
                      </span>
                    )}
                    {activity.is_confirmed ? (
                      <Badge variant="default" className="bg-green-500">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Confermata
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Pianificata</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upcoming Activities */}
      <Card>
        <CardHeader>
          <CardTitle>Prossime Attività</CardTitle>
          <CardDescription>Le tue attività nei prossimi giorni</CardDescription>
        </CardHeader>
        <CardContent>
          {upcomingActivities.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nessuna attività in programma</p>
          ) : (
            <div className="space-y-3">
              {upcomingActivities.slice(0, 5).map((activity) => (
                <div 
                  key={activity.id} 
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div className="space-y-1">
                    <p className="font-medium">{activity.activity_name}</p>
                    <p className="text-sm text-muted-foreground">{activity.project_name}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {activity.scheduled_date && (
                      <span className="text-sm text-muted-foreground">
                        {new Date(activity.scheduled_date).toLocaleDateString('it-IT')}
                      </span>
                    )}
                    {activity.scheduled_start_time && activity.scheduled_end_time && (
                      <span className="text-sm text-muted-foreground">
                        {formatTime(activity.scheduled_start_time)} - {formatTime(activity.scheduled_end_time)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Action */}
      <Card>
        <CardHeader>
          <CardTitle>Azioni Rapide</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <Button variant="outline" className="h-auto py-4 flex flex-col gap-2" onClick={() => navigate('/calendar')}>
              <Calendar className="h-5 w-5" />
              <span className="text-sm">Calendario</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex flex-col gap-2" onClick={() => navigate('/profile')}>
              <Clock className="h-5 w-5" />
              <span className="text-sm">Profilo</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
