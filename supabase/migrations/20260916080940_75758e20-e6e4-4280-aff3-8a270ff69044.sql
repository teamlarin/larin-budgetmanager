UPDATE public.products
SET category = 'RICAVI CANONI TECH',
    revenue_category = 'RICAVI CANONI TECH',
    updated_at = now()
WHERE fic_id IS NULL
  AND category = 'Tech > Canoni';