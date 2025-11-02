-- Add budget_template_id to projects table
ALTER TABLE public.projects 
ADD COLUMN budget_template_id uuid REFERENCES public.budget_templates(id);

-- Add index for better performance
CREATE INDEX idx_projects_budget_template_id ON public.projects(budget_template_id);