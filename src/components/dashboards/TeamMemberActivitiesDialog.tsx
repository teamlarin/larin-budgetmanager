import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Calendar, Clock, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatHours } from '@/lib/utils';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { getCategoryBadgeColor } from '@/lib/categoryColors';

interface Activity {
  id: string;
  activity_name: string;
  project_name: string;
  category: string;
  scheduled_date: string;
  scheduled_start_time: string | null;
  scheduled_end_time: string | null;
  actual_start_time: string | null;
  actual_end_time: string | null;
}

interface TeamMemberActivitiesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberId: string | null;
  memberName: string;
  dateFrom: Date;
  dateTo: Date;
}

export const TeamMemberActivitiesDialog = ({
  open,
  onOpenChange,
  memberId,
  memberName,
  dateFrom,
  dateTo
}: TeamMemberActivitiesDialogProps) => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !memberId) return;

    const fetchActivities = async () => {
      setLoading(true);
      try {
        const fromDateStr = dateFrom.toISOString().split('T')[0];
        const toDateStr = dateTo.toISOString().split('T')[0];

        const { data, error } = await supabase
          .from('activity_time_tracking')
          .select(`
            id,
            scheduled_date,
            scheduled_start_time,
            scheduled_end_time,
            actual_start_time,
            actual_end_time,
            budget_items(
              activity_name,
              category,
              projects:project_id(name)
            )
          `)
          .eq('user_id', memberId)
          .gte('scheduled_date', fromDateStr)
          .lte('scheduled_date', toDateStr)
          .order('scheduled_date', { ascending: true })
          .order('scheduled_start_time', { ascending: true });

        if (error) throw error;

        const formattedActivities: Activity[] = (data || []).map((item: any) => ({
          id: item.id,
          activity_name: item.budget_items?.activity_name || 'Attività',
          project_name: item.budget_items?.projects?.name || '-',
          category: item.budget_items?.category || 'Altro',
          scheduled_date: item.scheduled_date,
          scheduled_start_time: item.scheduled_start_time,
          scheduled_end_time: item.scheduled_end_time,
          actual_start_time: item.actual_start_time,
          actual_end_time: item.actual_end_time
        }));

        setActivities(formattedActivities);
      } catch (error) {
        console.error('Error fetching member activities:', error);
        setActivities([]);
      } finally {
        setLoading(false);
      }
    };

    fetchActivities();
  }, [open, memberId, dateFrom, dateTo]);

  const calculateHours = (start: string | null, end: string | null, isActual: boolean = false): number => {
    if (!start || !end) return 0;
    const startDate = isActual ? new Date(start) : new Date(`2000-01-01T${start}`);
    const endDate = isActual ? new Date(end) : new Date(`2000-01-01T${end}`);
    return (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
  };

  const totalPlanned = activities.reduce((sum, a) => 
    sum + calculateHours(a.scheduled_start_time, a.scheduled_end_time), 0);
  const totalConfirmed = activities.reduce((sum, a) => 
    sum + calculateHours(a.actual_start_time, a.actual_end_time, true), 0);

  // Group activities by date
  const activitiesByDate = activities.reduce((acc, activity) => {
    const date = activity.scheduled_date;
    if (!acc[date]) acc[date] = [];
    acc[date].push(activity);
    return acc;
  }, {} as Record<string, Activity[]>);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Attività di {memberName}
          </DialogTitle>
          <div className="flex items-center gap-4 text-sm text-muted-foreground pt-2">
            <span>
              {format(dateFrom, 'd MMM', { locale: it })} - {format(dateTo, 'd MMM yyyy', { locale: it })}
            </span>
            <Badge variant="secondary">{activities.length} attività</Badge>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {formatHours(totalPlanned)} pianificate
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle className="h-3.5 w-3.5 text-primary" />
              {formatHours(totalConfirmed)} confermate
            </span>
          </div>
        </DialogHeader>

        <ScrollArea className="h-[500px] pr-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : activities.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Nessuna attività pianificata nel periodo selezionato
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(activitiesByDate).map(([date, dateActivities]) => (
                <div key={date}>
                  <div className="sticky top-0 bg-background pb-2 mb-2 border-b">
                    <span className="font-medium">
                      {format(new Date(date), 'EEEE d MMMM', { locale: it })}
                    </span>
                    <Badge variant="outline" className="ml-2">
                      {dateActivities.length} attività
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    {dateActivities.map((activity) => {
                      const planned = calculateHours(activity.scheduled_start_time, activity.scheduled_end_time);
                      const confirmed = calculateHours(activity.actual_start_time, activity.actual_end_time, true);
                      const isConfirmed = activity.actual_start_time && activity.actual_end_time;
                      const categoryBadgeClass = getCategoryBadgeColor(activity.category);

                      return (
                        <div
                          key={activity.id}
                          className="flex items-start justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                        >
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{activity.activity_name}</span>
                              <Badge 
                                variant="outline" 
                                className={`text-xs ${categoryBadgeClass}`}
                              >
                                {activity.category}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">{activity.project_name}</p>
                          </div>
                          <div className="flex items-center gap-3 text-sm">
                            <div className="text-right">
                              <div className="text-muted-foreground">
                                {activity.scheduled_start_time?.slice(0, 5)} - {activity.scheduled_end_time?.slice(0, 5)}
                              </div>
                              <div className="text-xs">
                                {formatHours(planned)} pianificate
                              </div>
                            </div>
                            {isConfirmed ? (
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            ) : (
                              <XCircle className="h-4 w-4 text-muted-foreground/50" />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
