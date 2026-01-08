-- Add fic_id column to suppliers table to track Fatture in Cloud IDs
ALTER TABLE public.suppliers 
ADD COLUMN fic_id INTEGER UNIQUE;

-- Create index for faster lookups
CREATE INDEX idx_suppliers_fic_id ON public.suppliers(fic_id) WHERE fic_id IS NOT NULL;

-- Add comment
COMMENT ON COLUMN public.suppliers.fic_id IS 'Fatture in Cloud supplier ID for sync';