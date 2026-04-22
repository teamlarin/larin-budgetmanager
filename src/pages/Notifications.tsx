import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { toast } from 'sonner';
import { Bell, CheckCheck, Trash2, Eye, Calendar, Filter } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
  project_id: string | null;
  projects?: {
    name: string;
  };
}

interface NotificationStats {
  total: number;
  unread: number;
  byType: {
    [key: string]: number;
  };
}

export default function Notifications() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const { data: notifications = [], isLoading } = useQuery<Notification[]>({
    queryKey: ['all-notifications', typeFilter, projectFilter, startDate, endDate],
    queryFn: async () => {
      let query = supabase
        .from('notifications')
        .select('*, projects(name)')
        .order('created_at', { ascending: false });

      if (typeFilter !== 'all') {
        query = query.eq('type', typeFilter);
      }

      if (projectFilter !== 'all') {
        query = query.eq('project_id', projectFilter);
      }

      if (startDate) {
        query = query.gte('created_at', new Date(startDate).toISOString());
      }

      if (endDate) {
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        query = query.lte('created_at', endOfDay.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    },
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['notification-projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name')
        .order('name');

      if (error) throw error;
      return data || [];
    },
  });

  const stats: NotificationStats = {
    total: notifications.length,
    unread: notifications.filter(n => !n.read).length,
    byType: notifications.reduce((acc, n) => {
      acc[n.type] = (acc[n.type] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number }),
  };

  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('read', false);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('Tutte le notifiche sono state segnate come lette');
    },
  });

  const deleteNotificationMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('Notifica eliminata');
    },
  });

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'project_overdue':
      case 'deadline_overdue':
        return '🔴';
      case 'deadline_approaching':
        return '⚠️';
      case 'budget_exceeded':
        return '🔴';
      case 'budget_warning':
        return '🟡';
      case 'projection_critical':
        return '🔴';
      case 'projection_warning':
        return '🟡';
      case 'budget_approved':
        return '✅';
      case 'budget_rejected':
        return '❌';
      case 'budget_pending':
        return '⏳';
      case 'activity_assignment':
        return '📋';
      default:
        return '📢';
    }
  };

  const getNotificationTypeLabel = (type: string) => {
    const labels: { [key: string]: string } = {
      project_overdue: 'Progetto Scaduto',
      deadline_overdue: 'Scadenza Superata',
      deadline_approaching: 'Scadenza Imminente',
      budget_exceeded: 'Budget Superato',
      budget_warning: 'Attenzione Budget',
      projection_critical: 'Proiezione Critica',
      projection_warning: 'Proiezione Attenzione',
      budget_approved: 'Budget Approvato',
      budget_rejected: 'Budget Rifiutato',
      budget_pending: 'Budget in Attesa',
      activity_assignment: 'Assegnazione Attività',
      project_leader_assigned: 'Assegnazione Project Leader',
      pack_hours_warning: 'Avviso Ore Pack',
      pack_hours_overtime: 'Sforamento Ore Pack',
      progress_draft_ready: 'Bozza Progress Update',
      general: 'Generale',
    };
    return labels[type] || type;
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      markAsReadMutation.mutate(notification.id);
    }
    if (notification.project_id) {
      navigate(`/projects/${notification.project_id}/canvas`);
    }
  };

  const clearFilters = () => {
    setTypeFilter('all');
    setProjectFilter('all');
    setStartDate('');
    setEndDate('');
  };

  return (
    <div className="page-container stack-lg">
      <div className="page-header-with-actions">
        <h1 className="page-title">Notifiche</h1>
        {stats.unread > 0 && (
          <Button onClick={() => markAllAsReadMutation.mutate()}>
            <CheckCheck className="mr-2 h-4 w-4" />
            Segna Tutte Come Lette
          </Button>
        )}
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Totale</CardTitle>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Non Lette</CardTitle>
            <Bell className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.unread}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Scadenze Superate</CardTitle>
            <span className="text-xl">🔴</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.byType['deadline_overdue'] || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Scadenze Imminenti</CardTitle>
            <span className="text-xl">⚠️</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.byType['deadline_approaching'] || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtri
          </CardTitle>
          <CardDescription>
            Filtra le notifiche per tipo, progetto o periodo
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Tipo</label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti</SelectItem>
                  <SelectItem value="project_overdue">Progetto Scaduto</SelectItem>
                  <SelectItem value="deadline_approaching">Scadenza Imminente</SelectItem>
                  <SelectItem value="budget_exceeded">Budget Superato</SelectItem>
                  <SelectItem value="budget_warning">Attenzione Budget</SelectItem>
                  <SelectItem value="projection_critical">Proiezione Critica</SelectItem>
                  <SelectItem value="projection_warning">Proiezione Attenzione</SelectItem>
                  <SelectItem value="budget_approved">Budget Approvato</SelectItem>
                  <SelectItem value="budget_rejected">Budget Rifiutato</SelectItem>
                  <SelectItem value="budget_pending">Budget in Attesa</SelectItem>
                  <SelectItem value="activity_assignment">Assegnazione Attività</SelectItem>
                  <SelectItem value="project_leader_assigned">Assegnazione Project Leader</SelectItem>
                  <SelectItem value="pack_hours_warning">Avviso Ore Pack</SelectItem>
                  <SelectItem value="pack_hours_overtime">Sforamento Ore Pack</SelectItem>
                  <SelectItem value="progress_draft_ready">Bozza Progress Update</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Progetto</label>
              <Select value={projectFilter} onValueChange={setProjectFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona progetto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Data Inizio</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Data Fine</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          {(typeFilter !== 'all' || projectFilter !== 'all' || startDate || endDate) && (
            <Button variant="outline" onClick={clearFilters} size="sm">
              Cancella Filtri
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Notifications Table */}
      <Card>
        <CardHeader>
          <CardTitle>Notifiche</CardTitle>
          <CardDescription>
            {notifications.length} notifiche trovate
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Caricamento...
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nessuna notifica trovata
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Titolo</TableHead>
                  <TableHead>Messaggio</TableHead>
                  <TableHead>Progetto</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead className="text-right">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {notifications.map((notification) => (
                  <TableRow
                    key={notification.id}
                    className={!notification.read ? 'bg-muted/30' : ''}
                  >
                    <TableCell>
                      <span className="text-xl">{getNotificationIcon(notification.type)}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {getNotificationTypeLabel(notification.type)}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      {notification.title}
                    </TableCell>
                    <TableCell className="max-w-md truncate">
                      {notification.message}
                    </TableCell>
                    <TableCell>
                      {notification.projects?.name || '-'}
                    </TableCell>
                    <TableCell>
                      {format(new Date(notification.created_at), "d MMM yyyy HH:mm", { locale: it })}
                    </TableCell>
                    <TableCell>
                      {notification.read ? (
                        <Badge variant="secondary">Letta</Badge>
                      ) : (
                        <Badge variant="default">Non Letta</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {notification.project_id && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleNotificationClick(notification)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                        {!notification.read && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => markAsReadMutation.mutate(notification.id)}
                          >
                            <CheckCheck className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteNotificationMutation.mutate(notification.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
