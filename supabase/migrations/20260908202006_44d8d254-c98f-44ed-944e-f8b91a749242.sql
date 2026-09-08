ALTER TABLE public.project_tasks DROP CONSTRAINT IF EXISTS project_tasks_status_check;
UPDATE public.project_tasks SET status = 'in_progress' WHERE status = 'in_review';
ALTER TABLE public.project_tasks ALTER COLUMN status SET DEFAULT 'backlog';
ALTER TABLE public.project_tasks ADD CONSTRAINT project_tasks_status_check CHECK (status = ANY (ARRAY['backlog'::text, 'todo'::text, 'in_progress'::text, 'done'::text, 'blocked'::text]));