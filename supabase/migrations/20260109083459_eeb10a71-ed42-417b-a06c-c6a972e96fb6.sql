-- Add drive folder fields to projects table
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS drive_folder_id TEXT,
ADD COLUMN IF NOT EXISTS drive_folder_name TEXT;