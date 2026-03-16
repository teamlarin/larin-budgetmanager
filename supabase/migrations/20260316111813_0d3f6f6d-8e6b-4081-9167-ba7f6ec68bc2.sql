
-- Add 'external' to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'external';

-- Create external_project_access table
CREATE TABLE public.external_project_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, project_id)
);

-- Enable RLS
ALTER TABLE public.external_project_access ENABLE ROW LEVEL SECURITY;

-- Admin can manage all external access
CREATE POLICY "Admins can manage external access"
ON public.external_project_access
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- External users can view their own access records
CREATE POLICY "External users can view own access"
ON public.external_project_access
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Add RLS policy on projects for external users
CREATE POLICY "External users can view assigned projects"
ON public.projects
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.external_project_access epa
    WHERE epa.project_id = projects.id
      AND epa.user_id = auth.uid()
  )
);

-- Add RLS policy on budget_items for external users (can view and update assignee in assigned projects)
CREATE POLICY "External users can view budget items of assigned projects"
ON public.budget_items
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.external_project_access epa
    WHERE epa.project_id = budget_items.project_id
      AND epa.user_id = auth.uid()
  )
);

CREATE POLICY "External users can update assignee on assigned projects"
ON public.budget_items
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.external_project_access epa
    WHERE epa.project_id = budget_items.project_id
      AND epa.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.external_project_access epa
    WHERE epa.project_id = budget_items.project_id
      AND epa.user_id = auth.uid()
  )
);

-- External users can view time tracking for activities in their assigned projects
CREATE POLICY "External users can view time tracking of assigned projects"
ON public.activity_time_tracking
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.external_project_access epa
    JOIN public.budget_items bi ON bi.project_id = epa.project_id
    WHERE bi.id = activity_time_tracking.budget_item_id
      AND epa.user_id = auth.uid()
  )
);

-- Insert default permissions for external role
INSERT INTO public.role_permissions (role, can_access_settings, can_manage_users, can_manage_clients, can_manage_products, can_manage_services, can_manage_levels, can_manage_categories, can_manage_templates, can_create_projects, can_edit_projects, can_delete_projects, can_change_project_status, can_edit_budget, can_edit_financial_fields, can_view_all_projects, can_create_quotes, can_edit_quotes, can_delete_quotes, can_download_quotes)
VALUES ('external', false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false);
