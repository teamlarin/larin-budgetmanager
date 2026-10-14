CREATE TABLE public.budget_section_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id uuid NOT NULL REFERENCES public.budgets(id) ON DELETE CASCADE,
  budget_template_id uuid NOT NULL REFERENCES public.budget_templates(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (budget_id, budget_template_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.budget_section_products TO authenticated;
GRANT ALL ON public.budget_section_products TO service_role;
ALTER TABLE public.budget_section_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Approved users can manage budget section products" ON public.budget_section_products
FOR ALL TO authenticated USING (public.is_approved_user(auth.uid())) WITH CHECK (public.is_approved_user(auth.uid()));