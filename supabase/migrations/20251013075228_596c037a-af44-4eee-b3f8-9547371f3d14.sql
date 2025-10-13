-- Add order column to budget_items table
ALTER TABLE public.budget_items 
ADD COLUMN display_order integer;

-- Set default order based on created_at for existing items
UPDATE public.budget_items 
SET display_order = (
  SELECT COUNT(*) 
  FROM public.budget_items AS bi2 
  WHERE bi2.project_id = budget_items.project_id 
  AND bi2.created_at <= budget_items.created_at
);

-- Set NOT NULL constraint after populating
ALTER TABLE public.budget_items 
ALTER COLUMN display_order SET NOT NULL;

-- Create index for better query performance
CREATE INDEX idx_budget_items_display_order ON public.budget_items(project_id, display_order);