import { Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRoleSimulation } from '@/contexts/RoleSimulationContext';

type UserRole = 'admin' | 'account' | 'finance' | 'team_leader' | 'coordinator' | 'member';

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  account: 'Account',
  finance: 'Finance',
  team_leader: 'Team Leader',
  coordinator: 'Coordinator',
  member: 'Member',
};

export const RoleSimulationBanner = () => {
  const { simulatedRole, isSimulating, stopSimulation } = useRoleSimulation();

  if (!isSimulating) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-warning text-warning-foreground py-2 px-4 shadow-lg animate-in slide-in-from-bottom duration-300">
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-warning-foreground/10 rounded-full px-3 py-1">
            <AlertTriangle className="h-4 w-4" />
            <span className="font-medium text-sm">Modalità Simulazione</span>
          </div>
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            <span className="text-sm">
              Stai visualizzando l'app come: <strong>{ROLE_LABELS[simulatedRole as UserRole]}</strong>
            </span>
          </div>
        </div>
        
        <Button
          variant="secondary"
          size="sm"
          onClick={stopSimulation}
          className="gap-2 bg-warning-foreground/20 hover:bg-warning-foreground/30 text-warning-foreground border-0"
        >
          <EyeOff className="h-4 w-4" />
          Termina simulazione
        </Button>
      </div>
    </div>
  );
};
