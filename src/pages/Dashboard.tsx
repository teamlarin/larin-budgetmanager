import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, format, eachDayOfInterval, isWeekend } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { AdminDashboard } from '@/components/dashboards/AdminDashboard';
import { AccountDashboard } from '@/components/dashboards/AccountDashboard';
import { FinanceDashboard } from '@/components/dashboards/FinanceDashboard';
import { TeamLeaderDashboard } from '@/components/dashboards/TeamLeaderDashboard';
import { CoordinatorDashboard } from '@/components/dashboards/CoordinatorDashboard';
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
        if (e.actual_start_time && e.actual_end_time) {
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

      // Calculate billable vs total hours for productivity
      let totalConfirmedHours = 0;
      let billableConfirmedHours = 0;
      periodEntries?.forEach(e => {
        if (e.actual_start_time && e.actual_end_time) {
          const start = new Date(e.actual_start_time);
          const end = new Date(e.actual_end_time);
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

      // Get budgets from budgets table
      const { data: budgets } = await supabase
        .from('budgets')
        .select('*, clients(name), projects(id, project_status, end_date)')
        .or(`user_id.eq.${userId},account_user_id.eq.${userId}`)
        .gte('created_at', fromDate)
        .lte('created_at', toDate)
        .order('created_at', { ascending: false });

      // Get active projects from projects table
      const { data: projects } = await supabase
        .from('projects')
        .select('id, name, project_status, end_date, clients(name)')
        .or(`user_id.eq.${userId},account_user_id.eq.${userId}`)
        .eq('status', 'approvato')
        .gte('created_at', fromDate)
        .lte('created_at', toDate);

      const myBudgets = budgets?.length || 0;
      const pendingBudgets = budgets?.filter(b => b.status === 'in_attesa').length || 0;
      const activeProjects = projects?.filter(p => p.project_status === 'aperto' || p.project_status === 'in_partenza').length || 0;

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

      const totalBudgetValue = budgets?.filter(b => b.status === 'approvato').reduce((sum, b) => sum + (b.total_budget || 0), 0) || 0;

      // Projects near deadline
      const now = new Date();
      const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const projectsNearDeadline = projects?.filter(p => {
        if (!p.end_date) return false;
        const endDate = new Date(p.end_date);
        return endDate >= now && endDate <= weekFromNow;
      }).length || 0;

      // Combine budgets and projects for display (showing budgets with linked project status)
      const recentBudgets = budgets?.slice(0, 5).map(b => ({
        id: b.id,
        name: b.name,
        client_name: b.clients?.name,
        status: b.status,
        project_status: b.projects?.project_status,
        total_budget: b.total_budget || 0,
        end_date: b.projects?.end_date
      })) || [];

      return {
        stats: {
          myBudgets,
          pendingBudgets,
          myProjects: projects?.length || 0,
          activeProjects,
          myQuotes: myQuotes || 0,
          pendingQuotes: pendingQuotes || 0,
          totalBudgetValue,
          projectsNearDeadline
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
        .select('user_id, actual_start_time, actual_end_time, budget_items(project_id, projects:project_id(is_billable))')
        .gte('scheduled_date', fromDateStr)
        .lte('scheduled_date', toDateStr)
        .not('actual_start_time', 'is', null)
        .not('actual_end_time', 'is', null);

      // Calculate confirmed hours and billable hours per user
      const userHoursMap: Record<string, { total: number; billable: number }> = {};
      timeEntries?.forEach(e => {
        if (e.actual_start_time && e.actual_end_time) {
          const start = new Date(e.actual_start_time);
          const end = new Date(e.actual_end_time);
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
    enabled: userRole === 'team_leader'
  });

  // Coordinator stats query
  const { data: coordinatorData } = useQuery({
    queryKey: ['coordinator-dashboard-stats', userId, dateRange.from.toISOString(), dateRange.to.toISOString()],
    queryFn: async () => {
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      const weekFromNow = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

      // Get all today's activities
      const { data: todayActivities } = await supabase
        .from('activity_time_tracking')
        .select('*, budget_items(activity_name, project_id, projects:project_id(name)), profiles:user_id(first_name, last_name)')
        .eq('scheduled_date', today)
        .order('scheduled_start_time', { ascending: true });

      // Get pending activities (not scheduled)
      const { data: pendingActivities } = await supabase
        .from('budget_items')
        .select('id, activity_name, project_id')
        .is('start_day_offset', null);

      // Get unscheduled time tracking entries
      const { count: unscheduledCount } = await supabase
        .from('activity_time_tracking')
        .select('*', { count: 'exact', head: true })
        .is('scheduled_date', null);

      // Get projects with upcoming deadlines
      const { data: upcomingProjects } = await supabase
        .from('projects')
        .select('id, name, end_date, progress, client_id, clients(name)')
        .eq('status', 'approvato')
        .in('project_status', ['aperto', 'in_partenza'])
        .not('end_date', 'is', null)
        .gte('end_date', today)
        .lte('end_date', weekFromNow.toISOString().split('T')[0])
        .order('end_date', { ascending: true });

      // Get team members
      const { count: teamMembers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('approved', true);

      // Get active projects
      const { count: activeProjects } = await supabase
        .from('projects')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'approvato')
        .in('project_status', ['aperto', 'in_partenza']);

      // Get team workload for date range
      const fromDateStr = dateRange.from.toISOString().split('T')[0];
      const toDateStr = dateRange.to.toISOString().split('T')[0];

      const { data: timeEntries } = await supabase
        .from('activity_time_tracking')
        .select('*, profiles:user_id(first_name, last_name)')
        .gte('scheduled_date', fromDateStr)
        .lte('scheduled_date', toDateStr);

      // Build user hours map
      const userHours: Record<string, { planned: number; confirmed: number; name: string }> = {};
      timeEntries?.forEach(e => {
        const uid = e.user_id;
        if (!userHours[uid]) {
          const profile = e.profiles as any;
          userHours[uid] = { 
            planned: 0, 
            confirmed: 0, 
            name: `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || 'Utente'
          };
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

      // Build weekly calendar
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

      const totalActivitiesToday = todayActivities?.length || 0;
      const confirmedActivitiesToday = todayActivities?.filter(a => a.actual_start_time && a.actual_end_time).length || 0;

      return {
        stats: {
          totalActivitiesToday,
          confirmedActivitiesToday,
          pendingActivities: unscheduledCount || 0,
          upcomingDeadlines: upcomingProjects?.length || 0,
          teamMembers: teamMembers || 0,
          activeProjects: activeProjects || 0
        },
        teamWorkload: Object.entries(userHours).map(([id, data]) => ({
          id,
          name: data.name,
          planned_hours: Math.round(data.planned * 10) / 10,
          confirmed_hours: Math.round(data.confirmed * 10) / 10
        })),
        todayActivities: todayActivities?.map(a => {
          const profile = a.profiles as any;
          return {
            id: a.id,
            activity_name: a.budget_items?.activity_name || 'Attività',
            project_name: a.budget_items?.projects?.name || 'Progetto',
            assignee_name: `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || undefined,
            scheduled_date: a.scheduled_date,
            scheduled_start_time: a.scheduled_start_time,
            scheduled_end_time: a.scheduled_end_time,
            is_confirmed: !!a.actual_start_time && !!a.actual_end_time
          };
        }) || [],
        upcomingDeadlines: upcomingProjects?.map(p => ({
          id: p.id,
          name: p.name,
          client_name: p.clients?.name,
          end_date: p.end_date!,
          days_remaining: Math.ceil((new Date(p.end_date!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
          progress: p.progress
        })) || [],
        weeklyCalendar
      };
    },
    enabled: userRole === 'coordinator'
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

      // Get time entries for date range with category info and billable status
      const { data: periodEntries } = await supabase
        .from('activity_time_tracking')
        .select('*, budget_items(activity_name, category, project_id, projects:project_id(name, is_billable))')
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

      // Get assigned projects count (as team member)
      const { data: projectMembers } = await supabase
        .from('project_members')
        .select('project_id')
        .eq('user_id', userId);

      // Get projects where user is project leader (with details for display)
      const { data: projectsAsLeader } = await supabase
        .from('projects')
        .select('id, name, progress, project_status, end_date, clients(name)')
        .eq('user_id', userId)
        .eq('status', 'approvato')
        .in('project_status', ['aperto', 'in_partenza'])
        .order('end_date', { ascending: true });

      // Combine and deduplicate project IDs for the count
      const memberProjectIds = new Set(projectMembers?.map(pm => pm.project_id) || []);
      const leaderProjectIds = projectsAsLeader?.map(p => p.id) || [];
      leaderProjectIds.forEach(id => memberProjectIds.add(id));
      const totalAssignedProjects = memberProjectIds.size;

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

      // Calculate billable vs total hours for productivity
      let totalConfirmedHours = 0;
      let billableConfirmedHours = 0;
      periodEntries?.forEach(e => {
        if (e.actual_start_time && e.actual_end_time) {
          const start = new Date(e.actual_start_time);
          const end = new Date(e.actual_end_time);
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

      // Calculate productivity trend and monthly hours for last 6 months
      const currentDate = new Date();
      const productivityTrend: { month: string; productivity: number; target: number }[] = [];
      const monthlyHoursTrend: { month: string; plannedHours: number; confirmedHours: number }[] = [];
      
      for (let i = 5; i >= 0; i--) {
        const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
        const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() - i + 1, 0);
        const monthFromStr = monthStart.toISOString().split('T')[0];
        const monthToStr = monthEnd.toISOString().split('T')[0];
        
        const { data: monthEntries } = await supabase
          .from('activity_time_tracking')
          .select('scheduled_start_time, scheduled_end_time, actual_start_time, actual_end_time, budget_items(projects:project_id(is_billable))')
          .eq('user_id', userId)
          .gte('scheduled_date', monthFromStr)
          .lte('scheduled_date', monthToStr);

        let monthTotal = 0;
        let monthBillable = 0;
        let monthPlanned = 0;
        let monthConfirmed = 0;
        
        monthEntries?.forEach(e => {
          // Calculate planned hours
          if (e.scheduled_start_time && e.scheduled_end_time) {
            const schedStart = new Date(`1970-01-01T${e.scheduled_start_time}`);
            const schedEnd = new Date(`1970-01-01T${e.scheduled_end_time}`);
            const plannedHours = (schedEnd.getTime() - schedStart.getTime()) / (1000 * 60 * 60);
            monthPlanned += plannedHours;
          }
          
          // Calculate confirmed hours
          if (e.actual_start_time && e.actual_end_time) {
            const start = new Date(e.actual_start_time);
            const end = new Date(e.actual_end_time);
            const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
            monthTotal += hours;
            monthConfirmed += hours;
            if (e.budget_items?.projects?.is_billable) {
              monthBillable += hours;
            }
          }
        });

        const monthProductivity = monthTotal > 0 ? Math.round((monthBillable / monthTotal) * 100) : 0;
        const monthNames = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
        
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

      // Build weekly calendar for member
      const currentNow = new Date();
      const startOfWeekDate = new Date(currentNow);
      startOfWeekDate.setDate(currentNow.getDate() - currentNow.getDay());
      startOfWeekDate.setHours(0, 0, 0, 0);

      const dayNames = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
      const weeklyCalendar: { day: string; date: string; planned: number; confirmed: number; activities: number }[] = [];
      
      for (let i = 0; i < 7; i++) {
        const currentDay = new Date(startOfWeekDate);
        currentDay.setDate(startOfWeekDate.getDate() + i);
        const dateStr = currentDay.toISOString().split('T')[0];
        
        const dayEntries = periodEntries?.filter(e => e.scheduled_date === dateStr) || [];
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
        weeklyCalendar,
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
        
        {/* Show date filter for non-admin roles only - admin has section-specific filters */}
        {userRole !== 'admin' && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h1 className="page-title">Dashboard</h1>
            <DashboardDateFilter 
              dateRange={dateRange} 
              onDateRangeChange={setDateRange} 
              defaultPreset={['member', 'team_leader', 'coordinator'].includes(userRole || '') ? 'thisWeek' : 'thisMonth'}
            />
          </div>
        )}
        
        {userRole === 'admin' && adminStats && (
          <>
            <AdminDashboard 
              stats={adminStats} 
              personalStats={adminPersonalData?.stats}
              weeklyHoursByProject={adminPersonalData?.weeklyHoursByProject}
              confirmedHoursByCategory={adminPersonalData?.confirmedHoursByCategory}
              teamWorkload={adminWorkloadData as any}
              workloadLoading={workloadLoading}
              userName={userName}
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
        {userRole === 'team_leader' && teamLeaderData && (
          <TeamLeaderDashboard 
            stats={teamLeaderData.stats} 
            teamWorkload={teamLeaderData.teamWorkload}
            recentProjects={teamLeaderData.recentProjects}
            weeklyCalendar={teamLeaderData.weeklyCalendar}
            userName={userName}
          />
        )}
        {userRole === 'coordinator' && coordinatorData && (
          <CoordinatorDashboard 
            stats={coordinatorData.stats} 
            teamWorkload={coordinatorData.teamWorkload}
            todayActivities={coordinatorData.todayActivities}
            upcomingDeadlines={coordinatorData.upcomingDeadlines}
            weeklyCalendar={coordinatorData.weeklyCalendar}
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
            productivityTrend={memberData.productivityTrend}
            monthlyHoursTrend={memberData.monthlyHoursTrend}
            weeklyCalendar={memberData.weeklyCalendar}
            leaderProjects={memberData.leaderProjects}
            userName={userName}
          />
        )}
      </div>
    </AppLayout>
  );
};

export default Dashboard;
