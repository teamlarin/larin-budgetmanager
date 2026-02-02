import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { format, startOfWeek, addDays, addWeeks, subWeeks, isSameDay, getDay } from 'date-fns';
import { it } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Clock, Users, X, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getCategoryBadgeColor, getDynamicCategorySolidColor } from '@/lib/categoryColors';

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
  activity?: {
    id: string;
    activity_name: string;
    category: string;
    project_name: string;
  };
}

interface UserProfile {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
}

const HOUR_HEIGHT = 40; // Smaller height for compact view
const WORK_START_HOUR = 8;
const WORK_END_HOUR = 20;

interface MultiUserCalendarViewProps {
  onClose: () => void;
  weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6;
}

export const MultiUserCalendarView = ({ onClose, weekStartsOn }: MultiUserCalendarViewProps) => {
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(
    startOfWeek(new Date(), { weekStartsOn })
  );
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());

  // Get all users
  const { data: allUsers = [] } = useQuery<UserProfile[]>({
    queryKey: ['all-users-for-multi-calendar'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, avatar_url')
        .eq('approved', true)
        .is('deleted_at', null)
        .order('first_name', { ascending: true });
      if (error) throw error;
      return data || [];
    }
  });

  // Get time tracking for selected users for the current week
  const { data: timeTrackingData = [] } = useQuery<TimeTracking[]>({
    queryKey: ['multi-user-time-tracking', selectedUserIds, format(currentWeekStart, 'yyyy-MM-dd')],
    queryFn: async () => {
      if (selectedUserIds.length === 0) return [];
      const startDate = format(currentWeekStart, 'yyyy-MM-dd');
      const endDate = format(addDays(currentWeekStart, 6), 'yyyy-MM-dd');
      
      const { data, error } = await supabase
        .from('activity_time_tracking')
        .select(`
          *,
          budget_items:budget_item_id (
            id,
            activity_name,
            category,
            projects:project_id (
              name
            )
          )
        `)
        .in('user_id', selectedUserIds)
        .gte('scheduled_date', startDate)
        .lte('scheduled_date', endDate);
      
      if (error) throw error;
      
      return (data || []).map(item => ({
        ...item,
        activity: item.budget_items ? {
          ...(item as any).budget_items,
          project_name: (item as any).budget_items?.projects?.name || 'Progetto sconosciuto'
        } : undefined
      }));
    },
    enabled: selectedUserIds.length > 0
  });

  // Week days
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i))
      .filter(day => {
        const dayOfWeek = getDay(day);
        return dayOfWeek !== 0 && dayOfWeek !== 6; // Exclude weekends
      });
  }, [currentWeekStart]);

  // Hours
  const visibleHours = useMemo(() => {
    return Array.from({ length: WORK_END_HOUR - WORK_START_HOUR + 1 }, (_, i) => WORK_START_HOUR + i);
  }, []);

  // Toggle user selection
  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  // Get activities for a specific user and day
  const getActivitiesForUserAndDay = (userId: string, day: Date) => {
    return timeTrackingData.filter(t => 
      t.user_id === userId && 
      t.scheduled_date === format(day, 'yyyy-MM-dd')
    );
  };

  // Calculate position and height for an activity
  const getActivityStyle = (tracking: TimeTracking) => {
    if (!tracking.scheduled_start_time || !tracking.scheduled_end_time) return null;
    
    const startMinutes = parseInt(tracking.scheduled_start_time.split(':')[0]) * 60 + 
                         parseInt(tracking.scheduled_start_time.split(':')[1]);
    const endMinutes = parseInt(tracking.scheduled_end_time.split(':')[0]) * 60 + 
                       parseInt(tracking.scheduled_end_time.split(':')[1]);
    
    const workStartMinutes = WORK_START_HOUR * 60;
    const relativeStart = startMinutes - workStartMinutes;
    const duration = endMinutes - startMinutes;
    
    return {
      top: (relativeStart / 60) * HOUR_HEIGHT,
      height: Math.max((duration / 60) * HOUR_HEIGHT, 20)
    };
  };

  // Get user initials
  const getUserInitials = (user: UserProfile) => {
    return ((user.first_name?.charAt(0) || '') + (user.last_name?.charAt(0) || '')).toUpperCase();
  };

  // Selected users info
  const selectedUsers = allUsers.filter(u => selectedUserIds.includes(u.id));

  return (
    <div className="fixed inset-0 z-50 bg-background">
      {/* Header */}
      <div className="border-b bg-background p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <Users className="h-5 w-5" />
                Confronto Calendari
              </h1>
              <p className="text-sm text-muted-foreground">
                Seleziona gli utenti per confrontare i loro calendari
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => setCurrentWeekStart(subWeeks(currentWeekStart, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-sm font-medium min-w-[180px] text-center">
              {format(currentWeekStart, 'd MMM', { locale: it })} - {format(addDays(currentWeekStart, 6), 'd MMM yyyy', { locale: it })}
            </div>
            <Button variant="outline" size="icon" onClick={() => setCurrentWeekStart(addWeeks(currentWeekStart, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button onClick={() => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn }))}>
              Oggi
            </Button>
          </div>
        </div>
        
        {/* Selected users badges */}
        {selectedUsers.length > 0 && (
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <span className="text-sm text-muted-foreground">Utenti selezionati:</span>
            {selectedUsers.map(user => (
              <Badge 
                key={user.id} 
                variant="secondary" 
                className="flex items-center gap-1 cursor-pointer hover:bg-destructive/20"
                onClick={() => toggleUserSelection(user.id)}
              >
                <Avatar className="h-4 w-4">
                  <AvatarImage src={user.avatar_url || undefined} />
                  <AvatarFallback className="text-[8px]">{getUserInitials(user)}</AvatarFallback>
                </Avatar>
                {user.first_name} {user.last_name}
                <X className="h-3 w-3 ml-1" />
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="flex h-[calc(100vh-120px)]">
        {/* User selector sidebar */}
        <div className="w-64 border-r bg-muted/30 p-4">
          <h3 className="font-medium mb-3">Seleziona Utenti</h3>
          <ScrollArea className="h-[calc(100vh-200px)]">
            <div className="space-y-2">
              {allUsers.map(user => (
                <div
                  key={user.id}
                  className={cn(
                    "flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors",
                    selectedUserIds.includes(user.id) 
                      ? "bg-primary/10 border border-primary/30" 
                      : "hover:bg-muted"
                  )}
                  onClick={() => toggleUserSelection(user.id)}
                >
                  <Checkbox 
                    checked={selectedUserIds.includes(user.id)}
                    onCheckedChange={() => toggleUserSelection(user.id)}
                  />
                  <Avatar 
                    className="h-8 w-8 cursor-pointer" 
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleUserSelection(user.id);
                    }}
                  >
                    <AvatarImage src={user.avatar_url || undefined} />
                    <AvatarFallback className="text-xs">{getUserInitials(user)}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium truncate">
                    {user.first_name} {user.last_name}
                  </span>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Calendar grid */}
        <div className="flex-1 overflow-auto">
          {selectedUserIds.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Seleziona almeno un utente dalla sidebar</p>
              </div>
            </div>
          ) : (
            <div className="min-w-max">
              {/* Day headers */}
              <div className="sticky top-0 z-10 bg-background border-b flex">
                <div className="w-16 flex-shrink-0" /> {/* Time column spacer */}
                {weekDays.map(day => (
                  <div 
                    key={day.toISOString()} 
                    className={cn(
                      "flex-1 min-w-[600px] text-center py-2 font-medium border-l",
                      isSameDay(day, new Date()) && "bg-primary/5"
                    )}
                  >
                    <div className="text-sm text-muted-foreground">
                      {format(day, 'EEEE', { locale: it })}
                    </div>
                    <div className={cn(
                      "text-lg",
                      isSameDay(day, new Date()) && "text-primary font-bold"
                    )}>
                      {format(day, 'd MMM', { locale: it })}
                    </div>
                    
                    {/* User columns header */}
                    <div className="flex mt-2 border-t pt-2">
                      {selectedUsers.map(user => (
                        <div 
                          key={user.id} 
                          className="flex-1 flex items-center justify-center gap-1 px-1"
                        >
                          <Avatar className="h-5 w-5">
                            <AvatarImage src={user.avatar_url || undefined} />
                            <AvatarFallback className="text-[8px]">{getUserInitials(user)}</AvatarFallback>
                          </Avatar>
                          <span className="text-xs truncate max-w-[80px]">
                            {user.first_name}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Time grid */}
              <div className="flex">
                {/* Time column */}
                <div className="w-16 flex-shrink-0">
                  {visibleHours.map(hour => (
                    <div 
                      key={hour} 
                      className="text-xs text-muted-foreground text-right pr-2 border-b"
                      style={{ height: HOUR_HEIGHT }}
                    >
                      {hour}:00
                    </div>
                  ))}
                </div>

                {/* Days with user columns */}
                {weekDays.map(day => (
                  <div 
                    key={day.toISOString()} 
                    className={cn(
                      "flex-1 min-w-[600px] border-l flex",
                      isSameDay(day, new Date()) && "bg-primary/5"
                    )}
                  >
                    {selectedUsers.map(user => (
                      <div 
                        key={user.id} 
                        className="flex-1 relative border-r last:border-r-0"
                      >
                        {/* Hour grid lines */}
                        {visibleHours.map(hour => (
                          <div 
                            key={hour}
                            className="border-b border-dashed border-muted"
                            style={{ height: HOUR_HEIGHT }}
                          />
                        ))}
                        
                        {/* Activities */}
                        {getActivitiesForUserAndDay(user.id, day).map(tracking => {
                          const style = getActivityStyle(tracking);
                          if (!style || !tracking.activity) return null;
                          
                          const isConfirmed = tracking.actual_start_time && tracking.actual_end_time;
                          
                          return (
                            <TooltipProvider key={tracking.id}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div
                                    className={cn(
                                      "absolute left-0.5 right-0.5 rounded text-[10px] p-1 overflow-hidden cursor-pointer transition-opacity hover:opacity-90",
                                      isConfirmed ? "bg-green-100 dark:bg-green-900/30 border-l-2 border-green-500" : "bg-card border-l-2 border-primary shadow-sm"
                                    )}
                                    style={{
                                      top: style.top,
                                      height: style.height
                                    }}
                                  >
                                    <div className="font-medium truncate flex items-center gap-1">
                                      {isConfirmed && <CheckCircle className="h-2.5 w-2.5 text-green-600 flex-shrink-0" />}
                                      {tracking.activity.activity_name}
                                    </div>
                                    {style.height > 30 && (
                                      <div className="text-muted-foreground truncate">
                                        {tracking.scheduled_start_time?.substring(0, 5)} - {tracking.scheduled_end_time?.substring(0, 5)}
                                      </div>
                                    )}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="right" className="max-w-[250px]">
                                  <div className="space-y-1">
                                    <p className="font-medium">{tracking.activity.activity_name}</p>
                                    <p className="text-xs text-muted-foreground">{tracking.activity.project_name}</p>
                                    <Badge className={cn("text-[10px]", getCategoryBadgeColor(tracking.activity.category))}>
                                      {tracking.activity.category}
                                    </Badge>
                                    <div className="flex items-center gap-1 text-xs">
                                      <Clock className="h-3 w-3" />
                                      {tracking.scheduled_start_time?.substring(0, 5)} - {tracking.scheduled_end_time?.substring(0, 5)}
                                    </div>
                                    {isConfirmed && (
                                      <Badge variant="outline" className="text-[10px] bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                                        Confermata
                                      </Badge>
                                    )}
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
