-- Make project_id nullable in quotes table to support the new flow:
-- Budget approved → Quote created (no project yet)
-- Quote approved → Project created with status "in_partenza"

ALTER TABLE public.quotes 
ALTER COLUMN project_id DROP NOT NULL;

-- Add a comment to document the new flow
COMMENT ON COLUMN public.quotes.project_id IS 'Links to the project created when quote is approved. NULL until quote approval.';