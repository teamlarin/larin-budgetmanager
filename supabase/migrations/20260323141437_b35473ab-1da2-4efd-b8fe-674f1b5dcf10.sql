
CREATE TABLE public.product_service_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.product_service_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved users can view product service categories"
  ON public.product_service_categories FOR SELECT
  TO public
  USING (is_approved_user(auth.uid()));

CREATE POLICY "Admins can manage product service categories"
  ON public.product_service_categories FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- Add unique constraint on name
ALTER TABLE public.product_service_categories ADD CONSTRAINT product_service_categories_name_key UNIQUE (name);
