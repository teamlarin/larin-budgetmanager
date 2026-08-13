ALTER TABLE public.project_tasks
  ADD COLUMN IF NOT EXISTS budget_item_id uuid NULL REFERENCES public.budget_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_project_tasks_project_budget_item
  ON public.project_tasks (project_id, budget_item_id);

ALTER TABLE public.project_tasks DROP COLUMN IF EXISTS workflow_flow_task_id;