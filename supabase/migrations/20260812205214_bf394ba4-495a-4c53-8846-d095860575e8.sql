CREATE OR REPLACE FUNCTION public.can_access_project_tasks(_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_approved_user(auth.uid()) AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'team_leader')
    OR public.has_role(auth.uid(), 'coordinator')
    OR public.has_role(auth.uid(), 'account')
    OR public.has_role(auth.uid(), 'finance')
    OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = _project_id AND p.project_leader_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = _project_id AND pm.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.external_project_access epa WHERE epa.project_id = _project_id AND epa.user_id = auth.uid())
  )
$$;

CREATE TABLE public.project_tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  assignee_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','in_progress','done')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('high','medium','low')),
  due_date date,
  workflow_flow_task_id uuid REFERENCES public.workflow_flow_tasks(id) ON DELETE SET NULL,
  created_by uuid,
  completed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_project_tasks_project ON public.project_tasks(project_id);
CREATE INDEX idx_project_tasks_project_status ON public.project_tasks(project_id, status);
CREATE INDEX idx_project_tasks_assignee ON public.project_tasks(assignee_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_tasks TO authenticated;
GRANT ALL ON public.project_tasks TO service_role;

ALTER TABLE public.project_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project team can view tasks"
ON public.project_tasks FOR SELECT TO authenticated
USING (public.can_access_project_tasks(project_id));

CREATE POLICY "Project team can create tasks"
ON public.project_tasks FOR INSERT TO authenticated
WITH CHECK (public.can_access_project_tasks(project_id));

CREATE POLICY "Project team can update tasks"
ON public.project_tasks FOR UPDATE TO authenticated
USING (public.can_access_project_tasks(project_id))
WITH CHECK (public.can_access_project_tasks(project_id));

CREATE POLICY "Project team can delete tasks"
ON public.project_tasks FOR DELETE TO authenticated
USING (public.can_access_project_tasks(project_id));

CREATE TRIGGER update_project_tasks_updated_at
BEFORE UPDATE ON public.project_tasks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

REVOKE EXECUTE ON FUNCTION public.can_access_project_tasks(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_project_tasks(uuid) TO authenticated, service_role;