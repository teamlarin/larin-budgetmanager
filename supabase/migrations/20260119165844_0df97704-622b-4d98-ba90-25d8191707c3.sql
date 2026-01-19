-- Remove the progress check constraint that limits progress to 0-100
-- This is needed because pack projects can exceed 100% (overtime)
ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_progress_check;