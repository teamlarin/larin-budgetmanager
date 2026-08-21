ALTER TABLE public.project_tasks
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS estimated_hours numeric,
  ADD COLUMN IF NOT EXISTS description_html text;

ALTER TABLE public.project_tasks DROP CONSTRAINT IF EXISTS project_tasks_status_check;
ALTER TABLE public.project_tasks ADD CONSTRAINT project_tasks_status_check
  CHECK (status = ANY (ARRAY['todo'::text, 'in_progress'::text, 'in_review'::text, 'done'::text]));

CREATE TABLE IF NOT EXISTS public.project_task_assignees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.project_tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_task_assignees TO authenticated;
GRANT ALL ON public.project_task_assignees TO service_role;
ALTER TABLE public.project_task_assignees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "task assignees viewable by project task viewers"
  ON public.project_task_assignees FOR SELECT TO authenticated
  USING (public.can_access_project_tasks((SELECT project_id FROM public.project_tasks t WHERE t.id = task_id)));

CREATE POLICY "task assignees manageable by project task viewers"
  ON public.project_task_assignees FOR ALL TO authenticated
  USING (public.can_access_project_tasks((SELECT project_id FROM public.project_tasks t WHERE t.id = task_id)))
  WITH CHECK (public.can_access_project_tasks((SELECT project_id FROM public.project_tasks t WHERE t.id = task_id)));

CREATE INDEX IF NOT EXISTS idx_project_task_assignees_task ON public.project_task_assignees(task_id);
CREATE INDEX IF NOT EXISTS idx_project_task_assignees_user ON public.project_task_assignees(user_id);

INSERT INTO public.project_task_assignees (task_id, user_id)
SELECT id, assignee_id FROM public.project_tasks WHERE assignee_id IS NOT NULL
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.project_task_time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.project_tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  minutes numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_task_time_entries TO authenticated;
GRANT ALL ON public.project_task_time_entries TO service_role;
ALTER TABLE public.project_task_time_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "task time entries viewable by project task viewers"
  ON public.project_task_time_entries FOR SELECT TO authenticated
  USING (public.can_access_project_tasks((SELECT project_id FROM public.project_tasks t WHERE t.id = task_id)));

CREATE POLICY "task time entries insert own"
  ON public.project_task_time_entries FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.can_access_project_tasks((SELECT project_id FROM public.project_tasks t WHERE t.id = task_id)));

CREATE POLICY "task time entries update own or manager"
  ON public.project_task_time_entries FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.projects p JOIN public.project_tasks t ON t.project_id = p.id WHERE t.id = task_id AND p.project_leader_id = auth.uid()))
  WITH CHECK (user_id = auth.uid() OR public.is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.projects p JOIN public.project_tasks t ON t.project_id = p.id WHERE t.id = task_id AND p.project_leader_id = auth.uid()));

CREATE POLICY "task time entries delete own or manager"
  ON public.project_task_time_entries FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.projects p JOIN public.project_tasks t ON t.project_id = p.id WHERE t.id = task_id AND p.project_leader_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_task_time_entries_task ON public.project_task_time_entries(task_id);
CREATE INDEX IF NOT EXISTS idx_task_time_entries_user_running ON public.project_task_time_entries(user_id) WHERE ended_at IS NULL;

CREATE TRIGGER update_project_task_time_entries_updated_at
  BEFORE UPDATE ON public.project_task_time_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();