import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminDashboard } from '@/components/dashboards/AdminDashboard';
import { AccountDashboard } from '@/components/dashboards/AccountDashboard';
import { FinanceDashboard } from '@/components/dashboards/FinanceDashboard';
import { TeamLeaderDashboard } from '@/components/dashboards/TeamLeaderDashboard';
import { MemberDashboard } from '@/components/dashboards/MemberDashboard';
import { AppLayout } from '@/components/AppLayout';

type UserRole = 'admin' | 'account' | 'finance' | 'team_leader' | 'member';

const Dashboard = () => {
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkUserRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .maybeSingle();
        
        setUserRole(roleData?.role as UserRole || 'member');
      }
      setLoading(false);
    };

    checkUserRole();
  }, []);

  // Admin stats query
  const { data: adminStats } = useQuery({
    queryKey: ['admin-dashboard-stats'],
    queryFn: async () => {
      const results = await Promise.all([
        supabase.from('projects').select('*', { count: 'exact', head: true }),
        supabase.from('projects').select('*', { count: 'exact', head: true }).eq('status', 'in_attesa'),
        supabase.from('projects').select('*', { count: 'exact', head: true }).eq('status', 'approvato'),
        supabase.from('projects').select('id, project_status, total_budget, end_date').eq('status', 'approvato'),
        supabase.from('quotes').select('*', { count: 'exact', head: true }),
        supabase.from('quotes').select('*', { count: 'exact', head: true }).in('status', ['draft', 'sent']),
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
    queryKey: ['account-dashboard-stats', userId],
    queryFn: async () => {
      const { data: projects } = await supabase
        .from('projects')
        .select('*, clients(name)')
        .or(`user_id.eq.${userId},account_user_id.eq.${userId}`)
        .order('created_at', { ascending: false });

      const myBudgets = projects?.length || 0;
      const pendingBudgets = projects?.filter(p => p.status === 'in_attesa').length || 0;
      const activeProjects = projects?.filter(p => p.status === 'approvato' && (p.project_status === 'aperto' || p.project_status === 'in_partenza')).length || 0;

      const { count: myQuotes } = await supabase
        .from('quotes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      const { count: pendingQuotes } = await supabase
        .from('quotes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .in('status', ['draft', 'sent']);

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
    queryKey: ['finance-dashboard-stats'],
    queryFn: async () => {
      const { data: projects } = await supabase
        .from('projects')
        .select('*, clients(name)')
        .eq('status', 'approvato');

      const totalRevenue = projects?.reduce((sum, p) => sum + (p.total_budget || 0), 0) || 0;
      const projectsToInvoice = projects?.filter(p => p.project_status === 'da_fatturare') || [];

      const { count: totalQuotes } = await supabase
        .from('quotes')
        .select('*', { count: 'exact', head: true });

      const { count: approvedQuotes } = await supabase
        .from('quotes')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'approved');

      const margins = projects?.map(p => p.margin_percentage || 0).filter(m => m > 0) || [];
      const avgMargin = margins.length > 0 ? margins.reduce((a, b) => a + b, 0) / margins.length : 0;

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
        }))
      };
    },
    enabled: userRole === 'finance'
  });

  // Team Leader stats query
  const { data: teamLeaderData } = useQuery({
    queryKey: ['team-leader-dashboard-stats', userId],
    queryFn: async () => {
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

      // Get time tracking for this week
      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);

      const { data: timeEntries } = await supabase
        .from('activity_time_tracking')
        .select('*, profiles:user_id(first_name, last_name)')
        .gte('scheduled_date', startOfWeek.toISOString().split('T')[0]);

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
        })) || []
      };
    },
    enabled: userRole === 'team_leader'
  });

  // Member stats query
  const { data: memberData } = useQuery({
    queryKey: ['member-dashboard-stats', userId],
    queryFn: async () => {
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);

      // Get time entries for today
      const { data: todayEntries } = await supabase
        .from('activity_time_tracking')
        .select('*, budget_items(activity_name, project_id, projects:project_id(name))')
        .eq('user_id', userId)
        .eq('scheduled_date', today);

      // Get time entries for this week
      const { data: weekEntries } = await supabase
        .from('activity_time_tracking')
        .select('*, budget_items(activity_name, project_id, projects:project_id(name))')
        .eq('user_id', userId)
        .gte('scheduled_date', startOfWeek.toISOString().split('T')[0])
        .lte('scheduled_date', endOfWeek.toISOString().split('T')[0]);

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

      const pendingActivities = weekEntries?.filter(e => !e.actual_start_time).length || 0;

      return {
        stats: {
          todayPlannedHours: calcHours(todayEntries || [], false),
          todayConfirmedHours: calcHours(todayEntries || [], true),
          weekPlannedHours: calcHours(weekEntries || [], false),
          weekConfirmedHours: calcHours(weekEntries || [], true),
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

  return (
    <AppLayout>
      <div className="container mx-auto p-6">
        {userRole === 'admin' && adminStats && (
          <AdminDashboard stats={adminStats} />
        )}
        {userRole === 'account' && accountData && (
          <AccountDashboard stats={accountData.stats} recentProjects={accountData.recentProjects} />
        )}
        {userRole === 'finance' && financeData && (
          <FinanceDashboard stats={financeData.stats} projectsToInvoice={financeData.projectsToInvoice} />
        )}
        {userRole === 'team_leader' && teamLeaderData && (
          <TeamLeaderDashboard 
            stats={teamLeaderData.stats} 
            teamWorkload={teamLeaderData.teamWorkload}
            recentProjects={teamLeaderData.recentProjects}
          />
        )}
        {userRole === 'member' && memberData && (
          <MemberDashboard 
            stats={memberData.stats} 
            todayActivities={memberData.todayActivities}
            upcomingActivities={memberData.upcomingActivities}
          />
        )}
      </div>
    </AppLayout>
  );
};

export default Dashboard;
