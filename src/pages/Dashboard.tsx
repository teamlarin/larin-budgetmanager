import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { calculateSafeHours } from '@/lib/timeUtils';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, format, eachDayOfInterval, isWeekend, isSameMonth } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { AdminOperationsDashboard } from '@/components/dashboards/AdminOperationsDashboard';
import { AdminFinanceDashboard } from '@/components/dashboards/AdminFinanceDashboard';
import { AccountBudgetQuoteDashboard } from '@/components/dashboards/AccountBudgetQuoteDashboard';
import { FinanceDashboard } from '@/components/dashboards/FinanceDashboard';
import { TeamLeaderDashboard, TeamLeaderTeamSection, TeamLeaderProjectsSection } from '@/components/dashboards/TeamLeaderDashboard';
import { MemberDashboard } from '@/components/dashboards/MemberDashboard';
import { TabbedDashboard } from '@/components/dashboards/TabbedDashboard';
import { UserHoursSummary } from '@/components/dashboards/UserHoursSummary';
import { WorkloadSummaryWidget } from '@/components/dashboards/WorkloadSummaryWidget';
import { AppLayout } from '@/components/AppLayout';
import { AiInsightsPanel } from '@/components/AiInsightsPanel';
import { DashboardDateFilter, DateRange } from '@/components/DashboardDateFilter';
import { useRoleSimulation } from '@/contexts/RoleSimulationContext';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Eye } from 'lucide-react';

type UserRole = 'admin' | 'account' | 'finance' | 'team_leader' | 'coordinator' | 'member' | 'external';

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  account: 'Account',
  finance: 'Finance',
  team_leader: 'Team Leader',
  coordinator: 'Coordinator',
  member: 'Member',
  external: 'External',
};

