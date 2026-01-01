-- Add manual activities budget field to projects table
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS manual_activities_budget numeric DEFAULT NULL;

-- Add a comment to explain the field
COMMENT ON COLUMN public.projects.manual_activities_budget IS 'Optional manual override for activities budget. When set, this value is used instead of the sum of budget items.';