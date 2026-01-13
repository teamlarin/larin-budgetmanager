-- Make project_id nullable in budget_items to allow budget items without a project
ALTER TABLE public.budget_items 
ALTER COLUMN project_id DROP NOT NULL;