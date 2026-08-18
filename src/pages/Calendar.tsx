import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CalendarConfig } from '@/components/CalendarSettings';
import { useCalendarSettings } from '@/hooks/useCalendarSettings';
import { GoogleEvent } from '@/components/GoogleCalendarEvent';
import { CreateManualActivityDialog, RecurrenceData } from '@/components/CreateManualActivityDialog';
import { TimeSlotSelect } from '@/components/ui/time-slot-select';
import { toast } from 'sonner';
import { format, startOfWeek, addDays, addWeeks, subWeeks, isSameDay, parseISO, getDay, isBefore, addMonths } from 'date-fns';
import { it } from 'date-fns/locale';
import { Trash2, Search, CheckCircle } from 'lucide-react';
import { DndContext, DragEndEvent, DragOverlay, PointerSensor, useSensor, useSensors, closestCenter, Modifier } from '@dnd-kit/core';
import { useClosureDays } from '@/hooks/useClosureDays';
import { MultiUserCalendarView } from '@/components/MultiUserCalendarView';
import { formatHours } from '@/lib/utils';
import { calculateTimeMinutes, calculateSafeHours } from '@/lib/timeUtils';
import { logAction } from '@/hooks/useActionLogger';
import { useCalendarRealtime } from '@/hooks/useCalendarRealtime';

// Extracted components
import {
  Activity,
  TimeTracking,
  DragCreateState,
  DEFAULT_HOUR_HEIGHT,
  CALENDAR_VIEWER_ROLES,
  CALENDAR_EDITOR_ROLES,
  createLocalISOString,
} from '@/components/calendar/calendarTypes';
import { CalendarHeader } from '@/components/calendar/CalendarHeader';
import { CalendarSidebar } from '@/components/calendar/CalendarSidebar';
import type { PlannableTask } from '@/components/calendar/DraggableTask';
import { CalendarGrid } from '@/components/calendar/CalendarGrid';
import { WeeklyPlanningView, PlanningRow } from '@/components/calendar/WeeklyPlanningView';
import { PlanActivityHoursDialog } from '@/components/calendar/PlanActivityHoursDialog';
import { ActivityTaskSelect } from '@/components/calendar/ActivityTaskSelect';
import { buildBusyMap, distributeMinutesAcrossDays, findOverlappingSlot, getPlannableDays, minutesFromTimes } from '@/components/calendar/planningUtils';
import { ClientSelector } from '@/components/ClientSelector';
import { fetchAllClients } from '@/lib/fetchAllClients';

