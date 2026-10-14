ALTER TABLE public.budget_items
  ADD COLUMN IF NOT EXISTS is_external_cost boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS external_cost_base numeric,
  ADD COLUMN IF NOT EXISTS external_cost_markup numeric DEFAULT 30,
  ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL;
ALTER TABLE public.project_additional_costs
  ADD COLUMN IF NOT EXISTS source_budget_item_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS project_additional_costs_source_item_uniq
  ON public.project_additional_costs(project_id, source_budget_item_id) WHERE source_budget_item_id IS NOT NULL;