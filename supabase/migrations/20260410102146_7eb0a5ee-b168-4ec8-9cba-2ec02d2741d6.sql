CREATE TABLE public.quote_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  budget_id uuid NOT NULL REFERENCES public.budgets(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(quote_id, budget_id)
);

ALTER TABLE public.quote_budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved users can manage quote_budgets"
  ON public.quote_budgets
  FOR ALL
  TO authenticated
  USING (public.is_approved_user(auth.uid()))
  WITH CHECK (public.is_approved_user(auth.uid()));

-- Migrate existing data
INSERT INTO public.quote_budgets (quote_id, budget_id)
SELECT id, budget_id FROM public.quotes WHERE budget_id IS NOT NULL
ON CONFLICT DO NOTHING;