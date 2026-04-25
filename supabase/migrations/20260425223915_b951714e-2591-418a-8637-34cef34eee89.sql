-- 1) Add area column to workflow_templates
ALTER TABLE public.workflow_templates ADD COLUMN IF NOT EXISTS area text NULL;

-- 2) Helper function for managing workflow templates
CREATE OR REPLACE FUNCTION public.can_manage_workflow_templates(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(_user_id, 'admin')
    OR public.has_role(_user_id, 'finance')
    OR public.has_role(_user_id, 'team_leader')
    OR public.has_role(_user_id, 'coordinator');
$$;

-- 3) Replace policies on workflow_templates
DROP POLICY IF EXISTS "Admins can insert templates" ON public.workflow_templates;
DROP POLICY IF EXISTS "Admins can update templates" ON public.workflow_templates;
DROP POLICY IF EXISTS "Admins can delete templates" ON public.workflow_templates;

CREATE POLICY "Workflow managers can insert templates"
ON public.workflow_templates FOR INSERT TO authenticated
WITH CHECK (public.can_manage_workflow_templates(auth.uid()));

CREATE POLICY "Workflow managers can update templates"
ON public.workflow_templates FOR UPDATE TO authenticated
USING (public.can_manage_workflow_templates(auth.uid()));

CREATE POLICY "Workflow managers can delete templates"
ON public.workflow_templates FOR DELETE TO authenticated
USING (public.can_manage_workflow_templates(auth.uid()));

-- 4) Replace policies on workflow_task_templates
DROP POLICY IF EXISTS "Admins can insert task templates" ON public.workflow_task_templates;
DROP POLICY IF EXISTS "Admins can update task templates" ON public.workflow_task_templates;
DROP POLICY IF EXISTS "Admins can delete task templates" ON public.workflow_task_templates;

CREATE POLICY "Workflow managers can insert task templates"
ON public.workflow_task_templates FOR INSERT TO authenticated
WITH CHECK (public.can_manage_workflow_templates(auth.uid()));

CREATE POLICY "Workflow managers can update task templates"
ON public.workflow_task_templates FOR UPDATE TO authenticated
USING (public.can_manage_workflow_templates(auth.uid()));

CREATE POLICY "Workflow managers can delete task templates"
ON public.workflow_task_templates FOR DELETE TO authenticated
USING (public.can_manage_workflow_templates(auth.uid()));