-- Add supplier_id column to project_additional_costs
ALTER TABLE public.project_additional_costs
ADD COLUMN supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL;