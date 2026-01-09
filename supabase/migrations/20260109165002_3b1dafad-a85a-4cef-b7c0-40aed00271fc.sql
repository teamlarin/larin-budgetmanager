-- Add drive folder columns to budgets table
ALTER TABLE public.budgets 
ADD COLUMN IF NOT EXISTS drive_folder_id TEXT,
ADD COLUMN IF NOT EXISTS drive_folder_name TEXT;