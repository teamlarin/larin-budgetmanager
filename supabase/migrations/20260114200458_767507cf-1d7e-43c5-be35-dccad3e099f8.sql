-- Add a column to track where the activity was created from
ALTER TABLE public.budget_items 
ADD COLUMN IF NOT EXISTS created_from TEXT DEFAULT 'budget';

-- Update existing custom activities to have 'project' as source (assuming they were created from project view)
UPDATE public.budget_items 
SET created_from = 'project' 
WHERE is_custom_activity = true AND created_from IS NULL;

-- Add a comment explaining the values
COMMENT ON COLUMN public.budget_items.created_from IS 'Source of activity creation: budget (from template), project (from project view), calendar (from calendar view)';