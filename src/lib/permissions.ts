import { supabase } from '@/integrations/supabase/client';

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

// Cache for permissions loaded from database
let permissionsCache: Record<string, Permission> | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Default permissions (fallback if database is not available)
const defaultPermissions: Record<UserRole, Permission> = {
  admin: {
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
  },
  account: {
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
  },
  finance: {
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
    canEditFinancialFields: true,
    canViewAllProjects: true,
    canCreateQuotes: true,
    canEditQuotes: true,
    canDeleteQuotes: false,
    canDownloadQuotes: true,
  },
  team_leader: {
    canAccessSettings: true,
    canManageUsers: false,
    canManageClients: true,
    canManageProducts: true,
    canManageServices: true,
    canManageLevels: true,
    canManageCategories: false,
    canManageTemplates: true,
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
  },
  coordinator: {
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
  },
  member: {
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
  },
};

// Load permissions from database
const loadPermissionsFromDB = async (): Promise<Record<string, Permission> | null> => {
  try {
    const { data, error } = await supabase
      .from('role_permissions')
      .select('*');

    if (error || !data) return null;

    const permissionsMap: Record<string, Permission> = {};
    
    data.forEach((row: any) => {
      permissionsMap[row.role] = {
        canAccessSettings: row.can_access_settings,
        canManageUsers: row.can_manage_users,
        canManageClients: row.can_manage_clients,
        canManageProducts: row.can_manage_products,
        canManageServices: row.can_manage_services,
        canManageLevels: row.can_manage_levels,
        canManageCategories: row.can_manage_categories,
        canManageTemplates: row.can_manage_templates,
        canCreateProjects: row.can_create_projects,
        canEditProjects: row.can_edit_projects,
        canDeleteProjects: row.can_delete_projects,
        canChangeProjectStatus: row.can_change_project_status,
        canEditBudget: row.can_edit_budget,
        canEditFinancialFields: row.can_edit_financial_fields,
        canViewAllProjects: row.can_view_all_projects,
        canCreateQuotes: row.can_create_quotes,
        canEditQuotes: row.can_edit_quotes,
        canDeleteQuotes: row.can_delete_quotes,
        canDownloadQuotes: row.can_download_quotes,
      };
    });

    return permissionsMap;
  } catch (err) {
    console.error('Error loading permissions from DB:', err);
    return null;
  }
};

// Refresh cache if needed
const refreshCacheIfNeeded = async () => {
  const now = Date.now();
  if (!permissionsCache || now - cacheTimestamp > CACHE_DURATION) {
    const dbPermissions = await loadPermissionsFromDB();
    if (dbPermissions) {
      permissionsCache = dbPermissions;
      cacheTimestamp = now;
    }
  }
};

// Start loading permissions immediately
refreshCacheIfNeeded();

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

  // Refresh cache in background (non-blocking)
  refreshCacheIfNeeded();

  // Use cached permissions if available, otherwise use defaults
  if (permissionsCache && permissionsCache[role]) {
    return permissionsCache[role];
  }

  return defaultPermissions[role] || getRolePermissions(null);
};

// Async version that ensures fresh data
export const getRolePermissionsAsync = async (role: UserRole | null): Promise<Permission> => {
  if (!role) {
    return getRolePermissions(null);
  }

  await refreshCacheIfNeeded();
  
  if (permissionsCache && permissionsCache[role]) {
    return permissionsCache[role];
  }

  return defaultPermissions[role] || getRolePermissions(null);
};

// Force refresh cache
export const invalidatePermissionsCache = () => {
  permissionsCache = null;
  cacheTimestamp = 0;
};

export const hasPermission = (role: UserRole | null, permission: keyof Permission): boolean => {
  const permissions = getRolePermissions(role);
  return permissions[permission];
};
