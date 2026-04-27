ALTER TABLE public.budget_items
ADD COLUMN IF NOT EXISTS source_template_id uuid NULL REFERENCES public.budget_templates(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_budget_items_source_template_id
ON public.budget_items(source_template_id);