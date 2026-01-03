-- Create table for role permissions
CREATE TABLE public.role_permissions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  role text NOT NULL UNIQUE,
  can_access_settings boolean NOT NULL DEFAULT false,
  can_manage_users boolean NOT NULL DEFAULT false,
  can_manage_clients boolean NOT NULL DEFAULT false,
  can_manage_products boolean NOT NULL DEFAULT false,
  can_manage_services boolean NOT NULL DEFAULT false,
  can_manage_levels boolean NOT NULL DEFAULT false,
  can_manage_categories boolean NOT NULL DEFAULT false,
  can_manage_templates boolean NOT NULL DEFAULT false,
  can_create_projects boolean NOT NULL DEFAULT false,
  can_edit_projects boolean NOT NULL DEFAULT false,
  can_delete_projects boolean NOT NULL DEFAULT false,
  can_change_project_status boolean NOT NULL DEFAULT false,
  can_edit_budget boolean NOT NULL DEFAULT false,
  can_edit_financial_fields boolean NOT NULL DEFAULT false,
  can_view_all_projects boolean NOT NULL DEFAULT false,
  can_create_quotes boolean NOT NULL DEFAULT false,
  can_edit_quotes boolean NOT NULL DEFAULT false,
  can_delete_quotes boolean NOT NULL DEFAULT false,
  can_download_quotes boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- Anyone approved can view permissions
CREATE POLICY "Approved users can view role permissions"
ON public.role_permissions
FOR SELECT
USING (is_approved_user(auth.uid()));

-- Only admins can modify permissions
CREATE POLICY "Admins can update role permissions"
ON public.role_permissions
FOR UPDATE
USING (is_admin(auth.uid()));

CREATE POLICY "Admins can insert role permissions"
ON public.role_permissions
FOR INSERT
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can delete role permissions"
ON public.role_permissions
FOR DELETE
USING (is_admin(auth.uid()));

-- Insert default permissions for all roles
INSERT INTO public.role_permissions (role, can_access_settings, can_manage_users, can_manage_clients, can_manage_products, can_manage_services, can_manage_levels, can_manage_categories, can_manage_templates, can_create_projects, can_edit_projects, can_delete_projects, can_change_project_status, can_edit_budget, can_edit_financial_fields, can_view_all_projects, can_create_quotes, can_edit_quotes, can_delete_quotes, can_download_quotes)
VALUES 
  ('admin', true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true),
  ('account', true, false, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true),
  ('finance', false, false, false, false, false, false, false, false, false, false, false, false, false, true, true, true, true, false, true),
  ('team_leader', false, false, false, false, false, false, false, false, true, true, false, false, true, false, true, false, false, false, true),
  ('coordinator', false, false, false, false, false, false, false, false, false, true, false, false, true, false, true, false, false, false, true),
  ('member', false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false);

-- Add trigger for updated_at
CREATE TRIGGER update_role_permissions_updated_at
BEFORE UPDATE ON public.role_permissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();