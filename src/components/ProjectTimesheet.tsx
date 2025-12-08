import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, CheckCircle, User } from 'lucide-react';

interface ProjectTimesheetProps {
  projectId: string;
}

interface TimeEntry {
  id: string;
  scheduled_date: string | null;
  scheduled_start_time: string | null;
  scheduled_end_time: string | null;
  actual_start_time: string | null;
  actual_end_time: string | null;
  notes: string | null;
  user_id: string;
  budget_item_id: string;
  profiles?: {
    first_name: string | null;
    last_name: string | null;
  };
  budget_items?: {
    activity_name: string;
    category: string;
  };
}

export const ProjectTimesheet = ({ projectId }: ProjectTimesheetProps) => {
  const { data: timeEntries, isLoading } = useQuery({
    queryKey: ['project-timesheet', projectId],
    queryFn: async () => {
      // First get all budget items for this project
      const { data: budgetItems, error: budgetError } = await supabase
        .from('budget_items')
        .select('id, activity_name, category')
        .eq('project_id', projectId);

      if (budgetError) throw budgetError;
      if (!budgetItems?.length) return [];

      const budgetItemIds = budgetItems.map(bi => bi.id);

      // Get all time tracking entries for these budget items
      const { data: timeData, error: timeError } = await supabase
        .from('activity_time_tracking')
        .select('*')
        .in('budget_item_id', budgetItemIds)
        .order('scheduled_date', { ascending: false });

      if (timeError) throw timeError;
      if (!timeData?.length) return [];

      // Get unique user IDs
      const userIds = [...new Set(timeData.map(t => t.user_id))];

      // Get user profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .in('id', userIds);

      const profilesMap = new Map(
        profiles?.map(p => [p.id, { first_name: p.first_name, last_name: p.last_name }]) || []
      );

      const budgetItemsMap = new Map(
        budgetItems.map(bi => [bi.id, { activity_name: bi.activity_name, category: bi.category }])
      );

      // Combine data
      return timeData.map(entry => ({
        ...entry,
        profiles: profilesMap.get(entry.user_id),
        budget_items: budgetItemsMap.get(entry.budget_item_id)
      })) as TimeEntry[];
    },
    enabled: !!projectId
  });

  const calculateHours = (startTime: string | null, endTime: string | null): number => {
    if (!startTime || !endTime) return 0;
    
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    
    return (endMinutes - startMinutes) / 60;
  };

  const isConfirmed = (entry: TimeEntry): boolean => {
    return !!(entry.actual_start_time && entry.actual_end_time);
  };

  const totalPlannedHours = timeEntries?.reduce((acc, entry) => {
    return acc + calculateHours(entry.scheduled_start_time, entry.scheduled_end_time);
  }, 0) || 0;

  const totalConfirmedHours = timeEntries?.reduce((acc, entry) => {
    if (isConfirmed(entry)) {
      return acc + calculateHours(entry.scheduled_start_time, entry.scheduled_end_time);
    }
    return acc;
  }, 0) || 0;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ore Pianificate</p>
                <p className="text-2xl font-bold">{totalPlannedHours.toFixed(1)}h</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <CheckCircle className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ore Confermate</p>
                <p className="text-2xl font-bold">{totalConfirmedHours.toFixed(1)}h</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <User className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Inserimenti</p>
                <p className="text-2xl font-bold">{timeEntries?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Time Entries Table */}
      <Card>
        <CardHeader>
          <CardTitle>Registrazioni Tempo</CardTitle>
        </CardHeader>
        <CardContent>
          {!timeEntries?.length ? (
            <div className="text-center py-12 text-muted-foreground">
              Nessun inserimento di tempo trovato per questo progetto.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Utente</TableHead>
                  <TableHead>Attività</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Orario</TableHead>
                  <TableHead>Ore</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead>Note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {timeEntries.map((entry) => {
                  const hours = calculateHours(entry.scheduled_start_time, entry.scheduled_end_time);
                  const confirmed = isConfirmed(entry);
                  const userName = entry.profiles 
                    ? `${entry.profiles.first_name || ''} ${entry.profiles.last_name || ''}`.trim() 
                    : 'N/A';

                  return (
                    <TableRow key={entry.id}>
                      <TableCell>
                        {entry.scheduled_date 
                          ? format(new Date(entry.scheduled_date), 'dd/MM/yyyy', { locale: it })
                          : 'N/A'}
                      </TableCell>
                      <TableCell className="font-medium">{userName}</TableCell>
                      <TableCell>{entry.budget_items?.activity_name || 'N/A'}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{entry.budget_items?.category || 'N/A'}</Badge>
                      </TableCell>
                      <TableCell>
                        {entry.scheduled_start_time && entry.scheduled_end_time
                          ? `${entry.scheduled_start_time.slice(0, 5)} - ${entry.scheduled_end_time.slice(0, 5)}`
                          : 'N/A'}
                      </TableCell>
                      <TableCell>{hours.toFixed(1)}h</TableCell>
                      <TableCell>
                        {confirmed ? (
                          <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Confermata
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <Clock className="h-3 w-3 mr-1" />
                            Pianificata
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {entry.notes || '-'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
