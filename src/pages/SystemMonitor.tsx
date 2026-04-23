import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { CronJobsMonitor } from '@/components/dashboards/CronJobsMonitor';

const SystemMonitor = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/auth');
        return;
      }
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      if (roleData?.role !== 'admin') {
        toast({
          title: 'Accesso negato',
          description: 'Solo gli admin possono accedere al monitor di sistema.',
          variant: 'destructive',
        });
        navigate('/settings');
        return;
      }
      setAuthorized(true);
      setLoading(false);
    })();
  }, [navigate, toast]);

  if (loading) {
    return (
      <div className="page-container">
        <p className="text-muted-foreground">Caricamento…</p>
      </div>
    );
  }

  if (!authorized) return null;

  return (
    <div className="page-container stack-lg">
      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate('/settings')} className="mb-2">
          <ArrowLeft className="h-4 w-4 mr-1" /> Impostazioni
        </Button>
        <h1 className="page-title">Monitor Sistema</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Stato dei cron job e storico delle esecuzioni.
        </p>
      </div>

      <CronJobsMonitor />
    </div>
  );
};

export default SystemMonitor;
