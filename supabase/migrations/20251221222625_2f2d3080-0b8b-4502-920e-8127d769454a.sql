-- Add default_payment_terms column to clients table
ALTER TABLE public.clients 
ADD COLUMN default_payment_terms TEXT NULL;