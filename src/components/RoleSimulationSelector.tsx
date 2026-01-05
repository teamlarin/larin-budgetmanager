import { Eye, EyeOff, UserCog } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useRoleSimulation } from '@/contexts/RoleSimulationContext';
import { cn } from '@/lib/utils';

type UserRole = 'admin' | 'account' | 'finance' | 'team_leader' | 'member';

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  account: 'Account',
  finance: 'Finance',
  team_leader: 'Team Leader',
  member: 'Member',
};

const AVAILABLE_ROLES: UserRole[] = ['admin', 'account', 'finance', 'team_leader', 'member'];

export const RoleSimulationSelector = () => {
  const { simulatedRole, isSimulating, startSimulation, stopSimulation } = useRoleSimulation();

  return (
    <div className="flex items-center gap-2">
      {isSimulating && (
        <Badge 
          variant="outline" 
          className="bg-warning/10 text-warning border-warning/30 animate-pulse"
        >
          <Eye className="h-3 w-3 mr-1" />
          Visualizzando come: {ROLE_LABELS[simulatedRole as UserRole]}
        </Badge>
      )}
      
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant={isSimulating ? "destructive" : "outline"} 
            size="sm"
            className={cn(
              "gap-2",
              isSimulating && "animate-pulse"
            )}
          >
            <UserCog className="h-4 w-4" />
            {isSimulating ? 'Simulazione attiva' : 'Simula ruolo'}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel>Simula visualizzazione</DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          {AVAILABLE_ROLES.map((role) => (
            <DropdownMenuItem
              key={role}
              onClick={() => startSimulation(role)}
              className={cn(
                "cursor-pointer",
                simulatedRole === role && "bg-accent"
              )}
            >
              <Eye className="h-4 w-4 mr-2" />
              {ROLE_LABELS[role]}
            </DropdownMenuItem>
          ))}
          
          {isSimulating && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={stopSimulation}
                className="cursor-pointer text-destructive focus:text-destructive"
              >
                <EyeOff className="h-4 w-4 mr-2" />
                Termina simulazione
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
