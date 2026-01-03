type UserRole = 'admin' | 'account' | 'finance' | 'team_leader' | 'coordinator' | 'member';

export interface Permission {
  canAccessSettings: boolean;
  canManageUsers: boolean;
  canManageClients: boolean;
  canManageProducts: boolean;
  canManageServices: boolean;
  canManageLevels: boolean;
  canManageCategories: boolean;
  canManageTemplates: boolean;
  canCreateProjects: boolean;
  canEditProjects: boolean;
  canDeleteProjects: boolean;
  canChangeProjectStatus: boolean;
  canEditBudget: boolean;
  canEditFinancialFields: boolean; // margins, discounts
  canViewAllProjects: boolean;
  canCreateQuotes: boolean;
  canEditQuotes: boolean;
  canDeleteQuotes: boolean;
  canDownloadQuotes: boolean;
}

export const getRolePermissions = (role: UserRole | null): Permission => {
  if (!role) {
    return {
      canAccessSettings: false,
      canManageUsers: false,
      canManageClients: false,
      canManageProducts: false,
      canManageServices: false,
      canManageLevels: false,
      canManageCategories: false,
      canManageTemplates: false,
      canCreateProjects: false,
      canEditProjects: false,
      canDeleteProjects: false,
      canChangeProjectStatus: false,
      canEditBudget: false,
      canEditFinancialFields: false,
      canViewAllProjects: false,
      canCreateQuotes: false,
      canEditQuotes: false,
      canDeleteQuotes: false,
      canDownloadQuotes: false,
    };
  }

  switch (role) {
    case 'admin':
      return {
        canAccessSettings: true,
        canManageUsers: true,
        canManageClients: true,
        canManageProducts: true,
        canManageServices: true,
        canManageLevels: true,
        canManageCategories: true,
        canManageTemplates: true,
        canCreateProjects: true,
        canEditProjects: true,
        canDeleteProjects: true,
        canChangeProjectStatus: true,
        canEditBudget: true,
        canEditFinancialFields: true,
        canViewAllProjects: true,
        canCreateQuotes: true,
        canEditQuotes: true,
        canDeleteQuotes: true,
        canDownloadQuotes: true,
      };
    
    case 'account':
      return {
        canAccessSettings: true,
        canManageUsers: false,
        canManageClients: true,
        canManageProducts: true,
        canManageServices: true,
        canManageLevels: true,
        canManageCategories: true,
        canManageTemplates: true,
        canCreateProjects: true,
        canEditProjects: true,
        canDeleteProjects: true,
        canChangeProjectStatus: true,
        canEditBudget: true,
        canEditFinancialFields: true,
        canViewAllProjects: true,
        canCreateQuotes: true,
        canEditQuotes: true,
        canDeleteQuotes: true,
        canDownloadQuotes: true,
      };
    
    case 'finance':
      return {
        canAccessSettings: false,
        canManageUsers: false,
        canManageClients: false,
        canManageProducts: false,
        canManageServices: false,
        canManageLevels: false,
        canManageCategories: false,
        canManageTemplates: false,
        canCreateProjects: false,
        canEditProjects: false,
        canDeleteProjects: false,
        canChangeProjectStatus: false,
        canEditBudget: false,
        canEditFinancialFields: true, // Can edit margins and discounts
        canViewAllProjects: true,
        canCreateQuotes: true,
        canEditQuotes: true,
        canDeleteQuotes: false,
        canDownloadQuotes: true,
      };
    
    case 'team_leader':
      return {
        canAccessSettings: false,
        canManageUsers: false,
        canManageClients: false,
        canManageProducts: false,
        canManageServices: false,
        canManageLevels: false,
        canManageCategories: false,
        canManageTemplates: false,
        canCreateProjects: true,
        canEditProjects: true,
        canDeleteProjects: false,
        canChangeProjectStatus: false,
        canEditBudget: true,
        canEditFinancialFields: false,
        canViewAllProjects: true,
        canCreateQuotes: false,
        canEditQuotes: false,
        canDeleteQuotes: false,
        canDownloadQuotes: true,
      };
    
    case 'coordinator':
      return {
        canAccessSettings: false,
        canManageUsers: false,
        canManageClients: false,
        canManageProducts: false,
        canManageServices: false,
        canManageLevels: false,
        canManageCategories: false,
        canManageTemplates: false,
        canCreateProjects: false,
        canEditProjects: true,
        canDeleteProjects: false,
        canChangeProjectStatus: false,
        canEditBudget: true,
        canEditFinancialFields: false,
        canViewAllProjects: true,
        canCreateQuotes: false,
        canEditQuotes: false,
        canDeleteQuotes: false,
        canDownloadQuotes: true,
      };
    
    case 'member':
      return {
        canAccessSettings: false,
        canManageUsers: false,
        canManageClients: false,
        canManageProducts: false,
        canManageServices: false,
        canManageLevels: false,
        canManageCategories: false,
        canManageTemplates: false,
        canCreateProjects: false,
        canEditProjects: false,
        canDeleteProjects: false,
        canChangeProjectStatus: false,
        canEditBudget: false,
        canEditFinancialFields: false,
        canViewAllProjects: false,
        canCreateQuotes: false,
        canEditQuotes: false,
        canDeleteQuotes: false,
        canDownloadQuotes: false,
      };
    
    default:
      return getRolePermissions(null);
  }
};

export const hasPermission = (role: UserRole | null, permission: keyof Permission): boolean => {
  const permissions = getRolePermissions(role);
  return permissions[permission];
};