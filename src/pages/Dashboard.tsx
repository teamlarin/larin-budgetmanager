import { useEffect, useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, format, eachDayOfInterval, isWeekend } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { AdminOperationsDashboard } from '@/components/dashboards/AdminOperationsDashboard';
import { AdminFinanceDashboard } from '@/components/dashboards/AdminFinanceDashboard';
import { AccountBudgetQuoteDashboard } from '@/components/dashboards/AccountBudgetQuoteDashboard';
import { FinanceDashboard } from '@/components/dashboards/FinanceDashboard';
import { TeamLeaderDashboard } from '@/components/dashboards/TeamLeaderDashboard';
import { MemberDashboard } from '@/components/dashboards/MemberDashboard';
import { TabbedDashboard } from '@/components/dashboards/TabbedDashboard';
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
  const queryClient = useQueryClient();
  const { getEffectiveRole, isSimulating, simulatedRole } = useRoleSimulation();
  const [realUserRole, setRealUserRole] = useState<UserRole | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date())
  });
  const [memberWeekOffset, setMemberWeekOffset] = useState(0);
  const [teamLeaderWeekOffset, setTeamLeaderWeekOffset] = useState(0);

  // Get effective role (simulated or real)
  const userRole = getEffectiveRole(realUserRole) as UserRole | null;

  // Callback for when leader project progress is updated in MemberDashboard
  const handleLeaderProjectProgressUpdate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['member-dashboard-stats'] });
  }, [queryClient]);

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
        
        const role = roleResult.data?.role as UserRole || 'member';
        setRealUserRole(role);
        setUserName(profileResult.data?.first_name || '');
        
        // Set default date range to "this week" for member, team_leader, and coordinator roles
        if (role === 'member' || role === 'team_leader' || role === 'coordinator') {
          const now = new Date();
          setDateRange({
            from: startOfWeek(now, { weekStartsOn: 1 }),
            to: endOfWeek(now, { weekStartsOn: 1 })
          });
        }
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
        // Budgets data from budgets table
        supabase.from('budgets').select('*', { count: 'exact', head: true }).gte('created_at', fromDate).lte('created_at', toDate),
        supabase.from('budgets').select('*', { count: 'exact', head: true }).eq('status', 'in_attesa').gte('created_at', fromDate).lte('created_at', toDate),
        supabase.from('budgets').select('id, status, total_budget, created_at').eq('status', 'approvato').gte('created_at', fromDate).lte('created_at', toDate),
        // Projects data from projects table (only approved ones that are actual projects)
        supabase.from('projects').select('id, project_status, end_date, created_at').eq('status', 'approvato').gte('created_at', fromDate).lte('created_at', toDate),
        // Quotes
        supabase.from('quotes').select('*', { count: 'exact', head: true }).gte('created_at', fromDate).lte('created_at', toDate),
        supabase.from('quotes').select('*', { count: 'exact', head: true }).in('status', ['draft', 'sent']).gte('created_at', fromDate).lte('created_at', toDate),
        // Users
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('approved', true)
      ]);

      const totalBudgets = results[0].count || 0;
      const pendingBudgets = results[1].count || 0;
      const approvedBudgets = results[2].data || [];
      const projects = results[3].data || [];
      const totalQuotes = results[4].count || 0;
      const pendingQuotes = results[5].count || 0;
      const totalUsers = results[6].count || 0;

      const activeProjects = projects.filter(p => p.project_status === 'aperto' || p.project_status === 'in_partenza').length;
      const totalBudgetValue = approvedBudgets.reduce((sum, b) => sum + (b.total_budget || 0), 0);
      
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

  // Admin personal stats query - ALWAYS uses current week (independent of finance/projects filter)
  const { data: adminPersonalData } = useQuery({
    queryKey: ['admin-personal-stats', userId],
    queryFn: async () => {
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      // Always use current week for personal area
      const weekStart = startOfWeek(now, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
      const fromDateStr = format(weekStart, 'yyyy-MM-dd');
      const toDateStr = format(weekEnd, 'yyyy-MM-dd');

      // Get time entries for today
      const { data: todayEntries } = await supabase
        .from('activity_time_tracking')
        .select('*, budget_items(activity_name, project_id, projects:project_id(name))')
        .eq('user_id', userId)
        .eq('scheduled_date', today);

      // Get time entries for date range with category info and billable status
      const { data: periodEntries } = await supabase
        .from('activity_time_tracking')
        .select('*, budget_items(activity_name, category, project_id, projects:project_id(name, is_billable))')
        .eq('user_id', userId)
        .gte('scheduled_date', fromDateStr)
        .lte('scheduled_date', toDateStr);

      // Calculate hours
      // Use scheduled duration for confirmed hours (consistent with Calendar)
      const calcHours = (entries: any[], confirmed: boolean) => {
        return entries?.reduce((sum, e) => {
          if (confirmed && (!e.actual_start_time || !e.actual_end_time)) return sum;
          if (e.scheduled_start_time && e.scheduled_end_time) {
            const start = new Date(`2000-01-01T${e.scheduled_start_time}`);
            const end = new Date(`2000-01-01T${e.scheduled_end_time}`);
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

      // Get user's contract hours and target productivity
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('contract_hours, contract_hours_period, target_productivity_percentage')
        .eq('id', userId)
        .maybeSingle();

      // Calculate weekly contract hours
      let weeklyContractHours = 0;
      if (userProfile?.contract_hours) {
        switch (userProfile.contract_hours_period) {
          case 'daily':
            weeklyContractHours = userProfile.contract_hours * 5;
            break;
          case 'weekly':
            weeklyContractHours = userProfile.contract_hours;
            break;
          case 'monthly':
            weeklyContractHours = userProfile.contract_hours / 4;
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
        // Use scheduled duration for confirmed hours (consistent with Calendar)
        if (e.actual_start_time && e.actual_end_time && e.scheduled_start_time && e.scheduled_end_time) {
          const start = new Date(`2000-01-01T${e.scheduled_start_time}`);
          const end = new Date(`2000-01-01T${e.scheduled_end_time}`);
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
      // Use scheduled duration for confirmed hours (consistent with Calendar)
      periodEntries?.forEach(e => {
        if (e.actual_start_time && e.actual_end_time && e.scheduled_start_time && e.scheduled_end_time) {
          let category = e.budget_items?.category || 'Meeting';
          const activityName = e.budget_items?.activity_name?.toLowerCase() || '';
          if (activityName.includes('google') || activityName.includes('calendar') || activityName.includes('meeting')) {
            category = 'Meeting';
          }
          
          if (!categoryHoursMap[category]) {
            categoryHoursMap[category] = 0;
          }
          const start = new Date(`2000-01-01T${e.scheduled_start_time}`);
          const end = new Date(`2000-01-01T${e.scheduled_end_time}`);
          categoryHoursMap[category] += (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        }
      });

      const confirmedHoursByCategory = Object.entries(categoryHoursMap)
        .map(([category, hours]) => ({ 
          category, 
          hours: Math.round(hours * 10) / 10 
        }))
        .sort((a, b) => b.hours - a.hours);

      // Calculate billable vs total hours for productivity
      let totalConfirmedHours = 0;
      let billableConfirmedHours = 0;
      // Use scheduled duration for confirmed hours (consistent with Calendar)
      periodEntries?.forEach(e => {
        if (e.actual_start_time && e.actual_end_time && e.scheduled_start_time && e.scheduled_end_time) {
          const start = new Date(`2000-01-01T${e.scheduled_start_time}`);
          const end = new Date(`2000-01-01T${e.scheduled_end_time}`);
          const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
          totalConfirmedHours += hours;
          if (e.budget_items?.projects?.is_billable) {
            billableConfirmedHours += hours;
          }
        }
      });

      const actualProductivity = totalConfirmedHours > 0 
        ? Math.round((billableConfirmedHours / totalConfirmedHours) * 100) 
        : 0;
      const targetProductivity = userProfile?.target_productivity_percentage ?? 80;

      return {
        stats: {
          todayPlannedHours: calcHours(todayEntries || [], false),
          todayConfirmedHours: calcHours(todayEntries || [], true),
          weekPlannedHours: calcHours(periodEntries || [], false),
          weekConfirmedHours: calcHours(periodEntries || [], true),
          weeklyContractHours: Math.round(weeklyContractHours * 10) / 10,
          assignedProjects: projectMembers?.length || 0,
          pendingActivities,
          billableHours: Math.round(billableConfirmedHours * 10) / 10,
          totalHours: Math.round(totalConfirmedHours * 10) / 10,
          actualProductivity,
          targetProductivity
        },
        weeklyHoursByProject,
        confirmedHoursByCategory
      };
    },
    enabled: userRole === 'admin' && !!userId
  });

  // Admin team workload query (weekly)
  const { data: adminWorkloadData, isLoading: workloadLoading } = useQuery({
    queryKey: ['admin-team-workload'],
    queryFn: async () => {
      const now = new Date();
      const weekStart = startOfWeek(now, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

      // Get all approved users with contract info
      const { data: users } = await supabase
        .from('profiles')
        .select('id, full_name, first_name, last_name, contract_hours, contract_hours_period, title, area')
        .eq('approved', true)
        .is('deleted_at', null);

      if (!users) return [];

      const fromDateStr = format(weekStart, 'yyyy-MM-dd');
      const toDateStr = format(weekEnd, 'yyyy-MM-dd');

      // Get time tracking entries
      const { data: timeEntries } = await supabase
        .from('activity_time_tracking')
        .select('user_id, scheduled_start_time, scheduled_end_time')
        .gte('scheduled_date', fromDateStr)
        .lte('scheduled_date', toDateStr);

      // Calculate capacity hours helper
      const calculateCapacity = (hours: number, period: string) => {
        const businessDays = eachDayOfInterval({ start: weekStart, end: weekEnd })
          .filter(day => !isWeekend(day)).length;
        switch (period) {
          case 'daily': return hours * businessDays;
          case 'weekly': return hours;
          case 'monthly': return hours / 4;
          default: return hours / 4;
        }
      };

      // Build workload map
      const workloadMap: Record<string, any> = {};
      users.forEach(user => {
        const fullName = user.full_name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Utente';
        const contractHours = user.contract_hours || 0;
        const contractPeriod = user.contract_hours_period || 'monthly';
        const capacityHours = calculateCapacity(contractHours, contractPeriod);

        workloadMap[user.id] = {
          userId: user.id,
          fullName,
          title: user.title || null,
          area: user.area || null,
          plannedHours: 0,
          capacityHours: Math.round(capacityHours * 10) / 10,
          utilizationPercentage: 0
        };
      });

      // Aggregate planned hours
      timeEntries?.forEach(entry => {
        if (!workloadMap[entry.user_id]) return;
        if (entry.scheduled_start_time && entry.scheduled_end_time) {
          const start = new Date(`2000-01-01T${entry.scheduled_start_time}`);
          const end = new Date(`2000-01-01T${entry.scheduled_end_time}`);
          workloadMap[entry.user_id].plannedHours += (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        }
      });

      // Calculate percentages
      Object.values(workloadMap).forEach((user: any) => {
        user.plannedHours = Math.round(user.plannedHours * 10) / 10;
        user.utilizationPercentage = user.capacityHours > 0 
          ? Math.round((user.plannedHours / user.capacityHours) * 100) 
          : 0;
      });

      return Object.values(workloadMap).sort((a: any, b: any) => b.utilizationPercentage - a.utilizationPercentage);
    },
    enabled: userRole === 'admin'
  });

  // Account stats query
  const { data: accountData } = useQuery({
    queryKey: ['account-dashboard-stats', userId, dateRange.from.toISOString(), dateRange.to.toISOString()],
    queryFn: async () => {
      const fromDate = dateRange.from.toISOString();
      const toDate = dateRange.to.toISOString();

      // Parallel queries for personal and global stats
      const [
        budgetsResult,
        projectsResult,
        myQuotesResult,
        pendingQuotesResult,
        globalBudgetsResult,
        globalPendingBudgetsResult,
        globalApprovedBudgetsResult,
        globalQuotesResult,
        globalPendingQuotesResult
      ] = await Promise.all([
        // Personal budgets
        supabase
          .from('budgets')
          .select('*, clients(name), projects(id, project_status, end_date)')
          .or(`user_id.eq.${userId},account_user_id.eq.${userId}`)
          .gte('created_at', fromDate)
          .lte('created_at', toDate)
          .order('created_at', { ascending: false }),
        // Personal projects
        supabase
          .from('projects')
          .select('id, name, project_status, end_date, clients(name)')
          .or(`user_id.eq.${userId},account_user_id.eq.${userId}`)
          .eq('status', 'approvato')
          .gte('created_at', fromDate)
          .lte('created_at', toDate),
        // Personal quotes
        supabase
          .from('quotes')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .gte('created_at', fromDate)
          .lte('created_at', toDate),
        // Personal pending quotes
        supabase
          .from('quotes')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .in('status', ['draft', 'sent'])
          .gte('created_at', fromDate)
          .lte('created_at', toDate),
        // Global budgets
        supabase
          .from('budgets')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', fromDate)
          .lte('created_at', toDate),
        // Global pending budgets
        supabase
          .from('budgets')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'in_attesa')
          .gte('created_at', fromDate)
          .lte('created_at', toDate),
        // Global approved budgets (for value calculation)
        supabase
          .from('budgets')
          .select('total_budget')
          .eq('status', 'approvato')
          .gte('created_at', fromDate)
          .lte('created_at', toDate),
        // Global quotes
        supabase
          .from('quotes')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', fromDate)
          .lte('created_at', toDate),
        // Global pending quotes
        supabase
          .from('quotes')
          .select('*', { count: 'exact', head: true })
          .in('status', ['draft', 'sent'])
          .gte('created_at', fromDate)
          .lte('created_at', toDate)
      ]);

      const budgets = budgetsResult.data || [];
      const projects = projectsResult.data || [];

      const myBudgets = budgets.length;
      const pendingBudgets = budgets.filter(b => b.status === 'in_attesa').length;
      const activeProjects = projects.filter(p => p.project_status === 'aperto' || p.project_status === 'in_partenza').length;
      const totalBudgetValue = budgets.filter(b => b.status === 'approvato').reduce((sum, b) => sum + (b.total_budget || 0), 0);

      // Projects near deadline
      const now = new Date();
      const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const projectsNearDeadline = projects.filter(p => {
        if (!p.end_date) return false;
        const endDate = new Date(p.end_date);
        return endDate >= now && endDate <= weekFromNow;
      }).length;

      // Recent budgets for display
      const recentBudgets = budgets.slice(0, 5).map(b => ({
        id: b.id,
        name: b.name,
        client_name: b.clients?.name,
        status: b.status,
        project_status: b.projects?.project_status,
        total_budget: b.total_budget || 0,
        end_date: b.projects?.end_date
      }));

      // Global stats
      const globalTotalBudgetValue = (globalApprovedBudgetsResult.data || []).reduce((sum, b) => sum + (b.total_budget || 0), 0);

      return {
        stats: {
          myBudgets,
          pendingBudgets,
          myProjects: projects.length,
          activeProjects,
          myQuotes: myQuotesResult.count || 0,
          pendingQuotes: pendingQuotesResult.count || 0,
          totalBudgetValue,
          projectsNearDeadline
        },
        globalStats: {
          totalBudgets: globalBudgetsResult.count || 0,
          totalPendingBudgets: globalPendingBudgetsResult.count || 0,
          totalQuotes: globalQuotesResult.count || 0,
          totalPendingQuotes: globalPendingQuotesResult.count || 0,
          totalBudgetValue: globalTotalBudgetValue
        },
        recentProjects: recentBudgets
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

      // Get budgets for financial data
      const { data: budgets } = await supabase
        .from('budgets')
        .select('*, clients(name), projects(id, project_status)')
        .eq('status', 'approvato')
        .gte('created_at', fromDate)
        .lte('created_at', toDate);

      // Get projects to invoice (project_status = da_fatturare)
      const { data: projectsToInvoiceData } = await supabase
        .from('projects')
        .select('id, name, project_status, clients(name)')
        .eq('status', 'approvato')
        .eq('project_status', 'da_fatturare')
        .gte('created_at', fromDate)
        .lte('created_at', toDate);

      // Map projects to invoice with budget data
      const projectsToInvoice = projectsToInvoiceData?.map(p => {
        const linkedBudget = budgets?.find(b => b.project_id === p.id);
        return {
          id: p.id,
          name: p.name,
          client_name: p.clients?.name,
          project_status: p.project_status,
          total_budget: linkedBudget?.total_budget || 0,
          margin_percentage: linkedBudget?.margin_percentage
        };
      }) || [];

      const totalRevenue = budgets?.reduce((sum, b) => sum + (b.total_budget || 0), 0) || 0;

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

      const margins = budgets?.map(b => b.margin_percentage || 0).filter(m => m > 0) || [];
      const avgMargin = margins.length > 0 ? margins.reduce((a, b) => a + b, 0) / margins.length : 0;

      // Calculate monthly revenue for current and previous year
      const now = new Date();
      const currentYear = now.getFullYear();
      const previousYear = currentYear - 1;
      
      const monthlyRevenue: { month: string; currentYear: number; previousYear: number }[] = [];
      const monthNames = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
      
      for (let month = 0; month < 12; month++) {
        const currentYearRevenue = budgets?.filter(b => {
          const createdAt = new Date(b.created_at);
          return createdAt.getFullYear() === currentYear && createdAt.getMonth() === month;
        }).reduce((sum, b) => sum + (b.total_budget || 0), 0) || 0;
        
        const previousYearRevenue = budgets?.filter(b => {
          const createdAt = new Date(b.created_at);
          return createdAt.getFullYear() === previousYear && createdAt.getMonth() === month;
        }).reduce((sum, b) => sum + (b.total_budget || 0), 0) || 0;
        
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
        projectsToInvoice,
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

      // Get all approved users with contract info and target productivity
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, contract_type, contract_hours, contract_hours_period, target_productivity_percentage')
        .eq('approved', true);

      // Get time tracking for date range with billable info
      const { data: timeEntries } = await supabase
        .from('activity_time_tracking')
        .select('user_id, scheduled_start_time, scheduled_end_time, actual_start_time, actual_end_time, budget_items(project_id, projects:project_id(is_billable))')
        .gte('scheduled_date', fromDateStr)
        .lte('scheduled_date', toDateStr)
        .not('actual_start_time', 'is', null)
        .not('actual_end_time', 'is', null);

      // Calculate confirmed hours and billable hours per user using scheduled duration (consistent with Calendar)
      const userHoursMap: Record<string, { total: number; billable: number }> = {};
      timeEntries?.forEach(e => {
        if (e.actual_start_time && e.actual_end_time && e.scheduled_start_time && e.scheduled_end_time) {
          const start = new Date(`2000-01-01T${e.scheduled_start_time}`);
          const end = new Date(`2000-01-01T${e.scheduled_end_time}`);
          const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
          
          if (!userHoursMap[e.user_id]) {
            userHoursMap[e.user_id] = { total: 0, billable: 0 };
          }
          userHoursMap[e.user_id].total += hours;
          if (e.budget_items?.projects?.is_billable) {
            userHoursMap[e.user_id].billable += hours;
          }
        }
      });

      // Build user data
      const usersData = profiles?.map(profile => {
        const hours = userHoursMap[profile.id] || { total: 0, billable: 0 };
        const actualProductivity = hours.total > 0 ? Math.round((hours.billable / hours.total) * 100) : 0;
        const targetProductivity = profile.target_productivity_percentage ?? 80;
        
        return {
          id: profile.id,
          name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Utente',
          confirmedHours: hours.total,
          billableHours: hours.billable,
          actualProductivity,
          targetProductivity,
          contractHours: Number(profile.contract_hours || 0),
          contractType: profile.contract_type || 'full-time',
          contractHoursPeriod: profile.contract_hours_period || 'monthly'
        };
      }).sort((a, b) => b.confirmedHours - a.confirmedHours) || [];

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

      // Get team leader's assigned areas
      const { data: leaderAreas } = await supabase
        .from('team_leader_areas')
        .select('area')
        .eq('user_id', userId);

      const assignedAreas = leaderAreas?.map(a => a.area) || [];

      // If no areas assigned, return empty data (team leader should only see their assigned areas)
      if (assignedAreas.length === 0) {
        return {
          stats: {
            teamMembers: 0,
            activeProjects: 0,
            totalPlannedHours: 0,
            totalConfirmedHours: 0,
            projectsInProgress: 0
          },
          teamWorkload: [],
          recentProjects: [],
          weeklyCalendar: []
        };
      }

      // Get team members filtered by areas with contract info
      const { data: teamMemberProfiles } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, area, contract_hours, contract_hours_period')
        .eq('approved', true)
        .is('deleted_at', null)
        .in('area', assignedAreas);

      const teamMemberIds = teamMemberProfiles?.map(p => p.id) || [];

      // Get active projects filtered by areas
      const { data: projects } = await supabase
        .from('projects')
        .select('*, clients(name)')
        .eq('status', 'approvato')
        .in('project_status', ['aperto', 'in_partenza'])
        .in('area', assignedAreas);

      // Get projects near deadline (next 14 days) for the team's areas
      const currentDate = new Date();
      const twoWeeksFromNow = new Date(currentDate.getTime() + 14 * 24 * 60 * 60 * 1000);
      const { data: projectsNearDeadline } = await supabase
        .from('projects')
        .select('*, clients(name)')
        .eq('status', 'approvato')
        .in('project_status', ['aperto', 'in_partenza'])
        .in('area', assignedAreas)
        .not('end_date', 'is', null)
        .gte('end_date', currentDate.toISOString().split('T')[0])
        .lte('end_date', twoWeeksFromNow.toISOString().split('T')[0])
        .order('end_date', { ascending: true });

      // Get time tracking for date range, filtered by team members
      let timeEntries: any[] = [];
      if (teamMemberIds.length > 0) {
        const { data } = await supabase
          .from('activity_time_tracking')
          .select('*, profiles:user_id(first_name, last_name, area)')
          .gte('scheduled_date', fromDateStr)
          .lte('scheduled_date', toDateStr)
          .in('user_id', teamMemberIds);
        timeEntries = data || [];
      }

      const totalPlannedHours = timeEntries?.reduce((sum, e) => {
        if (e.scheduled_start_time && e.scheduled_end_time) {
          const start = new Date(`2000-01-01T${e.scheduled_start_time}`);
          const end = new Date(`2000-01-01T${e.scheduled_end_time}`);
          return sum + (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        }
        return sum;
      }, 0) || 0;

      // Use scheduled duration for confirmed hours (consistent with Calendar)
      const totalConfirmedHours = timeEntries?.filter(e => e.actual_start_time && e.actual_end_time)
        .reduce((sum, e) => {
          if (e.scheduled_start_time && e.scheduled_end_time) {
            const start = new Date(`2000-01-01T${e.scheduled_start_time}`);
            const end = new Date(`2000-01-01T${e.scheduled_end_time}`);
            return sum + (end.getTime() - start.getTime()) / (1000 * 60 * 60);
          }
          return sum;
        }, 0) || 0;

      // Group by user for workload
      const userHours: Record<string, { planned: number; confirmed: number; name: string; capacity: number }> = {};
      timeEntries?.forEach(e => {
        const uid = e.user_id;
        if (!userHours[uid]) {
          userHours[uid] = { planned: 0, confirmed: 0, name: '', capacity: 0 };
        }
        if (e.scheduled_start_time && e.scheduled_end_time) {
          const start = new Date(`2000-01-01T${e.scheduled_start_time}`);
          const end = new Date(`2000-01-01T${e.scheduled_end_time}`);
          userHours[uid].planned += (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        }
        // Use scheduled duration for confirmed hours (consistent with Calendar)
        if (e.actual_start_time && e.actual_end_time && e.scheduled_start_time && e.scheduled_end_time) {
          const start = new Date(`2000-01-01T${e.scheduled_start_time}`);
          const end = new Date(`2000-01-01T${e.scheduled_end_time}`);
          userHours[uid].confirmed += (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        }
      });

      // Helper to calculate capacity hours based on contract
      const calculateCapacityHours = (contractHours: number, contractPeriod: string, startDate: Date, endDate: Date): number => {
        // Count business days in the period
        let businessDays = 0;
        const current = new Date(startDate);
        while (current <= endDate) {
          const dayOfWeek = current.getDay();
          if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            businessDays++;
          }
          current.setDate(current.getDate() + 1);
        }
        
        switch (contractPeriod) {
          case 'daily':
            return contractHours * businessDays;
          case 'weekly':
            return contractHours * (businessDays / 5);
          case 'monthly':
            return contractHours * (businessDays / 22);
          default:
            return contractHours * (businessDays / 22);
        }
      };

      // Use team member profiles for names, capacity and include all team members (even those without entries)
      const periodStart = dateRange.from;
      const periodEnd = dateRange.to;
      
      teamMemberProfiles?.forEach(p => {
        const name = `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Utente';
        const contractHours = p.contract_hours || 0;
        const contractPeriod = p.contract_hours_period || 'monthly';
        const capacity = calculateCapacityHours(contractHours, contractPeriod, periodStart, periodEnd);
        
        if (userHours[p.id]) {
          userHours[p.id].name = name;
          userHours[p.id].capacity = capacity;
        } else {
          // Include team members with no time entries
          userHours[p.id] = { planned: 0, confirmed: 0, name, capacity };
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
        // Use scheduled duration for confirmed hours (consistent with Calendar)
        const dayConfirmed = dayEntries.filter(e => e.actual_start_time && e.actual_end_time).reduce((sum, e) => {
          if (e.scheduled_start_time && e.scheduled_end_time) {
            const start = new Date(`2000-01-01T${e.scheduled_start_time}`);
            const end = new Date(`2000-01-01T${e.scheduled_end_time}`);
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
          teamMembers: teamMemberProfiles?.length || 0,
          activeProjects: projects?.length || 0,
          totalPlannedHours,
          totalConfirmedHours,
          projectsInProgress: projects?.filter(p => p.project_status === 'aperto').length || 0
        },
        teamWorkload: Object.entries(userHours).map(([id, data]) => ({
          id,
          name: data.name,
          planned_hours: data.planned,
          confirmed_hours: data.confirmed,
          capacity_hours: data.capacity
        })),
        recentProjects: projects?.slice(0, 5).map(p => ({
          id: p.id,
          name: p.name,
          client_name: p.clients?.name,
          progress: p.progress,
          project_status: p.project_status
        })) || [],
        projectsNearDeadline: projectsNearDeadline?.map(p => ({
          id: p.id,
          name: p.name,
          client_name: p.clients?.name,
          end_date: p.end_date,
          progress: p.progress,
          project_status: p.project_status
        })) || [],
        weeklyCalendar
      };
    },
    enabled: userRole === 'team_leader'
  });

  // Team Leader weekly calendar query (separate for week navigation, starts on Monday)
  const { data: teamLeaderWeeklyCalendar } = useQuery({
    queryKey: ['team-leader-weekly-calendar', userId, teamLeaderWeekOffset],
    queryFn: async () => {
      const now = new Date();
      // Use local date format to avoid timezone issues
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      
      // Calculate start of week (Monday) with offset
      const startOfWeekDate = new Date(now);
      const dayOfWeek = startOfWeekDate.getDay();
      const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      startOfWeekDate.setDate(startOfWeekDate.getDate() + daysToMonday + (teamLeaderWeekOffset * 7));
      startOfWeekDate.setHours(0, 0, 0, 0);
      
      const endOfWeekDate = new Date(startOfWeekDate);
      endOfWeekDate.setDate(startOfWeekDate.getDate() + 6);
      
      const weekStartStr = `${startOfWeekDate.getFullYear()}-${String(startOfWeekDate.getMonth() + 1).padStart(2, '0')}-${String(startOfWeekDate.getDate()).padStart(2, '0')}`;
      const weekEndStr = `${endOfWeekDate.getFullYear()}-${String(endOfWeekDate.getMonth() + 1).padStart(2, '0')}-${String(endOfWeekDate.getDate()).padStart(2, '0')}`;
      
      // Get team leader's assigned areas
      const { data: leaderAreas } = await supabase
        .from('team_leader_areas')
        .select('area')
        .eq('user_id', userId);

      const assignedAreas = leaderAreas?.map(a => a.area) || [];

      if (assignedAreas.length === 0) {
        return { calendar: [], dateRange: '' };
      }

      // Get team members filtered by areas
      const { data: teamMemberProfiles } = await supabase
        .from('profiles')
        .select('id')
        .eq('approved', true)
        .is('deleted_at', null)
        .in('area', assignedAreas);

      const teamMemberIds = teamMemberProfiles?.map(p => p.id) || [];

      if (teamMemberIds.length === 0) {
        return { calendar: [], dateRange: '' };
      }

      // Fetch entries for this specific week, filtered by team members
      const { data: weekEntries } = await supabase
        .from('activity_time_tracking')
        .select('scheduled_date, scheduled_start_time, scheduled_end_time, actual_start_time, actual_end_time')
        .in('user_id', teamMemberIds)
        .gte('scheduled_date', weekStartStr)
        .lte('scheduled_date', weekEndStr);
      
      const dayNames = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
      const weeklyCalendar: { day: string; date: string; planned: number; confirmed: number; activities: number; isToday: boolean }[] = [];
      
      for (let i = 0; i < 7; i++) {
        const currentDay = new Date(startOfWeekDate);
        currentDay.setDate(startOfWeekDate.getDate() + i);
        const dateStr = `${currentDay.getFullYear()}-${String(currentDay.getMonth() + 1).padStart(2, '0')}-${String(currentDay.getDate()).padStart(2, '0')}`;
        
        const dayEntries = weekEntries?.filter(e => e.scheduled_date === dateStr) || [];
        const dayPlanned = dayEntries.reduce((sum, e) => {
          if (e.scheduled_start_time && e.scheduled_end_time) {
            const start = new Date(`2000-01-01T${e.scheduled_start_time}`);
            const end = new Date(`2000-01-01T${e.scheduled_end_time}`);
            return sum + (end.getTime() - start.getTime()) / (1000 * 60 * 60);
          }
          return sum;
        }, 0);
        // Use scheduled duration for confirmed hours (consistent with Calendar)
        const dayConfirmed = dayEntries.filter(e => e.actual_start_time && e.actual_end_time).reduce((sum, e) => {
          if (e.scheduled_start_time && e.scheduled_end_time) {
            const start = new Date(`2000-01-01T${e.scheduled_start_time}`);
            const end = new Date(`2000-01-01T${e.scheduled_end_time}`);
            return sum + (end.getTime() - start.getTime()) / (1000 * 60 * 60);
          }
          return sum;
        }, 0);
        
        weeklyCalendar.push({
          day: dayNames[i],
          date: `${currentDay.getDate()}/${currentDay.getMonth() + 1}`,
          planned: Math.round(dayPlanned * 10) / 10,
          confirmed: Math.round(dayConfirmed * 10) / 10,
          activities: dayEntries.length,
          isToday: dateStr === todayStr
        });
      }
      
      // Format date range label
      const monthNames = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
      const startDay = startOfWeekDate.getDate();
      const endDay = endOfWeekDate.getDate();
      const startMonth = monthNames[startOfWeekDate.getMonth()];
      const endMonth = monthNames[endOfWeekDate.getMonth()];
      
      const dateRangeLabel = startMonth === endMonth 
        ? `${startDay}-${endDay} ${startMonth}`
        : `${startDay} ${startMonth} - ${endDay} ${endMonth}`;
      
      return { calendar: weeklyCalendar, dateRange: dateRangeLabel };
    },
    enabled: userRole === 'team_leader' && !!userId
  });

  // Member stats query
  const { data: memberData } = useQuery({
    queryKey: ['member-dashboard-stats', userId, dateRange.from.toISOString(), dateRange.to.toISOString()],
    queryFn: async () => {
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const fromDateStr = dateRange.from.toISOString().split('T')[0];
      const toDateStr = dateRange.to.toISOString().split('T')[0];

      // Calculate 6 months ago for productivity trend
      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      const sixMonthsAgoStr = sixMonthsAgo.toISOString().split('T')[0];

      // Parallel fetch all data we need
      const [
        todayEntriesResult,
        periodEntriesResult,
        upcomingEntriesResult,
        projectMembersResult,
        projectsAsLeaderResult,
        userProfileResult,
        sixMonthEntriesResult
      ] = await Promise.all([
        // Today's entries
        supabase
          .from('activity_time_tracking')
          .select('*, budget_items(activity_name, project_id, projects:project_id(name))')
          .eq('user_id', userId)
          .eq('scheduled_date', today),
        // Period entries with category and billable info
        supabase
          .from('activity_time_tracking')
          .select('*, budget_items(activity_name, category, project_id, projects:project_id(name, is_billable))')
          .eq('user_id', userId)
          .gte('scheduled_date', fromDateStr)
          .lte('scheduled_date', toDateStr),
        // Upcoming entries
        supabase
          .from('activity_time_tracking')
          .select('*, budget_items(activity_name, project_id, projects:project_id(name))')
          .eq('user_id', userId)
          .gt('scheduled_date', today)
          .order('scheduled_date', { ascending: true })
          .limit(5),
        // Project memberships
        supabase
          .from('project_members')
          .select('project_id')
          .eq('user_id', userId),
        // Projects as leader (where user is project_leader_id)
        supabase
          .from('projects')
          .select('id, name, progress, project_status, end_date, clients(name)')
          .eq('project_leader_id', userId)
          .eq('status', 'approvato')
          .in('project_status', ['aperto', 'in_partenza'])
          .order('end_date', { ascending: true }),
        // User profile
        supabase
          .from('profiles')
          .select('contract_hours, contract_hours_period, target_productivity_percentage')
          .eq('id', userId)
          .maybeSingle(),
        // 6-month entries for productivity trend (single query instead of 6)
        supabase
          .from('activity_time_tracking')
          .select('scheduled_date, scheduled_start_time, scheduled_end_time, actual_start_time, actual_end_time, budget_items(projects:project_id(is_billable))')
          .eq('user_id', userId)
          .gte('scheduled_date', sixMonthsAgoStr)
      ]);

      const todayEntries = todayEntriesResult.data;
      const periodEntries = periodEntriesResult.data;
      const upcomingEntries = upcomingEntriesResult.data;
      const projectMembers = projectMembersResult.data;
      const projectsAsLeader = projectsAsLeaderResult.data;
      const userProfile = userProfileResult.data;
      const sixMonthEntries = sixMonthEntriesResult.data;

      // Use scheduled duration for confirmed hours (consistent with Calendar)
      const calcHours = (entries: any[], confirmed: boolean) => {
        return entries?.reduce((sum, e) => {
          if (confirmed && (!e.actual_start_time || !e.actual_end_time)) return sum;
          if (e.scheduled_start_time && e.scheduled_end_time) {
            const start = new Date(`2000-01-01T${e.scheduled_start_time}`);
            const end = new Date(`2000-01-01T${e.scheduled_end_time}`);
            return sum + (end.getTime() - start.getTime()) / (1000 * 60 * 60);
          }
          return sum;
        }, 0) || 0;
      };

      // Combine and deduplicate project IDs for the count
      const memberProjectIds = new Set(projectMembers?.map(pm => pm.project_id) || []);
      const leaderProjectIds = projectsAsLeader?.map(p => p.id) || [];
      leaderProjectIds.forEach(id => memberProjectIds.add(id));
      const totalAssignedProjects = memberProjectIds.size;

      // Calculate weekly contract hours
      let weeklyContractHours = 0;
      if (userProfile?.contract_hours) {
        switch (userProfile.contract_hours_period) {
          case 'daily':
            weeklyContractHours = userProfile.contract_hours * 5;
            break;
          case 'weekly':
            weeklyContractHours = userProfile.contract_hours;
            break;
          case 'monthly':
            weeklyContractHours = userProfile.contract_hours / 4;
            break;
          default:
            weeklyContractHours = userProfile.contract_hours / 4;
        }
      }

      const pendingActivities = periodEntries?.filter(e => !e.actual_start_time).length || 0;

      // Calculate hours by project for the period
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
        // Use scheduled duration for confirmed hours (consistent with Calendar)
        if (e.actual_start_time && e.actual_end_time && e.scheduled_start_time && e.scheduled_end_time) {
          const start = new Date(`2000-01-01T${e.scheduled_start_time}`);
          const end = new Date(`2000-01-01T${e.scheduled_end_time}`);
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
      // Use scheduled duration for confirmed hours (consistent with Calendar)
      periodEntries?.forEach(e => {
        if (e.actual_start_time && e.actual_end_time && e.scheduled_start_time && e.scheduled_end_time) {
          let category = e.budget_items?.category || 'Meeting';
          const activityName = e.budget_items?.activity_name?.toLowerCase() || '';
          if (activityName.includes('google') || activityName.includes('calendar') || activityName.includes('meeting')) {
            category = 'Meeting';
          }
          if (!categoryHoursMap[category]) {
            categoryHoursMap[category] = 0;
          }
          const start = new Date(`2000-01-01T${e.scheduled_start_time}`);
          const end = new Date(`2000-01-01T${e.scheduled_end_time}`);
          categoryHoursMap[category] += (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        }
      });

      const confirmedHoursByCategory = Object.entries(categoryHoursMap)
        .map(([category, hours]) => ({ category, hours: Math.round(hours * 10) / 10 }))
        .sort((a, b) => b.hours - a.hours);

      // Calculate billable vs total hours for productivity
      let totalConfirmedHours = 0;
      let billableConfirmedHours = 0;
      // Use scheduled duration for confirmed hours (consistent with Calendar)
      periodEntries?.forEach(e => {
        if (e.actual_start_time && e.actual_end_time && e.scheduled_start_time && e.scheduled_end_time) {
          const start = new Date(`2000-01-01T${e.scheduled_start_time}`);
          const end = new Date(`2000-01-01T${e.scheduled_end_time}`);
          const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
          totalConfirmedHours += hours;
          if (e.budget_items?.projects?.is_billable) {
            billableConfirmedHours += hours;
          }
        }
      });

      const actualProductivity = totalConfirmedHours > 0 
        ? Math.round((billableConfirmedHours / totalConfirmedHours) * 100) 
        : 0;
      const targetProductivity = userProfile?.target_productivity_percentage ?? 80;

      // Process 6-month data for productivity trend (from single query)
      const monthNames = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
      const productivityTrend: { month: string; productivity: number; target: number }[] = [];
      const monthlyHoursTrend: { month: string; plannedHours: number; confirmedHours: number }[] = [];

      for (let i = 5; i >= 0; i--) {
        const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
        const monthFromStr = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}-${String(monthStart.getDate()).padStart(2, '0')}`;
        const monthToStr = `${monthEnd.getFullYear()}-${String(monthEnd.getMonth() + 1).padStart(2, '0')}-${String(monthEnd.getDate()).padStart(2, '0')}`;

        // Filter entries for this month from the single query result
        const monthEntries = sixMonthEntries?.filter(e => 
          e.scheduled_date && e.scheduled_date >= monthFromStr && e.scheduled_date <= monthToStr
        ) || [];

        let monthTotal = 0;
        let monthBillable = 0;
        let monthPlanned = 0;
        let monthConfirmed = 0;

        monthEntries.forEach(e => {
          if (e.scheduled_start_time && e.scheduled_end_time) {
            const schedStart = new Date(`1970-01-01T${e.scheduled_start_time}`);
            const schedEnd = new Date(`1970-01-01T${e.scheduled_end_time}`);
            monthPlanned += (schedEnd.getTime() - schedStart.getTime()) / (1000 * 60 * 60);
          }
          // Use scheduled duration for confirmed hours (consistent with Calendar)
          if (e.actual_start_time && e.actual_end_time && e.scheduled_start_time && e.scheduled_end_time) {
            const schedStart = new Date(`1970-01-01T${e.scheduled_start_time}`);
            const schedEnd = new Date(`1970-01-01T${e.scheduled_end_time}`);
            const hours = (schedEnd.getTime() - schedStart.getTime()) / (1000 * 60 * 60);
            monthTotal += hours;
            monthConfirmed += hours;
            if (e.budget_items?.projects?.is_billable) {
              monthBillable += hours;
            }
          }
        });

        const monthProductivity = monthTotal > 0 ? Math.round((monthBillable / monthTotal) * 100) : 0;

        productivityTrend.push({
          month: monthNames[monthStart.getMonth()],
          productivity: monthProductivity,
          target: targetProductivity
        });

        monthlyHoursTrend.push({
          month: monthNames[monthStart.getMonth()],
          plannedHours: Math.round(monthPlanned * 10) / 10,
          confirmedHours: Math.round(monthConfirmed * 10) / 10
        });
      }

      return {
        stats: {
          todayPlannedHours: calcHours(todayEntries || [], false),
          todayConfirmedHours: calcHours(todayEntries || [], true),
          weekPlannedHours: calcHours(periodEntries || [], false),
          weekConfirmedHours: calcHours(periodEntries || [], true),
          weeklyContractHours: Math.round(weeklyContractHours * 10) / 10,
          assignedProjects: totalAssignedProjects,
          pendingActivities,
          billableHours: Math.round(billableConfirmedHours * 10) / 10,
          totalHours: Math.round(totalConfirmedHours * 10) / 10,
          actualProductivity,
          targetProductivity
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
        confirmedHoursByCategory,
        productivityTrend,
        monthlyHoursTrend,
        leaderProjects: projectsAsLeader?.map(p => ({
          id: p.id,
          name: p.name,
          client_name: p.clients?.name,
          progress: p.progress,
          project_status: p.project_status,
          end_date: p.end_date
        })) || []
      };
    },
    enabled: (userRole === 'member' || userRole === 'coordinator' || userRole === 'admin' || userRole === 'account' || userRole === 'team_leader') && !!userId
  });

  // Member weekly calendar query (separate for week navigation)
  const { data: memberWeeklyCalendar } = useQuery({
    queryKey: ['member-weekly-calendar', userId, memberWeekOffset],
    queryFn: async () => {
      const now = new Date();
      // Use local date format to avoid timezone issues
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      
      // Calculate start of week (Monday) with offset
      const startOfWeekDate = new Date(now);
      // Get to Monday of current week
      const dayOfWeek = startOfWeekDate.getDay();
      const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Sunday = go back 6, others = go to Monday
      startOfWeekDate.setDate(startOfWeekDate.getDate() + daysToMonday + (memberWeekOffset * 7));
      startOfWeekDate.setHours(0, 0, 0, 0);
      
      const endOfWeekDate = new Date(startOfWeekDate);
      endOfWeekDate.setDate(startOfWeekDate.getDate() + 6);
      
      // Use local date format to avoid timezone issues
      const weekStartStr = `${startOfWeekDate.getFullYear()}-${String(startOfWeekDate.getMonth() + 1).padStart(2, '0')}-${String(startOfWeekDate.getDate()).padStart(2, '0')}`;
      const weekEndStr = `${endOfWeekDate.getFullYear()}-${String(endOfWeekDate.getMonth() + 1).padStart(2, '0')}-${String(endOfWeekDate.getDate()).padStart(2, '0')}`;
      
      // Fetch entries for this specific week
      const { data: weekEntries } = await supabase
        .from('activity_time_tracking')
        .select('scheduled_date, scheduled_start_time, scheduled_end_time, actual_start_time, actual_end_time')
        .eq('user_id', userId)
        .gte('scheduled_date', weekStartStr)
        .lte('scheduled_date', weekEndStr);
      
      const dayNames = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
      const weeklyCalendar: { day: string; date: string; planned: number; confirmed: number; activities: number; isToday: boolean }[] = [];
      
      for (let i = 0; i < 7; i++) {
        const currentDay = new Date(startOfWeekDate);
        currentDay.setDate(startOfWeekDate.getDate() + i);
        // Use local date format to avoid timezone issues
        const dateStr = `${currentDay.getFullYear()}-${String(currentDay.getMonth() + 1).padStart(2, '0')}-${String(currentDay.getDate()).padStart(2, '0')}`;
        
        const dayEntries = weekEntries?.filter(e => e.scheduled_date === dateStr) || [];
        const dayPlanned = dayEntries.reduce((sum, e) => {
          if (e.scheduled_start_time && e.scheduled_end_time) {
            const start = new Date(`2000-01-01T${e.scheduled_start_time}`);
            const end = new Date(`2000-01-01T${e.scheduled_end_time}`);
            return sum + (end.getTime() - start.getTime()) / (1000 * 60 * 60);
          }
          return sum;
        }, 0);
        // Use scheduled duration for confirmed hours (consistent with Calendar)
        const dayConfirmed = dayEntries.filter(e => e.actual_start_time && e.actual_end_time).reduce((sum, e) => {
          if (e.scheduled_start_time && e.scheduled_end_time) {
            const start = new Date(`2000-01-01T${e.scheduled_start_time}`);
            const end = new Date(`2000-01-01T${e.scheduled_end_time}`);
            return sum + (end.getTime() - start.getTime()) / (1000 * 60 * 60);
          }
          return sum;
        }, 0);
        
        weeklyCalendar.push({
          day: dayNames[i],
          date: `${currentDay.getDate()}/${currentDay.getMonth() + 1}`,
          planned: Math.round(dayPlanned * 10) / 10,
          confirmed: Math.round(dayConfirmed * 10) / 10,
          activities: dayEntries.length,
          isToday: dateStr === todayStr
        });
      }
      
      // Format date range label (e.g., "20-26 Gen")
      const monthNames = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
      const startDay = startOfWeekDate.getDate();
      const endDay = endOfWeekDate.getDate();
      const startMonth = monthNames[startOfWeekDate.getMonth()];
      const endMonth = monthNames[endOfWeekDate.getMonth()];
      
      const dateRange = startMonth === endMonth 
        ? `${startDay}-${endDay} ${startMonth}`
        : `${startDay} ${startMonth} - ${endDay} ${endMonth}`;
      
      return { calendar: weeklyCalendar, dateRange };
    },
    enabled: (userRole === 'member' || userRole === 'coordinator' || userRole === 'admin' || userRole === 'account' || userRole === 'team_leader') && !!userId
  });

  // Prepare member data props for TabbedDashboard
  const getMemberDataProps = () => {
    if (!memberData) return null;
    return {
      stats: memberData.stats,
      todayActivities: memberData.todayActivities,
      upcomingActivities: memberData.upcomingActivities,
      weeklyHoursByProject: memberData.weeklyHoursByProject,
      confirmedHoursByCategory: memberData.confirmedHoursByCategory,
      productivityTrend: memberData.productivityTrend,
      monthlyHoursTrend: memberData.monthlyHoursTrend,
      weeklyCalendar: memberWeeklyCalendar?.calendar,
      weekOffset: memberWeekOffset,
      onWeekChange: setMemberWeekOffset,
      weekDateRange: memberWeeklyCalendar?.dateRange,
      leaderProjects: memberData.leaderProjects,
      userName,
      onLeaderProjectProgressUpdate: handleLeaderProjectProgressUpdate
    };
  };

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
        
        {/* Show date filter for non-admin roles only - admin has section-specific filters */}
        {userRole !== 'admin' && !['member', 'coordinator', 'team_leader'].includes(userRole || '') && (
          <div className="flex justify-end">
            <DashboardDateFilter 
              dateRange={dateRange} 
              onDateRangeChange={setDateRange} 
              defaultPreset={['member', 'team_leader', 'coordinator'].includes(userRole || '') ? 'thisWeek' : 'thisMonth'}
            />
          </div>
        )}
        
        {userRole === 'admin' && adminStats && getMemberDataProps() && (
          <TabbedDashboard
            memberData={getMemberDataProps()!}
            roleTabs={[
              {
                label: 'Operations',
                value: 'operations',
                content: (
                  <>
                    <AdminOperationsDashboard 
                      stats={{
                        totalProjects: adminStats.totalProjects,
                        activeProjects: adminStats.activeProjects,
                        totalUsers: adminStats.totalUsers
                      }}
                      teamWorkload={adminWorkloadData as any}
                      workloadLoading={workloadLoading}
                      dateRange={dateRange}
                      onDateRangeChange={setDateRange}
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
                )
              },
              {
                label: 'Finance',
                value: 'finance',
                content: (
                  <AdminFinanceDashboard 
                    stats={adminStats}
                    dateRange={dateRange}
                    onDateRangeChange={setDateRange}
                  />
                )
              }
            ]}
          />
        )}
        {userRole === 'account' && accountData && getMemberDataProps() && (
          <TabbedDashboard
            memberData={getMemberDataProps()!}
            roleTabs={[
              {
                label: 'Budget & Quote',
                value: 'budget-quote',
                content: (
                  <AccountBudgetQuoteDashboard 
                    stats={accountData.stats}
                    globalStats={accountData.globalStats}
                    recentProjects={accountData.recentProjects}
                    dateRange={dateRange}
                    onDateRangeChange={setDateRange}
                  />
                )
              }
            ]}
          />
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
        {userRole === 'team_leader' && teamLeaderData && getMemberDataProps() && (
          <TabbedDashboard
            memberData={getMemberDataProps()!}
            roleSpecificTabLabel="Il Mio Team"
            roleSpecificContent={
              <TeamLeaderDashboard 
                stats={teamLeaderData.stats} 
                teamWorkload={teamLeaderData.teamWorkload}
                recentProjects={teamLeaderData.recentProjects}
                projectsNearDeadline={teamLeaderData.projectsNearDeadline}
                weeklyCalendar={teamLeaderWeeklyCalendar?.calendar}
                weekOffset={teamLeaderWeekOffset}
                onWeekChange={setTeamLeaderWeekOffset}
                weekDateRange={teamLeaderWeeklyCalendar?.dateRange}
                userName={userName}
                hideHeader
                dateFrom={dateRange.from}
                dateTo={dateRange.to}
              />
            }
          />
        )}
        {userRole === 'coordinator' && memberData && (
          <MemberDashboard 
            stats={memberData.stats} 
            todayActivities={memberData.todayActivities}
            upcomingActivities={memberData.upcomingActivities}
            weeklyHoursByProject={memberData.weeklyHoursByProject}
            confirmedHoursByCategory={memberData.confirmedHoursByCategory}
            productivityTrend={memberData.productivityTrend}
            monthlyHoursTrend={memberData.monthlyHoursTrend}
            weeklyCalendar={memberWeeklyCalendar?.calendar}
            weekOffset={memberWeekOffset}
            onWeekChange={setMemberWeekOffset}
            weekDateRange={memberWeeklyCalendar?.dateRange}
            leaderProjects={memberData.leaderProjects}
            userName={userName}
            onLeaderProjectProgressUpdate={handleLeaderProjectProgressUpdate}
          />
        )}
        {userRole === 'member' && memberData && (
          <MemberDashboard 
            stats={memberData.stats} 
            todayActivities={memberData.todayActivities}
            upcomingActivities={memberData.upcomingActivities}
            weeklyHoursByProject={memberData.weeklyHoursByProject}
            confirmedHoursByCategory={memberData.confirmedHoursByCategory}
            productivityTrend={memberData.productivityTrend}
            monthlyHoursTrend={memberData.monthlyHoursTrend}
            weeklyCalendar={memberWeeklyCalendar?.calendar}
            weekOffset={memberWeekOffset}
            onWeekChange={setMemberWeekOffset}
            weekDateRange={memberWeeklyCalendar?.dateRange}
            leaderProjects={memberData.leaderProjects}
            userName={userName}
            onLeaderProjectProgressUpdate={handleLeaderProjectProgressUpdate}
          />
        )}
      </div>
    </AppLayout>
  );
};

export default Dashboard;