const Dashboard = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
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
  // teamLeaderWeekOffset removed - calendar moved to "Il mio Recap"

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
        
        // Redirect external users to calendar
        if (role === 'external') {
          navigate('/calendar', { replace: true });
          return;
        }
        
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
        // Projects data from projects table (only approved ones that are actual projects) - ALL projects, not filtered by date
        supabase.from('projects').select('id, name, project_status, billing_type, start_date, end_date, created_at, progress, clients(name)').eq('status', 'approvato'),
        // Quotes
        supabase.from('quotes').select('*', { count: 'exact', head: true }).gte('created_at', fromDate).lte('created_at', toDate),
        supabase.from('quotes').select('*', { count: 'exact', head: true }).in('status', ['draft', 'sent']).gte('created_at', fromDate).lte('created_at', toDate),
        // Users
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('approved', true)
      ]);

      const totalBudgets = results[0].count || 0;
      const pendingBudgets = results[1].count || 0;
      const approvedBudgets = results[2].data || [];
      const allProjects = results[3].data || [];
      const totalQuotes = results[4].count || 0;
      const pendingQuotes = results[5].count || 0;
      const totalUsers = results[6].count || 0;

      // Active projects (open or starting)
      const activeProjects = allProjects.filter(p => p.project_status === 'aperto' || p.project_status === 'in_partenza');
      const activeProjectsCount = activeProjects.length;
      // Open projects only (no "in partenza")
      const openProjects = allProjects.filter(p => p.project_status === 'aperto');
      const openProjectsCount = openProjects.length;
      // Starting projects only
      const startingProjects = allProjects.filter(p => p.project_status === 'in_partenza');
      const startingProjectsCount = startingProjects.length;
      // Recurring projects (among open projects)
      const recurringProjects = openProjects.filter(p => p.billing_type === 'recurring');
      const recurringProjectsCount = recurringProjects.length;
      // Pack projects (among open projects)
      const packProjects = openProjects.filter(p => p.billing_type === 'pack');
      const packProjectsCount = packProjects.length;
      const totalBudgetValue = approvedBudgets.reduce((sum, b) => sum + (b.total_budget || 0), 0);
      
      const now = new Date();
      
      // Projects expiring this month (among open projects only)
      const expiringThisMonthList = openProjects.filter(p => {
        if (!p.end_date) return false;
        const endDate = new Date(p.end_date);
        return isSameMonth(endDate, now);
      }).sort((a, b) => new Date(a.end_date!).getTime() - new Date(b.end_date!).getTime());
      const projectsExpiringThisMonth = expiringThisMonthList.length;
      
      // Projects starting this month (among "in partenza" projects)
      const startingThisMonthList = startingProjects.filter(p => {
        if (!p.start_date) return false;
        const startDate = new Date(p.start_date);
        return isSameMonth(startDate, now);
      }).sort((a, b) => new Date(a.start_date!).getTime() - new Date(b.start_date!).getTime());
      const projectsStartingThisMonth = startingThisMonthList.length;
      
      // Projects near deadline (next 7 days)
      const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const projectsNearDeadline = allProjects?.filter(p => {
        if (!p.end_date) return false;
        const endDate = new Date(p.end_date);
        return endDate >= now && endDate <= weekFromNow;
      }).length || 0;

      // Critical projects: open, end_date within 7 days, progress < 80%, not interno/consumptive
      const weekFromNowDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const criticalProjects = openProjects.filter(p => {
        if (!p.end_date) return false;
        if (p.billing_type === 'interno' || p.billing_type === 'consumptive') return false;
        const endDate = new Date(p.end_date);
        if (endDate < now || endDate > weekFromNowDate) return false;
        const progress = p.progress ?? 0;
        return progress < 80;
      }).sort((a, b) => new Date(a.end_date!).getTime() - new Date(b.end_date!).getTime());

      // Fetch ALL budgets with detail for Finance tab
      const { data: allBudgets } = await supabase
        .from('budgets')
        .select('id, name, status, total_budget, created_at, client_id, clients(name)')
        .gte('created_at', fromDate)
        .lte('created_at', toDate);

      const budgetsList = allBudgets || [];

      // Status breakdown
      const budgetStatusBreakdown = {
        bozza: budgetsList.filter(b => b.status === 'bozza').length,
        in_revisione: budgetsList.filter(b => b.status === 'in_revisione').length,
        in_attesa: budgetsList.filter(b => b.status === 'in_attesa').length,
        approvato: budgetsList.filter(b => b.status === 'approvato').length,
        rifiutato: budgetsList.filter(b => b.status === 'rifiutato').length,
      };

      // Actionable budgets for Admin: in_attesa + in_revisione
      const adminActionableBudgets = budgetsList
        .filter(b => b.status === 'in_attesa' || b.status === 'in_revisione')
        .slice(0, 10)
        .map(b => ({
          id: b.id,
          name: b.name,
          client_name: (b.clients as any)?.name || undefined,
          status: b.status as 'bozza' | 'in_attesa' | 'in_revisione' | 'approvato' | 'rifiutato',
          created_at: b.created_at,
        }));

      // KPIs
      const totalBudgetsCount = budgetsList.length;
      const approvedCount = budgetStatusBreakdown.approvato;
      const approvedValue = budgetsList.filter(b => b.status === 'approvato').reduce((sum, b) => sum + (b.total_budget || 0), 0);
      const allBudgetsValue = budgetsList.reduce((sum, b) => sum + (b.total_budget || 0), 0);
      const conversionRate = totalBudgetsCount > 0 ? Math.round((approvedCount / totalBudgetsCount) * 100) : 0;
      const avgApprovedValue = approvedCount > 0 ? approvedValue / approvedCount : 0;

      return {
        totalBudgets: totalBudgets,
        pendingBudgets: pendingBudgets,
        totalProjects: allProjects.length,
        activeProjects: activeProjectsCount,
        openProjects: openProjectsCount,
        startingProjects: startingProjectsCount,
        recurringProjects: recurringProjectsCount,
        packProjects: packProjectsCount,
        projectsExpiringThisMonth,
        projectsStartingThisMonth,
        totalQuotes: totalQuotes,
        pendingQuotes: pendingQuotes,
        totalUsers: totalUsers,
        totalBudgetValue,
        projectsNearDeadline,
        // Project lists for drill-down
        expiringThisMonthList,
        startingThisMonthList,
        recurringProjectsList: recurringProjects,
        packProjectsList: packProjects,
        // Critical projects for Operations
        criticalProjects,
        // Finance data
        budgetStatusBreakdown,
        adminActionableBudgets,
        approvedValue,
        allBudgetsValue,
        conversionRate,
        avgApprovedValue,
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
      // Always use current week for personal area (week starts on Monday)
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
            return sum + calculateSafeHours(e.scheduled_start_time, e.scheduled_end_time, true);
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
          projectHoursMap[projectName].plannedHours += calculateSafeHours(e.scheduled_start_time, e.scheduled_end_time, true);
        }
        // Use scheduled duration for confirmed hours (consistent with Calendar)
        if (e.actual_start_time && e.actual_end_time && e.scheduled_start_time && e.scheduled_end_time) {
          projectHoursMap[projectName].confirmedHours += calculateSafeHours(e.scheduled_start_time, e.scheduled_end_time, true);
        }
      });

      const weeklyHoursByProject = Object.values(projectHoursMap)
        .sort((a, b) => b.plannedHours - a.plannedHours)
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
          categoryHoursMap[category] += calculateSafeHours(e.scheduled_start_time, e.scheduled_end_time, true);
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
          const hours = calculateSafeHours(e.scheduled_start_time, e.scheduled_end_time, true);
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

      // Calculate monthly stats for admin personal data
      const adminMonthStart = startOfMonth(now);
      const adminMonthEnd = endOfMonth(now);
      const adminMonthFromStr = format(adminMonthStart, 'yyyy-MM-dd');
      const adminMonthToStr = format(adminMonthEnd, 'yyyy-MM-dd');

      const { data: adminMonthEntries } = await supabase
        .from('activity_time_tracking')
        .select('scheduled_start_time, scheduled_end_time, actual_start_time, actual_end_time, budget_items(projects:project_id(is_billable))')
        .eq('user_id', userId)
        .gte('scheduled_date', adminMonthFromStr)
        .lte('scheduled_date', adminMonthToStr);

      let adminMonthPlanned = 0, adminMonthConfirmed = 0, adminMonthBillable = 0, adminMonthTotal = 0;
      adminMonthEntries?.forEach(e => {
        if (e.scheduled_start_time && e.scheduled_end_time) {
          adminMonthPlanned += calculateSafeHours(e.scheduled_start_time, e.scheduled_end_time, true);
        }
        if (e.actual_start_time && e.actual_end_time && e.scheduled_start_time && e.scheduled_end_time) {
          const hours = calculateSafeHours(e.scheduled_start_time, e.scheduled_end_time, true);
          adminMonthTotal += hours;
          adminMonthConfirmed += hours;
          if ((e.budget_items as any)?.projects?.is_billable) {
            adminMonthBillable += hours;
          }
        }
      });

      let adminMonthlyContractHours = 0;
      if (userProfile?.contract_hours) {
        switch (userProfile.contract_hours_period) {
          case 'daily': {
            const daysInMonth = eachDayOfInterval({ start: adminMonthStart, end: adminMonthEnd });
            adminMonthlyContractHours = userProfile.contract_hours * daysInMonth.filter(d => !isWeekend(d)).length;
            break;
          }
          case 'weekly':
            adminMonthlyContractHours = userProfile.contract_hours * 4.33;
            break;
          case 'monthly':
            adminMonthlyContractHours = userProfile.contract_hours;
            break;
          default:
            adminMonthlyContractHours = userProfile.contract_hours;
        }
      }

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
          targetProductivity,
          monthPlannedHours: Math.round(adminMonthPlanned * 10) / 10,
          monthConfirmedHours: Math.round(adminMonthConfirmed * 10) / 10,
          monthlyContractHours: Math.round(adminMonthlyContractHours * 10) / 10,
          monthlyBillableProductivity: adminMonthTotal > 0 ? Math.round((adminMonthBillable / adminMonthTotal) * 100) : 0,
          monthlyBillableHours: Math.round(adminMonthBillable * 10) / 10,
          monthlyTotalHours: Math.round(adminMonthTotal * 10) / 10,
        },
        weeklyHoursByProject,
        confirmedHoursByCategory
      };
    },
    enabled: userRole === 'admin' && !!userId
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

      // Status breakdown for pipeline
      const statusBreakdown = {
        bozza: budgets.filter(b => b.status === 'bozza').length,
        in_revisione: budgets.filter(b => b.status === 'in_revisione').length,
        in_attesa: budgets.filter(b => b.status === 'in_attesa').length,
        approvato: budgets.filter(b => b.status === 'approvato').length,
        rifiutato: budgets.filter(b => b.status === 'rifiutato').length,
      };

      // Actionable budgets: rejected or in_revisione assigned to this user
      const actionableBudgets = budgets
        .filter(b => b.status === 'rifiutato' || (b.status === 'in_revisione' && (b.assigned_user_id === userId || b.user_id === userId)))
        .slice(0, 10)
        .map(b => ({
          id: b.id,
          name: b.name,
          client_name: (b.clients as any)?.name || undefined,
          status: b.status as 'bozza' | 'in_attesa' | 'in_revisione' | 'approvato' | 'rifiutato',
          created_at: b.created_at,
        }));

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
        client_name: (b.clients as any)?.name,
        status: b.status,
        project_status: (b.projects as any)?.project_status,
        total_budget: b.total_budget || 0,
        end_date: (b.projects as any)?.end_date
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
        statusBreakdown,
        actionableBudgets,
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


  // Team Leader stats query
  const { data: teamLeaderData } = useQuery({
    queryKey: ['team-leader-dashboard-stats', userId, dateRange.from.toISOString(), dateRange.to.toISOString(), isSimulating],
    queryFn: async () => {
      const fromDateStr = format(dateRange.from, 'yyyy-MM-dd');
      const toDateStr = format(dateRange.to, 'yyyy-MM-dd');

      let assignedAreas: string[] = [];

      if (isSimulating) {
        // When simulating TL, fetch all distinct areas from profiles
        const { data: allAreas } = await supabase
          .from('profiles')
          .select('area')
          .eq('approved', true)
          .is('deleted_at', null)
          .not('area', 'is', null);
        assignedAreas = [...new Set((allAreas || []).map(a => a.area).filter(Boolean))] as string[];
      } else {
        // Get team leader's assigned areas
        const { data: leaderAreas } = await supabase
          .from('team_leader_areas')
          .select('area')
          .eq('user_id', userId);
        assignedAreas = leaderAreas?.map(a => a.area) || [];
      }

      // If no areas assigned, return empty data (team leader should only see their assigned areas)
      if (assignedAreas.length === 0) {
        return {
          stats: {
            teamMembers: 0,
            activeProjects: 0,
            totalPlannedHours: 0,
            totalConfirmedHours: 0,
            projectsInProgress: 0,
            startingProjects: 0,
            projectsToInvoice: 0,
            totalBudgetValue: 0
          },
          teamWorkload: [],
          recentProjects: [],
          projectsNearDeadline: []
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

      // Get active projects filtered by areas (include da_fatturare for economic section)
      const { data: projects } = await supabase
        .from('projects')
        .select('*, clients(name)')
        .eq('status', 'approvato')
        .in('project_status', ['aperto', 'in_partenza', 'da_fatturare'])
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
        .gte('end_date', format(currentDate, 'yyyy-MM-dd'))
        .lte('end_date', format(twoWeeksFromNow, 'yyyy-MM-dd'))
        .order('end_date', { ascending: true });

      // Get time tracking for date range, filtered by team members
      let timeEntries: any[] = [];
      if (teamMemberIds.length > 0) {
        const pageSize = 1000;
        let offset = 0;
        let hasMore = true;
        while (hasMore) {
          const { data, error } = await supabase
            .from('activity_time_tracking')
            .select('user_id, scheduled_start_time, scheduled_end_time, actual_start_time, actual_end_time, scheduled_date')
            .gte('scheduled_date', fromDateStr)
            .lte('scheduled_date', toDateStr)
            .in('user_id', teamMemberIds)
            .order('id')
            .range(offset, offset + pageSize - 1);
          if (error) {
            console.error('Error fetching team leader time entries:', error);
            hasMore = false;
          } else if (data && data.length > 0) {
            timeEntries = timeEntries.concat(data);
            offset += pageSize;
            hasMore = data.length === pageSize;
          } else {
            hasMore = false;
          }
        }
      }

      const totalPlannedHours = timeEntries?.reduce((sum, e) => {
        if (e.scheduled_start_time && e.scheduled_end_time) {
          return sum + calculateSafeHours(e.scheduled_start_time, e.scheduled_end_time, true);
        }
        return sum;
      }, 0) || 0;

      // Use scheduled duration for confirmed hours (consistent with Calendar)
      const totalConfirmedHours = timeEntries?.filter(e => e.actual_start_time && e.actual_end_time)
        .reduce((sum, e) => {
          if (e.scheduled_start_time && e.scheduled_end_time) {
            return sum + calculateSafeHours(e.scheduled_start_time, e.scheduled_end_time, true);
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
          userHours[uid].planned += calculateSafeHours(e.scheduled_start_time, e.scheduled_end_time, true);
        }
        // Use scheduled duration for confirmed hours (consistent with Calendar)
        if (e.actual_start_time && e.actual_end_time && e.scheduled_start_time && e.scheduled_end_time) {
          userHours[uid].confirmed += calculateSafeHours(e.scheduled_start_time, e.scheduled_end_time, true);
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

      // Calculate economic stats
      const openProjects = projects?.filter(p => p.project_status === 'aperto') || [];
      const startingProjects = projects?.filter(p => p.project_status === 'in_partenza') || [];
      const daFatturareProjects = projects?.filter(p => p.project_status === 'da_fatturare') || [];
      const activeProjects = [...openProjects, ...startingProjects];
      const totalBudgetValue = activeProjects.reduce((sum, p) => sum + (p.total_budget || 0), 0);

      return {
        stats: {
          teamMembers: teamMemberProfiles?.length || 0,
          activeProjects: activeProjects.length,
          totalPlannedHours,
          totalConfirmedHours,
          projectsInProgress: openProjects.length,
          startingProjects: startingProjects.length,
          projectsToInvoice: daFatturareProjects.length,
          totalBudgetValue
        },
        teamWorkload: Object.entries(userHours).map(([id, data]) => ({
          id,
          name: data.name,
          planned_hours: data.planned,
          confirmed_hours: data.confirmed,
          capacity_hours: data.capacity
        })),
        teamMemberProfiles: (teamMemberProfiles || []).map(p => ({
          id: p.id,
          first_name: p.first_name,
          last_name: p.last_name,
          area: p.area,
          contract_hours: p.contract_hours,
          contract_hours_period: p.contract_hours_period
        })),
        recentProjects: [...openProjects, ...startingProjects].map(p => ({
          id: p.id,
          name: p.name,
          client_name: p.clients?.name,
          progress: p.progress,
          project_status: p.project_status,
          total_budget: p.total_budget,
          end_date: p.end_date
        })) || [],
        projectsNearDeadline: projectsNearDeadline?.map(p => ({
          id: p.id,
          name: p.name,
          client_name: p.clients?.name,
          end_date: p.end_date,
          progress: p.progress,
          project_status: p.project_status
        })) || []
      };
    },
    enabled: userRole === 'team_leader'
  });

  // Team Leader weekly calendar query removed - calendar is in "Il mio Recap" tab

  // Member stats query
  // Member stats query - ALWAYS uses current week for personal area (independent of global filter)
  const { data: memberData } = useQuery({
    queryKey: ['member-dashboard-stats', userId],
    queryFn: async () => {
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      // Always use current week for personal stats (week starts on Monday)
      const weekStart = startOfWeek(now, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
      const fromDateStr = format(weekStart, 'yyyy-MM-dd');
      const toDateStr = format(weekEnd, 'yyyy-MM-dd');

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
        // Project memberships with project details
        supabase
          .from('project_members')
          .select('project_id, projects:project_id(id, name, progress, project_status, end_date, project_leader_id, clients(name))')
          .eq('user_id', userId),
        // Projects as leader (where user is project_leader_id)
        supabase
          .from('projects')
          .select('id, name, progress, project_status, end_date, margin_percentage, project_type, billing_type, clients(name)')
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
            return sum + calculateSafeHours(e.scheduled_start_time, e.scheduled_end_time, true);
          }
          return sum;
        }, 0) || 0;
      };

      // Combine and deduplicate project IDs for the count
      const memberProjectIds = new Set(projectMembers?.map(pm => pm.project_id) || []);
      const leaderProjectIds = projectsAsLeader?.map(p => p.id) || [];
      leaderProjectIds.forEach(id => memberProjectIds.add(id));
      const totalAssignedProjects = memberProjectIds.size;

      // Filter member projects (where user is member but NOT leader) with active status
      const memberOnlyProjects = projectMembers
        ?.filter(pm => {
          const project = pm.projects as any;
          return project && 
                 project.project_leader_id !== userId && 
                 ['aperto', 'in_partenza'].includes(project.project_status);
        })
        .map(pm => {
          const project = pm.projects as any;
          return {
            id: project.id,
            name: project.name,
            client_name: project.clients?.name,
            progress: project.progress,
            project_status: project.project_status,
            end_date: project.end_date
          };
        }) || [];

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

      // Track current month stats for the "Ore Mese" card
      let currentMonthPlanned = 0;
      let currentMonthConfirmed = 0;
      let currentMonthBillable = 0;
      let currentMonthTotal = 0;

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

        // Capture current month stats
        if (i === 0) {
          currentMonthPlanned = monthPlanned;
          currentMonthConfirmed = monthConfirmed;
          currentMonthBillable = monthBillable;
          currentMonthTotal = monthTotal;
        }
      }

      // Calculate monthly contract hours
      let monthlyContractHours = 0;
      if (userProfile?.contract_hours) {
        switch (userProfile.contract_hours_period) {
          case 'daily':
            // Count working days in current month
            const monthStartDate = new Date(now.getFullYear(), now.getMonth(), 1);
            const monthEndDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            const daysInMonth = eachDayOfInterval({ start: monthStartDate, end: monthEndDate });
            const workingDaysInMonth = daysInMonth.filter(d => !isWeekend(d)).length;
            monthlyContractHours = userProfile.contract_hours * workingDaysInMonth;
            break;
          case 'weekly':
            monthlyContractHours = userProfile.contract_hours * 4.33;
            break;
          case 'monthly':
            monthlyContractHours = userProfile.contract_hours;
            break;
          default:
            monthlyContractHours = userProfile.contract_hours;
        }
      }

      const monthlyBillableProductivity = currentMonthTotal > 0
        ? Math.round((currentMonthBillable / currentMonthTotal) * 100)
        : 0;

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
          targetProductivity,
          monthPlannedHours: Math.round(currentMonthPlanned * 10) / 10,
          monthConfirmedHours: Math.round(currentMonthConfirmed * 10) / 10,
          monthlyContractHours: Math.round(monthlyContractHours * 10) / 10,
          monthlyBillableProductivity,
          monthlyBillableHours: Math.round(currentMonthBillable * 10) / 10,
          monthlyTotalHours: Math.round(currentMonthTotal * 10) / 10,
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
          end_date: p.end_date,
          margin_percentage: p.margin_percentage,
          project_type: p.project_type,
          billing_type: (p as any).billing_type
        })) || [],
        memberProjects: memberOnlyProjects
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
      
      // Fetch entries for this specific week with activity details
      const { data: weekEntries } = await supabase
        .from('activity_time_tracking')
        .select(`
          id,
          scheduled_date, 
          scheduled_start_time, 
          scheduled_end_time, 
          actual_start_time, 
          actual_end_time,
          budget_items:budget_item_id (
            activity_name,
            projects:project_id (
              name
            )
          )
        `)
        .eq('user_id', userId)
        .gte('scheduled_date', weekStartStr)
        .lte('scheduled_date', weekEndStr);
      
      const dayNames = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
      const weeklyCalendar: { 
        day: string; 
        date: string; 
        fullDate: string;
        planned: number; 
        confirmed: number; 
        activities: number; 
        isToday: boolean;
        dayActivities: Array<{
          id: string;
          activity_name: string;
          project_name: string;
          scheduled_start_time: string | null;
          scheduled_end_time: string | null;
          is_confirmed: boolean;
        }>;
      }[] = [];
      
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
        
        // Map day activities with details
        const dayActivities = dayEntries.map(e => ({
          id: e.id,
          activity_name: (e.budget_items as any)?.activity_name || 'Attività sconosciuta',
          project_name: (e.budget_items as any)?.projects?.name || 'Progetto sconosciuto',
          scheduled_start_time: e.scheduled_start_time,
          scheduled_end_time: e.scheduled_end_time,
          is_confirmed: !!(e.actual_start_time && e.actual_end_time)
        })).sort((a, b) => {
          if (!a.scheduled_start_time) return 1;
          if (!b.scheduled_start_time) return -1;
          return a.scheduled_start_time.localeCompare(b.scheduled_start_time);
        });
        
        weeklyCalendar.push({
          day: dayNames[i],
          date: `${currentDay.getDate()}/${currentDay.getMonth() + 1}`,
          fullDate: currentDay.toLocaleDateString('it-IT', { day: 'numeric', month: 'long' }),
          planned: Math.round(dayPlanned * 10) / 10,
          confirmed: Math.round(dayConfirmed * 10) / 10,
          activities: dayEntries.length,
          isToday: dateStr === todayStr,
          dayActivities
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
      memberProjects: memberData.memberProjects,
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
        
        {userRole !== 'external' && <AiInsightsPanel userRole={userRole || undefined} />}
        
        {userRole === 'admin' && adminStats && getMemberDataProps() && (
          <TabbedDashboard
            memberData={getMemberDataProps()!}
            roleTabs={[
              {
                label: 'Progetti',
                value: 'progetti',
                content: (
                  <AdminOperationsDashboard 
                    stats={{
                      projectsExpiringThisMonth: adminStats.projectsExpiringThisMonth,
                      projectsStartingThisMonth: adminStats.projectsStartingThisMonth,
                      openProjects: adminStats.openProjects,
                      startingProjects: adminStats.startingProjects,
                      recurringProjects: adminStats.recurringProjects,
                      packProjects: adminStats.packProjects,
                      activeProjects: adminStats.activeProjects,
                      totalUsers: adminStats.totalUsers
                    }}
                    projectLists={{
                      expiringThisMonth: adminStats.expiringThisMonthList || [],
                      startingThisMonth: adminStats.startingThisMonthList || [],
                      recurring: adminStats.recurringProjectsList || [],
                      pack: adminStats.packProjectsList || [],
                    }}
                    criticalProjects={adminStats.criticalProjects || []}
                  />
                )
              },
              {
                label: 'Team',
                value: 'team',
                content: (
                  <>
                    <WorkloadSummaryWidget />
                    <UserHoursSummary />
                  </>
                )
              },
              {
                label: 'Finance',
                value: 'finance',
                content: (
                  <AdminFinanceDashboard 
                    stats={{
                      totalBudgets: adminStats.totalBudgets,
                      pendingBudgets: adminStats.pendingBudgets,
                      totalQuotes: adminStats.totalQuotes,
                      pendingQuotes: adminStats.pendingQuotes,
                      totalBudgetValue: adminStats.totalBudgetValue,
                      approvedValue: adminStats.approvedValue,
                      allBudgetsValue: adminStats.allBudgetsValue,
                      conversionRate: adminStats.conversionRate,
                      avgApprovedValue: adminStats.avgApprovedValue,
                    }}
                    statusBreakdown={adminStats.budgetStatusBreakdown}
                    actionableBudgets={adminStats.adminActionableBudgets}
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
                    statusBreakdown={accountData.statusBreakdown}
                    actionableBudgets={accountData.actionableBudgets}
                    recentProjects={accountData.recentProjects}
                    dateRange={dateRange}
                    onDateRangeChange={setDateRange}
                  />
                )
              }
            ]}
          />
        )}
        {userRole === 'finance' && financeData && getMemberDataProps() && (
          <TabbedDashboard
            memberData={getMemberDataProps()!}
            roleTabs={[
              {
                label: 'Finance',
                value: 'finance',
                content: (
                  <>
                    <FinanceDashboard 
                      stats={financeData.stats} 
                      projectsToInvoice={financeData.projectsToInvoice}
                      monthlyRevenue={financeData.monthlyRevenue}
                    />
                    <UserHoursSummary />
                  </>
                )
              }
            ]}
          />
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
                teamMemberProfiles={teamLeaderData.teamMemberProfiles}
                userName={userName}
                hideHeader
                dateFrom={dateRange.from}
                dateTo={dateRange.to}
              />
            }
          />
        )}
        {userRole === 'coordinator' && memberData && getMemberDataProps() && (
          <TabbedDashboard
            memberData={getMemberDataProps()!}
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
            memberProjects={memberData.memberProjects}
            userName={userName}
            onLeaderProjectProgressUpdate={handleLeaderProjectProgressUpdate}
          />
        )}
      </div>
    </AppLayout>
  );
};

export default Dashboard;
