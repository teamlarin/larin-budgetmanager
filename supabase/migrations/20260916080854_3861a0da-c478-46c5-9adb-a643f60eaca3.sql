UPDATE public.products
SET category = revenue_category,
    updated_at = now()
WHERE revenue_category IS NOT NULL
  AND btrim(revenue_category) <> ''
  AND category IS DISTINCT FROM revenue_category;