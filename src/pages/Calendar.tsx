import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { format, isSameDay } from 'date-fns';
import { it } from 'date-fns/locale';
import { Clock, Play, Square, Calendar as CalendarIcon } from 'lucide-react';

interface Activity {
  id: string;
  activity_name: string;
  category: string;
  hours_worked: number;
  total_cost: number;
  project_id: string;
  project_name: string;
  assignee_id: string;
}

interface TimeTracking {
  id: string;
  budget_item_id: string;
  user_id: string;
  scheduled_date: string | null;
  scheduled_start_time: string | null;
  scheduled_end_time: string | null;
  actual_start_time: string | null;
  actual_end_time: string | null;
  notes: string | null;
  activity?: Activity;
}

export default function Calendar() {
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    scheduled_start_time: '',
    scheduled_end_time: '',
    notes: '',
  });

  // Get current user
  const { data: currentUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  // Get user's assigned activities
  const { data: activities = [], isLoading: activitiesLoading } = useQuery<Activity[]>({
    queryKey: ['user-activities', currentUser?.id],
    queryFn: async () => {
      if (!currentUser?.id) return [];
      
      const { data: budgetItems, error } = await supabase
        .from('budget_items')
        .select(`
          id,
          activity_name,
          category,
          hours_worked,
          total_cost,
          project_id,
          assignee_id,
          projects:project_id (
            name
          )
        `)
        .eq('is_product', false)
        .like('assignee_id', `%${currentUser.id}%`);

      if (error) throw error;

      return (budgetItems || []).map(item => ({
        ...item,
        project_name: (item as any).projects?.name || 'Progetto sconosciuto',
      }));
    },
    enabled: !!currentUser?.id,
  });

  // Get time tracking for selected date
  const { data: timeTracking = [], isLoading: trackingLoading } = useQuery<TimeTracking[]>({
    queryKey: ['time-tracking', currentUser?.id, format(selectedDate, 'yyyy-MM-dd')],
    queryFn: async () => {
      if (!currentUser?.id) return [];
      
      const { data, error } = await supabase
        .from('activity_time_tracking')
        .select(`
          *,
          budget_items:budget_item_id (
            id,
            activity_name,
            category,
            hours_worked,
            total_cost,
            project_id,
            assignee_id,
            projects:project_id (
              name
            )
          )
        `)
        .eq('user_id', currentUser.id)
        .eq('scheduled_date', format(selectedDate, 'yyyy-MM-dd'));

      if (error) throw error;

      return (data || []).map(item => ({
        ...item,
        activity: item.budget_items ? {
          ...(item as any).budget_items,
          project_name: (item as any).budget_items?.projects?.name || 'Progetto sconosciuto',
        } : undefined,
      }));
    },
    enabled: !!currentUser?.id,
  });

  const scheduleActivityMutation = useMutation({
    mutationFn: async (data: {
      budget_item_id: string;
      scheduled_date: string;
      scheduled_start_time: string;
      scheduled_end_time: string;
      notes: string;
    }) => {
      const { error } = await supabase
        .from('activity_time_tracking')
        .insert({
          ...data,
          user_id: currentUser?.id,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-tracking'] });
      toast.success('Attività pianificata con successo');
      setIsScheduleDialogOpen(false);
      setScheduleForm({ scheduled_start_time: '', scheduled_end_time: '', notes: '' });
    },
    onError: (error) => {
      console.error('Error scheduling activity:', error);
      toast.error('Errore durante la pianificazione');
    },
  });

  const startTrackingMutation = useMutation({
    mutationFn: async (trackingId: string) => {
      const { error } = await supabase
        .from('activity_time_tracking')
        .update({ actual_start_time: new Date().toISOString() })
        .eq('id', trackingId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-tracking'] });
      toast.success('Tracciamento avviato');
    },
    onError: (error) => {
      console.error('Error starting tracking:', error);
      toast.error('Errore durante l\'avvio del tracciamento');
    },
  });

  const stopTrackingMutation = useMutation({
    mutationFn: async (trackingId: string) => {
      const { error } = await supabase
        .from('activity_time_tracking')
        .update({ actual_end_time: new Date().toISOString() })
        .eq('id', trackingId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-tracking'] });
      toast.success('Tracciamento terminato');
    },
    onError: (error) => {
      console.error('Error stopping tracking:', error);
      toast.error('Errore durante l\'interruzione del tracciamento');
    },
  });

  const handleScheduleActivity = () => {
    if (!selectedActivity) return;
    
    scheduleActivityMutation.mutate({
      budget_item_id: selectedActivity.id,
      scheduled_date: format(selectedDate, 'yyyy-MM-dd'),
      scheduled_start_time: scheduleForm.scheduled_start_time,
      scheduled_end_time: scheduleForm.scheduled_end_time,
      notes: scheduleForm.notes,
    });
  };

  const calculateTrackedTime = (tracking: TimeTracking) => {
    if (!tracking.actual_start_time || !tracking.actual_end_time) return null;
    
    const start = new Date(tracking.actual_start_time);
    const end = new Date(tracking.actual_end_time);
    const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    
    return hours.toFixed(2);
  };

  const isLoading = activitiesLoading || trackingLoading;

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-96 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Calendario Attività</h1>
        <p className="text-muted-foreground">Pianifica e traccia il tempo delle tue attività</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              Seleziona Data
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CalendarComponent
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              locale={it}
              className="rounded-md border w-full"
            />
          </CardContent>
        </Card>

        {/* Daily Schedule */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                {format(selectedDate, 'EEEE dd MMMM yyyy', { locale: it })}
              </CardTitle>
              <Dialog open={isScheduleDialogOpen} onOpenChange={setIsScheduleDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => setSelectedActivity(null)}>
                    Pianifica Attività
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Pianifica Attività</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Seleziona Attività</Label>
                      <select
                        className="w-full mt-2 p-2 border rounded-md"
                        value={selectedActivity?.id || ''}
                        onChange={(e) => {
                          const activity = activities.find(a => a.id === e.target.value);
                          setSelectedActivity(activity || null);
                        }}
                      >
                        <option value="">Seleziona...</option>
                        {activities.map((activity) => (
                          <option key={activity.id} value={activity.id}>
                            {activity.activity_name} - {activity.project_name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label>Ora Inizio</Label>
                      <Input
                        type="time"
                        value={scheduleForm.scheduled_start_time}
                        onChange={(e) => setScheduleForm({ ...scheduleForm, scheduled_start_time: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Ora Fine</Label>
                      <Input
                        type="time"
                        value={scheduleForm.scheduled_end_time}
                        onChange={(e) => setScheduleForm({ ...scheduleForm, scheduled_end_time: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Note</Label>
                      <Textarea
                        value={scheduleForm.notes}
                        onChange={(e) => setScheduleForm({ ...scheduleForm, notes: e.target.value })}
                        placeholder="Aggiungi note..."
                      />
                    </div>
                    <Button 
                      className="w-full" 
                      onClick={handleScheduleActivity}
                      disabled={!selectedActivity || !scheduleForm.scheduled_start_time || !scheduleForm.scheduled_end_time}
                    >
                      Pianifica
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {timeTracking.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nessuna attività pianificata per questa data
              </p>
            ) : (
              <div className="space-y-4">
                {timeTracking
                  .sort((a, b) => {
                    const timeA = a.scheduled_start_time || '';
                    const timeB = b.scheduled_start_time || '';
                    return timeA.localeCompare(timeB);
                  })
                  .map((tracking) => {
                    const trackedTime = calculateTrackedTime(tracking);
                    const isTracking = tracking.actual_start_time && !tracking.actual_end_time;
                    
                    return (
                      <div
                        key={tracking.id}
                        className="flex items-start gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">
                              {tracking.activity?.activity_name}
                            </span>
                            <Badge variant="secondary">
                              {tracking.activity?.category}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {tracking.activity?.project_name}
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <Clock className="h-4 w-4" />
                            <span>
                              {tracking.scheduled_start_time?.substring(0, 5)} - {tracking.scheduled_end_time?.substring(0, 5)}
                            </span>
                            {trackedTime && (
                              <Badge variant="outline" className="ml-2">
                                {trackedTime}h tracciato
                              </Badge>
                            )}
                          </div>
                          {tracking.notes && (
                            <p className="text-sm text-muted-foreground italic">
                              {tracking.notes}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          {!tracking.actual_start_time && (
                            <Button
                              size="sm"
                              onClick={() => startTrackingMutation.mutate(tracking.id)}
                            >
                              <Play className="h-4 w-4" />
                            </Button>
                          )}
                          {isTracking && (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => stopTrackingMutation.mutate(tracking.id)}
                            >
                              <Square className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