export default function Calendar() {
  const queryClient = useQueryClient();
  const { config, saveConfig, isLoading: isConfigLoading } = useCalendarSettings();
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(startOfWeek(new Date(), {
    weekStartsOn: 1
  }));
  const [viewMode, setViewMode] = useState<'week' | 'planning'>('week');
  const didApplyDefaultView = useRef(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [projectFilterOpen, setProjectFilterOpen] = useState(false);
  const [projectFilterSearch, setProjectFilterSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activitySearchQuery, setActivitySearchQuery] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedTracking, setSelectedTracking] = useState<TimeTracking | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [isDuplicateMode, setIsDuplicateMode] = useState(false);
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);
  const { getClosureDaysForDates, isClosureDay } = useClosureDays();

  // Sincronizzazione in tempo reale delle pianificazioni tra utenti
  useCalendarRealtime();

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const [isSidebarVisible, setIsSidebarVisible] = useState(() => {
    const saved = localStorage.getItem('calendar-sidebar-visible');
    return saved !== null ? saved === 'true' : true;
  });

  useEffect(() => {
    localStorage.setItem('calendar-sidebar-visible', String(isSidebarVisible));
  }, [isSidebarVisible]);

  const [showMultiUserView, setShowMultiUserView] = useState(false);
  const [hiddenGoogleEvents, setHiddenGoogleEvents] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('hiddenGoogleEvents');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [detailForm, setDetailForm] = useState({
    scheduled_date: '',
    scheduled_start_time: '',
    scheduled_end_time: '',
    notes: '',
    selectedProject: '',
    selectedActivity: '',
    client_id: '' as string,
    task_id: null as string | null
  });
  const [detailProjectSearch, setDetailProjectSearch] = useState('');

  const [dragCreateState, setDragCreateState] = useState<DragCreateState>({
    isCreating: false,
    startDate: null,
    startHour: 0,
    startMinutes: 0,
    currentMinutes: 0
  });
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createDialogData, setCreateDialogData] = useState({
    date: '',
    startTime: '',
    endTime: ''
  });

  const lastMousePositionRef = useRef<{ clientX: number; clientY: number } | null>(null);
  const dragStartOffsetRef = useRef<number>(0);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      lastMousePositionRef.current = { clientX: e.clientX, clientY: e.clientY };
    };
    document.addEventListener('mousemove', handleMouseMove);
    return () => document.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Drag-to-create handlers
  const handleDragCreateStart = useCallback((date: Date, hour: number, minutes: number) => {
    const closureDay = isClosureDay(date);
    if (closureDay) {
      toast.error(`Non puoi pianificare attività il ${format(date, 'd MMMM', { locale: it })}`, {
        description: `${closureDay.name} - Giorno di chiusura aziendale`
      });
      return;
    }

    setDragCreateState({
      isCreating: true,
      startDate: date,
      startHour: hour,
      startMinutes: minutes,
      currentMinutes: minutes + config.defaultSlotDuration
    });
  }, [isClosureDay]);

  const handleDragCreateMove = useCallback((e: MouseEvent) => {
    if (!dragCreateState.isCreating || !dragCreateState.startDate) return;
    const calendarGrid = document.querySelector('[data-calendar-grid]');
    if (!calendarGrid) return;
    const rect = calendarGrid.getBoundingClientRect();
    const relativeY = e.clientY - rect.top;
    const workDayStartHour = parseInt(config.workDayStart.split(':')[0]);
    const currentHourHeight = config.zoomLevel || DEFAULT_HOUR_HEIGHT;
    const totalMinutes = Math.floor(relativeY / currentHourHeight * 60) + workDayStartHour * 60;
    const snappedMinutes = Math.floor(totalMinutes / 15) * 15;
    setDragCreateState(prev => ({
      ...prev,
      currentMinutes: Math.max(prev.startMinutes + config.defaultSlotDuration, snappedMinutes)
    }));
  }, [dragCreateState.isCreating, dragCreateState.startDate, dragCreateState.startMinutes, config.workDayStart]);

  const handleDragCreateEnd = useCallback(() => {
    if (!dragCreateState.isCreating || !dragCreateState.startDate) return;
    const startMinutes = Math.min(dragCreateState.startMinutes, dragCreateState.currentMinutes);
    const endMinutes = Math.max(dragCreateState.startMinutes, dragCreateState.currentMinutes);
    const startHours = Math.floor(startMinutes / 60);
    const startMins = startMinutes % 60;
    const endHours = Math.floor(endMinutes / 60);
    const endMins = endMinutes % 60;
    const startTime = `${startHours.toString().padStart(2, '0')}:${startMins.toString().padStart(2, '0')}`;
    const endTime = `${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`;
    setCreateDialogData({
      date: format(dragCreateState.startDate, 'yyyy-MM-dd'),
      startTime,
      endTime
    });
    setCreateDialogOpen(true);
    setDragCreateState({
      isCreating: false,
      startDate: null,
      startHour: 0,
      startMinutes: 0,
      currentMinutes: 0
    });
  }, [dragCreateState]);

  useEffect(() => {
    if (dragCreateState.isCreating) {
      const handleMouseMove = (e: MouseEvent) => handleDragCreateMove(e);
      const handleMouseUp = () => handleDragCreateEnd();
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragCreateState.isCreating, handleDragCreateMove, handleDragCreateEnd]);

  const sensors = useSensors(useSensor(PointerSensor, {
    activationConstraint: { distance: 8 }
  }));

  const snapTo15MinModifier: Modifier = ({ transform }) => ({
    ...transform,
    y: Math.round(transform.y / 15) * 15,
  });

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Apply the user's default calendar view once settings are loaded
  useEffect(() => {
    if (isConfigLoading || didApplyDefaultView.current) return;
    didApplyDefaultView.current = true;
    if (config.defaultView === 'planning') setViewMode('planning');
  }, [isConfigLoading, config.defaultView]);


  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable) return;

      switch (e.key.toLowerCase()) {
        case 't':
          setCurrentWeekStart(startOfWeek(new Date(), {
            weekStartsOn: config.weekStartsOn as 0 | 1 | 2 | 3 | 4 | 5 | 6
          }));
          break;
        case 'arrowleft':
          e.preventDefault();
          setCurrentWeekStart(prev => subWeeks(prev, 1));
          break;
        case 'arrowright':
          e.preventDefault();
          setCurrentWeekStart(prev => addWeeks(prev, 1));
          break;
        case 'c':
          handleBatchConfirmRef.current?.();
          break;
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [config.weekStartsOn]);

  const handleConfigChange = async (newConfig: CalendarConfig) => {
    await saveConfig(newConfig);
    setCurrentWeekStart(startOfWeek(new Date(), {
      weekStartsOn: newConfig.weekStartsOn as 0 | 1 | 2 | 3 | 4 | 5 | 6
    }));
  };

  const weekDays = useMemo(() => {
    const days = Array.from({ length: config.numberOfDays }, (_, i) => addDays(currentWeekStart, i));
    if (!config.showWeekends) {
      return days.filter(day => {
        const dayOfWeek = getDay(day);
        return dayOfWeek !== 0 && dayOfWeek !== 6;
      });
    }
    return days;
  }, [currentWeekStart, config.numberOfDays, config.showWeekends]);


  const closureDaysMap = useMemo(() => getClosureDaysForDates(weekDays), [weekDays, getClosureDaysForDates]);

  const visibleHours = useMemo(() => {
    const startHour = parseInt(config.workDayStart.split(':')[0]);
    const endHour = parseInt(config.workDayEnd.split(':')[0]);
    return Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i);
  }, [config.workDayStart, config.workDayEnd]);

  const hourHeight = config.zoomLevel || DEFAULT_HOUR_HEIGHT;

  // ─── Queries ───────────────────────────────────────────────────────────────

  const { data: currentUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    }
  });

  const { data: userRole } = useQuery({
    queryKey: ['current-user-role', currentUser?.id],
    queryFn: async () => {
      if (!currentUser?.id) return null;
      const { data, error } = await supabase.from('user_roles').select('role').eq('user_id', currentUser.id).maybeSingle();
      if (error) throw error;
      return data?.role || null;
    },
    enabled: !!currentUser?.id
  });

  const canViewOtherUsers = userRole && CALENDAR_VIEWER_ROLES.includes(userRole);
  const isExternalUser = userRole === 'external';

  // For external users, fetch only admin-selected visible users
  const { data: externalAccessibleUserIds = [] } = useQuery<string[]>({
    queryKey: ['external-visible-users', currentUser?.id],
    queryFn: async () => {
      if (!currentUser?.id) return [];
      const { data, error } = await supabase
        .from('external_visible_users')
        .select('visible_user_id')
        .eq('external_user_id', currentUser.id);
      if (error) throw error;
      return (data || []).map(d => d.visible_user_id);
    },
    enabled: isExternalUser && !!currentUser?.id
  });

  const { data: allUsers = [] } = useQuery<{ id: string; first_name: string; last_name: string; avatar_url: string | null }[]>({
    queryKey: ['all-users-for-calendar', isExternalUser ? 'external' : 'normal', externalAccessibleUserIds],
    queryFn: async () => {
      if (isExternalUser) {
        // External users can only see team members of their assigned projects
        if (!externalAccessibleUserIds.length) return [];
        const { data, error } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, avatar_url')
          .eq('approved', true)
          .is('deleted_at', null)
          .in('id', externalAccessibleUserIds)
          .order('first_name', { ascending: true });
        if (error) throw error;
        return data || [];
      }
      const { data, error } = await supabase.from('profiles').select('id, first_name, last_name, avatar_url').eq('approved', true).is('deleted_at', null).order('first_name', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!canViewOtherUsers
  });

  const viewingUserId = selectedUserId || currentUser?.id;
  const isViewingOtherUser = selectedUserId !== null && selectedUserId !== currentUser?.id;
  const canEditOtherUsers = userRole && CALENDAR_EDITOR_ROLES.includes(userRole);
  const isReadOnly = isViewingOtherUser && (!canEditOtherUsers || isExternalUser);

  const { data: userContractData } = useQuery<{ contract_hours: number | null; contract_hours_period: string | null }>({
    queryKey: ['user-contract-data', viewingUserId],
    queryFn: async () => {
      if (!viewingUserId) return { contract_hours: null, contract_hours_period: null };
      const { fetchProfilesCompensation } = await import('@/lib/profilesCompensation');
      const rows = await fetchProfilesCompensation([viewingUserId]);
      const row = rows[0];
      return {
        contract_hours: row?.contract_hours ?? null,
        contract_hours_period: row?.contract_hours_period ?? null,
      };
    },
    enabled: !!viewingUserId
  });

  const weeklyContractHours = useMemo(() => {
    if (!userContractData?.contract_hours) return 0;
    switch (userContractData.contract_hours_period) {
      case 'daily': return userContractData.contract_hours * 5;
      case 'weekly': return userContractData.contract_hours;
      case 'monthly': return userContractData.contract_hours / 4;
      default: return userContractData.contract_hours / 4;
    }
  }, [userContractData]);

  const { data: activityCategories = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['activity-categories'],
    queryFn: async () => {
      const { data, error } = await supabase.from('activity_categories').select('id, name').order('name', { ascending: true });
      if (error) throw error;
      return data || [];
    }
  });

  const { data: activities = [], isLoading: isLoadingActivities, isError: isActivitiesError, refetch: refetchActivities } = useQuery<Activity[]>({
    queryKey: ['user-activities', viewingUserId],
    queryFn: async () => {
      if (!viewingUserId) return [];

      const { data: assignedActivities, error: assignedError } = await supabase
        .from('budget_items')
        .select(`id, activity_name, category, hours_worked, total_cost, project_id, assignee_id, is_product, projects:project_id (name, billing_type, status, project_status)`)
        .eq('assignee_id', viewingUserId)
        .neq('is_product', true);
      if (assignedError) throw assignedError;

      const assignedItemIds = (assignedActivities || []).map(a => a.id);

      const { data: timeTrackingData, error: timeError } = await supabase
        .from('activity_time_tracking')
        .select(`budget_item_id, scheduled_start_time, scheduled_end_time, actual_start_time, actual_end_time, google_event_id, scheduled_date, budget_items:budget_item_id (id, activity_name, category, hours_worked, total_cost, project_id, assignee_id, is_product, projects:project_id (name, billing_type, status, project_status))`)
        .eq('user_id', viewingUserId);
      if (timeError) throw timeError;

      const allBudgetItemIds = new Set(assignedItemIds);
      (timeTrackingData || []).forEach(t => allBudgetItemIds.add(t.budget_item_id));

      let allConfirmedData: any[] = [];
      const allItemIdsArray = Array.from(allBudgetItemIds);
      if (allItemIdsArray.length > 0) {
        for (let i = 0; i < allItemIdsArray.length; i += 25) {
          const batch = allItemIdsArray.slice(i, i + 25);
          const { data: batchData, error: confirmedError } = await supabase
            .from('activity_time_tracking')
            .select('budget_item_id, scheduled_start_time, scheduled_end_time, actual_start_time, actual_end_time')
            .in('budget_item_id', batch)
            .not('actual_start_time', 'is', null)
            .not('actual_end_time', 'is', null)
            .range(0, 4999);
          if (confirmedError) {
            // Non bloccare l'intera sidebar: le ore confermate di questo batch verranno mostrate a 0
            console.warn('[Calendar] Errore nel calcolo ore confermate (batch ignorato):', confirmedError);
            continue;
          }
          if (batchData) allConfirmedData = allConfirmedData.concat(batchData);
        }
      }


      const totalConfirmedHoursMap = new Map<string, number>();
      allConfirmedData.forEach(tracking => {
        if (tracking.scheduled_start_time && tracking.scheduled_end_time) {
          const durationMinutes = calculateTimeMinutes(tracking.scheduled_start_time, tracking.scheduled_end_time);
          totalConfirmedHoursMap.set(tracking.budget_item_id, (totalConfirmedHoursMap.get(tracking.budget_item_id) || 0) + durationMinutes / 60);
        }
      });


      const activityPlannedMap = new Map<string, number>();
      (timeTrackingData || []).forEach(tracking => {
        if (tracking.scheduled_start_time && tracking.scheduled_end_time) {
          const durationMinutes = calculateTimeMinutes(tracking.scheduled_start_time, tracking.scheduled_end_time);
          if (!tracking.actual_start_time || !tracking.actual_end_time) {
            activityPlannedMap.set(tracking.budget_item_id, (activityPlannedMap.get(tracking.budget_item_id) || 0) + durationMinutes / 60);
          }
        }
      });

      const activityMap = new Map<string, Activity>();

      (assignedActivities || []).forEach(budgetItem => {
        if (budgetItem.category?.toLowerCase() === 'import') return;
        const project = (budgetItem as any).projects;
        if (project?.status === 'archiviato' || project?.project_status === 'completato') return;
        const confirmedHours = totalConfirmedHoursMap.get(budgetItem.id) || 0;
        const plannedHours = activityPlannedMap.get(budgetItem.id) || 0;
        activityMap.set(budgetItem.id, {
          id: budgetItem.id,
          activity_name: budgetItem.activity_name,
          category: budgetItem.category,
          hours_worked: budgetItem.hours_worked,
          total_cost: budgetItem.total_cost,
          project_id: budgetItem.project_id || '',
          assignee_id: budgetItem.assignee_id || '',
          project_name: project?.name || 'Progetto sconosciuto',
          confirmed_hours: confirmedHours,
          planned_hours: plannedHours,
          billing_type: project?.billing_type
        });
      });

      // Includi ogni attività su cui l'utente ha registrazioni tempo, anche se
      // l'assegnatario non è lui (es. attività assegnate a un livello) e anche se
      // la registrazione arriva da Google Calendar o è più vecchia di 30 giorni.
      (timeTrackingData || []).forEach(tracking => {
        const budgetItem = (tracking as any).budget_items;
        if (budgetItem && !budgetItem.is_product && budgetItem.category?.toLowerCase() !== 'import' && !activityMap.has(budgetItem.id)) {
          const project = budgetItem.projects;

          if (project?.status === 'archiviato' || project?.project_status === 'completato') return;
          const confirmedHours2 = totalConfirmedHoursMap.get(budgetItem.id) || 0;
          const plannedHours2 = activityPlannedMap.get(budgetItem.id) || 0;
          activityMap.set(budgetItem.id, {
            id: budgetItem.id,
            activity_name: budgetItem.activity_name,
            category: budgetItem.category,
            hours_worked: budgetItem.hours_worked,
            total_cost: budgetItem.total_cost,
            project_id: budgetItem.project_id,
            assignee_id: budgetItem.assignee_id,
            project_name: project?.name || 'Progetto sconosciuto',
            confirmed_hours: confirmedHours2,
            planned_hours: plannedHours2,
            billing_type: project?.billing_type
          });
        }
      });

      return Array.from(activityMap.values());
    },
    enabled: !!viewingUserId
  });

  const { data: completedActivitiesData = [] } = useQuery<{ budget_item_id: string; completed_at: string }[]>({
    queryKey: ['user-completed-activities', viewingUserId],
    queryFn: async () => {
      if (!viewingUserId) return [];
      const { data, error } = await supabase.from('user_activity_completions').select('budget_item_id, completed_at').eq('user_id', viewingUserId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!viewingUserId
  });

  const completedActivities = useMemo(() => completedActivitiesData.map(d => d.budget_item_id), [completedActivitiesData]);
  const activeActivities = useMemo(() => activities.filter(a => !completedActivities.includes(a.id)), [activities, completedActivities]);
  const completedActivitiesWithInfo = useMemo(() => {
    return activities
      .filter(a => completedActivities.includes(a.id))
      .map(a => {
        const completionData = completedActivitiesData.find(c => c.budget_item_id === a.id);
        return { ...a, completed_at: completionData?.completed_at || null };
      });
  }, [activities, completedActivities, completedActivitiesData]);

  const { data: timeTracking = [] } = useQuery<TimeTracking[]>({
    queryKey: ['time-tracking', viewingUserId, format(currentWeekStart, 'yyyy-MM-dd')],
    queryFn: async () => {
      if (!viewingUserId) return [];
      const startDate = format(currentWeekStart, 'yyyy-MM-dd');
      const endDate = format(addDays(currentWeekStart, 6), 'yyyy-MM-dd');
      const { data, error } = await supabase.from('activity_time_tracking').select(`*, project_tasks:task_id (id, title), budget_items:budget_item_id (id, activity_name, category, hours_worked, total_cost, project_id, assignee_id, projects:project_id (name, billing_type))`).eq('user_id', viewingUserId).gte('scheduled_date', startDate).lte('scheduled_date', endDate);
      if (error) throw error;
      return (data || []).map(item => ({
        ...item,
        task: (item as any).project_tasks || null,
        activity: item.budget_items ? {
          ...(item as any).budget_items,
          project_name: (item as any).budget_items?.projects?.name || 'Progetto sconosciuto',
          billing_type: (item as any).budget_items?.projects?.billing_type
        } : undefined
      }));
    },
    enabled: !!viewingUserId
  });

  const canViewAllProjects = userRole && ['admin', 'finance', 'team_leader', 'coordinator', 'account'].includes(userRole);

  const { data: accessibleProjects = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['accessible-projects-for-google', currentUser?.id, canViewAllProjects],
    queryFn: async () => {
      if (!currentUser?.id) return [];
      const { data: leaderProjects, error: leaderError } = await supabase
        .from('projects').select('id, name').eq('status', 'approvato')
        .neq('project_status', 'completato')
        .or(`project_leader_id.eq.${currentUser.id},account_user_id.eq.${currentUser.id}`)
        .order('name', { ascending: true });
      if (leaderError) throw leaderError;

      const { data: memberProjects, error: memberError } = await supabase
        .from('project_members').select('project_id, projects:project_id(id, name, status, project_status)').eq('user_id', currentUser.id);
      if (memberError) throw memberError;

      const projectsMap = new Map<string, { id: string; name: string }>();
      (leaderProjects || []).forEach(p => projectsMap.set(p.id, { id: p.id, name: p.name }));
      (memberProjects || []).forEach(m => {
        const proj = (m as any).projects;
        if (proj && proj.status === 'approvato' && proj.project_status !== 'completato') {
          projectsMap.set(proj.id, { id: proj.id, name: proj.name });
        }
      });
      return Array.from(projectsMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    },
    enabled: !!currentUser?.id
  });

  const { data: accessibleActivities = [] } = useQuery<{ id: string; activity_name: string; project_id: string; project_name: string; category: string; hours_worked: number }[]>({
    queryKey: ['accessible-activities-for-google', accessibleProjects],
    queryFn: async () => {
      if (accessibleProjects.length === 0) return [];
      const projectIds = accessibleProjects.map(p => p.id);
      const { data, error } = await supabase
        .from('budget_items')
        .select(`id, activity_name, category, hours_worked, project_id, is_product, projects:project_id(name)`)
        .in('project_id', projectIds).eq('is_product', false).neq('category', 'Import')
        .order('activity_name', { ascending: true });
      if (error) throw error;
      return (data || []).map(item => ({
        id: item.id, activity_name: item.activity_name, project_id: item.project_id,
        project_name: (item as any).projects?.name || 'Progetto sconosciuto', category: item.category, hours_worked: item.hours_worked
      }));
    },
    enabled: accessibleProjects.length > 0
  });

  

  const { data: googleEvents = [] } = useQuery<GoogleEvent[]>({
    queryKey: ['google-calendar-events', format(currentWeekStart, 'yyyy-MM-dd'), isGoogleConnected, viewingUserId],
    queryFn: async () => {
      // For self: require own Google connection. For other users: always try (function returns connected:false otherwise).
      if (!isViewingOtherUser && !isGoogleConnected) return [];
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return [];
      const startDate = currentWeekStart.toISOString();
      const endDate = addDays(currentWeekStart, 7).toISOString();
      try {
        const targetParam = isViewingOtherUser ? `&targetUserId=${encodeURIComponent(viewingUserId!)}` : '';
        const response = await fetch(`https://dmwyqyqaseyuybqfawvk.supabase.co/functions/v1/google-calendar-events?action=events&timeMin=${encodeURIComponent(startDate)}&timeMax=${encodeURIComponent(endDate)}${targetParam}`, {
          headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }
        });
        const data = await response.json();
        if (!data.connected || !data.events) return [];
        const events: GoogleEvent[] = data.events;

        if (events.length > 0 && viewingUserId) {
          const eventIds = events.map(e => e.id);
          const { data: linkedEntries } = await supabase
            .from('activity_time_tracking').select('id, google_event_id, google_event_title, scheduled_date')
            .eq('user_id', viewingUserId).in('google_event_id', eventIds);

          if (linkedEntries && linkedEntries.length > 0) {
            let hasUpdates = false;
            for (const entry of linkedEntries) {
              const gEvent = events.find(e => e.id === entry.google_event_id);
              if (!gEvent) continue;
              const eventStart = parseISO(gEvent.start);
              const newDate = format(eventStart, 'yyyy-MM-dd');
              const newTitle = gEvent.title || '';
              if (entry.google_event_title !== newTitle || entry.scheduled_date !== newDate) {
                hasUpdates = true;
                await supabase.from('activity_time_tracking').update({ google_event_title: newTitle, scheduled_date: newDate, notes: newTitle }).eq('id', entry.id);
              }
            }
            if (hasUpdates) queryClient.invalidateQueries({ queryKey: ['time-tracking'] });
          }
        }
        return events;
      } catch (error) {
        console.error('Error fetching Google events:', error);
        return [];
      }
    },
    enabled: isGoogleConnected || isViewingOtherUser
  });

  // ─── Mutations ─────────────────────────────────────────────────────────────

  const convertGoogleEventMutation = useMutation({
    mutationFn: async ({ event, budgetItemId, customDate, customStartTime, customEndTime }: { event: GoogleEvent; budgetItemId: string; customDate?: string; customStartTime?: string; customEndTime?: string }) => {
      if (!currentUser?.id) throw new Error('No user');
      const eventStart = parseISO(event.start);
      const eventEnd = parseISO(event.end);
      const scheduledDate = customDate || format(eventStart, 'yyyy-MM-dd');
      const scheduledStartTime = customStartTime || (event.allDay ? '09:00' : format(eventStart, 'HH:mm'));
      let computedEndTime = customEndTime || (event.allDay ? '10:00' : format(eventEnd, 'HH:mm'));
      if (computedEndTime === '00:00' || computedEndTime <= scheduledStartTime) {
        const [h, m] = scheduledStartTime.split(':').map(Number);
        computedEndTime = `${String(Math.min(h + 1, 23)).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      }
      const scheduledEndTime = computedEndTime;
      const { error } = await supabase.from('activity_time_tracking').insert({
        budget_item_id: budgetItemId, user_id: currentUser.id, scheduled_date: scheduledDate,
        scheduled_start_time: scheduledStartTime, scheduled_end_time: scheduledEndTime,
        notes: event.title || '', google_event_id: event.id, google_event_title: event.title
      });
      if (error) throw error;
      return event.id;
    },
    onSuccess: (googleEventId) => {
      logAction({ actionType: 'create', actionDescription: 'Collegato evento Google a time entry', entityType: 'timesheet' });
      handleHideGoogleEvent(googleEventId);
      queryClient.invalidateQueries({ queryKey: ['time-tracking'] });
      queryClient.invalidateQueries({ queryKey: ['user-activities'] });
      toast.success('Evento Google collegato all\'attività');
    },
    onError: error => { console.error('Error linking Google event:', error); toast.error('Errore durante il collegamento'); }
  });

  // Validates that a client can be attached to a time entry:
  // allowed only when the activity's project is of type "interno" and the client exists.
  const resolveValidClientId = async (budgetItemId: string, clientId?: string | null): Promise<string | null> => {
    if (!clientId) return null;
    const { data: item, error } = await supabase
      .from('budget_items')
      .select('id, project_id, projects:project_id (billing_type)')
      .eq('id', budgetItemId)
      .maybeSingle();
    if (error) throw error;
    if ((item as any)?.projects?.billing_type !== 'interno') throw new Error('CLIENT_NOT_ALLOWED');
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id')
      .eq('id', clientId)
      .maybeSingle();
    if (clientError) throw clientError;
    if (!client) throw new Error('CLIENT_NOT_FOUND');
    return clientId;
  };

  // Quando si pianifica del tempo su una task ancora "da fare", la si porta a "in corso".
  const markTaskInProgress = async (taskId?: string | null) => {
    if (!taskId) return;
    const { error } = await supabase
      .from('project_tasks')
      .update({ status: 'in_progress' })
      .eq('id', taskId)
      .eq('status', 'todo');
    if (error) console.error('Error updating task status:', error);
  };

  const invalidateTaskQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['project-tasks'] });
    queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
    queryClient.invalidateQueries({ queryKey: ['activity-tasks'] });
  };

  /**
   * Controllo conflitti centralizzato: nessuna attività/task della stessa persona
   * può occupare gli stessi minuti. Legge dal DB così il controllo vale anche per
   * slot fuori dalla settimana visualizzata.
   */
  const assertNoSlotConflict = async (
    ranges: { date: string; startTime: string; endTime: string }[],
    excludeIds: string[] = []
  ) => {
    if (!viewingUserId || ranges.length === 0) return;
    const dates = [...new Set(ranges.map(r => r.date))];
    const { data, error } = await supabase
      .from('activity_time_tracking')
      .select('id, scheduled_date, scheduled_start_time, scheduled_end_time, budget_item_id, task_id, project_tasks:task_id (title)')
      .eq('user_id', viewingUserId)
      .in('scheduled_date', dates);
    if (error) throw error;

    for (const range of ranges) {
      const conflict = findOverlappingSlot(
        (data ?? []) as unknown as { id: string; scheduled_date: string | null; scheduled_start_time: string | null; scheduled_end_time: string | null; budget_item_id?: string; project_tasks?: { title: string } | null }[],
        { date: range.date, startTime: range.startTime, endTime: range.endTime, excludeIds }
      );
      if (!conflict) continue;
      const conflictActivity = activities.find(a => a.id === conflict.budget_item_id);
      const taskTitle = conflict.project_tasks?.title;
      const label = taskTitle
        ? `la task "${taskTitle}"`
        : conflictActivity ? `"${conflictActivity.activity_name}"` : 'un altro impegno';
      const err = new Error(
        `${format(parseISO(range.date), 'd MMMM', { locale: it })} ${range.startTime.substring(0, 5)}-${range.endTime.substring(0, 5)} è già occupato da ${label} (${conflict.scheduled_start_time?.substring(0, 5)}-${conflict.scheduled_end_time?.substring(0, 5)}). Scegli un orario libero.`
      );
      err.name = 'SLOT_OVERLAP';
      throw err;
    }
  };

  const handleSlotMutationError = (error: Error) => {
    if (error.name === 'SLOT_OVERLAP') {
      toast.error('Slot già occupato', { description: error.message });
      return true;
    }
    return false;
  };


  const clientErrorMessage = (error: unknown): string | null => {
    const msg = error instanceof Error ? error.message : '';
    if (msg === 'CLIENT_NOT_ALLOWED') return 'Il cliente può essere associato solo alle attività di progetti INTERNO';
    if (msg === 'CLIENT_NOT_FOUND') return 'Il cliente selezionato non è valido o non esiste più';
    return null;
  };

  const scheduleActivityMutation = useMutation({
    mutationFn: async (data: { budget_item_id: string; scheduled_date: string; scheduled_start_time: string; scheduled_end_time: string; notes?: string; client_id?: string | null; task_id?: string | null; recurrence?: RecurrenceData }) => {
      const { recurrence, ...baseData } = data;
      const validClientId = await resolveValidClientId(baseData.budget_item_id, baseData.client_id);
      const datesToCreate: string[] = [data.scheduled_date];

      if (recurrence?.is_recurring && recurrence.recurrence_type !== 'none') {
        const startDate = parseISO(data.scheduled_date);
        let currentDate = startDate;
        const interval = recurrence.recurrence_interval || 1;
        const daysOfWeek = recurrence.recurrence_days_of_week || [];

        const getNextDate = (date: Date): Date => {
          switch (recurrence.recurrence_type) {
            case 'daily': return addDays(date, interval);
            case 'weekly': return addDays(date, 1);
            case 'monthly': return addMonths(date, 1);
            default: return addDays(date, 7);
          }
        };
        const shouldIncludeDate = (date: Date): boolean => {
          if (recurrence.recurrence_type === 'weekly' && daysOfWeek.length > 0) return daysOfWeek.includes(date.getDay());
          return true;
        };

        if (recurrence.recurrence_end_date) {
          const endDate = parseISO(recurrence.recurrence_end_date);
          while (currentDate < endDate) {
            currentDate = getNextDate(currentDate);
            if (currentDate <= endDate && shouldIncludeDate(currentDate)) datesToCreate.push(format(currentDate, 'yyyy-MM-dd'));
          }
        } else if (recurrence.recurrence_count) {
          let count = 1;
          while (count < recurrence.recurrence_count) {
            currentDate = getNextDate(currentDate);
            if (shouldIncludeDate(currentDate)) { datesToCreate.push(format(currentDate, 'yyyy-MM-dd')); count++; }
            if (datesToCreate.length > 365) break;
          }
        }
      }

      await assertNoSlotConflict(
        datesToCreate.map(date => ({ date, startTime: baseData.scheduled_start_time, endTime: baseData.scheduled_end_time }))
      );

      const { data: parentActivity, error: parentError } = await supabase.from('activity_time_tracking').insert({
        budget_item_id: baseData.budget_item_id, scheduled_date: datesToCreate[0],
        scheduled_start_time: baseData.scheduled_start_time, scheduled_end_time: baseData.scheduled_end_time,
        notes: baseData.notes, user_id: viewingUserId, client_id: validClientId, task_id: baseData.task_id || null,
        is_recurring: recurrence?.is_recurring || false, recurrence_type: recurrence?.recurrence_type || 'none',
        recurrence_end_date: recurrence?.recurrence_end_date || null, recurrence_count: recurrence?.recurrence_count || null
      }).select('id').single();
      if (parentError) throw parentError;

      if (datesToCreate.length > 1 && parentActivity) {
        const childActivities = datesToCreate.slice(1).map(date => ({
          budget_item_id: baseData.budget_item_id, scheduled_date: date,
          scheduled_start_time: baseData.scheduled_start_time, scheduled_end_time: baseData.scheduled_end_time,
          notes: baseData.notes, user_id: viewingUserId, client_id: validClientId, task_id: baseData.task_id || null,
          is_recurring: true, recurrence_type: recurrence?.recurrence_type || 'none',
          recurrence_parent_id: parentActivity.id
        }));
        const { error: childError } = await supabase.from('activity_time_tracking').insert(childActivities as never);
        if (childError) throw childError;
      }
      await markTaskInProgress(baseData.task_id);
    },
    onSuccess: () => {
      logAction({ actionType: 'create', actionDescription: 'Pianificata nuova time entry', entityType: 'timesheet' });
      queryClient.invalidateQueries({ queryKey: ['time-tracking'] });
      queryClient.invalidateQueries({ queryKey: ['user-activities'] });
      invalidateTaskQueries();
      toast.success('Attività pianificata');
    },
    onError: (error: Error) => {
      if (handleSlotMutationError(error)) return;
      console.error('Error scheduling activity:', error);
      toast.error(clientErrorMessage(error) || 'Errore durante la pianificazione');
    }
  });

  // ─── Weekly planning ───────────────────────────────────────────────────────

  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [planEditRow, setPlanEditRow] = useState<PlanningRow | null>(null);

  const planWeeklyHoursMutation = useMutation({
    mutationFn: async ({ budget_item_id, minutes, task_id }: { budget_item_id: string; minutes: number; task_id?: string | null }) => {
      if (!viewingUserId) throw new Error('No user');

      // Remove existing non-confirmed slots of the week for this activity (edit mode)
      const existing = timeTracking.filter(t => t.budget_item_id === budget_item_id);
      const confirmedMinutes = existing
        .filter(t => t.actual_start_time && t.actual_end_time)
        .reduce((sum, t) => sum + minutesFromTimes(t.scheduled_start_time, t.scheduled_end_time), 0);
      const toDelete = existing.filter(t => !(t.actual_start_time && t.actual_end_time));
      if (toDelete.length > 0) {
        const { error: delError } = await supabase
          .from('activity_time_tracking')
          .delete()
          .in('id', toDelete.map(t => t.id));
        if (delError) throw delError;
      }

      const targetMinutes = Math.max(0, minutes - confirmedMinutes);
      if (targetMinutes === 0) return { unallocatedMinutes: 0, created: 0 };

      const remainingTrackings = timeTracking.filter(t => !toDelete.some(d => d.id === t.id));
      const busyByDate = buildBusyMap(remainingTrackings);

      const days = getPlannableDays({
        weekStart: currentWeekStart,
        numberOfDays: config.numberOfDays,
        showWeekends: config.showWeekends,
        isClosureDay: (date: Date) => isClosureDay(date),
      });
      const daysToUse = days.length > 0
        ? days
        : getPlannableDays({
            weekStart: currentWeekStart,
            numberOfDays: config.numberOfDays,
            showWeekends: config.showWeekends,
            isClosureDay: (date: Date) => isClosureDay(date),
            skipPastDays: false,
          });

      const { slots, unallocatedMinutes } = distributeMinutesAcrossDays({
        totalMinutes: targetMinutes,
        days: daysToUse,
        workDayStart: config.workDayStart,
        workDayEnd: config.workDayEnd,
        busyByDate,
      });

      if (slots.length > 0) {
        const { error } = await supabase.from('activity_time_tracking').insert(
          slots.map(slot => ({
            budget_item_id,
            user_id: viewingUserId,
            scheduled_date: slot.scheduled_date,
            scheduled_start_time: slot.scheduled_start_time,
            scheduled_end_time: slot.scheduled_end_time,
            task_id: task_id || null,
          })) as never
        );
        if (error) throw error;
        await markTaskInProgress(task_id);
      }

      return { unallocatedMinutes, created: slots.length };
    },
    onSuccess: (result) => {
      logAction({ actionType: 'create', actionDescription: 'Pianificazione settimanale attività', entityType: 'timesheet' });
      queryClient.invalidateQueries({ queryKey: ['time-tracking'] });
      queryClient.invalidateQueries({ queryKey: ['user-activities'] });
      invalidateTaskQueries();
      setPlanDialogOpen(false);
      setPlanEditRow(null);
      if (result && result.unallocatedMinutes > 0 && result.created === 0) {
        toast.error('Impossibile riallocare le ore', {
          description: `Nessuno slot libero in questa settimana: ${formatHours(result.unallocatedMinutes / 60)} non pianificate. Libera spazio negli orari di lavoro o scegli un'altra settimana.`,
        });
      } else if (result && result.unallocatedMinutes > 0) {
        toast.warning('Ore pianificate solo in parte', {
          description: `${formatHours(result.unallocatedMinutes / 60)} non trovano spazio libero in questa settimana.`,
        });
      } else {
        toast.success('Ore pianificate nella settimana');
      }
    },
    onError: error => { console.error('Error planning weekly hours:', error); toast.error('Errore durante la pianificazione settimanale'); }
  });

  const removeWeeklyPlanMutation = useMutation({
    mutationFn: async (row: PlanningRow) => {
      const toDelete = row.slots.filter(t => !(t.actual_start_time && t.actual_end_time));
      if (toDelete.length === 0) return { deleted: 0, keptConfirmed: row.slots.length };
      const { error } = await supabase
        .from('activity_time_tracking')
        .delete()
        .in('id', toDelete.map(t => t.id));
      if (error) throw error;
      return { deleted: toDelete.length, keptConfirmed: row.slots.length - toDelete.length };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['time-tracking'] });
      queryClient.invalidateQueries({ queryKey: ['user-activities'] });
      if (result.deleted === 0) {
        toast.info('Tutte le ore di questa attività sono già confermate e non sono state rimosse');
      } else if (result.keptConfirmed > 0) {
        toast.success('Ore pianificate rimosse. Le ore già confermate sono state mantenute');
      } else {
        toast.success('Attività rimossa dalla settimana');
      }
    },
    onError: error => { console.error('Error removing weekly plan:', error); toast.error('Errore durante la rimozione'); }
  });

  const updateTrackingTimeMutation = useMutation({
    mutationFn: async ({ trackingId, startTime, endTime, isConfirmed, scheduledDate }: { trackingId: string; startTime: string; endTime: string; isConfirmed?: boolean; scheduledDate?: string }) => {
      const targetDate = scheduledDate ?? timeTracking.find(t => t.id === trackingId)?.scheduled_date ?? null;
      if (targetDate) {
        const conflict = findOverlappingSlot(timeTracking, {
          date: targetDate,
          startTime,
          endTime,
          excludeIds: [trackingId],
        });
        if (conflict) {
          const conflictActivity = activities.find(a => a.id === conflict.budget_item_id);
          const label = conflictActivity ? `"${conflictActivity.activity_name}"` : 'un altro impegno';
          const err = new Error(
            `L'orario ${startTime}-${endTime} si sovrappone a ${label} (${conflict.scheduled_start_time?.substring(0, 5)}-${conflict.scheduled_end_time?.substring(0, 5)}). Scegli un orario libero.`
          );
          err.name = 'SLOT_OVERLAP';
          throw err;
        }
      }

      const updateData: Record<string, any> = { scheduled_start_time: startTime, scheduled_end_time: endTime };
      if (isConfirmed && scheduledDate) {
        updateData.actual_start_time = createLocalISOString(scheduledDate, startTime);
        updateData.actual_end_time = createLocalISOString(scheduledDate, endTime);
      }
      const { error } = await supabase.from('activity_time_tracking').update(updateData as never).eq('id', trackingId);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['time-tracking'] }); queryClient.invalidateQueries({ queryKey: ['user-activities'] }); },
    onError: (error: Error) => {
      if (error.name === 'SLOT_OVERLAP') {
        toast.error('Slot sovrapposto: modifica non applicata', { description: error.message });
        return;
      }
      console.error('Error updating tracking time:', error);
      toast.error('Errore durante l\'aggiornamento');
    }
  });

  const moveTrackingMutation = useMutation({
    mutationFn: async ({ trackingId, newDate, newStartTime, newEndTime, isConfirmed }: { trackingId: string; newDate: string; newStartTime: string; newEndTime: string; isConfirmed?: boolean }) => {
      // Overlap guard: no two slots of the same person can share the same minutes
      if (viewingUserId) {
        const { data: sameDaySlots, error: fetchError } = await supabase
          .from('activity_time_tracking')
          .select('id, scheduled_date, scheduled_start_time, scheduled_end_time, budget_item_id')
          .eq('user_id', viewingUserId)
          .eq('scheduled_date', newDate);
        if (fetchError) throw fetchError;

        const conflict = findOverlappingSlot(sameDaySlots ?? [], {
          date: newDate,
          startTime: newStartTime,
          endTime: newEndTime,
          excludeIds: [trackingId],
        });
        if (conflict) {
          const conflictActivity = activities.find(a => a.id === (conflict as { budget_item_id?: string }).budget_item_id);
          const label = conflictActivity ? `"${conflictActivity.activity_name}"` : 'un altro impegno';
          const err = new Error(
            `${format(parseISO(newDate), 'd MMMM', { locale: it })} ${conflict.scheduled_start_time?.substring(0, 5)}-${conflict.scheduled_end_time?.substring(0, 5)} è già occupato da ${label}. Scegli un orario libero.`
          );
          err.name = 'SLOT_OVERLAP';
          throw err;
        }
      }

      const updateData: Record<string, any> = { scheduled_date: newDate, scheduled_start_time: newStartTime, scheduled_end_time: newEndTime };
      if (isConfirmed) {
        updateData.actual_start_time = createLocalISOString(newDate, newStartTime);
        updateData.actual_end_time = createLocalISOString(newDate, newEndTime);
      }
      const { error } = await supabase.from('activity_time_tracking').update(updateData as never).eq('id', trackingId);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['time-tracking'] }); queryClient.invalidateQueries({ queryKey: ['user-activities'] }); toast.success('Attività spostata'); },
    onError: (error: Error) => {
      if (error.name === 'SLOT_OVERLAP') {
        toast.error('Slot sovrapposto: impossibile riallocare le ore', { description: error.message });
        return;
      }
      console.error('Error moving tracking:', error);
      toast.error('Errore durante lo spostamento');
    }
  });

  const updateTrackingDetailMutation = useMutation({
    mutationFn: async ({ trackingId, updates }: { trackingId: string; updates: Partial<TimeTracking> }) => {
      const payload = { ...updates };
      if ('client_id' in payload) {
        const budgetItemId = payload.budget_item_id;
        if (!budgetItemId) {
          const { data: existing } = await supabase.from('activity_time_tracking').select('budget_item_id').eq('id', trackingId).maybeSingle();
          payload.client_id = await resolveValidClientId(existing?.budget_item_id || '', payload.client_id);
        } else {
          payload.client_id = await resolveValidClientId(budgetItemId, payload.client_id);
        }
      }
      if (payload.scheduled_date && payload.scheduled_start_time && payload.scheduled_end_time) {
        await assertNoSlotConflict(
          [{ date: payload.scheduled_date, startTime: payload.scheduled_start_time, endTime: payload.scheduled_end_time }],
          [trackingId]
        );
      }
      delete (payload as { task?: unknown }).task;
      delete (payload as { activity?: unknown }).activity;
      const { error } = await supabase.from('activity_time_tracking').update(payload as never).eq('id', trackingId);
      if (error) throw error;
      await markTaskInProgress(payload.task_id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-tracking'] });
      queryClient.invalidateQueries({ queryKey: ['user-activities'] });
      invalidateTaskQueries();
      toast.success('Attività aggiornata');
      setDetailDialogOpen(false);
    },
    onError: (error: Error) => {
      if (handleSlotMutationError(error)) return;
      console.error('Error updating tracking:', error);
      toast.error(clientErrorMessage(error) || 'Errore durante l\'aggiornamento');
    }
  });

  const deleteTrackingMutation = useMutation({
    mutationFn: async (trackingId: string) => {
      const { data: children } = await supabase.from('activity_time_tracking').select('id').eq('recurrence_parent_id', trackingId).order('scheduled_date', { ascending: true });
      if (children && children.length > 0) {
        const newParentId = children[0].id;
        const { error: promoteError } = await supabase.from('activity_time_tracking').update({ recurrence_parent_id: null }).eq('id', newParentId);
        if (promoteError) throw promoteError;
        if (children.length > 1) {
          const otherChildIds = children.slice(1).map(c => c.id);
          const { error: rerouteError } = await supabase.from('activity_time_tracking').update({ recurrence_parent_id: newParentId }).in('id', otherChildIds);
          if (rerouteError) throw rerouteError;
        }
      }
      const { error } = await supabase.from('activity_time_tracking').delete().eq('id', trackingId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-tracking'] });
      queryClient.invalidateQueries({ queryKey: ['user-activities'] });
      toast.success('Attività eliminata');
      setDetailDialogOpen(false);
    },
    onError: error => { console.error('Error deleting tracking:', error); toast.error('Errore durante l\'eliminazione'); }
  });

  const duplicateTrackingMutation = useMutation({
    mutationFn: async (tracking: TimeTracking) => {
      const validClientId = await resolveValidClientId(tracking.budget_item_id, tracking.client_id);
      if (tracking.scheduled_date && tracking.scheduled_start_time && tracking.scheduled_end_time) {
        await assertNoSlotConflict([{
          date: tracking.scheduled_date,
          startTime: tracking.scheduled_start_time,
          endTime: tracking.scheduled_end_time,
        }]);
      }
      const { error } = await supabase.from('activity_time_tracking').insert({
        budget_item_id: tracking.budget_item_id, user_id: currentUser?.id,
        scheduled_date: tracking.scheduled_date, scheduled_start_time: tracking.scheduled_start_time,
        scheduled_end_time: tracking.scheduled_end_time, notes: tracking.notes,
        client_id: validClientId, task_id: tracking.task_id || null
      } as never);
      if (error) throw error;
      await markTaskInProgress(tracking.task_id);
    },
    onSuccess: () => {
      logAction({ actionType: 'create', actionDescription: 'Duplicata time entry', entityType: 'timesheet' });
      queryClient.invalidateQueries({ queryKey: ['time-tracking'] });
      queryClient.invalidateQueries({ queryKey: ['user-activities'] });
      invalidateTaskQueries();
      toast.success('Attività duplicata');
    },
    onError: (error: Error) => {
      if (handleSlotMutationError(error)) return;
      console.error('Error duplicating tracking:', error);
      toast.error(clientErrorMessage(error) || 'Errore durante la duplicazione');
    }
  });

  const triggerMeetCopy = async (trackingId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('copy-meet-attachments-to-project', {
        body: { tracking_id: trackingId },
      });
      if (error) { console.warn('Meet copy invoke error:', error); return 0; }
      return (data?.copied as number) || 0;
    } catch (e) {
      console.warn('Meet copy error:', e);
      return 0;
    }
  };

  const confirmTrackingMutation = useMutation({
    mutationFn: async (tracking: TimeTracking) => {
      if (!tracking.scheduled_date || !tracking.scheduled_start_time || !tracking.scheduled_end_time) throw new Error('Missing scheduled times');
      const startTime = tracking.scheduled_start_time.substring(0, 5);
      const endTime = tracking.scheduled_end_time.substring(0, 5);
      const { error } = await supabase.from('activity_time_tracking').update({
        actual_start_time: createLocalISOString(tracking.scheduled_date, startTime),
        actual_end_time: createLocalISOString(tracking.scheduled_date, endTime)
      }).eq('id', tracking.id);
      if (error) throw error;
      return tracking;
    },
    onSuccess: (tracking) => {
      queryClient.invalidateQueries({ queryKey: ['time-tracking'] });
      queryClient.invalidateQueries({ queryKey: ['user-activities'] });
      toast.success('Attività confermata - ore aggiunte al conteggio');
      if (tracking?.google_event_id) {
        triggerMeetCopy(tracking.id).then((n) => {
          if (n > 0) toast.success(`Trascrizione Meet copiata nel progetto (${n})`);
        });
      }
    },
    onError: error => { console.error('Error confirming tracking:', error); toast.error('Errore durante la conferma'); }
  });

  const confirmableTrackings = useMemo(() => {
    const now = new Date();
    return timeTracking.filter(t => {
      if (!t.scheduled_date || !t.scheduled_end_time) return false;
      if (t.actual_start_time && t.actual_end_time) return false;
      const endTime = t.scheduled_end_time.substring(0, 5);
      const endDateTime = new Date(`${t.scheduled_date}T${endTime}:00`);
      return isBefore(endDateTime, now);
    });
  }, [timeTracking]);

  const batchConfirmMutation = useMutation({
    mutationFn: async (trackings: TimeTracking[]) => {
      const confirmed: TimeTracking[] = [];
      for (const tracking of trackings) {
        if (!tracking.scheduled_date || !tracking.scheduled_start_time || !tracking.scheduled_end_time) continue;
        const startTime = tracking.scheduled_start_time.substring(0, 5);
        const endTime = tracking.scheduled_end_time.substring(0, 5);
        const { error } = await supabase.from('activity_time_tracking').update({
          actual_start_time: createLocalISOString(tracking.scheduled_date, startTime),
          actual_end_time: createLocalISOString(tracking.scheduled_date, endTime)
        }).eq('id', tracking.id);
        if (error) throw error;
        confirmed.push(tracking);
      }
      return confirmed;
    },
    onSuccess: (confirmed) => {
      queryClient.invalidateQueries({ queryKey: ['time-tracking'] });
      queryClient.invalidateQueries({ queryKey: ['user-activities'] });
      toast.success(`Tutte le attività passate confermate`);
      const withEvent = (confirmed || []).filter(t => t.google_event_id);
      if (withEvent.length > 0) {
        Promise.all(withEvent.map(t => triggerMeetCopy(t.id))).then((counts) => {
          const total = counts.reduce((s, n) => s + n, 0);
          if (total > 0) toast.success(`Trascrizioni Meet copiate nei progetti (${total})`);
        });
      }
    },
    onError: error => { console.error('Error batch confirming:', error); toast.error('Errore durante la conferma batch'); }
  });

  const handleBatchConfirmRef = useRef<(() => void) | null>(null);
  handleBatchConfirmRef.current = () => {
    if (confirmableTrackings.length > 0) batchConfirmMutation.mutate(confirmableTrackings);
  };

  const unconfirmTrackingMutation = useMutation({
    mutationFn: async (tracking: TimeTracking) => {
      const { error } = await supabase.from('activity_time_tracking').update({ actual_start_time: null, actual_end_time: null }).eq('id', tracking.id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['time-tracking'] }); queryClient.invalidateQueries({ queryKey: ['user-activities'] }); toast.success('Conferma annullata'); },
    onError: error => { console.error('Error unconfirming tracking:', error); toast.error('Errore durante l\'annullamento'); }
  });

  const deleteAllRecurringMutation = useMutation({
    mutationFn: async (tracking: TimeTracking) => {
      const parentId = tracking.recurrence_parent_id || tracking.id;
      const { error: parentError } = await supabase.from('activity_time_tracking').delete().eq('id', parentId);
      if (parentError) throw parentError;
      const { error: childError } = await supabase.from('activity_time_tracking').delete().eq('recurrence_parent_id', parentId);
      if (childError) throw childError;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['time-tracking'] }); queryClient.invalidateQueries({ queryKey: ['user-activities'] }); toast.success('Tutte le ricorrenze eliminate'); },
    onError: error => { console.error('Error deleting recurring activities:', error); toast.error('Errore durante l\'eliminazione'); }
  });

  const completeActivityMutation = useMutation({
    mutationFn: async (budgetItemId: string) => {
      if (!viewingUserId) throw new Error('User not authenticated');
      const { error } = await supabase.from('user_activity_completions').upsert({ user_id: viewingUserId, budget_item_id: budgetItemId, completed_at: new Date().toISOString() }, { onConflict: 'user_id,budget_item_id' });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['user-completed-activities'] }); queryClient.invalidateQueries({ queryKey: ['user-activities'] }); toast.success('Attività completata'); },
    onError: error => { console.error('Error completing activity:', error); toast.error('Errore durante il completamento'); }
  });

  const restoreActivityMutation = useMutation({
    mutationFn: async (budgetItemId: string) => {
      if (!viewingUserId) throw new Error('User not authenticated');
      const { error } = await supabase.from('user_activity_completions').delete().eq('user_id', viewingUserId).eq('budget_item_id', budgetItemId);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['user-completed-activities'] }); queryClient.invalidateQueries({ queryKey: ['user-activities'] }); toast.success('Attività ripristinata'); },
    onError: error => { console.error('Error restoring activity:', error); toast.error('Errore durante il ripristino'); }
  });

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over, delta } = event;
    setActiveId(null);
    if (!over) return;

    const dropData = over.data.current as { date: Date; hour: number; slotRef?: React.RefObject<HTMLDivElement> };
    if (!dropData || !dropData.date) return;

    let minuteOffset = 0;

    if (active.data.current?.type === 'scheduled') {
      const tracking = active.data.current.tracking as TimeTracking;
      if (tracking.scheduled_start_time) {
        const originalStartMinutes = parseInt(tracking.scheduled_start_time.split(':')[0]) * 60 + parseInt(tracking.scheduled_start_time.split(':')[1]);
        const deltaMinutes = Math.round(delta.y);
        const newStartMinutes = originalStartMinutes + deltaMinutes;
        const snappedStartMinutes = Math.round(newStartMinutes / 15) * 15;

        const endMinutes = parseInt(tracking.scheduled_end_time!.split(':')[0]) * 60 + parseInt(tracking.scheduled_end_time!.split(':')[1]);
        const duration = endMinutes - originalStartMinutes;
        const newEndMinutes = snappedStartMinutes + duration;
        const newStartTime = `${Math.floor(snappedStartMinutes / 60).toString().padStart(2, '0')}:${(snappedStartMinutes % 60).toString().padStart(2, '0')}`;
        const newEndTime = `${Math.floor(newEndMinutes / 60).toString().padStart(2, '0')}:${(newEndMinutes % 60).toString().padStart(2, '0')}`;

        const closureDay = isClosureDay(dropData.date);
        if (closureDay) {
          toast.error(`Non puoi pianificare attività il ${format(dropData.date, 'd MMMM', { locale: it })}`, { description: `${closureDay.name} - Giorno di chiusura aziendale` });
          return;
        }

        moveTrackingMutation.mutate({
          trackingId: tracking.id, newDate: format(dropData.date, 'yyyy-MM-dd'), newStartTime, newEndTime,
          isConfirmed: !!(tracking.actual_start_time && tracking.actual_end_time)
        });
        return;
      }
    }

    if (lastMousePositionRef.current && dropData.slotRef?.current) {
      const rect = dropData.slotRef.current.getBoundingClientRect();
      const relativeY = lastMousePositionRef.current.clientY - rect.top;
      minuteOffset = Math.max(0, Math.min(45, Math.floor(relativeY / 15) * 15));
    }

    const closureDay = isClosureDay(dropData.date);
    if (closureDay) {
      toast.error(`Non puoi pianificare attività il ${format(dropData.date, 'd MMMM', { locale: it })}`, { description: `${closureDay.name} - Giorno di chiusura aziendale` });
      return;
    }

    const startSlotMinutes = dropData.hour * 60 + minuteOffset;
    const slotStartTime = `${Math.floor(startSlotMinutes / 60).toString().padStart(2, '0')}:${(startSlotMinutes % 60).toString().padStart(2, '0')}`;
    const slotEndMinutes = startSlotMinutes + config.defaultSlotDuration;
    const slotEndTime = `${Math.floor(slotEndMinutes / 60).toString().padStart(2, '0')}:${(slotEndMinutes % 60).toString().padStart(2, '0')}`;

    // Drop di una task dalla sidebar: pianifica uno slot sull'attività collegata
    if (active.data.current?.type === 'task') {
      const task = active.data.current.task as PlannableTask;
      scheduleActivityMutation.mutate({
        budget_item_id: task.budget_item_id,
        scheduled_date: format(dropData.date, 'yyyy-MM-dd'),
        scheduled_start_time: slotStartTime,
        scheduled_end_time: slotEndTime,
        task_id: task.id,
      });
      return;
    }

    const activity = active.data.current?.activity as Activity;
    if (!activity) return;
    const startMinutes = dropData.hour * 60 + minuteOffset;
    const startTime = `${Math.floor(startMinutes / 60).toString().padStart(2, '0')}:${(startMinutes % 60).toString().padStart(2, '0')}`;
    const endMinutesTotal = startMinutes + config.defaultSlotDuration;
    const endTime = `${Math.floor(endMinutesTotal / 60).toString().padStart(2, '0')}:${(endMinutesTotal % 60).toString().padStart(2, '0')}`;

    const isInternoOrConsumptive = activity.billing_type === 'interno' || activity.billing_type === 'consumptive';
    const durationHours = config.defaultSlotDuration / 60;
    const totalScheduledHours = activity.confirmed_hours + activity.planned_hours + durationHours;
    if (!isInternoOrConsumptive && totalScheduledHours > activity.hours_worked) {
      const overage = formatHours(totalScheduledHours - activity.hours_worked);
      toast.warning(`Attenzione: questa pianificazione supererà il budget di ${overage}`, {
        description: `Budget: ${formatHours(activity.hours_worked)} | Totale dopo pianificazione: ${formatHours(totalScheduledHours)}`
      });
    }

    scheduleActivityMutation.mutate({
      budget_item_id: activity.id, scheduled_date: format(dropData.date, 'yyyy-MM-dd'), scheduled_start_time: startTime, scheduled_end_time: endTime
    });
  };

  // Task aperte assegnate all'utente e collegate a una voce di budget: pianificabili via drag & drop
  const { data: plannableTasksRaw = [] } = useQuery({
    queryKey: ['calendar-plannable-tasks', viewingUserId],
    queryFn: async () => {
      if (!viewingUserId) return [];
      const { data, error } = await supabase
        .from('project_tasks')
        .select('id, title, status, priority, due_date, budget_item_id')
        .eq('assignee_id', viewingUserId)
        .in('status', ['todo', 'in_progress'])
        .not('budget_item_id', 'is', null)
        .order('due_date', { ascending: true, nullsFirst: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!viewingUserId,
  });

  const plannableTasks = useMemo<PlannableTask[]>(() => {
    const activityById = new Map(activities.map(a => [a.id, a]));
    const priorityWeight: Record<string, number> = { high: 0, medium: 1, low: 2 };
    return plannableTasksRaw
      .map(task => {
        const activity = task.budget_item_id ? activityById.get(task.budget_item_id) : undefined;
        if (!activity) return null;
        return {
          id: task.id,
          title: task.title,
          status: task.status,
          priority: (task.priority ?? 'medium') as PlannableTask['priority'],
          due_date: task.due_date ?? null,
          budget_item_id: activity.id,
          activity_name: activity.activity_name,
          project_name: activity.project_name,
        } satisfies PlannableTask;
      })
      .filter((t): t is PlannableTask => t !== null)
      .sort((a, b) => {
        if (a.due_date && b.due_date && a.due_date !== b.due_date) return a.due_date < b.due_date ? -1 : 1;
        if (a.due_date && !b.due_date) return -1;
        if (!a.due_date && b.due_date) return 1;
        return priorityWeight[a.priority] - priorityWeight[b.priority];
      });
  }, [plannableTasksRaw, activities]);

  const uniqueProjects = useMemo(() => {
    const projects = activities.map(a => ({ id: a.project_id, name: a.project_name }));
    const uniqueMap = new Map(projects.map(p => [p.id, p]));
    return Array.from(uniqueMap.values()).sort((a, b) => a.name.localeCompare(b.name, 'it'));
  }, [activities]);

  const filteredActivities = useMemo(() => {
    return activeActivities.filter(activity => {
      const matchesProject = selectedProject === 'all' || activity.project_id === selectedProject;
      const matchesCategory = selectedCategory === 'all' || activity.category === selectedCategory;
      const matchesSearch = !activitySearchQuery || activity.activity_name.toLowerCase().includes(activitySearchQuery.toLowerCase()) || activity.project_name.toLowerCase().includes(activitySearchQuery.toLowerCase());
      return matchesProject && matchesCategory && matchesSearch;
    });
  }, [activeActivities, selectedProject, selectedCategory, activitySearchQuery]);

  const handleOpenDetail = (tracking: TimeTracking, duplicateMode = false) => {
    setSelectedTracking(tracking);
    setIsDuplicateMode(duplicateMode);
    setDetailForm({
      scheduled_date: duplicateMode ? '' : (tracking.scheduled_date || ''),
      scheduled_start_time: tracking.scheduled_start_time || '',
      scheduled_end_time: tracking.scheduled_end_time || '',
      notes: tracking.notes || '',
      selectedProject: tracking.activity?.project_id || '',
      selectedActivity: tracking.budget_item_id || '',
      client_id: tracking.client_id || '',
      task_id: tracking.task_id || null
    });
    setDetailProjectSearch('');
    setDetailDialogOpen(true);
  };

  const isTimeRangeValid = useMemo(() => {
    if (!detailForm.scheduled_start_time || !detailForm.scheduled_end_time) return true;
    const [startH, startM] = detailForm.scheduled_start_time.split(':').map(Number);
    const [endH, endM] = detailForm.scheduled_end_time.split(':').map(Number);
    return (endH * 60 + endM) > (startH * 60 + startM);
  }, [detailForm.scheduled_start_time, detailForm.scheduled_end_time]);

  const { data: clientsList = [], refetch: refetchClients } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['calendar-clients'],
    queryFn: async () => {
      return await fetchAllClients<{ id: string; name: string }>('id, name');
    }
  });

  const detailIsInterno = useMemo(() => {
    const fromActivities = activities.find(a => a.id === detailForm.selectedActivity)?.billing_type;
    const billingType = fromActivities
      ?? (selectedTracking?.budget_item_id === detailForm.selectedActivity ? selectedTracking?.activity?.billing_type : undefined);
    return billingType === 'interno';
  }, [activities, detailForm.selectedActivity, selectedTracking]);

  // Clear any selected client as soon as the chosen activity is not on an "interno" project
  useEffect(() => {
    if (!detailIsInterno && detailForm.client_id) {
      setDetailForm(prev => ({ ...prev, client_id: '' }));
    }
  }, [detailIsInterno, detailForm.client_id]);

  const handleSaveDetail = () => {
    if (!selectedTracking) return;
    if (!isTimeRangeValid) { toast.error('L\'ora di fine deve essere successiva all\'ora di inizio'); return; }
    if (!detailForm.selectedActivity) { toast.error('Seleziona un\'attività'); return; }
    if (!detailForm.scheduled_date) { toast.error('Seleziona una data'); return; }

    const clientId = detailForm.client_id || null;
    if (clientId) {
      if (!detailIsInterno) {
        toast.error('Il cliente può essere associato solo alle attività di progetti INTERNO');
        return;
      }
      if (!clientsList.some(c => c.id === clientId)) {
        toast.error('Il cliente selezionato non è valido');
        return;
      }
    }
    const safeClientId = detailIsInterno ? clientId : null;

    if (isDuplicateMode) {
      duplicateTrackingMutation.mutate({
        ...selectedTracking,
        scheduled_date: detailForm.scheduled_date,
        scheduled_start_time: detailForm.scheduled_start_time,
        scheduled_end_time: detailForm.scheduled_end_time,
        notes: detailForm.notes || null,
        budget_item_id: detailForm.selectedActivity,
        client_id: safeClientId,
        task_id: detailForm.task_id,
      } as TimeTracking);
      setDetailDialogOpen(false);
      setIsDuplicateMode(false);
      return;
    }

    const isConfirmed = selectedTracking.actual_start_time && selectedTracking.actual_end_time;
    const updates: Partial<TimeTracking> = {
      scheduled_date: detailForm.scheduled_date,
      scheduled_start_time: detailForm.scheduled_start_time,
      scheduled_end_time: detailForm.scheduled_end_time,
      notes: detailForm.notes || null,
      budget_item_id: detailForm.selectedActivity,
      client_id: safeClientId,
      task_id: detailForm.task_id
    };
    if (isConfirmed && detailForm.scheduled_date) {
      updates.actual_start_time = createLocalISOString(detailForm.scheduled_date, detailForm.scheduled_start_time);
      updates.actual_end_time = createLocalISOString(detailForm.scheduled_date, detailForm.scheduled_end_time);
    }
    updateTrackingDetailMutation.mutate({ trackingId: selectedTracking.id, updates });
  };

  const handleDeleteTracking = () => {
    if (!selectedTracking) return;
    if (confirm('Sei sicuro di voler eliminare questa attività?')) {
      deleteTrackingMutation.mutate(selectedTracking.id);
    }
  };

  const handleHideGoogleEvent = useCallback((eventId: string) => {
    setHiddenGoogleEvents(prev => {
      const updated = [...prev, eventId];
      localStorage.setItem('hiddenGoogleEvents', JSON.stringify(updated));
      return updated;
    });
    toast.success('Evento nascosto dal calendario');
  }, []);

  const activeActivity = activeId ? activities.find(a => a.id === activeId) : null;
  const activeDraggedTask = activeId?.startsWith('task-') ? plannableTasks.find(t => `task-${t.id}` === activeId) : null;
  const activeScheduledTracking = activeId?.startsWith('scheduled-') ? timeTracking.find(t => `scheduled-${t.id}` === activeId) : null;

  // Always compute totals on all 7 days so hidden weekends are still included
  const allWeekDays = useMemo(() => {
    return Array.from({ length: config.numberOfDays }, (_, i) => addDays(currentWeekStart, i));
  }, [currentWeekStart, config.numberOfDays]);

  const dailyTotals = useMemo(() => {
    return allWeekDays.map(day => {
      const dayActivities = timeTracking.filter(t => t.scheduled_date && isSameDay(parseISO(t.scheduled_date), day));
      let plannedMinutes = 0;
      let confirmedMinutes = 0;
      let bancaOreMinutes = 0;
      dayActivities.forEach(t => {
        if (!t.scheduled_start_time || !t.scheduled_end_time) return;
        const duration = calculateTimeMinutes(t.scheduled_start_time, t.scheduled_end_time);
        plannedMinutes += duration;
        if (t.actual_start_time && t.actual_end_time) {
          const hours = calculateSafeHours(t.actual_start_time, t.actual_end_time);
          const mins = Math.round(hours * 60);
          confirmedMinutes += mins;
          // Identifica attività banca ore
          const projectName = t.activity?.project_name || '';
          const activityName = t.activity?.activity_name || '';
          if (/off/i.test(projectName) && /banca\s*ore/i.test(activityName)) {
            bancaOreMinutes += mins;
          }
        }
      });
      return { planned: plannedMinutes / 60, confirmed: confirmedMinutes / 60, bancaOre: bancaOreMinutes / 60 };
    });
  }, [allWeekDays, timeTracking]);

  const currentTimeIndicator = useMemo(() => {
    const now = new Date();
    const todayInWeek = weekDays.find(day => isSameDay(day, now));
    if (!todayInWeek) return null;
    const currentHour = now.getHours();
    const currentMinutes = now.getMinutes();
    const workDayStartHour = visibleHours[0];
    if (currentHour < workDayStartHour || currentHour > visibleHours[visibleHours.length - 1]) return null;
    const relativeHour = currentHour - workDayStartHour;
    const top = relativeHour * hourHeight + currentMinutes / 60 * hourHeight;
    const dayIndex = weekDays.findIndex(day => isSameDay(day, now));
    return { top, dayIndex };
  }, [currentTime, weekDays, visibleHours, hourHeight]);

  const weeklyTotals = useMemo(() => {
    return dailyTotals.reduce((acc, day) => ({
      planned: acc.planned + day.planned,
      confirmed: acc.confirmed + day.confirmed,
      bancaOre: acc.bancaOre + day.bancaOre
    }), { planned: 0, confirmed: 0, bancaOre: 0 });
  }, [dailyTotals]);

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="h-screen flex flex-col">
      <CalendarHeader
        config={config}
        saveConfig={saveConfig}
        handleConfigChange={handleConfigChange}
        viewMode={viewMode}
        setViewMode={setViewMode}
        currentWeekStart={currentWeekStart}
        setCurrentWeekStart={setCurrentWeekStart}
        weeklyTotals={weeklyTotals}
        weeklyContractHours={weeklyContractHours}
        confirmableTrackings={confirmableTrackings}
        batchConfirmMutation={batchConfirmMutation}
        canViewOtherUsers={!!canViewOtherUsers}
        allUsers={allUsers}
        currentUserId={currentUser?.id}
        selectedUserId={selectedUserId}
        setSelectedUserId={setSelectedUserId}
        isViewingOtherUser={isViewingOtherUser}
        setShowMultiUserView={setShowMultiUserView}
        isSidebarVisible={isSidebarVisible}
        setIsSidebarVisible={setIsSidebarVisible}
        setIsGoogleConnected={setIsGoogleConnected}
        setHiddenGoogleEvents={setHiddenGoogleEvents}
        activityCategories={activityCategories}
        isExternalUser={isExternalUser}
      />

      <div className="flex-1 overflow-hidden">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[snapTo15MinModifier]}
          onDragEnd={isReadOnly ? () => {} : handleDragEnd}
          onDragStart={e => {
            setActiveId(e.active.id as string);
            if (e.active.data.current?.type === 'scheduled' && lastMousePositionRef.current) {
              const tracking = e.active.data.current.tracking as TimeTracking;
              if (tracking.scheduled_start_time) {
                const draggedElement = document.querySelector(`[data-tracking-id="${tracking.id}"]`);
                if (draggedElement) {
                  const rect = draggedElement.getBoundingClientRect();
                  const rawOffset = lastMousePositionRef.current.clientY - rect.top;
                  dragStartOffsetRef.current = Math.round(rawOffset / 15) * 15;
                }
              }
            } else {
              dragStartOffsetRef.current = 0;
            }
          }}
        >
          <div className="flex h-full">
            {/* Sidebar */}
            {isSidebarVisible && (
              <CalendarSidebar
                isReadOnly={isReadOnly}
                isViewingOtherUser={isViewingOtherUser}
                activitySearchQuery={activitySearchQuery}
                setActivitySearchQuery={setActivitySearchQuery}
                selectedProject={selectedProject}
                setSelectedProject={setSelectedProject}
                projectFilterOpen={projectFilterOpen}
                setProjectFilterOpen={setProjectFilterOpen}
                projectFilterSearch={projectFilterSearch}
                setProjectFilterSearch={setProjectFilterSearch}
                uniqueProjects={uniqueProjects}
                filteredActivities={filteredActivities}
                activeActivities={activeActivities}
                completedActivitiesWithInfo={completedActivitiesWithInfo}
                onCompleteActivity={(id) => completeActivityMutation.mutate(id)}
                onRestoreActivity={(id) => restoreActivityMutation.mutate(id)}
                isLoading={isLoadingActivities}
                isError={isActivitiesError}
                onRetry={() => refetchActivities()}
                plannableTasks={plannableTasks}
              />
            )}

            {/* Weekly planning view */}
            {viewMode === 'planning' ? (
              <WeeklyPlanningView
                weekStart={currentWeekStart}
                numberOfDays={config.numberOfDays}
                weekDays={weekDays}
                trackings={timeTracking}
                activities={activeActivities}
                weeklyContractHours={weeklyContractHours}
                isReadOnly={isReadOnly}
                onAdd={() => { setPlanEditRow(null); setPlanDialogOpen(true); }}
                onEditRow={(row) => { setPlanEditRow(row); setPlanDialogOpen(true); }}
                onRemoveRow={(row) => removeWeeklyPlanMutation.mutate(row)}
                onUpdateSlot={({ tracking, scheduled_date, scheduled_start_time, scheduled_end_time }) =>
                  moveTrackingMutation.mutate({
                    trackingId: tracking.id,
                    newDate: scheduled_date,
                    newStartTime: scheduled_start_time,
                    newEndTime: scheduled_end_time,
                    isConfirmed: !!(tracking.actual_start_time && tracking.actual_end_time),
                  })
                }
                onDeleteSlot={(tracking) => deleteTrackingMutation.mutate(tracking.id)}
              />
            ) : (
            /* Calendar Grid */
            <CalendarGrid
              weekDays={weekDays}
              visibleHours={visibleHours}
              hourHeight={hourHeight}
              timeTracking={timeTracking}
              dailyTotals={dailyTotals}
              closureDaysMap={closureDaysMap}
              currentTimeIndicator={currentTimeIndicator}
              dragCreateState={dragCreateState}
              handleDragCreateStart={handleDragCreateStart}
              handleDragCreateEnd={handleDragCreateEnd}
              onSaveResize={(id, start, end, isConfirmed, scheduledDate) => updateTrackingTimeMutation.mutate({ trackingId: id, startTime: start, endTime: end, isConfirmed, scheduledDate })}
              onOpenDetail={handleOpenDetail}
              onDuplicate={t => handleOpenDetail(t, true)}
              onConfirm={t => confirmTrackingMutation.mutate(t)}
              onUnconfirm={t => unconfirmTrackingMutation.mutate(t)}
              onDelete={t => deleteTrackingMutation.mutate(t.id)}
              onDeleteAllRecurring={t => deleteAllRecurringMutation.mutate(t)}
              onCompleteActivity={(budgetItemId) => completeActivityMutation.mutate(budgetItemId)}
              isViewingOtherUser={isViewingOtherUser}
              googleEvents={googleEvents}
              hiddenGoogleEvents={hiddenGoogleEvents}
              accessibleProjects={accessibleProjects}
              accessibleActivities={accessibleActivities}
              onConvertGoogleEvent={(event, budgetItemId, customDate, customStartTime, customEndTime) => convertGoogleEventMutation.mutate({ event, budgetItemId, customDate, customStartTime, customEndTime })}
              onHideGoogleEvent={handleHideGoogleEvent}
            />
            )}
          </div>

          {/* Activity Detail Dialog */}
          <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
            <DialogContent className="w-[calc(100vw-2rem)] sm:w-full max-w-md max-h-[85vh] overflow-y-auto overflow-x-hidden">
              <DialogHeader>
                <DialogTitle>{isDuplicateMode ? 'Duplica Attività' : 'Dettagli Attività'}</DialogTitle>
              </DialogHeader>
              {selectedTracking && (
                <div className="space-y-4 py-4">
                  {selectedTracking.google_event_title && (
                    <div>
                      <Label className="text-sm font-semibold flex items-center gap-2">
                        Evento Google
                        <Badge variant="outline" className="bg-orange-100 dark:bg-orange-900/50 border-orange-300 text-orange-700 dark:text-orange-300 text-xs">Google</Badge>
                      </Label>
                      <p className="text-sm mt-1">{selectedTracking.google_event_title}</p>
                    </div>
                  )}
                  <div className="min-w-0">
                    <Label>Progetto</Label>
                    <Select value={detailForm.selectedProject} onValueChange={(v) => { setDetailForm(prev => ({ ...prev, selectedProject: v, selectedActivity: '', task_id: null })); setDetailProjectSearch(''); }}>
                      <SelectTrigger className="mt-1 w-full min-w-0 [&>span]:min-w-0 [&>span]:flex-1 [&>span]:truncate [&>span]:text-left"><SelectValue placeholder="Seleziona un progetto" /></SelectTrigger>

                      <SelectContent className="max-w-[min(24rem,calc(100vw-3rem))]">
                        <div className="px-2 pb-2">
                          <div className="relative">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Cerca progetto..." value={detailProjectSearch} onChange={(e) => setDetailProjectSearch(e.target.value)} className="pl-8 h-8" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} />
                          </div>
                        </div>
                        {accessibleProjects.filter(p => !detailProjectSearch || p.name.toLowerCase().includes(detailProjectSearch.toLowerCase())).map(project => (
                          <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>
                        ))}
                        {accessibleProjects.filter(p => !detailProjectSearch || p.name.toLowerCase().includes(detailProjectSearch.toLowerCase())).length === 0 && (
                          <div className="py-2 px-2 text-sm text-muted-foreground text-center">Nessun progetto trovato</div>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  {detailForm.selectedProject && (
                    <div className="min-w-0">
                      <Label>Attività</Label>
                      <Select value={detailForm.selectedActivity} onValueChange={(v) => setDetailForm(prev => ({ ...prev, selectedActivity: v, task_id: null }))}>
                        <SelectTrigger className="mt-1 w-full min-w-0 [&>span]:min-w-0 [&>span]:flex-1 [&>span]:truncate [&>span]:text-left"><SelectValue placeholder="Seleziona un'attività" /></SelectTrigger>
                        <SelectContent className="max-w-[min(24rem,calc(100vw-3rem))]">
                          {accessibleActivities.filter(a => a.project_id === detailForm.selectedProject).map(activity => (
                            <SelectItem key={activity.id} value={activity.id}>
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="truncate">{activity.activity_name}</span>
                                <Badge variant="secondary" className="text-xs shrink-0">{activity.category}</Badge>
                              </div>
                            </SelectItem>
                          ))}

                          {accessibleActivities.filter(a => a.project_id === detailForm.selectedProject).length === 0 && (
                            <div className="p-2 text-sm text-muted-foreground text-center">Nessuna attività in questo progetto</div>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {detailForm.selectedActivity && (
                    <ActivityTaskSelect
                      budgetItemId={detailForm.selectedActivity}
                      value={detailForm.task_id}
                      onChange={(taskId) => setDetailForm(prev => ({ ...prev, task_id: taskId }))}
                      enabled={detailDialogOpen}
                    />
                  )}
                  {detailIsInterno && (
                    <div>
                      <Label>Cliente (facoltativo)</Label>
                      <div className="mt-1">
                        <ClientSelector
                          value={detailForm.client_id || undefined}
                          onValueChange={(clientId) => setDetailForm(prev => ({ ...prev, client_id: clientId }))}
                          onCancel={() => setDetailForm(prev => ({ ...prev, client_id: '' }))}
                          clients={clientsList}
                          onClientCreated={() => refetchClients()}
                          triggerClassName="h-9 w-full"
                          showCancelButton={!!detailForm.client_id}
                        />
                      </div>
                    </div>
                  )}
                  <div className="min-w-0">
                    <Label htmlFor="detail-date">Data</Label>
                    <Input id="detail-date" type="date" value={detailForm.scheduled_date} onChange={e => setDetailForm({ ...detailForm, scheduled_date: e.target.value })} className="mt-1 w-full" />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="min-w-0">
                      <Label htmlFor="detail-start">Ora inizio</Label>
                      <TimeSlotSelect id="detail-start" value={detailForm.scheduled_start_time} onChange={(value) => setDetailForm({ ...detailForm, scheduled_start_time: value })} className="mt-1 w-full" />
                    </div>
                    <div className="min-w-0">
                      <Label htmlFor="detail-end">Ora fine</Label>
                      <TimeSlotSelect id="detail-end" value={detailForm.scheduled_end_time} onChange={(value) => setDetailForm({ ...detailForm, scheduled_end_time: value })} className="mt-1 w-full" />
                    </div>
                  </div>

                  {!isTimeRangeValid && detailForm.scheduled_start_time && detailForm.scheduled_end_time && (
                    <p className="text-sm text-destructive">L'ora di fine deve essere successiva all'ora di inizio</p>
                  )}
                  <div>
                    <Label htmlFor="detail-notes">Descrizione</Label>
                    <Textarea id="detail-notes" value={detailForm.notes} onChange={e => setDetailForm({ ...detailForm, notes: e.target.value })} placeholder="Inserisci una descrizione (opzionale)..." className="mt-1" rows={3} />
                  </div>
                  {selectedTracking.actual_start_time && (
                    <div>
                      <Label className="text-sm font-semibold">Tempo tracciato</Label>
                      <p className="text-sm mt-1">Inizio: {selectedTracking.actual_start_time ? format(new Date(selectedTracking.actual_start_time), 'HH:mm', { locale: it }) : '-'}</p>
                      {selectedTracking.actual_end_time && <p className="text-sm">Fine: {format(new Date(selectedTracking.actual_end_time), 'HH:mm', { locale: it })}</p>}
                    </div>
                  )}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-4 border-t">
                    {!isDuplicateMode && (
                      <Button variant="destructive" size="sm" onClick={handleDeleteTracking}>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Elimina
                      </Button>
                    )}
                    <div className="flex gap-2 ml-auto">

                      <Button variant="outline" onClick={() => { setDetailDialogOpen(false); setIsDuplicateMode(false); }}>Annulla</Button>
                      <Button onClick={handleSaveDetail} disabled={!isTimeRangeValid || !detailForm.selectedActivity || !detailForm.scheduled_date}>
                        {isDuplicateMode ? 'Duplica' : 'Salva'}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

          <DragOverlay>
            {activeActivity && (
              <div className="p-3 border rounded-sm bg-background shadow-lg opacity-90">
                <div className="flex flex-col gap-1">
                  <span className="font-medium text-sm">{activeActivity.activity_name}</span>
                  <Badge variant="secondary" className="w-fit text-xs">{activeActivity.category}</Badge>
                </div>
              </div>
            )}
            {activeDraggedTask && (
              <div className="p-3 border rounded-sm bg-background shadow-lg opacity-90 min-w-[160px]">
                <div className="flex flex-col gap-1">
                  <span className="font-medium text-sm">{activeDraggedTask.title}</span>
                  <span className="text-xs text-muted-foreground">{activeDraggedTask.activity_name}</span>
                </div>
              </div>
            )}
            {activeScheduledTracking?.activity && (
              <div className="p-3 border-l-4 border-primary rounded-sm bg-primary/10 shadow-lg opacity-90 min-w-[150px]">
                <div className="flex flex-col gap-1">
                  <span className="font-medium text-sm">{activeScheduledTracking.activity.activity_name}</span>
                  <span className="text-xs text-muted-foreground">{activeScheduledTracking.activity.project_name}</span>
                  <span className="text-xs">{activeScheduledTracking.scheduled_start_time?.substring(0, 5)} - {activeScheduledTracking.scheduled_end_time?.substring(0, 5)}</span>
                </div>
              </div>
            )}
          </DragOverlay>
        </DndContext>

        <CreateManualActivityDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          initialDate={createDialogData.date}
          initialStartTime={createDialogData.startTime}
          initialEndTime={createDialogData.endTime}
          onSubmit={data => {
            scheduleActivityMutation.mutate({
              budget_item_id: data.budget_item_id,
              scheduled_date: data.scheduled_date,
              scheduled_start_time: data.scheduled_start_time,
              scheduled_end_time: data.scheduled_end_time,
              notes: data.notes,
              client_id: data.client_id,
              recurrence: data.recurrence
            });
          }}
        />

        <PlanActivityHoursDialog
          open={planDialogOpen}
          onOpenChange={(open) => { setPlanDialogOpen(open); if (!open) setPlanEditRow(null); }}
          activities={activeActivities}
          userId={viewingUserId}
          fixedActivity={planEditRow ? (activities.find(a => a.id === planEditRow.budget_item_id) || {
            id: planEditRow.budget_item_id,
            activity_name: planEditRow.activity_name,
            category: planEditRow.category,
            hours_worked: 0,
            total_cost: 0,
            project_id: planEditRow.project_id,
            project_name: planEditRow.project_name,
            assignee_id: viewingUserId || '',
            confirmed_hours: 0,
            planned_hours: 0
          }) : null}
          initialMinutes={planEditRow?.plannedMinutes || 0}
          initialTaskId={planEditRow?.slots?.find(s => s.task_id)?.task_id || null}
          isPending={planWeeklyHoursMutation.isPending}
          onSubmit={({ budget_item_id, minutes, task_id }) => planWeeklyHoursMutation.mutate({ budget_item_id, minutes, task_id })}
        />
      </div>


      {showMultiUserView && (
        <MultiUserCalendarView
          onClose={() => setShowMultiUserView(false)}
          weekStartsOn={config.weekStartsOn as 0 | 1 | 2 | 3 | 4 | 5 | 6}
        />
      )}
    </div>
  );
}
