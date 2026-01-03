import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Permission } from '@/lib/permissions';

export interface RolePermissionRow {
  id: string;
  role: string;
  can_access_settings: boolean;
  can_manage_users: boolean;
  can_manage_clients: boolean;
  can_manage_products: boolean;
  can_manage_services: boolean;
  can_manage_levels: boolean;
  can_manage_categories: boolean;
  can_manage_templates: boolean;
  can_create_projects: boolean;
  can_edit_projects: boolean;
  can_delete_projects: boolean;
  can_change_project_status: boolean;
  can_edit_budget: boolean;
  can_edit_financial_fields: boolean;
  can_view_all_projects: boolean;
  can_create_quotes: boolean;
  can_edit_quotes: boolean;
  can_delete_quotes: boolean;
  can_download_quotes: boolean;
}

// Map database column names to Permission keys
const dbToPermissionKey: Record<string, keyof Permission> = {
  can_access_settings: 'canAccessSettings',
  can_manage_users: 'canManageUsers',
  can_manage_clients: 'canManageClients',
  can_manage_products: 'canManageProducts',
  can_manage_services: 'canManageServices',
  can_manage_levels: 'canManageLevels',
  can_manage_categories: 'canManageCategories',
  can_manage_templates: 'canManageTemplates',
  can_create_projects: 'canCreateProjects',
  can_edit_projects: 'canEditProjects',
  can_delete_projects: 'canDeleteProjects',
  can_change_project_status: 'canChangeProjectStatus',
  can_edit_budget: 'canEditBudget',
  can_edit_financial_fields: 'canEditFinancialFields',
  can_view_all_projects: 'canViewAllProjects',
  can_create_quotes: 'canCreateQuotes',
  can_edit_quotes: 'canEditQuotes',
  can_delete_quotes: 'canDeleteQuotes',
  can_download_quotes: 'canDownloadQuotes',
};

// Map Permission keys to database column names
export const permissionToDbKey: Record<keyof Permission, string> = {
  canAccessSettings: 'can_access_settings',
  canManageUsers: 'can_manage_users',
  canManageClients: 'can_manage_clients',
  canManageProducts: 'can_manage_products',
  canManageServices: 'can_manage_services',
  canManageLevels: 'can_manage_levels',
  canManageCategories: 'can_manage_categories',
  canManageTemplates: 'can_manage_templates',
  canCreateProjects: 'can_create_projects',
  canEditProjects: 'can_edit_projects',
  canDeleteProjects: 'can_delete_projects',
  canChangeProjectStatus: 'can_change_project_status',
  canEditBudget: 'can_edit_budget',
  canEditFinancialFields: 'can_edit_financial_fields',
  canViewAllProjects: 'can_view_all_projects',
  canCreateQuotes: 'can_create_quotes',
  canEditQuotes: 'can_edit_quotes',
  canDeleteQuotes: 'can_delete_quotes',
  canDownloadQuotes: 'can_download_quotes',
};

export const useRolePermissions = () => {
  const [permissions, setPermissions] = useState<Record<string, Permission>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPermissions = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('role_permissions')
        .select('*');

      if (error) throw error;

      const permissionsMap: Record<string, Permission> = {};
      
      data?.forEach((row: RolePermissionRow) => {
        const permission: Permission = {
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
        permissionsMap[row.role] = permission;
      });

      setPermissions(permissionsMap);
      setError(null);
    } catch (err) {
      console.error('Error fetching permissions:', err);
      setError('Errore nel caricamento dei permessi');
    } finally {
      setLoading(false);
    }
  }, []);

  const updatePermission = async (
    role: string,
    permissionKey: keyof Permission,
    value: boolean
  ): Promise<boolean> => {
    try {
      const dbColumn = permissionToDbKey[permissionKey];
      
      const { error } = await supabase
        .from('role_permissions')
        .update({ [dbColumn]: value })
        .eq('role', role);

      if (error) throw error;

      // Update local state
      setPermissions(prev => ({
        ...prev,
        [role]: {
          ...prev[role],
          [permissionKey]: value,
        },
      }));

      return true;
    } catch (err) {
      console.error('Error updating permission:', err);
      return false;
    }
  };

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  return {
    permissions,
    loading,
    error,
    updatePermission,
    refetch: fetchPermissions,
  };
};

// Function to get permissions for a specific role (can be used outside of React)
export const fetchRolePermissions = async (role: string): Promise<Permission | null> => {
  try {
    const { data, error } = await supabase
      .from('role_permissions')
      .select('*')
      .eq('role', role)
      .maybeSingle();

    if (error || !data) return null;

    return {
      canAccessSettings: data.can_access_settings,
      canManageUsers: data.can_manage_users,
      canManageClients: data.can_manage_clients,
      canManageProducts: data.can_manage_products,
      canManageServices: data.can_manage_services,
      canManageLevels: data.can_manage_levels,
      canManageCategories: data.can_manage_categories,
      canManageTemplates: data.can_manage_templates,
      canCreateProjects: data.can_create_projects,
      canEditProjects: data.can_edit_projects,
      canDeleteProjects: data.can_delete_projects,
      canChangeProjectStatus: data.can_change_project_status,
      canEditBudget: data.can_edit_budget,
      canEditFinancialFields: data.can_edit_financial_fields,
      canViewAllProjects: data.can_view_all_projects,
      canCreateQuotes: data.can_create_quotes,
      canEditQuotes: data.can_edit_quotes,
      canDeleteQuotes: data.can_delete_quotes,
      canDownloadQuotes: data.can_download_quotes,
    };
  } catch (err) {
    console.error('Error fetching role permissions:', err);
    return null;
  }
};
