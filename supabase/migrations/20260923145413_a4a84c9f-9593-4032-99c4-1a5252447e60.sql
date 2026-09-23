ALTER TABLE public.project_deliverables
  ADD COLUMN IF NOT EXISTS owner_side text NOT NULL DEFAULT 'larin',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'da_fare',
  ADD COLUMN IF NOT EXISTS client_confirmed_date date,
  ADD COLUMN IF NOT EXISTS gantt_impact_days integer,
  ADD COLUMN IF NOT EXISTS gantt_impact_applied_days integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS display_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS budget_item_id uuid REFERENCES public.budget_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_project_deliverables_budget_item ON public.project_deliverables(budget_item_id);