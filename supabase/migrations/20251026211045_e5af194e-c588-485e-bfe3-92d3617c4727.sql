-- Allow assignee_id to be null for products
ALTER TABLE budget_items 
ALTER COLUMN assignee_id DROP NOT NULL;

-- Allow assignee_name to be null for products
ALTER TABLE budget_items 
ALTER COLUMN assignee_name DROP NOT NULL;