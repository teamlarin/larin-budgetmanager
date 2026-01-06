import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { startOfMonth, endOfMonth } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { AdminDashboard } from '@/components/dashboards/AdminDashboard';
import { AccountDashboard } from '@/components/dashboards/AccountDashboard';
import { FinanceDashboard } from '@/components/dashboards/FinanceDashboard';
import { TeamLeaderDashboard } from '@/components/dashboards/TeamLeaderDashboard';
import { MemberDashboard } from '@/components/dashboards/MemberDashboard';
import { UserHoursSummary } from '@/components/dashboards/UserHoursSummary';
import { AppLayout } from '@/components/AppLayout';
import { DashboardDateFilter, DateRange } from '@/components/DashboardDateFilter';
import { useRoleSimulation } from '@/contexts/RoleSimulationContext';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Eye } from 'lucide-react';

type UserRole = 'admin' | 'account' | 'finance' | 'team_leader' | 'coordinator' | 'member';

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  account: 'Account',
  finance: 'Finance',
  team_leader: 'Team Leader',
  coordinator: 'Coordinator',
  member: 'Member',
};

const Dashboard = () => {
  const { getEffectiveRole, isSimulating, simulatedRole } = useRoleSimulation();
  const [realUserRole, setRealUserRole] = useState<UserRole | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date())
  });

  // Get effective role (simulated or real)
  const userRole = getEffectiveRole(realUserRole) as UserRole | null;

  useEffect(() => {
    const checkUserRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        
        // Fetch user role and profile in parallel
        const [roleResult, profileResult] = await Promise.all([
          supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', user.id)
            .maybeSingle(),
          supabase
            .from('profiles')
            .select('first_name')
            .eq('id', user.id)
            .maybeSingle()
        ]);
        
        setRealUserRole(roleResult.data?.role as UserRole || 'member');
        setUserName(profileResult.data?.first_name || '');
      }
      setLoading(false);
    };

    checkUserRole();
  }, []);

  // Admin stats query
  const { data: adminStats } = useQuery({
    queryKey: ['admin-dashboard-stats', dateRange.from.toISOString(), dateRange.to.toISOString()],
    queryFn: async () => {
      const fromDate = dateRange.from.toISOString();
      const toDate = dateRange.to.toISOString();

      const results = await Promise.all([
        supabase.from('projects').select('*', { count: 'exact', head: true }).gte('created_at', fromDate).lte('created_at', toDate),
        supabase.from('projects').select('*', { count: 'exact', head: true }).eq('status', 'in_attesa').gte('created_at', fromDate).lte('created_at', toDate),
        supabase.from('projects').select('*', { count: 'exact', head: true }).eq('status', 'approvato').gte('created_at', fromDate).lte('created_at', toDate),
        supabase.from('projects').select('id, project_status, total_budget, end_date, created_at').eq('status', 'approvato').gte('created_at', fromDate).lte('created_at', toDate),
        supabase.from('quotes').select('*', { count: 'exact', head: true }).gte('created_at', fromDate).lte('created_at', toDate),
        supabase.from('quotes').select('*', { count: 'exact', head: true }).in('status', ['draft', 'sent']).gte('created_at', fromDate).lte('created_at', toDate),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('approved', true)
      ]);

      const totalBudgets = results[0].count || 0;
      const pendingBudgets = results[1].count || 0;
      const projects = results[3].data || [];
      const totalQuotes = results[4].count || 0;
      const pendingQuotes = results[5].count || 0;
      const totalUsers = results[6].count || 0;

      const activeProjects = projects.filter(p => p.project_status === 'aperto' || p.project_status === 'in_partenza').length;
      const totalBudgetValue = projects.reduce((sum, p) => sum + (p.total_budget || 0), 0);
      
      // Projects near deadline (next 7 days)
      const now = new Date();
      const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const projectsNearDeadline = projects?.filter(p => {
        if (!p.end_date) return false;
        const endDate = new Date(p.end_date);
        return endDate >= now && endDate <= weekFromNow;
      }).length || 0;

      return {
        totalBudgets: totalBudgets,
        pendingBudgets: pendingBudgets,
        totalProjects: projects.length,
        activeProjects,
        totalQuotes: totalQuotes,
        pendingQuotes: pendingQuotes,
        totalUsers: totalUsers,
        totalBudgetValue,
        projectsNearDeadline
      };
    },
    enabled: userRole === 'admin'
  });

  // Account stats query
  const { data: accountData } = useQuery({
    queryKey: ['account-dashboard-stats', userId, dateRange.from.toISOString(), dateRange.to.toISOString()],
    queryFn: async () => {
      const fromDate = dateRange.from.toISOString();
      const toDate = dateRange.to.toISOString();

      const { data: projects } = await supabase
        .from('projects')
        .select('*, clients(name)')
        .or(`user_id.eq.${userId},account_user_id.eq.${userId}`)
        .gte('created_at', fromDate)
        .lte('created_at', toDate)
        .order('created_at', { ascending: false });

      const myBudgets = projects?.length || 0;
      const pendingBudgets = projects?.filter(p => p.status === 'in_attesa').length || 0;
      const activeProjects = projects?.filter(p => p.status === 'approvato' && (p.project_status === 'aperto' || p.project_status === 'in_partenza')).length || 0;

      const { count: myQuotes } = await supabase
        .from('quotes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', fromDate)
        .lte('created_at', toDate);

      const { count: pendingQuotes } = await supabase
        .from('quotes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .in('status', ['draft', 'sent'])
        .gte('created_at', fromDate)
        .lte('created_at', toDate);

      const totalBudgetValue = projects?.reduce((sum, p) => sum + (p.total_budget || 0), 0) || 0;

      // Projects near deadline
      const now = new Date();
      const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const projectsNearDeadline = projects?.filter(p => {
        if (!p.end_date) return false;
        const endDate = new Date(p.end_date);
        return endDate >= now && endDate <= weekFromNow;
      }).length || 0;

      const recentProjects = projects?.slice(0, 5).map(p => ({
        id: p.id,
        name: p.name,
        client_name: p.clients?.name,
        status: p.status,
        project_status: p.project_status,
        total_budget: p.total_budget || 0,
        end_date: p.end_date
      })) || [];

      return {
        stats: {
          myBudgets,
          pendingBudgets,
          myProjects: projects?.filter(p => p.status === 'approvato').length || 0,
          activeProjects,
          myQuotes: myQuotes || 0,
          pendingQuotes: pendingQuotes || 0,
          totalBudgetValue,
          projectsNearDeadline
        },
        recentProjects
      };
    },
    enabled: userRole === 'account' && !!userId
  });

  // Finance stats query
  const { data: financeData } = useQuery({
    queryKey: ['finance-dashboard-stats', dateRange.from.toISOString(), dateRange.to.toISOString()],
    queryFn: async () => {
      const fromDate = dateRange.from.toISOString();
      const toDate = dateRange.to.toISOString();

      const { data: projects } = await supabase
        .from('projects')
        .select('*, clients(name)')
        .eq('status', 'approvato')
        .gte('created_at', fromDate)
        .lte('created_at', toDate);

      const totalRevenue = projects?.reduce((sum, p) => sum + (p.total_budget || 0), 0) || 0;
      const projectsToInvoice = projects?.filter(p => p.project_status === 'da_fatturare') || [];

      const { count: totalQuotes } = await supabase
        .from('quotes')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', fromDate)
        .lte('created_at', toDate);

      const { count: approvedQuotes } = await supabase
        .from('quotes')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'approved')
        .gte('created_at', fromDate)
        .lte('created_at', toDate);

      const margins = projects?.map(p => p.margin_percentage || 0).filter(m => m > 0) || [];
      const avgMargin = margins.length > 0 ? margins.reduce((a, b) => a + b, 0) / margins.length : 0;

      // Calculate monthly revenue for current and previous year
      const now = new Date();
      const currentYear = now.getFullYear();
      const previousYear = currentYear - 1;
      
      const monthlyRevenue: { month: string; currentYear: number; previousYear: number }[] = [];
      const monthNames = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
      
      for (let month = 0; month < 12; month++) {
        const currentYearRevenue = projects?.filter(p => {
          const createdAt = new Date(p.created_at);
          return createdAt.getFullYear() === currentYear && createdAt.getMonth() === month;
        }).reduce((sum, p) => sum + (p.total_budget || 0), 0) || 0;
        
        const previousYearRevenue = projects?.filter(p => {
          const createdAt = new Date(p.created_at);
          return createdAt.getFullYear() === previousYear && createdAt.getMonth() === month;
        }).reduce((sum, p) => sum + (p.total_budget || 0), 0) || 0;
        
        monthlyRevenue.push({
          month: monthNames[month],
          currentYear: currentYearRevenue,
          previousYear: previousYearRevenue
        });
      }

      return {
        stats: {
          totalRevenue,
          pendingInvoices: 0,
          projectsToInvoice: projectsToInvoice.length,
          totalQuotes: totalQuotes || 0,
          approvedQuotes: approvedQuotes || 0,
          avgMargin
        },
        projectsToInvoice: projectsToInvoice.map(p => ({
          id: p.id,
          name: p.name,
          client_name: p.clients?.name,
          project_status: p.project_status,
          total_budget: p.total_budget || 0,
          margin_percentage: p.margin_percentage
        })),
        monthlyRevenue
      };
    },
    enabled: userRole === 'finance'
  });

  // User Hours Summary query (for admin and finance)
  const { data: userHoursData } = useQuery({
    queryKey: ['user-hours-summary', dateRange.from.toISOString(), dateRange.to.toISOString()],
    queryFn: async () => {
      const fromDateStr = dateRange.from.toISOString().split('T')[0];
      const toDateStr = dateRange.to.toISOString().split('T')[0];

      // Get all approved users with contract info
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, contract_type, contract_hours, contract_hours_period')
        .eq('approved', true);

      // Get time tracking for date range
      const { data: timeEntries } = await supabase
        .from('activity_time_tracking')
        .select('user_id, actual_start_time, actual_end_time')
        .gte('scheduled_date', fromDateStr)
        .lte('scheduled_date', toDateStr)
        .not('actual_start_time', 'is', null)
        .not('actual_end_time', 'is', null);

      // Calculate confirmed hours per user
      const userHoursMap: Record<string, number> = {};
      timeEntries?.forEach(e => {
        if (e.actual_start_time && e.actual_end_time) {
          const start = new Date(e.actual_start_time);
          const end = new Date(e.actual_end_time);
          const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
          userHoursMap[e.user_id] = (userHoursMap[e.user_id] || 0) + hours;
        }
      });

      // Build user data
      const usersData = profiles?.map(profile => ({
        id: profile.id,
        name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Utente',
        confirmedHours: userHoursMap[profile.id] || 0,
        contractHours: Number(profile.contract_hours || 0),
        contractType: profile.contract_type || 'full-time',
        contractHoursPeriod: profile.contract_hours_period || 'monthly'
      })).sort((a, b) => b.confirmedHours - a.confirmedHours) || [];

      return usersData;
    },
    enabled: userRole === 'admin' || userRole === 'finance'
  });

  // Team Leader stats query
  const { data: teamLeaderData } = useQuery({
    queryKey: ['team-leader-dashboard-stats', userId, dateRange.from.toISOString(), dateRange.to.toISOString()],
    queryFn: async () => {
      const fromDateStr = dateRange.from.toISOString().split('T')[0];
      const toDateStr = dateRange.to.toISOString().split('T')[0];

      // Get team members
      const { count: teamMembers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('approved', true);

      // Get active projects
      const { data: projects } = await supabase
        .from('projects')
        .select('*, clients(name)')
        .eq('status', 'approvato')
        .in('project_status', ['aperto', 'in_partenza']);

      // Get time tracking for date range
      const { data: timeEntries } = await supabase
        .from('activity_time_tracking')
        .select('*, profiles:user_id(first_name, last_name)')
        .gte('scheduled_date', fromDateStr)
        .lte('scheduled_date', toDateStr);

      const totalPlannedHours = timeEntries?.reduce((sum, e) => {
        if (e.scheduled_start_time && e.scheduled_end_time) {
          const start = new Date(`2000-01-01T${e.scheduled_start_time}`);
          const end = new Date(`2000-01-01T${e.scheduled_end_time}`);
          return sum + (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        }
        return sum;
      }, 0) || 0;

      const totalConfirmedHours = timeEntries?.filter(e => e.actual_start_time && e.actual_end_time)
        .reduce((sum, e) => {
          if (e.actual_start_time && e.actual_end_time) {
            const start = new Date(e.actual_start_time);
            const end = new Date(e.actual_end_time);
            return sum + (end.getTime() - start.getTime()) / (1000 * 60 * 60);
          }
          return sum;
        }, 0) || 0;

      // Group by user for workload
      const userHours: Record<string, { planned: number; confirmed: number; name: string }> = {};
      timeEntries?.forEach(e => {
        const uid = e.user_id;
        if (!userHours[uid]) {
          userHours[uid] = { planned: 0, confirmed: 0, name: '' };
        }
        if (e.scheduled_start_time && e.scheduled_end_time) {
          const start = new Date(`2000-01-01T${e.scheduled_start_time}`);
          const end = new Date(`2000-01-01T${e.scheduled_end_time}`);
          userHours[uid].planned += (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        }
        if (e.actual_start_time && e.actual_end_time) {
          const start = new Date(e.actual_start_time);
          const end = new Date(e.actual_end_time);
          userHours[uid].confirmed += (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        }
      });

      // Get user names
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .in('id', Object.keys(userHours));

      profiles?.forEach(p => {
        if (userHours[p.id]) {
          userHours[p.id].name = `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Utente';
        }
      });

      // Build weekly calendar data (use current week regardless of filter)
      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);

      const dayNames = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
      const weeklyCalendar: { day: string; date: string; planned: number; confirmed: number; activities: number }[] = [];
      
      for (let i = 0; i < 7; i++) {
        const currentDay = new Date(startOfWeek);
        currentDay.setDate(startOfWeek.getDate() + i);
        const dateStr = currentDay.toISOString().split('T')[0];
        
        const dayEntries = timeEntries?.filter(e => e.scheduled_date === dateStr) || [];
        const dayPlanned = dayEntries.reduce((sum, e) => {
          if (e.scheduled_start_time && e.scheduled_end_time) {
            const start = new Date(`2000-01-01T${e.scheduled_start_time}`);
            const end = new Date(`2000-01-01T${e.scheduled_end_time}`);
            return sum + (end.getTime() - start.getTime()) / (1000 * 60 * 60);
          }
          return sum;
        }, 0);
        const dayConfirmed = dayEntries.filter(e => e.actual_start_time && e.actual_end_time).reduce((sum, e) => {
          if (e.actual_start_time && e.actual_end_time) {
            const start = new Date(e.actual_start_time);
            const end = new Date(e.actual_end_time);
            return sum + (end.getTime() - start.getTime()) / (1000 * 60 * 60);
          }
          return sum;
        }, 0);
        
        weeklyCalendar.push({
          day: dayNames[i],
          date: `${currentDay.getDate()}/${currentDay.getMonth() + 1}`,
          planned: Math.round(dayPlanned * 10) / 10,
          confirmed: Math.round(dayConfirmed * 10) / 10,
          activities: dayEntries.length
        });
      }

      return {
        stats: {
          teamMembers: teamMembers || 0,
          activeProjects: projects?.length || 0,
          totalPlannedHours,
          totalConfirmedHours,
          projectsInProgress: projects?.filter(p => p.project_status === 'aperto').length || 0
        },
        teamWorkload: Object.entries(userHours).map(([id, data]) => ({
          id,
          name: data.name,
          planned_hours: data.planned,
          confirmed_hours: data.confirmed
        })),
        recentProjects: projects?.slice(0, 5).map(p => ({
          id: p.id,
          name: p.name,
          client_name: p.clients?.name,
          progress: p.progress,
          project_status: p.project_status
        })) || [],
        weeklyCalendar
      };
    },
    enabled: userRole === 'team_leader' || userRole === 'coordinator'
  });

  // Member stats query
  const { data: memberData } = useQuery({
    queryKey: ['member-dashboard-stats', userId, dateRange.from.toISOString(), dateRange.to.toISOString()],
    queryFn: async () => {
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      const fromDateStr = dateRange.from.toISOString().split('T')[0];
      const toDateStr = dateRange.to.toISOString().split('T')[0];

      // Get time entries for today
      const { data: todayEntries } = await supabase
        .from('activity_time_tracking')
        .select('*, budget_items(activity_name, project_id, projects:project_id(name))')
        .eq('user_id', userId)
        .eq('scheduled_date', today);

      // Get time entries for date range with category info
      const { data: periodEntries } = await supabase
        .from('activity_time_tracking')
        .select('*, budget_items(activity_name, category, project_id, projects:project_id(name))')
        .eq('user_id', userId)
        .gte('scheduled_date', fromDateStr)
        .lte('scheduled_date', toDateStr);

      // Get upcoming entries
      const { data: upcomingEntries } = await supabase
        .from('activity_time_tracking')
        .select('*, budget_items(activity_name, project_id, projects:project_id(name))')
        .eq('user_id', userId)
        .gt('scheduled_date', today)
        .order('scheduled_date', { ascending: true })
        .limit(5);

      // Calculate hours
      const calcHours = (entries: any[], confirmed: boolean) => {
        return entries?.reduce((sum, e) => {
          if (confirmed && (!e.actual_start_time || !e.actual_end_time)) return sum;
          if (!confirmed && e.scheduled_start_time && e.scheduled_end_time) {
            const start = new Date(`2000-01-01T${e.scheduled_start_time}`);
            const end = new Date(`2000-01-01T${e.scheduled_end_time}`);
            return sum + (end.getTime() - start.getTime()) / (1000 * 60 * 60);
          }
          if (confirmed && e.actual_start_time && e.actual_end_time) {
            const start = new Date(e.actual_start_time);
            const end = new Date(e.actual_end_time);
            return sum + (end.getTime() - start.getTime()) / (1000 * 60 * 60);
          }
          return sum;
        }, 0) || 0;
      };

      // Get assigned projects count
      const { data: projectMembers } = await supabase
        .from('project_members')
        .select('project_id')
        .eq('user_id', userId);

      // Get user's contract hours
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('contract_hours, contract_hours_period')
        .eq('id', userId)
        .maybeSingle();

      // Calculate weekly contract hours
      let weeklyContractHours = 0;
      if (userProfile?.contract_hours) {
        switch (userProfile.contract_hours_period) {
          case 'daily':
            weeklyContractHours = userProfile.contract_hours * 5; // 5 working days
            break;
          case 'weekly':
            weeklyContractHours = userProfile.contract_hours;
            break;
          case 'monthly':
            weeklyContractHours = userProfile.contract_hours / 4; // ~4 weeks per month
            break;
          default:
            weeklyContractHours = userProfile.contract_hours / 4;
        }
      }

      const pendingActivities = periodEntries?.filter(e => !e.actual_start_time).length || 0;

      // Calculate hours by project for the period (both planned and confirmed)
      const projectHoursMap: Record<string, { name: string; plannedHours: number; confirmedHours: number }> = {};
      periodEntries?.forEach(e => {
        const projectName = e.budget_items?.projects?.name || 'Senza progetto';
        if (!projectHoursMap[projectName]) {
          projectHoursMap[projectName] = { name: projectName, plannedHours: 0, confirmedHours: 0 };
        }
        if (e.scheduled_start_time && e.scheduled_end_time) {
          const start = new Date(`2000-01-01T${e.scheduled_start_time}`);
          const end = new Date(`2000-01-01T${e.scheduled_end_time}`);
          projectHoursMap[projectName].plannedHours += (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        }
        if (e.actual_start_time && e.actual_end_time) {
          const start = new Date(e.actual_start_time);
          const end = new Date(e.actual_end_time);
          projectHoursMap[projectName].confirmedHours += (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        }
      });

      const weeklyHoursByProject = Object.values(projectHoursMap)
        .sort((a, b) => b.plannedHours - a.plannedHours)
        .slice(0, 6)
        .map(p => ({ 
          name: p.name, 
          plannedHours: Math.round(p.plannedHours * 10) / 10,
          confirmedHours: Math.round(p.confirmedHours * 10) / 10
        }));

      // Calculate confirmed hours by category
      const categoryHoursMap: Record<string, number> = {};
      periodEntries?.forEach(e => {
        // Only count confirmed entries
        if (e.actual_start_time && e.actual_end_time) {
          // Get category from budget_item, or "Meeting" for Google Calendar events (no budget_item or activity name contains google/calendar)
          let category = e.budget_items?.category || 'Meeting';
          const activityName = e.budget_items?.activity_name?.toLowerCase() || '';
          if (activityName.includes('google') || activityName.includes('calendar') || activityName.includes('meeting')) {
            category = 'Meeting';
          }
          
          if (!categoryHoursMap[category]) {
            categoryHoursMap[category] = 0;
          }
          const start = new Date(e.actual_start_time);
          const end = new Date(e.actual_end_time);
          categoryHoursMap[category] += (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        }
      });

      const confirmedHoursByCategory = Object.entries(categoryHoursMap)
        .map(([category, hours]) => ({ 
          category, 
          hours: Math.round(hours * 10) / 10 
        }))
        .sort((a, b) => b.hours - a.hours);

      return {
        stats: {
          todayPlannedHours: calcHours(todayEntries || [], false),
          todayConfirmedHours: calcHours(todayEntries || [], true),
          weekPlannedHours: calcHours(periodEntries || [], false),
          weekConfirmedHours: calcHours(periodEntries || [], true),
          weeklyContractHours: Math.round(weeklyContractHours * 10) / 10,
          assignedProjects: projectMembers?.length || 0,
          pendingActivities
        },
        todayActivities: todayEntries?.map(e => ({
          id: e.id,
          activity_name: e.budget_items?.activity_name || 'Attività',
          project_name: e.budget_items?.projects?.name || 'Progetto',
          scheduled_date: e.scheduled_date,
          scheduled_start_time: e.scheduled_start_time,
          scheduled_end_time: e.scheduled_end_time,
          is_confirmed: !!e.actual_start_time && !!e.actual_end_time
        })) || [],
        upcomingActivities: upcomingEntries?.map(e => ({
          id: e.id,
          activity_name: e.budget_items?.activity_name || 'Attività',
          project_name: e.budget_items?.projects?.name || 'Progetto',
          scheduled_date: e.scheduled_date,
          scheduled_start_time: e.scheduled_start_time,
          scheduled_end_time: e.scheduled_end_time,
          is_confirmed: !!e.actual_start_time && !!e.actual_end_time
        })) || [],
        weeklyHoursByProject,
        confirmedHoursByCategory
      };
    },
    enabled: userRole === 'member' && !!userId
  });

  if (loading) {
    return (
      <AppLayout>
        <div className="container mx-auto p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-48"></div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-32 bg-muted rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  // Format period label for hours summary
  const getPeriodLabel = () => {
    const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
    return `${dateRange.from.toLocaleDateString('it-IT', options)} - ${dateRange.to.toLocaleDateString('it-IT', options)}`;
  };

  return (
    <AppLayout>
      <div className="container mx-auto p-6 space-y-6">
        {isSimulating && (
          <Alert className="bg-warning/10 border-warning text-warning-foreground">
            <Eye className="h-4 w-4" />
            <AlertDescription className="flex items-center gap-2">
              <span className="font-medium">Modalità Simulazione:</span>
              Stai visualizzando la dashboard come <strong>{ROLE_LABELS[simulatedRole as UserRole]}</strong>
            </AlertDescription>
          </Alert>
        )}
        
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <DashboardDateFilter dateRange={dateRange} onDateRangeChange={setDateRange} />
        </div>
        
        {userRole === 'admin' && adminStats && (
          <>
            <AdminDashboard stats={adminStats} userName={userName} />
            {userHoursData && (
              <UserHoursSummary 
                usersData={userHoursData} 
                periodLabel={getPeriodLabel()} 
                dateFrom={dateRange.from}
                dateTo={dateRange.to}
                onPeriodChange={(from, to) => setDateRange({ from, to })}
              />
            )}
          </>
        )}
        {userRole === 'account' && accountData && (
          <AccountDashboard stats={accountData.stats} recentProjects={accountData.recentProjects} userName={userName} />
        )}
        {userRole === 'finance' && financeData && (
          <>
            <FinanceDashboard 
              stats={financeData.stats} 
              projectsToInvoice={financeData.projectsToInvoice}
              monthlyRevenue={financeData.monthlyRevenue}
              userName={userName}
            />
            {userHoursData && (
              <UserHoursSummary 
                usersData={userHoursData} 
                periodLabel={getPeriodLabel()} 
                dateFrom={dateRange.from}
                dateTo={dateRange.to}
                onPeriodChange={(from, to) => setDateRange({ from, to })}
              />
            )}
          </>
        )}
        {(userRole === 'team_leader' || userRole === 'coordinator') && teamLeaderData && (
          <TeamLeaderDashboard 
            stats={teamLeaderData.stats} 
            teamWorkload={teamLeaderData.teamWorkload}
            recentProjects={teamLeaderData.recentProjects}
            weeklyCalendar={teamLeaderData.weeklyCalendar}
            userName={userName}
          />
        )}
        {userRole === 'member' && memberData && (
          <MemberDashboard 
            stats={memberData.stats} 
            todayActivities={memberData.todayActivities}
            upcomingActivities={memberData.upcomingActivities}
            weeklyHoursByProject={memberData.weeklyHoursByProject}
            confirmedHoursByCategory={memberData.confirmedHoursByCategory}
            userName={userName}
          />
        )}
      </div>
    </AppLayout>
  );
};

export default Dashboard;
