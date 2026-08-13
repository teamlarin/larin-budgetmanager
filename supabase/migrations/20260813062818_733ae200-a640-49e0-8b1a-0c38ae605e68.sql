ALTER TABLE public.project_tasks
  ADD COLUMN IF NOT EXISTS recurrence_rule text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS recurrence_interval integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS recurrence_end_date date,
  ADD COLUMN IF NOT EXISTS recurrence_parent_id uuid REFERENCES public.project_tasks(id) ON DELETE SET NULL;

ALTER TABLE public.project_tasks
  DROP CONSTRAINT IF EXISTS project_tasks_recurrence_rule_check;

ALTER TABLE public.project_tasks
  ADD CONSTRAINT project_tasks_recurrence_rule_check
  CHECK (recurrence_rule IN ('none','daily','weekly','monthly'));

ALTER TABLE public.project_tasks
  DROP CONSTRAINT IF EXISTS project_tasks_recurrence_interval_check;

ALTER TABLE public.project_tasks
  ADD CONSTRAINT project_tasks_recurrence_interval_check
  CHECK (recurrence_interval >= 1 AND recurrence_interval <= 365);

CREATE INDEX IF NOT EXISTS idx_project_tasks_recurrence_parent ON public.project_tasks(recurrence_parent_id);