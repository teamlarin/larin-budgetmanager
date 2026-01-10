-- Add manual_quote_number field to projects table
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS manual_quote_number TEXT;