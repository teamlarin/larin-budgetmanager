-- Add objective column to projects table
ALTER TABLE public.projects 
ADD COLUMN objective text;