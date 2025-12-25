-- Add duration_days column to budget_items table
ALTER TABLE public.budget_items 
ADD COLUMN duration_days integer DEFAULT NULL;