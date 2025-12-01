-- Add projection threshold columns to projects table
ALTER TABLE public.projects
ADD COLUMN projection_warning_threshold numeric DEFAULT 10,
ADD COLUMN projection_critical_threshold numeric DEFAULT 25;