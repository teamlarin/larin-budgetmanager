-- Add token_created_at column to projects table for token expiration
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS timesheet_token_created_at TIMESTAMP WITH TIME ZONE;