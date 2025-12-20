-- Add payment_terms column to budget_items table
ALTER TABLE public.budget_items 
ADD COLUMN IF NOT EXISTS payment_terms text;