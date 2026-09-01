ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS title text;
COMMENT ON COLUMN public.offers.title IS 'Titolo descrittivo dell''offerta: prefillato dal nome del budget di origine, modificabile manualmente.';
UPDATE public.offers o
SET title = b.name
FROM public.budgets b
WHERE o.budget_id = b.id AND o.title IS NULL AND b.name IS NOT NULL;