
-- Add new enum values for budget_status
ALTER TYPE budget_status ADD VALUE IF NOT EXISTS 'bozza';
ALTER TYPE budget_status ADD VALUE IF NOT EXISTS 'in_revisione';

-- Add assigned_user_id column to budgets table
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS assigned_user_id uuid REFERENCES auth.users(id);

-- Add assigned_user_id column to projects table (for consistency)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS assigned_user_id uuid REFERENCES auth.users(id);
