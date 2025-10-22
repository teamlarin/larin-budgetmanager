-- Add area column to budget_templates table
ALTER TABLE public.budget_templates
ADD COLUMN area level_area NOT NULL DEFAULT 'marketing';