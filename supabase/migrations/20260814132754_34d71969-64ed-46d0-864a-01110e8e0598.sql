ALTER TABLE public.activity_time_tracking
  ADD COLUMN IF NOT EXISTS task_id uuid NULL REFERENCES public.project_tasks(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_activity_time_tracking_task_id
  ON public.activity_time_tracking(task_id);