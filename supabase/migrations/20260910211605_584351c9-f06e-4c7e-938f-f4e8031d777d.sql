UPDATE public.budget_items
SET parent_id = NULL
WHERE parent_id IS NOT NULL;

ALTER TABLE public.budget_items
DROP COLUMN parent_id;