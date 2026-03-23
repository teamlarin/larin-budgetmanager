
CREATE TABLE public.product_service_subcategories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.product_service_categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (category_id, name)
);

ALTER TABLE public.product_service_subcategories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage product service subcategories"
  ON public.product_service_subcategories
  FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Approved users can view product service subcategories"
  ON public.product_service_subcategories
  FOR SELECT
  TO public
  USING (is_approved_user(auth.uid()));
