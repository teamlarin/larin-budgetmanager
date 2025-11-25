-- Add start_date column to projects table
ALTER TABLE public.projects 
  ADD COLUMN IF NOT EXISTS start_date timestamp with time zone;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_projects_start_date ON public.projects(start_date);