-- 1. Titolo di riga separato dalla descrizione
ALTER TABLE public.offer_lines ADD COLUMN IF NOT EXISTS product_name text;

COMMENT ON COLUMN public.offer_lines.product_name IS 'Titolo della riga mostrato in offerta: precompilato dal nome del prodotto ma liberamente modificabile. Il riferimento per le statistiche resta product_id.';

-- Il backfill è una migrazione di struttura, non una modifica commerciale:
-- disattivo temporaneamente i guard di immutabilità delle righe.
ALTER TABLE public.offer_lines DISABLE TRIGGER USER;

UPDATE public.offer_lines l
SET product_name = COALESCE(NULLIF(btrim(l.description), ''), ''),
    description = CASE
      WHEN p.id IS NOT NULL AND COALESCE(btrim(l.description), '') IN ('', btrim(COALESCE(p.name, '')))
        THEN COALESCE(p.description, '')
      ELSE l.description
    END
FROM public.offer_lines x
LEFT JOIN public.products p ON p.id = x.product_id
WHERE l.id = x.id;

UPDATE public.offer_lines SET product_name = '' WHERE product_name IS NULL;

ALTER TABLE public.offer_lines ENABLE TRIGGER USER;

ALTER TABLE public.offer_lines ALTER COLUMN product_name SET DEFAULT '';
ALTER TABLE public.offer_lines ALTER COLUMN product_name SET NOT NULL;

-- 2. Prodotti collegati ai modelli di budget
CREATE TABLE IF NOT EXISTS public.budget_template_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_template_id uuid NOT NULL REFERENCES public.budget_templates(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity numeric NOT NULL DEFAULT 1,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (budget_template_id, product_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.budget_template_products TO authenticated;
GRANT ALL ON public.budget_template_products TO service_role;

ALTER TABLE public.budget_template_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved users can manage budget template products"
ON public.budget_template_products
FOR ALL
TO authenticated
USING (public.is_approved_user(auth.uid()))
WITH CHECK (public.is_approved_user(auth.uid()));

CREATE TRIGGER update_budget_template_products_updated_at
BEFORE UPDATE ON public.budget_template_products
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();