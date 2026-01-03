-- Add parent_id column to budget_items for sub-activities support
ALTER TABLE public.budget_items 
ADD COLUMN parent_id uuid REFERENCES public.budget_items(id) ON DELETE CASCADE;

-- Create index for faster lookups
CREATE INDEX idx_budget_items_parent_id ON public.budget_items(parent_id);