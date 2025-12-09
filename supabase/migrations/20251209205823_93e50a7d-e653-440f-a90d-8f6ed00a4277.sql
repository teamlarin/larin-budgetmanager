-- Add share_token column to projects for public timesheet sharing
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS timesheet_share_token TEXT UNIQUE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_projects_timesheet_share_token 
ON public.projects(timesheet_share_token) 
WHERE timesheet_share_token IS NOT NULL;