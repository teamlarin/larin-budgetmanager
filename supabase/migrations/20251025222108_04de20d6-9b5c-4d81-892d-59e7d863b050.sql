-- Add is_product column to budget_items table
ALTER TABLE public.budget_items 
ADD COLUMN is_product boolean DEFAULT false;

-- Add product_id column to store reference to products table
ALTER TABLE public.budget_items 
ADD COLUMN product_id uuid REFERENCES public.products(id) ON DELETE SET NULL;

-- Add quantity column (for products, hours_worked will be repurposed as quantity)
-- No need to add a new column since we can use hours_worked for quantity

COMMENT ON COLUMN public.budget_items.is_product IS 'Indicates if this item is a product rather than an activity';
COMMENT ON COLUMN public.budget_items.product_id IS 'Reference to the product if this is a product item';
COMMENT ON COLUMN public.budget_items.hours_worked IS 'Hours for activities, quantity for products';