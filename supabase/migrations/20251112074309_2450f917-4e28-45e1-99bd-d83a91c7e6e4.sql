-- Add VAT rate field to budget_items table (products)
ALTER TABLE public.budget_items 
ADD COLUMN IF NOT EXISTS vat_rate numeric NOT NULL DEFAULT 22;

COMMENT ON COLUMN public.budget_items.vat_rate IS 'VAT rate percentage (default 22%)';

-- Add VAT rate field to services table
ALTER TABLE public.services 
ADD COLUMN IF NOT EXISTS vat_rate numeric NOT NULL DEFAULT 22;

COMMENT ON COLUMN public.services.vat_rate IS 'VAT rate percentage (default 22%)';