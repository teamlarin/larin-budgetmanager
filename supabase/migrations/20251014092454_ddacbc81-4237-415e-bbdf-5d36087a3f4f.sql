-- Fix data integrity issue: Make projects.user_id NOT NULL
-- This prevents orphaned projects without clear ownership

-- First, check if there are any NULL user_id values and handle them
-- Note: If any NULL values exist, this migration will fail and you'll need to 
-- manually assign those projects to a user before running this migration

-- Add NOT NULL constraint to user_id column
ALTER TABLE public.projects 
ALTER COLUMN user_id SET NOT NULL;

-- Add a comment to document the constraint
COMMENT ON COLUMN public.projects.user_id IS 'Owner of the project. Cannot be NULL to ensure all projects have a clear owner.';