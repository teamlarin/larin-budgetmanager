-- Add project_type column to budgets table
ALTER TABLE public.budgets 
ADD COLUMN project_type TEXT NOT NULL DEFAULT 'budget';

-- Migrate project_type from existing projects
UPDATE public.budgets b
SET project_type = p.project_type
FROM public.projects p
WHERE b.project_id = p.id;