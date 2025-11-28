-- Add is_billable column to projects table
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS is_billable boolean DEFAULT true;

-- Add billing_type column to projects table
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS billing_type text DEFAULT 'one_shot';

-- Add comment for clarity
COMMENT ON COLUMN public.projects.is_billable IS 'Indicates if the project is billable or non-billable';
COMMENT ON COLUMN public.projects.billing_type IS 'Type of billing: one_shot, recurring, consumptive, pack, pre_sales, interno';