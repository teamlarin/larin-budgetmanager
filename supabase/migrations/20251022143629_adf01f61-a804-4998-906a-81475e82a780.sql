-- Add 'editor' role to app_role enum if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t 
    JOIN pg_enum e ON t.oid = e.enumtypid  
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'app_role' 
    AND e.enumlabel = 'editor') THEN
    ALTER TYPE public.app_role ADD VALUE 'editor';
  END IF;
END $$;

-- Create enum for budget status
CREATE TYPE public.budget_status AS ENUM ('in_attesa', 'approvato', 'rifiutato');

-- Modify projects table to use budget_status enum
-- First, update existing status values to match new enum
UPDATE public.projects SET status = 'in_attesa' WHERE status IS NOT NULL;

-- Drop the old status column and recreate with proper type
ALTER TABLE public.projects DROP COLUMN status;
ALTER TABLE public.projects ADD COLUMN status budget_status NOT NULL DEFAULT 'in_attesa';

-- Create index for better performance when filtering by status
CREATE INDEX idx_projects_status ON public.projects(status);

-- Create helper function to check if user is editor or admin
CREATE OR REPLACE FUNCTION public.is_editor_or_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'editor')
  )
$$;

-- Add RLS policy for updating project status (only editors and admins)
CREATE POLICY "Editors and admins can update project status"
ON public.projects
FOR UPDATE
USING (public.is_editor_or_admin(auth.uid()))
WITH CHECK (public.is_editor_or_admin(auth.uid()));