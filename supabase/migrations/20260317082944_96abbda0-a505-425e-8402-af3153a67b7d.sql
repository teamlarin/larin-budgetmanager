
-- 1. Create external_visible_users table
CREATE TABLE public.external_visible_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  visible_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (external_user_id, visible_user_id)
);

ALTER TABLE public.external_visible_users ENABLE ROW LEVEL SECURITY;

-- Admin can do everything
CREATE POLICY "Admins manage external_visible_users"
ON public.external_visible_users
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- External users can read their own visibility records
CREATE POLICY "External users read own visibility"
ON public.external_visible_users
FOR SELECT
TO authenticated
USING (external_user_id = auth.uid());

-- 2. Add INSERT policy on budget_items for external users on their assigned projects
CREATE POLICY "External users can insert budget_items on assigned projects"
ON public.budget_items
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'external')
  AND project_id IN (
    SELECT project_id FROM public.external_project_access WHERE user_id = auth.uid()
  )
);
