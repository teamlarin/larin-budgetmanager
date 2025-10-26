-- Add discount percentage column to projects table
ALTER TABLE projects 
ADD COLUMN discount_percentage numeric DEFAULT 0 CHECK (discount_percentage >= 0 AND discount_percentage <= 100);