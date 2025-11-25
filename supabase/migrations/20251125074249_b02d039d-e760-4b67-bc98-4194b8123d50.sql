-- Add new enum for project status (different from budget status)
CREATE TYPE public.project_status AS ENUM ('in_partenza', 'aperto', 'da_fatturare', 'completato');

-- Add new columns to projects table
ALTER TABLE public.projects 
  ADD COLUMN project_status project_status DEFAULT 'in_partenza',
  ADD COLUMN progress numeric DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  ADD COLUMN area text,
  ADD COLUMN discipline discipline,
  ADD COLUMN end_date timestamp with time zone;

-- Create index for better performance on filtering
CREATE INDEX idx_projects_project_status ON public.projects(project_status);
CREATE INDEX idx_projects_area ON public.projects(area);
CREATE INDEX idx_projects_discipline ON public.projects(discipline);