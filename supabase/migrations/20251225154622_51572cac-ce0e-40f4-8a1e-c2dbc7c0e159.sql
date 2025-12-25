-- Add start_day_offset column to budget_items table
-- This represents the number of days from project start date when this activity begins
ALTER TABLE public.budget_items 
ADD COLUMN start_day_offset integer DEFAULT 0;