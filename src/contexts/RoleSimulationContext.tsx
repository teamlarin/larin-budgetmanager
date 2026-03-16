import { createContext, useContext, useState, ReactNode } from 'react';

// Role types for simulation
type UserRole = 'admin' | 'account' | 'finance' | 'team_leader' | 'coordinator' | 'member' | 'external' | null;

interface RoleSimulationContextType {
  simulatedRole: UserRole;
  isSimulating: boolean;
  startSimulation: (role: UserRole) => void;
  stopSimulation: () => void;
  getEffectiveRole: (realRole: UserRole) => UserRole;
}

const RoleSimulationContext = createContext<RoleSimulationContextType | undefined>(undefined);

export const RoleSimulationProvider = ({ children }: { children: ReactNode }) => {
  const [simulatedRole, setSimulatedRole] = useState<UserRole>(null);

  const isSimulating = simulatedRole !== null;

  const startSimulation = (role: UserRole) => {
    setSimulatedRole(role);
  };

  const stopSimulation = () => {
    setSimulatedRole(null);
  };

  const getEffectiveRole = (realRole: UserRole): UserRole => {
    return isSimulating ? simulatedRole : realRole;
  };

  return (
    <RoleSimulationContext.Provider
      value={{
        simulatedRole,
        isSimulating,
        startSimulation,
        stopSimulation,
        getEffectiveRole,
      }}
    >
      {children}
    </RoleSimulationContext.Provider>
  );
};

export const useRoleSimulation = () => {
  const context = useContext(RoleSimulationContext);
  if (context === undefined) {
    throw new Error('useRoleSimulation must be used within a RoleSimulationProvider');
  }
  return context;
};
