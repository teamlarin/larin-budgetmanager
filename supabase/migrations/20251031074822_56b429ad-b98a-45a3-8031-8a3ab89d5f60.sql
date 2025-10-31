-- Add margin_percentage column to projects table
ALTER TABLE public.projects
ADD COLUMN margin_percentage numeric DEFAULT 0;