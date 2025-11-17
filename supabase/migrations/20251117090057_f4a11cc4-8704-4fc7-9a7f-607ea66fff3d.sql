-- Add payment_terms column to products table
ALTER TABLE public.products 
ADD COLUMN payment_terms TEXT;

-- Add payment_terms column to services table
ALTER TABLE public.services 
ADD COLUMN payment_terms TEXT;