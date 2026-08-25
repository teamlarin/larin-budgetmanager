ALTER TYPE public.offer_origin ADD VALUE IF NOT EXISTS 'budget';

ALTER TABLE public.offers
  ADD COLUMN IF NOT EXISTS budget_id uuid REFERENCES public.budgets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS legacy_quote_id uuid REFERENCES public.quotes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS legacy_quote_number text;

CREATE UNIQUE INDEX IF NOT EXISTS offers_legacy_quote_id_key
  ON public.offers (legacy_quote_id)
  WHERE legacy_quote_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS offers_budget_id_idx
  ON public.offers (budget_id)
  WHERE budget_id IS NOT NULL;

COMMENT ON COLUMN public.offers.budget_id IS 'Budget di origine quando l''offerta nasce dall''approvazione di un budget.';
COMMENT ON COLUMN public.offers.legacy_quote_id IS 'Preventivo (quotes) da cui questa offerta e stata migrata: garantisce idempotenza.';
COMMENT ON COLUMN public.offers.legacy_quote_number IS 'Numero preventivo storico (PREV-YYYY-NNN) conservato come riferimento cliente.';