/**
 * Costo personale: la vista HR (costi e budget del personale) che prima viveva
 * come tab della dashboard. Accessibile solo ad admin e finance.
 */
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { HrBudgetDashboard } from '@/components/dashboards/HrBudgetDashboard';
import { useRoleSimulation } from '@/contexts/RoleSimulationContext';

type UserRole = 'admin' | 'account' | 'finance' | 'team_leader' | 'coordinator' | 'member' | 'external';

const StaffCost = () => {
  const { getEffectiveRole } = useRoleSimulation();
  const [realRole, setRealRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .maybeSingle();
        setRealRole((data?.role as UserRole) ?? null);
      }
      setLoading(false);
    };
    fetchRole();
  }, []);

  const role = getEffectiveRole(realRole) as UserRole | null;
  const canView = role === 'admin' || role === 'finance';

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse h-40 bg-muted rounded-md" />
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="container mx-auto p-6">
        <h1 className="text-2xl font-bold">Costo personale</h1>
        <p className="mt-2 text-muted-foreground">Non hai i permessi per vedere questa sezione.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Costo personale</h1>
        <p className="mt-1 text-muted-foreground">Costi e budget del personale per anno.</p>
      </div>
      <HrBudgetDashboard />
    </div>
  );
};

export default StaffCost;
